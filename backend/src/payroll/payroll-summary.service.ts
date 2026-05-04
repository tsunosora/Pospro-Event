import { Injectable } from '@nestjs/common';
import { AttendanceStatus, AttendanceApprovalStatus, PayrollAdjustmentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Sign aturan untuk adjustment: BONUS/ALLOWANCE positif, DEDUCTION/ADVANCE negatif. */
function adjustmentSign(type: PayrollAdjustmentType): 1 | -1 {
    return type === 'DEDUCTION' || type === 'ADVANCE' ? -1 : 1;
}

/**
 * Resolve daily + overtime rate untuk 1 row attendance, dengan PRIORITAS:
 *   1. Event PIC override      — kalau workerId === event.picWorkerId & Event punya PIC rate
 *   2. Event member override   — kalau Attendance.eventId di-set & Event punya dailyWageRate
 *   3. WageRate matrix         — kalau cityKey + divisionKey match WageRate aktif
 *   4. Worker default          — Worker.dailyWageRate (fallback paling akhir)
 * Return juga `source` (untuk display di UI / audit).
 */
function resolveRates(
    att: { workerId: number; eventId: number | null; cityKey: string | null; divisionKey: string | null },
    worker: { dailyWageRate: any; overtimeRatePerHour: any },
    event: { dailyWageRate: any; overtimeRatePerHour: any; dailyWageRatePic: any; overtimeRatePerHourPic: any; picWorkerId: number | null } | null,
    rateMatrixMap: Map<string, { dailyWageRate: any; overtimeRatePerHour: any }>,
): { dailyRate: number; overtimeRate: number; source: 'event-pic' | 'event' | 'matrix' | 'worker' | 'none' } {
    // 1. Event PIC override (worker = PIC of event, dan event ada PIC rate)
    if (att.eventId && event && event.picWorkerId === att.workerId && event.dailyWageRatePic != null) {
        return {
            dailyRate: parseFloat(event.dailyWageRatePic.toString()),
            overtimeRate: event.overtimeRatePerHourPic != null ? parseFloat(event.overtimeRatePerHourPic.toString()) : 0,
            source: 'event-pic',
        };
    }
    // 2. Event member override
    if (att.eventId && event && event.dailyWageRate != null) {
        return {
            dailyRate: parseFloat(event.dailyWageRate.toString()),
            overtimeRate: event.overtimeRatePerHour != null ? parseFloat(event.overtimeRatePerHour.toString()) : 0,
            source: 'event',
        };
    }
    // 3. WageRate matrix
    if (att.cityKey && att.divisionKey) {
        const key = `${att.cityKey.toLowerCase()}|${att.divisionKey.toLowerCase()}`;
        const r = rateMatrixMap.get(key);
        if (r) {
            return {
                dailyRate: parseFloat(r.dailyWageRate.toString()),
                overtimeRate: parseFloat(r.overtimeRatePerHour.toString()),
                source: 'matrix',
            };
        }
    }
    // 4. Worker default
    if (worker.dailyWageRate != null) {
        return {
            dailyRate: parseFloat(worker.dailyWageRate.toString()),
            overtimeRate: worker.overtimeRatePerHour != null ? parseFloat(worker.overtimeRatePerHour.toString()) : 0,
            source: 'worker',
        };
    }
    return { dailyRate: 0, overtimeRate: 0, source: 'none' };
}

/** Hitung gaji untuk 1 row attendance pakai rates yang sudah ke-resolve. */
function calcRowWage(status: AttendanceStatus, overtimeHours: number, dailyRate: number, overtimeRate: number) {
    let base = 0;
    if (status === 'FULL_DAY') base = dailyRate;
    else if (status === 'HALF_DAY') base = dailyRate * 0.5;
    const overtime = overtimeHours * overtimeRate;
    return { base, overtime, total: base + overtime };
}

@Injectable()
export class PayrollSummaryService {
    constructor(private prisma: PrismaService) { }

    private parseDate(input: string): Date {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
        if (!m) throw new Error(`Format tanggal invalid: ${input}`);
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
    }

    /**
     * Pre-load semua data referensi yang dibutuhkan untuk wage resolution dalam 1 batch:
     *  - WageRate matrix (semua active) → Map by "city|division"
     *  - Event yang ke-refer di attendance → Map by id
     */
    private async loadResolvers(eventIds: number[]) {
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
            const key = `${r.city.toLowerCase()}|${r.division.toLowerCase()}`;
            rateMatrixMap.set(key, { dailyWageRate: r.dailyWageRate, overtimeRatePerHour: r.overtimeRatePerHour });
        }
        const eventMap = new Map<number, { dailyWageRate: any; overtimeRatePerHour: any; dailyWageRatePic: any; overtimeRatePerHourPic: any; picWorkerId: number | null }>();
        for (const e of events) eventMap.set(e.id, {
            dailyWageRate: e.dailyWageRate, overtimeRatePerHour: e.overtimeRatePerHour,
            dailyWageRatePic: e.dailyWageRatePic, overtimeRatePerHourPic: e.overtimeRatePerHourPic,
            picWorkerId: e.picWorkerId,
        });
        return { rateMatrixMap, eventMap };
    }

    async weeklySummary(weekStart: string) {
        const start = this.parseDate(weekStart);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);

        const [workers, attendances, adjustments] = await Promise.all([
            this.prisma.worker.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
                select: {
                    id: true, name: true, position: true,
                    dailyWageRate: true, overtimeRatePerHour: true,
                },
            }),
            this.prisma.attendance.findMany({
                where: { attendanceDate: { gte: start, lte: end } },
                select: {
                    id: true, workerId: true, attendanceDate: true, status: true, overtimeHours: true,
                    eventId: true, cityKey: true, divisionKey: true, approvalStatus: true,
                },
            }),
            this.prisma.payrollAdjustment.findMany({
                where: { effectiveDate: { gte: start, lte: end } },
                select: { workerId: true, type: true, amount: true },
            }),
        ]);

        // Aggregate adjustments per worker
        const adjByWorker = new Map<number, { bonus: number; allowance: number; deduction: number; advance: number; net: number }>();
        for (const a of adjustments) {
            const amt = parseFloat(a.amount.toString());
            const cur = adjByWorker.get(a.workerId) ?? { bonus: 0, allowance: 0, deduction: 0, advance: 0, net: 0 };
            if (a.type === 'BONUS') cur.bonus += amt;
            else if (a.type === 'ALLOWANCE') cur.allowance += amt;
            else if (a.type === 'DEDUCTION') cur.deduction += amt;
            else if (a.type === 'ADVANCE') cur.advance += amt;
            cur.net += amt * adjustmentSign(a.type);
            adjByWorker.set(a.workerId, cur);
        }

        const eventIds = Array.from(new Set(attendances.map(a => a.eventId).filter((x): x is number => x != null)));
        const { rateMatrixMap, eventMap } = await this.loadResolvers(eventIds);

        const byWorker = new Map<number, Map<string, typeof attendances[number]>>();
        for (const a of attendances) {
            const key = a.attendanceDate.toISOString().slice(0, 10);
            if (!byWorker.has(a.workerId)) byWorker.set(a.workerId, new Map());
            byWorker.get(a.workerId)!.set(key, a);
        }

        const days: string[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            days.push(d.toISOString().slice(0, 10));
        }

        const rows = workers.map((w) => {
            const wMap = byWorker.get(w.id) ?? new Map();
            const cells = days.map((dateKey) => {
                const att = wMap.get(dateKey);
                if (!att) return {
                    id: null as number | null, date: dateKey, status: null as AttendanceStatus | null,
                    overtimeHours: 0, total: 0, source: null as string | null,
                    cityKey: null, divisionKey: null, eventId: null,
                    approvalStatus: null as AttendanceApprovalStatus | null,
                };
                const ev = att.eventId ? eventMap.get(att.eventId) ?? null : null;
                const { dailyRate, overtimeRate, source } = resolveRates(
                    { workerId: w.id, eventId: att.eventId, cityKey: att.cityKey, divisionKey: att.divisionKey },
                    { dailyWageRate: w.dailyWageRate, overtimeRatePerHour: w.overtimeRatePerHour },
                    ev,
                    rateMatrixMap,
                );
                const overtimeHours = parseFloat(att.overtimeHours.toString()) || 0;
                const { total } = calcRowWage(att.status, overtimeHours, dailyRate, overtimeRate);
                return {
                    id: att.id, date: dateKey, status: att.status, overtimeHours, total, source,
                    cityKey: att.cityKey, divisionKey: att.divisionKey, eventId: att.eventId,
                    approvalStatus: att.approvalStatus,
                };
            });
            const wageFromAttendance = cells.reduce((s, c) => s + c.total, 0);
            // Hanya hitung gaji dari APPROVED untuk "approvedWage" (final payout)
            const approvedWage = cells.filter(c => c.approvalStatus === 'APPROVED').reduce((s, c) => s + c.total, 0);
            const adj = adjByWorker.get(w.id) ?? { bonus: 0, allowance: 0, deduction: 0, advance: 0, net: 0 };
            return {
                workerId: w.id, name: w.name, position: w.position,
                dailyWageRate: w.dailyWageRate ? parseFloat(w.dailyWageRate.toString()) : 0,
                overtimeRatePerHour: w.overtimeRatePerHour ? parseFloat(w.overtimeRatePerHour.toString()) : 0,
                hasPayroll: w.dailyWageRate != null,
                cells,
                totalWage: wageFromAttendance,           // total dari attendance (semua status)
                approvedWage,                             // hanya APPROVED
                adjustments: adj,                         // breakdown bonus/tunjangan/potongan/kasbon
                grandTotal: approvedWage + adj.net,       // final cair = approved attendance + net adjustment
            };
        });

        const grandTotal = rows.reduce((s, r) => s + r.totalWage, 0);
        const grandApproved = rows.reduce((s, r) => s + r.approvedWage, 0);
        const grandAdjustment = rows.reduce((s, r) => s + r.adjustments.net, 0);
        const grandFinal = rows.reduce((s, r) => s + r.grandTotal, 0);
        const pendingCount = rows.reduce((s, r) => s + r.cells.filter(c => c.approvalStatus === 'PENDING').length, 0);
        return {
            weekStart: days[0], weekEnd: days[6], days, rows,
            grandTotal, grandApproved, grandAdjustment, grandFinal, pendingCount,
        };
    }

    async monthlySummary(year: number, month: number) {
        const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
        const end = new Date(year, month, 0, 23, 59, 59, 999);

        const [workers, attendances, adjustments] = await Promise.all([
            this.prisma.worker.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
                select: {
                    id: true, name: true, position: true,
                    dailyWageRate: true, overtimeRatePerHour: true,
                },
            }),
            this.prisma.attendance.findMany({
                where: { attendanceDate: { gte: start, lte: end } },
                select: {
                    workerId: true, status: true, overtimeHours: true,
                    eventId: true, cityKey: true, divisionKey: true, approvalStatus: true,
                },
            }),
            this.prisma.payrollAdjustment.findMany({
                where: { effectiveDate: { gte: start, lte: end } },
                select: { workerId: true, type: true, amount: true },
            }),
        ]);

        const adjByWorker = new Map<number, { bonus: number; allowance: number; deduction: number; advance: number; net: number }>();
        for (const a of adjustments) {
            const amt = parseFloat(a.amount.toString());
            const cur = adjByWorker.get(a.workerId) ?? { bonus: 0, allowance: 0, deduction: 0, advance: 0, net: 0 };
            if (a.type === 'BONUS') cur.bonus += amt;
            else if (a.type === 'ALLOWANCE') cur.allowance += amt;
            else if (a.type === 'DEDUCTION') cur.deduction += amt;
            else if (a.type === 'ADVANCE') cur.advance += amt;
            cur.net += amt * adjustmentSign(a.type);
            adjByWorker.set(a.workerId, cur);
        }

        const eventIds = Array.from(new Set(attendances.map(a => a.eventId).filter((x): x is number => x != null)));
        const { rateMatrixMap, eventMap } = await this.loadResolvers(eventIds);

        const byWorker = new Map<number, typeof attendances>();
        for (const a of attendances) {
            if (!byWorker.has(a.workerId)) byWorker.set(a.workerId, []);
            byWorker.get(a.workerId)!.push(a);
        }

        const rows = workers.map((w) => {
            const list = byWorker.get(w.id) ?? [];
            let fullDays = 0, halfDays = 0, absentDays = 0, overtimeHours = 0;
            let baseTotal = 0, overtimeTotal = 0;
            let approvedBase = 0, approvedOvertime = 0;
            let pendingCount = 0, rejectedCount = 0;
            for (const a of list) {
                const oh = parseFloat(a.overtimeHours.toString()) || 0;
                overtimeHours += oh;
                const ev = a.eventId ? eventMap.get(a.eventId) ?? null : null;
                const { dailyRate, overtimeRate } = resolveRates(
                    { workerId: w.id, eventId: a.eventId, cityKey: a.cityKey, divisionKey: a.divisionKey },
                    { dailyWageRate: w.dailyWageRate, overtimeRatePerHour: w.overtimeRatePerHour },
                    ev,
                    rateMatrixMap,
                );
                let rowBase = 0;
                if (a.status === 'FULL_DAY') { fullDays++; rowBase = dailyRate; }
                else if (a.status === 'HALF_DAY') { halfDays++; rowBase = dailyRate * 0.5; }
                else absentDays++;
                const rowOvertime = oh * overtimeRate;
                baseTotal += rowBase;
                overtimeTotal += rowOvertime;
                if (a.approvalStatus === 'APPROVED') {
                    approvedBase += rowBase;
                    approvedOvertime += rowOvertime;
                } else if (a.approvalStatus === 'PENDING') pendingCount++;
                else if (a.approvalStatus === 'REJECTED') rejectedCount++;
            }
            const adj = adjByWorker.get(w.id) ?? { bonus: 0, allowance: 0, deduction: 0, advance: 0, net: 0 };
            const approvedTotal = approvedBase + approvedOvertime;
            return {
                workerId: w.id, name: w.name, position: w.position,
                dailyWageRate: w.dailyWageRate ? parseFloat(w.dailyWageRate.toString()) : 0,
                overtimeRatePerHour: w.overtimeRatePerHour ? parseFloat(w.overtimeRatePerHour.toString()) : 0,
                hasPayroll: w.dailyWageRate != null,
                fullDays, halfDays, absentDays, overtimeHours,
                baseTotal, overtimeTotal, totalWage: baseTotal + overtimeTotal,
                pendingCount, rejectedCount,
                approvedBase, approvedOvertime, approvedTotal,
                adjustments: adj,
                grandTotal: approvedTotal + adj.net,
            };
        });

        const grandTotal = rows.reduce((s, r) => s + r.totalWage, 0);
        const grandApproved = rows.reduce((s, r) => s + r.approvedTotal, 0);
        const grandAdjustment = rows.reduce((s, r) => s + r.adjustments.net, 0);
        const grandFinal = rows.reduce((s, r) => s + r.grandTotal, 0);
        return {
            year, month,
            periodStart: start.toISOString().slice(0, 10),
            periodEnd: end.toISOString().slice(0, 10),
            rows, grandTotal, grandApproved, grandAdjustment, grandFinal,
        };
    }
}
