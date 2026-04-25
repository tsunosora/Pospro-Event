import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateWarehouseInput {
    name: string;
    address?: string;
    notes?: string;
    isActive?: boolean;
}

export interface UpdateWarehouseInput {
    name?: string;
    address?: string;
    notes?: string;
    isActive?: boolean;
}

@Injectable()
export class WarehousesService {
    constructor(private prisma: PrismaService) { }

    async findAll(includeInactive = false) {
        return this.prisma.warehouse.findMany({
            where: includeInactive ? {} : { isActive: true },
            orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
            include: {
                _count: { select: { withdrawals: true } },
            },
        });
    }

    async findOne(id: number) {
        const wh = await this.prisma.warehouse.findUnique({
            where: { id },
            include: {
                _count: { select: { withdrawals: true } },
            },
        });
        if (!wh) throw new NotFoundException(`Gudang id=${id} tidak ditemukan`);
        return wh;
    }

    async create(input: CreateWarehouseInput) {
        const name = input.name.trim();
        if (!name) throw new BadRequestException('Nama gudang wajib diisi');

        const exists = await this.prisma.warehouse.findUnique({ where: { name } });
        if (exists) throw new ConflictException(`Gudang "${name}" sudah ada`);

        return this.prisma.warehouse.create({
            data: {
                name,
                address: input.address?.trim() || null,
                notes: input.notes?.trim() || null,
                isActive: input.isActive ?? true,
            },
        });
    }

    async update(id: number, input: UpdateWarehouseInput) {
        const existing = await this.findOne(id);

        const data: any = {};
        if (input.name !== undefined) {
            const name = input.name.trim();
            if (!name) throw new BadRequestException('Nama gudang wajib diisi');
            if (name !== existing.name) {
                const dup = await this.prisma.warehouse.findUnique({ where: { name } });
                if (dup) throw new ConflictException(`Gudang "${name}" sudah ada`);
                data.name = name;
            }
        }
        if (input.address !== undefined) data.address = input.address?.trim() || null;
        if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
        if (input.isActive !== undefined) data.isActive = input.isActive;

        return this.prisma.warehouse.update({ where: { id }, data });
    }

    async remove(id: number) {
        const existing = await this.findOne(id);
        const usage = existing._count.withdrawals;

        if (usage === 0) {
            await this.prisma.warehouse.delete({ where: { id } });
            return { mode: 'hard-delete', usage: 0 };
        }

        await this.prisma.warehouse.update({
            where: { id },
            data: { isActive: false },
        });
        return { mode: 'soft-delete', usage };
    }

    async restore(id: number) {
        await this.findOne(id);
        return this.prisma.warehouse.update({
            where: { id },
            data: { isActive: true },
        });
    }
}
