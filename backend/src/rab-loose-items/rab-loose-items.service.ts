import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface UpsertLooseItemInput {
    description: string;
    unit?: string;
    priceRab?: number | string;
    priceCost?: number | string;
    defaultCategory?: string;
    notes?: string;
}

export interface PromoteInput {
    productName: string;
    sku: string;
    categoryId: number;
    unitId: number;
    price?: number | string;
}

function dec(v: number | string | undefined | null, fallback = '0'): Prisma.Decimal {
    if (v === undefined || v === null || v === '') return new Prisma.Decimal(fallback);
    return new Prisma.Decimal(v as any);
}

@Injectable()
export class RabLooseItemsService {
    constructor(private prisma: PrismaService) { }

    private normalizeKey(s: string): string {
        const k = (s || '').trim().toLowerCase();
        if (!k) throw new BadRequestException('description tidak boleh kosong');
        return k;
    }

    async findAll(search?: string, limit = 20) {
        const where: Prisma.RabLooseItemWhereInput = search
            ? { description: { contains: search } }
            : {};
        return this.prisma.rabLooseItem.findMany({
            where,
            take: Math.min(Math.max(Number(limit) || 20, 1), 200),
            orderBy: [{ usageCount: 'desc' }, { lastUsedAt: 'desc' }],
            include: { promotedVariant: { include: { product: true } } },
        });
    }

    async suggestions(q: string) {
        const key = (q || '').trim().toLowerCase();
        if (!key) {
            return this.prisma.rabLooseItem.findMany({
                take: 8,
                orderBy: [{ usageCount: 'desc' }, { lastUsedAt: 'desc' }],
            });
        }
        return this.prisma.rabLooseItem.findMany({
            where: { normalizedKey: { contains: key } },
            take: 8,
            orderBy: [{ usageCount: 'desc' }, { lastUsedAt: 'desc' }],
        });
    }

    async upsert(input: UpsertLooseItemInput) {
        const key = this.normalizeKey(input.description);
        const description = input.description.trim();
        const existing = await this.prisma.rabLooseItem.findUnique({
            where: { normalizedKey: key },
        });

        const priceRab = dec(input.priceRab);
        const priceCost = dec(input.priceCost);

        if (existing) {
            return this.prisma.rabLooseItem.update({
                where: { id: existing.id },
                data: {
                    description,
                    unit: input.unit?.trim() || existing.unit,
                    lastPriceRab: priceRab.gt(0) ? priceRab : existing.lastPriceRab,
                    lastPriceCost: priceCost.gt(0) ? priceCost : existing.lastPriceCost,
                    defaultCategory: input.defaultCategory ?? existing.defaultCategory,
                    notes: input.notes ?? existing.notes,
                    usageCount: { increment: 1 },
                    lastUsedAt: new Date(),
                },
            });
        }

        return this.prisma.rabLooseItem.create({
            data: {
                description,
                normalizedKey: key,
                unit: input.unit?.trim() || null,
                lastPriceRab: priceRab,
                lastPriceCost: priceCost,
                defaultCategory: input.defaultCategory ?? null,
                notes: input.notes ?? null,
                usageCount: 1,
                lastUsedAt: new Date(),
            },
        });
    }

    async bulkUpsert(items: UpsertLooseItemInput[]) {
        const out: Array<{ description: string; id: number | null; error?: string }> = [];
        for (const it of items || []) {
            try {
                const rec = await this.upsert(it);
                out.push({ description: it.description, id: rec.id });
            } catch (err: any) {
                out.push({ description: it.description, id: null, error: err?.message || 'gagal' });
            }
        }
        return { saved: out };
    }

    async promote(id: number, input: PromoteInput) {
        const item = await this.prisma.rabLooseItem.findUnique({ where: { id } });
        if (!item) throw new NotFoundException(`RabLooseItem id=${id} tidak ditemukan`);
        if (item.promotedVariantId) {
            throw new BadRequestException('Item sudah dipromote ke katalog');
        }
        if (!input.productName?.trim()) throw new BadRequestException('productName wajib diisi');
        if (!input.sku?.trim()) throw new BadRequestException('sku wajib diisi');
        if (!input.categoryId) throw new BadRequestException('categoryId wajib diisi');
        if (!input.unitId) throw new BadRequestException('unitId wajib diisi');

        const skuExists = await this.prisma.productVariant.findUnique({
            where: { sku: input.sku.trim() },
        });
        if (skuExists) throw new BadRequestException(`SKU ${input.sku} sudah dipakai`);

        const price = dec(input.price ?? (item.lastPriceRab.toString() as any));

        return this.prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
                data: {
                    name: input.productName.trim(),
                    description: item.notes ?? null,
                    categoryId: input.categoryId,
                    unitId: input.unitId,
                    pricingMode: 'UNIT',
                    productType: 'SELLABLE',
                    pricePerUnit: price,
                    trackStock: false,
                },
            });

            const variant = await tx.productVariant.create({
                data: {
                    productId: product.id,
                    sku: input.sku.trim(),
                    variantName: item.description,
                    price,
                    hpp: item.lastPriceCost,
                    stock: 0,
                },
            });

            const looseItem = await tx.rabLooseItem.update({
                where: { id: item.id },
                data: { promotedVariantId: variant.id },
                include: { promotedVariant: { include: { product: true } } },
            });

            return { productId: product.id, variantId: variant.id, looseItem };
        });
    }

    async remove(id: number) {
        const item = await this.prisma.rabLooseItem.findUnique({ where: { id } });
        if (!item) throw new NotFoundException(`RabLooseItem id=${id} tidak ditemukan`);
        if (item.promotedVariantId) {
            throw new BadRequestException('Item sudah dipromote — tidak bisa dihapus');
        }
        await this.prisma.rabLooseItem.delete({ where: { id } });
        return { ok: true };
    }
}
