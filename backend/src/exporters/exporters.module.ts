import { Module } from '@nestjs/common';
import { PdfExportService } from './pdf-export.service';
import { DocxExportService } from './docx-export.service';
import { XlsxExportService } from './xlsx-export.service';
import { QuotationContextBuilder } from './quotation-context.builder';
import { EventPdfExportService } from './event-pdf-export.service';
import { BastContextBuilder } from './bast-context.builder';
import { BastPdfExportService } from './bast-pdf-export.service';

@Module({
    providers: [QuotationContextBuilder, PdfExportService, DocxExportService, XlsxExportService, EventPdfExportService, BastContextBuilder, BastPdfExportService],
    exports: [PdfExportService, DocxExportService, XlsxExportService, EventPdfExportService, BastPdfExportService],
})
export class ExportersModule { }
