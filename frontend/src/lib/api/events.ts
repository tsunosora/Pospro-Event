import api from './client';

export type EventStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type EventBrand = 'EXINDO' | 'XPOSER' | 'OTHER';

export interface EventRecord {
    id: number;
    code: string;
    name: string;
    brand: EventBrand;
    status: EventStatus;
    venue: string | null;
    customerId: number | null;
    customerName: string | null;
    picWorkerId: number | null;
    picName: string | null;
    departureStart: string | null;
    departureEnd: string | null;
    setupStart: string | null;
    setupEnd: string | null;
    loadingStart: string | null;
    loadingEnd: string | null;
    eventStart: string | null;
    eventEnd: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    customer?: { id: number; name: string; companyName: string | null } | null;
    picWorker?: { id: number; name: string; position: string | null } | null;
    _count?: { withdrawals: number };
}

export interface EventDetail extends EventRecord {
    withdrawals: Array<{
        id: number;
        code: string;
        type: 'BORROW' | 'USE';
        status: string;
        purpose: string;
        createdAt: string;
        scheduledReturnAt: string | null;
        worker: { id: number; name: string };
        warehouse: { id: number; name: string };
        items: Array<{
            id: number;
            quantity: string | number;
            returnedQty: string | number;
            notes: string | null;
            productVariant: {
                id: number;
                sku: string;
                variantName: string | null;
                product: { id: number; name: string };
            };
        }>;
    }>;
}

export interface EventSummaryItem {
    productVariantId: number;
    sku: string;
    variantName: string | null;
    productName: string;
    totalQuantity: number;
    totalReturned: number;
    outstanding: number;
    withdrawalCount: number;
}

export interface EventSummary {
    eventId: number;
    code: string;
    name: string;
    totalWithdrawals: number;
    totalUniqueItems: number;
    totalQty: number;
    totalOutstanding: number;
    items: EventSummaryItem[];
}

export interface EventFormInput {
    name: string;
    brand?: EventBrand;
    status?: EventStatus;
    venue?: string | null;
    customerId?: number | null;
    customerName?: string | null;
    picWorkerId?: number | null;
    picName?: string | null;
    departureStart?: string | null;
    departureEnd?: string | null;
    setupStart?: string | null;
    setupEnd?: string | null;
    loadingStart?: string | null;
    loadingEnd?: string | null;
    eventStart?: string | null;
    eventEnd?: string | null;
    notes?: string | null;
}

export interface EventListFilter {
    status?: EventStatus;
    brand?: EventBrand;
    year?: number;
    month?: number;
    search?: string;
}

export const getEvents = async (filter: EventListFilter = {}) => {
    const params = new URLSearchParams();
    if (filter.status) params.set('status', filter.status);
    if (filter.brand) params.set('brand', filter.brand);
    if (filter.year) params.set('year', String(filter.year));
    if (filter.month) params.set('month', String(filter.month));
    if (filter.search) params.set('search', filter.search);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return (await api.get<EventRecord[]>(`/events${suffix}`)).data;
};

export const getEvent = async (id: number) =>
    (await api.get<EventDetail>(`/events/${id}`)).data;

export const getEventSummary = async (id: number) =>
    (await api.get<EventSummary>(`/events/${id}/summary`)).data;

export const createEvent = async (input: EventFormInput) =>
    (await api.post<EventRecord>('/events', input)).data;

export const updateEvent = async (id: number, input: Partial<EventFormInput>) =>
    (await api.patch<EventRecord>(`/events/${id}`, input)).data;

export const deleteEvent = async (id: number) =>
    (await api.delete<{ ok: true }>(`/events/${id}`)).data;

export const createEventShare = async (id: number) =>
    (await api.post<{ token: string }>(`/events/${id}/share`)).data;

export const regenerateEventShare = async (id: number) =>
    (await api.post<{ token: string }>(`/events/${id}/share/regenerate`)).data;

export const sendEventWhatsapp = async (
    id: number,
    body: { target: string; includeLink?: boolean; shareBaseUrl?: string },
) =>
    (await api.post<{ ok: true; target: string }>(`/events/${id}/whatsapp`, body)).data;

export interface EventDashboardWithdrawal {
    id: number;
    code: string;
    type: 'BORROW' | 'USE';
    status: string;
    purpose: string;
    createdAt: string;
    scheduledReturnAt: string | null;
    worker: { id: number; name: string };
    event: { id: number; code: string; name: string; venue: string | null } | null;
    items: Array<{
        id: number;
        quantity: string | number;
        returnedQty: string | number;
        productVariant: {
            id: number;
            sku: string;
            variantName: string | null;
            product: { id: number; name: string };
        };
    }>;
}

export interface EventDashboardPic {
    workerId: number;
    name: string;
    position: string | null;
    phone: string | null;
    events: Array<{
        id: number;
        code: string;
        name: string;
        venue: string | null;
        status: EventStatus;
        setupStart: string | null;
        eventStart: string | null;
        eventEnd: string | null;
    }>;
}

export interface EventDashboardSnapshot {
    stats: {
        monthEvents: number;
        inProgress: number;
        activePics: number;
        itemsOut: number;
    };
    monthEvents: EventRecord[];
    inProgress: EventRecord[];
    activePics: EventDashboardPic[];
    recentWithdrawals: EventDashboardWithdrawal[];
    generatedAt: string;
}

export const getEventDashboard = async () =>
    (await api.get<EventDashboardSnapshot>('/events/dashboard')).data;

export const exportEventPdfUrl = (id: number) => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? '';
    return `${base}/events/${id}/export/pdf`;
};
