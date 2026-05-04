import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import type { Browser } from 'puppeteer';
import { AttendanceStatus, PayrollAdjustmentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
    private browser: Browser | null = null;

    constructor(private prisma: PrismaService) { }

    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    private getTemplatePath(): string {
        const candidates = [
            path.resolve(__dirname, '..', '..', 'templates', 'payroll', 'payslip.hbs'),
            path.resolve(__dirname, '..', '..', '..', 'templates', 'payroll', 'payslip.hbs'),
            path.resolve(process.cwd(), 'templates', 'payroll', 'payslip.hbs'),
        ];
        for (const c of candidates) if (fs.existsSync(c)) return c;
        throw new Error(`Template payslip.hbs tidak ditemukan. Sudah coba: ${candidates.join(', ')}`);
    }

    private loadTemplate(): Handlebars.TemplateDelegate {
        if (this.template) return this.template;
        const file = this.getTemplatePath();
        const source = fs.readFileSync(file, 'utf-8');
        this.template = Handlebars.compile(source);
        return this.template;
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

    private parseDate(input: string): Date {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
        if (!m) throw new BadRequestException(`Format tanggal invalid: ${input}`);
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
    }

    /** Resolve daily + overtime rate untuk 1 attendance row.
     *  Priority: Event-PIC (if worker = picWorkerId) > Event-member > Matrix > Worker default.
     */
    private resolveRates(
        workerId: number,
        att: { eventId: number | null; cityKey: string | null; divisionKey: string | null },
        worker: { dailyWageRate: any; overtimeRatePerHour: any },
        eventMap: Map<number, { dailyWageRate: any; overtimeRatePerHour: any; dailyWageRatePic: any; overtimeRatePerHourPic: any; picWorkerId: number | null }>,
        rateMatrixMap: Map<string, { dailyWageRate: any; overtimeRatePerHour: any }>,
    ): { daily: number; overtime: number } {
        if (att.eventId) {
            const ev = eventMap.get(att.eventId);
            if (ev) {
                // PIC override
                if (ev.picWorkerId === workerId && ev.dailyWageRatePic != null) {
                    return {
                        daily: parseFloat(ev.dailyWageRatePic.toString()),
                        overtime: ev.overtimeRatePerHourPic != null ? parseFloat(ev.overtimeRatePerHourPic.toString()) : 0,
                    };
                }
                // Member rate
                if (ev.dailyWageRate != null) {
                    return {
                        daily: parseFloat(ev.dailyWageRate.toString()),
                        overtime: ev.overtimeRatePerHour != null ? parseFloat(ev.overtimeRatePerHour.toString()) : 0,
                    };
                }
            }
        }
        if (att.cityKey && att.divisionKey) {
            const key = `${att.cityKey.toLowerCase()}|${att.divisionKey.toLowerCase()}`;
            const r = rateMatrixMap.get(key);
            if (r) {
                return {
                    daily: parseFloat(r.dailyWageRate.toString()),
                    overtime: parseFloat(r.overtimeRatePerHour.toString()),
                };
            }
        }
        return {
            daily: worker.dailyWageRate ? parseFloat(worker.dailyWageRate.toString()) : 0,
            overtime: worker.overtimeRatePerHour ? parseFloat(worker.overtimeRatePerHour.toString()) : 0,
        };
    }

    /**
     * Generate payslip PDF untuk 1 worker di periode (from-to inclusive).
     * Hanya APPROVED attendance yang masuk perhitungan; PENDING/REJECTED tampil dengan badge tapi gak hitung total.
     */
    async renderPayslipPdf(workerId: number, from: string, to: string, approverId?: number): Promise<Buffer> {
        const start = this.parseDate(from);
        const end = this.parseDate(to);
        end.setHours(23, 59, 59, 999);

        const [worker, attendances, adjustments, settings, approver] = await Promise.all([
            this.prisma.worker.findUnique({
                where: { id: workerId },
                select: {
                    id: true, name: true, position: true, phone: true,
                    dailyWageRate: true, overtimeRatePerHour: true,
                },
            }),
            this.prisma.attendance.findMany({
                where: { workerId, attendanceDate: { gte: start, lte: end } },
                orderBy: { attendanceDate: 'asc' },
            }),
            this.prisma.payrollAdjustment.findMany({
                where: { workerId, effectiveDate: { gte: start, lte: end } },
                orderBy: { effectiveDate: 'asc' },
            }),
            this.prisma.storeSettings.findFirst(),
            approverId ? this.prisma.user.findUnique({ where: { id: approverId }, select: { name: true, email: true, role: { select: { name: true } } } }) : Promise.resolve(null),
        ]);

        if (!worker) throw new NotFoundException(`Worker id=${workerId} tidak ditemukan`);

        // Pre-load WageRate matrix + events (untuk resolution per row)
        const eventIds = Array.from(new Set(attendances.map(a => a.eventId).filter((x): x is number => x != null)));
        const [wageRates, events] = await Promise.all([
            this.prisma.wageRate.findMany({
                where: { isActive: true },
                select: { city: true, division: true, dailyWageRate: true, overtimeRatePerHour: true },
            }),
            eventIds.length > 0
                ? this.prisma.event.findMany({
                    where: { id: { in: eventIds } },
                    select: {
                        id: true, picWorkerId: true,
                        dailyWageRate: true, overtimeRatePerHour: true,
                        dailyWageRatePic: true, overtimeRatePerHourPic: true,
                    },
                })
                : Promise.resolve([]),
        ]);
        const rateMatrixMap = new Map<string, { dailyWageRate: any; overtimeRatePerHour: any }>();
        for (const r of wageRates) {
            rateMatrixMap.set(`${r.city.toLowerCase()}|${r.division.toLowerCase()}`,
                { dailyWageRate: r.dailyWageRate, overtimeRatePerHour: r.overtimeRatePerHour });
        }
        const eventMap = new Map<number, { dailyWageRate: any; overtimeRatePerHour: any; dailyWageRatePic: any; overtimeRatePerHourPic: any; picWorkerId: number | null }>();
        for (const e of events) eventMap.set(e.id, {
            dailyWageRate: e.dailyWageRate, overtimeRatePerHour: e.overtimeRatePerHour,
            dailyWageRatePic: e.dailyWageRatePic, overtimeRatePerHourPic: e.overtimeRatePerHourPic,
            picWorkerId: e.picWorkerId,
        });

        // Build attendance rows
        let fullDays = 0, halfDays = 0;
        let fullBaseSum = 0, halfBaseSum = 0, overtimeSum = 0, approvedTotal = 0;
        let totalOvertimeHours = 0;
        let pendingCount = 0;
        const attRows = attendances.map((a) => {
            const { daily, overtime } = this.resolveRates(
                workerId,
                { eventId: a.eventId, cityKey: a.cityKey, divisionKey: a.divisionKey },
                { dailyWageRate: worker.dailyWageRate, overtimeRatePerHour: worker.overtimeRatePerHour },
                eventMap, rateMatrixMap,
            );
            const oh = parseFloat(a.overtimeHours.toString()) || 0;
            totalOvertimeHours += oh;
            const isApproved = a.approvalStatus === 'APPROVED';
            const isPending = a.approvalStatus === 'PENDING';
            const isRejected = a.approvalStatus === 'REJECTED';
            if (isPending) pendingCount += 1;

            let base = 0;
            if (a.status === 'FULL_DAY') {
                base = daily; if (isApproved) { fullDays += 1; fullBaseSum += base; }
            } else if (a.status === 'HALF_DAY') {
                base = daily * 0.5; if (isApproved) { halfDays += 1; halfBaseSum += base; }
            }
            const overtimeAmount = oh * overtime;
            const subtotal = base + overtimeAmount;
            if (isApproved) {
                overtimeSum += overtimeAmount;
                approvedTotal += subtotal;
            }
            const dateFmt = a.attendanceDate.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
            return {
                dateFmt,
                statusLabel: STATUS_LABEL[a.status],
                overtimeHours: oh,
                dailyRateFmt: fmt(daily),
                subtotalFmt: fmt(subtotal),
                isPending, isRejected,
            };
        });

        // Build adjustments
        let posSum = 0, negSum = 0;
        const adjList = adjustments.map((a) => {
            const amt = parseFloat(a.amount.toString());
            const sign = adjSign(a.type);
            if (sign > 0) posSum += amt; else negSum += amt;
            return {
                dateFmt: a.effectiveDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
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

        // Period label
        const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
        const periodLabel = sameMonth
            ? `${start.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`
                + ` — ${end.toLocaleDateString('id-ID', { day: 'numeric' })}`
            : `${start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
                + ` sd ${end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;

        const dailyDisplay = worker.dailyWageRate ? fmt(parseFloat(worker.dailyWageRate.toString())) : '—';
        const overtimeDisplay = worker.overtimeRatePerHour ? fmt(parseFloat(worker.overtimeRatePerHour.toString())) : '';

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
                phone: worker.phone ?? '',
            },
            rates: { dailyFmt: dailyDisplay, overtimeFmt: overtimeDisplay },
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
}
