import api from './client';

export interface Warehouse {
    id: number;
    name: string;
    address: string | null;
    notes: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    _count?: { withdrawals: number };
}

export interface CreateWarehouseInput {
    name: string;
    address?: string;
    notes?: string;
    isActive?: boolean;
}

export interface UpdateWarehouseInput {
    name?: string;
    address?: string;
    notes?: string;
    isActive?: boolean;
}

export const getWarehouses = async (includeInactive = false) => {
    const suffix = includeInactive ? '?includeInactive=1' : '';
    return (await api.get<Warehouse[]>(`/warehouses${suffix}`)).data;
};

export const getWarehouse = async (id: number) =>
    (await api.get<Warehouse>(`/warehouses/${id}`)).data;

export const createWarehouse = async (input: CreateWarehouseInput) =>
    (await api.post<Warehouse>('/warehouses', input)).data;

export const updateWarehouse = async (id: number, input: UpdateWarehouseInput) =>
    (await api.patch<Warehouse>(`/warehouses/${id}`, input)).data;

export const deleteWarehouse = async (id: number) =>
    (await api.delete<{ mode: 'hard-delete' | 'soft-delete'; usage: number }>(`/warehouses/${id}`)).data;

export const restoreWarehouse = async (id: number) =>
    (await api.patch<Warehouse>(`/warehouses/${id}/restore`, {})).data;
