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
