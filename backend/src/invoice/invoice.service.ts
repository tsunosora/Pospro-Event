import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceStatus, InvoiceType } from '@prisma/client';
import { DocumentNumberService } from '../document-numbers/document-number.service';

@Injectable()
export class InvoiceService {
    constructor(
        private prisma: PrismaService,
        private docNumberService: DocumentNumberService,
    ) { }

    async create(data: any) {
        const { items, ...invoiceData } = data;
        return this.prisma.invoice.create({
            data: {
                ...invoiceData,
                items: { create: items ?? [] },
            },
            include: { items: true },
        });
    }

    async findAll(type?: InvoiceType) {
        return this.prisma.invoice.findMany({
            where: type ? { type } : undefined,
            orderBy: { date: 'desc' },
            include: { items: true },
        });
    }

    async findOne(id: number) {
        const inv = await this.prisma.invoice.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!inv) throw new NotFoundException('Invoice not found');
        return inv;
    }

    async update(id: number, data: any) {
        const inv = await this.prisma.invoice.findUnique({ where: { id } });
        if (!inv) throw new NotFoundException('Invoice not found');

        const { items, ...invoiceData } = data;

        return this.prisma.$transaction(async (tx) => {
            if (items !== undefined) {
                await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
            }
            await tx.invoice.update({
                where: { id },
                data: {
                    ...invoiceData,
                    ...(items !== undefined ? { items: { create: items } } : {}),
                },
            });
            return tx.invoice.findUnique({ where: { id }, include: { items: true } });
        });
    }

    async updateStatus(id: number, status: InvoiceStatus) {
        return this.prisma.invoice.update({ where: { id }, data: { status } });
    }

    async updateType(id: number, type: InvoiceType) {
        return this.prisma.invoice.update({ where: { id }, data: { type } });
    }

    async convertToInvoice(id: number) {
        const quotation = await this.prisma.invoice.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!quotation) throw new NotFoundException('Quotation not found');

        const now = new Date();
        const seq = await this.docNumberService.nextSequence('INV', 'INV', now.getFullYear());
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const newNumber = `INV-${dateStr}-${seq.toString().padStart(4, '0')}`;

        return this.prisma.invoice.create({
            data: {
                invoiceNumber: newNumber,
                type: InvoiceType.INVOICE,
                clientName: quotation.clientName,
                clientCompany: quotation.clientCompany,
                clientEmail: quotation.clientEmail,
                clientAddress: quotation.clientAddress,
                clientPhone: quotation.clientPhone,
                dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                subtotal: quotation.subtotal,
                taxRate: quotation.taxRate,
                taxAmount: quotation.taxAmount,
                discount: quotation.discount,
                total: quotation.total,
                notes: quotation.notes,
                status: InvoiceStatus.DRAFT,
                items: {
                    create: quotation.items.map(item => ({
                        description: item.description,
                        unit: item.unit,
                        quantity: item.quantity,
                        price: item.price,
                    })),
                },
            },
            include: { items: true },
        });
    }

    async remove(id: number) {
        const inv = await this.prisma.invoice.findUnique({ where: { id } });
        if (!inv) throw new NotFoundException('Invoice not found');
        return this.prisma.invoice.delete({ where: { id } });
    }
}
