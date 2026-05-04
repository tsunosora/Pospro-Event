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

    // Custom text per quotation — override brand defaults
    customOpeningText?: string | null;   // Override paragraf "Dengan hormat, Bersama surat ini..."
    customDisclaimer?: string | null;    // Override "Catatan Harga"
    customPaymentTerms?: string | null;  // Override "Sistem Pembayaran"
    customClosing?: string | null;       // Override paragraf penutup (legacy, full override)
    // Append/prepend mode — text di atas/bawah brand default (combine dengan separator \n\n)
    disclaimerPrepend?: string | null;
    disclaimerAppend?: string | null;
    paymentTermsPrepend?: string | null;
    paymentTermsAppend?: string | null;
    closingPrepend?: string | null;
    closingAppend?: string | null;
    attachmentCount?: number | null;     // Jumlah lampiran (default 1 di template)
    customAttachmentText?: string | null; // Teks bebas untuk lampiran (override "{N} ({terbilang}) berkas")

    // Angka
    taxRate?: number;
    discount?: number;

    items?: QuotationItemInput[];
}
