"use client";

import { useMemo } from "react";
import { MapPin, User as UserIcon, Package, CalendarDays } from "lucide-react";
import type { PublicTimelineEvent } from "@/lib/api/publicTimeline";
import { LiveBadge } from "./LiveBadge";
import { CrewCards } from "./CrewCards";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function fmt(d?: string | null) {
    if (!d) return null;
    const x = new Date(d);
    return `${x.getDate()} ${MONTHS_SHORT[x.getMonth()]}`;
}
function eventDateLabel(ev: PublicTimelineEvent): string {
    const s = ev.eventStart ?? ev.setupStart ?? ev.departureStart;
    const e = ev.eventEnd ?? ev.eventStart ?? s;
    const a = fmt(s), b = fmt(e);
    if (!a) return "Tanggal belum diisi";
    return b && b !== a ? `${a} – ${b}` : a;
}
function sortKey(ev: PublicTimelineEvent): number {
    const s = ev.eventStart ?? ev.setupStart ?? ev.departureStart;
    return s ? new Date(s).getTime() : Number.MAX_SAFE_INTEGER;
}

const BRAND_LABEL: Record<string, string> = { EXINDO: "Exindo", XPOSER: "Xposer", OTHER: "Lainnya" };

export function ScheduleList({ events }: { events: PublicTimelineEvent[] }) {
    const sorted = useMemo(() => [...events].sort((a, b) => sortKey(a) - sortKey(b)), [events]);
    if (sorted.length === 0) {
        return (
            <div className="py-20 text-center text-muted-foreground animate-fade">
                <CalendarDays className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50 animate-float" />
                <p className="text-lg">Tidak ada event di bulan ini.</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto p-4 space-y-3">
            {sorted.map((ev, i) => {
                const pic = ev.picWorker?.name ?? ev.picName;
                return (
                    <div
                        key={ev.id}
                        className="rounded-xl border-2 border-border bg-card p-4 animate-in transition-shadow hover:shadow-md"
                        style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-lg leading-snug">{ev.name}</h3>
                                {ev.status === "IN_PROGRESS" && <LiveBadge />}
                            </div>
                            <span className="shrink-0 text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">{BRAND_LABEL[ev.brand] ?? ev.brand}</span>
                        </div>
                        <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5 font-semibold text-foreground"><CalendarDays className="h-4 w-4 shrink-0" />{eventDateLabel(ev)}</span>
                            {ev.venue && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0" />{ev.venue}</span>}
                            {pic && <span className="flex items-center gap-1.5"><UserIcon className="h-4 w-4 shrink-0" /><span className="font-medium text-foreground">{pic}</span></span>}
                        </div>
                        {ev.teams.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {ev.teams.map((t) => (
                                    <span key={t.id} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: t.color + "22", color: t.color }}>
                                        <span className="w-2 h-2 rounded-full animate-breathe" style={{ backgroundColor: t.color }} />{t.name}
                                    </span>
                                ))}
                            </div>
                        )}
                        {ev.orderDescription && (
                            <div className="mt-2 flex items-start gap-1.5 text-sm bg-primary/5 border border-primary/20 rounded-lg px-2 py-1.5">
                                <Package className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                                <span className="whitespace-pre-line">{ev.orderDescription}</span>
                            </div>
                        )}
                        <CrewCards ev={ev} />
                    </div>
                );
            })}
        </div>
    );
}
