import { Injectable } from '@nestjs/common';
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    ShadingType,
    ImageRun,
    Header,
    Footer,
    HorizontalPositionRelativeFrom,
    VerticalPositionRelativeFrom,
    HorizontalPositionAlign,
    VerticalPositionAlign,
    convertMillimetersToTwip,
    TabStopType,
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import { QuotationContextBuilder, QuotationRenderContext, QuotationRenderItem } from './quotation-context.builder';

// Fallback color (dipakai kalau ctx.theme entah kenapa kosong)
const PRIMARY = 'C8203A';      // merah Exindo
const TOTAL_BG = 'F1F5FB';

/** Strip '#' & uppercase — docx library minta hex tanpa '#'. */
function hx(c: string | null | undefined, fallback: string): string {
    const v = (c || '').replace('#', '').trim();
    return /^[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : fallback;
}

interface DocxTheme {
    primary: string;
    light: string;
    subtle: string;
    dark: string;
}

/** Resolve DocxTheme dari ctx.theme (sumber yang SAMA dengan PDF) → warna brand konsisten. */
function resolveDocxTheme(ctx: QuotationRenderContext): DocxTheme {
    return {
        primary: hx(ctx.theme?.primary, PRIMARY),
        light: hx(ctx.theme?.primaryLight, 'FDE2E6'),
        subtle: hx(ctx.theme?.primarySubtle, 'FFF8F9'),
        dark: hx(ctx.theme?.primaryDark, '8A1729'),
    };
}

function border(color = '888888') {
    return {
        top: { style: BorderStyle.SINGLE, size: 4, color },
        bottom: { style: BorderStyle.SINGLE, size: 4, color },
        left: { style: BorderStyle.SINGLE, size: 4, color },
        right: { style: BorderStyle.SINGLE, size: 4, color },
    };
}

function p(text: string, opts: { bold?: boolean; italics?: boolean; size?: number; align?: typeof AlignmentType[keyof typeof AlignmentType]; color?: string; spacingAfter?: number } = {}) {
    return new Paragraph({
        alignment: opts.align,
        spacing: opts.spacingAfter !== undefined ? { after: opts.spacingAfter } : undefined,
        children: [new TextRun({
            text,
            bold: opts.bold,
            italics: opts.italics,
            size: opts.size ?? 22,
            color: opts.color,
        })],
    });
}

/** Render multi-line text (preserve newline) sebagai paragraph terpisah, justify */
function multilineParagraphs(text: string, opts: { size?: number; color?: string } = {}): Paragraph[] {
    return text.split('\n').map((line) =>
        new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 80 },
            children: [
                new TextRun({
                    text: line,
                    size: opts.size ?? 21,
                    color: opts.color,
                }),
            ],
        }),
    );
}

function sectionTitle(title: string, primary: string = PRIMARY): Paragraph {
    return new Paragraph({
        spacing: { before: 200, after: 80 },
        border: {
            bottom: { style: BorderStyle.SINGLE, size: 4, color: primary },
        },
        children: [
            new TextRun({
                text: title,
                bold: true,
                size: 22,
                color: primary,
            }),
        ],
    });
}

function labelCell(text: string, opts: { bold?: boolean; bg?: string; color?: string; align?: typeof AlignmentType[keyof typeof AlignmentType]; italics?: boolean } = {}, width?: number, columnSpan?: number) {
    return new TableCell({
        width: width ? { size: width, type: WidthType.DXA } : undefined,
        columnSpan,
        shading: opts.bg ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.bg } : undefined,
        children: [
            new Paragraph({
                alignment: opts.align,
                children: [
                    new TextRun({
                        text,
                        bold: opts.bold,
                        italics: opts.italics,
                        color: opts.color,
                        size: 20,
                    }),
                ],
            }),
        ],
    });
}

const TOTAL_RED = 'B91C1C';    // warna baris PPh (dipotong klien) — samakan dengan PDF
const TOTAL_GREEN = '047857';  // warna baris Jumlah Diterima — samakan dengan PDF

/** Baris label + nilai (label nge-span beberapa kolom, rata kanan). Dipakai di blok totals. */
function totalRow(label: string, value: string, labelSpan: number, opts: { bold?: boolean; bg?: string; color?: string } = {}): TableRow {
    return new TableRow({
        children: [
            new TableCell({
                columnSpan: labelSpan,
                shading: opts.bg ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.bg } : undefined,
                children: [p(label, { bold: opts.bold, align: AlignmentType.RIGHT, color: opts.color, size: 20 })],
            }),
            labelCell(value, { bold: opts.bold, bg: opts.bg, color: opts.color, align: AlignmentType.RIGHT }),
        ],
    });
}

/** Baris subtotal kategori/event (italic, bg subtle). */
function subtotalRow(label: string, value: string, theme: DocxTheme, labelSpan: number): TableRow {
    return new TableRow({
        children: [
            labelCell(label, { italics: true, bold: true, bg: theme.subtle, align: AlignmentType.RIGHT }, undefined, labelSpan),
            labelCell(value, { italics: true, bold: true, bg: theme.subtle, align: AlignmentType.RIGHT }),
        ],
    });
}

/** Baris header kategori/event (bg light, span penuh). */
function groupHeaderRow(text: string, theme: DocxTheme, span: number): TableRow {
    return new TableRow({
        children: [labelCell(text, { bold: true, bg: theme.light, color: theme.dark }, undefined, span)],
    });
}

/** Header tabel 5 kolom (No, Uraian, Qty, Harga Satuan, Jumlah). */
function header5(ctx: QuotationRenderContext, theme: DocxTheme): TableRow {
    const t = ctx.i18n;
    return new TableRow({
        tableHeader: true,
        children: [
            labelCell(t.no, { bold: true, bg: theme.primary, color: 'FFFFFF', align: AlignmentType.CENTER }, 600),
            labelCell(t.uraian, { bold: true, bg: theme.primary, color: 'FFFFFF' }),
            labelCell(t.qty, { bold: true, bg: theme.primary, color: 'FFFFFF', align: AlignmentType.CENTER }, 1400),
            labelCell(t.hargaSatuan, { bold: true, bg: theme.primary, color: 'FFFFFF', align: AlignmentType.CENTER }, 1800),
            labelCell(t.jumlah, { bold: true, bg: theme.primary, color: 'FFFFFF', align: AlignmentType.CENTER }, 2000),
        ],
    });
}

function itemRow5(it: QuotationRenderItem): TableRow {
    return new TableRow({
        children: [
            labelCell(String(it.no), { align: AlignmentType.CENTER }),
            labelCell(it.description),
            labelCell(it.quantity, { align: AlignmentType.RIGHT }),
            labelCell(it.price, { align: AlignmentType.RIGHT }),
            labelCell(it.subtotal, { align: AlignmentType.RIGHT }),
        ],
    });
}

function tableOf(rows: TableRow[]): Table {
    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: border(), rows });
}

function ppnLabel(ctx: QuotationRenderContext): string {
    return `${ctx.i18n.ppn}${ctx.totals.taxRate ? ` ${ctx.totals.taxRate}%` : ''}`;
}
function pphLabel(ctx: QuotationRenderContext): string {
    return `${ctx.i18n.pph}${ctx.totals.pphRate ? ` ${ctx.totals.pphRate}%` : ''} ${ctx.i18n.dipotongKlien}`;
}

/** Baris PPh + Jumlah Diterima (dipakai beberapa mode). */
function pphAndNetRows(ctx: QuotationRenderContext, labelSpan: number): TableRow[] {
    const rows: TableRow[] = [];
    if (ctx.totals.displayPphRow) rows.push(totalRow(pphLabel(ctx), `-${ctx.totals.pphAmount}`, labelSpan, { bold: true, color: TOTAL_RED }));
    if (ctx.totals.displayNetReceivedRow) rows.push(totalRow(ctx.i18n.jumlahDiterima, ctx.totals.netReceived, labelSpan, { bold: true, color: TOTAL_GREEN }));
    return rows;
}

/** Baris "DP Sudah Dibayar" (dikurangkan dari grand total) — kosong kalau tidak ada DP terbayar. */
function dpPaidRows(ctx: QuotationRenderContext, labelSpan: number): TableRow[] {
    if (!ctx.totals.displayDpPaidRow) return [];
    return [totalRow(ctx.i18n.dpSudahDibayar, `-${ctx.totals.dpPaid}`, labelSpan, { bold: true, color: TOTAL_RED })];
}

// ── MODE: DETAILED (default) — tabel lengkap qty/harga/jumlah per item ──────────
function buildDetailedTable(ctx: QuotationRenderContext, theme: DocxTheme): Table {
    const t = ctx.i18n;
    const rows: TableRow[] = [header5(ctx, theme)];
    for (const group of ctx.itemGroups) {
        if (group.categoryName) rows.push(groupHeaderRow(group.categoryName.toUpperCase(), theme, 5));
        for (const it of group.items) rows.push(itemRow5(it));
        if (group.categoryName) rows.push(subtotalRow(`${t.subtotal} ${group.categoryName}`, group.subtotalFormatted, theme, 4));
    }
    rows.push(totalRow(t.subtotal, ctx.totals.subtotal, 4, { bold: true }));
    if (ctx.totals.displayDiscountRow) rows.push(totalRow(t.diskon, `(${ctx.totals.discount})`, 4, { bold: true }));
    if (ctx.totals.hasPpn) rows.push(totalRow(ppnLabel(ctx), ctx.totals.taxAmount, 4, { bold: true }));
    if (ctx.packagePriceFormatted) {
        rows.push(totalRow(t.totalHargaPenawaran, ctx.totals.total, 4, { bold: true }));
        rows.push(totalRow(t.hargaPaket, ctx.packagePriceFormatted, 4, { bold: true, bg: theme.subtle }));
    } else {
        rows.push(...dpPaidRows(ctx, 4));
        rows.push(totalRow(t.grandTotal, ctx.totals.total, 4, { bold: true, bg: TOTAL_BG }));
        rows.push(...pphAndNetRows(ctx, 4));
    }
    return tableOf(rows);
}

// ── MODE: CATEGORY SUMMARY (ringkas) — hide qty/harga, hanya subtotal per kategori ──
function buildCategorySummaryTable(ctx: QuotationRenderContext, theme: DocxTheme): Table {
    const t = ctx.i18n;
    const rows: TableRow[] = [
        new TableRow({
            tableHeader: true,
            children: [
                labelCell(t.no, { bold: true, bg: theme.primary, color: 'FFFFFF', align: AlignmentType.CENTER }, 600),
                labelCell(t.uraian, { bold: true, bg: theme.primary, color: 'FFFFFF' }),
                labelCell(t.jumlah, { bold: true, bg: theme.primary, color: 'FFFFFF', align: AlignmentType.CENTER }, 2400),
            ],
        }),
    ];
    for (const group of ctx.itemGroups) {
        if (group.categoryName) rows.push(groupHeaderRow(group.categoryName.toUpperCase(), theme, 3));
        for (const it of group.items) {
            const desc = it.unit ? `${it.description}  ·  ${it.quantity}` : it.description;
            rows.push(new TableRow({
                children: [
                    labelCell(String(it.no), { align: AlignmentType.CENTER }),
                    labelCell(desc),
                    labelCell(''),
                ],
            }));
        }
        const subLabel = group.categoryName ? `${t.subtotal} ${group.categoryName}` : t.subtotal;
        rows.push(subtotalRow(subLabel, group.subtotalFormatted, theme, 2));
    }
    rows.push(totalRow(t.subtotalKeseluruhan, ctx.totals.subtotal, 2, { bold: true }));
    if (ctx.totals.displayDiscountRow) rows.push(totalRow(t.diskon, `(${ctx.totals.discount})`, 2, { bold: true }));
    if (ctx.totals.hasPpn) rows.push(totalRow(ppnLabel(ctx), ctx.totals.taxAmount, 2, { bold: true }));
    rows.push(...dpPaidRows(ctx, 2));
    rows.push(totalRow(t.grandTotal, ctx.totals.total, 2, { bold: true, bg: TOTAL_BG }));
    rows.push(...pphAndNetRows(ctx, 2));
    return tableOf(rows);
}

// ── MODE: EVENT-GROUPED — item dipisah per event lokasi ─────────────────────────
function buildEventGroupedTable(ctx: QuotationRenderContext, theme: DocxTheme): Table {
    const t = ctx.i18n;
    const rows: TableRow[] = [header5(ctx, theme)];
    for (const ev of ctx.itemsByEvent || []) {
        const head = `${ev.no}. ${ev.eventName}${ev.eventLocation ? `, ${ev.eventLocation}` : ''}${ev.eventDateRange ? ` — ${ev.eventDateRange}` : ''}`;
        rows.push(groupHeaderRow(head, theme, 5));
        for (const it of ev.items) rows.push(itemRow5(it));
        rows.push(subtotalRow(`${t.subtotal} ${ev.eventName}`, ev.subtotalFormatted, theme, 4));
    }
    if (ctx.showGrandTotal) {
        rows.push(totalRow(t.totalHargaPenawaran, ctx.totals.subtotal, 4, { bold: true }));
        if (ctx.totals.displayDiscountRow) rows.push(totalRow(t.diskon, `(${ctx.totals.discount})`, 4, { bold: true }));
        if (ctx.totals.hasPpn) rows.push(totalRow(ppnLabel(ctx), ctx.totals.taxAmount, 4, { bold: true }));
        if (ctx.packagePriceFormatted) rows.push(totalRow(t.hargaPaket, ctx.packagePriceFormatted, 4, { bold: true, bg: theme.subtle }));
        else {
            rows.push(...dpPaidRows(ctx, 4));
            rows.push(totalRow(t.grandTotal, ctx.totals.total, 4, { bold: true, bg: TOTAL_BG }));
        }
        rows.push(...pphAndNetRows(ctx, 4));
    }
    return tableOf(rows);
}

// ── MODE: PACKAGE — blok per paket (nama, opsi harga, spec) ──────────────────────
function buildPackageSection(ctx: QuotationRenderContext, theme: DocxTheme): (Paragraph | Table)[] {
    const t = ctx.i18n;
    const out: (Paragraph | Table)[] = [];
    for (const pkg of ctx.packages || []) {
        out.push(new Paragraph({
            spacing: { before: 140, after: 60 },
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: theme.light },
            border: { left: { style: BorderStyle.SINGLE, size: 24, color: theme.primary, space: 4 } },
            children: [new TextRun({ text: `${pkg.no}. ${pkg.name}`, bold: true, color: theme.dark, size: 23 })],
        }));
        for (const it of pkg.items) {
            out.push(new Paragraph({
                indent: { left: convertMillimetersToTwip(8) },
                tabStops: [{ type: TabStopType.RIGHT, position: convertMillimetersToTwip(165) }],
                children: [
                    new TextRun({ text: `▪ ${it.description}${it.unit ? ` (${it.quantity})` : ''}`, size: 22 }),
                    new TextRun({ text: `\t${it.price}`, bold: true, size: 22 }),
                ],
            }));
        }
        if (pkg.specs?.length) {
            out.push(p(t.specificationLabel, { italics: true, color: '555555', size: 21 }));
            for (const sp of pkg.specs) {
                if (sp.title) out.push(p(sp.title, { bold: true, color: theme.dark, size: 20 }));
                for (const line of sp.items) out.push(p(`✓ ${line}`, { size: 21 }));
            }
        }
    }
    if (ctx.showGrandTotal) {
        if (ctx.totals.displayDpPaidRow) {
            out.push(new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 100 },
                children: [new TextRun({ text: `${t.dpSudahDibayar}: -${ctx.totals.dpPaid}`, bold: true, color: TOTAL_RED, size: 22 })],
            }));
        }
        out.push(new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: ctx.totals.displayDpPaidRow ? 0 : 100 },
            children: [new TextRun({ text: `${t.grandTotal}: ${ctx.totals.total}`, bold: true, size: 22 })],
        }));
    }
    return out;
}

/** Dispatcher — pilih layout item SESUAI displayMode (sama seperti template PDF). */
function buildItemsSection(ctx: QuotationRenderContext, theme: DocxTheme): (Paragraph | Table)[] {
    if (ctx.displayMode === 'package' && ctx.packages?.length) return buildPackageSection(ctx, theme);
    if (ctx.displayMode === 'event-grouped' && ctx.itemsByEvent?.length) return [buildEventGroupedTable(ctx, theme)];
    if (ctx.displayMode === 'category-summary') return [buildCategorySummaryTable(ctx, theme)];
    return [buildDetailedTable(ctx, theme)];
}

/** Resolve image URL atau data URI ke buffer (untuk embed di DOCX). */
function imageUrlToBuffer(url: string | null | undefined): Buffer | null {
    if (!url) return null;
    if (url.startsWith('data:')) {
        // data URI: data:image/png;base64,XXXX
        const m = url.match(/^data:[^;]+;base64,(.+)$/);
        if (!m) return null;
        return Buffer.from(m[1], 'base64');
    }
    if (url.startsWith('/uploads/')) {
        const filePath = path.resolve(process.cwd(), 'public', url.replace(/^\//, ''));
        if (!fs.existsSync(filePath)) return null;
        return fs.readFileSync(filePath);
    }
    return null;
}

@Injectable()
export class DocxExportService {
    constructor(private contextBuilder: QuotationContextBuilder) { }

    async renderQuotationDocx(quotationId: number, dpPaid?: number): Promise<Buffer> {
        const ctx = await this.contextBuilder.build(quotationId, { dpPaid });
        const t = ctx.i18n;
        const theme = resolveDocxTheme(ctx);

        const children: (Paragraph | Table)[] = [];

        const letterheadBuf = imageUrlToBuffer(ctx.company.letterheadUrl);

        // ── Header section: kalau ada kop surat → letterhead full A4 floating behind text (repeat per page)
        //    kalau tidak ada → fallback text header (CV name + address) di body
        let sectionHeader: Header | undefined;
        if (letterheadBuf) {
            // A4 dimensions in EMU (English Metric Unit) yang dipakai docx library:
            // 210mm × 297mm = 7.795 × 11.05 inch → di docx pakai pixel (x96 dpi) atau langsung mm
            // ImageRun transformation pakai PIXEL (96 dpi). 210mm = 793 px, 297mm = 1122 px
            sectionHeader = new Header({
                children: [
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: letterheadBuf,
                                transformation: { width: 793, height: 1122 }, // 210mm × 297mm @ 96dpi
                                type: 'png',
                                floating: {
                                    horizontalPosition: {
                                        relative: HorizontalPositionRelativeFrom.PAGE,
                                        align: HorizontalPositionAlign.LEFT,
                                    },
                                    verticalPosition: {
                                        relative: VerticalPositionRelativeFrom.PAGE,
                                        align: VerticalPositionAlign.TOP,
                                    },
                                    behindDocument: true,            // di belakang text
                                    allowOverlap: true,
                                    layoutInCell: false,
                                },
                            }),
                        ],
                    }),
                ],
            });
        } else {
            // Fallback: text header di body (perilaku lama)
            children.push(
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.LEFT,
                    children: [new TextRun({ text: ctx.company.name, bold: true, color: theme.primary, size: 32 })],
                }),
            );
            if (ctx.company.address) children.push(p(ctx.company.address, { size: 18 }));
            const contact = [ctx.company.phone && `${t.telp} ${ctx.company.phone}`, ctx.company.email].filter(Boolean).join(' • ');
            if (contact) children.push(p(contact, { size: 18 }));
            children.push(p(''));
        }

        // ── Meta dokumen — urutan SAMA dengan template PDF (sewa.hbs):
        //    Tanggal (atas, kiri) → Nomor/No.Invoice → Perihal → Lampiran (non-invoice) → Jatuh Tempo
        children.push(p(`${t.tanggal}: ${ctx.doc.city ? `${ctx.doc.city}, ` : ''}${ctx.doc.dateFormatted}`));
        children.push(p(`${ctx.doc.isInvoice ? t.noInvoice : t.nomor} : ${ctx.doc.number}${ctx.doc.isRevision ? ` (${t.revisi} ${ctx.doc.revisionNumber})` : ''}`, { bold: true }));
        children.push(p(`${t.perihal} : ${ctx.doc.subject}`, { bold: true }));
        if (!ctx.doc.isInvoice) children.push(p(`${t.lampiran} : ${ctx.attachment.label}`));
        if (ctx.doc.dueDateFormatted) children.push(p(`${t.jatuhTempo} : ${ctx.doc.dueDateFormatted}`, { bold: true }));
        children.push(p(''));

        // ── Kepada
        children.push(p(`${t.kepada}`, { bold: true }));
        children.push(p(ctx.client.name));
        if (ctx.client.company) children.push(p(ctx.client.company, { bold: true }));
        if (ctx.client.address) children.push(p(ctx.client.address));
        if (t.diTempat) children.push(p(t.diTempat));
        children.push(p(''));

        // ── Opening
        const projectBits = [
            ctx.project.name ? `${t.untukAcara} ${ctx.project.name}` : '',
            ctx.project.location ? `${t.di} ${ctx.project.location}` : '',
            ctx.project.dateRange !== '-' ? `${t.padaTanggal} ${ctx.project.dateRange}` : '',
        ].filter(Boolean).join(' ');
        children.push(
            new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                children: [
                    new TextRun({ text: t.denganHormat, size: 22 }),
                ],
            }),
        );
        children.push(
            new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: { after: 100 },
                children: [
                    new TextRun({
                        text: `${t.bersamaSurat} ${ctx.company.name} ${t.mengajukanPenawaran} ${ctx.doc.variantLabel}${projectBits ? ` ${projectBits}` : ''}. ${t.rincianPenawaran}`,
                        size: 22,
                    }),
                ],
            }),
        );
        children.push(p(''));

        // ── Items (grouped by category)
        children.push(...buildItemsSection(ctx, theme));
        children.push(p(''));
        children.push(
            new Paragraph({
                children: [
                    new TextRun({ text: `${t.terbilang}: `, italics: true, size: 22 }),
                    new TextRun({ text: ctx.totals.totalTerbilang, italics: true, bold: true, size: 22 }),
                ],
            }),
        );

        // ── Spesifikasi (standalone) — sama seperti PDF, di antara terbilang & footer
        if (ctx.specifications?.length) {
            children.push(sectionTitle(t.spesifikasi, theme.primary));
            for (const sp of ctx.specifications) {
                if (sp.title) children.push(p(`▪ ${sp.title}`, { bold: true, color: theme.dark, size: 21 }));
                for (const line of sp.items) {
                    children.push(new Paragraph({
                        indent: { left: convertMillimetersToTwip(8) },
                        spacing: { after: 20 },
                        children: [new TextRun({ text: `✓ ${line}`, size: 21 })],
                    }));
                }
            }
        }

        // ── Sistem Pembayaran (jadwal DP/Pelunasan) — sebelumnya HILANG di DOCX,
        //    padahal PDF merendernya. Tampil kalau quotation set paymentSchedule.
        if (ctx.paymentSchedule?.length) {
            children.push(sectionTitle(t.sistemPembayaran, theme.primary));
            for (const ps of ctx.paymentSchedule) {
                children.push(new Paragraph({
                    spacing: { after: 40 },
                    children: [
                        new TextRun({ text: `• ${ps.label} ${ps.percent}% `, bold: true, size: 21 }),
                        new TextRun({ text: `${t.sebesar} `, size: 21 }),
                        new TextRun({ text: ps.amountFormatted, bold: true, size: 21 }),
                        new TextRun({ text: ` (${ps.amountTerbilang})`, italics: true, color: '555555', size: 21 }),
                    ],
                }));
            }
        }

        // ── Catatan Harga / Disclaimer
        if (ctx.brandTexts.disclaimer) {
            children.push(sectionTitle(t.catatanHarga, theme.primary));
            children.push(...multilineParagraphs(ctx.brandTexts.disclaimer, { size: 20, color: '333333' }));
        }

        // ── Sistem Pembayaran
        if (ctx.brandTexts.paymentTerms) {
            children.push(sectionTitle(t.sistemPembayaran, theme.primary));
            children.push(...multilineParagraphs(ctx.brandTexts.paymentTerms, { size: 21 }));
        }

        // ── Bank
        if (ctx.payment.banks.length) {
            children.push(sectionTitle(t.pembayaranTransferKe, theme.primary));
            ctx.payment.banks.forEach((b) => {
                children.push(
                    new Paragraph({
                        spacing: { after: 40 },
                        children: [
                            new TextRun({ text: `• ${t.bankWord} `, size: 21 }),
                            new TextRun({ text: b.bankName, bold: true, size: 21 }),
                            new TextRun({ text: ` — ${t.noRek} `, size: 21 }),
                            new TextRun({ text: b.accountNumber, bold: true, size: 21 }),
                            new TextRun({ text: ` ${t.accHolderShort} ${b.accountOwner}`, size: 21 }),
                        ],
                    }),
                );
            });
        }

        // ── Closing
        children.push(p(''));
        const closingText = ctx.brandTexts.closing
            || t.penawaranClosingDefault;
        children.push(...multilineParagraphs(closingText, { size: 21 }));

        // ── Signature: hormat kami → image tanda tangan + stempel → nama → posisi
        children.push(p(''));
        children.push(p(t.hormatKami, { align: AlignmentType.RIGHT }));
        children.push(new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: ctx.company.name, bold: true, size: 22 })],
        }));

        // Image signature + stamp
        const signatureBuf = imageUrlToBuffer(ctx.signedBy.signatureUrl);
        const stampBuf = imageUrlToBuffer(ctx.signedBy.stampUrl);
        if (signatureBuf || stampBuf) {
            const imageRuns: ImageRun[] = [];
            if (stampBuf) {
                imageRuns.push(new ImageRun({
                    data: stampBuf,
                    transformation: { width: 110, height: 110 },
                    type: 'png',
                }));
            }
            if (signatureBuf) {
                imageRuns.push(new ImageRun({
                    data: signatureBuf,
                    transformation: { width: 140, height: 80 },
                    type: 'png',
                }));
            }
            children.push(new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 100, after: 100 },
                children: imageRuns,
            }));
        } else {
            // Fallback: 3 baris kosong untuk space tanda tangan manual
            children.push(p(''));
            children.push(p(''));
            children.push(p(''));
        }

        const signerName = ctx.signedBy.name || '_____________________';
        children.push(p(signerName, { bold: true, align: AlignmentType.RIGHT }));
        children.push(p(ctx.signedBy.position || 'Marketing', { align: AlignmentType.RIGHT }));

        // Margin section — kalau ada kop surat, kasih margin atas & bawah lebih besar
        // agar text tidak tertimpa banner kop surat
        const marginConfig = letterheadBuf
            ? {
                top: convertMillimetersToTwip(38),
                right: convertMillimetersToTwip(22),
                bottom: convertMillimetersToTwip(45),
                left: convertMillimetersToTwip(22),
                header: convertMillimetersToTwip(0),
                footer: convertMillimetersToTwip(0),
            }
            : {
                top: convertMillimetersToTwip(18),
                right: convertMillimetersToTwip(22),
                bottom: convertMillimetersToTwip(22),
                left: convertMillimetersToTwip(22),
            };

        const doc = new Document({
            creator: ctx.company.name,
            title: `Penawaran ${ctx.doc.number}`,
            sections: [{
                properties: {
                    page: {
                        margin: marginConfig,
                    },
                },
                headers: sectionHeader ? { default: sectionHeader } : undefined,
                children,
            }],
        });

        const buf = await Packer.toBuffer(doc);
        return buf;
    }
}
