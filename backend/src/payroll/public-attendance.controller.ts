import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Headers,
    Param,
    ParseIntPipe,
    Post,
    Query,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService, type AttendanceRowInput } from './attendance.service';

/**
 * Endpoint public untuk PIC isi absensi via shareable link.
 * NO JWT — autentikasi via picAccessToken di URL path.
 * Worker harus isPic=true dan token harus match.
 */
@Controller('public/attendance')
export class PublicAttendanceController {
    constructor(
        private prisma: PrismaService,
        private attendanceService: AttendanceService,
    ) { }

    /**
     * Validate token + (kalau PIC punya picPin) PIN dari header `X-Pic-Pin`.
     * Throw kalau token invalid, worker non-PIC, atau PIN salah/missing.
     */
    private async validatePic(token: string, providedPin?: string) {
        if (!token || token.length < 32) throw new ForbiddenException('Token tidak valid');
        const pic = await this.prisma.worker.findUnique({
            where: { picAccessToken: token },
            select: { id: true, name: true, position: true, isPic: true, isActive: true, picPin: true, teamId: true },
        });
        if (!pic || !pic.isPic || !pic.isActive) {
            throw new ForbiddenException('Link tidak valid atau sudah dinonaktifkan');
        }
        // Kalau PIC punya PIN di-set, wajib match. Kalau picPin null → no PIN required (back-compat).
        if (pic.picPin) {
            const pin = providedPin?.trim();
            if (!pin) throw new ForbiddenException('PIN_REQUIRED');
            if (pin !== pic.picPin) throw new ForbiddenException('PIN_INVALID');
        }
        return pic;
    }

    /**
     * Resolve team yang di-handle PIC ini:
     *  - Prioritas 1: team di mana PIC adalah leader (CrewTeam.leaderWorkerId = pic.id)
     *  - Prioritas 2: team yang PIC sendiri jadi member (Worker.teamId)
     * Auto-create team kalau PIC belum punya — pakai nama PIC.
     */
    private async resolvePicTeamId(picId: number, picName: string): Promise<number> {
        const led = await this.prisma.crewTeam.findFirst({
            where: { leaderWorkerId: picId, isActive: true },
            select: { id: true },
        });
        if (led) return led.id;
        const me = await this.prisma.worker.findUnique({
            where: { id: picId },
            select: { teamId: true },
        });
        if (me?.teamId) return me.teamId;
        // Auto-create team baru dengan nama "Tim {PIC Name}"
        const baseName = `Tim ${picName}`;
        let name = baseName;
        let attempt = 0;
        // Hindari conflict nama unique
        while (await this.prisma.crewTeam.findUnique({ where: { name } })) {
            attempt += 1;
            name = `${baseName} (${attempt})`;
            if (attempt > 50) throw new Error('Tidak bisa generate nama team unik');
        }
        const team = await this.prisma.crewTeam.create({
            data: {
                name,
                leaderWorkerId: picId,
                color: '#10b981',
            },
        });
        // Set PIC sendiri sebagai member team-nya juga
        await this.prisma.worker.update({
            where: { id: picId },
            data: { teamId: team.id },
        });
        return team.id;
    }

    /**
     * GET /public/attendance/:token/check
     * Cek apakah token valid + apakah perlu PIN. Tidak return data sensitif (cuma PIC name + needsPin flag).
     * Dipakai frontend untuk render PIN gate sebelum minta data.
     */
    @Get(':token/check')
    async checkToken(@Param('token') token: string) {
        if (!token || token.length < 32) throw new ForbiddenException('Token tidak valid');
        const pic = await this.prisma.worker.findUnique({
            where: { picAccessToken: token },
            select: { id: true, name: true, isPic: true, isActive: true, picPin: true },
        });
        if (!pic || !pic.isPic || !pic.isActive) {
            throw new ForbiddenException('Link tidak valid atau sudah dinonaktifkan');
        }
        return {
            ok: true,
            picName: pic.name,
            needsPin: !!pic.picPin,
        };
    }

    /**
     * GET /public/attendance/:token?date=YYYY-MM-DD
     * Return PIC info + list active workers + existing attendance for tanggal (kalau ada).
     */
    @Get(':token')
    async getContext(
        @Param('token') token: string,
        @Query('date') dateStr?: string,
        @Headers('x-pic-pin') pinHeader?: string,
    ) {
        const pic = await this.validatePic(token, pinHeader);
        const teamId = await this.resolvePicTeamId(pic.id, pic.name);

        // Default ke hari ini di server local timezone (YYYY-MM-DD)
        const targetDate = dateStr || new Date().toISOString().slice(0, 10);

        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(targetDate);
        if (!m) throw new BadRequestException('Format tanggal invalid (YYYY-MM-DD)');
        const dateObj = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);

        const [team, workers, existing, wageRates, events] = await Promise.all([
            this.prisma.crewTeam.findUnique({
                where: { id: teamId },
                select: { id: true, name: true, color: true },
            }),
            // ⚠ Filter: cuma worker di team PIC yang muncul
            this.prisma.worker.findMany({
                where: { isActive: true, teamId },
                orderBy: { name: 'asc' },
                select: {
                    id: true, name: true, position: true, photoUrl: true,
                    dailyWageRate: true, overtimeRatePerHour: true,
                    defaultCityKey: true, defaultDivisionKey: true,
                },
            }),
            this.prisma.attendance.findMany({
                where: { attendanceDate: dateObj },
                select: {
                    id: true, workerId: true, status: true, overtimeHours: true, notes: true,
                    eventId: true, cityKey: true, divisionKey: true,
                },
            }),
            // Distinct cities & divisions dari WageRate aktif (untuk dropdown)
            this.prisma.wageRate.findMany({
                where: { isActive: true },
                select: { city: true, division: true },
            }),
            // Active events untuk picker (status SCHEDULED atau IN_PROGRESS, recent)
            this.prisma.event.findMany({
                where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] as any } },
                orderBy: { eventStart: 'desc' },
                take: 50,
                select: { id: true, code: true, name: true, venue: true, dailyWageRate: true, overtimeRatePerHour: true },
            }),
        ]);

        const citySet = new Set<string>();
        const divSet = new Set<string>();
        for (const r of wageRates) {
            if (r.city.trim()) citySet.add(r.city.trim());
            if (r.division.trim()) divSet.add(r.division.trim());
        }

        // Map attendance per workerId for prefill
        const existingByWorker = new Map<number, typeof existing[number]>();
        for (const a of existing) existingByWorker.set(a.workerId, a);

        return {
            pic: { id: pic.id, name: pic.name, position: pic.position },
            team,
            date: targetDate,
            workers: workers.map((w) => ({
                id: w.id, name: w.name, position: w.position, photoUrl: w.photoUrl,
                hasPayroll: w.dailyWageRate != null,
                defaultCityKey: w.defaultCityKey,
                defaultDivisionKey: w.defaultDivisionKey,
                existing: existingByWorker.get(w.id) ?? null,
            })),
            // Master data untuk dropdown wage context
            cities: Array.from(citySet).sort((a, b) => a.localeCompare(b, 'id')),
            divisions: Array.from(divSet).sort((a, b) => a.localeCompare(b, 'id')),
            events: events.map(e => ({
                id: e.id, code: e.code, name: e.name, venue: e.venue,
                hasWageOverride: e.dailyWageRate != null,
            })),
        };
    }

    /**
     * GET /public/attendance/:token/team
     * Detail tim PIC + member + worker available untuk di-add ke team.
     */
    @Get(':token/team')
    async getTeam(
        @Param('token') token: string,
        @Headers('x-pic-pin') pinHeader?: string,
    ) {
        const pic = await this.validatePic(token, pinHeader);
        const teamId = await this.resolvePicTeamId(pic.id, pic.name);

        const [team, members, available] = await Promise.all([
            this.prisma.crewTeam.findUnique({
                where: { id: teamId },
                select: { id: true, name: true, color: true, notes: true },
            }),
            this.prisma.worker.findMany({
                where: { teamId, isActive: true },
                orderBy: { name: 'asc' },
                select: { id: true, name: true, position: true, photoUrl: true, phone: true },
            }),
            // Worker aktif yang BELUM di-assign team manapun (boleh diadd)
            this.prisma.worker.findMany({
                where: { teamId: null, isActive: true },
                orderBy: { name: 'asc' },
                select: { id: true, name: true, position: true, photoUrl: true, phone: true },
            }),
        ]);

        return { team, members, available };
    }

    /**
     * POST /public/attendance/:token/team/add  body: { workerId }
     * PIC tambah worker ke timnya. Worker yang sudah di-team lain → reject.
     */
    @Post(':token/team/add')
    async addTeamMember(
        @Param('token') token: string,
        @Body() body: { workerId: number },
        @Headers('x-pic-pin') pinHeader?: string,
    ) {
        const pic = await this.validatePic(token, pinHeader);
        const teamId = await this.resolvePicTeamId(pic.id, pic.name);
        const worker = await this.prisma.worker.findUnique({
            where: { id: body.workerId },
            select: { id: true, teamId: true, isActive: true },
        });
        if (!worker || !worker.isActive) throw new BadRequestException('Worker tidak ditemukan atau nonaktif');
        if (worker.teamId && worker.teamId !== teamId) {
            throw new BadRequestException('Worker sudah jadi member tim lain. Hubungi admin untuk pindahkan.');
        }
        await this.prisma.worker.update({
            where: { id: body.workerId },
            data: { teamId },
        });
        return { ok: true, workerId: body.workerId, teamId };
    }

    /**
     * DELETE /public/attendance/:token/team/:workerId
     * PIC keluarkan worker dari timnya (worker.teamId = null).
     */
    @Delete(':token/team/:workerId')
    async removeTeamMember(
        @Param('token') token: string,
        @Param('workerId', ParseIntPipe) workerId: number,
        @Headers('x-pic-pin') pinHeader?: string,
    ) {
        const pic = await this.validatePic(token, pinHeader);
        const teamId = await this.resolvePicTeamId(pic.id, pic.name);
        const worker = await this.prisma.worker.findUnique({
            where: { id: workerId },
            select: { teamId: true },
        });
        if (worker?.teamId !== teamId) {
            throw new BadRequestException('Worker bukan member tim Anda');
        }
        await this.prisma.worker.update({
            where: { id: workerId },
            data: { teamId: null },
        });
        return { ok: true, workerId };
    }

    /** POST /public/attendance/:token/submit — bulk upsert. */
    @Post(':token/submit')
    async submit(
        @Param('token') token: string,
        @Body() body: { date: string; entries: AttendanceRowInput[] },
        @Headers('x-pic-pin') pinHeader?: string,
    ) {
        const pic = await this.validatePic(token, pinHeader);
        if (!body.date) throw new BadRequestException('date wajib diisi');
        if (!Array.isArray(body.entries)) throw new BadRequestException('entries wajib array');
        // PIC submit — no admin actor, recordedByPicId = pic.id
        return this.attendanceService.bulkUpsert(body.date, body.entries, pic.id, null);
    }
}
