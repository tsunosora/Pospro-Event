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

/**
 * Validate & normalize paymentSchedule untuk disimpan di kolom JSON.
 * Total persen harus = 100 (toleransi 0.01). Reject kalau invalid.
 * Return Prisma.JsonNull kalau input kosong/null.
 */
function sanitizePaymentSchedule(
    input: Array<{ label: string; percent: number }> | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (!input || !Array.isArray(input) || input.length === 0) return Prisma.JsonNull;
    const cleaned = input
        .map((s) => ({
            label: (s?.label ?? '').toString().trim(),
            percent: Number(s?.percent ?? 0),
        }))
        .filter((s) => s.label && s.percent > 0);
    if (cleaned.length === 0) return Prisma.JsonNull;
    const total = cleaned.reduce((sum, s) => sum + s.percent, 0);
    if (Math.abs(total - 100) > 0.01) {
        throw new BadRequestException(
            `Total persen payment schedule harus 100% (sekarang ${total.toFixed(2)}%). Sesuaikan persen masing-masing step.`,
        );
    }
    return cleaned as unknown as Prisma.InputJsonValue;
}

/** Sanitize specifications JSON: trim items, drop kosong, drop group tanpa items. */
function sanitizeSpecifications(
    input: Array<{ title?: string | null; items: string[]; packageGroup?: string | null }> | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (!input || !Array.isArray(input) || input.length === 0) return Prisma.JsonNull;
    const cleaned = input
        .map((g) => ({
            title: (g?.title ?? '').toString().trim() || null,
            items: Array.isArray(g?.items)
                ? g.items.map((s) => (s ?? '').toString().trim()).filter((s) => s.length > 0)
                : [],
            packageGroup: (g?.packageGroup ?? '').toString().trim() || null,
        }))
        .filter((g) => g.items.length > 0);
    if (cleaned.length === 0) return Prisma.JsonNull;
    return cleaned as unknown as Prisma.InputJsonValue;
}

/** Normalize additional events sebelum disimpan ke kolom JSON. Tanggal jadi ISO string, field kosong jadi null. */
function sanitizeAdditionalEvents(
    input: CreateQuotationDto['additionalEvents'] | undefined | null,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (!input || !Array.isArray(input) || input.length === 0) return Prisma.JsonNull;
    const cleaned = input
        .map((e) => ({
            name: (e?.name ?? '').toString().trim() || null,
            location: (e?.location ?? '').toString().trim() || null,
            dateStart: e?.dateStart ? new Date(e.dateStart).toISOString() : null,
            dateEnd: e?.dateEnd ? new Date(e.dateEnd).toISOString() : null,
        }))
        .filter((e) => e.name || e.location || e.dateStart || e.dateEnd);
    if (cleaned.length === 0) return Prisma.JsonNull;
    return cleaned as unknown as Prisma.InputJsonValue;
}

function calcTotals(items: QuotationItemInput[], taxRate: number, discount: number) {
    const subtotal = items.reduce((sum, it) => {
        const q = Number(it.quantity ?? 0);
        const m = Number((it as any).unitMultiplier ?? 1) || 1;
        const p = Number(it.price ?? 0);
        return sum + q * m * p;
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
                additionalEvents: sanitizeAdditionalEvents(dto.additionalEvents),

                date: dto.date ? new Date(dto.date) : new Date(),
                signCity: dto.signCity?.trim() || null,
                validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
                dpPercent: toDecimal(dto.dpPercent ?? 50, '50'),
                bankAccountIds: dto.bankAccountIds,
                notes: dto.notes,
                customOpeningText: dto.customOpeningText?.trim() || null,
                customDisclaimer: dto.customDisclaimer?.trim() || null,
                customPaymentTerms: dto.customPaymentTerms?.trim() || null,
                customClosing: dto.customClosing?.trim() || null,
                customOpeningSpk: dto.customOpeningSpk?.trim() || null,
                customDisclaimerSpk: dto.customDisclaimerSpk?.trim() || null,
                customPaymentTermsSpk: dto.customPaymentTermsSpk?.trim() || null,
                customClosingSpk: dto.customClosingSpk?.trim() || null,
                // Cast `as any` — column baru di schema, Prisma Client perlu regenerate dulu.
                // Setelah backend di-build ulang, types akan match.
                ...(({
                    spkPicName: dto.spkPicName?.trim() || null,
                    spkPicPosition: dto.spkPicPosition?.trim() || null,
                    spkPicPhone: dto.spkPicPhone?.trim() || null,
                    spkPaymentDeadline: dto.spkPaymentDeadline ? new Date(dto.spkPaymentDeadline) : null,
                }) as any),
                customOpeningInvoice: dto.customOpeningInvoice?.trim() || null,
                customDisclaimerInvoice: dto.customDisclaimerInvoice?.trim() || null,
                customPaymentTermsInvoice: dto.customPaymentTermsInvoice?.trim() || null,
                customClosingInvoice: dto.customClosingInvoice?.trim() || null,
                // Cast `as any` — column baru, Prisma Client perlu regenerate dulu
                ...(({
                    invoicePicName: dto.invoicePicName?.trim() || null,
                    invoicePicPosition: dto.invoicePicPosition?.trim() || null,
                    invoicePicPhone: dto.invoicePicPhone?.trim() || null,
                }) as any),
                disclaimerPrepend: dto.disclaimerPrepend?.trim() || null,
                disclaimerAppend: dto.disclaimerAppend?.trim() || null,
                paymentTermsPrepend: dto.paymentTermsPrepend?.trim() || null,
                paymentTermsAppend: dto.paymentTermsAppend?.trim() || null,
                closingPrepend: dto.closingPrepend?.trim() || null,
                closingAppend: dto.closingAppend?.trim() || null,
                attachmentCount: dto.attachmentCount && dto.attachmentCount > 0 ? Math.floor(dto.attachmentCount) : null,
                customAttachmentText: dto.customAttachmentText?.trim() || null,
                language: dto.language === 'en' ? 'en' : 'id',
                useUsdCurrency: Boolean(dto.useUsdCurrency),
                customSubject: dto.customSubject?.trim() || null,
                paymentSchedule: sanitizePaymentSchedule(dto.paymentSchedule),
                specifications: sanitizeSpecifications(dto.specifications),
                packagePrice: dto.packagePrice ? toDecimal(dto.packagePrice) : null,
                showGrandTotal: dto.showGrandTotal === false ? false : true,

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
                        ...(({ unitMultiplier: it.unitMultiplier != null && it.unitMultiplier !== '' ? toDecimal(it.unitMultiplier) : toDecimal(1) }) as any),
                        price: toDecimal(it.price),
                        orderIndex: it.orderIndex ?? idx,
                        productVariantId: it.productVariantId ?? null,
                        categoryName: it.categoryName ?? null,
                        eventIndex: typeof it.eventIndex === 'number' ? it.eventIndex : null,
                        packageGroup: it.packageGroup?.trim() || null,
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
                signedByWorker: true,
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
                    ...(dto.additionalEvents !== undefined
                        ? { additionalEvents: sanitizeAdditionalEvents(dto.additionalEvents) }
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
                    ...(dto.customOpeningText !== undefined ? { customOpeningText: dto.customOpeningText?.trim() || null } : {}),
                    ...(dto.customDisclaimer !== undefined ? { customDisclaimer: dto.customDisclaimer?.trim() || null } : {}),
                    ...(dto.customPaymentTerms !== undefined ? { customPaymentTerms: dto.customPaymentTerms?.trim() || null } : {}),
                    ...(dto.customClosing !== undefined ? { customClosing: dto.customClosing?.trim() || null } : {}),
                    ...(dto.customOpeningSpk !== undefined ? { customOpeningSpk: dto.customOpeningSpk?.trim() || null } : {}),
                    ...(dto.customDisclaimerSpk !== undefined ? { customDisclaimerSpk: dto.customDisclaimerSpk?.trim() || null } : {}),
                    ...(dto.customPaymentTermsSpk !== undefined ? { customPaymentTermsSpk: dto.customPaymentTermsSpk?.trim() || null } : {}),
                    ...(dto.customClosingSpk !== undefined ? { customClosingSpk: dto.customClosingSpk?.trim() || null } : {}),
                    // Cast `as any` — column baru, Prisma Client perlu regenerate dulu
                    ...((dto.spkPicName !== undefined ? { spkPicName: dto.spkPicName?.trim() || null } : {}) as any),
                    ...((dto.spkPicPosition !== undefined ? { spkPicPosition: dto.spkPicPosition?.trim() || null } : {}) as any),
                    ...((dto.spkPicPhone !== undefined ? { spkPicPhone: dto.spkPicPhone?.trim() || null } : {}) as any),
                    ...((dto.spkPaymentDeadline !== undefined ? { spkPaymentDeadline: dto.spkPaymentDeadline ? new Date(dto.spkPaymentDeadline) : null } : {}) as any),
                    ...(dto.customOpeningInvoice !== undefined ? { customOpeningInvoice: dto.customOpeningInvoice?.trim() || null } : {}),
                    ...(dto.customDisclaimerInvoice !== undefined ? { customDisclaimerInvoice: dto.customDisclaimerInvoice?.trim() || null } : {}),
                    ...(dto.customPaymentTermsInvoice !== undefined ? { customPaymentTermsInvoice: dto.customPaymentTermsInvoice?.trim() || null } : {}),
                    ...(dto.customClosingInvoice !== undefined ? { customClosingInvoice: dto.customClosingInvoice?.trim() || null } : {}),
                    // Cast `as any` — column baru, Prisma Client perlu regenerate dulu
                    ...((dto.invoicePicName !== undefined ? { invoicePicName: dto.invoicePicName?.trim() || null } : {}) as any),
                    ...((dto.invoicePicPosition !== undefined ? { invoicePicPosition: dto.invoicePicPosition?.trim() || null } : {}) as any),
                    ...((dto.invoicePicPhone !== undefined ? { invoicePicPhone: dto.invoicePicPhone?.trim() || null } : {}) as any),
                    ...(dto.disclaimerPrepend !== undefined ? { disclaimerPrepend: dto.disclaimerPrepend?.trim() || null } : {}),
                    ...(dto.disclaimerAppend !== undefined ? { disclaimerAppend: dto.disclaimerAppend?.trim() || null } : {}),
                    ...(dto.paymentTermsPrepend !== undefined ? { paymentTermsPrepend: dto.paymentTermsPrepend?.trim() || null } : {}),
                    ...(dto.paymentTermsAppend !== undefined ? { paymentTermsAppend: dto.paymentTermsAppend?.trim() || null } : {}),
                    ...(dto.closingPrepend !== undefined ? { closingPrepend: dto.closingPrepend?.trim() || null } : {}),
                    ...(dto.closingAppend !== undefined ? { closingAppend: dto.closingAppend?.trim() || null } : {}),
                    ...(dto.attachmentCount !== undefined
                        ? { attachmentCount: dto.attachmentCount && dto.attachmentCount > 0 ? Math.floor(dto.attachmentCount) : null }
                        : {}),
                    ...(dto.customAttachmentText !== undefined ? { customAttachmentText: dto.customAttachmentText?.trim() || null } : {}),
                    ...(dto.language !== undefined ? { language: dto.language === 'en' ? 'en' : 'id' } : {}),
                    ...(dto.useUsdCurrency !== undefined
                        ? { useUsdCurrency: Boolean(dto.useUsdCurrency) }
                        : {}),
                    ...(dto.customSubject !== undefined
                        ? { customSubject: dto.customSubject?.trim() || null }
                        : {}),
                    ...(dto.paymentSchedule !== undefined
                        ? { paymentSchedule: sanitizePaymentSchedule(dto.paymentSchedule) }
                        : {}),
                    ...(dto.specifications !== undefined
                        ? { specifications: sanitizeSpecifications(dto.specifications) }
                        : {}),
                    ...(dto.packagePrice !== undefined
                        ? { packagePrice: dto.packagePrice ? toDecimal(dto.packagePrice) : null }
                        : {}),
                    ...(dto.showGrandTotal !== undefined
                        ? { showGrandTotal: dto.showGrandTotal === false ? false : true }
                        : {}),
                    ...(recomputed ?? {}),
                    ...(dto.items !== undefined
                        ? {
                            items: {
                                create: dto.items.map((it, idx) => ({
                                    description: it.description,
                                    unit: it.unit,
                                    quantity: toDecimal(it.quantity),
                                    ...(({ unitMultiplier: it.unitMultiplier != null && it.unitMultiplier !== '' ? toDecimal(it.unitMultiplier) : toDecimal(1) }) as any),
                                    price: toDecimal(it.price),
                                    orderIndex: it.orderIndex ?? idx,
                                    productVariantId: it.productVariantId ?? null,
                                    categoryName: it.categoryName ?? null,
                                    eventIndex: typeof it.eventIndex === 'number' ? it.eventIndex : null,
                                    packageGroup: it.packageGroup?.trim() || null,
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
                additionalEvents: (quotation.additionalEvents ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,

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
                        eventIndex: it.eventIndex,
                        packageGroup: it.packageGroup,
                    })),
                },
                // Carry forward fitur PDF spesifik ke invoice
                customSubject: quotation.customSubject,
                paymentSchedule: (quotation.paymentSchedule ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
                specifications: (quotation.specifications ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
                packagePrice: quotation.packagePrice,
                showGrandTotal: quotation.showGrandTotal,
                // Carry forward Penawaran-level custom text (fallback chain di context builder)
                customOpeningText: quotation.customOpeningText,
                customDisclaimer: quotation.customDisclaimer,
                customPaymentTerms: quotation.customPaymentTerms,
                customClosing: quotation.customClosing,
                disclaimerPrepend: quotation.disclaimerPrepend,
                disclaimerAppend: quotation.disclaimerAppend,
                paymentTermsPrepend: quotation.paymentTermsPrepend,
                paymentTermsAppend: quotation.paymentTermsAppend,
                closingPrepend: quotation.closingPrepend,
                closingAppend: quotation.closingAppend,
                // Carry forward Invoice-specific custom text supaya tab Invoice di Penawaran benar-benar
                // diterapkan ke invoice yang di-generate. Sebelumnya bug: hilang setelah generate.
                customOpeningInvoice: quotation.customOpeningInvoice,
                customDisclaimerInvoice: quotation.customDisclaimerInvoice,
                customPaymentTermsInvoice: quotation.customPaymentTermsInvoice,
                customClosingInvoice: quotation.customClosingInvoice,
                // Language + currency + lampiran
                language: quotation.language,
                useUsdCurrency: quotation.useUsdCurrency,
                attachmentCount: quotation.attachmentCount,
                customAttachmentText: quotation.customAttachmentText,
                // Carry forward Invoice-PIC override fields supaya invoice yang baru di-generate
                // langsung punya PIC override sesuai yang di-set di quotation.
                ...(({
                    invoicePicName: (quotation as any).invoicePicName,
                    invoicePicPosition: (quotation as any).invoicePicPosition,
                    invoicePicPhone: (quotation as any).invoicePicPhone,
                }) as any),
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

        const lang: 'id' | 'en' = inv.language === 'en' ? 'en' : 'id';
        const base = await this.docNumberService.assignForQuotation(kode, inv.date ?? new Date(), lang);
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
     * Edit nomor dokumen (PENAWARAN atau INVOICE) yang sudah di-assign — koreksi typo / ganti format.
     * Validasi: nomor tidak boleh kosong, harus unique (kecuali sama dengan nomor sekarang).
     * Tidak mengubah status atau revision number.
     */
    async editNumber(id: number, newNumber: string) {
        const inv = await this.prisma.invoice.findUnique({ where: { id } });
        if (!inv) {
            throw new NotFoundException(`Dokumen id=${id} tidak ditemukan`);
        }
        const docLabel = inv.type === InvoiceType.INVOICE ? 'Invoice' : 'Penawaran';
        const trimmed = newNumber?.trim();
        if (!trimmed) {
            throw new BadRequestException(`Nomor ${docLabel.toLowerCase()} wajib diisi`);
        }
        if (trimmed === inv.invoiceNumber) {
            // Nomor sama persis — tidak perlu update.
            return inv;
        }
        // Validasi unique
        const existing = await this.prisma.invoice.findUnique({
            where: { invoiceNumber: trimmed },
        });
        if (existing && existing.id !== id) {
            const existingLabel = existing.type === InvoiceType.INVOICE ? 'invoice' : 'quotation';
            throw new BadRequestException(
                `Nomor "${trimmed}" sudah dipakai ${existingLabel} lain (id=${existing.id}). Pilih nomor lain.`,
            );
        }
        return this.prisma.invoice.update({
            where: { id },
            data: { invoiceNumber: trimmed },
            include: { items: true },
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // PAYMENT STATUS MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    /** Mark Invoice as SENT (sudah dikirim ke klien). DRAFT → SENT. */
    async markInvoiceSent(invoiceId: number, _userId: number | null = null) {
        const inv = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
        if (!inv) throw new NotFoundException(`Invoice id=${invoiceId} tidak ditemukan`);
        if (inv.type !== InvoiceType.INVOICE) {
            throw new BadRequestException('Mark Sent hanya untuk Invoice (bukan Penawaran/SPK).');
        }
        if (inv.status === InvoiceStatus.CANCELLED) {
            throw new BadRequestException('Invoice sudah CANCELLED, tidak bisa mark sent.');
        }
        return this.prisma.invoice.update({
            where: { id: invoiceId },
            data: { status: InvoiceStatus.SENT },
        });
    }

    /**
     * Mark Invoice as PAID atau PARTIALLY_PAID.
     * - Kalau paidAmount accumulated ≥ amountToPay → status PAID
     * - Kalau paidAmount > 0 tapi < amountToPay → status PARTIALLY_PAID
     * - Auto-create Cashflow IN entry (kalau createCashflow=true).
     */
    async markInvoicePaid(
        invoiceId: number,
        payload: {
            amount: number | string;        // nominal yang dibayar di transaksi ini
            paidAt?: string | Date;          // tanggal pembayaran (default: now)
            paymentMethod?: 'CASH' | 'QRIS' | 'BANK_TRANSFER' | 'OTHER';
            paymentRef?: string | null;
            paymentNote?: string | null;
            paymentProofUrl?: string | null; // URL gambar bukti transfer (opsional)
            createCashflow?: boolean;        // default true — auto-create entry di Cashflow
            cashflowBankAccountId?: number | null;  // bank tujuan (untuk Cashflow entry)
        },
        userId: number | null = null,
    ) {
        const inv = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
        if (!inv) throw new NotFoundException(`Invoice id=${invoiceId} tidak ditemukan`);
        if (inv.type !== InvoiceType.INVOICE) {
            throw new BadRequestException('Mark Paid hanya untuk Invoice (bukan Penawaran/SPK).');
        }
        if (inv.status === InvoiceStatus.CANCELLED) {
            throw new BadRequestException('Invoice sudah CANCELLED, tidak bisa mark paid.');
        }

        const newPayment = Number(payload.amount);
        if (!newPayment || newPayment <= 0) {
            throw new BadRequestException('Nominal pembayaran harus > 0.');
        }
        const targetAmount = Number(inv.amountToPay ?? inv.total ?? 0);
        const previousPaid = Number((inv as any).paidAmount ?? 0);
        const accumulatedPaid = previousPaid + newPayment;

        // Resolve status: PAID kalau penuh, PARTIALLY_PAID kalau sebagian.
        // Cast as any — PARTIALLY_PAID enum baru, Prisma Client perlu regenerate.
        const isFullyPaid = accumulatedPaid >= targetAmount - 0.01; // toleransi float
        const newStatus = isFullyPaid ? InvoiceStatus.PAID : ('PARTIALLY_PAID' as any);

        const paidAt = payload.paidAt ? new Date(payload.paidAt) : new Date();

        return this.prisma.$transaction(async (tx) => {
            // 0. Hitung installment number — count existing payments + 1
            const existingCount = await (tx as any).invoicePayment.count({
                where: { invoiceId },
            });
            const installmentNumber = existingCount + 1;

            // 1. Auto-create Cashflow IN entry (kalau opt-in)
            let cashflowId: number | null = null;
            if (payload.createCashflow !== false) {
                const cashflowMethod: 'CASH' | 'QRIS' | 'BANK_TRANSFER' | null =
                    payload.paymentMethod === 'OTHER' ? null :
                    payload.paymentMethod === 'CASH' ? 'CASH' :
                    payload.paymentMethod === 'QRIS' ? 'QRIS' :
                    payload.paymentMethod === 'BANK_TRANSFER' ? 'BANK_TRANSFER' :
                    null;
                const noteLines = [
                    `Pembayaran Invoice ${inv.invoiceNumber} (cicilan ke-${installmentNumber})`,
                    payload.paymentRef ? `Ref: ${payload.paymentRef}` : null,
                    payload.paymentNote ? `Catatan: ${payload.paymentNote}` : null,
                ].filter(Boolean).join('\n');
                const cf = await tx.cashflow.create({
                    data: {
                        type: 'INCOME',
                        category: 'Pembayaran Invoice',
                        amount: toDecimal(newPayment),
                        note: noteLines,
                        userId: userId,
                        bankAccountId: payload.cashflowBankAccountId ?? null,
                        paymentMethod: cashflowMethod as any,
                        date: paidAt,
                    },
                });
                cashflowId = cf.id;
            }

            // 2. Create InvoicePayment row — record per-cicilan
            await (tx as any).invoicePayment.create({
                data: {
                    invoiceId,
                    installmentNumber,
                    amount: toDecimal(newPayment),
                    paidAt,
                    paymentMethod: payload.paymentMethod ?? null,
                    paymentRef: payload.paymentRef?.trim() || null,
                    paymentNote: payload.paymentNote?.trim() || null,
                    paymentProofUrl: payload.paymentProofUrl?.trim() || null,
                    bankAccountId: payload.cashflowBankAccountId ?? null,
                    cashflowId,
                    createdById: userId,
                },
            });

            // 3. Update invoice status + accumulated payment fields (untuk display ringkas)
            const updated = await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                    status: newStatus,
                    paidAmount: toDecimal(accumulatedPaid) as any,
                    paidAt,
                    paymentMethod: payload.paymentMethod ?? null,
                    paymentRef: payload.paymentRef?.trim() || null,
                    paymentNote: payload.paymentNote?.trim() || null,
                    paymentProofUrl: payload.paymentProofUrl?.trim() || null,
                    // Update FK cashflow cuma kalau belum di-set (kalau partial multi-payment, FK awal preserved)
                    ...((cashflowId && !(inv as any).paymentCashflowId)
                        ? { paymentCashflowId: cashflowId }
                        : {}),
                } as any,
                include: { items: true },
            });
            return updated;
        });
    }

    /** Cancel Invoice. Status → CANCELLED. Tidak boleh kalau sudah PAID. */
    async cancelInvoice(invoiceId: number, reason: string | null = null, _userId: number | null = null) {
        const inv = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
        if (!inv) throw new NotFoundException(`Invoice id=${invoiceId} tidak ditemukan`);
        if (inv.type !== InvoiceType.INVOICE) {
            throw new BadRequestException('Cancel hanya untuk Invoice (bukan Penawaran/SPK).');
        }
        if (inv.status === InvoiceStatus.PAID) {
            throw new BadRequestException('Invoice sudah PAID, tidak bisa di-cancel. Buat refund/credit note manual.');
        }
        return this.prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                status: InvoiceStatus.CANCELLED,
                cancelledAt: new Date(),
                cancelReason: reason?.trim() || null,
            } as any,
        });
    }

    /**
     * Get aggregate payment summary untuk satu Quotation.
     * Return: total invoiced, total paid, sisa tagihan, list invoices dengan status.
     */
    /**
     * Dashboard piutang & pemasukan — aggregate per customer + total.
     *
     * Output:
     *  - kpi: { totalOutstanding, totalIncomeMonth, totalIncomeYTD, customersWithDebt, overdueCount, overdueAmount }
     *  - byCustomer: list per-customer sorted by sisaTagihan desc
     *  - overdueInvoices: list invoice yang lewat tempo, untuk warning
     *  - incomeMonthly: 12 bulan terakhir, untuk chart pemasukan
     */
    async getReceivablesDashboard() {
        // Ambil semua invoice yang status-nya bukan CANCELLED
        const invoices = await this.prisma.invoice.findMany({
            where: {
                type: InvoiceType.INVOICE,
                status: { not: InvoiceStatus.CANCELLED },
            },
            include: {
                customer: { select: { id: true, name: true, companyName: true, phone: true } },
            },
            orderBy: { date: 'desc' },
        });

        const today = new Date();
        const todayMs = today.getTime();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const yearStart = new Date(today.getFullYear(), 0, 1);

        // Aggregate per customer
        type CustomerAgg = {
            customerId: number | null;
            customerName: string;
            companyName: string | null;
            phone: string | null;
            totalInvoiced: number;
            totalPaid: number;
            sisaTagihan: number;
            invoiceCount: number;
            unpaidCount: number;
            partialCount: number;
            overdueCount: number;
            oldestUnpaidDays: number; // hari sejak invoice terlama yang belum lunas
            invoiceIds: number[];
        };
        const customerMap = new Map<string, CustomerAgg>();

        const overdueInvoices: Array<{
            id: number;
            invoiceNumber: string;
            customerId: number | null;
            customerName: string;
            companyName: string | null;
            phone: string | null;
            amountToPay: number;
            paidAmount: number;
            sisa: number;
            date: string;
            dueDate: string | null;
            daysOverdue: number;
            status: string;
        }> = [];

        for (const inv of invoices) {
            // key: customerId atau clientName (kalau ga ada customer)
            const key = inv.customerId
                ? `id:${inv.customerId}`
                : `name:${inv.clientName}`;

            const amountToPay = Number(inv.amountToPay ?? inv.total ?? 0);
            const paidAmount = Number((inv as any).paidAmount ?? 0);
            const sisa = Math.max(0, amountToPay - paidAmount);
            const isPaid = inv.status === InvoiceStatus.PAID;
            const isPartial = (inv.status as any) === 'PARTIALLY_PAID';

            // Overdue check: dueDate < today AND status bukan PAID
            const dueDate = inv.dueDate ? new Date(inv.dueDate) : null;
            const isOverdue = dueDate && dueDate.getTime() < todayMs && !isPaid && sisa > 0;
            const daysOverdue = isOverdue && dueDate
                ? Math.floor((todayMs - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                : 0;

            // Days since invoice issued (untuk oldestUnpaidDays kalau dueDate kosong)
            const daysSinceIssued = Math.floor((todayMs - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24));

            if (!customerMap.has(key)) {
                customerMap.set(key, {
                    customerId: inv.customerId,
                    customerName: inv.customer?.name ?? inv.clientName,
                    companyName: inv.customer?.companyName ?? inv.clientCompany,
                    phone: inv.customer?.phone ?? inv.clientPhone,
                    totalInvoiced: 0,
                    totalPaid: 0,
                    sisaTagihan: 0,
                    invoiceCount: 0,
                    unpaidCount: 0,
                    partialCount: 0,
                    overdueCount: 0,
                    oldestUnpaidDays: 0,
                    invoiceIds: [],
                });
            }
            const agg = customerMap.get(key)!;
            agg.totalInvoiced += amountToPay;
            agg.totalPaid += paidAmount;
            agg.sisaTagihan += sisa;
            agg.invoiceCount += 1;
            agg.invoiceIds.push(inv.id);
            if (!isPaid && sisa > 0) {
                if (isPartial) agg.partialCount += 1;
                else agg.unpaidCount += 1;
                if (isOverdue) agg.overdueCount += 1;
                if (daysSinceIssued > agg.oldestUnpaidDays) {
                    agg.oldestUnpaidDays = daysSinceIssued;
                }
            }

            if (isOverdue && sisa > 0) {
                overdueInvoices.push({
                    id: inv.id,
                    invoiceNumber: inv.invoiceNumber,
                    customerId: inv.customerId,
                    customerName: inv.customer?.name ?? inv.clientName,
                    companyName: inv.customer?.companyName ?? inv.clientCompany,
                    phone: inv.customer?.phone ?? inv.clientPhone,
                    amountToPay,
                    paidAmount,
                    sisa,
                    date: inv.date.toISOString(),
                    dueDate: dueDate?.toISOString() ?? null,
                    daysOverdue,
                    status: inv.status,
                });
            }
        }

        // Sort customer list by sisaTagihan desc, exclude yang lunas (sisa 0)
        const byCustomer = Array.from(customerMap.values())
            .filter((c) => c.sisaTagihan > 0 || c.invoiceCount > 0)
            .sort((a, b) => b.sisaTagihan - a.sisaTagihan);

        // Income aggregation — dari Cashflow IN kategori "Pembayaran Invoice"
        const cashflows = await this.prisma.cashflow.findMany({
            where: {
                type: 'INCOME',
                category: 'Pembayaran Invoice',
                date: { gte: new Date(today.getFullYear() - 1, today.getMonth(), 1) },
            },
            orderBy: { date: 'asc' },
        });

        let totalIncomeMonth = 0;
        let totalIncomeYTD = 0;
        // Monthly aggregation — 12 bulan terakhir
        const monthlyMap = new Map<string, number>();
        for (const cf of cashflows) {
            const amt = Number(cf.amount);
            const d = new Date(cf.date);
            if (d >= monthStart) totalIncomeMonth += amt;
            if (d >= yearStart) totalIncomeYTD += amt;
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + amt);
        }
        // Build last-12-month array
        const incomeMonthly: Array<{ month: string; label: string; amount: number }> = [];
        const monthLabels = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            incomeMonthly.push({
                month: key,
                label: `${monthLabels[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
                amount: monthlyMap.get(key) ?? 0,
            });
        }

        const totalOutstanding = byCustomer.reduce((s, c) => s + c.sisaTagihan, 0);
        const overdueAmount = overdueInvoices.reduce((s, inv) => s + inv.sisa, 0);

        return {
            kpi: {
                totalOutstanding,
                totalIncomeMonth,
                totalIncomeYTD,
                customersWithDebt: byCustomer.filter((c) => c.sisaTagihan > 0).length,
                overdueCount: overdueInvoices.length,
                overdueAmount,
                totalInvoices: invoices.length,
            },
            byCustomer,
            overdueInvoices: overdueInvoices.sort((a, b) => b.daysOverdue - a.daysOverdue),
            incomeMonthly,
        };
    }

    /**
     * Get detailed payment info untuk Invoice — includes bank account info
     * (rekening yang menerima transfer) kalau pembayaran via BANK_TRANSFER.
     */
    async getPaymentDetail(invoiceId: number) {
        const inv = await this.prisma.invoice.findUnique({
            where: { id: invoiceId },
        });
        if (!inv) throw new NotFoundException(`Invoice id=${invoiceId} tidak ditemukan`);
        if (inv.type !== InvoiceType.INVOICE) {
            throw new BadRequestException('Payment detail hanya untuk Invoice (bukan Penawaran).');
        }

        // Fetch semua installment payments — per cicilan
        const installments = await (this.prisma as any).invoicePayment.findMany({
            where: { invoiceId },
            include: { bankAccount: true },
            orderBy: { installmentNumber: 'asc' },
        });

        // Backfill: kalau invoice sudah pernah Mark Paid sebelum fitur InvoicePayment dibuat,
        // tabel kosong. Synthesize 1 row dari field di Invoice biar UI tetap nampilkan.
        let syntheticInstallment: any[] = [];
        if (installments.length === 0 && (inv as any).paidAmount && Number((inv as any).paidAmount) > 0) {
            let bankAccount: any = null;
            const cashflowId = (inv as any).paymentCashflowId as number | null;
            if (cashflowId) {
                const cashflow = await this.prisma.cashflow.findUnique({ where: { id: cashflowId } });
                if (cashflow?.bankAccountId) {
                    bankAccount = await this.prisma.bankAccount.findUnique({
                        where: { id: cashflow.bankAccountId },
                    });
                }
            }
            syntheticInstallment = [{
                id: 0,
                installmentNumber: 1,
                amount: Number((inv as any).paidAmount),
                paidAt: (inv as any).paidAt,
                paymentMethod: (inv as any).paymentMethod,
                paymentRef: (inv as any).paymentRef,
                paymentNote: (inv as any).paymentNote,
                paymentProofUrl: (inv as any).paymentProofUrl,
                bankAccount: bankAccount ? {
                    id: bankAccount.id,
                    bankName: bankAccount.bankName,
                    accountNumber: bankAccount.accountNumber,
                    accountOwner: bankAccount.accountOwner,
                } : null,
                cashflowId,
                createdAt: (inv as any).paidAt,
                isLegacy: true, // flag agar UI tau ini synthetic dari data lama
            }];
        }

        const list = installments.length > 0
            ? installments.map((p: any) => ({
                id: p.id,
                installmentNumber: p.installmentNumber,
                amount: Number(p.amount),
                paidAt: p.paidAt,
                paymentMethod: p.paymentMethod,
                paymentRef: p.paymentRef,
                paymentNote: p.paymentNote,
                paymentProofUrl: p.paymentProofUrl,
                bankAccount: p.bankAccount ? {
                    id: p.bankAccount.id,
                    bankName: p.bankAccount.bankName,
                    accountNumber: p.bankAccount.accountNumber,
                    accountOwner: p.bankAccount.accountOwner,
                } : null,
                cashflowId: p.cashflowId,
                createdAt: p.createdAt,
            }))
            : syntheticInstallment;

        return {
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            status: inv.status,
            amountToPay: Number(inv.amountToPay ?? 0),
            paidAmount: Number((inv as any).paidAmount ?? 0),
            // Latest payment ringkasan (dari Invoice fields — backward compat)
            paidAt: (inv as any).paidAt,
            paymentMethod: (inv as any).paymentMethod,
            paymentRef: (inv as any).paymentRef,
            paymentNote: (inv as any).paymentNote,
            paymentProofUrl: (inv as any).paymentProofUrl,
            // List semua cicilan
            installments: list,
            installmentCount: list.length,
        };
    }

    async getPaymentSummary(quotationId: number) {
        const quotation = await this.prisma.invoice.findUnique({
            where: { id: quotationId },
        });
        if (!quotation || quotation.type !== InvoiceType.QUOTATION) {
            throw new NotFoundException(`Penawaran id=${quotationId} tidak ditemukan`);
        }
        const invoices = await this.prisma.invoice.findMany({
            where: { parentQuotationId: quotationId, type: InvoiceType.INVOICE },
            orderBy: { date: 'asc' },
        });
        const quotationTotal = Number(quotation.total ?? 0);
        let totalInvoiced = 0;
        let totalPaid = 0;
        for (const inv of invoices) {
            if (inv.status === InvoiceStatus.CANCELLED) continue;
            totalInvoiced += Number(inv.amountToPay ?? 0);
            totalPaid += Number((inv as any).paidAmount ?? 0);
        }
        const sisaTagihan = Math.max(0, quotationTotal - totalPaid);
        return {
            quotationTotal,
            totalInvoiced,
            totalPaid,
            sisaTagihan,
            invoices: invoices.map((inv) => ({
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                invoicePart: inv.invoicePart,
                status: inv.status,
                amountToPay: Number(inv.amountToPay ?? 0),
                paidAmount: Number((inv as any).paidAmount ?? 0),
                paidAt: (inv as any).paidAt,
                paymentMethod: (inv as any).paymentMethod,
                paymentRef: (inv as any).paymentRef,
                date: inv.date,
            })),
        };
    }

    /**
     * Edge case: Klien transfer langsung lunas padahal sudah ada Invoice DP/Pelunasan.
     * Admin pilih mode handling:
     *   - 'auto_create_pelunasan': mark DP PAID + create Pelunasan + mark PAID (2 invoices)
     *   - 'convert_to_full': edit existing invoice → invoicePart=FULL, amount=quotationTotal, mark PAID (1 invoice)
     *   - 'cancel_and_new_full': cancel existing + create new FULL invoice + mark PAID (3 records)
     */
    async markFullyPaidEdgeCase(
        quotationId: number,
        sourceInvoiceId: number,
        mode: 'auto_create_pelunasan' | 'convert_to_full' | 'cancel_and_new_full',
        payment: {
            amount: number;
            paidAt?: string | Date;
            paymentMethod?: 'CASH' | 'QRIS' | 'BANK_TRANSFER' | 'OTHER';
            paymentRef?: string | null;
            paymentNote?: string | null;
            createCashflow?: boolean;
            cashflowBankAccountId?: number | null;
        },
        userId: number | null = null,
    ) {
        const quotation = await this.prisma.invoice.findUnique({
            where: { id: quotationId },
        });
        if (!quotation || quotation.type !== InvoiceType.QUOTATION) {
            throw new NotFoundException(`Penawaran id=${quotationId} tidak ditemukan`);
        }
        const sourceInvoice = await this.prisma.invoice.findUnique({
            where: { id: sourceInvoiceId },
        });
        if (!sourceInvoice || sourceInvoice.type !== InvoiceType.INVOICE) {
            throw new NotFoundException(`Invoice id=${sourceInvoiceId} tidak ditemukan`);
        }
        const quotationTotal = Number(quotation.total ?? 0);
        const dpAmount = Number(sourceInvoice.amountToPay ?? 0);
        const pelunasanAmount = quotationTotal - dpAmount;

        if (mode === 'auto_create_pelunasan') {
            // 1. Mark source (DP) as PAID
            await this.markInvoicePaid(sourceInvoiceId, {
                amount: dpAmount,
                paidAt: payment.paidAt,
                paymentMethod: payment.paymentMethod,
                paymentRef: payment.paymentRef,
                paymentNote: payment.paymentNote,
                createCashflow: payment.createCashflow,
                cashflowBankAccountId: payment.cashflowBankAccountId,
            }, userId);
            // 2. Create Pelunasan invoice
            const pelunasan = await this.generateInvoiceFromQuotation(quotationId, {
                part: 'PELUNASAN',
                customAmount: pelunasanAmount,
            });
            // 3. Mark Pelunasan as PAID
            await this.markInvoicePaid(pelunasan.id, {
                amount: pelunasanAmount,
                paidAt: payment.paidAt,
                paymentMethod: payment.paymentMethod,
                paymentRef: payment.paymentRef,
                paymentNote: payment.paymentNote,
                createCashflow: payment.createCashflow,
                cashflowBankAccountId: payment.cashflowBankAccountId,
            }, userId);
            return { mode, dpId: sourceInvoiceId, pelunasanId: pelunasan.id };
        }

        if (mode === 'convert_to_full') {
            // Ubah source invoice: invoicePart=FULL, amount=total quotation, mark PAID
            await this.prisma.invoice.update({
                where: { id: sourceInvoiceId },
                data: {
                    invoicePart: 'FULL',
                    amountToPay: toDecimal(quotationTotal),
                },
            });
            await this.markInvoicePaid(sourceInvoiceId, {
                amount: quotationTotal,
                paidAt: payment.paidAt,
                paymentMethod: payment.paymentMethod,
                paymentRef: payment.paymentRef,
                paymentNote: payment.paymentNote,
                createCashflow: payment.createCashflow,
                cashflowBankAccountId: payment.cashflowBankAccountId,
            }, userId);
            return { mode, invoiceId: sourceInvoiceId };
        }

        if (mode === 'cancel_and_new_full') {
            // Cancel source + create new FULL invoice + mark PAID
            await this.cancelInvoice(sourceInvoiceId, 'Klien bayar langsung lunas — di-cancel & ganti invoice FULL', userId);
            const fullInv = await this.generateInvoiceFromQuotation(quotationId, {
                part: 'FULL',
                customAmount: quotationTotal,
            });
            await this.markInvoicePaid(fullInv.id, {
                amount: quotationTotal,
                paidAt: payment.paidAt,
                paymentMethod: payment.paymentMethod,
                paymentRef: payment.paymentRef,
                paymentNote: payment.paymentNote,
                createCashflow: payment.createCashflow,
                cashflowBankAccountId: payment.cashflowBankAccountId,
            }, userId);
            return { mode, cancelledId: sourceInvoiceId, fullId: fullInv.id };
        }

        throw new BadRequestException(`Mode "${mode}" tidak dikenali.`);
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
                additionalEvents: (source.additionalEvents ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,

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

                customSubject: source.customSubject,
                paymentSchedule: (source.paymentSchedule ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
                specifications: (source.specifications ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
                packagePrice: source.packagePrice,
                showGrandTotal: source.showGrandTotal,
                // Carry forward semua custom text (Penawaran, SPK, Invoice) ke revisi
                customOpeningText: source.customOpeningText,
                customDisclaimer: source.customDisclaimer,
                customPaymentTerms: source.customPaymentTerms,
                customClosing: source.customClosing,
                customOpeningSpk: source.customOpeningSpk,
                customDisclaimerSpk: source.customDisclaimerSpk,
                customPaymentTermsSpk: source.customPaymentTermsSpk,
                customClosingSpk: source.customClosingSpk,
                customOpeningInvoice: source.customOpeningInvoice,
                customDisclaimerInvoice: source.customDisclaimerInvoice,
                customPaymentTermsInvoice: source.customPaymentTermsInvoice,
                customClosingInvoice: source.customClosingInvoice,
                disclaimerPrepend: source.disclaimerPrepend,
                disclaimerAppend: source.disclaimerAppend,
                paymentTermsPrepend: source.paymentTermsPrepend,
                paymentTermsAppend: source.paymentTermsAppend,
                closingPrepend: source.closingPrepend,
                closingAppend: source.closingAppend,
                // Language + currency + lampiran
                language: source.language,
                useUsdCurrency: source.useUsdCurrency,
                attachmentCount: source.attachmentCount,
                customAttachmentText: source.customAttachmentText,
                // Carry forward SPK & Invoice PIC override fields ke revisi
                ...(({
                    spkPicName: (source as any).spkPicName,
                    spkPicPosition: (source as any).spkPicPosition,
                    spkPicPhone: (source as any).spkPicPhone,
                    spkPaymentDeadline: (source as any).spkPaymentDeadline,
                    invoicePicName: (source as any).invoicePicName,
                    invoicePicPosition: (source as any).invoicePicPosition,
                    invoicePicPhone: (source as any).invoicePicPhone,
                }) as any),
                items: {
                    create: source.items.map((it) => ({
                        description: it.description,
                        unit: it.unit,
                        quantity: it.quantity,
                        price: it.price,
                        orderIndex: it.orderIndex,
                        productVariantId: it.productVariantId,
                        categoryName: it.categoryName,
                        eventIndex: it.eventIndex,
                        packageGroup: it.packageGroup,
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

    /**
     * Create Penawaran dari Lead — auto-pull data customer hasil convert +
     * carry forward event utama (location + tanggal) dan additionalEvents (multi-kota).
     * Admin tidak perlu input manual lagi data event yang sudah diisi di stage Lead.
     */
    async createFromLead(leadId: number, variant: QuotationVariant) {
        const lead = await this.prisma.lead.findUnique({
            where: { id: leadId },
        });
        if (!lead) throw new NotFoundException(`Lead id=${leadId} tidak ditemukan`);
        if (!lead.convertedCustomerId) {
            throw new BadRequestException('Lead belum di-convert ke Customer. Convert dulu.');
        }
        const cust = await this.prisma.customer.findUnique({
            where: { id: lead.convertedCustomerId },
        });
        if (!cust) throw new NotFoundException(`Customer converted (id=${lead.convertedCustomerId}) tidak ditemukan`);

        // Parse additionalEvents JSON dari Lead (kalau ada)
        const leadAdditionalEvents = (lead as any).additionalEvents as
            | Array<{ name?: string | null; location?: string | null; dateStart?: string | null; dateEnd?: string | null }>
            | null
            | undefined;

        return this.create({
            quotationVariant: variant,
            brand: (lead.brand as any) ?? null,
            customerId: cust.id,
            clientName: cust.companyPIC ?? cust.name,
            clientCompany: cust.companyName ?? undefined,
            clientAddress: cust.address ?? undefined,
            clientPhone: cust.phone ?? undefined,
            clientEmail: cust.email ?? undefined,
            // Event utama — dari Lead
            projectName: lead.orderDescription ?? undefined,
            eventLocation: lead.eventLocation ?? undefined,
            eventDateStart: (lead as any).eventDateStart
                ? new Date((lead as any).eventDateStart).toISOString()
                : undefined,
            eventDateEnd: (lead as any).eventDateEnd
                ? new Date((lead as any).eventDateEnd).toISOString()
                : undefined,
            // Multi-event dari Lead
            additionalEvents: Array.isArray(leadAdditionalEvents) && leadAdditionalEvents.length > 0
                ? leadAdditionalEvents.map((ev) => ({
                    name: ev.name ?? null,
                    location: ev.location ?? null,
                    dateStart: ev.dateStart ?? null,
                    dateEnd: ev.dateEnd ?? null,
                }))
                : null,
            notes: lead.notes ?? undefined,
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
