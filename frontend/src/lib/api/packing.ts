import api from './client';

export type PackingDisposition = 'PINJAM' | 'OPERASIONAL';

export interface PackingItem {
    id: number;
    eventId: number;
    productVariantId: number;
    quantity: string | number;
    storageLocationId: number | null;
    locationNote: string | null;
    isChecked: boolean;
    disposition: PackingDisposition | null;
    orderIndex: number;
    notes: string | null;
    checkedById: number | null;
    checkedAt: string | null;
    createdAt: string;
    updatedAt: string;
    productVariant: {
        id: number; sku: string; variantName: string | null; stock: number; price?: string | number;
        product: { id: number; name: string; categoryId: number | null };
    };
    storageLocation: {
        id: number; code: string; name: string;
        warehouse: { id: number; name: string };
    } | null;
    checkedBy: { id: number; name: string } | null;
}

export interface CreatePackingItemInput {
    productVariantId: number;
    quantity: number;
    storageLocationId?: number | null;
    locationNote?: string | null;
    notes?: string | null;
}

export interface UpdatePackingItemInput extends Partial<CreatePackingItemInput> {
    isChecked?: boolean;
    disposition?: PackingDisposition | null;
}

export interface PackingSummary {
    total: number; checked: number; pending: number;
}

export interface PackingPrefill {
    eventId: number;
    eventCode: string;
    eventName: string;
    suggestedPurpose: string;
    items: Array<{
        productVariantId: number;
        quantity: number;
        sku: string;
        productName: string;
        variantName: string | null;
        stock: number;
        storageLocation: string | null;
        locationNote: string | null;
        packingItemId: number;
    }>;
}

export const getEventPacking = async (eventId: number) =>
    (await api.get<PackingItem[]>(`/events/${eventId}/packing`)).data;

export const getEventPackingSummary = async (eventId: number) =>
    (await api.get<PackingSummary>(`/events/${eventId}/packing/summary`)).data;

export const createPackingItem = async (eventId: number, input: CreatePackingItemInput) =>
    (await api.post<PackingItem>(`/events/${eventId}/packing`, input)).data;

export const bulkCreatePackingItems = async (eventId: number, items: CreatePackingItemInput[]) =>
    (await api.post<PackingItem[]>(`/events/${eventId}/packing/bulk`, { items })).data;

export const updatePackingItem = async (id: number, input: UpdatePackingItemInput & { workerId?: number | null }) =>
    (await api.patch<PackingItem>(`/packing/${id}`, input)).data;

export const setPackingItemChecked = async (
    id: number,
    isChecked: boolean,
    workerId?: number | null,
    disposition?: PackingDisposition | null,
) =>
    (await api.post<PackingItem>(`/packing/${id}/check`, { isChecked, workerId, disposition })).data;

export const bulkSetPackingChecked = async (
    eventId: number,
    ids: number[],
    isChecked: boolean,
    workerId?: number | null,
    disposition?: PackingDisposition | null,
) =>
    (await api.post<PackingItem[]>(`/events/${eventId}/packing/bulk-check`, { ids, isChecked, workerId, disposition })).data;

export const deletePackingItem = async (id: number) =>
    (await api.delete<{ ok: true }>(`/packing/${id}`)).data;

export const prefillWithdrawalFromPacking = async (eventId: number, onlyChecked = true) =>
    (await api.get<PackingPrefill>(`/events/${eventId}/packing/prefill-withdrawal?onlyChecked=${onlyChecked}`)).data;
