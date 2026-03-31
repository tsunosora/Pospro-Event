"use client";

import { useEffect, useRef } from 'react';
import { useNotificationStore } from '@/store/notification-store';

export function useNotificationStream() {
    const addNotification = useNotificationStore(s => s.addNotification);
    const esRef = useRef<EventSource | null>(null);
    const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const connect = () => {
            const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) return;

            const es = new EventSource(`${base}/notifications/stream?token=${encodeURIComponent(token)}`);
            esRef.current = es;

            es.onmessage = (e) => {
                try {
                    const event = JSON.parse(e.data);
                    if (event?.type && event?.title && event?.message) {
                        addNotification(event);
                    }
                } catch { /* ignore parse errors */ }
            };

            es.onerror = () => {
                es.close();
                esRef.current = null;
                // Auto-reconnect setelah 5 detik
                retryRef.current = setTimeout(connect, 5000);
            };
        };

        connect();

        return () => {
            esRef.current?.close();
            if (retryRef.current) clearTimeout(retryRef.current);
        };
    }, [addNotification]);
}
