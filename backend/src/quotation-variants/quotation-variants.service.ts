import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface UpsertVariantInput {
    code: string;
    label: string;
    subject?: string | null;
    templateKey?: 'sewa' | 'pengadaan-booth';
    defaultDpPercent?: number | string;
    color?: string | null;
    description?: string | null;
    orderIndex?: number;
    isActive?: boolean;
}

const DEFAULT_VARIANTS: Array<Omit<UpsertVariantInput, 'isActive'>> = [
    {
        code: 'SEWA',
        label: 'Sewa Perlengkapan Event',
        subject: 'Penawaran Sewa Perlengkapan Event',
        templateKey: 'sewa',
        defaultDpPercent: 50,
        color: '#3b82f6',
        description: 'Sewa perlengkapan event (sound, lighting, panggung, dll)',
        orderIndex: 1,
    },
    {
        code: 'PENGADAAN_BOOTH',
        label: 'Pengadaan Booth Special Design',
        subject: 'Penawaran Pengadaan Booth Special Design',
        templateKey: 'pengadaan-booth',
        defaultDpPercent: 50,
        color: '#c8203a',
        description: 'Produksi booth custom design untuk pameran/event',
        orderIndex: 2,
    },
];

@Injectable()
export class QuotationVariantsService {
    constructor(private prisma: PrismaService) { }

    /** Auto-seed 2 default kalau table masih kosong, lalu return semua row. */
    async findAll(includeInactive = false) {
        const count = await this.prisma.quotationVariantConfig.count();
        if (count === 0) {
            await this.prisma.quotationVariantConfig.createMany({
                data: DEFAULT_VARIANTS.map((v) => ({
                    code: v.code,
                    label: v.label,
                    subject: v.subject ?? null,
                    templateKey: v.templateKey ?? 'pengadaan-booth',
                    defaultDpPercent: new Prisma.Decimal(v.defaultDpPercent ?? 50),
                    color: v.color ?? null,
                    description: v.description ?? null,
                    orderIndex: v.orderIndex ?? 0,
                    isActive: true,
                })),
            });
        }
        return this.prisma.quotationVariantConfig.findMany({
            where: includeInactive ? {} : { isActive: true },
            orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
        });
    }

    async findByCode(code: string) {
        const row = await this.prisma.quotationVariantConfig.findUnique({ where: { code } });
        if (!row) throw new NotFoundException(`Varian "${code}" tidak ditemukan`);
        return row;
    }

    async create(input: UpsertVariantInput) {
        if (!input.code?.trim()) throw new BadRequestException('Kode varian wajib diisi');
        if (!input.label?.trim()) throw new BadRequestException('Label wajib diisi');
        const code = input.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

        const exists = await this.prisma.quotationVariantConfig.findUnique({ where: { code } });
        if (exists) throw new BadRequestException(`Kode "${code}" sudah dipakai. Pilih kode lain.`);

        return this.prisma.quotationVariantConfig.create({
            data: {
                code,
                label: input.label.trim(),
                subject: input.subject?.trim() || null,
                templateKey: input.templateKey ?? 'pengadaan-booth',
                defaultDpPercent: new Prisma.Decimal(input.defaultDpPercent ?? 50),
                color: input.color?.trim() || null,
                description: input.description?.trim() || null,
                orderIndex: input.orderIndex ?? 0,
                isActive: input.isActive ?? true,
            },
        });
    }

    async update(id: number, input: Partial<UpsertVariantInput>) {
        const existing = await this.prisma.quotationVariantConfig.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Varian id=${id} tidak ditemukan`);

        // Code can be edited only if no quotation has used it yet
        if (input.code !== undefined && input.code.trim().toUpperCase() !== existing.code) {
            const used = await this.prisma.invoice.count({ where: { variantCode: existing.code } });
            if (used > 0) {
                throw new BadRequestException(
                    `Kode "${existing.code}" tidak bisa diubah karena sudah dipakai ${used} quotation. Buat varian baru saja.`,
                );
            }
        }

        const data: Prisma.QuotationVariantConfigUpdateInput = {};
        if (input.code !== undefined) {
            data.code = input.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        }
        if (input.label !== undefined) data.label = input.label.trim();
        if (input.subject !== undefined) data.subject = input.subject?.trim() || null;
        if (input.templateKey !== undefined) data.templateKey = input.templateKey;
        if (input.defaultDpPercent !== undefined) data.defaultDpPercent = new Prisma.Decimal(input.defaultDpPercent);
        if (input.color !== undefined) data.color = input.color?.trim() || null;
        if (input.description !== undefined) data.description = input.description?.trim() || null;
        if (input.orderIndex !== undefined) data.orderIndex = input.orderIndex;
        if (input.isActive !== undefined) data.isActive = input.isActive;

        return this.prisma.quotationVariantConfig.update({ where: { id }, data });
    }

    async remove(id: number) {
        const existing = await this.prisma.quotationVariantConfig.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Varian id=${id} tidak ditemukan`);

        const used = await this.prisma.invoice.count({ where: { variantCode: existing.code } });
        if (used > 0) {
            // Soft-delete kalau sudah dipakai
            return this.prisma.quotationVariantConfig.update({
                where: { id },
                data: { isActive: false },
            });
        }

        await this.prisma.quotationVariantConfig.delete({ where: { id } });
        return { ok: true, mode: 'hard-delete' };
    }
}
