import {
    Body,
    Controller,
    Delete,
    Get,
    Header,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    Res,
    UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { InvoiceStatus, QuotationVariant } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuotationsService } from './quotations.service';
import { PdfExportService } from '../exporters/pdf-export.service';
import { DocxExportService } from '../exporters/docx-export.service';
import type { CreateQuotationDto } from './dto/create-quotation.dto';
import type { UpdateQuotationDto } from './dto/update-quotation.dto';

/**
 * Normalize karakter Unicode common ke ASCII equivalent supaya filename safe untuk
 * HTTP header (RFC 7230 melarang non-ASCII di header value, kecuali pakai RFC 5987 encoding).
 * Mis: em-dash "–" → "-", smart quote """ → '"', non-breaking space → space, dll.
 */
function normalizeUnicodeToAscii(s: string): string {
    return s
        // Dash family (em-dash, en-dash, figure dash, minus sign, dll) → ASCII hyphen
        .replace(/[‐-―−⁃﹘﹣－]/g, '-')
        // Smart quotes → ASCII quote
        .replace(/[‘’‚‛′]/g, "'")
        .replace(/[“”„‟″]/g, '"')
        // Non-breaking space & other unicode whitespace → regular space
        .replace(/[  -‍  　]/g, ' ')
        // Ellipsis → 3 dots
        .replace(/…/g, '...')
        // Bullet, middle dot → dash
        .replace(/[•·]/g, '-');
}

/**
 * Sanitize filename ke ASCII-safe: pertahankan format nomor penawaran semaksimal mungkin.
 * - Normalize Unicode (em-dash, smart quote, dll) ke ASCII equivalent
 * - Slash `/` → `-`, backslash & karakter terlarang → underscore
 * - Strip residu non-ASCII (huruf accented "é", emoji, dll) supaya HTTP header gak crash
 *   Contoh: "IndoBuildTech – Part 1" → "IndoBuildTech-Part-1"
 *           "5260/Xp.Pnwr/V/26"     → "5260-Xp.Pnwr-V-26"
 */
function safeFilename(s: string): string {
    return normalizeUnicodeToAscii(s)
        .replace(/\//g, '-')
        .replace(/[\\?<>|*"\x00-\x1f]/g, '_')
        // Strip semua karakter non-ASCII residu (mis. accented letters, emoji)
        // RFC 7230: HTTP header value harus ASCII-only
        .replace(/[^\x20-\x7e]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/_+/g, '_')
        .replace(/-+/g, '-')
        .replace(/^[._-]+|[._-]+$/g, '')
        .slice(0, 120);
}

/**
 * Build Content-Disposition header value yang aman untuk Unicode filename.
 * - `filename="..."` (ASCII-safe fallback) untuk legacy clients
 * - `filename*=UTF-8''...` (RFC 5987) untuk browser modern → bisa pakai nama original
 */
function buildContentDisposition(disposition: 'inline' | 'attachment', originalName: string, ext: string): string {
    const asciiName = `${safeFilename(originalName)}.${ext}`;
    const utf8Name = `${originalName}.${ext}`;
    // RFC 5987: percent-encode UTF-8 bytes, exclude attr-char set
    const encoded = encodeURIComponent(utf8Name);
    return `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encoded}`;
}

/**
 * Bangun nama file export berdasarkan data penawaran (ORIGINAL, bisa berisi Unicode).
 * Sanitization ke ASCII dilakukan di `buildContentDisposition()` saat set HTTP header.
 * - Kalau nomor sudah di-assign (bukan DRAFT) → pakai nomor langsung
 * - Kalau masih DRAFT → kombinasi nama proyek/klien supaya gak random
 */
function buildExportFilename(inv: any): string {
    const num = (inv.invoiceNumber ?? '').toString();
    const isDraft = num.startsWith('DRAFT-') || num.startsWith('DRAFT_');
    if (!isDraft && num) {
        return num;
    }
    // DRAFT — pakai project + client untuk nama yang lebih readable
    const project = (inv.projectName ?? '').toString().trim();
    const company = (inv.clientCompany ?? '').toString().trim();
    const client = (inv.clientName ?? '').toString().trim();
    const parts = ['Penawaran'];
    if (project) parts.push(project);
    if (company) parts.push(company);
    else if (client) parts.push(client);
    if (parts.length === 1) parts.push('DRAFT');
    return parts.join('-');
}

@UseGuards(JwtAuthGuard)
@Controller('quotations')
export class QuotationsController {
    constructor(
        private readonly service: QuotationsService,
        private readonly pdfExport: PdfExportService,
        private readonly docxExport: DocxExportService,
    ) { }

    @Post()
    create(@Body() dto: CreateQuotationDto) {
        return this.service.create(dto);
    }

    /** One-time admin tool: promote semua quotation lama dengan nomor resmi tapi status DRAFT → SENT */
    @Post('backfill-status')
    backfillStatus() {
        return this.service.backfillQuotationStatus();
    }

    @Get()
    findAll(
        @Query('variant') variant?: QuotationVariant,
        @Query('variantCode') variantCode?: string,
        @Query('year') year?: string,
        @Query('status') status?: InvoiceStatus,
        @Query('type') type?: 'QUOTATION' | 'INVOICE' | 'ALL',
    ) {
        return this.service.findAll({
            variant,
            variantCode: variantCode || undefined,
            year: year ? parseInt(year, 10) : undefined,
            status,
            type,
        });
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.service.findOne(id);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateQuotationDto) {
        return this.service.update(id, dto);
    }

    @Post(':id/assign-number')
    assignNumber(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { mode?: 'auto' | 'manual'; customNumber?: string } = {},
    ) {
        return this.service.assignNumber(id, body);
    }

    /** Edit nomor penawaran — koreksi typo / ganti format setelah nomor di-assign. */
    @Patch(':id/edit-number')
    editNumber(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { invoiceNumber: string },
    ) {
        return this.service.editNumber(id, body.invoiceNumber);
    }

    @Post(':id/generate-invoice')
    generateInvoice(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { part: 'DP' | 'PELUNASAN' | 'FULL'; customAmount?: number; dueDate?: string },
    ) {
        return this.service.generateInvoiceFromQuotation(id, body);
    }

    @Get(':id/invoices')
    listInvoices(@Param('id', ParseIntPipe) id: number) {
        return this.service.listInvoicesByQuotation(id);
    }

    @Post(':id/revise')
    revise(@Param('id', ParseIntPipe) id: number) {
        return this.service.revise(id);
    }

    @Post('from-customer/:customerId')
    fromCustomer(
        @Param('customerId', ParseIntPipe) customerId: number,
        @Body('variant') variant: QuotationVariant,
    ) {
        return this.service.createFromCustomer(customerId, variant);
    }

    @Get(':id/export/pdf')
    @Header('Content-Type', 'application/pdf')
    async exportPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
        const inv = await this.service.findOne(id);
        const pdf = await this.pdfExport.renderQuotationPdf(id);
        // Filename: kalau nomor sudah di-assign → pakai nomor, kalau masih DRAFT → pakai
        // kombinasi nama project + klien supaya tidak random "DRAFT-1777891675959.pdf".
        // buildContentDisposition() handle sanitize ASCII + RFC 5987 UTF-8 encoding,
        // jadi karakter Unicode (em-dash, accented, dll) di project_name aman di header.
        res.setHeader('Content-Disposition', buildContentDisposition('inline', buildExportFilename(inv), 'pdf'));
        res.setHeader('Content-Length', pdf.length.toString());
        res.end(pdf);
    }

    @Get(':id/export/spk-pdf')
    @Header('Content-Type', 'application/pdf')
    async exportSpkPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
        const inv = await this.service.findOne(id);
        const pdf = await this.pdfExport.renderSpkPdf(id);
        // Filename: "SPK-{nomor}.pdf" — derive dari nomor penawaran
        const baseName = buildExportFilename(inv).replace(/^SPK-/i, '');
        res.setHeader('Content-Disposition', buildContentDisposition('inline', `SPK-${baseName}`, 'pdf'));
        res.setHeader('Content-Length', pdf.length.toString());
        res.end(pdf);
    }

    @Get(':id/export/docx')
    async exportDocx(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
        const inv = await this.service.findOne(id);
        const docx = await this.docxExport.renderQuotationDocx(id);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
        res.setHeader('Content-Disposition', buildContentDisposition('attachment', buildExportFilename(inv), 'docx'));
        res.setHeader('Content-Length', docx.length.toString());
        res.end(docx);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.service.remove(id);
    }
}
