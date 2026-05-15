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
    // Language: 'id' atau 'en' — controlling i18n labels
    language: 'id' | 'en';
    // i18n labels — dipakai di template untuk static UI text
    i18n: Record<string, string>;
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
    // Theme color per brand — dipakai di template PDF untuk header table, total label, accent
    theme: {
        primary: string;        // hex, mis. "#c8203a"
        primaryLight: string;   // shade tipis untuk bg subtotal cell, mis. "#fde2e6"
        primarySubtle: string;  // shade ultra tipis untuk bg row, mis. "#fff8f9"
        primaryDark: string;    // shade gelap untuk hover/text aksen, mis. "#8a1729"
    };
    // Custom opening paragraph — kalau quotation set customOpeningText, pakai itu (override template default)
    customOpening: string | null;
    // Pre-built HTML untuk invoice opening paragraph — dengan custom label dari BrandSettings.invoiceLabelOverrides.
    // Null kalau bukan invoice atau pakai customOpening manual.
    invoiceOpeningHtml: string | null;
    // Lampiran info — jumlah angka + terbilang (mis. {count: 1, label: "1 (satu)"})
    attachment: { count: number; label: string };
    // Custom text per brand (override default ketentuan) — kalau quotation set customX, pakai itu
    brandTexts: {
        disclaimer: string | null;          // "# Harga belum termasuk..." (penawaran)
        paymentTerms: string | null;        // "Sedangkan system pembayaran..." (penawaran)
        closing: string | null;             // "Demikian penawaran..." (penawaran)
        invoiceClosing: string | null;      // "Nb: Jika terjadi pembatalan..." (invoice)
    };
    // Grouped items (untuk render per-kategori dengan header tebal)
    itemGroups: QuotationItemGroup[];
    // Multi-event grouping (mode 'event-grouped'): items per event lokasi dengan subtotal
    itemsByEvent?: Array<{
        no: number;                       // 1-based display number
        eventIndex: number;
        eventName: string;
        eventLocation: string;
        eventDateRange: string;
        items: QuotationRenderItem[];
        subtotalNum: number;
        subtotalFormatted: string;
    }>;
    // Package grouping (mode 'package'): per-package list (untuk PDF Jalakx style)
    packages?: Array<{
        no: number;                       // 1-based display number
        name: string;
        items: QuotationRenderItem[];
        subtotalFormatted: string | null;
        /** Specs khusus untuk paket ini (PDF Jalakx Package 1/2/3 spec list). */
        specs?: Array<{ title: string | null; items: string[] }>;
    }>;
    // Mode display final yang dipilih (auto-detect dari itemDisplayMode + ada-tidaknya eventIndex/packageGroup)
    displayMode: 'detailed' | 'category-summary' | 'event-grouped' | 'package';
    // Payment schedule (kalau di-set, override DP/pelunasan default)
    paymentSchedule?: Array<{
        label: string;
        percent: number;
        amountFormatted: string;
        amountTerbilang: string;
    }> | null;
    // Specifications terpisah (sesuai PDF Nukahiji style).
    // Sudah TIDAK include yang punya packageGroup (yang sudah di-attach ke packages[]).
    specifications?: Array<{
        title: string | null;
        items: string[];
    }> | null;
    // Harga paket (kalau di-set & > 0 → tampil "Total / Harga Paket" di footer)
    packagePriceFormatted?: string | null;
    // Tampilkan grand total? Default true. False untuk mode 'package'.
    showGrandTotal: boolean;
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
        isSpk?: boolean;                     // kalau true → render sebagai SPK (Surat Perintah Kerja)
        invoicePart: string | null;          // "DP" | "PELUNASAN" | "FULL"
        invoicePartLabel: string | null;     // "INVOICE — DOWN PAYMENT" / dst
        amountToPayFormatted: string | null; // jumlah ditagihkan
        amountToPayTerbilang: string | null;
        dueDateFormatted: string | null;
        // Display mode untuk item table
        itemDisplayMode: 'detailed' | 'category-summary';   // default 'detailed'
        isCategorySummary: boolean;          // kalau true → hide harga per item, hanya subtotal kategori
        // Mode flags baru — dipakai di template untuk conditional rendering
        isEventGrouped?: boolean;            // mode 'event-grouped' aktif (item per event)
        isPackageMode?: boolean;             // mode 'package' aktif (PDF Jalakx style)
    };
    // Klien
    client: {
        name: string;
        company: string;
        address: string;
        phone: string;
        email: string;
        /** Jabatan PIC (mis. "CEO", "Direktur"). Cuma dipakai di SPK kalau di-set. */
        position?: string | null;
    };
    // Event/proyek (event UTAMA)
    project: {
        name: string;
        location: string;
        dateRange: string;
    };
    // Multi-event: index 0 = event utama, sisanya additional events
    events: Array<{
        name: string;
        location: string;
        dateRange: string;
    }>;
    hasMultipleEvents: boolean;
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
const MONTH_EN = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function monthName(idx: number, lang: 'id' | 'en' = 'id'): string {
    return (lang === 'en' ? MONTH_EN : MONTH_ID)[idx];
}

function formatDateId(d: Date | null | undefined, lang: 'id' | 'en' = 'id'): string {
    if (!d) return '-';
    const date = new Date(d);
    if (lang === 'en') {
        // Format English: "21 June 2026" — day month year (international/British style for business)
        return `${date.getDate()} ${MONTH_EN[date.getMonth()]} ${date.getFullYear()}`;
    }
    return `${date.getDate()} ${MONTH_ID[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateRange(start: Date | null, end: Date | null, lang: 'id' | 'en' = 'id'): string {
    if (!start) return '-';
    const s = new Date(start);
    const e = end ? new Date(end) : null;
    if (!e || s.toDateString() === e.toDateString()) return formatDateId(s, lang);
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
        return `${s.getDate()}-${e.getDate()} ${monthName(s.getMonth(), lang)} ${s.getFullYear()}`;
    }
    return `${formatDateId(s, lang)} - ${formatDateId(e, lang)}`;
}

/**
 * Build daftar events untuk multi-event quotation.
 * Index 0 = event UTAMA (dari kolom projectName/eventLocation/eventDateStart/eventDateEnd).
 * Sisanya dari kolom JSON `additionalEvents`.
 * Skip entri yang benar-benar kosong (tidak ada nama/lokasi/tanggal).
 */
function buildEventsList(quotation: any, lang: 'id' | 'en' = 'id'): Array<{
    name: string;
    location: string;
    dateRange: string;
}> {
    const result: Array<{ name: string; location: string; dateRange: string }> = [];
    // Event utama
    const mainName = (quotation.projectName ?? '').toString().trim();
    const mainLoc = (quotation.eventLocation ?? '').toString().trim();
    const mainStart = quotation.eventDateStart ?? null;
    const mainEnd = quotation.eventDateEnd ?? null;
    if (mainName || mainLoc || mainStart || mainEnd) {
        result.push({
            name: mainName,
            location: mainLoc,
            dateRange: formatDateRange(mainStart, mainEnd, lang),
        });
    }
    // Event tambahan (JSON column)
    const extras = quotation.additionalEvents;
    if (Array.isArray(extras)) {
        for (const e of extras) {
            const n = (e?.name ?? '').toString().trim();
            const l = (e?.location ?? '').toString().trim();
            const ds = e?.dateStart ? new Date(e.dateStart) : null;
            const de = e?.dateEnd ? new Date(e.dateEnd) : null;
            if (!n && !l && !ds && !de) continue;
            result.push({
                name: n,
                location: l,
                dateRange: formatDateRange(ds, de, lang),
            });
        }
    }
    return result;
}

/**
 * Format jumlah uang.
 * - Default (Rp): "Rp 5.000.000" (no decimal, format id-ID)
 * - useUsd=true: "USD 5,000.00" (en-US format, dua digit desimal). TANPA konversi kurs —
 *   marketing input nilai USD manual di field harga. Toggle ini cuma ganti label.
 */
function formatRp(n: number | string, useUsd: boolean = false): string {
    const num = Number(n || 0);
    if (useUsd) {
        return 'USD ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
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

/** Title Case: tiap kata huruf depannya kapital. Contoh: "dua juta lima ratus ribu" → "Dua Juta Lima Ratus Ribu". */
function toTitleCase(s: string): string {
    return s.replace(/\s+/g, ' ').trim().split(' ').map((w) =>
        w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');
}

export function terbilangRupiah(n: number | string): string {
    const num = Number(n || 0);
    const txt = terbilang(num);
    return toTitleCase(txt + ' rupiah');
}

// ─── English number-to-words ──────────────────────────────────────────
const EN_ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function numberToWordsEnglish(n: number): string {
    if (n < 0) return 'negative ' + numberToWordsEnglish(-n);
    if (n === 0) return 'zero';
    if (n < 20) return EN_ONES[n];
    if (n < 100) {
        const t = Math.floor(n / 10), o = n % 10;
        return EN_TENS[t] + (o ? '-' + EN_ONES[o] : '');
    }
    if (n < 1000) {
        const h = Math.floor(n / 100), r = n % 100;
        return EN_ONES[h] + ' hundred' + (r ? ' ' + numberToWordsEnglish(r) : '');
    }
    if (n < 1_000_000) {
        const t = Math.floor(n / 1000), r = n % 1000;
        return numberToWordsEnglish(t) + ' thousand' + (r ? ' ' + numberToWordsEnglish(r) : '');
    }
    if (n < 1_000_000_000) {
        const m = Math.floor(n / 1_000_000), r = n % 1_000_000;
        return numberToWordsEnglish(m) + ' million' + (r ? ' ' + numberToWordsEnglish(r) : '');
    }
    if (n < 1_000_000_000_000) {
        const b = Math.floor(n / 1_000_000_000), r = n % 1_000_000_000;
        return numberToWordsEnglish(b) + ' billion' + (r ? ' ' + numberToWordsEnglish(r) : '');
    }
    const t = Math.floor(n / 1_000_000_000_000);
    const r = n % 1_000_000_000_000;
    return numberToWordsEnglish(t) + ' trillion' + (r ? ' ' + numberToWordsEnglish(r) : '');
}

/**
 * Convert nominal jadi terbilang.
 * - useUsd=true: pakai "US Dollars" + handle cents (TANPA konversi — angka diasumsikan sudah USD)
 * - else: pakai "Rupiah" (id) atau angka English + " rupiah" (en tanpa USD toggle)
 */
export function rupiahInWords(n: number | string, lang: 'id' | 'en', useUsd: boolean = false): string {
    const num = Number(n || 0);
    if (useUsd) {
        // Angka diasumsikan sudah dalam USD (input langsung oleh user).
        const whole = Math.floor(num);
        const cents = Math.round((num - whole) * 100);
        const wordsWhole = numberToWordsEnglish(whole);
        const dollarPart = `${wordsWhole} US dollar${whole !== 1 ? 's' : ''}`;
        if (cents > 0) {
            const wordsCents = numberToWordsEnglish(cents);
            return toTitleCase(`${dollarPart} and ${wordsCents} cent${cents !== 1 ? 's' : ''}`);
        }
        return toTitleCase(dollarPart);
    }
    if (lang === 'en') {
        // English tanpa USD toggle — pakai angka English + "rupiah"
        const w = numberToWordsEnglish(Math.floor(num));
        return toTitleCase(w + ' rupiah');
    }
    return terbilangRupiah(num);
}

// ─── i18n labels per language ─────────────────────────────────────────
export const I18N: Record<'id' | 'en', Record<string, string>> = {
    id: {
        // Header
        kepada: 'Kepada Yth.',
        diTempat: 'di Tempat',
        nomor: 'Nomor',
        noInvoice: 'No. Invoice',
        lampiran: 'Lampiran',
        perihal: 'Perihal',
        // Doc title
        suratPenawaran: 'SURAT PENAWARAN',
        invoice: 'INVOICE',
        revisi: 'Rev.',
        // Opening
        denganHormat: 'Dengan hormat,',
        bersamaSurat: 'Bersama surat ini kami',
        mengajukanPenawaran: 'mengajukan penawaran harga',
        bersamaInvoice: 'Bersama invoice ini kami',
        menagihkanPembayaran: 'menagihkan pembayaran',
        uangMuka: 'uang muka (DP)',
        pelunasan: 'pelunasan',
        atas: 'atas',
        untukAcara: 'untuk acara',
        di: 'di',
        padaTanggal: 'pada tanggal',
        rincianPenawaran: 'Adapun rincian penawaran kami adalah sebagai berikut:',
        rincianTagihan: 'Berikut rincian tagihan:',
        // Table
        no: 'No',
        uraian: 'Uraian',
        qty: 'Qty',
        hargaSatuan: 'Harga Satuan',
        jumlah: 'Jumlah',
        subtotal: 'Subtotal',
        subtotalKeseluruhan: 'Subtotal Keseluruhan',
        diskon: 'Diskon',
        ppn: 'PPN',
        grandTotal: 'Grand Total',
        terbilang: 'Terbilang',
        // Sections
        catatanHarga: 'Catatan Harga',
        sistemPembayaran: 'Sistem Pembayaran',
        ketentuan: 'Ketentuan',
        // Closing
        demikian: 'Demikian',
        atasPerhatian: 'Atas perhatian dan kerjasamanya kami ucapkan terima kasih.',
        // Sign
        hormatKami: 'Hormat kami,',
        // Invoice
        jatuhTempo: 'Jatuh Tempo',
        totalTagihan: 'TOTAL YANG HARUS DIBAYAR',
        validUntil: 'Berlaku sampai',
        // Misc
        sayLabel: 'Terbilang',
        attachmentSuffix: 'berkas',
        tanggal: 'Tanggal',
    },
    en: {
        // Header
        kepada: 'To',
        diTempat: '',  // English version: tidak ada padanan natural untuk "di Tempat" — kosongkan
        nomor: 'Number',
        noInvoice: 'Invoice No.',
        lampiran: 'Attachment',
        perihal: 'Subject',
        // Doc title
        suratPenawaran: 'QUOTATION',
        invoice: 'INVOICE',
        revisi: 'Rev.',
        // Opening — formal business English
        denganHormat: 'Dear Sir/Madam,',
        bersamaSurat: 'We at',
        mengajukanPenawaran: 'are pleased to submit our quotation for',
        bersamaInvoice: 'We at',
        menagihkanPembayaran: 'hereby issue this invoice for the',
        uangMuka: 'down payment',
        pelunasan: 'final payment',
        atas: 'of',
        untukAcara: 'for',
        di: 'held at',
        padaTanggal: 'on',
        rincianPenawaran: 'The details of our quotation are as follows:',
        rincianTagihan: 'The details of this invoice are as follows:',
        // Table
        no: 'No.',
        uraian: 'Description',
        qty: 'Qty',
        hargaSatuan: 'Unit Price',
        jumlah: 'Amount',
        subtotal: 'Subtotal',
        subtotalKeseluruhan: 'Total Subtotal',
        diskon: 'Discount',
        ppn: 'VAT',
        grandTotal: 'Grand Total',
        terbilang: 'In words',
        // Sections
        catatanHarga: 'Pricing Notes',
        sistemPembayaran: 'Payment Terms',
        ketentuan: 'Terms & Conditions',
        // Closing
        demikian: 'Thank you for your kind attention.',
        atasPerhatian: 'We appreciate your kind attention and look forward to your favourable response.',
        // Sign
        hormatKami: 'Sincerely yours,',
        // Invoice
        jatuhTempo: 'Due Date',
        totalTagihan: 'TOTAL AMOUNT DUE',
        validUntil: 'Valid Until',
        // Misc
        sayLabel: 'In words',
        attachmentSuffix: 'document(s)',
        tanggal: 'Date',
    },
};

/** Default theme color per brand. Dipakai kalau BrandSettings.themeColor null. */
const DEFAULT_BRAND_COLOR: Record<string, string> = {
    EXINDO: '#1e40af',  // blue-800
    XPOSER: '#0d9488',  // teal-600
    OTHER: '#64748b',   // slate-500
};
const FALLBACK_COLOR = '#c8203a'; // crimson — current default

/** Convert hex (e.g. "#c8203a" or "#fff") → {r,g,b}. Returns null kalau invalid. */
function parseHex(hex: string): { r: number; g: number; b: number } | null {
    const s = hex.trim().replace(/^#/, '');
    const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
    return {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16),
    };
}

/** Mix `c` dengan putih sebanyak `pct%` (0-100). Higher pct = lebih terang. */
function lighten(hex: string, pct: number): string {
    const c = parseHex(hex);
    if (!c) return hex;
    const t = Math.max(0, Math.min(100, pct)) / 100;
    const r = Math.round(c.r + (255 - c.r) * t);
    const g = Math.round(c.g + (255 - c.g) * t);
    const b = Math.round(c.b + (255 - c.b) * t);
    return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
}

/** Mix `c` dengan hitam sebanyak `pct%` (0-100). Higher pct = lebih gelap. */
function darken(hex: string, pct: number): string {
    const c = parseHex(hex);
    if (!c) return hex;
    const t = Math.max(0, Math.min(100, pct)) / 100;
    const r = Math.round(c.r * (1 - t));
    const g = Math.round(c.g * (1 - t));
    const b = Math.round(c.b * (1 - t));
    return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
}

/** Resolve theme dari brand color (BrandSettings.themeColor → DEFAULT_BRAND_COLOR → FALLBACK). */
export function resolveTheme(brandThemeColor: string | null | undefined, brand: string | null | undefined): {
    primary: string; primaryLight: string; primarySubtle: string; primaryDark: string;
} {
    let primary = brandThemeColor?.trim();
    if (!primary || !parseHex(primary)) {
        primary = brand && DEFAULT_BRAND_COLOR[brand] ? DEFAULT_BRAND_COLOR[brand] : FALLBACK_COLOR;
    }
    return {
        primary,
        primaryLight: lighten(primary, 75),   // ~25% saturation
        primarySubtle: lighten(primary, 92),  // sangat tipis untuk bg
        primaryDark: darken(primary, 30),
    };
}

/** Format jumlah lampiran. Indonesian: "1 (satu) berkas". English: "1 (one) document(s)". */
function formatAttachmentLabel(count: number, lang: 'id' | 'en' = 'id'): string {
    const safe = Math.max(1, Math.floor(count));
    if (lang === 'en') {
        const word = safe <= 19 ? EN_ONES[safe] : numberToWordsEnglish(safe);
        return `${safe} (${word}) document${safe > 1 ? 's' : ''}`;
    }
    const words = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh'];
    const word = safe <= 10 ? words[safe] : terbilang(safe).trim();
    return `${safe} (${word}) berkas`;
}

function buildInvoicePartLabel(part: string | null | undefined, lang: 'id' | 'en' = 'id'): string {
    if (lang === 'en') {
        if (part === 'DP') return 'INVOICE — DOWN PAYMENT';
        if (part === 'PELUNASAN') return 'INVOICE — FINAL PAYMENT';
        return 'INVOICE';
    }
    if (part === 'DP') return 'INVOICE — DOWN PAYMENT';
    if (part === 'PELUNASAN') return 'INVOICE — PELUNASAN';
    if (part === 'FULL') return 'INVOICE';
    return 'INVOICE';
}

function buildInvoiceSubject(part: string | null | undefined, variantLabel: string, lang: 'id' | 'en' = 'id'): string {
    const base = buildInvoicePartLabel(part, lang);
    return `${base} — ${variantLabel}`;
}

/**
 * Default labels untuk opening paragraph invoice. Bisa di-override per brand
 * via BrandSettings.invoiceLabelOverrides (JSON).
 */
const INVOICE_OPENING_DEFAULTS = {
    dp: 'Down Payment',
    pelunasan: 'Final Payment',
    full: 'Full Payment',
    verbSewa: 'Pekerjaan pemasangan',
    verbPengadaan: 'Pekerjaan pengadaan',
    untukEvent: 'untuk event',
    padaTanggal: 'pada tanggal',
    di: 'di',
    rincianSuffix: ', dengan rincian sebagai berikut:',
};

export type InvoiceOpeningLabelKey = keyof typeof INVOICE_OPENING_DEFAULTS;

function escapeHtml(s: string): string {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c] as string));
}

/**
 * Build HTML untuk paragraf opening invoice — dengan label custom dari brand (atau default).
 * Format:
 *   "{prefix} {verb} {variantLabel} untuk event {project.name} pada tanggal {dateRange} di {location}, dengan rincian sebagai berikut:"
 *
 * Multi-event: kalau ada >1 event, gabungkan dengan separator ";".
 * Empty fields auto-skip (gak ke-render).
 */
function buildInvoiceOpeningHtml(opts: {
    invoicePart: 'DP' | 'PELUNASAN' | 'FULL' | null;
    templateKey: 'sewa' | 'pengadaan-booth';
    variantLabel: string;
    project: { name: string; location: string; dateRange: string };
    events: Array<{ name: string; location: string; dateRange: string }>;
    labelOverrides: Record<string, string> | null;
}): string {
    const L = (key: InvoiceOpeningLabelKey): string => {
        const override = opts.labelOverrides?.[key]?.trim();
        return override || INVOICE_OPENING_DEFAULTS[key];
    };

    // Prefix berdasarkan invoicePart
    let prefix = '';
    if (opts.invoicePart === 'DP') prefix = `<strong>${escapeHtml(L('dp'))}</strong> `;
    else if (opts.invoicePart === 'PELUNASAN') prefix = `<strong>${escapeHtml(L('pelunasan'))}</strong> `;
    else if (opts.invoicePart === 'FULL') prefix = `<strong>${escapeHtml(L('full'))}</strong> `;

    // Verb per template
    const verb = opts.templateKey === 'sewa' ? L('verbSewa') : L('verbPengadaan');

    // Project / event text
    const hasMultipleEvents = opts.events.length > 1;
    let projectText = '';

    if (hasMultipleEvents) {
        // Multi-event: gabungkan dengan separator
        projectText = ` ${escapeHtml(L('untukEvent'))}`;
        const parts: string[] = [];
        for (const ev of opts.events) {
            let p = '';
            if (ev.name) p += ` <strong>${escapeHtml(ev.name)}</strong>`;
            if (ev.dateRange && ev.dateRange !== '-') p += ` ${escapeHtml(L('padaTanggal'))} <strong>${escapeHtml(ev.dateRange)}</strong>`;
            if (ev.location) p += ` ${escapeHtml(L('di'))} <strong>${escapeHtml(ev.location)}</strong>`;
            parts.push(p.trim());
        }
        projectText += ' ' + parts.join('; ');
    } else {
        if (opts.project.name) {
            projectText += ` ${escapeHtml(L('untukEvent'))} <strong>${escapeHtml(opts.project.name)}</strong>`;
        }
        if (opts.project.dateRange && opts.project.dateRange !== '-') {
            projectText += ` ${escapeHtml(L('padaTanggal'))} <strong>${escapeHtml(opts.project.dateRange)}</strong>`;
        }
        if (opts.project.location) {
            projectText += ` ${escapeHtml(L('di'))} <strong>${escapeHtml(opts.project.location)}</strong>`;
        }
    }

    return `${prefix}${escapeHtml(verb)} <strong>${escapeHtml(opts.variantLabel)}</strong>${projectText}${escapeHtml(L('rincianSuffix'))}`;
}

@Injectable()
export class QuotationContextBuilder {
    constructor(private prisma: PrismaService) { }

    /** Fetch raw quotation row — dipakai untuk override SPK-specific custom text di pdf-export. */
    async fetchRaw(quotationId: number): Promise<any | null> {
        return this.prisma.invoice.findUnique({ where: { id: quotationId } });
    }

    async build(quotationId: number): Promise<QuotationRenderContext> {
        const quotation = await this.prisma.invoice.findUnique({
            where: { id: quotationId },
            include: {
                items: { orderBy: { orderIndex: 'asc' } },
                customer: true,
                // Pakai full include — supaya signatureDisplayName (column baru) ikut ke-fetch
                // walaupun Prisma Client belum di-regenerate (cast as any saat akses).
                signedByWorker: true,
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

        // Tentukan bahasa dokumen di sini (sebelumnya di bawah) — supaya bisa dipakai
        // resolve variant label & subject yang juga language-aware.
        const lang: 'id' | 'en' = quotation.language === 'en' ? 'en' : 'id';
        // Toggle mata uang USD — kalau true, label Rp diganti USD (tanpa konversi).
        // Marketing input nilai USD manual ke field harga.
        const useUsd: boolean = Boolean((quotation as any).useUsdCurrency);

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
            const subjectPrefix = lang === 'en' ? 'Quotation for' : 'Penawaran';
            subjectText = variantConfig.subject?.trim() || `${subjectPrefix} ${variantConfig.label}`;
        } else {
            if (lang === 'en') {
                variantLabel = quotation.quotationVariant === 'PENGADAAN_BOOTH'
                    ? 'Custom Booth Design & Build'
                    : 'Event Equipment Rental';
            } else {
                variantLabel = quotation.quotationVariant === 'PENGADAAN_BOOTH'
                    ? 'Pengadaan Booth Special Design'
                    : 'Sewa Perlengkapan Event';
            }
            templateKey = quotation.quotationVariant === 'PENGADAAN_BOOTH' ? 'pengadaan-booth' : 'sewa';
            subjectText = lang === 'en' ? `Quotation for ${variantLabel}` : `Penawaran ${variantLabel}`;
        }

        const items: QuotationRenderItem[] = quotation.items.map((it, idx) => ({
            no: idx + 1,
            description: it.description,
            unit: it.unit ?? '',
            quantity: formatQty(it.quantity.toString(), it.unit),
            price: formatRp(it.price.toString(), useUsd),
            subtotal: formatRp(Number(it.quantity) * (Number((it as any).unitMultiplier ?? 1) || 1) * Number(it.price), useUsd),
            categoryName: it.categoryName ?? null,
        }));

        // Group items by categoryName.
        // PENTING: kalau item tidak punya categoryName, OTOMATIS inherit kategori dari item SEBELUMNYA
        // (asumsi user lupa atau sengaja kosongkan karena ingin gabung ke grup atasnya).
        // Hanya item paling pertama yang tanpa kategori jadi __UNCATEGORIZED__.
        const groupMap = new Map<string, { items: QuotationRenderItem[]; subtotalNum: number; nextNo: number }>();
        const categoryOrder: string[] = [];
        let lastCategory: string | null = null;
        for (let i = 0; i < quotation.items.length; i++) {
            const it = quotation.items[i];
            // Resolve effective category: explicit categoryName, atau inherit dari sebelumnya
            const effectiveCategory = it.categoryName ?? lastCategory;
            const catKey = effectiveCategory ?? '__UNCATEGORIZED__';
            if (!groupMap.has(catKey)) {
                categoryOrder.push(catKey);
                groupMap.set(catKey, { items: [], subtotalNum: 0, nextNo: 1 });
            }
            const group = groupMap.get(catKey)!;
            // Per-kategori numbering — restart dari 1 di setiap kategori
            group.items.push({
                no: group.nextNo,
                description: it.description,
                unit: it.unit ?? '',
                quantity: formatQty(it.quantity.toString(), it.unit),
                price: formatRp(it.price.toString(), useUsd),
                subtotal: formatRp(Number(it.quantity) * (Number((it as any).unitMultiplier ?? 1) || 1) * Number(it.price), useUsd),
                categoryName: effectiveCategory,
            });
            group.nextNo += 1;
            group.subtotalNum += Number(it.quantity) * (Number((it as any).unitMultiplier ?? 1) || 1) * Number(it.price);
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
                subtotalFormatted: formatRp(g.subtotalNum, useUsd),
            };
        });

        const subtotalNum = Number(quotation.subtotal);
        const totalNum = Number(quotation.total);
        const dpPercentNum = Number(quotation.dpPercent);
        const dpAmount = (totalNum * dpPercentNum) / 100;
        const pelunasan = totalNum - dpAmount;

        // ─────────────────────────────────────────────────────────────────
        // EVENT-GROUPED MODE — items dipisah per event lokasi (PDF Nukahiji style).
        // Aktif kalau ada item dengan eventIndex non-null.
        // ─────────────────────────────────────────────────────────────────
        const hasEventIndexedItems = quotation.items.some((it: any) =>
            typeof it.eventIndex === 'number' && it.eventIndex >= 0
        );
        let itemsByEvent: QuotationRenderContext['itemsByEvent'] = undefined;
        if (hasEventIndexedItems) {
            // Build event lookup: 0 = main event, 1+ = additionalEvents[i-1]
            const eventsList = buildEventsList(quotation, lang);
            // Group items by eventIndex
            const buckets = new Map<number, { items: QuotationRenderItem[]; subtotalNum: number; nextNo: number }>();
            const orderedIndices: number[] = [];
            for (const it of quotation.items) {
                const idx = typeof (it as any).eventIndex === 'number' ? (it as any).eventIndex : -1;
                if (idx < 0) continue; // skip items tanpa eventIndex (rendered di itemGroups normal)
                if (!buckets.has(idx)) {
                    buckets.set(idx, { items: [], subtotalNum: 0, nextNo: 1 });
                    orderedIndices.push(idx);
                }
                const b = buckets.get(idx)!;
                b.items.push({
                    no: b.nextNo,
                    description: it.description,
                    unit: it.unit ?? '',
                    quantity: formatQty(it.quantity.toString(), it.unit),
                    price: formatRp(it.price.toString(), useUsd),
                    subtotal: formatRp(Number(it.quantity) * (Number((it as any).unitMultiplier ?? 1) || 1) * Number(it.price), useUsd),
                    categoryName: it.categoryName ?? null,
                });
                b.nextNo += 1;
                b.subtotalNum += Number(it.quantity) * (Number((it as any).unitMultiplier ?? 1) || 1) * Number(it.price);
            }
            itemsByEvent = orderedIndices
                .sort((a, b) => a - b)
                .map((idx, displayIdx) => {
                    const ev = eventsList[idx] ?? { name: `Event ${idx + 1}`, location: '', dateRange: '' };
                    const b = buckets.get(idx)!;
                    return {
                        no: displayIdx + 1,
                        eventIndex: idx,
                        eventName: ev.name,
                        eventLocation: ev.location,
                        eventDateRange: ev.dateRange,
                        items: b.items,
                        subtotalNum: b.subtotalNum,
                        subtotalFormatted: formatRp(b.subtotalNum, useUsd),
                    };
                });
        }

        // ─────────────────────────────────────────────────────────────────
        // PACKAGE MODE — items dipisah per package (PDF Jalakx style).
        // Aktif kalau ada item dengan packageGroup non-null.
        // ─────────────────────────────────────────────────────────────────
        const hasPackagedItems = quotation.items.some((it: any) =>
            it.packageGroup && it.packageGroup.toString().trim().length > 0
        );
        let packages: QuotationRenderContext['packages'] = undefined;
        if (hasPackagedItems) {
            const pkgMap = new Map<string, { items: QuotationRenderItem[]; subtotalNum: number; nextNo: number }>();
            const pkgOrder: string[] = [];
            for (const it of quotation.items) {
                const grp = ((it as any).packageGroup ?? '').toString().trim();
                if (!grp) continue;
                if (!pkgMap.has(grp)) {
                    pkgMap.set(grp, { items: [], subtotalNum: 0, nextNo: 1 });
                    pkgOrder.push(grp);
                }
                const p = pkgMap.get(grp)!;
                p.items.push({
                    no: p.nextNo,
                    description: it.description,
                    unit: it.unit ?? '',
                    quantity: formatQty(it.quantity.toString(), it.unit),
                    price: formatRp(it.price.toString(), useUsd),
                    subtotal: formatRp(Number(it.quantity) * (Number((it as any).unitMultiplier ?? 1) || 1) * Number(it.price), useUsd),
                    categoryName: it.categoryName ?? null,
                });
                p.nextNo += 1;
                p.subtotalNum += Number(it.quantity) * (Number((it as any).unitMultiplier ?? 1) || 1) * Number(it.price);
            }
            packages = pkgOrder.map((name, displayIdx) => {
                const p = pkgMap.get(name)!;
                // Package biasanya tidak tampilkan subtotal (karena pilihan opsi),
                // tapi tetap available kalau template butuh.
                return {
                    no: displayIdx + 1,
                    name,
                    items: p.items,
                    subtotalFormatted: p.subtotalNum > 0 ? formatRp(p.subtotalNum, useUsd) : null,
                };
            });
        }

        // ─────────────────────────────────────────────────────────────────
        // Resolve display mode (auto-detect dari data + setting)
        // ─────────────────────────────────────────────────────────────────
        let displayMode: QuotationRenderContext['displayMode'] = 'detailed';
        if (quotation.itemDisplayMode === 'category-summary') displayMode = 'category-summary';
        if (hasEventIndexedItems) displayMode = 'event-grouped';
        if (hasPackagedItems) displayMode = 'package';        // package menang kalau both ada

        // ─────────────────────────────────────────────────────────────────
        // Payment schedule resolved (kalau di-set, override DP/pelunasan default)
        // ─────────────────────────────────────────────────────────────────
        const paymentScheduleRaw = (quotation as any).paymentSchedule;
        let paymentScheduleResolved: QuotationRenderContext['paymentSchedule'] = null;
        if (Array.isArray(paymentScheduleRaw) && paymentScheduleRaw.length > 0) {
            paymentScheduleResolved = paymentScheduleRaw.map((s: any) => {
                const pct = Number(s?.percent ?? 0);
                const amt = (totalNum * pct) / 100;
                return {
                    label: (s?.label ?? '').toString(),
                    percent: pct,
                    amountFormatted: formatRp(amt, useUsd),
                    amountTerbilang: rupiahInWords(amt, lang, useUsd),
                };
            });
        }

        // ─────────────────────────────────────────────────────────────────
        // Specifications — ada 2 tipe:
        // 1. Spec dengan packageGroup → attach ke packages[].specs (kalau mode package)
        // 2. Spec tanpa packageGroup (global) → render terpisah di section "Spesifikasi"
        // ─────────────────────────────────────────────────────────────────
        const specsRaw = (quotation as any).specifications;
        const allSpecs = Array.isArray(specsRaw) && specsRaw.length > 0
            ? specsRaw.map((g: any) => ({
                title: (g?.title ?? '').toString().trim() || null,
                items: Array.isArray(g?.items) ? g.items.map((s: any) => (s ?? '').toString()) : [],
                packageGroup: (g?.packageGroup ?? '').toString().trim() || null,
            }))
            : [];

        // Attach specs ke packages — match by packageGroup name
        if (packages && packages.length > 0) {
            for (const pkg of packages) {
                const matched = allSpecs
                    .filter((s) => s.packageGroup && s.packageGroup === pkg.name)
                    .map((s) => ({ title: s.title, items: s.items }));
                if (matched.length > 0) pkg.specs = matched;
            }
        }

        // Specifications global (tanpa packageGroup) — render di section sendiri.
        // Kalau mode package: include juga specs yang gagal match (orphan packageGroup).
        const globalSpecs = allSpecs
            .filter((s) => {
                if (!s.packageGroup) return true; // truly global
                if (!packages || packages.length === 0) return true; // bukan mode package → semua jadi global
                // mode package: skip yang sudah ke-attach ke packages
                return !packages.some((p) => p.name === s.packageGroup);
            })
            .map((s) => ({ title: s.title, items: s.items }));

        const specifications: QuotationRenderContext['specifications'] =
            globalSpecs.length > 0 ? globalSpecs : null;

        // ─────────────────────────────────────────────────────────────────
        // Harga paket — kalau di-set & > 0 → tampil "Total / Harga Paket" di footer
        // ─────────────────────────────────────────────────────────────────
        const packagePriceNum = (quotation as any).packagePrice ? Number((quotation as any).packagePrice) : null;
        const packagePriceFormatted = packagePriceNum && packagePriceNum > 0
            ? formatRp(packagePriceNum, useUsd)
            : null;

        // Tampilkan grand total? Default true kecuali eksplisit false (mode package).
        const showGrandTotal = (quotation as any).showGrandTotal !== false;

        // (lang sudah resolved di atas, sebelum variantLabel/subject)
        return {
            language: lang,
            i18n: I18N[lang],
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
                // Kalau quotation punya signedByWorker → pakai signatureDisplayName (kalau di-set), else name
                // Kalau tidak ada worker → fallback ke directorName brand
                name: (quotation.signedByWorker as any)?.signatureDisplayName?.trim()
                    || quotation.signedByWorker?.name
                    || brandSettings?.directorName
                    || settings?.directorName
                    || '',
                position: quotation.signedByWorker?.position ?? null,
                signatureUrl: imageToDataUri(quotation.signedByWorker?.signatureImageUrl ?? null),
                // Stempel: prioritas worker → brand fallback
                stampUrl: imageToDataUri(
                    quotation.signedByWorker?.stampImageUrl
                    ?? brandSettings?.stampImageUrl
                    ?? null
                ),
            },
            theme: resolveTheme(brandSettings?.themeColor ?? null, quotation.brand),
            // customOpening priority untuk Invoice: customOpeningInvoice → customOpeningText (general)
            // SPK override-nya di-handle di pdf-export.service (terpisah karena pakai template berbeda).
            customOpening: (() => {
                const isInvoice = quotation.type === 'INVOICE';
                if (isInvoice) {
                    const inv = (quotation as any).customOpeningInvoice?.trim();
                    if (inv) return inv;
                }
                return quotation.customOpeningText?.trim() || null;
            })(),
            // Pre-built HTML untuk invoice opening — pakai labels custom dari BrandSettings.invoiceLabelOverrides
            // Kalau quotation bukan invoice → null (template fallback ke quotation opening default).
            invoiceOpeningHtml: (() => {
                if (quotation.type !== 'INVOICE') return null;
                return buildInvoiceOpeningHtml({
                    invoicePart: quotation.invoicePart as 'DP' | 'PELUNASAN' | 'FULL' | null,
                    templateKey,
                    variantLabel,
                    project: {
                        name: quotation.projectName ?? '',
                        location: quotation.eventLocation ?? '',
                        dateRange: formatDateRange(quotation.eventDateStart, quotation.eventDateEnd, lang),
                    },
                    events: buildEventsList(quotation, lang),
                    labelOverrides: ((brandSettings as any)?.invoiceLabelOverrides ?? null) as Record<string, string> | null,
                });
            })(),
            // Helper untuk combine prepend + base + append (skip yang kosong)
            // Lokal scope, di-spread ke brandTexts di bawah
            attachment: (() => {
                const c = quotation.attachmentCount && quotation.attachmentCount > 0 ? quotation.attachmentCount : 1;
                const customText = quotation.customAttachmentText?.trim();
                const label = customText || formatAttachmentLabel(c, lang);
                return { count: c, label };
            })(),
            brandTexts: (() => {
                /**
                 * Resolution per section (3-tier):
                 *  1. Kalau quotation.customXxx (legacy full override) di-set → pakai itu (tidak combine apapun)
                 *  2. Kalau prepend/append di-set → combine: prepend + brand_default + append (skip yang kosong)
                 *  3. Default: brand_default saja
                 */
                const combine = (
                    fullOverride: string | null | undefined,
                    prepend: string | null | undefined,
                    base: string | null | undefined,
                    append: string | null | undefined,
                ): string | null => {
                    const o = fullOverride?.trim();
                    if (o) return o;
                    const parts: string[] = [];
                    const p = prepend?.trim();
                    const ba = base?.trim();
                    const a = append?.trim();
                    if (p) parts.push(p);
                    if (ba) parts.push(ba);
                    if (a) parts.push(a);
                    return parts.length > 0 ? parts.join('\n\n') : null;
                };
                // English versions kalau lang=en, fallback ke Indonesian kalau English kosong
                const useEn = lang === 'en';
                const disclaimerBase = useEn
                    ? (brandSettings?.quotationDisclaimerEn || brandSettings?.quotationDisclaimer)
                    : brandSettings?.quotationDisclaimer;
                const paymentTermsBase = useEn
                    ? (brandSettings?.quotationPaymentTermsEn || brandSettings?.quotationPaymentTerms)
                    : brandSettings?.quotationPaymentTerms;
                const closingBase = useEn
                    ? (brandSettings?.quotationClosingEn || brandSettings?.quotationClosing)
                    : brandSettings?.quotationClosing;
                const invoiceClosingBase = useEn
                    ? (brandSettings?.invoiceClosingTextEn || brandSettings?.invoiceClosingText)
                    : brandSettings?.invoiceClosingText;
                // Untuk INVOICE, prioritaskan custom*Invoice fields (jika di-set), supaya
                // edit invoice-specific tidak tabrakan dengan custom penawaran.
                const isInvoice = quotation.type === 'INVOICE';
                const invDisclaimer = isInvoice ? (quotation as any).customDisclaimerInvoice : null;
                const invPaymentTerms = isInvoice ? (quotation as any).customPaymentTermsInvoice : null;
                const invClosing = isInvoice ? (quotation as any).customClosingInvoice : null;
                return {
                    disclaimer: combine(
                        invDisclaimer || quotation.customDisclaimer,
                        quotation.disclaimerPrepend,
                        disclaimerBase,
                        quotation.disclaimerAppend,
                    ),
                    paymentTerms: combine(
                        invPaymentTerms || quotation.customPaymentTerms,
                        quotation.paymentTermsPrepend,
                        paymentTermsBase,
                        quotation.paymentTermsAppend,
                    ),
                    closing: combine(
                        invClosing || quotation.customClosing,
                        quotation.closingPrepend,
                        closingBase,
                        quotation.closingAppend,
                    ),
                    // `invoiceClosing` dipakai di template untuk "Nb:" di Invoice PDF.
                    // PRIORITAS: customClosingInvoice (Invoice tab) → customClosing (Penawaran tab) → brand default.
                    // Sebelumnya BUG: cuma baca customClosing, ignore customClosingInvoice → user edit di tab Invoice tidak muncul.
                    invoiceClosing: combine(
                        invClosing || quotation.customClosing,
                        quotation.closingPrepend,
                        invoiceClosingBase,
                        quotation.closingAppend,
                    ),
                };
            })(),
            itemGroups,
            itemsByEvent,
            packages,
            displayMode,
            paymentSchedule: paymentScheduleResolved,
            specifications,
            packagePriceFormatted,
            showGrandTotal,
            doc: {
                number: quotation.invoiceNumber,
                variant: quotation.quotationVariant ?? 'SEWA',
                variantCode: quotation.variantCode,
                templateKey,
                variantLabel,
                // customSubject (kalau di-set) override default subject derivation
                subject: ((quotation as any).customSubject?.trim()) || (quotation.type === 'INVOICE'
                    ? buildInvoiceSubject(quotation.invoicePart, variantLabel, lang)
                    : subjectText),
                dateFormatted: formatDateId(quotation.date, lang),
                // City — opsional. Kalau user kosongkan, tampilkan kosong (no fallback).
                city: quotation.signCity?.trim() || '',
                validUntilFormatted: quotation.validUntil ? formatDateId(quotation.validUntil, lang) : null,
                isRevision: quotation.revisionNumber > 0,
                revisionNumber: quotation.revisionNumber,
                isInvoice: quotation.type === 'INVOICE',
                invoicePart: quotation.invoicePart,
                invoicePartLabel: quotation.invoicePart
                    ? buildInvoicePartLabel(quotation.invoicePart, lang)
                    : null,
                amountToPayFormatted: quotation.amountToPay !== null && quotation.amountToPay !== undefined
                    ? formatRp(Number(quotation.amountToPay), useUsd)
                    : null,
                amountToPayTerbilang: quotation.amountToPay !== null && quotation.amountToPay !== undefined
                    ? rupiahInWords(Number(quotation.amountToPay), lang, useUsd)
                    : null,
                dueDateFormatted: quotation.dueDate ? formatDateId(quotation.dueDate, lang) : null,
                itemDisplayMode: (quotation.itemDisplayMode === 'category-summary' ? 'category-summary' : 'detailed'),
                isCategorySummary: quotation.itemDisplayMode === 'category-summary',
                // Mode flags baru — untuk conditional rendering di template
                isEventGrouped: displayMode === 'event-grouped',
                isPackageMode: displayMode === 'package',
            },
            client: (() => {
                // Untuk INVOICE, prioritaskan invoicePicName/Position/Phone kalau di-set.
                // Kalau kosong → fallback ke clientName/Phone (PIC penawaran).
                const isInvoice = quotation.type === 'INVOICE';
                const invPicName = isInvoice ? (quotation as any).invoicePicName?.trim() : null;
                const invPicPosition = isInvoice ? (quotation as any).invoicePicPosition?.trim() : null;
                const invPicPhone = isInvoice ? (quotation as any).invoicePicPhone?.trim() : null;
                return {
                    name: invPicName || quotation.clientName,
                    company: quotation.clientCompany ?? '',
                    address: quotation.clientAddress ?? '',
                    phone: invPicPhone || (quotation.clientPhone ?? ''),
                    email: quotation.clientEmail ?? '',
                    ...(invPicPosition ? { position: invPicPosition } : {}),
                };
            })(),
            project: {
                name: quotation.projectName ?? '',
                location: quotation.eventLocation ?? '',
                dateRange: formatDateRange(quotation.eventDateStart, quotation.eventDateEnd, lang),
            },
            // Multi-event: array berisi event UTAMA (index 0) + event TAMBAHAN setelahnya.
            // Template bisa loop {{#each events}} kalau mau tampilkan banyak event.
            events: buildEventsList(quotation, lang),
            hasMultipleEvents: buildEventsList(quotation, lang).length > 1,
            items,
            totals: {
                subtotal: formatRp(subtotalNum, useUsd),
                taxRate: Number(quotation.taxRate).toString(),
                taxAmount: formatRp(Number(quotation.taxAmount), useUsd),
                discount: formatRp(Number(quotation.discount), useUsd),
                total: formatRp(totalNum, useUsd),
                totalTerbilang: rupiahInWords(totalNum, lang, useUsd),
            },
            payment: {
                dpPercent: dpPercentNum.toString(),
                dpAmount: formatRp(dpAmount, useUsd),
                pelunasan: formatRp(pelunasan, useUsd),
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
