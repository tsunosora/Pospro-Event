"use client";

import { useEffect, useState } from "react";
import { getOfflineTransactions, clearOfflineTransaction } from "./sync";
import { createTransaction } from "./api";
import { Wifi, WifiOff } from "lucide-react";
import { useNotificationStore } from "@/store/notification-store";

export function SyncManager() {
    const [isOnline, setIsOnline] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const addNotification = useNotificationStore(s => s.addNotification);

    useEffect(() => {
        // Initial check
        setIsOnline(navigator.onLine);

        const handleOnline = () => {
            setIsOnline(true);
            syncOfflineData();
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        // Initial sync attempt if online on load
        if (navigator.onLine) {
            syncOfflineData();
        }

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    const syncOfflineData = async () => {
        if (isSyncing) return;
        setIsSyncing(true);

        try {
            const offlineTxs = await getOfflineTransactions();
            if (offlineTxs.length > 0) {
                console.log(`Menemukan ${offlineTxs.length} transaksi offline. Mensinkronkan...`);

                for (const tx of offlineTxs) {
                    try {
                        await createTransaction(tx.payload);
                        if (tx.id) {
                            await clearOfflineTransaction(tx.id);
                        }
                    } catch (err) {
                        console.error("Gagal sinkronkan transaksi:", tx.id, err);
                        // Will retry on next online event or load
                    }
                }

                // Notify sync success via notification store
                addNotification({
                    type: 'sync',
                    title: 'Sinkronisasi Selesai',
                    message: `${offlineTxs.length} transaksi offline berhasil disinkronkan ke server.`,
                });
            }
        } catch (error) {
            console.error("Error during sync", error);
        } finally {
            setIsSyncing(false);
        }
    };

    if (!isOnline) {
        return (
            <div className="fixed bottom-4 right-4 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50 text-sm font-medium animate-pulse">
                <WifiOff className="w-4 h-4" />
                Mode Offline
            </div>
        );
    }

    return null;
}
