"use client";

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSettings } from '@/lib/api/settings';
import { useNotificationStore } from '@/store/notification-store';

function scheduleShiftReminder(
    timeStr: string,
    shiftLabel: string,
    addNotification: (n: any) => void,
    showShiftBanner: (label: string, time: string) => void,
    timerRef: React.MutableRefObject<any>,
    refKey: string,
) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return;

    const msUntilNext = () => {
        const now = new Date();
        const reminder = new Date();
        reminder.setHours(hours, minutes, 0, 0);
        if (reminder <= now) reminder.setDate(reminder.getDate() + 1);
        return reminder.getTime() - now.getTime();
    };

    const fire = () => {
        // Tambah ke list notifikasi (bell icon)
        addNotification({
            type: 'shift',
            title: `⏰ Pengingat Tutup ${shiftLabel}`,
            message: `Sudah jam ${timeStr}. Jangan lupa kirim laporan tutup shift sebelum pulang!`,
        });
        // Tampilkan popup banner yang mencolok
        showShiftBanner(shiftLabel, timeStr);
        // Jadwalkan ulang 24 jam kemudian
        timerRef.current[refKey] = setTimeout(fire, msUntilNext());
    };

    timerRef.current[refKey] = setTimeout(fire, msUntilNext());
}

export function useShiftReminder() {
    const addNotification = useNotificationStore(s => s.addNotification);
    const showShiftBanner = useNotificationStore(s => s.showShiftBanner);
    const timerRef = useRef<any>({});

    const { data: settings } = useQuery({
        queryKey: ['store-settings'],
        queryFn: getSettings,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (!settings?.notifyShiftReminder) return;

        // Clear existing timers
        if (timerRef.current.shift1) clearTimeout(timerRef.current.shift1);
        if (timerRef.current.shift2) clearTimeout(timerRef.current.shift2);

        // Shift 1
        if (settings?.shiftReminderTime) {
            scheduleShiftReminder(
                settings.shiftReminderTime,
                'Shift 1',
                addNotification,
                showShiftBanner,
                timerRef,
                'shift1',
            );
        }

        // Shift 2
        if ((settings as any)?.shiftReminderTime2) {
            scheduleShiftReminder(
                (settings as any).shiftReminderTime2,
                'Shift 2',
                addNotification,
                showShiftBanner,
                timerRef,
                'shift2',
            );
        }

        return () => {
            if (timerRef.current.shift1) clearTimeout(timerRef.current.shift1);
            if (timerRef.current.shift2) clearTimeout(timerRef.current.shift2);
        };
    }, [settings?.notifyShiftReminder, settings?.shiftReminderTime, (settings as any)?.shiftReminderTime2, addNotification, showShiftBanner]);
}
