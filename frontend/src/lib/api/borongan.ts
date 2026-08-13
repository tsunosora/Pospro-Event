import api from './client';

export type BoronganClass = 'KELAS_A' | 'KELAS_B';
export type BoronganSlipStatus = 'DRAFT' | 'PAID';

export interface BoronganCrewEntry {
    id: number;
    eventId: number;
    workerId: number;
    boronganClass: BoronganClass;
    amount: string;
    weekStart: string;
    notes: string | null;
    slipId: number | null;
    cashflowId: number | null;
    worker: { id: number; name: string; boronganClass: BoronganClass | null };
    event: { id: number; code: string; name: string };
}

export interface EventBoronganData {
    rateA: string | null;
    rateB: string | null;
    crew: BoronganCrewEntry[];
}

export interface BoronganSlip {
    id: number;
    weekStart: string;
    weekEnd: string;
    workerId: number;
    totalAmount: string;
    status: BoronganSlipStatus;
    paidAt: string | null;
    paidById: number | null;
    notes: string | null;
    worker: { id: number; name: string };
    paidBy: { id: number; name: string } | null;
    entries: Array<BoronganCrewEntry & { event: { id: number; code: string; name: string } }>;
}

export interface BoronganWeekSummary {
    weekStart: string;
    total: number;
    paid: number;
    draft: number;
    slips: number;
}

// ── Per event: tarif + crew ──
export const getEventBorongan = async (eventId: number) =>
    (await api.get<EventBoronganData>(`/borongan/events/${eventId}/crew`)).data;

export const setEventBoronganRates = async (
    eventId: number,
    body: { rateA?: string | null; rateB?: string | null },
) => (await api.put<{ id: number; boronganRateA: string | null; boronganRateB: string | null }>(`/borongan/events/${eventId}/rates`, body)).data;

export const addBoronganCrew = async (
    eventId: number,
    body: { workerId: number; boronganClass?: BoronganClass | null; amount?: string | null; notes?: string | null },
) => (await api.post<BoronganCrewEntry>(`/borongan/events/${eventId}/crew`, body)).data;

export const updateBoronganCrew = async (
    id: number,
    body: { boronganClass?: BoronganClass; amount?: string | null; notes?: string | null },
) => (await api.patch<BoronganCrewEntry>(`/borongan/crew/${id}`, body)).data;

export const removeBoronganCrew = async (id: number) =>
    (await api.delete<{ ok: boolean }>(`/borongan/crew/${id}`)).data;

// ── Slip mingguan ──
export const getBoronganWeeks = async () =>
    (await api.get<BoronganWeekSummary[]>(`/borongan/weeks`)).data;

export const getBoronganSlips = async (params: { weekStart?: string; from?: string; to?: string; status?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.weekStart) qs.set('weekStart', params.weekStart);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.status) qs.set('status', params.status);
    const s = qs.toString();
    return (await api.get<BoronganSlip[]>(`/borongan/slips${s ? `?${s}` : ''}`)).data;
};

export const generateBoronganWeek = async (weekStart: string) =>
    (await api.post<{ weekStart: string; weekEnd: string; generated: number }>(`/borongan/slips/generate`, { weekStart })).data;

export const payBoronganSlip = async (id: number) =>
    (await api.post<BoronganSlip>(`/borongan/slips/${id}/pay`)).data;

export const unpayBoronganSlip = async (id: number) =>
    (await api.post<BoronganSlip>(`/borongan/slips/${id}/unpay`)).data;

export const BORONGAN_CLASS_LABEL: Record<BoronganClass, string> = {
    KELAS_A: 'Kelas A',
    KELAS_B: 'Kelas B',
};
