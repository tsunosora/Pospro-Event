import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, InvoiceType, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentNumberService } from '../document-numbers/document-number.service';
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
    ) { }

    private async nextCode(year: number): Promise<string> {
        const seq = await this.docNumberService.nextSequence('RAB', 'RAB', year);
        return `RAB-${year}-${seq.toString().padStart(4, '0')}`;
    }

    async create(dto: CreateRabDto) {
        if (!dto.title) throw new BadRequestException('title wajib diisi');
        const year = dto.periodStart ? new Date(dto.periodStart).getFullYear() : new Date().getFullYear();
        const code = await this.nextCode(year);

        return this.prisma.rabPlan.create({
            data: {
                code,
                title: dto.title,
                projectName: dto.projectName,
                location: dto.location,
                periodStart: dto.periodStart ? new Date(dto.periodStart) : null,
                periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
                customerId: dto.customerId ?? null,
                dpAmount: dec(dto.dpAmount),
                pelunasan: dec(dto.pelunasan),
                incomeOther: dec(dto.incomeOther),
                notes: dto.notes,
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
                    })),
                },
            },
            include: { items: { include: { category: true } }, customer: true },
        });
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
        return this.prisma.$transaction(async (tx) => {
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
                    ...(dto.dpAmount !== undefined ? { dpAmount: dec(dto.dpAmount) } : {}),
                    ...(dto.pelunasan !== undefined ? { pelunasan: dec(dto.pelunasan) } : {}),
                    ...(dto.incomeOther !== undefined ? { incomeOther: dec(dto.incomeOther) } : {}),
                    ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
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

        for (const it of rab.items as any[]) {
            const cid = it.categoryId as number;
            const qRab = Number(it.quantity);
            const qCost = Number(it.quantityCost ?? it.quantity);
            const r = Number(it.priceRab);
            const c = Number(it.priceCost);
            const slot = totals.get(cid);
            if (slot) {
                slot.subtotalRab += qRab * r;
                slot.subtotalCost += qCost * c;
                slot.count += 1;
            }
        }

        const totalRab = Array.from(totals.values()).reduce((s, c) => s + c.subtotalRab, 0);
        const totalCost = Array.from(totals.values()).reduce((s, c) => s + c.subtotalCost, 0);
        const totalSelisih = totalRab - totalCost;

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
}
