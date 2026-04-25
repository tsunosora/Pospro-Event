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
        if (!dto.quotationVariant) {
            throw new BadRequestException('quotationVariant wajib diisi (SEWA atau PENGADAAN_BOOTH)');
        }
        if (!dto.clientName) {
            throw new BadRequestException('clientName wajib diisi');
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
                quotationVariant: dto.quotationVariant,
                revisionNumber: 0,

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
                    })),
                },
            },
            include: { items: true, customer: true, children: true, parent: true },
        });
        return created;
    }

    async findAll(filter: { variant?: QuotationVariant; year?: number; status?: InvoiceStatus } = {}) {
        const where: Prisma.InvoiceWhereInput = {
            type: InvoiceType.QUOTATION,
            ...(filter.variant ? { quotationVariant: filter.variant } : {}),
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
            },
        });
    }

    async findOne(id: number): Promise<InvoiceWithItems> {
        const inv = await this.prisma.invoice.findUnique({
            where: { id },
            include: {
                items: { orderBy: { orderIndex: 'asc' } },
                customer: true,
                parent: true,
                children: { orderBy: { revisionNumber: 'asc' } },
            },
        });
        if (!inv || inv.type !== InvoiceType.QUOTATION) {
            throw new NotFoundException(`Penawaran id=${id} tidak ditemukan`);
        }
        return inv as InvoiceWithItems;
    }

    async update(id: number, dto: UpdateQuotationDto) {
        const existing = await this.prisma.invoice.findUnique({ where: { id } });
        if (!existing || existing.type !== InvoiceType.QUOTATION) {
            throw new NotFoundException(`Penawaran id=${id} tidak ditemukan`);
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
                    ...(dto.validUntil !== undefined
                        ? { validUntil: dto.validUntil ? new Date(dto.validUntil) : null }
                        : {}),
                    ...(dto.dpPercent !== undefined ? { dpPercent: toDecimal(dto.dpPercent) } : {}),
                    ...(dto.bankAccountIds !== undefined ? { bankAccountIds: dto.bankAccountIds } : {}),
                    ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
                    ...(dto.taxRate !== undefined ? { taxRate: toDecimal(dto.taxRate) } : {}),
                    ...(dto.discount !== undefined ? { discount: toDecimal(dto.discount) } : {}),
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
     * Reserve nomor resmi untuk penawaran (hanya kalau masih DRAFT-).
     * Ambil `companyCode` dari StoreSettings. Jika revisi (revisionNumber>0),
     * sisipkan suffix rev{n}.
     */
    async assignNumber(id: number) {
        const inv = await this.prisma.invoice.findUnique({ where: { id } });
        if (!inv || inv.type !== InvoiceType.QUOTATION) {
            throw new NotFoundException(`Penawaran id=${id} tidak ditemukan`);
        }
        if (!inv.invoiceNumber.startsWith(DRAFT_NUMBER_PREFIX)) {
            throw new BadRequestException(
                `Penawaran id=${id} sudah punya nomor resmi (${inv.invoiceNumber})`,
            );
        }

        const settings = await this.prisma.storeSettings.findFirst();
        const kode = settings?.companyCode?.trim();
        if (!kode) {
            throw new BadRequestException(
                'companyCode belum di-set di StoreSettings — atur dulu di /settings (mis. "Xp" atau "Ep")',
            );
        }

        const base = await this.docNumberService.assignForQuotation(kode, inv.date ?? new Date());
        const finalNumber = this.docNumberService.formatWithRevision(base, inv.revisionNumber);

        return this.prisma.invoice.update({
            where: { id },
            data: { invoiceNumber: finalNumber },
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

                items: {
                    create: source.items.map((it) => ({
                        description: it.description,
                        unit: it.unit,
                        quantity: it.quantity,
                        price: it.price,
                        orderIndex: it.orderIndex,
                        productVariantId: it.productVariantId,
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
        const inv = await this.prisma.invoice.findUnique({
            where: { id },
            include: { children: true },
        });
        if (!inv || inv.type !== InvoiceType.QUOTATION) {
            throw new NotFoundException(`Penawaran id=${id} tidak ditemukan`);
        }
        if (inv.children.length > 0) {
            throw new BadRequestException(
                `Penawaran id=${id} memiliki ${inv.children.length} revisi — hapus revisi dulu`,
            );
        }
        return this.prisma.invoice.delete({ where: { id } });
    }
}
