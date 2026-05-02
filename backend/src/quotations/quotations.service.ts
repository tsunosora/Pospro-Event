import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, InvoiceType, InvoiceStatus, QuotationVariant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentNumberService } from '../document-numbers/document-number.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationItemInput } from './dto/quotation-item.dto';

const DRAFT_NUMBER_PREFIX = 'DRAFT-';

type InvoiceWithItems = Prisma.InvoiceGetPayload<{
    include: { items: true; customer: true; children: true; parent: true };
}>;

function toDecimal(v: number | string | undefined | null, fallback = '0'): Prisma.Decimal {
    if (v === undefined || v === null || v === '') return new Prisma.Decimal(fallback);
    return new Prisma.Decimal(v as any);
}

function calcTotals(items: QuotationItemInput[], taxRate: number, discount: number) {
    const subtotal = items.reduce((sum, it) => {
        const q = Number(it.quantity ?? 0);
        const p = Number(it.price ?? 0);
        return sum + q * p;
    }, 0);
    const taxAmount = (subtotal * (taxRate || 0)) / 100;
    const total = subtotal + taxAmount - (discount || 0);
    return { subtotal, taxAmount, total };
}

@Injectable()
export class QuotationsService {
    constructor(
        private prisma: PrismaService,
        private docNumberService: DocumentNumberService,
    ) { }

    async create(dto: CreateQuotationDto): Promise<InvoiceWithItems> {
        if (!dto.quotationVariant && !dto.variantCode) {
            throw new BadRequestException('Varian penawaran wajib diisi (variantCode atau quotationVariant)');
        }
        if (!dto.clientName) {
            throw new BadRequestException('clientName wajib diisi');
        }

        // Kalau pakai variantCode (CRUD config), set quotationVariant enum dari templateKey config
        // agar pdf-export tetap pilih template yang benar.
        let resolvedEnum = dto.quotationVariant;
        if (dto.variantCode) {
            const cfg = await this.prisma.quotationVariantConfig.findUnique({
                where: { code: dto.variantCode },
            });
            if (!cfg) {
                throw new BadRequestException(`Varian "${dto.variantCode}" tidak ditemukan di config`);
            }
            resolvedEnum = (cfg.templateKey === 'sewa' ? 'SEWA' : 'PENGADAAN_BOOTH') as QuotationVariant;
        }

        const items = dto.items ?? [];
        const taxRate = Number(dto.taxRate ?? 0);
        const discount = Number(dto.discount ?? 0);
        const { subtotal, taxAmount, total } = calcTotals(items, taxRate, discount);

        // Nomor draft — belum di-reserve. Pakai prefix agar unik & mudah dideteksi.
        const draftNumber = `${DRAFT_NUMBER_PREFIX}${Date.now()}`;

        const created = await this.prisma.invoice.create({
            data: {
                invoiceNumber: draftNumber,
                type: InvoiceType.QUOTATION,
                status: InvoiceStatus.DRAFT,
                quotationVariant: resolvedEnum,
                variantCode: dto.variantCode ?? null,
                signedByWorkerId: dto.signedByWorkerId ?? null,
                itemDisplayMode: dto.itemDisplayMode ?? null,
                revisionNumber: 0,
                brand: dto.brand ?? null,

                customerId: dto.customerId ?? null,
                clientName: dto.clientName,
                clientCompany: dto.clientCompany,
                clientAddress: dto.clientAddress,
                clientPhone: dto.clientPhone,
                clientEmail: dto.clientEmail,

                projectName: dto.projectName,
                eventLocation: dto.eventLocation,
                eventDateStart: dto.eventDateStart ? new Date(dto.eventDateStart) : null,
                eventDateEnd: dto.eventDateEnd ? new Date(dto.eventDateEnd) : null,

                date: dto.date ? new Date(dto.date) : new Date(),
                signCity: dto.signCity?.trim() || null,
                validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
                dpPercent: toDecimal(dto.dpPercent ?? 50, '50'),
                bankAccountIds: dto.bankAccountIds,
                notes: dto.notes,

                taxRate: toDecimal(taxRate),
                discount: toDecimal(discount),
                subtotal: toDecimal(subtotal),
                taxAmount: toDecimal(taxAmount),
                total: toDecimal(total),

                items: {
                    create: items.map((it, idx) => ({
                        description: it.description,
                        unit: it.unit,
                        quantity: toDecimal(it.quantity),
                        price: toDecimal(it.price),
                        orderIndex: it.orderIndex ?? idx,
                        productVariantId: it.productVariantId ?? null,
                        categoryName: it.categoryName ?? null,
                    })),
                },
            },
            include: { items: true, customer: true, children: true, parent: true },
        });
        return created;
    }

    async findAll(filter: { variant?: QuotationVariant; variantCode?: string; year?: number; status?: InvoiceStatus; type?: 'QUOTATION' | 'INVOICE' | 'ALL' } = {}) {
        // Default: QUOTATION saja. Kalau filter.type='INVOICE' → tampilkan invoice. 'ALL' → semua tipe.
        const typeFilter: Prisma.InvoiceWhereInput =
            filter.type === 'ALL' ? {} :
            filter.type === 'INVOICE' ? { type: InvoiceType.INVOICE } :
            { type: InvoiceType.QUOTATION };
        const where: Prisma.InvoiceWhereInput = {
            ...typeFilter,
            // variantCode filter (CRUD config) prioritas dibanding variant enum
            ...(filter.variantCode ? { variantCode: filter.variantCode } : {}),
            ...(filter.variant && !filter.variantCode ? { quotationVariant: filter.variant } : {}),
            ...(filter.status ? { status: filter.status } : {}),
        };
        if (filter.year) {
            where.date = {
                gte: new Date(filter.year, 0, 1),
                lt: new Date(filter.year + 1, 0, 1),
            };
        }
        return this.prisma.invoice.findMany({
            where,
            orderBy: { date: 'desc' },
            include: {
                items: { orderBy: { orderIndex: 'asc' } },
                customer: true,
                parent: { select: { id: true, invoiceNumber: true, revisionNumber: true } },
                signedByWorker: { select: { id: true, name: true, position: true, signatureImageUrl: true } },
            },
        });
    }

    async findOne(id: number): Promise<InvoiceWithItems> {
        // Accept both QUOTATION & INVOICE types — UI di /penawaran/[id] dipakai untuk keduanya
        // (invoice yang di-generate dari quotation tetap pakai layout/page yang sama).
        const inv = await this.prisma.invoice.findUnique({
            where: { id },
            include: {
                items: { orderBy: { orderIndex: 'asc' } },
                customer: true,
                parent: true,
                children: { orderBy: { revisionNumber: 'asc' } },
            },
        });
        if (!inv) {
            throw new NotFoundException(`Dokumen id=${id} tidak ditemukan`);
        }
        return inv as InvoiceWithItems;
    }

    async update(id: number, dto: UpdateQuotationDto) {
        // Accept both QUOTATION & INVOICE — invoice yang di-generate juga bisa di-edit
        const existing = await this.prisma.invoice.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException(`Dokumen id=${id} tidak ditemukan`);
        }

        // Hitung ulang totals kalau items dikirim, else pakai existing.
        let recomputed:
            | { subtotal: Prisma.Decimal; taxAmount: Prisma.Decimal; total: Prisma.Decimal }
            | null = null;
        if (dto.items !== undefined) {
            const taxRate = Number(dto.taxRate ?? existing.taxRate);
            const discount = Number(dto.discount ?? existing.discount);
            const { subtotal, taxAmount, total } = calcTotals(dto.items, taxRate, discount);
            recomputed = {
                subtotal: toDecimal(subtotal),
                taxAmount: toDecimal(taxAmount),
                total: toDecimal(total),
            };
        }

        return this.prisma.$transaction(async (tx) => {
            if (dto.items !== undefined) {
                await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
            }

            await tx.invoice.update({
                where: { id },
                data: {
                    ...(dto.quotationVariant !== undefined ? { quotationVariant: dto.quotationVariant } : {}),
                    ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
                    ...(dto.clientName !== undefined ? { clientName: dto.clientName } : {}),
                    ...(dto.clientCompany !== undefined ? { clientCompany: dto.clientCompany } : {}),
                    ...(dto.clientAddress !== undefined ? { clientAddress: dto.clientAddress } : {}),
                    ...(dto.clientPhone !== undefined ? { clientPhone: dto.clientPhone } : {}),
                    ...(dto.clientEmail !== undefined ? { clientEmail: dto.clientEmail } : {}),
                    ...(dto.projectName !== undefined ? { projectName: dto.projectName } : {}),
                    ...(dto.eventLocation !== undefined ? { eventLocation: dto.eventLocation } : {}),
                    ...(dto.eventDateStart !== undefined
                        ? { eventDateStart: dto.eventDateStart ? new Date(dto.eventDateStart) : null }
                        : {}),
                    ...(dto.eventDateEnd !== undefined
                        ? { eventDateEnd: dto.eventDateEnd ? new Date(dto.eventDateEnd) : null }
                        : {}),
                    ...(dto.date !== undefined ? { date: new Date(dto.date as any) } : {}),
                    ...(dto.signCity !== undefined ? { signCity: dto.signCity?.trim() || null } : {}),
                    ...(dto.validUntil !== undefined
                        ? { validUntil: dto.validUntil ? new Date(dto.validUntil) : null }
                        : {}),
                    ...(dto.dpPercent !== undefined ? { dpPercent: toDecimal(dto.dpPercent) } : {}),
                    ...(dto.bankAccountIds !== undefined ? { bankAccountIds: dto.bankAccountIds } : {}),
                    ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
                    ...(dto.taxRate !== undefined ? { taxRate: toDecimal(dto.taxRate) } : {}),
                    ...(dto.discount !== undefined ? { discount: toDecimal(dto.discount) } : {}),
                    ...(dto.brand !== undefined ? { brand: dto.brand } : {}),
                    ...(dto.variantCode !== undefined ? { variantCode: dto.variantCode || null } : {}),
                    ...(dto.signedByWorkerId !== undefined ? { signedByWorkerId: dto.signedByWorkerId } : {}),
                    ...(dto.itemDisplayMode !== undefined ? { itemDisplayMode: dto.itemDisplayMode } : {}),
                    ...(recomputed ?? {}),
                    ...(dto.items !== undefined
                        ? {
                            items: {
                                create: dto.items.map((it, idx) => ({
                                    description: it.description,
                                    unit: it.unit,
                                    quantity: toDecimal(it.quantity),
                                    price: toDecimal(it.price),
                                    orderIndex: it.orderIndex ?? idx,
                                    productVariantId: it.productVariantId ?? null,
                                    categoryName: it.categoryName ?? null,
                                })),
                            },
                        }
                        : {}),
                },
            });

            return tx.invoice.findUnique({
                where: { id },
                include: {
                    items: { orderBy: { orderIndex: 'asc' } },
                    customer: true,
                    parent: true,
                    children: true,
                },
            });
        });
    }

    /**
     * Generate Invoice (DP / Pelunasan / Full) dari Quotation existing.
     * Otomatis:
     *  - Copy item, brand, signedBy, variantCode dari quotation
     *  - Hitung amount: DP = total × dpPercent%, Pelunasan = total - DP, Full = total
     *  - Generate nomor invoice (counter terpisah dari penawaran, kode brand sama)
     *  - Link parent ke quotation
     */
    async generateInvoiceFromQuotation(
        quotationId: number,
        options: { part: 'DP' | 'PELUNASAN' | 'FULL'; customAmount?: number; dueDate?: string },
    ): Promise<InvoiceWithItems> {
        const quotation = await this.prisma.invoice.findUnique({
            where: { id: quotationId },
            include: { items: { orderBy: { orderIndex: 'asc' } } },
        });
        if (!quotation || quotation.type !== InvoiceType.QUOTATION) {
            throw new NotFoundException(`Penawaran id=${quotationId} tidak ditemukan`);
        }
        if (quotation.invoiceNumber.startsWith(DRAFT_NUMBER_PREFIX)) {
            throw new BadRequestException(
                'Quotation belum punya nomor resmi. Assign nomor dulu sebelum buat invoice.',
            );
        }

        const totalNum = Number(quotation.total ?? 0);
        const dpPercentNum = Number(quotation.dpPercent ?? 50);
        const dpAmount = (totalNum * dpPercentNum) / 100;
        const sisa = totalNum - dpAmount;

        let amountToPay: number;
        switch (options.part) {
            case 'DP':
                amountToPay = options.customAmount ?? dpAmount;
                break;
            case 'PELUNASAN':
                amountToPay = options.customAmount ?? sisa;
                break;
            case 'FULL':
                amountToPay = options.customAmount ?? totalNum;
                break;
        }

        // Generate nomor invoice — pakai counter terpisah dengan docType='Inv', kode brand sama
        let kode: string | undefined;
        if (quotation.brand) {
            const brandSettings = await this.prisma.brandSettings.findUnique({
                where: { brand: quotation.brand },
            });
            kode = brandSettings?.companyCode?.trim();
        } else {
            const settings = await this.prisma.storeSettings.findFirst();
            kode = settings?.companyCode?.trim();
        }
        if (!kode) {
            throw new BadRequestException('companyCode brand belum di-set');
        }

        // Format nomor: {seq}/{kode}/Inv/{romanMonth}/{yy}
        const now = new Date();
        const seq = await this.docNumberService.nextSequence('Inv', kode, now.getFullYear());
        const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
        const yy = String(now.getFullYear()).slice(-2);
        const mm = ROMAN[now.getMonth() + 1];
        const invoiceNumber = `${seq}/${kode}/Inv/${mm}/${yy}`;

        const dueDate = options.dueDate ? new Date(options.dueDate) : null;

        return this.prisma.invoice.create({
            data: {
                invoiceNumber,
                type: InvoiceType.INVOICE,
                status: InvoiceStatus.DRAFT,
                invoicePart: options.part,
                amountToPay: toDecimal(amountToPay),
                parentQuotationId: quotation.id,
                rabPlanId: quotation.rabPlanId,
                quotationVariant: quotation.quotationVariant,
                variantCode: quotation.variantCode,
                brand: quotation.brand,
                signedByWorkerId: quotation.signedByWorkerId,
                signCity: quotation.signCity,

                customerId: quotation.customerId,
                clientName: quotation.clientName,
                clientCompany: quotation.clientCompany,
                clientAddress: quotation.clientAddress,
                clientPhone: quotation.clientPhone,
                clientEmail: quotation.clientEmail,

                projectName: quotation.projectName,
                eventLocation: quotation.eventLocation,
                eventDateStart: quotation.eventDateStart,
                eventDateEnd: quotation.eventDateEnd,

                date: now,
                dueDate,
                dpPercent: quotation.dpPercent,
                bankAccountIds: quotation.bankAccountIds,
                notes: quotation.notes,

                taxRate: quotation.taxRate,
                discount: quotation.discount,
                subtotal: quotation.subtotal,
                taxAmount: quotation.taxAmount,
                total: quotation.total,

                items: {
                    create: quotation.items.map((it) => ({
                        description: it.description,
                        unit: it.unit,
                        quantity: it.quantity,
                        price: it.price,
                        orderIndex: it.orderIndex,
                        productVariantId: it.productVariantId,
                        categoryName: it.categoryName,
                    })),
                },
            },
            include: { items: true, customer: true, parent: true, children: true },
        });
    }

    async listInvoicesByQuotation(quotationId: number) {
        return this.prisma.invoice.findMany({
            where: {
                type: InvoiceType.INVOICE,
                parentQuotationId: quotationId,
            },
            orderBy: { date: 'asc' },
            include: { items: { orderBy: { orderIndex: 'asc' } } },
        });
    }

    /**
     * Reserve nomor resmi untuk penawaran (hanya kalau masih DRAFT-).
     * Ambil `companyCode` dari StoreSettings. Jika revisi (revisionNumber>0),
     * sisipkan suffix rev{n}.
     */
    async assignNumber(id: number, options: { mode?: 'auto' | 'manual'; customNumber?: string } = {}) {
        const inv = await this.prisma.invoice.findUnique({ where: { id } });
        if (!inv || inv.type !== InvoiceType.QUOTATION) {
            throw new NotFoundException(`Penawaran id=${id} tidak ditemukan`);
        }
        if (!inv.invoiceNumber.startsWith(DRAFT_NUMBER_PREFIX)) {
            throw new BadRequestException(
                `Penawaran id=${id} sudah punya nomor resmi (${inv.invoiceNumber})`,
            );
        }

        // ── MANUAL MODE: user input nomor sendiri (tidak increment counter) ──
        if (options.mode === 'manual') {
            const custom = options.customNumber?.trim();
            if (!custom) {
                throw new BadRequestException('Nomor manual wajib diisi');
            }
            // Validasi unique
            const existing = await this.prisma.invoice.findUnique({ where: { invoiceNumber: custom } });
            if (existing && existing.id !== id) {
                throw new BadRequestException(
                    `Nomor "${custom}" sudah dipakai quotation lain (id=${existing.id}). Pilih nomor lain.`,
                );
            }
            // Tambah revision suffix kalau ini revisi
            const finalNumber = inv.revisionNumber > 0
                ? this.docNumberService.formatWithRevision(custom, inv.revisionNumber)
                : custom;
            return this.prisma.invoice.update({
                where: { id },
                data: {
                    invoiceNumber: finalNumber,
                    // Saat nomor resmi di-assign, penawaran dianggap sudah issued/sent ke klien.
                    // Hanya update status kalau masih DRAFT — supaya gak override status manual lain (ACCEPTED/REJECTED/dll).
                    ...(inv.status === InvoiceStatus.DRAFT ? { status: InvoiceStatus.SENT } : {}),
                },
                include: { items: true },
            });
        }

        // ── AUTO MODE: increment counter (default) ──
        // Brand-aware numbering: kalau invoice punya brand, ambil companyCode dari BrandSettings.
        // Fallback ke StoreSettings.companyCode kalau brand null (legacy / generic).
        let kode: string | undefined;
        if (inv.brand) {
            const brandSettings = await this.prisma.brandSettings.findUnique({
                where: { brand: inv.brand },
            });
            kode = brandSettings?.companyCode?.trim();
            if (!kode) {
                throw new BadRequestException(
                    `companyCode brand ${inv.brand} belum di-set — atur dulu di /settings/brands`,
                );
            }
        } else {
            const settings = await this.prisma.storeSettings.findFirst();
            kode = settings?.companyCode?.trim();
            if (!kode) {
                throw new BadRequestException(
                    'companyCode belum di-set di StoreSettings — atur dulu di /settings (mis. "Xp" atau "Ep")',
                );
            }
        }

        const base = await this.docNumberService.assignForQuotation(kode, inv.date ?? new Date());
        const finalNumber = this.docNumberService.formatWithRevision(base, inv.revisionNumber);

        return this.prisma.invoice.update({
            where: { id },
            data: {
                invoiceNumber: finalNumber,
                // Auto-promote DRAFT → SENT saat nomor resmi di-assign.
                // Status lain (ACCEPTED/REJECTED/EXPIRED/CANCELLED) tidak di-override.
                ...(inv.status === InvoiceStatus.DRAFT ? { status: InvoiceStatus.SENT } : {}),
            },
            include: { items: true },
        });
    }

    /**
     * Buat revisi baru dari penawaran yang sudah punya nomor resmi.
     * Revisi merupakan row baru, parentQuotationId = id asal,
     * revisionNumber = (latest child revNumber + 1). Nomor belum di-assign
     * — client perlu panggil /assign-number setelah edit final.
     */
    async revise(sourceId: number) {
        const source = await this.prisma.invoice.findUnique({
            where: { id: sourceId },
            include: { items: true, children: true },
        });
        if (!source || source.type !== InvoiceType.QUOTATION) {
            throw new NotFoundException(`Penawaran id=${sourceId} tidak ditemukan`);
        }

        // Root adalah parent paling atas — semua revisi turun dari root.
        const rootId = source.parentQuotationId ?? source.id;
        const siblings = await this.prisma.invoice.findMany({
            where: { OR: [{ id: rootId }, { parentQuotationId: rootId }] },
            select: { revisionNumber: true },
        });
        const nextRev = Math.max(...siblings.map((s) => s.revisionNumber), 0) + 1;

        const draftNumber = `${DRAFT_NUMBER_PREFIX}${Date.now()}`;
        return this.prisma.invoice.create({
            data: {
                invoiceNumber: draftNumber,
                type: InvoiceType.QUOTATION,
                status: InvoiceStatus.DRAFT,
                quotationVariant: source.quotationVariant,
                parentQuotationId: rootId,
                revisionNumber: nextRev,

                customerId: source.customerId,
                clientName: source.clientName,
                clientCompany: source.clientCompany,
                clientAddress: source.clientAddress,
                clientPhone: source.clientPhone,
                clientEmail: source.clientEmail,

                projectName: source.projectName,
                eventLocation: source.eventLocation,
                eventDateStart: source.eventDateStart,
                eventDateEnd: source.eventDateEnd,

                date: new Date(),
                validUntil: source.validUntil,
                dpPercent: source.dpPercent,
                bankAccountIds: source.bankAccountIds,
                notes: source.notes,

                taxRate: source.taxRate,
                discount: source.discount,
                subtotal: source.subtotal,
                taxAmount: source.taxAmount,
                total: source.total,
                brand: source.brand,
                variantCode: source.variantCode,

                items: {
                    create: source.items.map((it) => ({
                        description: it.description,
                        unit: it.unit,
                        quantity: it.quantity,
                        price: it.price,
                        orderIndex: it.orderIndex,
                        productVariantId: it.productVariantId,
                        categoryName: it.categoryName,
                    })),
                },
            },
            include: { items: true, parent: true },
        });
    }

    /**
     * Helper untuk FE: init draft dari data Customer existing (prefill client fields).
     */
    async createFromCustomer(customerId: number, variant: QuotationVariant) {
        const cust = await this.prisma.customer.findUnique({ where: { id: customerId } });
        if (!cust) throw new NotFoundException(`Customer id=${customerId} tidak ditemukan`);

        return this.create({
            quotationVariant: variant,
            customerId: cust.id,
            clientName: cust.companyPIC ?? cust.name,
            clientCompany: cust.companyName ?? undefined,
            clientAddress: cust.address ?? undefined,
            clientPhone: cust.phone ?? undefined,
            clientEmail: cust.email ?? undefined,
        });
    }

    async remove(id: number) {
        // Accept BOTH quotation & invoice — UI page detail dipakai untuk keduanya
        const inv = await this.prisma.invoice.findUnique({
            where: { id },
            include: { children: true },
        });
        if (!inv) {
            throw new NotFoundException(`Dokumen id=${id} tidak ditemukan`);
        }
        // Check: quotation tidak boleh dihapus kalau punya revisi atau invoice anak
        if (inv.type === InvoiceType.QUOTATION) {
            const childInvoiceCount = await this.prisma.invoice.count({
                where: { parentQuotationId: id, type: InvoiceType.INVOICE },
            });
            if (inv.children.length > 0) {
                throw new BadRequestException(
                    `Penawaran id=${id} memiliki ${inv.children.length} revisi — hapus revisi dulu`,
                );
            }
            if (childInvoiceCount > 0) {
                throw new BadRequestException(
                    `Penawaran id=${id} sudah punya ${childInvoiceCount} invoice anak — hapus invoice dulu`,
                );
            }
        }
        return this.prisma.invoice.delete({ where: { id } });
    }

    /**
     * One-time backfill — promote semua penawaran lama yang sudah punya nomor resmi
     * tapi status-nya masih DRAFT, jadi SENT.
     *
     * Kondisi target row:
     *  - type = QUOTATION
     *  - status = DRAFT
     *  - invoiceNumber TIDAK diawali "DRAFT-" (artinya nomor resmi sudah di-assign)
     *
     * Status lain (ACCEPTED/REJECTED/EXPIRED/CANCELLED) tidak disentuh.
     */
    async backfillQuotationStatus(): Promise<{ updated: number }> {
        const result = await this.prisma.invoice.updateMany({
            where: {
                type: InvoiceType.QUOTATION,
                status: InvoiceStatus.DRAFT,
                NOT: { invoiceNumber: { startsWith: DRAFT_NUMBER_PREFIX } },
            },
            data: { status: InvoiceStatus.SENT },
        });
        return { updated: result.count };
    }
}
