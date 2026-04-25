import api from './client';

export interface RabLooseItem {
    id: number;
    description: string;
    normalizedKey: string;
    unit: string | null;
    lastPriceRab: string;
    lastPriceCost: string;
    defaultCategory: string | null;
    notes: string | null;
    usageCount: number;
    lastUsedAt: string | null;
    promotedVariantId: number | null;
    createdAt: string;
    updatedAt: string;
    promotedVariant?: {
        id: number;
        sku: string;
        product: { id: number; name: string };
    } | null;
}

export interface RabLooseItemPayload {
    description: string;
    unit?: string;
    priceRab?: number | string;
    priceCost?: number | string;
    defaultCategory?: string;
    notes?: string;
}

export interface PromotePayload {
    productName: string;
    sku: string;
    categoryId: number;
    unitId: number;
    price?: number | string;
}

export const getRabLooseItems = async (search?: string, limit = 20) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return (await api.get<RabLooseItem[]>(`/rab-loose-items${qs ? `?${qs}` : ''}`)).data;
};

export const getRabLooseItemSuggestions = async (q: string) =>
    (await api.get<RabLooseItem[]>(`/rab-loose-items/suggestions`, { params: { q } })).data;

export const upsertRabLooseItem = async (data: RabLooseItemPayload) =>
    (await api.post<RabLooseItem>('/rab-loose-items', data)).data;

export const promoteRabLooseItem = async (id: number, data: PromotePayload) =>
    (await api.post<{ productId: number; variantId: number; looseItem: RabLooseItem }>(
        `/rab-loose-items/${id}/promote`,
        data,
    )).data;

export const deleteRabLooseItem = async (id: number) =>
    (await api.delete<{ ok: boolean }>(`/rab-loose-items/${id}`)).data;
