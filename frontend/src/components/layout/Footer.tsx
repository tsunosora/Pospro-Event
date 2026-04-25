"use client";

import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/lib/api";

export function Footer() {
    const { data: settings } = useQuery({
        queryKey: ['store-settings'],
        queryFn: getSettings,
        staleTime: 5 * 60 * 1000,
    });

    const storeName = settings?.storeName || 'Pospro Event';

    return (
        <footer className="shrink-0 border-t border-border/50 bg-muted/30 py-4 px-6 text-center print:hidden">
            <p className="text-sm font-semibold text-foreground/70 tracking-wide">
                {storeName}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
                &copy; 2026 Muhammad Faisal Abdul Hakim
            </p>
        </footer>
    );
}
