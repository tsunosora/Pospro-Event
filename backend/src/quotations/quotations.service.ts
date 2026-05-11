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
                // Carry forward SPK & Invoice PIC override fields ke revisi
                ...(({
                    spkPicName: (source as any).spkPicName,
                    spkPicPosition: (source as any).spkPicPosition,
                    spkPicPhone: (source as any).spkPicPhone,
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
