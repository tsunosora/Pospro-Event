import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { AttendanceStatus, AttendanceApprovalStatus, AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AttendanceRowInput {
    workerId: number;
    status: AttendanceStatus;
    overtimeHours?: number | string;
    notes?: string | null;
    eventId?: number | null;
    cityKey?: string | null;
    divisionKey?: string | null;
}

/** Snapshot field-field penting untuk audit log. */
function snapshot(att: any) {
    if (!att) return null;
    return {
        id: att.id,
        workerId: att.workerId,
        attendanceDate: att.attendanceDate,
        status: att.status,
        overtimeHours: att.overtimeHours?.toString?.() ?? att.overtimeHours,
        notes: att.notes,
        eventId: att.eventId,
        cityKey: att.cityKey,
        divisionKey: att.divisionKey,
        approvalStatus: att.approvalStatus,
        recordedByPicId: att.recordedByPicId,
    };
}

@Injectable()
export class AttendanceService {
    constructor(private prisma: PrismaService) { }

    private parseDate(input: string | Date): Date {
        if (input instanceof Date) {
            const d = new Date(input);
            d.setHours(0, 0, 0, 0);
            return d;
        }
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(input));
        if (!m) throw new BadRequestException(`Format tanggal invalid: ${input}. Gunakan YYYY-MM-DD.`);
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
        if (Number.isNaN(d.getTime())) throw new BadRequestException(`Tanggal invalid: ${input}`);
        return d;
    }

    /**
     * Catat audit log — fail silently kalau gagal supaya gak ganggu operasi utama.
     *
     * PENTING: Saat di-call dari DALAM `$transaction`, pass `tx` sebagai `client`
     * supaya audit log query masuk ke koneksi tx yang SAMA. Kalau pakai `this.prisma`
     * dari dalam tx, query masuk koneksi terpisah → attendance row belum committed →
     * FK constraint `attendance_id` violation.
     *
     * Di luar transaction, pass `this.prisma` (standalone commit).
     */
    private async logAudit(
        client: Prisma.TransactionClient | PrismaService,
        params: {
            attendanceId: number | null;
            action: AuditAction;
            changedById?: number | null;
            changedByPicId?: number | null;
            oldData?: any;
            newData?: any;
            notes?: string | null;
        },
    ) {
        try {
            await client.attendanceAuditLog.create({
                data: {
                    attendanceId: params.attendanceId,
                    action: params.action,
                    changedById: params.changedById ?? null,
                    changedByPicId: params.changedByPicId ?? null,
                    oldData: params.oldData ? JSON.stringify(params.oldData) : null,
                    newData: params.newData ? JSON.stringify(params.newData) : null,
                    notes: params.notes ?? null,
                },
            });
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[Audit] Failed to log:', (e as Error).message);
        }
    }

    async list(params: { from?: string; to?: string; workerId?: number; approvalStatus?: AttendanceApprovalStatus }) {
        const where: Prisma.AttendanceWhereInput = {};
        if (params.workerId) where.workerId = params.workerId;
        if (params.approvalStatus) where.approvalStatus = params.approvalStatus;
        if (params.from || params.to) {
            where.attendanceDate = {};
            if (params.from) (where.attendanceDate as any).gte = this.parseDate(params.from);
            if (params.to) (where.attendanceDate as any).lte = this.parseDate(params.to);
        }
        return this.prisma.attendance.findMany({
            where,
            orderBy: [{ attendanceDate: 'desc' }, { workerId: 'asc' }],
            include: {
                worker: { select: { id: true, name: true, position: true, dailyWageRate: true, overtimeRatePerHour: true } },
                recordedByPic: { select: { id: true, name: true } },
                approvedBy: { select: { id: true, name: true, email: true } },
            },
        });
    }

    /**
     * Bulk upsert untuk 1 tanggal — dari PIC submit atau admin manual.
     * - Saat update: kalau row sebelumnya APPROVED & data berubah, reset jadi PENDING (data perlu di-review lagi)
     * - Audit log dicatat untuk setiap row (CREATE atau UPDATE)
     */
    async bulkUpsert(
        date: string | Date,
        entries: AttendanceRowInput[],
        recordedByPicId: number | null,
        actorAdminId: number | null = null,
    ) {
        if (!entries || entries.length === 0) return { upserted: 0 };

        const attendanceDate = this.parseDate(date);

        // Pre-fetch existing untuk perbandingan + audit log
        const workerIds = entries.map((e) => e.workerId);
        const existing = await this.prisma.attendance.findMany({
            where: { workerId: { in: workerIds }, attendanceDate },
        });
        const existingByWorker = new Map<number, typeof existing[number]>();
        for (const e of existing) existingByWorker.set(e.workerId, e);

        const results: { id: number; isNew: boolean }[] = [];

        // Timeout 30s untuk akomodasi bulk besar (default Prisma cuma 5s).
        // maxWait 10s untuk tunggu koneksi pool kalau lagi sibuk.
        await this.prisma.$transaction(async (tx) => {
            for (const e of entries) {
                const overtime = e.overtimeHours != null ? Number(e.overtimeHours) || 0 : 0;
                const eventId = e.eventId == null ? null : e.eventId;
                const cityKey = e.cityKey?.trim() || null;
                const divisionKey = e.divisionKey?.trim() || null;
                const prev = existingByWorker.get(e.workerId);

                // Kalau ada perubahan & sebelumnya APPROVED → reset PENDING (re-approval needed)
                let approvalReset = false;
                if (prev && prev.approvalStatus === 'APPROVED') {
                    const sameStatus = prev.status === e.status;
                    const sameOvertime = parseFloat(prev.overtimeHours.toString()) === overtime;
                    const sameContext =
                        (prev.eventId ?? null) === (eventId ?? null) &&
                        (prev.cityKey ?? null) === (cityKey ?? null) &&
                        (prev.divisionKey ?? null) === (divisionKey ?? null);
                    if (!(sameStatus && sameOvertime && sameContext)) approvalReset = true;
                }

                const upserted = await tx.attendance.upsert({
                    where: { workerId_attendanceDate: { workerId: e.workerId, attendanceDate } },
                    create: {
                        workerId: e.workerId,
                        attendanceDate,
                        status: e.status,
                        overtimeHours: overtime as any,
                        notes: e.notes?.trim() || null,
                        recordedByPicId,
                        eventId,
                        cityKey,
                        divisionKey,
                        approvalStatus: 'PENDING',
                    },
                    update: {
                        status: e.status,
                        overtimeHours: overtime as any,
                        notes: e.notes?.trim() || null,
                        recordedByPicId,
                        eventId,
                        cityKey,
                        divisionKey,
                        ...(approvalReset
                            ? { approvalStatus: 'PENDING' as const, approvedAt: null, approvedById: null, rejectionReason: null }
                            : {}),
                    },
                });

                results.push({ id: upserted.id, isNew: !prev });

                // Audit log — PASS tx supaya query masuk koneksi yang sama dengan upsert.
                // Kalau pakai this.prisma di sini, FK ke attendance_id gagal karena
                // row baru belum committed di luar tx scope.
                await this.logAudit(tx, {
                    attendanceId: upserted.id,
                    action: prev ? 'UPDATE' : 'CREATE',
                    changedById: actorAdminId,
                    changedByPicId: recordedByPicId,
                    oldData: snapshot(prev),
                    newData: snapshot(upserted),
                    notes: approvalReset ? 'Auto-reset PENDING karena data berubah setelah APPROVED' : null,
                });
            }
        }, {
            timeout: 30_000,   // 30s — akomodasi bulk besar
            maxWait: 10_000,   // 10s tunggu koneksi pool
        });

        return { upserted: results.length };
    }

    async update(
        id: number,
        input: {
            status?: AttendanceStatus;
            overtimeHours?: number | string;
            notes?: string | null;
            eventId?: number | null;
            cityKey?: string | null;
            divisionKey?: string | null;
        },
        actorAdminId: number | null = null,
    ) {
        const existing = await this.prisma.attendance.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Attendance id=${id} tidak ditemukan`);

        const data: Prisma.AttendanceUpdateInput = {};
        if (input.status !== undefined) data.status = input.status;
        if (input.overtimeHours !== undefined) data.overtimeHours = (Number(input.overtimeHours) || 0) as any;
        if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
        if (input.eventId !== undefined) data.event = input.eventId ? { connect: { id: input.eventId } } : { disconnect: true };
        if (input.cityKey !== undefined) data.cityKey = input.cityKey?.trim() || null;
        if (input.divisionKey !== undefined) data.divisionKey = input.divisionKey?.trim() || null;

        // Reset approval kalau approved
        if (existing.approvalStatus === 'APPROVED') {
            data.approvalStatus = 'PENDING';
            data.approvedAt = null;
            data.approvedBy = { disconnect: true };
            data.rejectionReason = null;
        }

        const updated = await this.prisma.attendance.update({ where: { id }, data });
        await this.logAudit(this.prisma, {
            attendanceId: id,
            action: 'UPDATE',
            changedById: actorAdminId,
            oldData: snapshot(existing),
            newData: snapshot(updated),
        });
        return updated;
    }

    async remove(id: number, actorAdminId: number | null = null) {
        const existing = await this.prisma.attendance.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Attendance id=${id} tidak ditemukan`);
        const result = await this.prisma.attendance.delete({ where: { id } });
        await this.logAudit(this.prisma, {
            attendanceId: null,  // deleted, jangan link ke row yang gak ada
            action: 'DELETE',
            changedById: actorAdminId,
            oldData: snapshot(existing),
            notes: `Attendance id=${id} dihapus`,
        });
        return result;
    }

    /** Approve 1 attendance — set status APPROVED + record approver. */
    async approve(id: number, actorAdminId: number) {
        const existing = await this.prisma.attendance.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Attendance id=${id} tidak ditemukan`);
        const updated = await this.prisma.attendance.update({
            where: { id },
            data: {
                approvalStatus: 'APPROVED',
                approvedAt: new Date(),
                approvedBy: { connect: { id: actorAdminId } },
                rejectionReason: null,
            },
        });
        await this.logAudit(this.prisma, {
            attendanceId: id,
            action: 'APPROVE',
            changedById: actorAdminId,
            oldData: snapshot(existing),
            newData: snapshot(updated),
        });
        return updated;
    }

    async reject(id: number, actorAdminId: number, reason: string | null = null) {
        const existing = await this.prisma.attendance.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Attendance id=${id} tidak ditemukan`);
        const updated = await this.prisma.attendance.update({
            where: { id },
            data: {
                approvalStatus: 'REJECTED',
                approvedAt: new Date(),
                approvedBy: { connect: { id: actorAdminId } },
                rejectionReason: reason?.trim() || null,
            },
        });
        await this.logAudit(this.prisma, {
            attendanceId: id,
            action: 'REJECT',
            changedById: actorAdminId,
            oldData: snapshot(existing),
            newData: snapshot(updated),
            notes: reason ?? null,
        });
        return updated;
    }

    /** Bulk approve — admin approve banyak row sekaligus (mis. semua PENDING di periode tertentu). */
    async bulkApprove(ids: number[], actorAdminId: number) {
        if (!ids || ids.length === 0) return { approved: 0 };
        const targets = await this.prisma.attendance.findMany({
            where: { id: { in: ids }, approvalStatus: { not: 'APPROVED' } },
        });

        const result = await this.prisma.attendance.updateMany({
            where: { id: { in: targets.map((t) => t.id) } },
            data: {
                approvalStatus: 'APPROVED',
                approvedAt: new Date(),
                approvedById: actorAdminId,
                rejectionReason: null,
            },
        });

        // Audit log per row — di luar transaction, pakai this.prisma
        for (const t of targets) {
            await this.logAudit(this.prisma, {
                attendanceId: t.id,
                action: 'APPROVE',
                changedById: actorAdminId,
                oldData: snapshot(t),
                newData: { ...snapshot(t), approvalStatus: 'APPROVED', approvedById: actorAdminId },
                notes: 'Bulk approve',
            });
        }

        return { approved: result.count };
    }

    /** Get audit log untuk 1 attendance. */
    async getAuditLog(attendanceId: number) {
        return this.prisma.attendanceAuditLog.findMany({
            where: { attendanceId },
            orderBy: { createdAt: 'desc' },
            include: {
                changedBy: { select: { id: true, name: true, email: true } },
                changedByPic: { select: { id: true, name: true } },
            },
        });
    }
}
