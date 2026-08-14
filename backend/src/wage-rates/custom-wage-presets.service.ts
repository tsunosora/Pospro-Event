import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CustomWagePresetInput {
    label: string;
    amount: number | string; // boleh negatif (− = potong)
    notes?: string | null;
    isActive?: boolean;
    sortOrder?: number;
}

@Injectable()
export class CustomWagePresetsService {
    constructor(private prisma: PrismaService) { }

    async list(includeInactive = true) {
        return this.prisma.customWagePreset.findMany({
            where: includeInactive ? {} : { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
        });
    }

    async findOne(id: number) {
        const r = await this.prisma.customWagePreset.findUnique({ where: { id } });
        if (!r) throw new NotFoundException(`Preset id=${id} tidak ditemukan`);
        return r;
    }

    private parse(input: CustomWagePresetInput) {
        const label = input.label?.trim();
        if (!label) throw new BadRequestException('Nama preset wajib diisi');
        const amount = Number(input.amount);
        if (Number.isNaN(amount)) throw new BadRequestException('Nominal invalid');
        if (amount === 0) throw new BadRequestException('Nominal tidak boleh 0');
        return {
            label,
            amount: amount as any,
            notes: input.notes?.trim() || null,
            isActive: input.isActive ?? true,
            sortOrder: input.sortOrder ?? 0,
        };
    }

    async create(input: CustomWagePresetInput) {
        return this.prisma.customWagePreset.create({ data: this.parse(input) });
    }

    async update(id: number, input: Partial<CustomWagePresetInput>) {
        await this.findOne(id);
        const data: Prisma.CustomWagePresetUpdateInput = {};
        if (input.label !== undefined) {
            const label = input.label.trim();
            if (!label) throw new BadRequestException('Nama preset wajib diisi');
            data.label = label;
        }
        if (input.amount !== undefined) {
            const n = Number(input.amount);
            if (Number.isNaN(n)) throw new BadRequestException('Nominal invalid');
            if (n === 0) throw new BadRequestException('Nominal tidak boleh 0');
            data.amount = n as any;
        }
        if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
        if (input.isActive !== undefined) data.isActive = input.isActive;
        if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
        return this.prisma.customWagePreset.update({ where: { id }, data });
    }

    async remove(id: number) {
        await this.findOne(id);
        return this.prisma.customWagePreset.delete({ where: { id } });
    }
}
