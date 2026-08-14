import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import type { Browser } from 'puppeteer';
import { PayrollAdjustmentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PayrollSummaryService } from './payroll-summary.service';

const ADJ_TYPE_LABEL: Record<PayrollAdjustmentType, string> = {
    BONUS: 'Bonus',
    ALLOWANCE: 'Tunjangan',
    DEDUCTION: 'Potongan',
    ADVANCE: 'Kasbon',
};

function fmt(n: number): string {
    return Math.round(n).toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

const MONTHS_ID_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Tanggal singkat ala sample: "2-Agu" (pakai UTC agar selaras dengan kolom @db.Date). */
function shortDate(d: Date): string {
    return `${d.getUTCDate()}-${MONTHS_ID_SHORT[d.getUTCMonth()]}`;
}

/** Tanggal cetak "dd/mm/yyyy" pakai zona waktu lokal server (tanggal slip dibuat). */
function ddmmyyyyLocal(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

@Injectable()
export class PayrollPayslipService implements OnModuleDestroy {
    private template: Handlebars.TemplateDelegate | null = null;
    private ownerTemplate: Handlebars.TemplateDelegate | null = null;
    private browser: Browser | null = null;

    constructor(
        private prisma: PrismaService,
        private summary: PayrollSummaryService,
    ) { }

    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    private getTemplatePath(name: string): string {
        const candidates = [
            path.resolve(__dirname, '..', '..', 'templates', 'payroll', name),
            path.resolve(__dirname, '..', '..', '..', 'templates', 'payroll', name),
            path.resolve(process.cwd(), 'templates', 'payroll', name),
        ];
        for (const c of candidates) if (fs.existsSync(c)) return c;
        throw new Error(`Template ${name} tidak ditemukan. Sudah coba: ${candidates.join(', ')}`);
    }

    private loadTemplate(): Handlebars.TemplateDelegate {
        if (this.template) return this.template;
        const source = fs.readFileSync(this.getTemplatePath('payslip.hbs'), 'utf-8');
        this.template = Handlebars.compile(source);
        return this.template;
    }

    private loadOwnerTemplate(): Handlebars.TemplateDelegate {
        if (this.ownerTemplate) return this.ownerTemplate;
        const source = fs.readFileSync(this.getTemplatePath('owner-report.hbs'), 'utf-8');
        this.ownerTemplate = Handlebars.compile(source);
        return this.ownerTemplate;
    }

    /** Render HTML → PDF A4 pakai shared browser instance. */
    private async htmlToPdf(html: string): Promise<Buffer> {
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        try {
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
            });
            return Buffer.from(pdf);
        } finally {
            await page.close();
        }
    }

    private async getBrowser(): Promise<Browser> {
        if (this.browser && this.browser.connected) return this.browser;
        const puppeteer = await import('puppeteer');
        this.browser = await puppeteer.default.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        return this.browser;
    }

    /** Parse "YYYY-MM-DD" ke UTC midnight (kolom @db.Date — hindari geser hari di TZ non-UTC). */
    private parseDate(input: string): Date {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
        if (!m) throw new BadRequestException(`Format tanggal invalid: ${input}`);
        return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    }

    /**
     * Generate payslip PDF untuk 1 worker di periode (from-to inclusive).
     * Perhitungan absensi memakai resolver TERPADU (workerPayrollDetail) → selalu sinkron dengan
     * halaman payroll (tier Gaji A/B/C, event tertaut, override crew, auto-match). Menampilkan
     * event & keterangan lembur. Tarif harian & no. HP sengaja tidak ditampilkan.
     * Hanya APPROVED attendance yang masuk perhitungan; PENDING/REJECTED tampil dengan badge tapi gak hitung total.
     */
    async renderPayslipPdf(workerId: number, from: string, to: string, approverId?: number): Promise<Buffer> {
        const start = this.parseDate(from);
        const end = this.parseDate(to);
        end.setUTCHours(23, 59, 59, 999);

        const [worker, detail, adjustments, settings, approver] = await Promise.all([
            this.prisma.worker.findUnique({
                where: { id: workerId },
                select: { id: true, name: true, position: true },
            }),
            this.summary.workerPayrollDetail(workerId, start, end),
            this.prisma.payrollAdjustment.findMany({
                where: { workerId, effectiveDate: { gte: start, lte: end } },
                orderBy: { effectiveDate: 'asc' },
            }),
            this.prisma.storeSettings.findFirst(),
            approverId ? this.prisma.user.findUnique({ where: { id: approverId }, select: { name: true, email: true, role: { select: { name: true } } } }) : Promise.resolve(null),
        ]);

        if (!worker || !detail) throw new NotFoundException(`Worker id=${workerId} tidak ditemukan`);

        const { approvedTotal, pendingCount } = detail;

        // --- HARIAN: kelompokkan hari APPROVED per tarif harian (tarif tak diekspor per baris,
        //     jadi diturunkan dari `base`: FULL_DAY → base, HALF_DAY → base×2). ½ hari dihitung 0,5 hari. ---
        const harianGroups = new Map<number, { days: number; amount: number }>();
        for (const r of detail.rows) {
            if (r.approvalStatus !== 'APPROVED') continue;
            let rate = 0, days = 0;
            if (r.status === 'FULL_DAY') { rate = r.base; days = 1; }
            else if (r.status === 'HALF_DAY') { rate = r.base * 2; days = 0.5; }
            else continue;
            const g = harianGroups.get(rate) ?? { days: 0, amount: 0 };
            g.days += days;
            g.amount += r.base;
            harianGroups.set(rate, g);
        }
        const harianRows = Array.from(harianGroups.entries())
            .sort((a, b) => b[0] - a[0])
            .map(([rate, g]) => ({
                qty: g.days.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                unit: 'hari',
                rate: fmt(rate),
                amount: fmt(g.amount),
            }));

        // --- LEMBUR & pekerjaan tambahan: baris lembur APPROVED (jam × tarif) + bonus/tunjangan (lump-sum). ---
        const lemburRows: Array<{ date: string; desc: string; qty: string; unit: string; rate: string; amount: string }> = [];
        for (const r of detail.rows) {
            if (r.approvalStatus !== 'APPROVED') continue;
            if (r.overtimeHours > 0 && r.overtimeAmount > 0) {
                lemburRows.push({
                    date: shortDate(r.attendanceDate),
                    desc: r.eventName || r.notes || 'Lembur',
                    qty: String(r.overtimeHours),
                    unit: 'jm',
                    rate: fmt(r.overtimeAmount / r.overtimeHours),
                    amount: fmt(r.overtimeAmount),
                });
            }
        }

        // --- Adjustment: bonus/tunjangan → pendapatan tambahan; kasbon → Pinjaman/Kasbon; potongan → Tabungan. ---
        let posSum = 0, advanceSum = 0, deductionSum = 0;
        for (const a of adjustments) {
            const amt = parseFloat(a.amount.toString());
            if (a.type === 'BONUS' || a.type === 'ALLOWANCE') {
                posSum += amt;
                lemburRows.push({
                    date: shortDate(a.effectiveDate),
                    desc: a.notes || ADJ_TYPE_LABEL[a.type],
                    qty: '', unit: '', rate: '',
                    amount: fmt(amt),
                });
            } else if (a.type === 'ADVANCE') {
                advanceSum += amt;
            } else if (a.type === 'DEDUCTION') {
                deductionSum += amt;
            }
        }

        const gross = approvedTotal + posSum;                       // Pendapatan Kotor
        const net = gross - advanceSum - deductionSum;              // Pendapatan Bersih (= approvedTotal + netAdjustment)

        const ctx = {
            company: {
                name: settings?.storeName ?? 'Pospro Event',
            },
            payDate: ddmmyyyyLocal(new Date()),
            slipNo: '',
            worker: {
                name: worker.name,
            },
            harianRows,
            lemburRows,
            fillerRows: [0, 0],
            grossFmt: fmt(gross),
            advanceFmt: advanceSum > 0 ? fmt(advanceSum) : '',
            deductionFmt: deductionSum > 0 ? fmt(deductionSum) : '',
            netFmt: fmt(net),
            // Saldo tabungan & sisa kasbon = saldo berjalan; sistem belum melacaknya → dikosongkan.
            savingsBalanceFmt: '',
            loanBalanceFmt: '',
            pendingNote: pendingCount > 0 ? `Catatan: ada ${pendingCount} absensi PENDING (belum di-approve) — belum termasuk dalam perhitungan slip ini.` : null,
            approver: {
                name: approver?.name ?? approver?.email ?? '',
                roleLabel: approver?.role?.name ?? 'Admin',
            },
        };

        const template = this.loadTemplate();
        const html = template(ctx);

        return this.htmlToPdf(html);
    }

    /**
     * Laporan pengeluaran gaji untuk OWNER — rekap semua pekerja di periode [from, to].
     * Hanya pekerja dengan aktivitas (gaji approved / adjustment / pending) yang ditampilkan.
     */
    async renderOwnerReportPdf(from: string, to: string, label?: string, approverId?: number): Promise<Buffer> {
        const [data, settings, approver] = await Promise.all([
            this.summary.periodExpenseSummary(from, to),
            this.prisma.storeSettings.findFirst(),
            approverId ? this.prisma.user.findUnique({ where: { id: approverId }, select: { name: true, email: true, role: { select: { name: true } } } }) : Promise.resolve(null),
        ]);

        const active = data.rows.filter(
            (r) => r.approvedTotal !== 0 || r.adjustments.net !== 0 || r.pendingCount > 0 || r.fullDays > 0 || r.halfDays > 0,
        );

        let sumAllowance = 0, sumDeduction = 0, totalPending = 0;
        const rows = active.map((r, i) => {
            const allowance = r.adjustments.bonus + r.adjustments.allowance;
            const deduction = r.adjustments.deduction + r.adjustments.advance;
            sumAllowance += allowance;
            sumDeduction += deduction;
            totalPending += r.pendingCount;
            return {
                no: i + 1,
                name: r.name,
                position: r.position ?? '',
                hadir: r.fullDays,
                half: r.halfDays,
                overtimeHours: r.overtimeHours,
                approvedFmt: fmt(r.approvedTotal),
                allowanceFmt: fmt(allowance),
                deductionFmt: fmt(deduction),
                hasDeduction: deduction > 0,
                grandTotalFmt: fmt(r.grandTotal),
            };
        });

        const periodLabel = label || `${data.periodStart} sd ${data.periodEnd}`;
        const ctx = {
            company: {
                name: settings?.storeName ?? 'Pospro Event',
                address: settings?.storeAddress ?? '',
            },
            generatedAt: new Date().toLocaleString('id-ID'),
            periodLabel,
            rows,
            totals: {
                workerCount: rows.length,
                approvedFmt: fmt(data.grandApproved),
                allowanceFmt: fmt(sumAllowance),
                deductionFmt: fmt(sumDeduction),
                grandFinalFmt: fmt(data.grandFinal),
            },
            pendingNote: totalPending > 0
                ? `Ada ${totalPending} absensi PENDING yang belum di-approve — belum termasuk di total. Approve dulu di /payroll agar masuk perhitungan.`
                : null,
            approver: {
                name: approver?.name ?? approver?.email ?? '_______________________',
                role: approver?.role?.name ?? 'Admin / HR',
            },
        };

        const template = this.loadOwnerTemplate();
        return this.htmlToPdf(template(ctx));
    }
}
