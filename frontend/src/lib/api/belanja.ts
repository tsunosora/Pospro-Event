import api from './client';

export interface KasSummary { masuk: number; keluar: number; saldo: number; untaggedCount: number; userId: number | null; }
export interface KasAdmin { userId: number; name?: string; masuk: number; keluar: number; saldo: number; }
export interface Penerimaan {
  id: number; amount: string; source?: string | null; note?: string | null;
  receivedAt: string; createdBy?: { id: number; name?: string };
}
export interface BelanjaRow {
  id: number; amount: string; description: string; spentAt: string;
  notaUrl?: string | null; eventId?: number | null; rabPlanId?: number | null;
  category?: string | null; rabCategoryId?: number | null; rabItemId?: number | null;
  event?: { id: number; code: string; name: string } | null;
  rabPlan?: { id: number; code: string; title: string } | null;
  rabCategory?: { id: number; name: string } | null;
  rabItem?: { id: number; description: string } | null;
  createdBy?: { id: number; name?: string };
}
export interface RekapHari { tanggal: string; total: number; items: BelanjaRow[]; }
export interface RealisasiPos { categoryId: number; name: string; rencana: number; real: number; selisih: number; overspend: boolean; }
export interface RealisasiItem { rabItemId: number; description: string; rencana: number; real: number; selisih: number; overspend: boolean; }
export interface RealisasiRab { pos: RealisasiPos[]; perItem: RealisasiItem[]; tanpaPos: number; totalRencana: number; totalReal: number; selisih: number; }

// ── Kas ──
export const getKasSummary = async (userId?: number) =>
  (await api.get<KasSummary>('/kas/summary', { params: { userId } })).data;
export const getKasByAdmin = async () => (await api.get<KasAdmin[]>('/kas/by-admin')).data;
export const getPenerimaan = async (userId?: number) =>
  (await api.get<Penerimaan[]>('/kas/penerimaan', { params: { userId } })).data;
export const createPenerimaan = async (input: {
  amount: number; source?: string | null; note?: string | null; receivedAt?: string; attributeToUserId?: number | null;
}) => (await api.post('/kas/penerimaan', input)).data;
export const deletePenerimaan = async (id: number) => (await api.delete(`/kas/penerimaan/${id}`)).data;

// ── Belanja ──
export const getBelanja = async (params: { from?: string; to?: string; eventId?: number; rabPlanId?: number; untagged?: boolean } = {}) =>
  (await api.get<BelanjaRow[]>('/belanja', { params })).data;
export const getRekapHarian = async (params: { from?: string; to?: string } = {}) =>
  (await api.get<RekapHari[]>('/belanja/rekap-harian', { params })).data;
export const createBelanja = async (input: {
  amount: number; description: string; spentAt?: string;
  eventId?: number | null; rabPlanId?: number | null; rabCategoryId?: number | null; rabItemId?: number | null;
  category?: string | null; attributeToUserId?: number | null;
}) => (await api.post<BelanjaRow>('/belanja', input)).data;
export const uploadBelanjaNota = async (id: number, file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return (await api.post(`/belanja/${id}/nota`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
};
export const deleteBelanja = async (id: number) => (await api.delete(`/belanja/${id}`)).data;
export const getRealisasiRab = async (rabPlanId: number) =>
  (await api.get<RealisasiRab>(`/belanja/realisasi-rab/${rabPlanId}`)).data;

/** Download laporan belanja PDF (per periode / per event / per RAB). */
export const downloadBelanjaPdf = async (
  params: { from?: string; to?: string; eventId?: number; rabPlanId?: number } = {},
  fallbackName = "laporan-belanja.pdf",
) => {
  const res = await api.get(`/belanja/export/pdf`, { params, responseType: "blob" });
  const blob = new Blob([res.data], { type: "application/pdf" });
  const cd = (res.headers as Record<string, string>)["content-disposition"] ?? "";
  const match = /filename="([^"]+)"/.exec(cd);
  const filename = match ? match[1] : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
