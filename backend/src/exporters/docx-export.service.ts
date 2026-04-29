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
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import { QuotationContextBuilder, QuotationRenderContext } from './quotation-context.builder';

const PRIMARY = 'C8203A';      // merah Exindo (sesuai kop surat)
const PRIMARY_LIGHT = 'FDE2E6'; // pink muda untuk header kategori
const PRIMARY_LIGHTER = 'FFF8F9';
const TOTAL_BG = 'F1F5FB';

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

function sectionTitle(title: string): Paragraph {
    return new Paragraph({
        spacing: { before: 200, after: 80 },
        border: {
            bottom: { style: BorderStyle.SINGLE, size: 4, color: PRIMARY },
        },
        children: [
            new TextRun({
                text: title,
                bold: true,
                size: 22,
                color: PRIMARY,
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

function buildItemsTable(ctx: QuotationRenderContext): Table {
    const headerRow = new TableRow({
        tableHeader: true,
        children: [
            labelCell('No', { bold: true, bg: PRIMARY, color: 'FFFFFF', align: AlignmentType.CENTER }, 600),
            labelCell('Uraian', { bold: true, bg: PRIMARY, color: 'FFFFFF' }),
            labelCell('Qty', { bold: true, bg: PRIMARY, color: 'FFFFFF', align: AlignmentType.CENTER }, 1400),
            labelCell('Harga Satuan', { bold: true, bg: PRIMARY, color: 'FFFFFF', align: AlignmentType.CENTER }, 1800),
            labelCell('Jumlah', { bold: true, bg: PRIMARY, color: 'FFFFFF', align: AlignmentType.CENTER }, 2000),
        ],
    });

    const rows: TableRow[] = [headerRow];

    // Render per group: category header row → items → subtotal kategori (kalau ada kategori)
    for (const group of ctx.itemGroups) {
        if (group.categoryName) {
            rows.push(
                new TableRow({
                    children: [
                        labelCell(
                            group.categoryName.toUpperCase(),
                            { bold: true, bg: PRIMARY_LIGHT, color: '8A1729' },
                            undefined,
                            5,
                        ),
                    ],
                }),
            );
        }
        for (const it of group.items) {
            rows.push(
                new TableRow({
                    children: [
                        labelCell(String(it.no), { align: AlignmentType.CENTER }),
                        labelCell(it.description),
                        labelCell(it.quantity, { align: AlignmentType.RIGHT }),
                        labelCell(it.price, { align: AlignmentType.RIGHT }),
                        labelCell(it.subtotal, { align: AlignmentType.RIGHT }),
                    ],
                }),
            );
        }
        if (group.categoryName) {
            rows.push(
                new TableRow({
                    children: [
                        labelCell(`Subtotal ${group.categoryName}`, {
                            italics: true,
                            bold: true,
                            bg: PRIMARY_LIGHTER,
                            align: AlignmentType.RIGHT,
                        }, undefined, 4),
                        labelCell(group.subtotalFormatted, {
                            italics: true,
                            bold: true,
                            bg: PRIMARY_LIGHTER,
                            align: AlignmentType.RIGHT,
                        }),
                    ],
                }),
            );
        }
    }

    // Footer (subtotal + tax + grand total)
    rows.push(
        new TableRow({
            children: [
                new TableCell({
                    columnSpan: 4,
                    children: [p('Subtotal', { bold: true, align: AlignmentType.RIGHT })],
                }),
                labelCell(ctx.totals.subtotal, { bold: true, align: AlignmentType.RIGHT }),
            ],
        }),
    );
    if (Number(ctx.totals.taxRate) > 0) {
        rows.push(
            new TableRow({
                children: [
                    new TableCell({
                        columnSpan: 4,
                        children: [p(`PPN ${ctx.totals.taxRate}%`, { bold: true, align: AlignmentType.RIGHT })],
                    }),
                    labelCell(ctx.totals.taxAmount, { bold: true, align: AlignmentType.RIGHT }),
                ],
            }),
        );
    }
    rows.push(
        new TableRow({
            children: [
                new TableCell({
                    columnSpan: 4,
                    shading: { type: ShadingType.CLEAR, color: 'auto', fill: TOTAL_BG },
                    children: [p('Grand Total', { bold: true, align: AlignmentType.RIGHT })],
                }),
                labelCell(ctx.totals.total, { bold: true, bg: TOTAL_BG, align: AlignmentType.RIGHT }),
            ],
        }),
    );

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: border(),
        rows,
    });
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

    async renderQuotationDocx(quotationId: number): Promise<Buffer> {
        const ctx = await this.contextBuilder.build(quotationId);

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
                    children: [new TextRun({ text: ctx.company.name, bold: true, color: PRIMARY, size: 32 })],
                }),
            );
            if (ctx.company.address) children.push(p(ctx.company.address, { size: 18 }));
            const contact = [ctx.company.phone && `Telp: ${ctx.company.phone}`, ctx.company.email].filter(Boolean).join(' • ');
            if (contact) children.push(p(contact, { size: 18 }));
            children.push(p(''));
        }

        // ── Nomor + Kota/Tgl
        children.push(p(`Nomor    : ${ctx.doc.number}${ctx.doc.isRevision ? ` (Rev. ${ctx.doc.revisionNumber})` : ''}`, { bold: true }));
        children.push(p(`Lampiran : 1 (satu) berkas`));
        children.push(p(`Perihal  : ${ctx.doc.subject}`, { bold: true }));
        children.push(p(`${ctx.doc.city}, ${ctx.doc.dateFormatted}`, { align: AlignmentType.RIGHT }));
        children.push(p(''));

        // ── Kepada
        children.push(p('Kepada Yth.,', { bold: true }));
        children.push(p(ctx.client.name));
        if (ctx.client.company) children.push(p(ctx.client.company, { bold: true }));
        if (ctx.client.address) children.push(p(ctx.client.address));
        children.push(p('di Tempat'));
        children.push(p(''));

        // ── Opening
        const projectBits = [
            ctx.project.name ? `untuk acara ${ctx.project.name}` : '',
            ctx.project.location ? `di ${ctx.project.location}` : '',
            ctx.project.dateRange !== '-' ? `pada tanggal ${ctx.project.dateRange}` : '',
        ].filter(Boolean).join(' ');
        children.push(
            new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                children: [
                    new TextRun({ text: 'Dengan hormat,', size: 22 }),
                ],
            }),
        );
        children.push(
            new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: { after: 100 },
                children: [
                    new TextRun({
                        text: `Bersama surat ini kami ${ctx.company.name} mengajukan penawaran harga ${ctx.doc.variantLabel} ${projectBits}. Adapun rincian penawaran kami adalah sebagai berikut:`,
                        size: 22,
                    }),
                ],
            }),
        );
        children.push(p(''));

        // ── Items (grouped by category)
        children.push(buildItemsTable(ctx));
        children.push(p(''));
        children.push(
            new Paragraph({
                children: [
                    new TextRun({ text: 'Terbilang: ', italics: true, size: 22 }),
                    new TextRun({ text: ctx.totals.totalTerbilang, italics: true, bold: true, size: 22 }),
                ],
            }),
        );

        // ── Catatan Harga / Disclaimer
        if (ctx.brandTexts.disclaimer) {
            children.push(sectionTitle('Catatan Harga'));
            children.push(...multilineParagraphs(ctx.brandTexts.disclaimer, { size: 20, color: '333333' }));
        }

        // ── Sistem Pembayaran
        if (ctx.brandTexts.paymentTerms) {
            children.push(sectionTitle('Sistem Pembayaran'));
            children.push(...multilineParagraphs(ctx.brandTexts.paymentTerms, { size: 21 }));
        }

        // ── Bank
        if (ctx.payment.banks.length) {
            children.push(sectionTitle('Pembayaran Transfer Ke'));
            ctx.payment.banks.forEach((b) => {
                children.push(
                    new Paragraph({
                        spacing: { after: 40 },
                        children: [
                            new TextRun({ text: '• Bank ', size: 21 }),
                            new TextRun({ text: b.bankName, bold: true, size: 21 }),
                            new TextRun({ text: ' — No. Rek. ', size: 21 }),
                            new TextRun({ text: b.accountNumber, bold: true, size: 21 }),
                            new TextRun({ text: ` a.n. ${b.accountOwner}`, size: 21 }),
                        ],
                    }),
                );
            });
        }

        // ── Closing
        children.push(p(''));
        const closingText = ctx.brandTexts.closing
            || 'Demikian penawaran ini kami sampaikan. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.';
        children.push(...multilineParagraphs(closingText, { size: 21 }));

        // ── Signature: hormat kami → image tanda tangan + stempel → nama → posisi
        children.push(p(''));
        children.push(p('Hormat kami,', { align: AlignmentType.RIGHT }));
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
