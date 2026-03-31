import { create } from 'zustand';
import { openDB } from 'idb';

export type NotifType = 'transaction' | 'stock' | 'sync' | 'shift' | 'update' | 'system';

export interface AppNotification {
    id: string;
    type: NotifType;
    title: string;
    message: string;
    timestamp: number;
    read: boolean;
}

interface NotificationStore {
    notifications: AppNotification[];
    unreadCount: number;
    loaded: boolean;
    loadFromIDB: () => Promise<void>;
    addNotification: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
    markRead: (id: string) => void;
    markAllRead: () => void;
    clearAll: () => void;
    // Shift banner popup
    shiftBanner: { visible: boolean; shiftLabel: string; time: string } | null;
    showShiftBanner: (shiftLabel: string, time: string) => void;
    dismissShiftBanner: () => void;
}

const DB_NAME = 'pos-notifications-db';
const STORE_NAME = 'notifications';
const MAX_NOTIFS = 50;

async function getDB() {
    if (typeof window === 'undefined') return null;
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        },
    });
}

async function saveToIDB(notifs: AppNotification[]) {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.store.clear();
    for (const n of notifs) await tx.store.put(n);
    await tx.done;
}

async function loadFromIDB(): Promise<AppNotification[]> {
    const db = await getDB();
    if (!db) return [];
    const all = await db.getAll(STORE_NAME);
    return all.sort((a, b) => b.timestamp - a.timestamp);
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    loaded: false,
    shiftBanner: null,

    loadFromIDB: async () => {
        if (get().loaded) return;
        const notifs = await loadFromIDB();
        set({
            notifications: notifs,
            unreadCount: notifs.filter(n => !n.read).length,
            loaded: true,
        });
    },

    addNotification: (notif) => {
        const id = `${notif.type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const newNotif: AppNotification = {
            ...notif,
            id,
            timestamp: Date.now(),
            read: false,
        };
        set(state => {
            const updated = [newNotif, ...state.notifications].slice(0, MAX_NOTIFS);
            saveToIDB(updated).catch(() => { });
            return {
                notifications: updated,
                unreadCount: updated.filter(n => !n.read).length,
            };
        });
    },

    markRead: (id) => {
        set(state => {
            const updated = state.notifications.map(n =>
                n.id === id ? { ...n, read: true } : n
            );
            saveToIDB(updated).catch(() => { });
            return {
                notifications: updated,
                unreadCount: updated.filter(n => !n.read).length,
            };
        });
    },

    markAllRead: () => {
        set(state => {
            const updated = state.notifications.map(n => ({ ...n, read: true }));
            saveToIDB(updated).catch(() => { });
            return { notifications: updated, unreadCount: 0 };
        });
    },

    clearAll: () => {
        set({ notifications: [], unreadCount: 0 });
        saveToIDB([]).catch(() => { });
    },

    showShiftBanner: (shiftLabel, time) => {
        set({ shiftBanner: { visible: true, shiftLabel, time } });
    },

    dismissShiftBanner: () => {
        set({ shiftBanner: null });
    },
}));

