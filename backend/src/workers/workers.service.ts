import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateWorkerInput {
    name: string;
    position?: string;
    phone?: string;
    photoUrl?: string;
    notes?: string;
    isActive?: boolean;
    // Payroll fields
    dailyWageRate?: number | string | null;
    overtimeRatePerHour?: number | string | null;
    isPic?: boolean;
    picPin?: string | null;
    teamId?: number | null;
    defaultCityKey?: string | null;
    defaultDivisionKey?: string | null;
}

export interface UpdateWorkerInput {
    name?: string;
    position?: string;
    phone?: string;
    photoUrl?: string;
    signatureImageUrl?: string | null;
    stampImageUrl?: string | null;
    notes?: string;
    isActive?: boolean;
    // Payroll fields
    dailyWageRate?: number | string | null;
    overtimeRatePerHour?: number | string | null;
    isPic?: boolean;
    picPin?: string | null;
    teamId?: number | null;
    defaultCityKey?: string | null;
    defaultDivisionKey?: string | null;
}

/** Generate token unik 64-char hex untuk public PIC link. */
function generatePicToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

@Injectable()
export class WorkersService {
    constructor(private prisma: PrismaService) { }

    async findAll(
        includeInactive = false,
        options: { position?: string; positions?: string[] } = {},
    ) {
        const where: any = includeInactive ? {} : { isActive: true };
        if (options.position) where.position = options.position;
        else if (options.positions && options.positions.length > 0) {
            where.position = { in: options.positions };
        }
        return this.prisma.worker.findMany({
            where,
            orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
            include: {
                _count: { select: { withdrawals: true } },
                team: { select: { id: true, name: true, color: true } },
            },
        });
    }

    async findOne(id: number) {
        const w = await this.prisma.worker.findUnique({
            where: { id },
            include: {
                _count: { select: { withdrawals: true } },
                team: { select: { id: true, name: true, color: true } },
            },
        });
        if (!w) throw new NotFoundException(`Pekerja id=${id} tidak ditemukan`);
        return w;
    }

    async create(input: CreateWorkerInput) {
        const name = input.name?.trim();
        if (!name) throw new BadRequestException('Nama pekerja wajib diisi');

        // Auto-generate token kalau worker dibuat dengan isPic=true langsung
        const isPic = input.isPic ?? false;
        const picAccessToken = isPic ? generatePicToken() : null;

        return this.prisma.worker.create({
            data: {
                name,
                position: input.position?.trim() || null,
                phone: input.phone?.trim() || null,
                photoUrl: input.photoUrl || null,
                notes: input.notes?.trim() || null,
                isActive: input.isActive ?? true,
                dailyWageRate: input.dailyWageRate != null && input.dailyWageRate !== '' ? input.dailyWageRate as any : null,
                overtimeRatePerHour: input.overtimeRatePerHour != null && input.overtimeRatePerHour !== '' ? input.overtimeRatePerHour as any : null,
                isPic,
                picAccessToken,
                picPin: input.picPin?.trim() || null,
                teamId: input.teamId ?? null,
                defaultCityKey: input.defaultCityKey?.trim() || null,
                defaultDivisionKey: input.defaultDivisionKey?.trim() || null,
            },
        });
    }

    async update(id: number, input: UpdateWorkerInput) {
        const existing = await this.findOne(id);

        const data: any = {};
        if (input.name !== undefined) {
            const name = input.name.trim();
            if (!name) throw new BadRequestException('Nama pekerja wajib diisi');
            data.name = name;
        }
        if (input.position !== undefined) data.position = input.position?.trim() || null;
        if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
        if (input.photoUrl !== undefined) data.photoUrl = input.photoUrl || null;
        if (input.signatureImageUrl !== undefined) data.signatureImageUrl = input.signatureImageUrl;
        if (input.stampImageUrl !== undefined) data.stampImageUrl = input.stampImageUrl;
        if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
        if (input.isActive !== undefined) data.isActive = input.isActive;
        if (input.dailyWageRate !== undefined) {
            data.dailyWageRate = input.dailyWageRate != null && input.dailyWageRate !== '' ? input.dailyWageRate as any : null;
        }
        if (input.overtimeRatePerHour !== undefined) {
            data.overtimeRatePerHour = input.overtimeRatePerHour != null && input.overtimeRatePerHour !== '' ? input.overtimeRatePerHour as any : null;
        }
        if (input.isPic !== undefined) {
            data.isPic = input.isPic;
            // Auto-generate token saat baru dijadikan PIC dan belum punya token
            if (input.isPic && !existing.picAccessToken) {
                data.picAccessToken = generatePicToken();
            }
            // Saat di-unset PIC, token tetap di-keep (jadi kalau di-toggle lagi token sama)
            // Kalau mau benar-benar invalidate, user harus klik Regenerate
        }
        if (input.picPin !== undefined) {
            const pin = input.picPin?.trim();
            data.picPin = pin || null;
        }
        if (input.teamId !== undefined) data.teamId = input.teamId;
        if (input.defaultCityKey !== undefined) data.defaultCityKey = input.defaultCityKey?.trim() || null;
        if (input.defaultDivisionKey !== undefined) data.defaultDivisionKey = input.defaultDivisionKey?.trim() || null;

        return this.prisma.worker.update({ where: { id }, data });
    }

    /** Generate ulang PIC access token (invalidate yang lama). Hanya untuk worker yang isPic=true. */
    async regeneratePicToken(id: number) {
        const w = await this.findOne(id);
        if (!w.isPic) {
            throw new BadRequestException('Worker bukan PIC. Aktifkan isPic dulu sebelum regenerate token.');
        }
        return this.prisma.worker.update({
            where: { id },
            data: { picAccessToken: generatePicToken() },
            select: { id: true, name: true, picAccessToken: true },
        });
    }

    async remove(id: number) {
        const existing = await this.findOne(id);
        const usage = existing._count.withdrawals;

        if (usage === 0) {
            await this.prisma.worker.delete({ where: { id } });
            return { mode: 'hard-delete', usage: 0 };
        }

        await this.prisma.worker.update({
            where: { id },
            data: { isActive: false },
        });
        return { mode: 'soft-delete', usage };
    }

    async restore(id: number) {
        await this.findOne(id);
        return this.prisma.worker.update({ where: { id }, data: { isActive: true } });
    }
}
