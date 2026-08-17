import api from './client';

export type PengajuanStatus = 'OPEN' | 'DONE';
export type PengajuanItemStatus = 'PENDING' | 'APPROVED';

export interface PengajuanItem {
  id: number;
  categoryId: number;
  description: string;
  unit?: string | null;
  quantity: string;
  price: string;
  status: PengajuanItemStatus;
  approvedById?: number | null;
  approvedAt?: string | null;
  convertedRabItemId?: number | null;
  category?: { id: number; name: string } | null;
  approvedBy?: { id: number; name?: string } | null;
}

export interface PengajuanDetail {
  id: number;
  eventId?: number | null;
  rabPlanId?: number | null;
  title?: string | null;
  status: PengajuanStatus;
  event?: { id: number; code: string; name: string; rabPlanId?: number | null } | null;
  createdBy?: { id: number; name?: string };
  items: PengajuanItem[];
}

export interface PengajuanListRow {
  id: number;
  title?: string | null;
  status: PengajuanStatus;
  event?: { id: number; code: string; name: string };
  createdBy?: { id: number; name?: string };
  _count?: { items: number };
}

export interface PengajuanItemInput {
  categoryId: number;
  description: string;
  unit?: string | null;
  quantity: number;
  price: number;
}

export const getPengajuanList = async (eventId?: number) =>
  (await api.get<PengajuanListRow[]>('/pengajuan', { params: { eventId } })).data;

export const getPengajuan = async (id: number) =>
  (await api.get<PengajuanDetail>(`/pengajuan/${id}`)).data;

export const createPengajuan = async (input: {
  eventId?: number | null;
  title?: string | null;
  items?: PengajuanItemInput[];
}) => (await api.post<PengajuanDetail>('/pengajuan', input)).data;

export const deletePengajuan = async (id: number) =>
  (await api.delete(`/pengajuan/${id}`)).data;

export const addPengajuanItem = async (id: number, input: PengajuanItemInput) =>
  (await api.post<PengajuanItem>(`/pengajuan/${id}/items`, input)).data;

export const updatePengajuanItem = async (
  itemId: number,
  input: Partial<PengajuanItemInput>,
) => (await api.patch<PengajuanItem>(`/pengajuan/items/${itemId}`, input)).data;

export const deletePengajuanItem = async (itemId: number) =>
  (await api.delete(`/pengajuan/items/${itemId}`)).data;

export const approvePengajuanItem = async (itemId: number) =>
  (await api.patch<PengajuanItem>(`/pengajuan/items/${itemId}/approve`)).data;

export const unapprovePengajuanItem = async (itemId: number) =>
  (await api.patch<PengajuanItem>(`/pengajuan/items/${itemId}/unapprove`)).data;

export interface PendingApprovalItem {
  id: number;
  description: string;
  unit?: string | null;
  quantity: string;
  price: string;
  category?: { id: number; name: string } | null;
}

export interface PendingApprovalGroup {
  pengajuanId: number;
  title?: string | null;
  event?: { id: number; code: string; name: string } | null;
  items: PendingApprovalItem[];
}

export const getPengajuanPending = async () =>
  (await api.get<PendingApprovalGroup[]>('/pengajuan/approval/pending')).data;

export const getPengajuanPendingCount = async () =>
  (await api.get<{ count: number }>('/pengajuan/approval/count')).data;

export const approvePengajuanItems = async (itemIds: number[]) =>
  (await api.patch<{ approved: number }>('/pengajuan/approval/approve', { itemIds })).data;

export const convertPengajuanToRab = async (id: number) =>
  (
    await api.post<{ ok: boolean; rabPlanId: number; convertedCount: number }>(
      `/pengajuan/${id}/convert-to-rab`,
    )
  ).data;
