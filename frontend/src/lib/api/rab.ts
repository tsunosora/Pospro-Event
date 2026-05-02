import api from './client';
import type { Brand } from './brands';

export interface RabItemCategoryRef {
    id: number;
    name: string;
    orderIndex: number;
    isActive: boolean;
    key: string | null;
}

export interface RabItem {
    id?: number;
    categoryId: number;
    category?: RabItemCategoryRef; // populated by backend include
    description: string;
    unit?: string | null;
    quantity: number | string;
    quantityCost?: number | string;
    priceRab: number | string;
    priceCost: number | string;
    orderIndex?: number;
    productVariantId?: number | null;
    notes?: string | null;
    saveAsLoose?: boolean;
    isInventory?: boolean;
}

export interface RabPlan {
    id: number;
    code: string;
    title: string;
    projectName: string | null;
    location: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    customerId: number | null;
    brand: Brand | null;
    dpAmount: string;
    pelunasan: string;
    incomeOther: string;
    notes: string | null;
    imageUrl: string | null;
    tags: string | null; // JSON-serialized string[]
    reportCompletedAt: string | null;  // Admin tandai laporan lengkap
    reportCompletedBy: number | null;  // user ID yang menandai
    createdAt: string;
    updatedAt: string;
    items: RabItem[];
    customer?: { id: number; name: string; companyName: string | null } | null;
    // Aggregate fields — populated oleh GET /rab (list view), undefined di GET /rab/:id (detail)
    totalRab?: number;
    totalCost?: number;
    itemCount?: number;
    missingCostItemCount?: number;
}

export function parseRabTags(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [];
    } catch {
        return [];
    }
}

export interface RabSummary {
    id: number;
    code: string;
    title: string;
    categories: Array<{
        categoryId: number;
        categoryName: string;
        categoryKey: string | null;
        isActive: boolean;
        subtotalRab: number;
        subtotalCost: number;
        selisih: number;
        count: number;
    }>;
    totals: {
        totalRab: number;
        totalCost: number;
        totalSelisih: number;
        costInventory: number;
        costOperational: number;
        operationalProfit: number;
        inventoryCount: number;
    };
    income: { dpAmount: number; pelunasan: number; incomeOther: number; totalIncome: number };
    saldo: number;
}

export interface CreateRabInput {
    title: string;
    projectName?: string;
    location?: string;
    periodStart?: string;
    periodEnd?: string;
    customerId?: number | null;
    brand?: Brand | null;
    dpAmount?: number;
    pelunasan?: number;
    incomeOther?: number;
    notes?: string;
    tags?: string[];
    items?: RabItem[];
}

export interface RabTagSuggestion {
    tag: string;
    count: number;
}

export const getRabTags = async () =>
    (await api.get<RabTagSuggestion[]>('/rab/tags')).data;

/** Hapus tag dari semua RAB (cleanup) — return jumlah RAB yang ter-update */
export const deleteRabTag = async (tag: string) =>
    (await api.delete<{ tag: string; updatedCount: number }>(
        `/rab/tags/${encodeURIComponent(tag)}`,
    )).data;

export const getRabList = async () => (await api.get<RabPlan[]>('/rab')).data;

export const getRab = async (id: number) => (await api.get<RabPlan>(`/rab/${id}`)).data;

export const getRabSummary = async (id: number) =>
    (await api.get<RabSummary>(`/rab/${id}/summary`)).data;

export const createRab = async (data: CreateRabInput) =>
    (await api.post<RabPlan>('/rab', data)).data;

export const updateRab = async (id: number, data: Partial<CreateRabInput>) =>
    (await api.patch<RabPlan>(`/rab/${id}`, data)).data;

/** Toggle status laporan RAB — admin tandai sudah lengkap atau batalkan */
export const markRabReportStatus = async (id: number, complete: boolean) =>
    (await api.patch<{
        id: number;
        code: string;
        title: string;
        reportCompletedAt: string | null;
        reportCompletedBy: number | null;
    }>(`/rab/${id}/report-status`, { complete })).data;

/** Backfill cashflow untuk SEMUA RAB existing — one-time migration helper */
export const syncAllRabCashflow = async () =>
    (await api.post<{
        total: number;
        synced: number;
        skipped: number;
        failed: number;
        errors: Array<{ rabId: number; code: string; error: string }>;
    }>(`/rab/sync-all-cashflow`)).data;

export const generateCashflowFromRab = async (
    id: number,
    body: { mode?: 'detail' | 'category'; eventId?: number | null; skipExisting?: boolean } = {},
) =>
    (await api.post<{
        ok: true;
        mode: 'detail' | 'category';
        rabCode: string;
        eventId: number | null;
        created: number;
        totalAmount: number;
    }>(`/rab/${id}/generate-cashflow`, body)).data;

export const duplicateRab = async (
    id: number,
    overrides: { title?: string; location?: string; periodStart?: string; periodEnd?: string } = {},
) => (await api.post<RabPlan>(`/rab/${id}/duplicate`, overrides)).data;

export const generateQuotationFromRab = async (
    rabId: number,
    body: {
        quotationVariant: 'SEWA' | 'PENGADAAN_BOOTH';
        clientName?: string;
        clientCompany?: string;
        clientAddress?: string;
        clientPhone?: string;
        clientEmail?: string;
        dpPercent?: number;
    },
) => (await api.post(`/rab/${rabId}/generate-quotation`, body)).data;

export const deleteRab = async (id: number) => (await api.delete(`/rab/${id}`)).data;

export const uploadRabImage = async (id: number, file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return (await api.post<{ id: number; code: string; imageUrl: string | null }>(
        `/rab/${id}/upload-image`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
    )).data;
};

export const removeRabImage = async (id: number) =>
    (await api.delete<{ id: number; code: string; imageUrl: string | null }>(`/rab/${id}/image`)).data;

export const downloadRabXlsx = async (id: number): Promise<Blob> => {
    const res = await api.get(`/rab/${id}/export/xlsx`, { responseType: 'blob' });
    return res.data as Blob;
};

// ── Product picker (variants with booth filter) ─────────────────────────────

export type BoothVariant = {
    id: number;
    variantName: string;
    sku: string | null;
    size: string | null;
    price: string | number;
    hpp: string | number;
    boothProductType: 'SEWA' | 'PENGADAAN' | null;
    defaultRentalUnit: string | null;
    product: {
        id: number;
        name: string;
        description: string | null;
        unit: { name: string } | null;
    };
};

export const getBoothVariants = async (type?: 'SEWA' | 'PENGADAAN') => {
    const suffix = type ? `?type=${type}` : '';
    return (await api.get<BoothVariant[]>(`/products/variants/booth${suffix}`)).data;
};

export interface SaveAsProductInput {
    name: string;
    categoryId: number;
    unitId: number;
    boothProductType: 'SEWA' | 'PENGADAAN';
    defaultRentalUnit?: string;
    sku?: string;
    description?: string;
    priceOverride?: number;
    hppOverride?: number;
    image?: File | null;
}

export const saveRabAsProduct = async (rabId: number, input: SaveAsProductInput) => {
    const fd = new FormData();
    fd.append('name', input.name);
    fd.append('categoryId', String(input.categoryId));
    fd.append('unitId', String(input.unitId));
    fd.append('boothProductType', input.boothProductType);
    if (input.defaultRentalUnit) fd.append('defaultRentalUnit', input.defaultRentalUnit);
    if (input.sku) fd.append('sku', input.sku);
    if (input.description) fd.append('description', input.description);
    if (input.priceOverride !== undefined) fd.append('priceOverride', String(input.priceOverride));
    if (input.hppOverride !== undefined) fd.append('hppOverride', String(input.hppOverride));
    if (input.image) fd.append('image', input.image);
    const res = await api.post(`/rab/${rabId}/save-as-product`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data as { product: { id: number; name: string; imageUrl: string | null }; variant: { id: number; sku: string; price: string; hpp: string } };
};
