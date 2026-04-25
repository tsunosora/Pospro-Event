import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface QuotationRenderItem {
    no: number;
    description: string;
    unit: string;
    quantity: string;       // formatted
    price: string;          // Rp formatted
    subtotal: string;       // Rp formatted
}

export interface QuotationRenderContext {
    // Identitas perusahaan
    company: {
        name: string;
        address: string;
        phone: string;
        email: string;
        logoUrl: string | null;
        directorName: string;
    };
    // Dokumen
    doc: {
        number: string;
        variant: 'SEWA' | 'PENGADAAN_BOOTH';
        variantLabel: string;
        subject: string;         // "Penawaran Sewa Perlengkapan Event" dst.
        dateFormatted: string;   // "24 April 2026"
        city: string;
        validUntilFormatted: string | null;
        isRevision: boolean;
        revisionNumber: number;
    };
    // Klien
    client: {
        name: string;
        company: string;
        address: string;
        phone: string;
        email: string;
    };
    // Event/proyek
    project: {
        name: string;
        location: string;
        dateRange: string;
    };
    // Items & totals
    items: QuotationRenderItem[];
    totals: {
        subtotal: string;
        taxRate: string;     // "11"
        taxAmount: string;
        discount: string;
        total: string;
        totalTerbilang: string;
    };
    // Pembayaran
    payment: {
        dpPercent: string;
        dpAmount: string;
        pelunasan: string;
        banks: Array<{ bankName: string; accountNumber: string; accountOwner: string }>;
    };
    notes: string | null;
}

const MONTH_ID = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function formatDateId(d: Date | null | undefined): string {
    if (!d) return '-';
    const date = new Date(d);
    return `${date.getDate()} ${MONTH_ID[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateRange(start: Date | null, end: Date | null): string {
    if (!start) return '-';
    const s = new Date(start);
    const e = end ? new Date(end) : null;
    if (!e || s.toDateString() === e.toDateString()) return formatDateId(s);
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
        return `${s.getDate()}-${e.getDate()} ${MONTH_ID[s.getMonth()]} ${s.getFullYear()}`;
    }
    return `${formatDateId(s)} - ${formatDateId(e)}`;
}

function formatRp(n: number | string): string {
    const num = Number(n || 0);
    return 'Rp ' + num.toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

function formatQty(n: number | string, unit: string | null | undefined): string {
    const num = Number(n || 0);
    const rounded = Number.isInteger(num) ? num.toString() : num.toFixed(2).replace(/\.?0+$/, '');
    return unit ? `${rounded} ${unit}` : rounded;
}

// Terbilang Rupiah sederhana (sampai triliun).
const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
function terbilang(n: number): string {
    n = Math.floor(Math.abs(n));
    if (n < 10) return SATUAN[n];
    if (n < 20) {
        if (n === 10) return 'sepuluh';
        if (n === 11) return 'sebelas';
        return SATUAN[n - 10] + ' belas';
    }
    if (n < 100) {
        const t = Math.floor(n / 10);
        const s = n % 10;
        return SATUAN[t] + ' puluh' + (s ? ' ' + SATUAN[s] : '');
    }
    if (n < 200) {
        const r = n - 100;
        return 'seratus' + (r ? ' ' + terbilang(r) : '');
    }
    if (n < 1000) {
        const t = Math.floor(n / 100);
        const r = n % 100;
        return SATUAN[t] + ' ratus' + (r ? ' ' + terbilang(r) : '');
    }
    if (n < 2000) {
        const r = n - 1000;
        return 'seribu' + (r ? ' ' + terbilang(r) : '');
    }
    if (n < 1_000_000) {
        const t = Math.floor(n / 1000);
        const r = n % 1000;
        return terbilang(t) + ' ribu' + (r ? ' ' + terbilang(r) : '');
    }
    if (n < 1_000_000_000) {
        const t = Math.floor(n / 1_000_000);
        const r = n % 1_000_000;
        return terbilang(t) + ' juta' + (r ? ' ' + terbilang(r) : '');
    }
    if (n < 1_000_000_000_000) {
        const t = Math.floor(n / 1_000_000_000);
        const r = n % 1_000_000_000;
        return terbilang(t) + ' miliar' + (r ? ' ' + terbilang(r) : '');
    }
    const t = Math.floor(n / 1_000_000_000_000);
    const r = n % 1_000_000_000_000;
    return terbilang(t) + ' triliun' + (r ? ' ' + terbilang(r) : '');
}

export function terbilangRupiah(n: number | string): string {
    const num = Number(n || 0);
    const txt = terbilang(num);
    return (txt.charAt(0).toUpperCase() + txt.slice(1) + ' rupiah').replace(/\s+/g, ' ');
}

@Injectable()
export class QuotationContextBuilder {
    constructor(private prisma: PrismaService) { }

    async build(quotationId: number): Promise<QuotationRenderContext> {
        const quotation = await this.prisma.invoice.findUnique({
            where: { id: quotationId },
            include: {
                items: { orderBy: { orderIndex: 'asc' } },
                customer: true,
            },
        });
        if (!quotation) throw new Error(`Penawaran id=${quotationId} tidak ditemukan`);

        const settings = await this.prisma.storeSettings.findFirst();

        const bankIds = (quotation.bankAccountIds ?? '')
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !Number.isNaN(n));
        const banks = bankIds.length
            ? await this.prisma.bankAccount.findMany({ where: { id: { in: bankIds } } })
            : [];

        const variantLabel =
            quotation.quotationVariant === 'PENGADAAN_BOOTH'
                ? 'Pengadaan Booth Special Design'
                : 'Sewa Perlengkapan Event';

        const items: QuotationRenderItem[] = quotation.items.map((it, idx) => ({
            no: idx + 1,
            description: it.description,
            unit: it.unit ?? '',
            quantity: formatQty(it.quantity.toString(), it.unit),
            price: formatRp(it.price.toString()),
            subtotal: formatRp(Number(it.quantity) * Number(it.price)),
        }));

        const subtotalNum = Number(quotation.subtotal);
        const totalNum = Number(quotation.total);
        const dpPercentNum = Number(quotation.dpPercent);
        const dpAmount = (totalNum * dpPercentNum) / 100;
        const pelunasan = totalNum - dpAmount;

        return {
            company: {
                name: settings?.storeName ?? '',
                address: settings?.storeAddress ?? '',
                phone: settings?.storePhone ?? '',
                email: settings?.companyEmail ?? '',
                logoUrl: settings?.logoImageUrl ?? null,
                directorName: settings?.directorName ?? '',
            },
            doc: {
                number: quotation.invoiceNumber,
                variant: quotation.quotationVariant ?? 'SEWA',
                variantLabel,
                subject: `Penawaran ${variantLabel}`,
                dateFormatted: formatDateId(quotation.date),
                city: (settings?.storeAddress?.split(',').pop()?.trim()) || 'Semarang',
                validUntilFormatted: quotation.validUntil ? formatDateId(quotation.validUntil) : null,
                isRevision: quotation.revisionNumber > 0,
                revisionNumber: quotation.revisionNumber,
            },
            client: {
                name: quotation.clientName,
                company: quotation.clientCompany ?? '',
                address: quotation.clientAddress ?? '',
                phone: quotation.clientPhone ?? '',
                email: quotation.clientEmail ?? '',
            },
            project: {
                name: quotation.projectName ?? '',
                location: quotation.eventLocation ?? '',
                dateRange: formatDateRange(quotation.eventDateStart, quotation.eventDateEnd),
            },
            items,
            totals: {
                subtotal: formatRp(subtotalNum),
                taxRate: Number(quotation.taxRate).toString(),
                taxAmount: formatRp(Number(quotation.taxAmount)),
                discount: formatRp(Number(quotation.discount)),
                total: formatRp(totalNum),
                totalTerbilang: terbilangRupiah(totalNum),
            },
            payment: {
                dpPercent: dpPercentNum.toString(),
                dpAmount: formatRp(dpAmount),
                pelunasan: formatRp(pelunasan),
                banks: banks.map((b) => ({
                    bankName: b.bankName,
                    accountNumber: b.accountNumber,
                    accountOwner: b.accountOwner,
                })),
            },
            notes: quotation.notes,
        };
    }
}
