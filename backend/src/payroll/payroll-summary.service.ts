import { Injectable } from '@nestjs/common';
import { AttendanceStatus, AttendanceApprovalStatus, PayrollAdjustmentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Sign aturan untuk adjustment: BONUS/ALLOWANCE positif, DEDUCTION/ADVANCE negatif. */
function adjustmentSign(type: PayrollAdjustmentType): 1 | -1 {
    return type === 'DEDUCTION' || type === 'ADVANCE' ? -1 : 1;
}

/**
 * Resolve daily + overtime rate untuk 1 row attendance, dengan PRIORITAS:
 *   1. Crew assignment override — gaji per member di event ini (paling spesifik)
 *   2. Event PIC override      — kalau workerId === event.picWorkerId & Event punya PIC rate
 *   3. Event member override   — kalau Attendance.eventId di-set & Event punya dailyWageRate
 *   4. WageRate matrix         — kalau cityKey + divisionKey match WageRate aktif
 *   5. Worker default          — Worker.dailyWageRate (fallback paling akhir)
 * Return juga `source` (untuk display di UI / audit).
 */
function resolveRates(
    att: { workerId: number; eventId: number | null; cityKey: string | null; divisionKey: string | null },
    worker: { dailyWageRate: any; overtimeRatePerHour: any },
    event: { dailyWageRate: any; overtimeRatePerHour: any; dailyWageRatePic: any; overtimeRatePerHourPic: any; picWorkerId: number | null } | null,
    rateMatrixMap: Map<string, { dailyWageRate: any; overtimeRatePerHour: any }>,
    assignmentOverride?: { dailyWageRate: any; overtimeRatePerHour: any } | null,
    tierRate?: { dailyWageRate: any; overtimeRatePerHour: any } | null,
): { dailyRate: number; overtimeRate: number; source: 'tier' | 'assignment' | 'event-pic' | 'event' | 'matrix' | 'worker' | 'none' } {
    // Fallback tarif lembur: kalau sumber gaji (tier/event/override) tak menetapkan tarif lembur
    // sendiri, pakai tarif lembur default worker — supaya lembur tetap dihitung, bukan 0.
    const otFallback = worker.overtimeRatePerHour != null ? parseFloat(worker.overtimeRatePerHour.toString()) : 0;
    // 0. Tier "Gaji A/B/C" yang dipilih di payroll (paling eksplisit, menang di atas semua)
    if (tierRate && tierRate.dailyWageRate != null) {
        return {
            dailyRate: parseFloat(tierRate.dailyWageRate.toString()),
            overtimeRate: tierRate.overtimeRatePerHour != null ? parseFloat(tierRate.overtimeRatePerHour.toString()) : otFallback,
            source: 'tier',
        };
    }
    // 1. Crew assignment override (gaji per member di event ini — paling spesifik, menang di atas semua)
    if (assignmentOverride && assignmentOverride.dailyWageRate != null) {
        return {
            dailyRate: parseFloat(assignmentOverride.dailyWageRate.toString()),
            overtimeRate: assignmentOverride.overtimeRatePerHour != null ? parseFloat(assignmentOverride.overtimeRatePerHour.toString()) : otFallback,
            source: 'assignment',
        };
    }
    // 2. Event PIC override (worker = PIC of event, dan event ada PIC rate)
    if (att.eventId && event && event.picWorkerId === att.workerId && event.dailyWageRatePic != null) {
        return {
            dailyRate: parseFloat(event.dailyWageRatePic.toString()),
            overtimeRate: event.overtimeRatePerHourPic != null ? parseFloat(event.overtimeRatePerHourPic.toString()) : otFallback,
            source: 'event-pic',
        };
    }
    // 2. Event member override
    if (att.eventId && event && event.dailyWageRate != null) {
        return {
            dailyRate: parseFloat(event.dailyWageRate.toString()),
            overtimeRate: event.overtimeRatePerHour != null ? parseFloat(event.overtimeRatePerHour.toString()) : otFallback,
            source: 'event',
        };
    }
    // 3. WageRate matrix — hanya untuk hari non-event (utk event, divisionKey dipakai sbg id tier)
    if (!att.eventId && att.cityKey && att.divisionKey) {
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

/**
 * Rentang tanggal (YYYY-MM-DD, UTC) yang "ditutupi" sebuah event — dari tanggal paling awal
 * (berangkat/setup/loading/eventStart) sampai paling akhir. Dipakai auto-match absensi → event.
 */
function eventCoverRange(ev: {
    departureStart: Date | null; setupStart: Date | null; loadingStart: Date | null;
    eventStart: Date | null; eventEnd: Date | null; loadingEnd: Date | null;
}): { startDate: string; endDate: string } | null {
    const times = [ev.departureStart, ev.setupStart, ev.loadingStart, ev.eventStart, ev.eventEnd, ev.loadingEnd]
        .filter((d): d is Date => d != null)
        .map((d) => d.getTime());
    if (!times.length) return null;
    const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    return { startDate: toDay(Math.min(...times)), endDate: toDay(Math.max(...times)) };
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

    /** Parse "YYYY-MM-DD" ke UTC midnight (kolom @db.Date — hindari geser hari di TZ non-UTC). */
    private parseDate(input: string): Date {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
        if (!m) throw new Error(`Format tanggal invalid: ${input}`);
        return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    }

    /** Jumlah hari [start..weekEnd] inclusive. Default 7 (kalau weekEnd kosong), cap 1..31. */
    private rangeDayCount(start: Date, weekEnd?: string): number {
        if (!weekEnd) return 7;
        const end = this.parseDate(weekEnd);
        const n = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
        return Math.min(31, Math.max(1, n));
    }

    /**
     * Pre-load semua data referensi yang dibutuhkan untuk wage resolution dalam 1 batch:
     *  - WageRate matrix (semua active) → Map by "city|division"
     *  - Event yang ke-refer di attendance → Map by id
     */
    private async loadResolvers(eventIds: number[]) {
        const [wageRates, events, assignments, tiers] = await Promise.all([
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
            // Gaji per member per event: override manual ATAU tier yang dipilih.
            eventIds.length > 0
                ? this.prisma.eventCrewAssignment.findMany({
                    where: { eventId: { in: eventIds } },
                    select: {
                        eventId: true, workerId: true, dailyWageRate: true, overtimeRatePerHour: true,
                        customWage: true, customWageNote: true,
                        wageTier: { select: { dailyWageRate: true, overtimeRatePerHour: true } },
                    },
                })
                : Promise.resolve([]),
            // Tier "Gaji A/B/C" per event → dipakai saat absensi memilih tier (divisionKey = id tier).
            eventIds.length > 0
                ? this.prisma.eventWageTier.findMany({
                    where: { eventId: { in: eventIds } },
                    select: { id: true, eventId: true, dailyWageRate: true, overtimeRatePerHour: true },
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
        // Key: `${eventId}|${workerId}` → gaji member. Prioritas: override manual > tier.
        const assignmentMap = new Map<string, { dailyWageRate: any; overtimeRatePerHour: any }>();
        for (const a of assignments) {
            let daily: any = null, ot: any = null;
            if (a.dailyWageRate != null) { daily = a.dailyWageRate; ot = a.overtimeRatePerHour; }
            else if (a.wageTier?.dailyWageRate != null) { daily = a.wageTier.dailyWageRate; ot = a.wageTier.overtimeRatePerHour; }
            if (daily != null) assignmentMap.set(`${a.eventId}|${a.workerId}`, { dailyWageRate: daily, overtimeRatePerHour: ot });
        }
        // Map id tier → tarif (+ eventId untuk validasi milik event yg benar).
        const tierMap = new Map<number, { eventId: number; dailyWageRate: any; overtimeRatePerHour: any }>();
        for (const t of tiers) tierMap.set(t.id, { eventId: t.eventId, dailyWageRate: t.dailyWageRate, overtimeRatePerHour: t.overtimeRatePerHour });
        // Key: `${eventId}|${workerId}` → gaji custom (+/−) per member yang otomatis ditambahkan tiap hari.
        const crewCustomMap = new Map<string, { amount: number; note: string | null }>();
        for (const a of assignments) {
            if ((a as any).customWage != null) {
                crewCustomMap.set(`${a.eventId}|${a.workerId}`, {
                    amount: parseFloat((a as any).customWage.toString()),
                    note: (a as any).customWageNote ?? null,
                });
            }
        }
        return { rateMatrixMap, eventMap, assignmentMap, tierMap, crewCustomMap };
    }

    /**
     * Auto-match: absensi yang TIDAK di-tag event tetap dapat tarif event kalau tukangnya
     * punya penugasan crew di sebuah event yang jadwalnya menutupi tanggal absensi.
     * Return Map workerId → daftar penugasan (rentang tanggal + tarif event/tier/override).
     */
    private async loadAutoAssignments(start: Date, end: Date) {
        const pad = 2 * 86_400_000; // toleransi 2 hari (fase berangkat/bongkar)
        const lo = new Date(start.getTime() - pad);
        const hi = new Date(end.getTime() + pad);
        const assignments = await this.prisma.eventCrewAssignment.findMany({
            where: {
                event: {
                    OR: [
                        { departureStart: { gte: lo, lte: hi } },
                        { setupStart: { gte: lo, lte: hi } },
                        { loadingStart: { gte: lo, lte: hi } },
                        { eventStart: { gte: lo, lte: hi } },
                        { eventEnd: { gte: lo, lte: hi } },
                        { loadingEnd: { gte: lo, lte: hi } },
                    ],
                },
            },
            select: {
                workerId: true, dailyWageRate: true, overtimeRatePerHour: true,
                customWage: true, customWageNote: true,
                wageTier: { select: { dailyWageRate: true, overtimeRatePerHour: true } },
                event: {
                    select: {
                        id: true, picWorkerId: true,
                        dailyWageRate: true, overtimeRatePerHour: true,
                        dailyWageRatePic: true, overtimeRatePerHourPic: true,
                        departureStart: true, setupStart: true, loadingStart: true,
                        eventStart: true, eventEnd: true, loadingEnd: true,
                    },
                },
            },
        });

        type AutoEntry = {
            startDate: string; endDate: string; eventId: number;
            event: { picWorkerId: number | null; dailyWageRate: any; overtimeRatePerHour: any; dailyWageRatePic: any; overtimeRatePerHourPic: any };
            override: { dailyWageRate: any; overtimeRatePerHour: any } | null;
            custom: { amount: number; note: string | null } | null;
        };
        const map = new Map<number, AutoEntry[]>();
        for (const a of assignments) {
            const range = eventCoverRange(a.event);
            if (!range) continue;
            // Override gaji per member: manual menang di atas tier (sama seperti assignmentMap).
            let override: { dailyWageRate: any; overtimeRatePerHour: any } | null = null;
            if (a.dailyWageRate != null) override = { dailyWageRate: a.dailyWageRate, overtimeRatePerHour: a.overtimeRatePerHour };
            else if (a.wageTier?.dailyWageRate != null) override = { dailyWageRate: a.wageTier.dailyWageRate, overtimeRatePerHour: a.wageTier.overtimeRatePerHour };
            const custom = (a as any).customWage != null
                ? { amount: parseFloat((a as any).customWage.toString()), note: (a as any).customWageNote ?? null }
                : null;
            const arr = map.get(a.workerId) ?? [];
            arr.push({
                startDate: range.startDate, endDate: range.endDate, eventId: a.event.id,
                event: {
                    picWorkerId: a.event.picWorkerId,
                    dailyWageRate: a.event.dailyWageRate, overtimeRatePerHour: a.event.overtimeRatePerHour,
                    dailyWageRatePic: a.event.dailyWageRatePic, overtimeRatePerHourPic: a.event.overtimeRatePerHourPic,
                },
                override,
                custom,
            });
            map.set(a.workerId, arr);
        }
        return map;
    }

    /**
     * Tentukan event + override efektif untuk 1 baris absensi.
     * - Kalau absensi sudah di-tag event → pakai itu (perilaku lama).
     * - Kalau tidak → coba auto-match ke penugasan crew yang menutupi tanggalnya & punya tarif.
     */
    private effectiveWageInputs(
        att: { workerId: number; eventId: number | null; divisionKey: string | null; attendanceDate: Date },
        eventMap: Map<number, { dailyWageRate: any; overtimeRatePerHour: any; dailyWageRatePic: any; overtimeRatePerHourPic: any; picWorkerId: number | null }>,
        assignmentMap: Map<string, { dailyWageRate: any; overtimeRatePerHour: any }>,
        autoMap: Map<number, Array<{ startDate: string; endDate: string; eventId: number; event: any; override: { dailyWageRate: any; overtimeRatePerHour: any } | null; custom: { amount: number; note: string | null } | null }>>,
        tierMap: Map<number, { eventId: number; dailyWageRate: any; overtimeRatePerHour: any }>,
        crewCustomMap: Map<string, { amount: number; note: string | null }>,
    ): { eventId: number | null; event: any; override: { dailyWageRate: any; overtimeRatePerHour: any } | null; tierRate: { dailyWageRate: any; overtimeRatePerHour: any } | null; auto: boolean; crewCustom: { amount: number; note: string | null } | null } {
        // Tier "Gaji A/B/C" yang dipilih di payroll: divisionKey = id tier valid milik event ini.
        const tierRateFor = (eventId: number | null): { dailyWageRate: any; overtimeRatePerHour: any } | null => {
            if (!eventId || !att.divisionKey || !/^\d+$/.test(att.divisionKey)) return null;
            const t = tierMap.get(Number(att.divisionKey));
            return t && t.eventId === eventId ? { dailyWageRate: t.dailyWageRate, overtimeRatePerHour: t.overtimeRatePerHour } : null;
        };

        if (att.eventId) {
            return {
                eventId: att.eventId,
                event: eventMap.get(att.eventId) ?? null,
                override: assignmentMap.get(`${att.eventId}|${att.workerId}`) ?? null,
                tierRate: tierRateFor(att.eventId),
                auto: false,
                crewCustom: crewCustomMap.get(`${att.eventId}|${att.workerId}`) ?? null,
            };
        }
        const dateKey = att.attendanceDate.toISOString().slice(0, 10);
        const matches = (autoMap.get(att.workerId) ?? []).filter((m) => m.startDate <= dateKey && dateKey <= m.endDate);
        if (!matches.length) return { eventId: null, event: null, override: null, tierRate: null, auto: false, crewCustom: null };
        // Prioritas tarif yang bisa dipakai: override/tier > PIC event > tarif event member.
        // Kalau tak ada yang bertarif, tetap tautkan event pertama (untuk TAMPILAN di payroll/slip);
        // tarifnya nanti jatuh ke default worker (event tanpa tarif tak mengubah gaji).
        const chosen =
            matches.find((m) => m.override?.dailyWageRate != null) ??
            matches.find((m) => m.event.picWorkerId === att.workerId && m.event.dailyWageRatePic != null) ??
            matches.find((m) => m.event.dailyWageRate != null) ??
            matches[0];
        return { eventId: chosen.eventId, event: chosen.event, override: chosen.override, tierRate: null, auto: true, crewCustom: chosen.custom ?? null };
    }

    async weeklySummary(weekStart: string, weekEnd?: string) {
        const start = this.parseDate(weekStart);
        const dayCount = this.rangeDayCount(start, weekEnd);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + (dayCount - 1));
        end.setUTCHours(23, 59, 59, 999);

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
                    notes: true, eventId: true, cityKey: true, divisionKey: true, approvalStatus: true,
                    customWage: true, customWageNote: true,
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
        const { rateMatrixMap, eventMap, assignmentMap, tierMap, crewCustomMap } = await this.loadResolvers(eventIds);
        const autoMap = await this.loadAutoAssignments(start, end);

        const byWorker = new Map<number, Map<string, typeof attendances[number]>>();
        for (const a of attendances) {
            const key = a.attendanceDate.toISOString().slice(0, 10);
            if (!byWorker.has(a.workerId)) byWorker.set(a.workerId, new Map());
            byWorker.get(a.workerId)!.set(key, a);
        }

        const days: string[] = [];
        for (let i = 0; i < dayCount; i++) {
            const d = new Date(start);
            d.setUTCDate(d.getUTCDate() + i);
            days.push(d.toISOString().slice(0, 10));
        }

        const rows = workers.map((w) => {
            const wMap = byWorker.get(w.id) ?? new Map();
            const cells = days.map((dateKey) => {
                const att = wMap.get(dateKey);
                if (!att) return {
                    id: null as number | null, date: dateKey, status: null as AttendanceStatus | null,
                    overtimeHours: 0, total: 0, source: null as string | null,
                    cityKey: null, divisionKey: null, eventId: null as number | null,
                    notes: null as string | null, customWage: null as number | null, customWageNote: null as string | null,
                    autoLinked: false, approvalStatus: null as AttendanceApprovalStatus | null,
                };
                const eff = this.effectiveWageInputs(
                    { workerId: w.id, eventId: att.eventId, divisionKey: att.divisionKey, attendanceDate: att.attendanceDate },
                    eventMap, assignmentMap, autoMap, tierMap, crewCustomMap,
                );
                const { dailyRate, overtimeRate, source } = resolveRates(
                    { workerId: w.id, eventId: eff.eventId, cityKey: att.cityKey, divisionKey: att.divisionKey },
                    { dailyWageRate: w.dailyWageRate, overtimeRatePerHour: w.overtimeRatePerHour },
                    eff.event,
                    rateMatrixMap,
                    eff.override,
                    eff.tierRate,
                );
                const overtimeHours = parseFloat(att.overtimeHours.toString()) || 0;
                // Gaji custom = TAMBAHAN di atas gaji harian (bukan pengganti); hanya saat hadir.
                // Prioritas: nilai per-hari di absensi > gaji custom dari penugasan crew event.
                const customWage = att.customWage != null ? parseFloat(att.customWage.toString()) : (eff.crewCustom?.amount ?? null);
                const extra = customWage != null && (att.status === 'FULL_DAY' || att.status === 'HALF_DAY') ? customWage : 0;
                const { total: rowTotal } = calcRowWage(att.status, overtimeHours, dailyRate, overtimeRate);
                const total = rowTotal + extra;
                return {
                    id: att.id, date: dateKey, status: att.status, overtimeHours, total,
                    source: customWage != null ? 'custom' : source,
                    cityKey: att.cityKey, divisionKey: att.divisionKey, eventId: eff.eventId,
                    notes: att.notes, customWage, customWageNote: att.customWageNote ?? null,
                    autoLinked: eff.auto, approvalStatus: att.approvalStatus,
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
            weekStart: days[0], weekEnd: days[days.length - 1], days, rows,
            grandTotal, grandApproved, grandAdjustment, grandFinal, pendingCount,
        };
    }

    async monthlySummary(year: number, month: number) {
        const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
        const core = await this.computeExpense(start, end);
        return {
            year, month,
            periodStart: start.toISOString().slice(0, 10),
            periodEnd: end.toISOString().slice(0, 10),
            ...core,
        };
    }

    /**
     * Laporan pengeluaran gaji untuk rentang tanggal bebas [from, to] (inclusive).
     * Dipakai laporan owner (mingguan & bulanan) — bentuk row identik dengan monthlySummary.
     */
    async periodExpenseSummary(from: string, to: string) {
        const start = this.parseDate(from);
        const end = this.parseDate(to);
        end.setHours(23, 59, 59, 999);
        const core = await this.computeExpense(start, end);
        return {
            from, to,
            periodStart: start.toISOString().slice(0, 10),
            periodEnd: end.toISOString().slice(0, 10),
            ...core,
        };
    }

    /** Inti agregasi pengeluaran gaji per worker untuk rentang [start, end] (inclusive). */
    private async computeExpense(start: Date, end: Date) {
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
                    workerId: true, attendanceDate: true, status: true, overtimeHours: true,
                    eventId: true, cityKey: true, divisionKey: true, approvalStatus: true,
                    customWage: true,
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
        const { rateMatrixMap, eventMap, assignmentMap, tierMap, crewCustomMap } = await this.loadResolvers(eventIds);
        const autoMap = await this.loadAutoAssignments(start, end);

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
                const eff = this.effectiveWageInputs(
                    { workerId: w.id, eventId: a.eventId, divisionKey: a.divisionKey, attendanceDate: a.attendanceDate },
                    eventMap, assignmentMap, autoMap, tierMap, crewCustomMap,
                );
                const { dailyRate, overtimeRate } = resolveRates(
                    { workerId: w.id, eventId: eff.eventId, cityKey: a.cityKey, divisionKey: a.divisionKey },
                    { dailyWageRate: w.dailyWageRate, overtimeRatePerHour: w.overtimeRatePerHour },
                    eff.event,
                    rateMatrixMap,
                    eff.override,
                    eff.tierRate,
                );
                // Gaji custom = TAMBAHAN di atas gaji harian (bukan pengganti); hanya saat hadir.
                // Prioritas: nilai per-hari di absensi > gaji custom dari penugasan crew event.
                const customWage = a.customWage != null ? parseFloat(a.customWage.toString()) : (eff.crewCustom?.amount ?? null);
                const extra = customWage != null && (a.status === 'FULL_DAY' || a.status === 'HALF_DAY') ? customWage : 0;
                let rowBase = 0;
                if (a.status === 'FULL_DAY') { fullDays++; rowBase = dailyRate + extra; }
                else if (a.status === 'HALF_DAY') { halfDays++; rowBase = dailyRate * 0.5 + extra; }
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
        return { rows, grandTotal, grandApproved, grandAdjustment, grandFinal };
    }

    /**
     * Detail absensi per hari untuk SATU worker di periode [from,to] — dipakai slip gaji.
     * Memakai resolver terpadu (tier Gaji A/B/C > override crew > event > auto-match penugasan > matrix > default),
     * jadi angka & event yang tertaut PERSIS sama dengan halaman payroll. Termasuk keterangan (notes) & nama event.
     */
    async workerPayrollDetail(workerId: number, start: Date, end: Date) {
        const [worker, attendances] = await Promise.all([
            this.prisma.worker.findUnique({
                where: { id: workerId },
                select: { id: true, dailyWageRate: true, overtimeRatePerHour: true },
            }),
            this.prisma.attendance.findMany({
                where: { workerId, attendanceDate: { gte: start, lte: end } },
                orderBy: { attendanceDate: 'asc' },
                select: {
                    attendanceDate: true, status: true, overtimeHours: true, notes: true,
                    eventId: true, cityKey: true, divisionKey: true, approvalStatus: true,
                    customWage: true, customWageNote: true,
                },
            }),
        ]);
        if (!worker) return null;

        const eventIds = Array.from(new Set(attendances.map((a) => a.eventId).filter((x): x is number => x != null)));
        const { rateMatrixMap, eventMap, assignmentMap, tierMap, crewCustomMap } = await this.loadResolvers(eventIds);
        const autoMap = await this.loadAutoAssignments(start, end);

        // Hitung dulu event efektif tiap baris (termasuk hasil auto-match), lalu ambil nama event-nya.
        const prepared = attendances.map((a) => {
            const eff = this.effectiveWageInputs(
                { workerId, eventId: a.eventId, divisionKey: a.divisionKey, attendanceDate: a.attendanceDate },
                eventMap, assignmentMap, autoMap, tierMap, crewCustomMap,
            );
            const { dailyRate, overtimeRate, source } = resolveRates(
                { workerId, eventId: eff.eventId, cityKey: a.cityKey, divisionKey: a.divisionKey },
                { dailyWageRate: worker.dailyWageRate, overtimeRatePerHour: worker.overtimeRatePerHour },
                eff.event, rateMatrixMap, eff.override, eff.tierRate,
            );
            // Gaji custom = TAMBAHAN di atas gaji harian. Prioritas: per-hari absensi > crew event.
            const customWage = a.customWage != null ? parseFloat(a.customWage.toString()) : (eff.crewCustom?.amount ?? null);
            return { a, eff, dailyRate, overtimeRate, customWage, source: customWage != null ? 'custom' : source };
        });

        const effEventIds = Array.from(new Set(prepared.map((p) => p.eff.eventId).filter((x): x is number => x != null)));
        const evNames = effEventIds.length
            ? await this.prisma.event.findMany({ where: { id: { in: effEventIds } }, select: { id: true, code: true, name: true } })
            : [];
        const nameMap = new Map(evNames.map((e) => [e.id, e.name || e.code]));

        let fullDays = 0, halfDays = 0, totalOvertimeHours = 0;
        let fullBaseSum = 0, halfBaseSum = 0, overtimeSum = 0, approvedTotal = 0, pendingCount = 0;
        const rows = prepared.map(({ a, eff, dailyRate, overtimeRate, source, customWage }) => {
            const oh = parseFloat(a.overtimeHours.toString()) || 0;
            totalOvertimeHours += oh;
            const approved = a.approvalStatus === 'APPROVED';
            if (a.approvalStatus === 'PENDING') pendingCount += 1;
            // Gaji custom = tambahan flat di atas base, hanya saat hadir (FULL/HALF).
            const extra = customWage != null && (a.status === 'FULL_DAY' || a.status === 'HALF_DAY') ? customWage : 0;
            let base = 0;
            if (a.status === 'FULL_DAY') { base = dailyRate + extra; if (approved) { fullDays += 1; fullBaseSum += base; } }
            else if (a.status === 'HALF_DAY') { base = dailyRate * 0.5 + extra; if (approved) { halfDays += 1; halfBaseSum += base; } }
            const overtimeAmount = oh * overtimeRate;
            const subtotal = base + overtimeAmount;
            if (approved) { overtimeSum += overtimeAmount; approvedTotal += subtotal; }
            return {
                attendanceDate: a.attendanceDate,
                status: a.status,
                overtimeHours: oh,
                notes: a.notes ?? '',
                eventId: eff.eventId,
                eventName: eff.eventId ? (nameMap.get(eff.eventId) ?? '') : '',
                autoLinked: eff.auto,
                source,
                base, overtimeAmount, subtotal,
                approvalStatus: a.approvalStatus,
            };
        });

        return { rows, fullDays, halfDays, totalOvertimeHours, fullBaseSum, halfBaseSum, overtimeSum, approvedTotal, pendingCount };
    }
}
