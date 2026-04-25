import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateStorageLocationInput {
    warehouseId: number;
    code: string;
    name: string;
    notes?: string | null;
    isActive?: boolean;
}
export interface UpdateStorageLocationInput extends Partial<CreateStorageLocationInput> { }

@Injectable()
export class StorageLocationsService {
    constructor(private prisma: PrismaService) { }

    findAll(warehouseId?: number, includeInactive = false) {
        return this.prisma.storageLocation.findMany({
            where: {
                ...(warehouseId ? { warehouseId } : {}),
                ...(includeInactive ? {} : { isActive: true }),
            },
            orderBy: [{ warehouseId: 'asc' }, { code: 'asc' }],
            include: { warehouse: { select: { id: true, name: true } } },
        });
    }

    async findOne(id: number) {
        const loc = await this.prisma.storageLocation.findUnique({
            where: { id },
            include: { warehouse: { select: { id: true, name: true } } },
        });
        if (!loc) throw new NotFoundException(`Lokasi id=${id} tidak ditemukan`);
        return loc;
    }

    async create(input: CreateStorageLocationInput) {
        const code = input.code?.trim();
        const name = input.name?.trim();
        if (!code) throw new BadRequestException('Kode lokasi wajib diisi');
        if (!name) throw new BadRequestException('Nama lokasi wajib diisi');
        if (!input.warehouseId) throw new BadRequestException('Gudang wajib dipilih');

        const wh = await this.prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
        if (!wh) throw new BadRequestException('Gudang tidak ditemukan');

        return this.prisma.storageLocation.create({
            data: {
                warehouseId: input.warehouseId,
                code,
                name,
                notes: input.notes?.trim() || null,
                isActive: input.isActive ?? true,
            },
            include: { warehouse: { select: { id: true, name: true } } },
        });
    }

    async update(id: number, input: UpdateStorageLocationInput) {
        await this.findOne(id);
        const data: any = {};
        if (input.warehouseId !== undefined) data.warehouseId = input.warehouseId;
        if (input.code !== undefined) {
            const c = input.code.trim();
            if (!c) throw new BadRequestException('Kode lokasi wajib diisi');
            data.code = c;
        }
        if (input.name !== undefined) {
            const n = input.name.trim();
            if (!n) throw new BadRequestException('Nama lokasi wajib diisi');
            data.name = n;
        }
        if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
        if (input.isActive !== undefined) data.isActive = input.isActive;
        return this.prisma.storageLocation.update({
            where: { id },
            data,
            include: { warehouse: { select: { id: true, name: true } } },
        });
    }

    async remove(id: number) {
        const loc = await this.prisma.storageLocation.findUnique({
            where: { id },
            include: { _count: { select: { packingItems: true } } },
        });
        if (!loc) throw new NotFoundException(`Lokasi id=${id} tidak ditemukan`);
        if (loc._count.packingItems > 0) {
            // soft delete
            await this.prisma.storageLocation.update({
                where: { id },
                data: { isActive: false },
            });
            return { ok: true, softDeleted: true };
        }
        await this.prisma.storageLocation.delete({ where: { id } });
        return { ok: true, softDeleted: false };
    }
}
