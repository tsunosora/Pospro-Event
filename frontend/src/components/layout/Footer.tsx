"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BookOpen } from "lucide-react";
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
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-2 flex-wrap">
                <span>&copy; 2026 Muhammad Faisal Abdul Hakim</span>
                <span className="text-border">·</span>
                <Link
                    href="/help"
                    className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-700 hover:underline transition"
                >
                    <BookOpen className="h-3 w-3" />
                    Bantuan
                </Link>
            </p>
        </footer>
    );
}
