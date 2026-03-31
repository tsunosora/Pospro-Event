"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { ShiftReminderBanner } from "./ShiftReminderBanner";
import { useNotificationStream } from "@/hooks/useNotificationStream";
import { useShiftReminder } from "@/hooks/useShiftReminder";
import { useNotificationStore } from "@/store/notification-store";

interface MainLayoutProps {
    children: React.ReactNode;
}

function AppInitializer() {
    const loadFromIDB = useNotificationStore(s => s.loadFromIDB);
    useNotificationStream();
    useShiftReminder();

    useEffect(() => {
        loadFromIDB();
    }, [loadFromIDB]);

    return null;
}

export function MainLayout({ children }: MainLayoutProps) {
    const pathname = usePathname();
    const isLoginPage = pathname === "/login";
    const isOpnamePage = pathname.startsWith("/opname/");
    const isProduksiPage = pathname.startsWith("/produksi");
    const isPublicProductPage = pathname.startsWith("/p/");

    if (isLoginPage || isOpnamePage || isProduksiPage || isPublicProductPage) {
        return <>{children}</>;
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <AppInitializer />
            <ShiftReminderBanner />
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
