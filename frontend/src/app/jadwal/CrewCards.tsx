"use client";

import { Users } from "lucide-react";
import type { PublicTimelineEvent } from "@/lib/api/publicTimeline";

type Kind = "marketing" | "pic" | "crew";
type Person = {
    key: string;
    name: string;
    sub: string;         // label peran
    color: string | null; // warna tim (khusus crew)
    kind: Kind;
};

function initials(name: string) {
    const p = name.trim().split(/\s+/);
    return (((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase()) || "?";
}

// Gabung Marketing + PIC + crew jadi satu daftar. Marketing & PIC ditonjolkan.
function buildPeople(ev: PublicTimelineEvent): Person[] {
    const people: Person[] = [];

    if (ev.marketing) {
        people.push({ key: `mkt-${ev.marketing.id}`, name: ev.marketing.name, sub: "Marketing", color: null, kind: "marketing" });
    }

    const seen = new Set<number>();
    if (ev.picWorker) {
        people.push({ key: `pic-${ev.picWorker.id}`, name: ev.picWorker.name, sub: "PIC", color: null, kind: "pic" });
        seen.add(ev.picWorker.id);
    } else if (ev.picName) {
        people.push({ key: "pic-name", name: ev.picName, sub: "PIC", color: null, kind: "pic" });
    }

    for (const c of ev.crew ?? []) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        people.push({
            key: `crew-${c.id}`,
            name: c.name,
            sub: c.role || c.position || "Crew",
            color: c.team?.color ?? null,
            kind: "crew",
        });
    }
    return people;
}

// Warna avatar/titik per jenis.
function dotStyle(p: Person): { style?: React.CSSProperties; cls: string } {
    if (p.kind === "marketing") return { cls: "bg-amber-500" };
    if (p.kind === "crew" && p.color) return { style: { backgroundColor: p.color }, cls: "" };
    return { cls: "bg-primary" }; // pic, atau crew tanpa warna tim
}
function avatarStyle(p: Person): { style?: React.CSSProperties; cls: string } {
    if (p.kind === "marketing") return { cls: "bg-amber-500/20 text-amber-600" };
    if (p.kind === "crew" && p.color) return { style: { backgroundColor: p.color + "26", color: p.color }, cls: "" };
    return { cls: "bg-primary/15 text-primary" };
}
function subCls(p: Person) {
    if (p.kind === "marketing") return "text-amber-600 font-semibold";
    if (p.kind === "pic") return "text-primary font-medium";
    return "text-muted-foreground";
}

function Avatar({ p }: { p: Person }) {
    const a = avatarStyle(p);
    const highlight = p.kind !== "crew"; // marketing & pic diberi cincin denyut
    return (
        <span className="relative inline-flex shrink-0">
            {highlight && (
                <span aria-hidden className={`animate-pulse-ring absolute inset-0 rounded-full ${p.kind === "marketing" ? "bg-amber-500/40" : "bg-primary/40"}`} />
            )}
            <span className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ring-2 ring-background ${a.cls}`} style={a.style}>
                {initials(p.name)}
            </span>
        </span>
    );
}

/** Kartu Marketing + PIC + crew per event. variant "full" (daftar) / "compact" (kalender). */
export function CrewCards({ ev, variant = "full" }: { ev: PublicTimelineEvent; variant?: "full" | "compact" }) {
    const people = buildPeople(ev);
    if (people.length === 0) return null;

    if (variant === "compact") {
        // Chip nama LENGKAP — titik warna + label peran singkat.
        return (
            <div className="flex flex-wrap gap-1 mt-1.5">
                {people.map((p, i) => {
                    const d = dotStyle(p);
                    return (
                        <span
                            key={p.key}
                            className="animate-in inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border border-border bg-background/60"
                            style={{ animationDelay: `${Math.min(i, 14) * 55}ms` }}
                        >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${p.kind !== "crew" ? "animate-breathe" : ""} ${d.cls}`} style={d.style} />
                            <span>{p.name}</span>
                            {p.kind !== "crew" && <span className={subCls(p)}>· {p.sub}</span>}
                        </span>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="mt-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                <Users className="h-3.5 w-3.5" /> Penanggung Jawab &amp; Tim
                <span className="text-muted-foreground/70">({people.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {people.map((p, i) => (
                    <div
                        key={p.key}
                        className="animate-in flex items-center gap-2 rounded-lg border border-border bg-background/60 pl-1.5 pr-3 py-1.5 transition-all hover:shadow-md hover:-translate-y-0.5"
                        style={{ animationDelay: `${Math.min(i, 14) * 55}ms` }}
                    >
                        <Avatar p={p} />
                        <div className="leading-tight">
                            <div className="text-sm font-semibold">{p.name}</div>
                            <div className={`text-[11px] ${subCls(p)}`}>{p.sub}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
