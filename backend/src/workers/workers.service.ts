import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateWorkerInput {
    name: string;
    position?: string;
    phone?: string;
    photoUrl?: string;
    notes?: string;
    isActive?: boolean;
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
            },
        });
    }

    async findOne(id: number) {
        const w = await this.prisma.worker.findUnique({
            where: { id },
            include: { _count: { select: { withdrawals: true } } },
        });
        if (!w) throw new NotFoundException(`Pekerja id=${id} tidak ditemukan`);
        return w;
    }

    async create(input: CreateWorkerInput) {
        const name = input.name?.trim();
        if (!name) throw new BadRequestException('Nama pekerja wajib diisi');

        return this.prisma.worker.create({
            data: {
                name,
                position: input.position?.trim() || null,
                phone: input.phone?.trim() || null,
                photoUrl: input.photoUrl || null,
                notes: input.notes?.trim() || null,
                isActive: input.isActive ?? true,
            },
        });
    }

    async update(id: number, input: UpdateWorkerInput) {
        await this.findOne(id);

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

        return this.prisma.worker.update({ where: { id }, data });
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
