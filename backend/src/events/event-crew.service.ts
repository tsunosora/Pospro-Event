import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { randomBytes } from 'crypto';

export interface CreateAssignmentInput {
    eventId: number;
    workerId: number;
    teamId?: number | null;
    role?: string | null;
    scheduledStart?: string | null;
    scheduledEnd?: string | null;
}

export interface UpdateAssignmentInput {
    teamId?: number | null;
    role?: string | null;
    scheduledStart?: string | null;
    scheduledEnd?: string | null;
}

@Injectable()
export class EventCrewService {
    constructor(
        private prisma: PrismaService,
        private whatsapp: WhatsappService,
    ) { }

    private genToken() {
        return randomBytes(24).toString('hex');
    }

    private parseDate(d?: string | null) {
        if (!d) return null;
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? null : dt;
    }

    async listByEvent(eventId: number) {
        return this.prisma.eventCrewAssignment.findMany({
            where: { eventId },
            include: {
                worker: { select: { id: true, name: true, position: true, phone: true } },
                team: {
                    select: {
                        id: true, name: true, color: true,
                        leader: { select: { id: true, name: true, phone: true } },
                    },
                },
            },
            orderBy: [{ teamId: 'asc' }, { scheduledStart: 'asc' }, { id: 'asc' }],
        });
    }

    async create(input: CreateAssignmentInput, opts: { notify?: boolean; baseUrl?: string } = {}) {
        if (!input.eventId || !input.workerId) {
            throw new BadRequestException('eventId & workerId wajib');
        }
        const existing = await this.prisma.eventCrewAssignment.findUnique({
            where: { eventId_workerId: { eventId: input.eventId, workerId: input.workerId } },
        });
        if (existing) {
            throw new BadRequestException('Worker sudah ditugaskan ke event ini');
        }
        const created = await this.prisma.eventCrewAssignment.create({
            data: {
                eventId: input.eventId,
                workerId: input.workerId,
                teamId: input.teamId ?? null,
                role: input.role ?? null,
                scheduledStart: this.parseDate(input.scheduledStart),
                scheduledEnd: this.parseDate(input.scheduledEnd),
                accessToken: this.genToken(),
            },
            include: {
                worker: { select: { id: true, name: true, position: true, phone: true } },
                team: {
                    select: {
                        id: true, name: true, color: true,
                        leader: { select: { id: true, name: true, phone: true } },
                    },
                },
                event: { select: { id: true, code: true, name: true, venue: true, eventStart: true } },
            },
        });

        // Auto-notify via WhatsApp (best-effort, non-blocking)
        let notified = { crew: false, leader: false };
        if (opts.notify !== false) {
            const baseUrl = opts.baseUrl ?? '';
            const link = `${baseUrl}/public/crew/${created.accessToken}`;
            const ev = created.event;
            const teamLine = created.team ? `Team: ${created.team.name}\n` : '';
            const roleLine = created.role ? `Tugas: ${created.role}\n` : '';
            const venueLine = ev.venue ? `Venue: ${ev.venue}\n` : '';
            const dateLine = ev.eventStart ? `Tanggal: ${new Date(ev.eventStart).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}\n` : '';

            // Crew message
            const crewMsg =
                `Halo ${created.worker.name},\n\n` +
                `Kamu ditugaskan ke event:\n*${ev.name}* (${ev.code})\n${venueLine}${dateLine}${roleLine}${teamLine}\n` +
                `Link check-in/out:\n${link}\n\n` +
                `Tap link saat tiba di lokasi & saat selesai. Foto opsional.\n— Pospro Event`;
            notified.crew = await this.whatsapp.sendDirect(created.worker.phone, crewMsg);

            // Leader message (only if team has leader & leader != crew)
            const leader = created.team?.leader;
            if (leader && leader.id !== created.worker.id && leader.phone) {
                const leaderMsg =
                    `Halo ${leader.name} (Leader Team ${created.team!.name}),\n\n` +
                    `Anggota baru ditugaskan ke event ${ev.name}:\n` +
                    `👤 ${created.worker.name}\n${roleLine}${venueLine}${dateLine}\n` +
                    `Mohon koordinasi dengan ${created.worker.name} untuk eksekusi.\n— Pospro Event`;
                notified.leader = await this.whatsapp.sendDirect(leader.phone, leaderMsg);
            }
        }

        return { ...created, _notified: notified };
    }

    async createBulk(
        eventId: number,
        workerIds: number[],
        common: { teamId?: number | null; role?: string | null; scheduledStart?: string | null; scheduledEnd?: string | null } = {},
    ) {
        if (!eventId || !workerIds.length) {
            throw new BadRequestException('eventId & minimal 1 worker wajib');
        }
        const dedupedIds = Array.from(new Set(workerIds));

        // Cari yang sudah pernah ditugaskan (skip, jangan error)
        const existing = await this.prisma.eventCrewAssignment.findMany({
            where: { eventId, workerId: { in: dedupedIds } },
            select: { workerId: true },
        });
        const existingSet = new Set(existing.map((e) => e.workerId));
        const toCreate = dedupedIds.filter((id) => !existingSet.has(id));

        const created: Array<{ workerId: number; assignmentId: number }> = [];
        for (const workerId of toCreate) {
            const a = await this.prisma.eventCrewAssignment.create({
                data: {
                    eventId,
                    workerId,
                    teamId: common.teamId ?? null,
                    role: common.role ?? null,
                    scheduledStart: this.parseDate(common.scheduledStart ?? null),
                    scheduledEnd: this.parseDate(common.scheduledEnd ?? null),
                    accessToken: this.genToken(),
                },
            });
            created.push({ workerId, assignmentId: a.id });
        }

        return {
            created: created.length,
            skipped: existingSet.size,
            createdIds: created,
            skippedWorkerIds: Array.from(existingSet),
        };
    }

    async update(id: number, input: UpdateAssignmentInput) {
        const data: Record<string, unknown> = {};
        if (input.teamId !== undefined) data.teamId = input.teamId;
        if (input.role !== undefined) data.role = input.role;
        if (input.scheduledStart !== undefined) data.scheduledStart = this.parseDate(input.scheduledStart);
        if (input.scheduledEnd !== undefined) data.scheduledEnd = this.parseDate(input.scheduledEnd);
        return this.prisma.eventCrewAssignment.update({
            where: { id },
            data,
            include: {
                worker: { select: { id: true, name: true, position: true } },
                team: { select: { id: true, name: true, color: true } },
            },
        });
    }

    async remove(id: number) {
        await this.prisma.eventCrewAssignment.delete({ where: { id } });
        return { ok: true };
    }

    async removeBulk(ids: number[]) {
        if (!ids.length) return { ok: true, deleted: 0 };
        const res = await this.prisma.eventCrewAssignment.deleteMany({
            where: { id: { in: ids } },
        });
        return { ok: true, deleted: res.count };
    }

    async reassignTeamBulk(ids: number[], teamId: number | null) {
        if (!ids.length) return { ok: true, updated: 0 };
        const res = await this.prisma.eventCrewAssignment.updateMany({
            where: { id: { in: ids } },
            data: { teamId },
        });
        return { ok: true, updated: res.count };
    }

    async regenerateToken(id: number) {
        return this.prisma.eventCrewAssignment.update({
            where: { id },
            data: { accessToken: this.genToken() },
            select: { id: true, accessToken: true },
        });
    }

    // ── Public endpoints by token ──

    async findByToken(token: string) {
        const a = await this.prisma.eventCrewAssignment.findUnique({
            where: { accessToken: token },
            include: {
                worker: { select: { id: true, name: true, phone: true, position: true } },
                team: {
                    select: {
                        id: true, name: true, color: true,
                        leader: { select: { id: true, name: true, phone: true } },
                    },
                },
                event: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        venue: true,
                        eventStart: true,
                        eventEnd: true,
                        setupStart: true,
                        setupEnd: true,
                        loadingStart: true,
                        loadingEnd: true,
                        customerName: true,
                    },
                },
            },
        });
        if (!a) throw new NotFoundException('Link tidak valid');
        return a;
    }

    async checkIn(token: string, photoUrl: string | null, note?: string | null) {
        const a = await this.prisma.eventCrewAssignment.findUnique({ where: { accessToken: token } });
        if (!a) throw new NotFoundException('Link tidak valid');
        if (a.startedAt) throw new BadRequestException('Sudah check-in sebelumnya');
        return this.prisma.eventCrewAssignment.update({
            where: { id: a.id },
            data: {
                startedAt: new Date(),
                startPhotoUrl: photoUrl,
                startNote: note ?? null,
            },
        });
    }

    async checkOut(token: string, photoUrl: string | null, note?: string | null) {
        const a = await this.prisma.eventCrewAssignment.findUnique({ where: { accessToken: token } });
        if (!a) throw new NotFoundException('Link tidak valid');
        if (!a.startedAt) throw new BadRequestException('Belum check-in');
        if (a.finishedAt) throw new BadRequestException('Sudah check-out sebelumnya');
        return this.prisma.eventCrewAssignment.update({
            where: { id: a.id },
            data: {
                finishedAt: new Date(),
                endPhotoUrl: photoUrl,
                endNote: note ?? null,
            },
        });
    }

    // ── Reports ──

    async report(eventId?: number) {
        const where = eventId ? { eventId } : {};
        const assignments = await this.prisma.eventCrewAssignment.findMany({
            where: { ...where, finishedAt: { not: null } },
            include: {
                worker: { select: { id: true, name: true } },
                team: { select: { id: true, name: true, color: true } },
                event: { select: { id: true, code: true, name: true } },
            },
            orderBy: [{ finishedAt: 'desc' }],
        });

        const rows = assignments.map((a) => {
            const durationMs = a.finishedAt!.getTime() - a.startedAt!.getTime();
            const durationMin = Math.round(durationMs / 60000);
            return {
                id: a.id,
                eventId: a.eventId,
                eventName: a.event.name,
                eventCode: a.event.code,
                workerId: a.workerId,
                workerName: a.worker.name,
                teamId: a.teamId,
                teamName: a.team?.name ?? null,
                teamColor: a.team?.color ?? null,
                role: a.role,
                startedAt: a.startedAt,
                finishedAt: a.finishedAt,
                durationMinutes: durationMin,
            };
        });

        // Aggregate per worker
        const byWorker = new Map<number, { workerId: number; workerName: string; totalMinutes: number; jobs: number }>();
        rows.forEach((r) => {
            const cur = byWorker.get(r.workerId) ?? { workerId: r.workerId, workerName: r.workerName, totalMinutes: 0, jobs: 0 };
            cur.totalMinutes += r.durationMinutes;
            cur.jobs += 1;
            byWorker.set(r.workerId, cur);
        });

        // Aggregate per team
        const byTeam = new Map<number, { teamId: number; teamName: string; teamColor: string | null; totalMinutes: number; jobs: number; uniqueWorkers: Set<number> }>();
        rows.forEach((r) => {
            if (!r.teamId || !r.teamName) return;
            const cur = byTeam.get(r.teamId) ?? { teamId: r.teamId, teamName: r.teamName, teamColor: r.teamColor, totalMinutes: 0, jobs: 0, uniqueWorkers: new Set() };
            cur.totalMinutes += r.durationMinutes;
            cur.jobs += 1;
            cur.uniqueWorkers.add(r.workerId);
            byTeam.set(r.teamId, cur);
        });

        return {
            rows,
            byWorker: Array.from(byWorker.values()).sort((a, b) => b.totalMinutes - a.totalMinutes),
            byTeam: Array.from(byTeam.values())
                .map((t) => ({ teamId: t.teamId, teamName: t.teamName, teamColor: t.teamColor, totalMinutes: t.totalMinutes, jobs: t.jobs, uniqueWorkers: t.uniqueWorkers.size }))
                .sort((a, b) => b.totalMinutes - a.totalMinutes),
        };
    }
}
