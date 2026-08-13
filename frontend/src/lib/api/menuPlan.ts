import api from './client';
import type { MenuBahan } from './menu';

export interface Variance {
  estimatedCost: number;
  realCost: number;
  selisih: number;
  over: boolean;
  sisaBudget: number | null;
  overBudget: boolean;
}

export interface PlanRow {
  id: number;
  planDate: string;
  menuId: number;
  servings: number;
  selectionMethod: 'MANUAL' | 'VOTE' | 'SPIN';
  estimatedCost: string;
  budget?: string | null;
  status: 'PLANNED' | 'DONE';
  note?: string | null;
  menu?: { id: number; name: string; estimatedCost: string; servings?: number };
  realCost: number;
  variance: Variance;
}

export interface BelanjaLite {
  id: number;
  amount: string;
  description: string;
  spentAt: string;
  notaUrl?: string | null;
  createdBy?: { id: number; name?: string };
}

export interface PlanDetail extends Omit<PlanRow, 'menu'> {
  menu?: { id: number; name: string; estimatedCost: string; servings?: number; bahan?: MenuBahan[] };
  belanja: BelanjaLite[];
}

export interface PlanRekap {
  totalPlan: number;
  totalEstimasi: number;
  totalReal: number;
  selisih: number;
  over: boolean;
  plans: PlanRow[];
}

export interface PlanInput {
  planDate: string;
  menuId: number;
  servings?: number;
  selectionMethod?: 'MANUAL' | 'VOTE' | 'SPIN';
  budget?: number | null;
  note?: string | null;
}

export const getPlans = async (params: { from?: string; to?: string } = {}) =>
  (await api.get<PlanRow[]>('/menu-plan', { params })).data;
export const getPlan = async (id: number) => (await api.get<PlanDetail>(`/menu-plan/${id}`)).data;
export const getPlanRekap = async (params: { from?: string; to?: string } = {}) =>
  (await api.get<PlanRekap>('/menu-plan/rekap', { params })).data;
export const createPlan = async (input: PlanInput) => (await api.post<PlanRow>('/menu-plan', input)).data;
export const updatePlan = async (id: number, input: Partial<PlanInput> & { status?: string }) =>
  (await api.patch(`/menu-plan/${id}`, input)).data;
export const deletePlan = async (id: number) => (await api.delete(`/menu-plan/${id}`)).data;

export const getMenuSetting = async () => (await api.get<{ dailyBudget: string }>('/menu-setting')).data;
export const updateMenuSetting = async (dailyBudget: number) => (await api.put('/menu-setting', { dailyBudget })).data;
