import { QuotationVariant, EventBrand } from '@prisma/client';
import { QuotationItemInput } from './quotation-item.dto';

export interface CreateQuotationDto {
    quotationVariant?: QuotationVariant;     // legacy enum (optional kalau pakai variantCode)
    variantCode?: string | null;             // kode dari QuotationVariantConfig (CRUD-able) — prioritas utama
    brand?: EventBrand | null;
    signedByWorkerId?: number | null;        // Marketing yang menandatangani surat penawaran
    itemDisplayMode?: 'detailed' | 'category-summary' | null; // tampilan item di PDF/DOCX

    // Klien — boleh dari Customer existing, atau manual
    customerId?: number | null;
    clientName: string;
    clientCompany?: string;
    clientAddress?: string;
    clientPhone?: string;
    clientEmail?: string;

    // Detail event/project
    projectName?: string;
    eventLocation?: string;
    eventDateStart?: string | Date;   // ISO
    eventDateEnd?: string | Date;

    // Penawaran terms
    date?: string | Date;
    signCity?: string | null;          // Kota lokasi surat dibuat (header surat: "Semarang, 28 April 2026")
    validUntil?: string | Date;
    dpPercent?: number;
    bankAccountIds?: string;           // CSV: "1,3,7"
    notes?: string;

    // Angka
    taxRate?: number;
    discount?: number;

    items?: QuotationItemInput[];
}
