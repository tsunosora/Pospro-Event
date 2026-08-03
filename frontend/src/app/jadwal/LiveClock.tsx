"use client";

import { useEffect, useState } from "react";
import { Clock as ClockIcon } from "lucide-react";

const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const p2 = (n: number) => String(n).padStart(2, "0");

/** Jam live — update tiap detik. variant "hero" (besar, layar PIN) / "bar" (header). */
export function LiveClock({ variant = "bar" }: { variant?: "hero" | "bar" }) {
    const [now, setNow] = useState<Date | null>(null);

    useEffect(() => {
        const tick = () => setNow(new Date());
        tick(); // tampilkan segera, jangan tunggu 1 detik
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    const time = now ? `${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}` : "--:--:--";
    const date = now ? `${DAYS_ID[now.getDay()]}, ${now.getDate()} ${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}` : "";

    if (variant === "hero") {
        return (
            <div className="text-center" suppressHydrationWarning>
                <div className="nums font-bold tabular-nums text-4xl md:text-5xl tracking-tight leading-none">{time}</div>
                <div className="text-sm text-muted-foreground mt-1.5">{date}</div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2" suppressHydrationWarning>
            <ClockIcon className="h-5 w-5 text-primary shrink-0" />
            <div className="leading-tight">
                <div className="nums font-bold tabular-nums text-lg md:text-xl leading-none">{time}</div>
                <div className="text-xs text-muted-foreground">{date}</div>
            </div>
        </div>
    );
}
