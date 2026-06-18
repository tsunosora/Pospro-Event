import { BadRequestException } from '@nestjs/common';
import { Prisma, InvoiceType } from '@prisma/client';
import { QuotationsService } from './quotations.service';

/**
 * Regression test untuk bug double-count DP invoice PELUNASAN.
 * Kasus acuan: PT. Hengtai Print — total 79.100.000, DP custom 36.000.000,
 * dpPercent 0. Sisa PELUNASAN yang benar = 43.100.000 (BUKAN total penuh).
 *
 * Semua Prisma di-mock — tidak menyentuh DB. Tujuannya memastikan logika
 * `amountToPay` & guard over-payment benar SEBELUM deploy ke server online.
 */
describe('QuotationsService — fix double-count DP PELUNASAN', () => {
    let service: QuotationsService;
    let prisma: any;
    let docNumber: any;
    let captured: { data?: any };

    beforeEach(() => {
        captured = {};
        prisma = {
            invoice: {
                findUnique: jest.fn(),
                create: jest.fn((args: any) => {
                    captured.data = args.data;
                    return Promise.resolve({ id: 999, ...args.data, items: [] });
                }),
                update: jest.fn(),
            },
            storeSettings: { findFirst: jest.fn().mockResolvedValue({ companyCode: 'Xp' }) },
            brandSettings: { findUnique: jest.fn() },
            quotationVariantConfig: { findUnique: jest.fn() },
            $transaction: jest.fn(),
        };
        docNumber = { nextSequence: jest.fn().mockResolvedValue(5300) };
        service = new QuotationsService(prisma as any, docNumber as any);
    });

    const dec = (v: string | number) => new Prisma.Decimal(v);

    describe('generateInvoiceFromQuotation', () => {
        const baseQuotation = (over: any = {}) => ({
            id: 1,
            type: InvoiceType.QUOTATION,
            invoiceNumber: '5266/Xp/Inv/V/26',
            brand: null,
            items: [],
            pphAmount: dec(0),
            ...over,
        });

        it('PELUNASAN dengan DP custom → amountToPay = total − dpPaidCustom (43,1jt)', async () => {
            prisma.invoice.findUnique.mockResolvedValue(
                baseQuotation({
                    total: dec('79100000'),
                    dpPercent: dec('0'),
                    dpPaidMode: 'custom',
                    dpPaidCustom: dec('36000000'),
                }),
            );

            await service.generateInvoiceFromQuotation(1, { part: 'PELUNASAN' });

            expect(Number(captured.data.amountToPay)).toBe(43_100_000);
            // BUKAN total penuh — inti bug-nya:
            expect(Number(captured.data.amountToPay)).not.toBe(79_100_000);
        });

        it('PELUNASAN tanpa DP custom (mode normal) → sisa = total − dpPercent%', async () => {
            prisma.invoice.findUnique.mockResolvedValue(
                baseQuotation({
                    total: dec('18000000'),
                    dpPercent: dec('50'),
                    dpPaidMode: null,
                    dpPaidCustom: null,
                }),
            );

            await service.generateInvoiceFromQuotation(1, { part: 'PELUNASAN' });

            expect(Number(captured.data.amountToPay)).toBe(9_000_000);
        });

        it('DP part tetap = total × dpPercent% (tidak berubah)', async () => {
            prisma.invoice.findUnique.mockResolvedValue(
                baseQuotation({
                    total: dec('18000000'),
                    dpPercent: dec('50'),
                    dpPaidMode: null,
                    dpPaidCustom: null,
                }),
            );

            await service.generateInvoiceFromQuotation(1, { part: 'DP' });

            expect(Number(captured.data.amountToPay)).toBe(9_000_000);
        });
    });

    describe('create() — invoice langsung PELUNASAN', () => {
        it('tanpa amountToPay eksplisit + DP custom → default ke total − dpPaidCustom', async () => {
            const dto: any = {
                type: 'INVOICE',
                invoicePart: 'PELUNASAN',
                clientName: 'PT. Hengtai Print Indonesia',
                quotationVariant: 'SEWA',
                dpPercent: 0,
                dpPaidMode: 'custom',
                dpPaidCustom: 36_000_000,
                items: [{ description: 'Booth', quantity: 1, price: 79_100_000 }],
            };

            await service.create(dto);

            expect(captured.data.invoicePart).toBe('PELUNASAN');
            expect(Number(captured.data.amountToPay)).toBe(43_100_000);
        });

        it('amountToPay eksplisit tetap dihormati (tidak di-override)', async () => {
            const dto: any = {
                type: 'INVOICE',
                invoicePart: 'PELUNASAN',
                clientName: 'X',
                quotationVariant: 'SEWA',
                dpPercent: 0,
                dpPaidMode: 'custom',
                dpPaidCustom: 36_000_000,
                amountToPay: 40_000_000,
                items: [{ description: 'Booth', quantity: 1, price: 79_100_000 }],
            };

            await service.create(dto);

            expect(Number(captured.data.amountToPay)).toBe(40_000_000);
        });
    });

    describe('markInvoicePaid() — guard over-payment', () => {
        const invoice192 = {
            id: 192,
            type: InvoiceType.INVOICE,
            status: 'SENT',
            invoiceNumber: '5300rev1/Xp/Inv/VI/26',
            amountToPay: dec('43100000'),
            total: dec('79100000'),
            paidAmount: dec('0'),
            paymentCashflowId: null,
        };

        it('menolak pembayaran yang melebihi tagihan (cegah DP dobel)', async () => {
            prisma.invoice.findUnique.mockResolvedValue({ ...invoice192 });

            // Admin keliru input 79,1jt padahal target cuma 43,1jt → harus ditolak.
            await expect(
                service.markInvoicePaid(192, { amount: 79_100_000 }),
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it('menerima pembayaran tepat sisa & membuat 1 cashflow saja', async () => {
            prisma.invoice.findUnique.mockResolvedValue({ ...invoice192 });

            const tx = {
                invoicePayment: {
                    count: jest.fn().mockResolvedValue(0),
                    create: jest.fn().mockResolvedValue({}),
                },
                cashflow: { create: jest.fn().mockResolvedValue({ id: 1 }) },
                invoice: { update: jest.fn().mockResolvedValue({ id: 192, items: [] }) },
            };
            prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

            await service.markInvoicePaid(192, {
                amount: 43_100_000,
                createCashflow: true,
                paymentMethod: 'BANK_TRANSFER',
            });

            expect(tx.cashflow.create).toHaveBeenCalledTimes(1);
            const cfArg = tx.cashflow.create.mock.calls[0][0];
            expect(Number(cfArg.data.amount)).toBe(43_100_000);
            expect(cfArg.data.type).toBe('INCOME');
        });
    });
});
