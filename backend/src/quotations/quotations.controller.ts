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

function safeFilename(s: string): string {
    return s.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
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

    @Get()
    findAll(
        @Query('variant') variant?: QuotationVariant,
        @Query('year') year?: string,
        @Query('status') status?: InvoiceStatus,
    ) {
        return this.service.findAll({
            variant,
            year: year ? parseInt(year, 10) : undefined,
            status,
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
    assignNumber(@Param('id', ParseIntPipe) id: number) {
        return this.service.assignNumber(id);
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
        const fileName = safeFilename(`Penawaran_${inv.invoiceNumber}.pdf`);
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        res.setHeader('Content-Length', pdf.length.toString());
        res.end(pdf);
    }

    @Get(':id/export/docx')
    async exportDocx(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
        const inv = await this.service.findOne(id);
        const docx = await this.docxExport.renderQuotationDocx(id);
        const fileName = safeFilename(`Penawaran_${inv.invoiceNumber}.docx`);
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
