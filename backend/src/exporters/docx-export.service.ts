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
} from 'docx';
import { QuotationContextBuilder, QuotationRenderContext } from './quotation-context.builder';

const NAVY = '1A3B7C';
const LIGHT = 'F1F5FB';

function border(color = '666666') {
    return {
        top: { style: BorderStyle.SINGLE, size: 4, color },
        bottom: { style: BorderStyle.SINGLE, size: 4, color },
        left: { style: BorderStyle.SINGLE, size: 4, color },
        right: { style: BorderStyle.SINGLE, size: 4, color },
    };
}

function p(text: string, opts: { bold?: boolean; size?: number; align?: typeof AlignmentType[keyof typeof AlignmentType] } = {}) {
    return new Paragraph({
        alignment: opts.align,
        children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 22 })],
    });
}

function labelCell(text: string, opts: { bold?: boolean; bg?: string; color?: string; align?: typeof AlignmentType[keyof typeof AlignmentType] } = {}, width?: number) {
    return new TableCell({
        width: width ? { size: width, type: WidthType.DXA } : undefined,
        shading: opts.bg ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.bg } : undefined,
        children: [
            new Paragraph({
                alignment: opts.align,
                children: [
                    new TextRun({
                        text,
                        bold: opts.bold,
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
            labelCell('No', { bold: true, bg: NAVY, color: 'FFFFFF', align: AlignmentType.CENTER }, 600),
            labelCell('Uraian', { bold: true, bg: NAVY, color: 'FFFFFF' }),
            labelCell('Qty', { bold: true, bg: NAVY, color: 'FFFFFF', align: AlignmentType.CENTER }, 1400),
            labelCell('Harga Satuan', { bold: true, bg: NAVY, color: 'FFFFFF', align: AlignmentType.CENTER }, 1800),
            labelCell('Jumlah', { bold: true, bg: NAVY, color: 'FFFFFF', align: AlignmentType.CENTER }, 2000),
        ],
    });

    const itemRows = ctx.items.map(
        (it) =>
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

    const footerRows: TableRow[] = [];
    const emptyFour = () =>
        [0, 1, 2, 3].map((i) =>
            labelCell(i === 3 ? '' : '', { align: AlignmentType.RIGHT }),
        );

    footerRows.push(
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
    footerRows.push(
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
    footerRows.push(
        new TableRow({
            children: [
                new TableCell({
                    columnSpan: 4,
                    shading: { type: ShadingType.CLEAR, color: 'auto', fill: LIGHT },
                    children: [p('Grand Total', { bold: true, align: AlignmentType.RIGHT })],
                }),
                labelCell(ctx.totals.total, { bold: true, bg: LIGHT, align: AlignmentType.RIGHT }),
            ],
        }),
    );

    void emptyFour; // silence unused

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: border(),
        rows: [headerRow, ...itemRows, ...footerRows],
    });
}

@Injectable()
export class DocxExportService {
    constructor(private contextBuilder: QuotationContextBuilder) { }

    async renderQuotationDocx(quotationId: number): Promise<Buffer> {
        const ctx = await this.contextBuilder.build(quotationId);

        const children: (Paragraph | Table)[] = [];

        // Kop
        children.push(
            new Paragraph({
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: ctx.company.name, bold: true, color: NAVY, size: 32 })],
            }),
        );
        if (ctx.company.address) children.push(p(ctx.company.address, { size: 18 }));
        const contact = [ctx.company.phone && `Telp: ${ctx.company.phone}`, ctx.company.email].filter(Boolean).join(' • ');
        if (contact) children.push(p(contact, { size: 18 }));
        children.push(p(''));

        // Nomor + Kota/Tgl
        children.push(p(`Nomor   : ${ctx.doc.number}${ctx.doc.isRevision ? ` (Rev. ${ctx.doc.revisionNumber})` : ''}`, { bold: true }));
        children.push(p(`Lampiran: 1 (satu) berkas`));
        children.push(p(`Perihal : ${ctx.doc.subject}`, { bold: true }));
        children.push(p(`${ctx.doc.city}, ${ctx.doc.dateFormatted}`, { align: AlignmentType.RIGHT }));
        children.push(p(''));

        // Kepada
        children.push(p('Kepada Yth.,', { bold: true }));
        children.push(p(ctx.client.name));
        if (ctx.client.company) children.push(p(ctx.client.company, { bold: true }));
        if (ctx.client.address) children.push(p(ctx.client.address));
        children.push(p('di Tempat'));
        children.push(p(''));

        // Opening
        const projectBits = [
            ctx.project.name ? `untuk acara ${ctx.project.name}` : '',
            ctx.project.location ? `di ${ctx.project.location}` : '',
            ctx.project.dateRange !== '-' ? `pada tanggal ${ctx.project.dateRange}` : '',
        ].filter(Boolean).join(' ');
        children.push(
            p(
                `Dengan hormat, bersama surat ini kami ${ctx.company.name} mengajukan penawaran harga ${ctx.doc.variantLabel} ${projectBits}. Adapun rincian penawaran kami adalah sebagai berikut:`,
            ),
        );
        children.push(p(''));

        // Items table
        children.push(buildItemsTable(ctx));
        children.push(p(''));
        children.push(
            new Paragraph({
                children: [
                    new TextRun({ text: 'Terbilang: ', italics: true }),
                    new TextRun({ text: ctx.totals.totalTerbilang, italics: true, bold: true }),
                ],
            }),
        );
        children.push(p(''));

        // Terms
        children.push(p('Syarat & Ketentuan', { bold: true, size: 22 }));
        const terms = [
            `Penawaran berlaku ${ctx.doc.validUntilFormatted ? `hingga ${ctx.doc.validUntilFormatted}` : '14 hari sejak tanggal penawaran'}.`,
            `Harga sudah termasuk PPN ${ctx.totals.taxRate}%.`,
            ctx.doc.variant === 'PENGADAAN_BOOTH'
                ? `Pembayaran: DP ${ctx.payment.dpPercent}% (${ctx.payment.dpAmount}) sebagai tanda jadi produksi, pelunasan ${ctx.payment.pelunasan} setelah booth terpasang.`
                : `Pembayaran: DP ${ctx.payment.dpPercent}% (${ctx.payment.dpAmount}) sebelum pemasangan, pelunasan ${ctx.payment.pelunasan} setelah acara selesai.`,
        ];
        if (ctx.notes) terms.push(ctx.notes);
        terms.forEach((t, i) => children.push(p(`${i + 1}. ${t}`)));
        children.push(p(''));

        // Bank
        if (ctx.payment.banks.length) {
            children.push(p('Pembayaran Transfer Ke:', { bold: true }));
            ctx.payment.banks.forEach((b) => {
                children.push(p(`• Bank ${b.bankName} — No. Rek. ${b.accountNumber} a.n. ${b.accountOwner}`));
            });
            children.push(p(''));
        }

        // Signature
        children.push(p(''));
        children.push(p('Hormat kami,', { align: AlignmentType.RIGHT }));
        children.push(p(ctx.company.name, { align: AlignmentType.RIGHT }));
        children.push(p(''));
        children.push(p(''));
        children.push(p(''));
        children.push(p(ctx.company.directorName || '_____________________', { bold: true, align: AlignmentType.RIGHT }));
        children.push(p('Direktur', { align: AlignmentType.RIGHT }));

        const doc = new Document({
            creator: ctx.company.name,
            title: `Penawaran ${ctx.doc.number}`,
            sections: [{ properties: {}, children }],
        });

        const buf = await Packer.toBuffer(doc);
        return buf;
    }
}
