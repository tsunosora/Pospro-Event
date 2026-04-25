import api from './client';

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
}

export interface Quotation {
    id: number;
    invoiceNumber: string;
    type: 'QUOTATION';
    quotationVariant: QuotationVariant | null;
    status: InvoiceStatus;
    revisionNumber: number;
    parentQuotationId: number | null;
    customerId: number | null;
    clientName: string;
    clientCompany: string | null;
    clientAddress: string | null;
    clientPhone: string | null;
    clientEmail: string | null;
    projectName: string | null;
    eventLocation: string | null;
    eventDateStart: string | null;
    eventDateEnd: string | null;
    date: string;
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
    parent?: { id: number; invoiceNumber: string; revisionNumber: number } | null;
    children?: Array<{ id: number; invoiceNumber: string; revisionNumber: number }>;
}

export interface CreateQuotationInput {
    quotationVariant: QuotationVariant;
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
    date?: string;
    validUntil?: string;
    dpPercent?: number;
    bankAccountIds?: string;
    notes?: string;
    taxRate?: number;
    discount?: number;
    items?: QuotationItem[];
}

export const getQuotations = async (params: { variant?: QuotationVariant; year?: number; status?: InvoiceStatus } = {}) => {
    const qs = new URLSearchParams();
    if (params.variant) qs.set('variant', params.variant);
    if (params.year) qs.set('year', String(params.year));
    if (params.status) qs.set('status', params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return (await api.get<Quotation[]>(`/quotations${suffix}`)).data;
};

export const getQuotation = async (id: number) =>
    (await api.get<Quotation>(`/quotations/${id}`)).data;

export const createQuotation = async (data: CreateQuotationInput) =>
    (await api.post<Quotation>('/quotations', data)).data;

export const updateQuotation = async (id: number, data: Partial<CreateQuotationInput>) =>
    (await api.patch<Quotation>(`/quotations/${id}`, data)).data;

export const assignQuotationNumber = async (id: number) =>
    (await api.post<Quotation>(`/quotations/${id}/assign-number`, {})).data;

export const reviseQuotation = async (id: number) =>
    (await api.post<Quotation>(`/quotations/${id}/revise`, {})).data;

export const createQuotationFromCustomer = async (customerId: number, variant: QuotationVariant) =>
    (await api.post<Quotation>(`/quotations/from-customer/${customerId}`, { variant })).data;

export const deleteQuotation = async (id: number) =>
    (await api.delete(`/quotations/${id}`)).data;

export const getQuotationExportUrl = (id: number, format: 'pdf' | 'docx') => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return `${base}/quotations/${id}/export/${format}`;
};

// Fetch export as blob (butuh token di header, tidak bisa langsung <a href>)
export const downloadQuotationExport = async (id: number, format: 'pdf' | 'docx'): Promise<Blob> => {
    const res = await api.get(`/quotations/${id}/export/${format}`, { responseType: 'blob' });
    return res.data as Blob;
};
