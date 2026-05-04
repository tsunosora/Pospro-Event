import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PayrollAdjustmentType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AdjustmentInput {
    workerId: number;
    type: PayrollAdjustmentType;
    amount: number | string;
    effectiveDate: string;          // YYYY-MM-DD
    notes?: string | null;
}

@Injectable()
export class PayrollAdjustmentsService {
    constructor(private prisma: PrismaService) { }

    private parseDate(input: string): Date {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
        if (!m) throw new BadRequestException(`Format tanggal invalid: ${input}`);
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
    }

    async list(params: { from?: string; to?: string; workerId?: number; type?: PayrollAdjustmentType }) {
        const where: Prisma.PayrollAdjustmentWhereInput = {};
        if (params.workerId) where.workerId = params.workerId;
        if (params.type) where.type = params.type;
        if (params.from || params.to) {
            where.effectiveDate = {};
            if (params.from) (where.effectiveDate as any).gte = this.parseDate(params.from);
            if (params.to) (where.effectiveDate as any).lte = this.parseDate(params.to);
        }
        return this.prisma.payrollAdjustment.findMany({
            where,
            orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
            include: {
                worker: { select: { id: true, name: true, position: true } },
                createdBy: { select: { id: true, name: true, email: true } },
            },
        });
    }

    async create(input: AdjustmentInput, actorAdminId: number | null) {
        const amount = Number(input.amount);
        if (Number.isNaN(amount) || amount <= 0) {
            throw new BadRequestException('Jumlah harus angka positif (sign ditentukan oleh tipe).');
        }
        if (!input.workerId) throw new BadRequestException('Worker wajib dipilih');

        return this.prisma.payrollAdjustment.create({
            data: {
                workerId: input.workerId,
                type: input.type,
                amount: amount as any,
                effectiveDate: this.parseDate(input.effectiveDate),
                notes: input.notes?.trim() || null,
                createdById: actorAdminId ?? null,
            },
            include: {
                worker: { select: { id: true, name: true, position: true } },
                createdBy: { select: { id: true, name: true, email: true } },
            },
        });
    }

    async update(id: number, input: Partial<AdjustmentInput>) {
        const existing = await this.prisma.payrollAdjustment.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Adjustment id=${id} tidak ditemukan`);
        const data: Prisma.PayrollAdjustmentUpdateInput = {};
        if (input.type !== undefined) data.type = input.type;
        if (input.amount !== undefined) {
            const n = Number(input.amount);
            if (Number.isNaN(n) || n <= 0) throw new BadRequestException('Jumlah invalid');
            data.amount = n as any;
        }
        if (input.effectiveDate !== undefined) data.effectiveDate = this.parseDate(input.effectiveDate);
        if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
        return this.prisma.payrollAdjustment.update({ where: { id }, data });
    }

    async remove(id: number) {
        return this.prisma.payrollAdjustment.delete({ where: { id } });
    }
}
