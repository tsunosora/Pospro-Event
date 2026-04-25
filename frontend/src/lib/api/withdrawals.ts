import api from './client';

export type WithdrawalType = 'BORROW' | 'USE';
export type WithdrawalStatus =
    | 'CHECKED_OUT'
    | 'RETURNED'
    | 'PARTIAL_RETURNED'
    | 'OVERDUE'
    | 'CANCELLED';

export interface WithdrawalItem {
    id: number;
    withdrawalId: number;
    productVariantId: number;
    quantity: string;
    returnedQty: string;
    notes: string | null;
    productVariant?: {
        id: number;
        sku: string;
        variantName: string | null;
        product: {
            id: number;
            name: string;
            imageUrl: string | null;
            unit?: { name: string } | null;
        };
    };
}

export interface Withdrawal {
    id: number;
    code: string;
    workerId: number;
    warehouseId: number;
    eventId: number | null;
    type: WithdrawalType;
    status: WithdrawalStatus;
    purpose: string;
    scheduledReturnAt: string | null;
    actualReturnAt: string | null;
    checkoutPhotoUrl: string | null;
    returnPhotoUrl: string | null;
    notes: string | null;
    createdById: number | null;
    createdAt: string;
    updatedAt: string;
    worker?: {
        id: number;
        name: string;
        position: string | null;
        photoUrl: string | null;
    };
    warehouse?: { id: number; name: string };
    event?: {
        id: number;
        code: string;
        name: string;
        brand: 'EXINDO' | 'XPOSER' | 'OTHER';
        venue?: string | null;
        eventStart: string | null;
        eventEnd?: string | null;
    } | null;
    createdBy?: { id: number; name: string | null; email: string } | null;
    items: WithdrawalItem[];
    _count?: { items: number };
}

export interface CheckoutItemInput {
    productVariantId: number;
    quantity: number;
    notes?: string;
}

export interface CheckoutInput {
    workerId: number;
    warehouseId: number;
    eventId?: number | null;
    type: WithdrawalType;
    purpose: string;
    scheduledReturnAt?: string | null;
    notes?: string;
    items: CheckoutItemInput[];
    photo?: Blob | File | null; // captured selfie
}

export interface ReturnItemInput {
    withdrawalItemId: number;
    returnQuantity: number;
    notes?: string;
}

export interface ReturnInput {
    items: ReturnItemInput[];
    notes?: string;
    photo?: Blob | File | null;
}

export const getWithdrawals = async (params: {
    status?: WithdrawalStatus;
    type?: WithdrawalType;
    workerId?: number;
    warehouseId?: number;
    eventId?: number;
    overdue?: boolean;
} = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.append('status', params.status);
    if (params.type) q.append('type', params.type);
    if (params.workerId) q.append('workerId', String(params.workerId));
    if (params.warehouseId) q.append('warehouseId', String(params.warehouseId));
    if (params.eventId) q.append('eventId', String(params.eventId));
    if (params.overdue) q.append('overdue', '1');
    const suffix = q.toString() ? `?${q}` : '';
    return (await api.get<Withdrawal[]>(`/withdrawals${suffix}`)).data;
};

export const getWithdrawal = async (id: number) =>
    (await api.get<Withdrawal>(`/withdrawals/${id}`)).data;

export const getOverdueCount = async () =>
    (await api.get<{ count: number }>(`/withdrawals/overdue/count`)).data;

export const checkoutWithdrawal = async (input: CheckoutInput) => {
    const fd = new FormData();
    fd.append('workerId', String(input.workerId));
    fd.append('warehouseId', String(input.warehouseId));
    if (input.eventId) fd.append('eventId', String(input.eventId));
    fd.append('type', input.type);
    fd.append('purpose', input.purpose);
    if (input.scheduledReturnAt) fd.append('scheduledReturnAt', input.scheduledReturnAt);
    if (input.notes) fd.append('notes', input.notes);
    fd.append('items', JSON.stringify(input.items));
    if (input.photo) {
        const name = input.photo instanceof File
            ? input.photo.name
            : `checkout-${Date.now()}.jpg`;
        fd.append('photo', input.photo, name);
    }
    return (await api.post<Withdrawal>('/withdrawals', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

export const returnWithdrawal = async (id: number, input: ReturnInput) => {
    const fd = new FormData();
    fd.append('items', JSON.stringify(input.items));
    if (input.notes) fd.append('notes', input.notes);
    if (input.photo) {
        const name = input.photo instanceof File
            ? input.photo.name
            : `return-${Date.now()}.jpg`;
        fd.append('photo', input.photo, name);
    }
    return (await api.post<Withdrawal>(`/withdrawals/${id}/return`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

export const cancelWithdrawal = async (id: number) =>
    (await api.delete<Withdrawal>(`/withdrawals/${id}`)).data;
