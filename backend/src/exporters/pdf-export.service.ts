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

        // Hitung nominal DP & pelunasan dari total — terbilang dipakai di paragraf SPK.
        const totalNum = parseRpNumber(ctx.totals.total);
        const dpPercent = Number(ctx.payment.dpPercent) || 0;
        const dpAmountNum = (totalNum * dpPercent) / 100;
        const pelunasanNum = totalNum - dpAmountNum;

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
        }> = [];
        let runningNo = 0;
        for (const grp of ctx.itemGroups) {
            if (grp.categoryName) {
                specItems.push({ isCategoryHeader: true, label: grp.categoryName });
            }
            for (const it of grp.items) {
                runningNo += 1;
                specItems.push({
                    no: runningNo,
                    description: it.description,
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
                dpAmountTerbilang: rupiahInWords(dpAmountNum, ctx.language),
                pelunasanTerbilang: rupiahInWords(pelunasanNum, ctx.language),
            },
            // Override customOpening untuk SPK kalau di-set (gak pengaruh penawaran)
            customOpening: spkCustomOpening || ctx.customOpening,
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
 */
function parseRpNumber(s: string): number {
    if (!s) return 0;
    // Hapus prefix "Rp"/"USD" + spasi + separator (titik utk id-ID, koma utk en-US)
    // Pertahankan tanda minus & desimal terakhir (titik utk en-US, koma utk id-ID).
    const cleaned = s.replace(/[^0-9.,-]/g, '').trim();
    if (!cleaned) return 0;
    // Cek format: kalau mengandung koma & titik, koma = decimal (id) atau titik = decimal (en).
    // Heuristik: posisi karakter desimal terakhir (yang muncul terakhir) → desimal.
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    let normalized = cleaned;
    if (lastDot > lastComma) {
        // en-US format: "5,500.00" — koma = thousand, titik = decimal
        normalized = cleaned.replace(/,/g, '');
    } else if (lastComma > lastDot) {
        // id-ID format: "5.000.000,50" — titik = thousand, koma = decimal
        normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
        // Cuma satu jenis separator atau none — asumsi thousand (umum di id-ID)
        normalized = cleaned.replace(/[.,]/g, '');
    }
    return Number(normalized) || 0;
}

