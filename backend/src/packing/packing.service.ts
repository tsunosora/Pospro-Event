import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PackingDisposition, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentNumberService } from '../document-numbers/document-number.service';

export interface CreatePackingItemInput {
    productVariantId: number;
    quantity: number;
    storageLocationId?: number | null;
    locationNote?: string | null;
    notes?: string | null;
    orderIndex?: number;
}

export interface UpdatePackingItemInput extends Partial<CreatePackingItemInput> {
    isChecked?: boolean;
    disposition?: PackingDisposition | null;
}

const INCLUDE = {
    productVariant: {
        select: {
            id: true, sku: true, variantName: true, stock: true, price: true,
            product: { select: { id: true, name: true, categoryId: true } },
        },
    },
    storageLocation: {
        select: { id: true, code: true, name: true, warehouse: { select: { id: true, name: true } } },
    },
    checkedBy: { select: { id: true, name: true } },
} as const;

const CATEGORY_KEY: Record<PackingDisposition, string> = {
    PINJAM: 'PERLENGKAPAN',
    OPERASIONAL: 'LAIN_LAIN',
};

@Injectable()
export class PackingService {
    constructor(
        private prisma: PrismaService,
        private docNumberService: DocumentNumberService,
    ) { }

    async listForEvent(eventId: number) {
        await this.assertEventExists(eventId);
        return this.prisma.eventPackingItem.findMany({
            where: { eventId },
            orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
            include: INCLUDE,
        });
    }

    async summary(eventId: number) {
        const items = await this.listForEvent(eventId);
        const total = items.length;
        const checked = items.filter(i => i.isChecked).length;
        return { total, checked, pending: total - checked };
    }

    async create(eventId: number, input: CreatePackingItemInput) {
        await this.assertEventExists(eventId);
        if (!input.productVariantId) throw new BadRequestException('Produk wajib dipilih');
        const qty = Number(input.quantity);
        if (!qty || qty <= 0) throw new BadRequestException('Qty harus > 0');
        if (input.storageLocationId) {
            const loc = await this.prisma.storageLocation.findUnique({ where: { id: input.storageLocationId } });
            if (!loc) throw new BadRequestException('Lokasi tidak ditemukan');
        }
        const maxOrder = await this.prisma.eventPackingItem.aggregate({
            where: { eventId },
            _max: { orderIndex: true },
        });
        return this.prisma.eventPackingItem.create({
            data: {
                eventId,
                productVariantId: input.productVariantId,
                quantity: qty,
                storageLocationId: input.storageLocationId ?? null,
                locationNote: input.locationNote?.trim() || null,
                notes: input.notes?.trim() || null,
                orderIndex: input.orderIndex ?? ((maxOrder._max.orderIndex ?? 0) + 1),
            },
            include: INCLUDE,
        });
    }

    async bulkCreate(eventId: number, items: CreatePackingItemInput[]) {
        await this.assertEventExists(eventId);
        const created = [];
        for (const it of items) created.push(await this.create(eventId, it));
        return created;
    }

    async update(id: number, input: UpdatePackingItemInput, workerId?: number | null) {
        const item = await this.prisma.eventPackingItem.findUnique({ where: { id } });
        if (!item) throw new NotFoundException('Item packing tidak ditemukan');

        const data: Prisma.EventPackingItemUpdateInput = {};
        if (input.productVariantId !== undefined) {
            data.productVariant = { connect: { id: input.productVariantId } };
        }
        if (input.quantity !== undefined) {
            const q = Number(input.quantity);
            if (!q || q <= 0) throw new BadRequestException('Qty harus > 0');
            data.quantity = q;
        }
        if (input.storageLocationId !== undefined) {
            data.storageLocation = input.storageLocationId
                ? { connect: { id: input.storageLocationId } }
                : { disconnect: true };
        }
        if (input.locationNote !== undefined) data.locationNote = input.locationNote?.trim() || null;
        if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
        if (input.orderIndex !== undefined) data.orderIndex = input.orderIndex;

        const willCheck = input.isChecked !== undefined && input.isChecked !== item.isChecked;
        if (willCheck) {
            data.isChecked = input.isChecked!;
            if (input.isChecked) {
                if (!input.disposition) {
                    throw new BadRequestException('Pilih klasifikasi: PINJAM atau OPERASIONAL');
                }
                data.disposition = input.disposition;
                data.checkedAt = new Date();
                if (workerId) data.checkedBy = { connect: { id: workerId } };
            } else {
                data.disposition = null;
                data.checkedAt = null;
                data.checkedBy = { disconnect: true };
            }
        } else if (input.disposition !== undefined && item.isChecked) {
            data.disposition = input.disposition;
        }

        const updated = await this.prisma.eventPackingItem.update({ where: { id }, data, include: INCLUDE });

        if (willCheck) {
            if (input.isChecked) {
                await this.syncRabItemForPacking(updated);
            } else {
                await this.removeRabItemForPacking(id);
            }
        } else if (input.disposition !== undefined && item.isChecked) {
            await this.removeRabItemForPacking(id);
            await this.syncRabItemForPacking(updated);
        }

        return updated;
    }

    async setChecked(id: number, isChecked: boolean, workerId?: number | null, disposition?: PackingDisposition | null) {
        return this.update(id, { isChecked, disposition: disposition ?? null }, workerId);
    }

    async bulkSetChecked(eventId: number, ids: number[], isChecked: boolean, workerId?: number | null, disposition?: PackingDisposition | null) {
        await this.assertEventExists(eventId);
        const updated = [];
        for (const id of ids) updated.push(await this.setChecked(id, isChecked, workerId, disposition));
        return updated;
    }

    async remove(id: number) {
        const item = await this.prisma.eventPackingItem.findUnique({ where: { id } });
        if (!item) throw new NotFoundException('Item packing tidak ditemukan');
        await this.removeRabItemForPacking(id);
        await this.prisma.eventPackingItem.delete({ where: { id } });
        return { ok: true };
    }

    async prefillWithdrawal(eventId: number, onlyChecked = true) {
        const ev = await this.prisma.event.findUnique({ where: { id: eventId } });
        if (!ev) throw new NotFoundException('Event tidak ditemukan');
        const where: Prisma.EventPackingItemWhereInput = { eventId };
        if (onlyChecked) {
            where.isChecked = true;
            where.disposition = 'PINJAM';
        }
        const items = await this.prisma.eventPackingItem.findMany({
            where,
            orderBy: [{ orderIndex: 'asc' }],
            include: INCLUDE,
        });
        return {
            eventId,
            eventCode: ev.code,
            eventName: ev.name,
            suggestedPurpose: `Event: ${ev.name} (${ev.code})`,
            items: items.map((i) => ({
                productVariantId: i.productVariantId,
                quantity: Number(i.quantity),
                sku: i.productVariant.sku,
                productName: i.productVariant.product.name,
                variantName: i.productVariant.variantName,
                stock: i.productVariant.stock,
                storageLocation: i.storageLocation
                    ? `${i.storageLocation.warehouse.name} — ${i.storageLocation.code} ${i.storageLocation.name}`
                    : null,
                locationNote: i.locationNote,
                packingItemId: i.id,
            })),
        };
    }

    // --- RAB integration helpers ---

    private async ensureRabPlanForEvent(eventId: number): Promise<number> {
        const ev = await this.prisma.event.findUnique({
            where: { id: eventId },
            select: { id: true, rabPlanId: true, name: true, venue: true, customerId: true, eventStart: true, eventEnd: true },
        });
        if (!ev) throw new NotFoundException('Event tidak ditemukan');
        if (ev.rabPlanId) return ev.rabPlanId;

        const year = (ev.eventStart ?? new Date()).getFullYear();
        const seq = await this.docNumberService.nextSequence('RAB', 'RAB', year);
        const code = `RAB-${year}-${seq.toString().padStart(4, '0')}`;

        const plan = await this.prisma.rabPlan.create({
            data: {
                code,
                title: ev.name,
                projectName: ev.name,
                location: ev.venue ?? null,
                periodStart: ev.eventStart ?? null,
                periodEnd: ev.eventEnd ?? null,
                customerId: ev.customerId ?? null,
                notes: `Auto-dibuat dari Event #${ev.id}`,
            },
        });
        await this.prisma.event.update({ where: { id: eventId }, data: { rabPlanId: plan.id } });
        return plan.id;
    }

    private async resolveCategoryId(key: string): Promise<number> {
        const cat = await this.prisma.rabCategory.findUnique({ where: { key } });
        if (cat) return cat.id;
        // fallback: ambil kategori pertama (seharusnya tidak terjadi kalau seed sudah jalan)
        const any = await this.prisma.rabCategory.findFirst({ orderBy: { orderIndex: 'asc' } });
        if (!any) throw new BadRequestException('Kategori RAB belum di-seed. Jalankan seed dulu.');
        return any.id;
    }

    private async syncRabItemForPacking(item: {
        id: number;
        eventId: number;
        productVariantId: number;
        quantity: Prisma.Decimal;
        disposition: PackingDisposition | null;
        productVariant: { sku: string; variantName: string | null; price: Prisma.Decimal; product: { name: string } };
    }) {
        if (!item.disposition) return;
        const planId = await this.ensureRabPlanForEvent(item.eventId);
        const categoryId = await this.resolveCategoryId(CATEGORY_KEY[item.disposition]);
        const unitPrice = Number(item.productVariant.price ?? 0);
        const qty = Number(item.quantity);
        const desc = `${item.productVariant.product.name}${item.productVariant.variantName ? ` — ${item.productVariant.variantName}` : ''} (${item.productVariant.sku})`;

        const maxOrder = await this.prisma.rabItem.aggregate({
            where: { rabPlanId: planId, categoryId },
            _max: { orderIndex: true },
        });

        await this.prisma.rabItem.create({
            data: {
                rabPlanId: planId,
                categoryId,
                description: desc,
                quantity: qty,
                quantityCost: qty,
                priceRab: unitPrice,
                priceCost: unitPrice,
                productVariantId: item.productVariantId,
                sourcePackingItemId: item.id,
                orderIndex: (maxOrder._max.orderIndex ?? 0) + 1,
                notes: `Auto dari packing item #${item.id} (${item.disposition})`,
            },
        });
    }

    private async removeRabItemForPacking(packingItemId: number) {
        await this.prisma.rabItem.deleteMany({ where: { sourcePackingItemId: packingItemId } });
    }

    private async assertEventExists(eventId: number) {
        const ev = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
        if (!ev) throw new NotFoundException('Event tidak ditemukan');
    }
}
