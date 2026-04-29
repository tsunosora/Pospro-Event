import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Convert public upload URL (mis. "/uploads/abc.png") jadi data URI base64
 * agar Puppeteer bisa embed image ke PDF tanpa server lookup.
 */
function imageToDataUri(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    if (!url.startsWith('/uploads/')) return url; // assume external URL
    try {
        const filePath = path.resolve(process.cwd(), 'public', url.replace(/^\//, ''));
        if (!fs.existsSync(filePath)) return null;
        const ext = path.extname(filePath).slice(1).toLowerCase() || 'png';
        const mime = ext === 'jpg' ? 'jpeg' : ext;
        const buf = fs.readFileSync(filePath);
        return `data:image/${mime};base64,${buf.toString('base64')}`;
    } catch {
        return null;
    }
}

export interface QuotationRenderItem {
    no: number;
    description: string;
    unit: string;
    quantity: string;       // formatted
    price: string;          // Rp formatted
    subtotal: string;       // Rp formatted
    categoryName?: string | null;
}

export interface QuotationItemGroup {
    categoryName: string | null;     // null = "Lainnya" / tanpa kategori
    items: QuotationRenderItem[];
    subtotalNum: number;
    subtotalFormatted: string;
}

export interface QuotationRenderContext {
    // Identitas perusahaan
    company: {
        name: string;
        address: string;
        phone: string;
        email: string;
        logoUrl: string | null;
        letterheadUrl: string | null;     // kop surat full-page background image
        directorName: string;
        npwp?: string | null;
    };
    // Penandatangan surat (marketing/sales). Kalau null → fallback director brand
    signedBy: {
        name: string;
        position: string | null;
        signatureUrl: string | null;
        stampUrl: string | null;
    };
    // Custom text per brand (override default ketentuan)
    brandTexts: {
        disclaimer: string | null;          // "# Harga belum termasuk..." (penawaran)
        paymentTerms: string | null;        // "Sedangkan system pembayaran..." (penawaran)
        closing: string | null;             // "Demikian penawaran..." (penawaran)
        invoiceClosing: string | null;      // "Nb: Jika terjadi pembatalan..." (invoice)
    };
    // Grouped items (untuk render per-kategori dengan header tebal)
    itemGroups: QuotationItemGroup[];
    // Dokumen
    doc: {
        number: string;
        variant: 'SEWA' | 'PENGADAAN_BOOTH';
        variantCode: string | null;            // kode dari QuotationVariantConfig (kalau ada)
        templateKey: 'sewa' | 'pengadaan-booth';
        variantLabel: string;
        subject: string;         // "Penawaran Sewa Perlengkapan Event" dst.
        dateFormatted: string;   // "24 April 2026"
        city: string;
        validUntilFormatted: string | null;
        isRevision: boolean;
        revisionNumber: number;
        // Invoice-specific (kalau type=INVOICE)
        isInvoice: boolean;
        invoicePart: string | null;          // "DP" | "PELUNASAN" | "FULL"
        invoicePartLabel: string | null;     // "INVOICE — DOWN PAYMENT" / dst
        amountToPayFormatted: string | null; // jumlah ditagihkan
        amountToPayTerbilang: string | null;
        dueDateFormatted: string | null;
        // Display mode untuk item table
        itemDisplayMode: 'detailed' | 'category-summary';   // default 'detailed'
        isCategorySummary: boolean;          // kalau true → hide harga per item, hanya subtotal kategori
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

function buildInvoicePartLabel(part: string | null | undefined): string {
    if (part === 'DP') return 'INVOICE — DOWN PAYMENT';
    if (part === 'PELUNASAN') return 'INVOICE — PELUNASAN';
    if (part === 'FULL') return 'INVOICE';
    return 'INVOICE';
}

function buildInvoiceSubject(part: string | null | undefined, variantLabel: string): string {
    const base = buildInvoicePartLabel(part);
    return `${base} — ${variantLabel}`;
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
                signedByWorker: {
                    select: {
                        id: true, name: true, position: true,
                        signatureImageUrl: true, stampImageUrl: true,
                    },
                },
            },
        });
        if (!quotation) throw new Error(`Penawaran id=${quotationId} tidak ditemukan`);

        const settings = await this.prisma.storeSettings.findFirst();

        // Brand-aware: kalau quotation punya brand, ambil header dari BrandSettings.
        // Fallback ke StoreSettings (legacy/generic).
        const brandSettings = quotation.brand
            ? await this.prisma.brandSettings.findUnique({ where: { brand: quotation.brand } })
            : null;

        // Bank accounts: prioritas quotation.bankAccountIds → brand.bankAccountIds → empty
        const bankIdsRaw =
            (quotation.bankAccountIds && quotation.bankAccountIds.trim())
                ? quotation.bankAccountIds
                : (brandSettings?.bankAccountIds ?? '');
        const bankIds = bankIdsRaw
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !Number.isNaN(n));
        const banks = bankIds.length
            ? await this.prisma.bankAccount.findMany({ where: { id: { in: bankIds } } })
            : [];

        // Resolve variant label/subject/templateKey:
        //   1. Kalau ada quotation.variantCode → load config dari QuotationVariantConfig
        //   2. Fallback ke enum quotation.quotationVariant (legacy / built-in)
        const variantConfig = quotation.variantCode
            ? await this.prisma.quotationVariantConfig.findUnique({ where: { code: quotation.variantCode } })
            : null;

        let variantLabel: string;
        let templateKey: 'sewa' | 'pengadaan-booth';
        let subjectText: string;
        if (variantConfig) {
            variantLabel = variantConfig.label;
            templateKey = (variantConfig.templateKey === 'sewa' ? 'sewa' : 'pengadaan-booth');
            subjectText = variantConfig.subject?.trim() || `Penawaran ${variantConfig.label}`;
        } else {
            variantLabel = quotation.quotationVariant === 'PENGADAAN_BOOTH'
                ? 'Pengadaan Booth Special Design'
                : 'Sewa Perlengkapan Event';
            templateKey = quotation.quotationVariant === 'PENGADAAN_BOOTH' ? 'pengadaan-booth' : 'sewa';
            subjectText = `Penawaran ${variantLabel}`;
        }

        const items: QuotationRenderItem[] = quotation.items.map((it, idx) => ({
            no: idx + 1,
            description: it.description,
            unit: it.unit ?? '',
            quantity: formatQty(it.quantity.toString(), it.unit),
            price: formatRp(it.price.toString()),
            subtotal: formatRp(Number(it.quantity) * Number(it.price)),
            categoryName: it.categoryName ?? null,
        }));

        // Group items by categoryName.
        // PENTING: kalau item tidak punya categoryName, OTOMATIS inherit kategori dari item SEBELUMNYA
        // (asumsi user lupa atau sengaja kosongkan karena ingin gabung ke grup atasnya).
        // Hanya item paling pertama yang tanpa kategori jadi __UNCATEGORIZED__.
        const groupMap = new Map<string, { items: QuotationRenderItem[]; subtotalNum: number }>();
        const categoryOrder: string[] = [];
        let runningNo = 0;
        let lastCategory: string | null = null;
        for (let i = 0; i < quotation.items.length; i++) {
            const it = quotation.items[i];
            // Resolve effective category: explicit categoryName, atau inherit dari sebelumnya
            const effectiveCategory = it.categoryName ?? lastCategory;
            const catKey = effectiveCategory ?? '__UNCATEGORIZED__';
            if (!groupMap.has(catKey)) {
                categoryOrder.push(catKey);
                groupMap.set(catKey, { items: [], subtotalNum: 0 });
            }
            const group = groupMap.get(catKey)!;
            runningNo += 1;
            group.items.push({
                no: runningNo,
                description: it.description,
                unit: it.unit ?? '',
                quantity: formatQty(it.quantity.toString(), it.unit),
                price: formatRp(it.price.toString()),
                subtotal: formatRp(Number(it.quantity) * Number(it.price)),
                categoryName: effectiveCategory,
            });
            group.subtotalNum += Number(it.quantity) * Number(it.price);
            // Update lastCategory hanya kalau item ini PUNYA categoryName eksplisit
            if (it.categoryName) {
                lastCategory = it.categoryName;
            }
        }
        const itemGroups: QuotationItemGroup[] = categoryOrder.map((key) => {
            const g = groupMap.get(key)!;
            return {
                categoryName: key === '__UNCATEGORIZED__' ? null : key,
                items: g.items,
                subtotalNum: g.subtotalNum,
                subtotalFormatted: formatRp(g.subtotalNum),
            };
        });

        const subtotalNum = Number(quotation.subtotal);
        const totalNum = Number(quotation.total);
        const dpPercentNum = Number(quotation.dpPercent);
        const dpAmount = (totalNum * dpPercentNum) / 100;
        const pelunasan = totalNum - dpAmount;

        return {
            company: {
                name: brandSettings?.companyName ?? settings?.storeName ?? '',
                address: brandSettings?.address ?? settings?.storeAddress ?? '',
                phone: brandSettings?.phone ?? settings?.storePhone ?? '',
                email: brandSettings?.email ?? settings?.companyEmail ?? '',
                logoUrl: imageToDataUri(brandSettings?.logoImageUrl ?? settings?.logoImageUrl ?? null),
                letterheadUrl: imageToDataUri(brandSettings?.letterheadImageUrl ?? null),
                directorName: brandSettings?.directorName ?? settings?.directorName ?? '',
                npwp: brandSettings?.npwp ?? null,
            },
            signedBy: {
                // Kalau quotation punya signedByWorker → pakai itu (marketing yang handle)
                // Kalau tidak → fallback ke directorName brand
                name: quotation.signedByWorker?.name
                    ?? brandSettings?.directorName
                    ?? settings?.directorName
                    ?? '',
                position: quotation.signedByWorker?.position ?? null,
                signatureUrl: imageToDataUri(quotation.signedByWorker?.signatureImageUrl ?? null),
                // Stempel: prioritas worker → brand fallback
                stampUrl: imageToDataUri(
                    quotation.signedByWorker?.stampImageUrl
                    ?? brandSettings?.stampImageUrl
                    ?? null
                ),
            },
            brandTexts: {
                disclaimer: brandSettings?.quotationDisclaimer ?? null,
                paymentTerms: brandSettings?.quotationPaymentTerms ?? null,
                closing: brandSettings?.quotationClosing ?? null,
                invoiceClosing: brandSettings?.invoiceClosingText ?? null,
            },
            itemGroups,
            doc: {
                number: quotation.invoiceNumber,
                variant: quotation.quotationVariant ?? 'SEWA',
                variantCode: quotation.variantCode,
                templateKey,
                variantLabel,
                subject: quotation.type === 'INVOICE'
                    ? buildInvoiceSubject(quotation.invoicePart, variantLabel)
                    : subjectText,
                dateFormatted: formatDateId(quotation.date),
                city: quotation.signCity?.trim()
                    || (brandSettings?.address?.split(',').pop()?.trim())
                    || (settings?.storeAddress?.split(',').pop()?.trim())
                    || 'Semarang',
                validUntilFormatted: quotation.validUntil ? formatDateId(quotation.validUntil) : null,
                isRevision: quotation.revisionNumber > 0,
                revisionNumber: quotation.revisionNumber,
                isInvoice: quotation.type === 'INVOICE',
                invoicePart: quotation.invoicePart,
                invoicePartLabel: quotation.invoicePart
                    ? buildInvoicePartLabel(quotation.invoicePart)
                    : null,
                amountToPayFormatted: quotation.amountToPay !== null && quotation.amountToPay !== undefined
                    ? formatRp(Number(quotation.amountToPay))
                    : null,
                amountToPayTerbilang: quotation.amountToPay !== null && quotation.amountToPay !== undefined
                    ? terbilangRupiah(Number(quotation.amountToPay))
                    : null,
                dueDateFormatted: quotation.dueDate ? formatDateId(quotation.dueDate) : null,
                itemDisplayMode: (quotation.itemDisplayMode === 'category-summary' ? 'category-summary' : 'detailed'),
                isCategorySummary: quotation.itemDisplayMode === 'category-summary',
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
