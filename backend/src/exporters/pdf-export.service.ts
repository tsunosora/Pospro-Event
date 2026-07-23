import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import type { Browser } from 'puppeteer';
import { QuotationContextBuilder, rupiahInWords } from './quotation-context.builder';

type TemplateKey = 'sewa' | 'pengadaan-booth' | 'spk' | 'rincian-pekerjaan';

/**
 * Slug brand untuk template per-brand. EXINDO→'exindo', XPOSER→'xposer'.
 * Brand lain / null → null (pakai base template `${key}.hbs`).
 */
function brandSlug(brand: string | null | undefined): string | null {
    if (brand === 'EXINDO') return 'exindo';
    if (brand === 'XPOSER') return 'xposer';
    return null;
}

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
    private compiledTemplates: Record<string, Handlebars.TemplateDelegate> = {};
    private partialsRegistered = false;
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

    /**
     * Registrasi Handlebars partials (items-table, totals, bank-list, text-sections) sekali saja.
     * Partials dipakai bersama oleh template per-brand supaya logika data (numbering per-kategori,
     * totals, terbilang, bank) single-source. Aman kalau folder `partials/` belum ada.
     */
    private ensurePartials(): void {
        if (this.partialsRegistered) return;
        const partialsDir = path.join(this.getTemplatesDir(), 'partials');
        if (fs.existsSync(partialsDir)) {
            for (const f of fs.readdirSync(partialsDir)) {
                if (!f.endsWith('.hbs')) continue;
                const name = f.replace(/\.hbs$/, '');
                const src = fs.readFileSync(path.join(partialsDir, f), 'utf-8');
                Handlebars.registerPartial(name, src);
            }
        }
        this.partialsRegistered = true;
    }

    private loadTemplate(key: TemplateKey, brand?: string | null): Handlebars.TemplateDelegate {
        this.ensurePartials();
        const slug = brandSlug(brand);
        const cacheKey = slug ? `${key}-${slug}` : key;
        const cached = this.compiledTemplates[cacheKey];
        if (cached) return cached;

        const dir = this.getTemplatesDir();
        // Coba template brand-specific dulu, lalu fallback ke base `${key}.hbs`.
        const candidates = slug
            ? [path.join(dir, `${key}-${slug}.hbs`), path.join(dir, `${key}.hbs`)]
            : [path.join(dir, `${key}.hbs`)];
        const file = candidates.find((c) => fs.existsSync(c));
        if (!file) {
            throw new Error(`Template tidak ditemukan (key=${key}, brand=${brand ?? 'null'}). Dicoba: ${candidates.join(', ')}`);
        }
        const source = fs.readFileSync(file, 'utf-8');
        const compiled = Handlebars.compile(source);
        this.compiledTemplates[cacheKey] = compiled;
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

    async renderQuotationPdf(quotationId: number, dpPaid?: number): Promise<Buffer> {
        const ctx = await this.contextBuilder.build(quotationId, { dpPaid });
        const key: TemplateKey = ctx.doc.templateKey;
        const template = this.loadTemplate(key, ctx.brand);
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

        // Mode tampilan tabel SPK — mengikuti itemDisplayMode quotation (sama dengan preview Penawaran).
        //   - 'detailed': tabel 3 kolom (No, Uraian, Qty) — kolom Qty terpisah
        //   - 'category-summary': tabel 2 kolom (No, Uraian) — qty inline di Uraian
        // SPK tidak punya kolom harga / subtotal / grand total (sesuai konvensi SPK).
        // Tabel pakai ctx.itemGroups langsung — penomoran restart per kategori (group.nextNo
        // di builder), konsisten dengan render Penawaran.
        const isCategorySummary = rawQuotation?.itemDisplayMode === 'category-summary';

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
                isCategorySummary,
                paymentDeadlineFormatted: spkPaymentDeadlineFormatted,
            },
        };
        const template = this.loadTemplate('spk', ctx.brand);
        return this.renderHtmlToPdf(template(spkCtx));
    }

    /**
     * Render dokumen "Rincian Pekerjaan" — daftar item pekerjaan (No, Uraian, Volume, Satuan, Keterangan).
     * Model SNAPSHOT EDITABLE (dikelola di halaman khusus /penawaran/[id]/rincian):
     *   - kalau `rincianPekerjaanItems` sudah diisi → pakai daftar itu (snapshot yang diedit user);
     *   - kalau masih kosong/null → derive dari item penawaran (belum pernah dibuat).
     * Daftar rincian terpisah total dari item penawaran — mengeditnya tidak menyentuh penawaran.
     */
    async renderRincianPekerjaanPdf(quotationId: number): Promise<Buffer> {
        const ctx = await this.contextBuilder.build(quotationId);
        const raw = await this.contextBuilder.fetchRaw(quotationId);

        const stored = Array.isArray(raw?.rincianPekerjaanItems)
            ? (raw!.rincianPekerjaanItems as Array<{ description?: string; volume?: string; unit?: string; note?: string }>)
            : null;

        const rows = (stored && stored.length > 0)
            ? stored.map((r) => ({
                description: (r?.description ?? '').toString(),
                volume: (r?.volume ?? '').toString(),
                unit: (r?.unit ?? '').toString(),
                note: (r?.note ?? '').toString(),
            }))
            : ctx.items.map((it) => ({
                description: it.description,
                volume: it.quantity,   // sudah ter-format di builder
                unit: it.unit,
                note: '',
            }));

        // Jadwal pasang/bongkar khusus dokumen Rincian Pekerjaan (tidak memengaruhi penawaran).
        const installDateFormatted = raw?.rincianInstallDate
            ? formatDateLocal(raw.rincianInstallDate, ctx.language)
            : null;
        const dismantleDateFormatted = raw?.rincianDismantleDate
            ? formatDateLocal(raw.rincianDismantleDate, ctx.language)
            : null;

        const template = this.loadTemplate('rincian-pekerjaan', ctx.brand);
        return this.renderHtmlToPdf(template({
            ...ctx,
            doc: { ...ctx.doc, subject: 'Rincian Pekerjaan' },
            rincian: { rows, installDateFormatted, dismantleDateFormatted },
        }));
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

