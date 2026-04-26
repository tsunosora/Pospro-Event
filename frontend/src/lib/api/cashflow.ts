import api from './client';

export const getCashflows = async (
    startDate?: string,
    endDate?: string,
    eventId?: number,
    rabPlanId?: number,
) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (eventId) params.append('eventId', String(eventId));
    if (rabPlanId) params.append('rabPlanId', String(rabPlanId));
    return (await api.get(`/cashflow?${params.toString()}`)).data;
};

export const getEventProfit = async (eventId: number) =>
    (await api.get<{
        eventId: number;
        totalIncome: number;
        totalExpense: number;
        grossProfit: number;
        marginPct: number;
        byCategory: Array<{ category: string; income: number; expense: number }>;
        entryCount: number;
        monthlyTrend: Array<{ month: string; income: number; expense: number; profit: number }>;
    }>(`/cashflow/event-profit/${eventId}`)).data;

export interface EventProfitRow {
    eventId: number;
    eventCode: string;
    eventName: string;
    venue: string | null;
    eventStart: string | null;
    status: string;
    customerName: string;
    customerCompany: string | null;
    totalIncome: number;
    totalExpense: number;
    grossProfit: number;
    marginPct: number;
    entryCount: number;
}

export const getAllEventsProfit = async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return (await api.get<{
        rows: EventProfitRow[];
        summary: {
            eventCount: number;
            totalIncome: number;
            totalExpense: number;
            grossProfit: number;
            marginPct: number;
        };
    }>(`/cashflow/all-events-profit?${params.toString()}`)).data;
};
export const createCashflow = async (data: any) => (await api.post('/cashflow', data)).data;
export const updateCashflow = async (id: number, data: any) => (await api.patch(`/cashflow/${id}`, data)).data;
export const deleteCashflow = async (id: number) => (await api.delete(`/cashflow/${id}`)).data;
export const deleteCashflowsBulk = async (ids: number[]) =>
    (await api.delete<{ ok: true; deleted: number }>('/cashflow/bulk', { data: { ids } })).data;
export const getCashflowMonthlyTrend = async () => (await api.get('/cashflow/monthly-trend')).data;
export const getCashflowCategoryBreakdown = async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return (await api.get(`/cashflow/category-breakdown?${params.toString()}`)).data;
};
export const getCashflowPlatformBreakdown = async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return (await api.get(`/cashflow/platform-breakdown?${params.toString()}`)).data;
};

// Auth
export const getMe = async () => (await api.get('/auth/me')).data as {
    id: number;
    name: string | null;
    email: string;
    role: { id: number; name: string } | null;
};

// Cashflow Change Requests
export type CashflowChangeRequest = {
    id: number;
    cashflowId: number;
    type: 'EDIT' | 'DELETE';
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    payload: Record<string, any> | null;
    requesterNote: string | null;
    reviewerNote: string | null;
    createdAt: string;
    requester: { id: number; name: string | null; email: string };
    cashflow: { id: number; type: string; category: string; amount: string; note: string | null; date: string };
};

export const submitCashflowRequest = async (body: {
    cashflowId: number;
    type: 'EDIT' | 'DELETE';
    payload?: Record<string, any>;
    requesterNote?: string;
}) => (await api.post('/cashflow-requests', body)).data;

export const getPendingRequests = async () =>
    (await api.get('/cashflow-requests/pending')).data as CashflowChangeRequest[];

export const getMyRequests = async () =>
    (await api.get('/cashflow-requests/mine')).data as CashflowChangeRequest[];

export const approveRequest = async (id: number, reviewerNote?: string) =>
    (await api.patch(`/cashflow-requests/${id}/approve`, { reviewerNote })).data;

export const rejectRequest = async (id: number, reviewerNote: string) =>
    (await api.patch(`/cashflow-requests/${id}/reject`, { reviewerNote })).data;
