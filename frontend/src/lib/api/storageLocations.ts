import api from './client';

export interface StorageLocation {
    id: number;
    warehouseId: number;
    code: string;
    name: string;
    notes: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    warehouse?: { id: number; name: string };
}

export interface StorageLocationInput {
    warehouseId: number;
    code: string;
    name: string;
    notes?: string | null;
    isActive?: boolean;
}

export const getStorageLocations = async (warehouseId?: number, includeInactive = false) => {
    const params = new URLSearchParams();
    if (warehouseId) params.set('warehouseId', String(warehouseId));
    if (includeInactive) params.set('includeInactive', '1');
    const q = params.toString() ? `?${params}` : '';
    return (await api.get<StorageLocation[]>(`/storage-locations${q}`)).data;
};

export const createStorageLocation = async (input: StorageLocationInput) =>
    (await api.post<StorageLocation>('/storage-locations', input)).data;

export const updateStorageLocation = async (id: number, input: Partial<StorageLocationInput>) =>
    (await api.patch<StorageLocation>(`/storage-locations/${id}`, input)).data;

export const deleteStorageLocation = async (id: number) =>
    (await api.delete<{ ok: true; softDeleted: boolean }>(`/storage-locations/${id}`)).data;
