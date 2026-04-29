import axios from 'axios';

const PIN_STORAGE_KEY = 'warehouse-pin';

const publicApi = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
});

publicApi.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const pin = sessionStorage.getItem(PIN_STORAGE_KEY);
        if (pin) config.headers.set('X-Warehouse-Pin', pin);
    }
    return config;
}, (error) => Promise.reject(error));

publicApi.interceptors.response.use(
    (r) => r,
    (error) => {
        if (typeof window !== 'undefined' && error?.response?.status === 401) {
            sessionStorage.removeItem(PIN_STORAGE_KEY);
        }
        return Promise.reject(error);
    },
);

export const savePin = (pin: string) => {
    if (typeof window !== 'undefined') sessionStorage.setItem(PIN_STORAGE_KEY, pin);
};
export const clearPin = () => {
    if (typeof window !== 'undefined') sessionStorage.removeItem(PIN_STORAGE_KEY);
};
export const readPin = (): string | null => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(PIN_STORAGE_KEY);
};

export interface PublicWorker {
    id: number;
    name: string;
    fullName?: string | null;
    phone?: string | null;
    position: string | null;
    photoUrl: string | null;
}

export interface PublicWarehouse {
    id: number;
    name: string;
    address: string | null;
}

export interface PublicVariant {
    id: number;
    sku: string;
    variantName: string;
    stock: number;
    variantImageUrl: string | null;
    defaultWarehouseId?: number | null;
    defaultWarehouse?: { id: number; name: string } | null;
}

export interface PublicProduct {
    id: number;
    name: string;
    imageUrl: string | null;
    unit: { name: string } | null;
    category: { id: number; name: string } | null;
    variants: PublicVariant[];
}

export interface PublicEvent {
    id: number;
    code: string;
    name: string;
    brand: 'EXINDO' | 'XPOSER' | 'OTHER';
    venue: string | null;
    eventStart: string | null;
    eventEnd: string | null;
    status: 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

export interface PublicCategory {
    id: number;
    name: string;
}

export interface PublicUnit {
    id: number;
    name: string;
}

export interface Bootstrap {
    workers: PublicWorker[];
    warehouses: PublicWarehouse[];
    products: PublicProduct[];
    events: PublicEvent[];
    categories: PublicCategory[];
    units: PublicUnit[];
}

export const bootstrapPublicGudang = async () =>
    (await publicApi.get<Bootstrap>('/public/gudang/bootstrap')).data;

export const checkoutPublicGudang = async (form: FormData) =>
    (await publicApi.post('/public/gudang/checkout', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;

export interface PublicBorrowItem {
    id: number;
    productVariantId: number;
    quantity: string | number;
    returnedQty: string | number;
    notes: string | null;
    productVariant: {
        id: number;
        sku: string;
        variantName: string | null;
        variantImageUrl: string | null;
        product: { id: number; name: string; imageUrl: string | null };
    };
}

export interface PublicActiveBorrow {
    id: number;
    code: string;
    type: 'BORROW' | 'USE';
    status: string;
    purpose: string;
    scheduledReturnAt: string | null;
    createdAt: string;
    checkoutPhotoUrl: string | null;
    worker: { id: number; name: string; photoUrl: string | null; position: string | null };
    warehouse: { id: number; name: string };
    items: PublicBorrowItem[];
}

export const getPublicActiveBorrows = async (workerId?: number) => {
    const suffix = workerId ? `?workerId=${workerId}` : '';
    return (await publicApi.get<PublicActiveBorrow[]>(`/public/gudang/active-borrows${suffix}`)).data;
};

export const registerPublicWorker = async (form: FormData) =>
    (await publicApi.post<PublicWorker>('/public/gudang/register-worker', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;

export const returnPublicWithdrawal = async (id: number, form: FormData) =>
    (await publicApi.post(`/public/gudang/return/${id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;

// ── Stok Lapangan: Restok / Adjust / Item Baru ─────────────────────────────

export interface RestockResult {
    ok: true;
    variant: {
        id: number;
        sku: string;
        variantName: string | null;
        productName: string;
        stockBefore: number;
        stockAfter: number;
    };
    movement: { id: number; referenceId: string; photoUrl: string | null };
}

export interface AdjustResult {
    ok: true;
    variant: {
        id: number;
        sku: string;
        variantName: string | null;
        productName: string;
        stockBefore: number;
        stockAfter: number;
        diff: number;
    };
    movement: { id: number; referenceId: string; photoUrl: string | null };
}

export interface NewItemResult {
    ok: true;
    product: { id: number; name: string };
    /** Multi-varian: setiap entry punya id, sku, variantName, stock, deskripsi, catatan, foto, movementId */
    variants: Array<{
        id: number;
        sku: string;
        variantName: string | null;
        stock: number;
        description: string | null;
        notes: string | null;
        variantImageUrl: string | null;
        movementId: number | null;
    }>;
    photoUrl: string | null;
}

export const restockPublicGudang = async (form: FormData) =>
    (await publicApi.post<RestockResult>('/public/gudang/restock', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;

export const adjustStockPublicGudang = async (form: FormData) =>
    (await publicApi.post<AdjustResult>('/public/gudang/adjust-stock', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;

export const createNewItemPublicGudang = async (form: FormData) =>
    (await publicApi.post<NewItemResult>('/public/gudang/new-item', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
