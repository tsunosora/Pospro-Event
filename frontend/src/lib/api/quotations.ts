import api from './client';
import type { Brand } from './brands';

export type QuotationVariant = 'SEWA' | 'PENGADAAN_BOOTH';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface QuotationItem {
    id?: number;
    description: string;
    unit?: string | null;
    quantity: number | string;
    price: number | string;
    orderIndex?: number;
    productVariantId?: number | null;
    categoryName?: string | null;
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
    discount: string;
    subtotal: string;
    taxAmount: string;
    total: string;
    items: QuotationItem[];
    rabPlanId?: number | null;
    signedByWorkerId: number | null;
    signedByWorker?: { id: number; name: string; position: string | null; signatureImageUrl: string | null } | null;
    invoicePart?: string | null;            // "DP" | "PELUNASAN" | "FULL" (untuk type=INVOICE)
    amountToPay?: string | null;            // Decimal serialized
    itemDisplayMode?: 'detailed' | 'category-summary' | null; // tampilan item di PDF/DOCX
    language?: 'id' | 'en';                                   // bahasa surat
    useUsdCurrency?: boolean;                                 // Toggle USD label (no conversion)
    customOpeningText?: string | null;
    customDisclaimer?: string | null;
    customPaymentTerms?: string | null;
    customClosing?: string | null;
    // SPK-specific
    customOpeningSpk?: string | null;
    customDisclaimerSpk?: string | null;
    customPaymentTermsSpk?: string | null;
    customClosingSpk?: string | null;
    // Invoice-specific
    customOpeningInvoice?: string | null;
    customDisclaimerInvoice?: string | null;
    customPaymentTermsInvoice?: string | null;
    customClosingInvoice?: string | null;
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
    dpPercent?: number;
    bankAccountIds?: string;
    notes?: string;
    taxRate?: number;
    discount?: number;
    items?: QuotationItem[];
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

export const generateInvoiceFromQuotation = async (
    quotationId: number,
    input: { part: 'DP' | 'PELUNASAN' | 'FULL'; customAmount?: number; dueDate?: string },
): Promise<Quotation> =>
    (await api.post(`/quotations/${quotationId}/generate-invoice`, input)).data;

export const listInvoicesByQuotation = async (quotationId: number): Promise<Quotation[]> =>
    (await api.get(`/quotations/${quotationId}/invoices`)).data;

export const createQuotationFromCustomer = async (customerId: number, variant: QuotationVariant) =>
    (await api.post<Quotation>(`/quotations/from-customer/${customerId}`, { variant })).data;

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
