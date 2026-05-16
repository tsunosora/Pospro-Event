import api from './client';
import type { Brand } from './brands';

export type QuotationVariant = 'SEWA' | 'PENGADAAN_BOOTH';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type PaymentMethodType = 'CASH' | 'QRIS' | 'BANK_TRANSFER' | 'OTHER';

export interface MarkPaidPayload {
    amount: number | string;
    paidAt?: string;
    paymentMethod?: PaymentMethodType;
    paymentRef?: string | null;
    paymentNote?: string | null;
    paymentProofUrl?: string | null;
    createCashflow?: boolean;
    cashflowBankAccountId?: number | null;
}

export interface PaymentSummary {
    quotationTotal: number;
    totalInvoiced: number;
    totalPaid: number;
    sisaTagihan: number;
    invoices: Array<{
        id: number;
        invoiceNumber: string;
        invoicePart: string | null;
        status: InvoiceStatus;
        amountToPay: number;
        paidAmount: number;
        paidAt: string | null;
        paymentMethod: PaymentMethodType | null;
        paymentRef: string | null;
        date: string;
    }>;
}

export interface QuotationItem {
    id?: number;
    description: string;
    unit?: string | null;
    quantity: number | string;
    /** Multiplier tambahan untuk multi-faktor sewa (mis. hari). Subtotal = qty × unitMultiplier × price. Default 1. */
    unitMultiplier?: number | string | null;
    price: number | string;
    orderIndex?: number;
    productVariantId?: number | null;
    categoryName?: string | null;
    /** Multi-event grouping: 0=event utama, 1+ = additionalEvents[i-1]. null = shared/global. */
    eventIndex?: number | null;
    /** Package grouping (mode 'package'): nama paket. null = mode normal. */
    packageGroup?: string | null;
}

export interface Quotation {
    id: number;
    invoiceNumber: string;
    type: 'QUOTATION' | 'INVOICE';
    parentQuotationId: number | null;
    quotationVariant: QuotationVariant | null;
    variantCode: string | null;       // kode dari QuotationVariantConfig (CRUD)
    brand: Brand | null;
    status: InvoiceStatus;
    revisionNumber: number;
    customerId: number | null;
    customer?: {
        id: number;
        name: string;
        companyName: string | null;
        companyPIC: string | null;
        phone: string | null;
        email: string | null;
        address: string | null;
    } | null;
    clientName: string;
    clientCompany: string | null;
    clientAddress: string | null;
    clientPhone: string | null;
    clientEmail: string | null;
    projectName: string | null;
    eventLocation: string | null;
    eventDateStart: string | null;
    eventDateEnd: string | null;
    additionalEvents: Array<{
        name: string | null;
        location: string | null;
        dateStart: string | null;
        dateEnd: string | null;
    }> | null;
    date: string;
    signCity: string | null;
    validUntil: string | null;
    dpPercent: string;
    bankAccountIds: string | null;
    notes: string | null;
    taxRate: string;
    pphRate?: string;            // % PPh (withholding tax) — string Decimal
    discount: string;
    subtotal: string;
    taxAmount: string;
    pphAmount?: string;          // Rp PPh
    total: string;
    items: QuotationItem[];
    rabPlanId?: number | null;
    signedByWorkerId: number | null;
    signedByWorker?: { id: number; name: string; position: string | null; signatureImageUrl: string | null } | null;
    invoicePart?: string | null;            // "DP" | "PELUNASAN" | "FULL" (untuk type=INVOICE)
    amountToPay?: string | null;            // Decimal serialized
    dueDate?: string | null;                // Jatuh tempo (single date atau range start)
    dueDateEnd?: string | null;             // Jatuh tempo end (kalau range)
    paidAmount?: string | null;             // Decimal — akumulasi yang sudah dibayar
    paidAt?: string | null;
    paymentMethod?: PaymentMethodType | null;
    paymentRef?: string | null;
    paymentNote?: string | null;
    paymentProofUrl?: string | null;
    itemDisplayMode?: 'detailed' | 'category-summary' | null; // tampilan item di PDF/DOCX
    language?: 'id' | 'en';                                   // bahasa surat
    useUsdCurrency?: boolean;                                 // Toggle USD label (no conversion)
    customSubject?: string | null;                            // Override "Hal:" auto-derive
    paymentSchedule?: Array<{ label: string; percent: number }> | null;
    specifications?: Array<{ title?: string | null; items: string[] }> | null;
    packagePrice?: number | string | null;
    showGrandTotal?: boolean;
    customOpeningText?: string | null;
    customDisclaimer?: string | null;
    customPaymentTerms?: string | null;
    customClosing?: string | null;
    // SPK-specific
    customOpeningSpk?: string | null;
    customDisclaimerSpk?: string | null;
    customPaymentTermsSpk?: string | null;
    customClosingSpk?: string | null;
    spkPicName?: string | null;
    spkPicPosition?: string | null;
    spkPicPhone?: string | null;
    spkPaymentDeadline?: string | null;
    // Invoice-specific
    customOpeningInvoice?: string | null;
    customDisclaimerInvoice?: string | null;
    customPaymentTermsInvoice?: string | null;
    customClosingInvoice?: string | null;
    invoicePicName?: string | null;
    invoicePicPosition?: string | null;
    invoicePicPhone?: string | null;
    disclaimerPrepend?: string | null;
    disclaimerAppend?: string | null;
    paymentTermsPrepend?: string | null;
    paymentTermsAppend?: string | null;
    closingPrepend?: string | null;
    closingAppend?: string | null;
    attachmentCount?: number | null;
    customAttachmentText?: string | null;
    parent?: { id: number; invoiceNumber: string; revisionNumber: number } | null;
    children?: Array<{ id: number; invoiceNumber: string; revisionNumber: number }>;
}

export interface CreateQuotationInput {
    quotationVariant?: QuotationVariant;
    variantCode?: string | null;
    brand?: Brand | null;
    signedByWorkerId?: number | null;
    itemDisplayMode?: 'detailed' | 'category-summary' | null;
    customerId?: number | null;
    clientName: string;
    clientCompany?: string;
    clientAddress?: string;
    clientPhone?: string;
    clientEmail?: string;
    projectName?: string;
    eventLocation?: string;
    eventDateStart?: string;
    eventDateEnd?: string;
    additionalEvents?: Array<{
        name?: string | null;
        location?: string | null;
        dateStart?: string | null;
        dateEnd?: string | null;
    }> | null;
    date?: string;
    signCity?: string | null;
    validUntil?: string;
    dueDate?: string | null;
    dueDateEnd?: string | null;
    dpPercent?: number;
    bankAccountIds?: string;
    notes?: string;
    taxRate?: number;
    /** PPh rate (%) — withholding tax, dipotong dari total. Default 0 = tidak pakai PPh. */
    pphRate?: number;
    discount?: number;
    items?: QuotationItem[];
    // Field baru — multi-event/package support
    customSubject?: string | null;
    paymentSchedule?: Array<{ label: string; percent: number }> | null;
    specifications?: Array<{ title?: string | null; items: string[] }> | null;
    packagePrice?: number | string | null;
    showGrandTotal?: boolean;
}

export const getQuotations = async (params: { variant?: QuotationVariant; variantCode?: string; year?: number; status?: InvoiceStatus; type?: 'QUOTATION' | 'INVOICE' | 'ALL' } = {}) => {
    const qs = new URLSearchParams();
    if (params.variant) qs.set('variant', params.variant);
    if (params.variantCode) qs.set('variantCode', params.variantCode);
    if (params.year) qs.set('year', String(params.year));
    if (params.status) qs.set('status', params.status);
    if (params.type) qs.set('type', params.type);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return (await api.get<Quotation[]>(`/quotations${suffix}`)).data;
};

export const getQuotation = async (id: number) =>
    (await api.get<Quotation>(`/quotations/${id}`)).data;

export const createQuotation = async (data: CreateQuotationInput) =>
    (await api.post<Quotation>('/quotations', data)).data;

export const updateQuotation = async (id: number, data: Partial<CreateQuotationInput>) =>
    (await api.patch<Quotation>(`/quotations/${id}`, data)).data;

export const assignQuotationNumber = async (
    id: number,
    options: { mode?: 'auto' | 'manual'; customNumber?: string } = {},
) =>
    (await api.post<Quotation>(`/quotations/${id}/assign-number`, options)).data;

export const reviseQuotation = async (id: number) =>
    (await api.post<Quotation>(`/quotations/${id}/revise`, {})).data;

/** Edit nomor penawaran yang sudah di-assign — koreksi typo / ganti format. */
export const editQuotationNumber = async (id: number, invoiceNumber: string) =>
    (await api.patch<Quotation>(`/quotations/${id}/edit-number`, { invoiceNumber })).data;

// ─── Payment Status APIs ────────────────────────────────────────────
/** Mark Invoice as SENT. */
export const markInvoiceSent = async (id: number) =>
    (await api.patch<Quotation>(`/quotations/${id}/mark-sent`, {})).data;

/** Mark Invoice as PAID atau PARTIALLY_PAID. Auto-create Cashflow IN entry. */
export const markInvoicePaid = async (id: number, payload: MarkPaidPayload) =>
    (await api.patch<Quotation>(`/quotations/${id}/mark-paid`, payload)).data;

/** Upload bukti pembayaran (gambar/PDF). Return URL untuk disimpan di payload Mark Paid. */
export const uploadPaymentProof = async (invoiceId: number, file: File): Promise<{ url: string }> => {
    const fd = new FormData();
    fd.append('file', file);
    return (await api.post(`/quotations/${invoiceId}/upload-payment-proof`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

/** Cancel Invoice. Tidak boleh kalau sudah PAID. */
export const cancelInvoice = async (id: number, reason?: string | null) =>
    (await api.patch<Quotation>(`/quotations/${id}/cancel`, { reason })).data;

/** Get aggregate payment summary untuk Quotation (total, paid, sisa, list invoices). */
export const getPaymentSummary = async (quotationId: number) =>
    (await api.get<PaymentSummary>(`/quotations/${quotationId}/payment-summary`)).data;

export interface PaymentInstallment {
    id: number;
    installmentNumber: number;
    amount: number;
    paidAt: string;
    paymentMethod: PaymentMethodType | null;
    paymentRef: string | null;
    paymentNote: string | null;
    paymentProofUrl: string | null;
    bankAccount: {
        id: number;
        bankName: string;
        accountNumber: string;
        accountOwner: string;
    } | null;
    cashflowId: number | null;
    createdAt: string;
    isLegacy?: boolean;
}

export interface PaymentDetail {
    invoiceId: number;
    invoiceNumber: string;
    status: InvoiceStatus;
    amountToPay: number;
    paidAmount: number;
    paidAt: string | null;
    paymentMethod: PaymentMethodType | null;
    paymentRef: string | null;
    paymentNote: string | null;
    paymentProofUrl: string | null;
    installments: PaymentInstallment[];
    installmentCount: number;
}

/** Get detail pembayaran Invoice (include bank account info kalau transfer). */
export const getPaymentDetail = async (invoiceId: number): Promise<PaymentDetail> =>
    (await api.get<PaymentDetail>(`/quotations/${invoiceId}/payment-detail`)).data;

export interface DueDateHistoryEntry {
    id: number;
    oldDueDate: string | null;
    oldDueDateEnd: string | null;
    newDueDate: string | null;
    newDueDateEnd: string | null;
    reason: string | null;
    changedById: number | null;
    changedAt: string;
}

/** Get history perubahan dueDate invoice (audit log untuk owner). */
export const getDueDateHistory = async (invoiceId: number): Promise<DueDateHistoryEntry[]> =>
    (await api.get<DueDateHistoryEntry[]>(`/quotations/${invoiceId}/duedate-history`)).data;

// ─── Receivables Dashboard ───────────────────────────────────
export interface ReceivablesDashboard {
    kpi: {
        totalOutstanding: number;
        totalIncomeMonth: number;
        totalIncomeYTD: number;
        customersWithDebt: number;
        overdueCount: number;
        overdueAmount: number;
        totalInvoices: number;
        /** Total PPh dipotong klien (untuk laporan pajak). */
        totalPphPotongan?: number;
        /** Total gross (sebelum potong PPh) — net = gross - pph. */
        totalGrossBeforePph?: number;
    };
    byCustomer: Array<{
        customerId: number | null;
        customerName: string;
        companyName: string | null;
        phone: string | null;
        totalInvoiced: number;
        totalPaid: number;
        sisaTagihan: number;
        invoiceCount: number;
        unpaidCount: number;
        partialCount: number;
        overdueCount: number;
        oldestUnpaidDays: number;
        invoiceIds: number[];
    }>;
    overdueInvoices: Array<{
        id: number;
        invoiceNumber: string;
        customerId: number | null;
        customerName: string;
        companyName: string | null;
        phone: string | null;
        amountToPay: number;
        paidAmount: number;
        sisa: number;
        date: string;
        dueDate: string | null;
        dueDateEnd: string | null;
        daysOverdue: number;
        status: string;
    }>;
    incomeMonthly: Array<{ month: string; label: string; amount: number }>;
    /** Grouping invoice per Penawaran induk — supaya admin gampang lihat "1 event = brp invoice". */
    byQuotation?: Array<{
        quotationId: number;
        quotationNumber: string;
        projectName: string | null;
        eventLocation: string | null;
        eventDateStart: string | null;
        eventDateEnd: string | null;
        quotationTotal: number;
        customerId: number | null;
        customerName: string;
        companyName: string | null;
        totalInvoiced: number;
        totalPaid: number;
        sisaTagihan: number;
        invoiceCount: number;
        invoices: Array<{
            id: number;
            invoiceNumber: string;
            invoicePart: string | null;
            amountToPay: number;
            paidAmount: number;
            sisa: number;
            status: string;
            date: string;
            dueDate: string | null;
            dueDateEnd: string | null;
            isOverdue: boolean;
            daysOverdue: number;
        }>;
    }>;
    filter?: { from: string | null; to: string | null } | null;
}

export const getReceivablesDashboard = async (filter?: { from?: string; to?: string }): Promise<ReceivablesDashboard> => {
    const params = new URLSearchParams();
    if (filter?.from) params.set('from', filter.from);
    if (filter?.to) params.set('to', filter.to);
    const qs = params.toString();
    return (await api.get<ReceivablesDashboard>(`/quotations/receivables/dashboard${qs ? `?${qs}` : ''}`)).data;
};

/**
 * Edge case: Klien transfer langsung lunas padahal sudah ada Invoice DP.
 * Admin pilih mode handling.
 */
export const markFullyPaidEdgeCase = async (
    quotationId: number,
    payload: {
        sourceInvoiceId: number;
        mode: 'auto_create_pelunasan' | 'convert_to_full' | 'cancel_and_new_full';
    } & MarkPaidPayload,
) => (await api.post(`/quotations/${quotationId}/mark-fully-paid`, payload)).data;

export const generateInvoiceFromQuotation = async (
    quotationId: number,
    input: { part: 'DP' | 'PELUNASAN' | 'FULL'; customAmount?: number; dueDate?: string },
): Promise<Quotation> =>
    (await api.post(`/quotations/${quotationId}/generate-invoice`, input)).data;

export const listInvoicesByQuotation = async (quotationId: number): Promise<Quotation[]> =>
    (await api.get(`/quotations/${quotationId}/invoices`)).data;

export const createQuotationFromCustomer = async (customerId: number, variant: QuotationVariant) =>
    (await api.post<Quotation>(`/quotations/from-customer/${customerId}`, { variant })).data;

/** Create Penawaran langsung dari Lead — auto-pull customer + event utama + multi-event. */
export const createQuotationFromLead = async (leadId: number, variant: QuotationVariant) =>
    (await api.post<Quotation>(`/quotations/from-lead/${leadId}`, { variant })).data;

export const deleteQuotation = async (id: number) =>
    (await api.delete(`/quotations/${id}`)).data;

/** One-time backfill — fix semua quotation lama yang sudah punya nomor resmi tapi status masih DRAFT */
export const backfillQuotationStatus = async (): Promise<{ updated: number }> =>
    (await api.post(`/quotations/backfill-status`)).data;

export const getQuotationExportUrl = (id: number, format: 'pdf' | 'docx') => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return `${base}/quotations/${id}/export/${format}`;
};

// Parse filename dari Content-Disposition header.
// Server kirim: `inline; filename="5260-Xp.Pnwr-V-26.pdf"` atau `attachment; filename="..."`
function parseFilenameFromDisposition(disposition: string | undefined | null): string | null {
    if (!disposition) return null;
    // Match filename* (RFC 5987 encoded) duluan
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;\n]+)/i);
    if (utf8Match) {
        try { return decodeURIComponent(utf8Match[1].trim()); } catch { /* fallthrough */ }
    }
    // Match filename="..." atau filename=...
    const m = disposition.match(/filename\s*=\s*"?([^";\n]+)"?/i);
    return m ? m[1].trim() : null;
}

// Fetch export as blob + filename dari Content-Disposition (butuh token di header).
export const downloadQuotationExport = async (
    id: number,
    format: 'pdf' | 'docx' | 'spk-pdf',
): Promise<{ blob: Blob; filename: string }> => {
    const res = await api.get(`/quotations/${id}/export/${format}`, { responseType: 'blob' });
    const disposition =
        res.headers['content-disposition'] ?? res.headers['Content-Disposition'];
    const filename =
        parseFilenameFromDisposition(disposition as string | undefined) ??
        `penawaran-${id}.${format === 'spk-pdf' ? 'pdf' : format}`;
    return { blob: res.data as Blob, filename };
};
