import api from './client';

export interface RabCategory {
    id: number;
    name: string;
    orderIndex: number;
    isActive: boolean;
    key: string | null;
    createdAt: string;
    updatedAt: string;
    _count?: { items: number };
}

export interface CreateRabCategoryInput {
    name: string;
    orderIndex?: number;
    isActive?: boolean;
}

export interface UpdateRabCategoryInput {
    name?: string;
    orderIndex?: number;
    isActive?: boolean;
}

export const getRabCategories = async (includeInactive = false) => {
    const suffix = includeInactive ? '?includeInactive=1' : '';
    return (await api.get<RabCategory[]>(`/rab-categories${suffix}`)).data;
};

export const createRabCategory = async (input: CreateRabCategoryInput) =>
    (await api.post<RabCategory>('/rab-categories', input)).data;

export const updateRabCategory = async (id: number, input: UpdateRabCategoryInput) =>
    (await api.patch<RabCategory>(`/rab-categories/${id}`, input)).data;

export const deleteRabCategory = async (id: number) =>
    (await api.delete<{ mode: 'hard-delete' | 'soft-delete'; usage: number }>(`/rab-categories/${id}`)).data;

export const restoreRabCategory = async (id: number) =>
    (await api.patch<RabCategory>(`/rab-categories/${id}/restore`, {})).data;

export const reorderRabCategories = async (orderedIds: number[]) =>
    (await api.patch<RabCategory[]>(`/rab-categories/reorder`, { orderedIds })).data;
