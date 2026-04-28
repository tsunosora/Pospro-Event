import api from './client';

/**
 * Daftar posisi/role karyawan yang dipakai sistem.
 * Disimpan sebagai string di Worker.position — value persis seperti label di sini
 * supaya filter & dashboard konsisten.
 */
export const WORKER_POSITIONS = [
    { value: 'MARKETING', label: 'Marketing', color: 'blue', emoji: '📣' },
    { value: 'SALES', label: 'Sales', color: 'emerald', emoji: '💼' },
    { value: 'ADMIN', label: 'Admin / Administrasi', color: 'violet', emoji: '🗂️' },
    { value: 'PRODUKSI', label: 'Produksi', color: 'amber', emoji: '🔨' },
    { value: 'KEPALA_TIM', label: 'Kepala Tim', color: 'red', emoji: '👷' },
    { value: 'TUKANG', label: 'Tukang / Crew', color: 'slate', emoji: '🪚' },
    { value: 'DESAINER', label: 'Desainer', color: 'pink', emoji: '🎨' },
    { value: 'OPERATOR', label: 'Operator', color: 'cyan', emoji: '⚙️' },
] as const;

export type WorkerPositionValue = typeof WORKER_POSITIONS[number]['value'];

/** Posisi yang menangani lead di CRM (untuk dropdown assign + dashboard). */
export const MARKETER_POSITIONS: WorkerPositionValue[] = ['MARKETING', 'SALES'];

export function getPositionMeta(position: string | null | undefined) {
    if (!position) return null;
    return WORKER_POSITIONS.find((p) => p.value === position) ?? null;
}

export function isMarketerPosition(position: string | null | undefined): boolean {
    return !!position && MARKETER_POSITIONS.includes(position as WorkerPositionValue);
}

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

export const getWorkers = async (
    includeInactive = false,
    options: { position?: string; positions?: string[] } = {},
) => {
    const params = new URLSearchParams();
    if (includeInactive) params.set('includeInactive', '1');
    if (options.position) params.set('position', options.position);
    if (options.positions && options.positions.length > 0) {
        params.set('positions', options.positions.join(','));
    }
    const qs = params.toString();
    return (await api.get<Worker[]>(`/workers${qs ? `?${qs}` : ''}`)).data;
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
