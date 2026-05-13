import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import type { Browser } from 'puppeteer';
import { QuotationContextBuilder, rupiahInWords } from './quotation-context.builder';

type TemplateKey = 'sewa' | 'pengadaan-booth' | 'spk';

// Register Handlebars helper "eq" — untuk {{#eq a b}}...{{/eq}} string equality check
Handlebars.registerHelper('eq', function (this: any, a: any, b: any, options: any) {
    return a === b ? options.fn(this) : options.inverse(this);
});
// "lowercase" helper — convert string ke huruf kecil semua. Dipakai di SPK template.
Handlebars.registerHelper('lowercase', function (s: any) {
    return typeof s === 'string' ? s.toLowerCase() : s;
});
// "addOne" — return @index + 1 (untuk display 1-based numbering di template)
Handlebars.registerHelper('addOne', function (n: any) {
    return Number(n) + 1;
});

@Injectable()
export class PdfExportService implements OnModuleDestroy {
    private compiledTemplates: Partial<Record<TemplateKey, Handlebars.TemplateDelegate>> = {};
    private browser: Browser | null = null;

    constructor(private contextBuilder: QuotationContextBuilder) { }

    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    private getTemplatesDir(): string {
        // dev: running from `src/` via ts-node -> __dirname = .../src/exporters
        // build: running from `dist/src/exporters` -> templates sit at app/backend/templates
        const candidates = [
            path.resolve(__dirname, '..', '..', 'templates', 'quotation'),
            path.resolve(__dirname, '..', '..', '..', 'templates', 'quotation'),
            path.resolve(process.cwd(), 'templates', 'quotation'),
        ];
        for (const c of candidates) if (fs.existsSync(c)) return c;
        throw new Error(`Templates folder tidak ditemukan. Sudah coba: ${candidates.join(', ')}`);
    }

    private loadTemplate(key: TemplateKey): Handlebars.TemplateDelegate {
        if (this.compiledTemplates[key]) return this.compiledTemplates[key]!;
        const file = path.join(this.getTemplatesDir(), `${key}.hbs`);
        const source = fs.readFileSync(file, 'utf-8');
        const compiled = Handlebars.compile(source);
        this.compiledTemplates[key] = compiled;
        return compiled;
    }

    private async getBrowser(): Promise<Browser> {
        if (this.browser && this.browser.connected) return this.browser;
        const puppeteer = await import('puppeteer');
        this.browser = await puppeteer.default.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        return this.browser;
    }

    async renderQuotationPdf(quotationId: number): Promise<Buffer> {
        const ctx = await this.contextBuilder.build(quotationId);
        const key: TemplateKey = ctx.doc.templateKey;
        const template = this.loadTemplate(key);
        return this.renderHtmlToPdf(template(ctx));
    }

    /**
     * Render Surat Perintah Kerja (SPK) — pakai template `spk.hbs` dengan format kontrak SPK Indonesia
     * (header tabular, paragraf utama, list spesifikasi, bullet pembayaran, TTD 2 kolom + materai).
     * Data sumber dari quotation context yang sama (uraian, harga, total, klien, vendor).
     */
    async renderSpkPdf(quotationId: number): Promise<Buffer> {
        const ctx = await this.contextBuilder.build(quotationId);
        const spkNumber = deriveSpkNumber(ctx.doc.number);

        // Ambil SPK-specific custom text dari raw quotation row (lewat builder pakai contextBuilder.prismaRaw).
        // Karena context.brandTexts udah resolved untuk Penawaran/Invoice, kita perlu fetch raw row
        // untuk override pakai customXSpk fields.
        const rawQuotation = await this.contextBuilder.fetchRaw(quotationId);
        const spkCustomOpening = rawQuotation?.customOpeningSpk?.trim() || null;
        const spkCustomDisclaimer = rawQuotation?.customDisclaimerSpk?.trim() || null;
        const spkCustomPaymentTerms = rawQuotation?.customPaymentTermsSpk?.trim() || null;
        const spkCustomClosing = rawQuotation?.customClosingSpk?.trim() || null;
        // SPK-specific PIC override — kalau di-set, ganti Penanggung Jawab di SPK header
        // tanpa pengaruh data klien di penawaran utama.
        const spkPicName = rawQuotation?.spkPicName?.trim() || null;
        const spkPicPosition = rawQuotation?.spkPicPosition?.trim() || null;
        const spkPicPhone = rawQuotation?.spkPicPhone?.trim() || null;
        // Batas Pelunasan SPK — fallback ke validUntil kalau gak di-set spesifik untuk SPK
        const spkPaymentDeadline = rawQuotation?.spkPaymentDeadline ?? rawQuotation?.validUntil ?? null;
        const spkPaymentDeadlineFormatted = spkPaymentDeadline
            ? formatDateLocal(spkPaymentDeadline, ctx.language)
            : null;

        // Hitung nominal DP & pelunasan dari total — terbilang dipakai di paragraf SPK.
        // Ambil DIRECT dari raw quotation (Decimal) — lebih reliable dibanding parse string formatted
        // yang rentan failure kalau format mata uang berbeda (id-ID vs en-US).
        const totalNum = rawQuotation?.total ? Number(rawQuotation.total) : parseRpNumber(ctx.totals.total);
        const dpPercent = rawQuotation?.dpPercent ? Number(rawQuotation.dpPercent) : (Number(ctx.payment.dpPercent) || 0);
        const dpAmountNum = (totalNum * dpPercent) / 100;
        const pelunasanNum = totalNum - dpAmountNum;
        // useUsd flag dari raw quotation row — supaya terbilang DP/Pelunasan pakai "US Dollars" kalau aktif
        const useUsd: boolean = Boolean(rawQuotation?.useUsdCurrency);

        // Catatan disclaimer untuk SPK — kalau ada SPK-specific custom, pakai itu.
        // Kalau gak, fallback ke brandTexts.disclaimer (yang sudah hasil combine custom+prepend+brand+append).
        const disclaimer: string = spkCustomDisclaimer ?? (ctx.brandTexts?.disclaimer ?? '');
        const disclaimerHashed = disclaimer
            .split(/\r?\n/)
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0)
            .map((line: string) => (line.startsWith('#') ? line : `# ${line}`))
            .join('\n');

        // Flatten itemGroups jadi list rapih untuk SPK: nomor urut consecutive (1,2,3,..)
        // di seluruh list. Kategori (kalau ada) di-insert sebagai row header.
        const specItems: Array<{
            isCategoryHeader?: boolean;
            label?: string;
            no?: number;
            description?: string;
            quantity?: string;
            unit?: string;
        }> = [];
        let runningNo = 0;
        for (const grp of ctx.itemGroups) {
            if (grp.categoryName) {
                specItems.push({ isCategoryHeader: true, label: grp.categoryName });
            }
            for (const it of grp.items) {
                runningNo += 1;
                // Skip quantity kalau 0 — gak perlu tampil "0 unit" di SPK.
                // it.quantity adalah hasil formatQty() yang nge-return "X unit" atau "X" (kalau no unit).
                const qtyStr = it.quantity?.trim() ?? '';
                const qtyNum = parseFloat(qtyStr) || 0;
                specItems.push({
                    no: runningNo,
                    description: it.description,
                    quantity: qtyNum > 0 ? qtyStr : undefined,
                    unit: it.unit,
                });
            }
        }

        const spkCtx = {
            ...ctx,
            doc: {
                ...ctx.doc,
                isSpk: true,
                number: spkNumber,
                subject: `SPK ${ctx.doc.variantLabel}`,
            },
            payment: {
                ...ctx.payment,
                dpAmountTerbilang: rupiahInWords(dpAmountNum, ctx.language, useUsd),
                pelunasanTerbilang: rupiahInWords(pelunasanNum, ctx.language, useUsd),
            },
            // Override customOpening untuk SPK kalau di-set (gak pengaruh penawaran)
            customOpening: spkCustomOpening || ctx.customOpening,
            // Override client info untuk SPK (Penanggung Jawab, Jabatan, No. Telp)
            // — fallback ke client utama kalau SPK-specific tidak di-set
            client: {
                ...ctx.client,
                name: spkPicName || ctx.client.name,
                phone: spkPicPhone || ctx.client.phone,
                ...(spkPicPosition ? { position: spkPicPosition } : {}),
            },
            // Override brandTexts dengan SPK-specific kalau di-set
            brandTexts: {
                ...ctx.brandTexts,
                disclaimer: spkCustomDisclaimer || ctx.brandTexts?.disclaimer || null,
                paymentTerms: spkCustomPaymentTerms || ctx.brandTexts?.paymentTerms || null,
                closing: spkCustomClosing || ctx.brandTexts?.closing || null,
            },
            spk: {
                // "exclude PPN dan PPH" cuma muncul kalau penawaran ini tidak include PPN (taxRate=0).
                // Kalau user sudah set PPN (mis. 11%), berarti harga sudah include — gak perlu "exclude".
                exclTax: Number(ctx.totals.taxRate) <= 0,
                disclaimerHashed,
                customPaymentTerms: spkCustomPaymentTerms,    // available di template kalau perlu
                customClosing: spkCustomClosing,
                specItems,
                paymentDeadlineFormatted: spkPaymentDeadlineFormatted,
            },
        };
        const template = this.loadTemplate('spk');
        return this.renderHtmlToPdf(template(spkCtx));
    }

    private async renderHtmlToPdf(html: string): Promise<Buffer> {
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        try {
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
            });
            return Buffer.from(pdf);
        } finally {
            await page.close();
        }
    }
}

/**
 * Derive nomor SPK dari nomor penawaran.
 * - "5260/Xp.Pnwr/V/26"   → "5260/Xp.SPK/V/26"
 * - "9791/EP/Pnwr/IV/2026" → "9791/SPK/EP/IV/2026" (format alt sesuai contoh referensi user)
 * - "DRAFT-1777..."       → "DRAFT-SPK-1777..."
 * - Fallback (gak match)  → prepend "SPK-"
 */
function deriveSpkNumber(quotationNumber: string): string {
    if (!quotationNumber) return 'SPK-DRAFT';
    if (quotationNumber.startsWith('DRAFT-')) {
        return quotationNumber.replace('DRAFT-', 'SPK-DRAFT-');
    }
    const replaced = quotationNumber.replace(/Pn[wr]+/gi, 'SPK').replace(/Penawaran/gi, 'SPK');
    if (replaced !== quotationNumber) return replaced;
    return `SPK-${quotationNumber}`;
}

/**
 * Parse nominal Rupiah string ("Rp 55.000.000" atau "USD 5,500.00") jadi number.
 * Untuk hitung DP & pelunasan di SPK template (yang butuh angka, bukan string formatted).
 *
 * BUG FIX: sebelumnya `lastDot > lastComma` salah trigger en-US branch saat input
 * id-ID multi-dot ("17.500.000") karena lastComma = -1. Akibatnya "17.500.000"
 * di-Number() langsung = NaN → 0 → terbilang kosong.
 */
function parseRpNumber(s: string): number {
    if (!s) return 0;
    // Strip prefix mata uang + char non-numerik (kecuali . , -)
    const cleaned = s.replace(/[^0-9.,-]/g, '').trim();
    if (!cleaned) return 0;

    const dotCount = (cleaned.match(/\./g) || []).length;
    const commaCount = (cleaned.match(/,/g) || []).length;
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');

    let normalized = cleaned;

    if (commaCount === 0 && dotCount > 1) {
        // id-ID multi-dot, no comma: "17.500.000" → semua dot = thousand
        normalized = cleaned.replace(/\./g, '');
    } else if (dotCount === 0 && commaCount > 1) {
        // en-US multi-comma, no dot: "17,500,000" → semua koma = thousand
        normalized = cleaned.replace(/,/g, '');
    } else if (dotCount > 0 && commaCount > 0) {
        // Ada keduanya — separator terakhir = decimal
        if (lastDot > lastComma) {
            // "5,500.00" → koma = thousand, titik = decimal (en-US)
            normalized = cleaned.replace(/,/g, '');
        } else {
            // "5.000.000,50" → titik = thousand, koma = decimal (id-ID)
            normalized = cleaned.replace(/\./g, '').replace(',', '.');
        }
    } else if (dotCount === 1) {
        // Single dot: ambiguous. Kalau angka setelah dot = 3 digit → thousand. Else = decimal.
        const afterDot = cleaned.length - lastDot - 1;
        normalized = afterDot === 3 ? cleaned.replace(/\./g, '') : cleaned;
    } else if (commaCount === 1) {
        // Single comma: ambiguous. Kalau angka setelah = 3 digit → thousand (id). Else = decimal (en).
        const afterComma = cleaned.length - lastComma - 1;
        normalized = afterComma === 3
            ? cleaned.replace(/,/g, '')
            : cleaned.replace(',', '.');
    } else {
        // No separator → angka utuh
        normalized = cleaned;
    }

    return Number(normalized) || 0;
}

/** Format Date jadi string lokal id-ID atau en-US (mis. "18 Mei 2026" / "18 May 2026"). */
function formatDateLocal(d: Date | string | null | undefined, lang: 'id' | 'en' = 'id'): string {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    const monthsId = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const months = lang === 'en' ? monthsEn : monthsId;
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

