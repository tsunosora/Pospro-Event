import api from './client';

export interface Worker {
    id: number;
    name: string;
    position: string | null;
    phone: string | null;
    photoUrl: string | null;
    notes: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    _count?: { withdrawals: number };
}

export interface WorkerFormInput {
    name: string;
    position?: string;
    phone?: string;
    notes?: string;
    isActive?: boolean;
    photo?: File | null;
}

export const getWorkers = async (includeInactive = false) => {
    const suffix = includeInactive ? '?includeInactive=1' : '';
    return (await api.get<Worker[]>(`/workers${suffix}`)).data;
};

export const getWorker = async (id: number) =>
    (await api.get<Worker>(`/workers/${id}`)).data;

const toFormData = (input: WorkerFormInput) => {
    const fd = new FormData();
    fd.append('name', input.name);
    if (input.position !== undefined) fd.append('position', input.position);
    if (input.phone !== undefined) fd.append('phone', input.phone);
    if (input.notes !== undefined) fd.append('notes', input.notes);
    if (input.isActive !== undefined) fd.append('isActive', String(input.isActive));
    if (input.photo) fd.append('photo', input.photo);
    return fd;
};

export const createWorker = async (input: WorkerFormInput) => {
    const fd = toFormData(input);
    return (await api.post<Worker>('/workers', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

export const updateWorker = async (id: number, input: Partial<WorkerFormInput>) => {
    const fd = new FormData();
    if (input.name !== undefined) fd.append('name', input.name);
    if (input.position !== undefined) fd.append('position', input.position);
    if (input.phone !== undefined) fd.append('phone', input.phone);
    if (input.notes !== undefined) fd.append('notes', input.notes);
    if (input.isActive !== undefined) fd.append('isActive', String(input.isActive));
    if (input.photo) fd.append('photo', input.photo);
    return (await api.patch<Worker>(`/workers/${id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

export const deleteWorker = async (id: number) =>
    (await api.delete<{ mode: 'hard-delete' | 'soft-delete'; usage: number }>(`/workers/${id}`)).data;

export const restoreWorker = async (id: number) =>
    (await api.patch<Worker>(`/workers/${id}/restore`, {})).data;
