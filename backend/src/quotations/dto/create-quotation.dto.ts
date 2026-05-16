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

    // Detail event/project — event UTAMA
    projectName?: string;
    eventLocation?: string;
    eventDateStart?: string | Date;   // ISO
    eventDateEnd?: string | Date;
    // Event TAMBAHAN — kalau penawaran cover banyak event dengan tanggal beda
    additionalEvents?: Array<{
        name?: string | null;
        location?: string | null;
        dateStart?: string | Date | null;
        dateEnd?: string | Date | null;
    }> | null;

    // Penawaran terms
    date?: string | Date;
    signCity?: string | null;          // Kota lokasi surat dibuat (header surat: "Semarang, 28 April 2026")
    validUntil?: string | Date;
    /** Tanggal jatuh tempo Invoice (editable, bisa di-extend kalau klien telat bayar). */
    dueDate?: string | Date | null;
    /** Tanggal akhir jatuh tempo — kalau di-set, jadi range "dueDate–dueDateEnd". Null = single date mode. */
    dueDateEnd?: string | Date | null;
    /** Alasan perubahan dueDate — wajib di-isi kalau dueDate berubah (untuk audit log owner). */
    dueDateChangeReason?: string | null;
    dpPercent?: number;
    bankAccountIds?: string;           // CSV: "1,3,7"
    notes?: string;

    // Custom text per quotation — override brand defaults
    customOpeningText?: string | null;   // Override paragraf "Dengan hormat, Bersama surat ini..."
    customDisclaimer?: string | null;    // Override "Catatan Harga"
    customPaymentTerms?: string | null;  // Override "Sistem Pembayaran"
    customClosing?: string | null;       // Override paragraf penutup (legacy, full override)
    // SPK-specific custom text (override saat render SPK saja)
    customOpeningSpk?: string | null;
    customDisclaimerSpk?: string | null;
    customPaymentTermsSpk?: string | null;
    customClosingSpk?: string | null;
    /** Penanggung Jawab SPK — kalau di-set, override clientName di SPK header. */
    spkPicName?: string | null;
    /** Jabatan PIC SPK (mis. CEO, Direktur). */
    spkPicPosition?: string | null;
    /** No. HP PIC SPK — kalau berbeda dengan No. Telp di penawaran. */
    spkPicPhone?: string | null;
    /** Batas Pelunasan SPK — tanggal "selambat-lambatnya" pelunasan dibayar.
     *  Kalau null, render SPK fallback ke validUntil (legacy). */
    spkPaymentDeadline?: string | Date | null;
    // Invoice-specific custom text (override saat render Invoice saja)
    customOpeningInvoice?: string | null;
    customDisclaimerInvoice?: string | null;
    customPaymentTermsInvoice?: string | null;
    customClosingInvoice?: string | null;
    /** Penanggung Jawab khusus Invoice — kalau di-set, override clientName di Invoice. */
    invoicePicName?: string | null;
    invoicePicPosition?: string | null;
    invoicePicPhone?: string | null;
    // Append/prepend mode — text di atas/bawah brand default (combine dengan separator \n\n)
    disclaimerPrepend?: string | null;
    disclaimerAppend?: string | null;
    paymentTermsPrepend?: string | null;
    paymentTermsAppend?: string | null;
    closingPrepend?: string | null;
    closingAppend?: string | null;
    attachmentCount?: number | null;     // Jumlah lampiran (default 1 di template)
    customAttachmentText?: string | null; // Teks bebas untuk lampiran
    language?: 'id' | 'en';                // Bahasa surat (default 'id')
    useUsdCurrency?: boolean;              // Toggle: kalau true, label Rp diganti USD (TANPA konversi).
    /** Custom subject — override "Hal:" auto-derive dari variant. */
    customSubject?: string | null;
    /** Payment schedule multi-step. Total persen harus 100. Null = pakai dpPercent legacy. */
    paymentSchedule?: Array<{ label: string; percent: number }> | null;
    /**
     * Specifications terpisah dari item table — list group dengan judul.
     * `packageGroup` (opsional) untuk link spec ke paket tertentu di mode 'package'.
     * Null/empty = global (tampil di semua paket atau di luar package mode).
     */
    specifications?: Array<{
        title?: string | null;
        items: string[];
        packageGroup?: string | null;
    }> | null;
    /** Harga paket — alternatif diskon dengan label "Harga Paket". */
    packagePrice?: number | string | null;
    /** Tampilkan grand total di footer. Default true. False untuk mode 'package'. */
    showGrandTotal?: boolean;

    // Angka
    taxRate?: number;
    /** PPN dalam Rp — kalau di-set > 0, override calculation dari taxRate. Admin input langsung nominal. */
    taxAmount?: number;
    /** PPh rate (%) — withholding tax, dipotong dari total. Default 0 = tidak pakai PPh. */
    pphRate?: number;
    /** PPh dalam Rp — kalau di-set > 0, override calculation dari pphRate. Admin input langsung nominal. */
    pphAmount?: number;
    discount?: number;

    items?: QuotationItemInput[];
}
