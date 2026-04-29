import api from './client';

export type AcquisitionStatus = 'PENDING' | 'STORED' | 'CANCELLED';

export interface InventoryAcquisition {
    id: number;
    rabPlanId: number;
    rabItemId: number;
    description: string;
    quantity: string;             // Decimal serialized
    unit: string | null;
    unitCost: string;
    totalCost: string;
    status: AcquisitionStatus;
    productVariantId: number | null;
    warehouseId: number | null;
    storedAt: string | null;
    photoUrl: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    rabPlan?: { id: number; code: string; title: string };
    productVariant?: {
        id: number; sku: string; variantName: string | null; stock: number;
        product: { id: number; name: string };
    } | null;
    warehouse?: { id: number; name: string } | null;
}

export interface StoreAcquisitionInput {
    warehouseId: number;
    photoUrl?: string | null;
    notes?: string | null;
    productVariantId?: number;
    newVariant?: {
        productId?: number;
        productName?: string;
        categoryId?: number;
        unitId?: number;
        sku?: string;
        variantName?: string;
    };
}

export const listInventoryAcquisitions = async (params: { rabPlanId?: number; status?: AcquisitionStatus } = {}): Promise<InventoryAcquisition[]> => {
    const qs = new URLSearchParams();
    if (params.rabPlanId) qs.set('rabPlanId', String(params.rabPlanId));
    if (params.status) qs.set('status', params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return (await api.get(`/inventory-acquisitions${suffix}`)).data;
};

export const getInventoryAcquisition = async (id: number): Promise<InventoryAcquisition> =>
    (await api.get(`/inventory-acquisitions/${id}`)).data;

export const storeAcquisition = async (id: number, input: StoreAcquisitionInput): Promise<InventoryAcquisition> =>
    (await api.post(`/inventory-acquisitions/${id}/store`, input)).data;

export const cancelAcquisition = async (id: number, reason?: string): Promise<InventoryAcquisition> =>
    (await api.post(`/inventory-acquisitions/${id}/cancel`, { reason })).data;

export const uploadAcquisitionPhoto = async (id: number, file: File): Promise<InventoryAcquisition> => {
    const fd = new FormData();
    fd.append('image', file);
    return (await api.post(`/inventory-acquisitions/${id}/upload-photo`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

export const removeAcquisitionPhoto = async (id: number): Promise<InventoryAcquisition> =>
    (await api.delete(`/inventory-acquisitions/${id}/photo`)).data;
