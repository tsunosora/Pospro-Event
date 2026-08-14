import api from './client';

export interface WageRate {
    id: number;
    city: string;
    division: string;
    dailyWageRate: string;
    overtimeRatePerHour: string;
    notes: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface WageRateInput {
    city: string;
    division: string;
    dailyWageRate: number | string;
    overtimeRatePerHour: number | string;
    notes?: string | null;
    isActive?: boolean;
}

export const listWageRates = async (includeInactive = true) =>
    (await api.get<WageRate[]>(`/wage-rates${includeInactive === false ? '?includeInactive=false' : ''}`)).data;

export const listWageRateDistinct = async () =>
    (await api.get<{ cities: string[]; divisions: string[] }>(`/wage-rates/distinct`)).data;

export const getWageRate = async (id: number) =>
    (await api.get<WageRate>(`/wage-rates/${id}`)).data;

export const createWageRate = async (input: WageRateInput) =>
    (await api.post<WageRate>(`/wage-rates`, input)).data;

export const updateWageRate = async (id: number, input: Partial<WageRateInput>) =>
    (await api.patch<WageRate>(`/wage-rates/${id}`, input)).data;

export const deleteWageRate = async (id: number) =>
    (await api.delete(`/wage-rates/${id}`)).data;

// ─── Preset Gaji Custom (+/-) ──────────────────────────────────────────
export interface CustomWagePreset {
    id: number;
    label: string;
    amount: string;          // bisa negatif (− = potong)
    notes: string | null;
    isActive: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface CustomWagePresetInput {
    label: string;
    amount: number | string; // simpan bertanda: + tambah, − kurang
    notes?: string | null;
    isActive?: boolean;
    sortOrder?: number;
}

export const listCustomWagePresets = async (includeInactive = true) =>
    (await api.get<CustomWagePreset[]>(`/custom-wage-presets${includeInactive === false ? '?includeInactive=false' : ''}`)).data;

export const createCustomWagePreset = async (input: CustomWagePresetInput) =>
    (await api.post<CustomWagePreset>(`/custom-wage-presets`, input)).data;

export const updateCustomWagePreset = async (id: number, input: Partial<CustomWagePresetInput>) =>
    (await api.patch<CustomWagePreset>(`/custom-wage-presets/${id}`, input)).data;

export const deleteCustomWagePreset = async (id: number) =>
    (await api.delete(`/custom-wage-presets/${id}`)).data;
