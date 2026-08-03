"use client";

import { Users } from "lucide-react";
import type { PublicTimelineEvent } from "@/lib/api/publicTimeline";

type Person = {
    id: number;
    name: string;
    sub: string;     // role / posisi / "Crew"
    color: string | null;
    isPic: boolean;
};

function initials(name: string) {
    const p = name.trim().split(/\s+/);
    return (((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase()) || "?";
}

// Gabung PIC utama + crew jadi satu daftar orang, tanpa duplikat.
function buildPeople(ev: PublicTimelineEvent): Person[] {
    const people: Person[] = [];
    const seen = new Set<number>();

    if (ev.picWorker) {
        people.push({ id: ev.picWorker.id, name: ev.picWorker.name, sub: "PIC", color: null, isPic: true });
        seen.add(ev.picWorker.id);
    } else if (ev.picName) {
        people.push({ id: -1, name: ev.picName, sub: "PIC", color: null, isPic: true });
    }

    for (const c of ev.crew ?? []) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        people.push({
            id: c.id,
            name: c.name,
            sub: c.role || c.position || "Crew",
            color: c.team?.color ?? null,
            isPic: false,
        });
    }
    return people;
}

function Avatar({ p, size = "md" }: { p: Person; size?: "sm" | "md" }) {
    const dim = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
    const style = p.color
        ? { backgroundColor: p.color + "26", color: p.color }
        : undefined;
    return (
        <span className="relative inline-flex shrink-0">
            {p.isPic && <span aria-hidden className="animate-pulse-ring absolute inset-0 rounded-full bg-primary/40" />}
            <span
                className={`relative inline-flex items-center justify-center rounded-full font-bold ring-2 ring-background ${dim} ${p.color ? "" : "bg-primary/15 text-primary"}`}
                style={style}
            >
                {initials(p.name)}
            </span>
        </span>
    );
}

/** Kartu PIC + crew per event. variant "full" (daftar) / "compact" (kalender). */
export function CrewCards({ ev, variant = "full" }: { ev: PublicTimelineEvent; variant?: "full" | "compact" }) {
    const people = buildPeople(ev);
    if (people.length === 0) return null;

    if (variant === "compact") {
        // Chip nama LENGKAP (jangan disingkat) — titik warna tim + nama utuh.
        return (
            <div className="flex flex-wrap gap-1 mt-1.5">
                {people.map((p, i) => (
                    <span
                        key={p.id}
                        className="animate-in inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border border-border bg-background/60"
                        style={{ animationDelay: `${Math.min(i, 14) * 55}ms` }}
                    >
                        <span
                            className={`w-2 h-2 rounded-full shrink-0 ${p.isPic ? "animate-breathe" : ""} ${p.color ? "" : "bg-primary"}`}
                            style={p.color ? { backgroundColor: p.color } : undefined}
                        />
                        <span>{p.name}</span>
                        {p.isPic && <span className="text-primary font-semibold">· PIC</span>}
                    </span>
                ))}
            </div>
        );
    }

    return (
        <div className="mt-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                <Users className="h-3.5 w-3.5" /> PIC &amp; Crew
                <span className="text-muted-foreground/70">({people.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {people.map((p, i) => (
                    <div
                        key={p.id}
                        className="animate-in flex items-center gap-2 rounded-lg border border-border bg-background/60 pl-1.5 pr-3 py-1.5 transition-all hover:shadow-md hover:-translate-y-0.5"
                        style={{ animationDelay: `${Math.min(i, 14) * 55}ms` }}
                    >
                        <Avatar p={p} />
                        <div className="leading-tight">
                            <div className="text-sm font-semibold">{p.name}</div>
                            <div className={`text-[11px] ${p.isPic ? "text-primary font-medium" : "text-muted-foreground"}`}>{p.sub}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
