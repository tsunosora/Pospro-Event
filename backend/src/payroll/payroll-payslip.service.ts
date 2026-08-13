import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import type { Browser } from 'puppeteer';
import { AttendanceStatus, PayrollAdjustmentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PayrollSummaryService } from './payroll-summary.service';

const STATUS_LABEL: Record<AttendanceStatus, string> = {
    FULL_DAY: '✓ Hadir Penuh',
    HALF_DAY: '½ Hadir',
    ABSENT: '✗ Tidak Hadir',
};

const ADJ_TYPE_LABEL: Record<PayrollAdjustmentType, string> = {
    BONUS: 'Bonus',
    ALLOWANCE: 'Tunjangan',
    DEDUCTION: 'Potongan',
    ADVANCE: 'Kasbon',
};

function fmt(n: number): string {
    return Math.round(n).toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

function adjSign(t: PayrollAdjustmentType): 1 | -1 {
    return t === 'DEDUCTION' || t === 'ADVANCE' ? -1 : 1;
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

        const attRows = detail.rows.map((r) => ({
            dateFmt: r.attendanceDate.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }),
            statusLabel: STATUS_LABEL[r.status],
            eventName: r.eventName || '',
            autoLinked: r.autoLinked,
            notes: r.notes || '',
            overtimeHours: r.overtimeHours,
            subtotalFmt: fmt(r.subtotal),
            isPending: r.approvalStatus === 'PENDING',
            isRejected: r.approvalStatus === 'REJECTED',
        }));
        const { fullDays, halfDays, totalOvertimeHours, fullBaseSum, halfBaseSum, overtimeSum, approvedTotal, pendingCount } = detail;

        // Build adjustments
        let posSum = 0, negSum = 0;
        const adjList = adjustments.map((a) => {
            const amt = parseFloat(a.amount.toString());
            const sign = adjSign(a.type);
            if (sign > 0) posSum += amt; else negSum += amt;
            return {
                dateFmt: a.effectiveDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
                typeLabel: ADJ_TYPE_LABEL[a.type],
                typeLower: a.type.toLowerCase(),
                notes: a.notes ?? '',
                amountFmt: fmt(amt),
                isNegative: sign < 0,
                signLabel: sign > 0 ? '+' : '−',
            };
        });
        const netAdj = posSum - negSum;
        const grandTotal = approvedTotal + netAdj;

        // Period label (semua format pakai timeZone UTC agar selaras dengan @db.Date)
        const sameMonth = start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
        const periodLabel = sameMonth
            ? `${start.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}`
                + ` — ${end.toLocaleDateString('id-ID', { day: 'numeric', timeZone: 'UTC' })}`
            : `${start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`
                + ` sd ${end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`;

        const ctx = {
            company: {
                name: settings?.storeName ?? 'Pospro Event',
                address: settings?.storeAddress ?? '',
            },
            generatedAt: new Date().toLocaleString('id-ID'),
            periodLabel,
            worker: {
                name: worker.name,
                position: worker.position ?? '',
            },
            attendance: {
                rows: attRows,
                fullDays, halfDays, totalOvertimeHours,
                fullBaseFmt: fmt(fullBaseSum),
                halfBaseFmt: fmt(halfBaseSum),
                overtimeFmt: fmt(overtimeSum),
                approvedTotalFmt: fmt(approvedTotal),
            },
            adjustments: {
                list: adjList,
                positiveFmt: fmt(posSum),
                negativeFmt: fmt(negSum),
                netFmt: fmt(Math.abs(netAdj)),
                netNegative: netAdj < 0,
            },
            grandTotalFmt: fmt(grandTotal),
            pendingNote: pendingCount > 0 ? `Ada ${pendingCount} attendance PENDING — belum dihitung di total. Approve dulu di /payroll untuk dimasukkan.` : null,
            approver: {
                name: approver?.name ?? approver?.email ?? '_______________________',
                role: approver?.role?.name ?? 'Admin / HR',
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
