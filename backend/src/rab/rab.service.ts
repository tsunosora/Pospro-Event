import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, InvoiceType, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentNumberService } from '../document-numbers/document-number.service';
import { RabLooseItemsService } from '../rab-loose-items/rab-loose-items.service';
import type { CreateRabDto, UpdateRabDto } from './dto/create-rab.dto';
import type { RabItemInput } from './dto/rab-item.dto';

function dec(v: number | string | undefined | null, fallback = '0'): Prisma.Decimal {
    if (v === undefined || v === null || v === '') return new Prisma.Decimal(fallback);
    return new Prisma.Decimal(v as any);
}

@Injectable()
export class RabService {
    constructor(
        private prisma: PrismaService,
        private docNumberService: DocumentNumberService,
        private looseItemsService: RabLooseItemsService,
    ) { }

    private async persistLooseItems(items: RabItemInput[] | undefined) {
        if (!items?.length) return;
        const looseInputs = items
            .filter(
                (it) =>
                    it.saveAsLoose === true &&
                    (it.productVariantId === null || it.productVariantId === undefined) &&
                    !!(it.description ?? '').trim(),
            )
            .map((it) => ({
                description: it.description,
                unit: it.unit ?? undefined,
                priceRab: it.priceRab,
                priceCost: it.priceCost,
            }));
        if (looseInputs.length === 0) return;
        try {
            await this.looseItemsService.bulkUpsert(looseInputs);
        } catch {
            // jangan gagalkan save RAB hanya karena loose-item bermasalah
        }
    }

    /**
     * Sinkron InventoryAcquisition dengan RabItem.isInventory.
     * Untuk setiap RabItem dengan isInventory=true:
     *   - upsert acquisition (create kalau belum ada, update kalau sudah)
     *   - status PENDING (belum di-stok) — kecuali sudah STORED, biarkan
     * Untuk RabItem.isInventory=false:
     *   - kalau ada acquisition existing yang belum STORED, hapus
     *   - kalau status STORED, biarkan (sudah masuk stok, gak boleh hilangkan)
     */
    private async syncInventoryAcquisitions(rabPlanId: number) {
        const items = await this.prisma.rabItem.findMany({
            where: { rabPlanId },
            include: { inventoryAcquisition: true },
        });

        for (const it of items) {
            const totalCost = Number(it.quantityCost) * Number(it.priceCost);

            if (it.isInventory) {
                // Upsert acquisition
                if (it.inventoryAcquisition) {
                    // Skip kalau sudah STORED — angka snapshot saat di-stok itu yang valid
                    if (it.inventoryAcquisition.status === 'STORED') continue;
                    await this.prisma.inventoryAcquisition.update({
                        where: { id: it.inventoryAcquisition.id },
                        data: {
                            description: it.description,
                            quantity: it.quantityCost,
                            unit: it.unit,
                            unitCost: it.priceCost,
                            totalCost: new (require('@prisma/client').Prisma.Decimal)(totalCost),
                        },
                    });
                } else {
                    await this.prisma.inventoryAcquisition.create({
                        data: {
                            rabPlanId,
                            rabItemId: it.id,
                            description: it.description,
                            quantity: it.quantityCost,
                            unit: it.unit,
                            unitCost: it.priceCost,
                            totalCost: new (require('@prisma/client').Prisma.Decimal)(totalCost),
                            status: 'PENDING',
                        },
                    });
                }
            } else {
                // Item tidak lagi inventaris → hapus acquisition kalau belum STORED
                if (it.inventoryAcquisition && it.inventoryAcquisition.status !== 'STORED') {
                    await this.prisma.inventoryAcquisition.delete({
                        where: { id: it.inventoryAcquisition.id },
                    });
                }
            }
        }
    }

    private async nextCode(year: number): Promise<string> {
        const seq = await this.docNumberService.nextSequence('RAB', 'RAB', year);
        return `RAB-${year}-${seq.toString().padStart(4, '0')}`;
    }

    async create(dto: CreateRabDto) {
        if (!dto.title) throw new BadRequestException('title wajib diisi');
        const year = dto.periodStart ? new Date(dto.periodStart).getFullYear() : new Date().getFullYear();
        const code = await this.nextCode(year);

        const created = await this.prisma.rabPlan.create({
            data: {
                code,
                title: dto.title,
                projectName: dto.projectName,
                location: dto.location,
                periodStart: dto.periodStart ? new Date(dto.periodStart) : null,
                periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
                customerId: dto.customerId ?? null,
                brand: dto.brand ?? null,
                dpAmount: dec(dto.dpAmount),
                pelunasan: dec(dto.pelunasan),
                incomeOther: dec(dto.incomeOther),
                notes: dto.notes,
                tags: dto.tags && dto.tags.length > 0 ? JSON.stringify(dto.tags.map(t => t.trim()).filter(Boolean)) : null,
                items: {
                    create: (dto.items ?? []).map((it, idx) => ({
                        categoryId: it.categoryId,
                        description: it.description,
                        unit: it.unit,
                        quantity: dec(it.quantity, '1'),
                        quantityCost: dec(it.quantityCost ?? it.quantity, '1'),
                        priceRab: dec(it.priceRab),
                        priceCost: dec(it.priceCost),
                        orderIndex: it.orderIndex ?? idx,
                        productVariantId: it.productVariantId ?? null,
                        notes: it.notes,
                        isInventory: it.isInventory ?? false,
                    })),
                },
            },
            include: { items: { include: { category: true } }, customer: true },
        });
        await this.persistLooseItems(dto.items);
        await this.syncInventoryAcquisitions(created.id);
        return created;
    }

    /**
     * Return distinct tags (from semua RabPlan.tags JSON), sorted by frequency desc.
     * Untuk autocomplete saat user input tag baru.
     */
    async getAllTags(): Promise<{ tag: string; count: number }[]> {
        const rabs = await this.prisma.rabPlan.findMany({
            where: { tags: { not: null } },
            select: { tags: true },
        });
        const counter = new Map<string, number>();
        for (const r of rabs) {
            if (!r.tags) continue;
            try {
                const arr = JSON.parse(r.tags);
                if (Array.isArray(arr)) {
                    for (const t of arr) {
                        if (typeof t === 'string' && t.trim()) {
                            const k = t.trim();
                            counter.set(k, (counter.get(k) ?? 0) + 1);
                        }
                    }
                }
            } catch { /* skip invalid */ }
        }
        return Array.from(counter.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    }

    findAll() {
        return this.prisma.rabPlan.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                customer: true,
                items: {
                    select: { id: true, categoryId: true, quantity: true, quantityCost: true, priceRab: true, priceCost: true },
                },
            },
        });
    }

    async findOne(id: number) {
        const rab = await this.prisma.rabPlan.findUnique({
            where: { id },
            include: {
                items: {
                    include: { category: true },
                    orderBy: [{ categoryId: 'asc' }, { orderIndex: 'asc' }],
                },
                customer: true,
            },
        });
        if (!rab) throw new NotFoundException(`RAB id=${id} tidak ditemukan`);
        return rab;
    }

    async update(id: number, dto: UpdateRabDto) {
        await this.findOne(id);
        const result = await this.prisma.$transaction(async (tx) => {
            if (dto.items !== undefined) {
                await tx.rabItem.deleteMany({ where: { rabPlanId: id } });
            }
            await tx.rabPlan.update({
                where: { id },
                data: {
                    ...(dto.title !== undefined ? { title: dto.title } : {}),
                    ...(dto.projectName !== undefined ? { projectName: dto.projectName } : {}),
                    ...(dto.location !== undefined ? { location: dto.location } : {}),
                    ...(dto.periodStart !== undefined
                        ? { periodStart: dto.periodStart ? new Date(dto.periodStart) : null }
                        : {}),
                    ...(dto.periodEnd !== undefined
                        ? { periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null }
                        : {}),
                    ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
                    ...(dto.brand !== undefined ? { brand: dto.brand } : {}),
                    ...(dto.dpAmount !== undefined ? { dpAmount: dec(dto.dpAmount) } : {}),
                    ...(dto.pelunasan !== undefined ? { pelunasan: dec(dto.pelunasan) } : {}),
                    ...(dto.incomeOther !== undefined ? { incomeOther: dec(dto.incomeOther) } : {}),
                    ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
                    ...(dto.tags !== undefined
                        ? { tags: dto.tags.length > 0 ? JSON.stringify(dto.tags.map(t => t.trim()).filter(Boolean)) : null }
                        : {}),
                    ...(dto.items !== undefined
                        ? {
                            items: {
                                create: dto.items.map((it: RabItemInput, idx: number) => ({
                                    categoryId: it.categoryId,
                                    description: it.description,
                                    unit: it.unit,
                                    quantity: dec(it.quantity, '1'),
                                    quantityCost: dec(it.quantityCost ?? it.quantity, '1'),
                                    priceRab: dec(it.priceRab),
                                    priceCost: dec(it.priceCost),
                                    orderIndex: it.orderIndex ?? idx,
                                    productVariantId: it.productVariantId ?? null,
                                    notes: it.notes,
                                    isInventory: it.isInventory ?? false,
                                })),
                            },
                        }
                        : {}),
                },
            });
            return tx.rabPlan.findUnique({
                where: { id },
                include: {
                    items: {
                        include: { category: true },
                        orderBy: [{ categoryId: 'asc' }, { orderIndex: 'asc' }],
                    },
                    customer: true,
                },
            });
        });
        await this.persistLooseItems(dto.items);
        await this.syncInventoryAcquisitions(id);
        return result;
    }

    async summary(id: number) {
        const rab = await this.findOne(id);

        // Ambil semua kategori (termasuk inactive) untuk menjamin label tetap muncul
        // bila item lama menggunakan kategori yang sudah di-soft-delete.
        const allCategories = await this.prisma.rabCategory.findMany({
            orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
        });

        const totals = new Map<number, { subtotalRab: number; subtotalCost: number; count: number }>();
        for (const cat of allCategories) {
            totals.set(cat.id, { subtotalRab: 0, subtotalCost: 0, count: 0 });
        }

        let totalCostInventory = 0;  // cost dari item yang ditandai inventaris
        let countInventory = 0;
        for (const it of rab.items as any[]) {
            const cid = it.categoryId as number;
            const qRab = Number(it.quantity);
            const qCost = Number(it.quantityCost ?? it.quantity);
            const r = Number(it.priceRab);
            const c = Number(it.priceCost);
            const itemCost = qCost * c;
            const slot = totals.get(cid);
            if (slot) {
                slot.subtotalRab += qRab * r;
                slot.subtotalCost += itemCost;
                slot.count += 1;
            }
            if (it.isInventory) {
                totalCostInventory += itemCost;
                countInventory += 1;
            }
        }

        const totalRab = Array.from(totals.values()).reduce((s, c) => s + c.subtotalRab, 0);
        const totalCost = Array.from(totals.values()).reduce((s, c) => s + c.subtotalCost, 0);
        const totalSelisih = totalRab - totalCost;
        // Cost operasional = cost total minus inventaris (barang aset perusahaan)
        const costOperational = totalCost - totalCostInventory;
        const operationalProfit = totalRab - costOperational;

        const totalIncome =
            Number(rab.dpAmount) + Number(rab.pelunasan) + Number(rab.incomeOther);
        const saldo = totalIncome - totalCost;

        return {
            id: rab.id,
            code: rab.code,
            title: rab.title,
            categories: allCategories.map((cat) => {
                const t = totals.get(cat.id)!;
                return {
                    categoryId: cat.id,
                    categoryName: cat.name,
                    categoryKey: cat.key,
                    isActive: cat.isActive,
                    subtotalRab: t.subtotalRab,
                    subtotalCost: t.subtotalCost,
                    selisih: t.subtotalRab - t.subtotalCost,
                    count: t.count,
                };
            }),
            totals: {
                totalRab,
                totalCost,
                totalSelisih,
                costInventory: totalCostInventory,
                costOperational,
                operationalProfit,
                inventoryCount: countInventory,
            },
            income: {
                dpAmount: Number(rab.dpAmount),
                pelunasan: Number(rab.pelunasan),
                incomeOther: Number(rab.incomeOther),
                totalIncome,
            },
            saldo,
        };
    }

    async duplicate(id: number, overrides: { title?: string; location?: string; periodStart?: string; periodEnd?: string } = {}) {
        const src = await this.findOne(id);
        const year = overrides.periodStart ? new Date(overrides.periodStart).getFullYear() : new Date().getFullYear();
        const code = await this.nextCode(year);

        return this.prisma.rabPlan.create({
            data: {
                code,
                title: overrides.title ?? `${src.title} (copy)`,
                projectName: src.projectName,
                location: overrides.location ?? src.location,
                periodStart: overrides.periodStart ? new Date(overrides.periodStart) : src.periodStart,
                periodEnd: overrides.periodEnd ? new Date(overrides.periodEnd) : src.periodEnd,
                customerId: src.customerId,
                dpAmount: src.dpAmount,
                pelunasan: src.pelunasan,
                incomeOther: src.incomeOther,
                notes: src.notes,
                items: {
                    create: src.items.map((it: any) => ({
                        categoryId: it.categoryId,
                        description: it.description,
                        unit: it.unit,
                        quantity: it.quantity,
                        quantityCost: it.quantityCost ?? it.quantity,
                        priceRab: it.priceRab,
                        priceCost: it.priceCost,
                        orderIndex: it.orderIndex,
                        productVariantId: it.productVariantId,
                        notes: it.notes,
                    })),
                },
            },
            include: { items: { include: { category: true } } },
        });
    }

    async remove(id: number) {
        await this.findOne(id);
        return this.prisma.rabPlan.delete({ where: { id } });
    }

    /** Upload/replace RAB image (single image — sketsa/desain/referensi) */
    async setImage(id: number, imageUrl: string | null) {
        await this.findOne(id);
        return this.prisma.rabPlan.update({
            where: { id },
            data: { imageUrl },
            select: { id: true, code: true, imageUrl: true },
        });
    }

    /**
     * Generate draft Penawaran dari RAB. Copy `priceRab` saja (bukan priceCost),
     * kategori di-abaikan (penawaran tidak menampilkan kategori RAB).
     */
    async generateQuotation(
        rabId: number,
        params: {
            quotationVariant: 'SEWA' | 'PENGADAAN_BOOTH';
            clientName?: string;
            clientCompany?: string;
            clientAddress?: string;
            clientPhone?: string;
            clientEmail?: string;
            dpPercent?: number;
        },
    ) {
        const rab = await this.findOne(rabId);
        if (rab.items.length === 0) {
            throw new BadRequestException(`RAB id=${rabId} belum punya item`);
        }

        const items = rab.items.map((it, idx) => ({
            description: it.description,
            unit: it.unit ?? undefined,
            quantity: it.quantity,
            price: it.priceRab,
            orderIndex: idx,
            productVariantId: it.productVariantId,
            categoryName: it.category?.name ?? null, // snapshot kategori untuk grouping di PDF
        }));

        const subtotal = items.reduce((s, it) => s + Number(it.quantity) * Number(it.price), 0);

        const draftNumber = `DRAFT-${Date.now()}`;
        return this.prisma.invoice.create({
            data: {
                invoiceNumber: draftNumber,
                type: InvoiceType.QUOTATION,
                status: InvoiceStatus.DRAFT,
                quotationVariant: params.quotationVariant,
                revisionNumber: 0,
                rabPlanId: rab.id,
                brand: rab.brand,

                customerId: rab.customerId,
                clientName: params.clientName ?? rab.customer?.companyPIC ?? rab.customer?.name ?? rab.title,
                clientCompany: params.clientCompany ?? rab.customer?.companyName ?? undefined,
                clientAddress: params.clientAddress ?? rab.customer?.address ?? undefined,
                clientPhone: params.clientPhone ?? rab.customer?.phone ?? undefined,
                clientEmail: params.clientEmail ?? rab.customer?.email ?? undefined,

                projectName: rab.projectName,
                eventLocation: rab.location,
                eventDateStart: rab.periodStart,
                eventDateEnd: rab.periodEnd,

                date: new Date(),
                dpPercent: dec(params.dpPercent ?? 50, '50'),
                subtotal: dec(subtotal),
                total: dec(subtotal),

                items: { create: items },
            },
            include: { items: true, rabPlan: true },
        });
    }

    async saveAsProduct(
        id: number,
        params: {
            name: string;
            categoryId: number;
            unitId: number;
            boothProductType: 'SEWA' | 'PENGADAAN';
            defaultRentalUnit?: string;
            sku?: string;
            description?: string;
            priceOverride?: number;
            hppOverride?: number;
            imageUrl?: string;
        },
    ) {
        const rab = await this.findOne(id);
        if (!params.name) throw new BadRequestException('name wajib diisi');
        if (!params.categoryId) throw new BadRequestException('categoryId wajib diisi');
        if (!params.unitId) throw new BadRequestException('unitId wajib diisi');

        let totalRab = 0;
        let totalCost = 0;
        for (const it of rab.items) {
            const qRab = Number(it.quantity);
            const qCost = Number((it as any).quantityCost ?? it.quantity);
            totalRab += qRab * Number(it.priceRab);
            totalCost += qCost * Number(it.priceCost);
        }

        const price = params.priceOverride ?? totalRab;
        const hpp = params.hppOverride ?? totalCost;

        const sku =
            params.sku ||
            `RAB-${rab.code}-${Date.now().toString(36).toUpperCase()}`.slice(0, 100);

        return this.prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
                data: {
                    name: params.name,
                    description: params.description ?? rab.notes ?? null,
                    categoryId: params.categoryId,
                    unitId: params.unitId,
                    imageUrl: params.imageUrl ?? null,
                    pricingMode: 'UNIT',
                    productType: 'SELLABLE',
                    pricePerUnit: dec(price),
                    trackStock: false,
                },
            });

            const variant = await tx.productVariant.create({
                data: {
                    productId: product.id,
                    sku,
                    variantName: rab.title,
                    price: dec(price),
                    hpp: dec(hpp),
                    stock: 0,
                    boothProductType: params.boothProductType,
                    defaultRentalUnit: params.defaultRentalUnit ?? 'unit',
                    sourceRabPlanId: rab.id,
                },
            });

            return { product, variant };
        });
    }

    /**
     * Generate cashflow EXPENSE entries dari item-item RAB.
     *
     * @param rabPlanId  RAB ID
     * @param opts.mode  'detail' = 1 entry per item · 'category' = 1 entry per RabCategory (sum)
     * @param opts.eventId  Opsional: link semua entry ke event tertentu
     * @param opts.userId   User yang melakukan generate (untuk audit)
     * @param opts.skipExisting  Skip kalau RAB ini sudah pernah di-generate (default: true)
     */
    async generateCashflowFromRab(
        rabPlanId: number,
        opts: {
            mode?: 'detail' | 'category';
            eventId?: number | null;
            userId?: number | null;
            skipExisting?: boolean;
        } = {},
    ) {
        const mode = opts.mode ?? 'detail';
        const skipExisting = opts.skipExisting ?? true;

        const rab = await this.prisma.rabPlan.findUnique({
            where: { id: rabPlanId },
            include: {
                items: {
                    include: { category: true },
                    orderBy: [{ categoryId: 'asc' }, { orderIndex: 'asc' }],
                },
                events: { select: { id: true } },
            },
        });
        if (!rab) throw new NotFoundException('RAB tidak ditemukan');
        if (rab.items.length === 0) {
            throw new BadRequestException('RAB ini belum punya item');
        }

        // Cek apakah sudah pernah di-generate (cek total semua entry RAB ini, INCOME + EXPENSE)
        if (skipExisting) {
            const existing = await this.prisma.cashflow.count({
                where: { rabPlanId },
            });
            if (existing > 0) {
                throw new BadRequestException(
                    `RAB ini sudah pernah di-generate (${existing} entry cashflow ada). Hapus dulu di Cashflow kalau mau regenerate.`,
                );
            }
        }

        // Auto-resolve eventId: kalau tidak di-supply, ambil dari Event yang link ke RAB ini (kalau ada satu)
        const resolvedEventId =
            opts.eventId ??
            (rab.events.length === 1 ? rab.events[0].id : null);

        // Map RAB category name → cashflow category string
        // (langsung pakai nama RAB category — user bisa pilih dari list yg sudah ada di frontend)
        const categoryMap: Record<string, string> = {
            material: 'Material Booth (Kayu/MDF)',
            jasa: 'Jasa Crew Lapangan',
            transport: 'Transport Event',
            akomodasi: 'Akomodasi Crew',
            sewa: 'Sewa Alat Event',
            operasional: 'Operasional Kantor',
        };
        const mapCategory = (rabCatName: string) => {
            const lower = rabCatName.toLowerCase();
            for (const key in categoryMap) {
                if (lower.includes(key)) return categoryMap[key];
            }
            return rabCatName; // fallback: pakai nama RAB category as-is
        };

        const created: Array<{ id: number; amount: number; category: string }> = [];
        const noteSuffix = ` (auto dari RAB ${rab.code})`;

        await this.prisma.$transaction(async (tx) => {
            // ── INCOME: DP, Pelunasan, IncomeOther dari RAB ──
            const dpAmount = parseFloat(rab.dpAmount.toString()) || 0;
            const pelunasan = parseFloat(rab.pelunasan.toString()) || 0;
            const incomeOther = parseFloat(rab.incomeOther.toString()) || 0;
            const incomes: Array<{ category: string; amount: number; note: string }> = [];
            if (dpAmount > 0) incomes.push({ category: 'DP Project', amount: dpAmount, note: `DP ${rab.title}${noteSuffix}` });
            if (pelunasan > 0) incomes.push({ category: 'Pelunasan Project', amount: pelunasan, note: `Pelunasan ${rab.title}${noteSuffix}` });
            if (incomeOther > 0) incomes.push({ category: 'Income Lain Project', amount: incomeOther, note: `Income lain ${rab.title}${noteSuffix}` });
            for (const inc of incomes) {
                const entry = await tx.cashflow.create({
                    data: {
                        type: 'INCOME',
                        category: inc.category,
                        amount: new Prisma.Decimal(inc.amount),
                        note: inc.note,
                        rabPlanId,
                        eventId: resolvedEventId ?? undefined,
                        userId: opts.userId ?? undefined,
                        excludeFromShift: true,
                    },
                });
                created.push({ id: entry.id, amount: inc.amount, category: inc.category });
            }

            if (mode === 'category') {
                // Group by RAB category, sum — split inventaris vs non
                const byCat = new Map<string, { name: string; total: number; count: number; isInventory: boolean }>();
                for (const it of rab.items) {
                    const subtotal = parseFloat(it.priceCost.toString()) * parseFloat(it.quantityCost.toString());
                    if (subtotal <= 0) continue;
                    const key = it.isInventory ? '__INVENTARIS__' : it.category.name;
                    const name = it.isInventory ? 'Pengadaan Inventaris' : it.category.name;
                    const cur = byCat.get(key) ?? { name, total: 0, count: 0, isInventory: !!it.isInventory };
                    cur.total += subtotal;
                    cur.count += 1;
                    byCat.set(key, cur);
                }
                for (const [, v] of byCat) {
                    const entry = await tx.cashflow.create({
                        data: {
                            type: 'EXPENSE',
                            category: v.isInventory ? 'Pengadaan Inventaris' : mapCategory(v.name),
                            amount: new Prisma.Decimal(v.total),
                            note: `${v.isInventory ? '📦 ' : ''}${v.name} — ${v.count} item${noteSuffix}`,
                            rabPlanId,
                            eventId: resolvedEventId ?? undefined,
                            userId: opts.userId ?? undefined,
                            excludeFromShift: true,
                        },
                    });
                    created.push({ id: entry.id, amount: v.total, category: v.name });
                }
            } else {
                // detail mode: 1 entry per item
                for (const it of rab.items) {
                    const subtotal = parseFloat(it.priceCost.toString()) * parseFloat(it.quantityCost.toString());
                    if (subtotal <= 0) continue;
                    const noteParts = [it.description];
                    if (it.unit) noteParts.push(`${it.quantityCost} ${it.unit}`);
                    if (it.notes) noteParts.push(it.notes);
                    if (it.isInventory) noteParts.unshift('📦 INVENTARIS');
                    const entry = await tx.cashflow.create({
                        data: {
                            type: 'EXPENSE',
                            category: it.isInventory ? 'Pengadaan Inventaris' : mapCategory(it.category.name),
                            amount: new Prisma.Decimal(subtotal),
                            note: `${noteParts.join(' · ')}${noteSuffix}`,
                            rabPlanId,
                            eventId: resolvedEventId ?? undefined,
                            userId: opts.userId ?? undefined,
                            excludeFromShift: true,
                        },
                    });
                    created.push({ id: entry.id, amount: subtotal, category: it.isInventory ? 'Pengadaan Inventaris' : it.category.name });
                }
            }
        });

        const total = created.reduce((s, c) => s + c.amount, 0);
        return {
            ok: true,
            mode,
            rabCode: rab.code,
            eventId: resolvedEventId,
            created: created.length,
            totalAmount: total,
        };
    }
}
