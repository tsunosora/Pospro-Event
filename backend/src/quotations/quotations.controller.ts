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
 * Sanitize filename: pertahankan format nomor penawaran semaksimal mungkin.
 * - Slash `/` (path separator, gak boleh) → ganti `-`
 * - Backslash dan karakter terlarang lain → underscore
 * - Pertahankan titik, dash, alfanumerik, spasi (akan di-trim)
 *   Contoh: "5260/Xp.Pnwr/V/26" → "5260-Xp.Pnwr-V-26"
 */
function safeFilename(s: string): string {
    return s
        .replace(/\//g, '-')
        .replace(/[\\?<>|*"\x00-\x1f]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/_+/g, '_')
        .replace(/-+/g, '-')
        .replace(/^[._-]+|[._-]+$/g, '')
        .slice(0, 120);
}

/**
 * Bangun nama file export berdasarkan data penawaran.
 * - Kalau nomor sudah di-assign (bukan DRAFT) → pakai nomor: "5260-Xp.Pnwr-V-26"
 * - Kalau masih DRAFT → kombinasi nama proyek/klien supaya gak random:
 *   "Penawaran-IIFEX-PT.Prasetia" (project + company), atau
 *   "Penawaran-PT.Prasetia" (kalau project kosong), atau
 *   "Penawaran-DRAFT" (fallback ekstrem)
 */
function buildExportFilename(inv: any): string {
    const num = (inv.invoiceNumber ?? '').toString();
    const isDraft = num.startsWith('DRAFT-') || num.startsWith('DRAFT_');
    if (!isDraft && num) {
        return safeFilename(num);
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
    return safeFilename(parts.join('-'));
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
        const fileName = `${buildExportFilename(inv)}.pdf`;
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        res.setHeader('Content-Length', pdf.length.toString());
        res.end(pdf);
    }

    @Get(':id/export/docx')
    async exportDocx(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
        const inv = await this.service.findOne(id);
        const docx = await this.docxExport.renderQuotationDocx(id);
        const fileName = `${buildExportFilename(inv)}.docx`;
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', docx.length.toString());
        res.end(docx);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.service.remove(id);
    }
}
