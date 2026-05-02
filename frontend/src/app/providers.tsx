"use client";

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { openDB, IDBPDatabase } from 'idb';
import { useState } from 'react';

// ── Cache lifetime constants ────────────────────────────────────────────────
// gcTime singkat (5 menit) — query yang sudah unmount auto-evict dari RAM,
// turunin pressure memory di browser secara drastis.
const QUERY_GC_TIME = 1000 * 60 * 5; // 5 menit

// Persist max age = 6 jam — data yang di-persist ke IndexedDB (mis. settings, user)
// tidak terlalu cepat expire supaya cold-start app tetap cepat.
const PERSIST_MAX_AGE = 1000 * 60 * 60 * 6; // 6 jam

// IDB-backed async storage untuk persister
let cacheDbPromise: Promise<IDBPDatabase> | null = null;

function getCacheDB() {
    if (typeof window === 'undefined') return null;
    if (!cacheDbPromise) {
        cacheDbPromise = openDB('pos-query-cache', 1, {
            upgrade(db) {
                db.createObjectStore('cache');
            },
        });
    }
    return cacheDbPromise;
}

const idbStorage = {
    getItem: async (key: string): Promise<string | null> => {
        const db = await getCacheDB();
        if (!db) return null;
        return (await db.get('cache', key)) ?? null;
    },
    setItem: async (key: string, value: string): Promise<void> => {
        const db = await getCacheDB();
        if (!db) return;
        await db.put('cache', value, key);
    },
    removeItem: async (key: string): Promise<void> => {
        const db = await getCacheDB();
        if (!db) return;
        await db.delete('cache', key);
    },
};

const persister = createAsyncStoragePersister({
    storage: idbStorage,
    key: 'pos-query-cache',
    throttleTime: 1000,
});

/**
 * Daftar query key yang BOLEH di-persist ke IndexedDB.
 * Strategi: persist hanya data kecil & global yang dipakai berulang
 * (settings, user, brand, kategori, dll). List besar (RAB, cashflow,
 * customers, invoices) TIDAK di-persist supaya gak mem-blow-up RAM
 * saat hidrate cold-start.
 */
const PERSIST_ALLOWLIST = [
    // User & global setting
    "current-user",
    "store-settings",
    "brand-settings",
    // Master data kecil yang stabil
    "categories",
    "units",
    "rab-categories",
    "bank-accounts",
    "branches",
    "warehouses",
    "storage-locations",
    "designers",
    "workers",
    "competitors",
    "crew-teams",
    "rab-tags",
    "doc-counters",
    // CRM master (stages & labels — kecil & jarang berubah)
    "crm-stages",
    "crm-labels",
    "crm-distinct",
    // Quotation variant config (master)
    "quotation-variants",
];

function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
    const head = queryKey[0];
    if (typeof head !== "string") return false;
    return PERSIST_ALLOWLIST.includes(head);
}

export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000,         // data fresh selama 1 menit
                gcTime: QUERY_GC_TIME,        // ⚡ 5 menit (turun dari 24 jam) — query unmount langsung di-evict
                refetchOnWindowFocus: false,
                refetchOnReconnect: true,     // auto-refresh saat internet kembali
            },
        },
    }));

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
                persister,
                maxAge: PERSIST_MAX_AGE,
                buster: '2',                  // bump dari '1' → invalidate cache lama format 24 jam
                dehydrateOptions: {
                    // Filter: hanya persist query di allowlist
                    shouldDehydrateQuery: (query) =>
                        query.state.status === "success" && shouldPersistQuery(query.queryKey),
                },
            }}
        >
            {children}
        </PersistQueryClientProvider>
    );
}
