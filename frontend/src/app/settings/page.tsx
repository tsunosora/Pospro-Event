"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Settings as SettingsIcon } from "lucide-react";

/**
 * Halaman /settings root:
 * - Desktop (lg+): auto-redirect ke /settings/general supaya langsung lihat content
 * - Mobile (<lg): tampilkan welcome screen — user pilih dari list di sidebar
 */
export default function SettingsRoot() {
    const router = useRouter();

    useEffect(() => {
        // Cek viewport width — kalau desktop, redirect ke general
        const isDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
        if (isDesktop) {
            router.replace("/settings/general");
        }
    }, [router]);

    return (
        <div className="hidden lg:flex h-full items-center justify-center p-12 text-center">
            <div>
                <SettingsIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Pilih kategori pengaturan dari sidebar →</p>
            </div>
        </div>
    );
}
