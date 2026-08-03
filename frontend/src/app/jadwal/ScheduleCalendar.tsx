"use client";

import { useMemo } from "react";
import { MapPin, User as UserIcon, Package, Tag } from "lucide-react";
import type { PublicTimelineEvent } from "@/lib/api/publicTimeline";
import { LiveBadge } from "./LiveBadge";

const DOW_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
type Phase = "departure" | "setup" | "event" | "dismantle";
const PHASE_COLOR: Record<Phase, { solid: string; label: string }> = {
    departure: { solid: "bg-slate-500", label: "Berangkat" },
    setup: { solid: "bg-red-600", label: "Pasang / Setup" },
    event: { solid: "bg-amber-500", label: "Hari Event" },
    dismantle: { solid: "bg-blue-600", label: "Bongkar" },
};
const LEFT_W = 280;
const CELL_W = 40;
const ROW_H = 76;

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function daysBetween(a: Date, b: Date) {
    return Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}
function getPhaseRanges(ev: PublicTimelineEvent): Array<{ phase: Phase; start: Date; end: Date }> {
    const out: Array<{ phase: Phase; start: Date; end: Date }> = [];
    const push = (phase: Phase, s?: string | null, e?: string | null) => {
        if (!s) return; out.push({ phase, start: new Date(s), end: new Date(e ?? s) });
    };
    push("departure", ev.departureStart, ev.departureEnd);
    push("setup", ev.setupStart, ev.setupEnd);
    push("event", ev.eventStart, ev.eventEnd);
    push("dismantle", ev.loadingStart, ev.loadingEnd);
    return out;
}

export function ScheduleCalendar({ events, year, month }: { events: PublicTimelineEvent[]; year: number; month: number }) {
    const today = new Date();
    const range = useMemo(
        () => ({ start: new Date(year, month - 1, 1), days: new Date(year, month, 0).getDate() }),
        [year, month],
    );
    const dayCells = useMemo(() => Array.from({ length: range.days }, (_, i) => {
        const d = new Date(range.start); d.setDate(d.getDate() + i);
        return {
            idx: i, date: d, day: d.getDate(), dow: DOW_ID[d.getDay()],
            isToday: startOfDay(d).getTime() === startOfDay(today).getTime(),
            isWeekend: d.getDay() === 0 || d.getDay() === 6,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [range]);
    const filtered = useMemo(
        () => events.filter((e) => getPhaseRanges(e).some((r) => r.end >= range.start && daysBetween(range.start, r.start) < range.days)),
        [events, range],
    );

    if (filtered.length === 0) {
        return <div className="py-20 text-center text-lg text-muted-foreground">Tidak ada event di bulan ini.</div>;
    }

    return (
        <>
            <table className="border-collapse min-w-max">
                <thead className="sticky top-0 bg-card z-20">
                    <tr className="border-b-2 border-border">
                        <th className="text-left text-base font-bold px-3 py-3 sticky left-0 bg-card border-r-2 border-border" style={{ width: LEFT_W, minWidth: LEFT_W }}>
                            Event & Barang
                        </th>
                        {dayCells.map((d) => (
                            <th
                                key={d.idx}
                                className={`text-center py-2 border-l border-border/50 ${d.isToday ? "bg-primary/15 animate-breathe" : d.isWeekend ? "bg-muted/40" : ""}`}
                                style={{ width: CELL_W, minWidth: CELL_W }}
                            >
                                <div className="text-xs text-muted-foreground leading-none">{d.dow}</div>
                                <div className={`text-lg font-bold leading-tight ${d.isToday ? "text-primary" : ""}`}>{d.day}</div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {filtered.map((ev) => (
                        <EventRow key={ev.id} ev={ev} dayCells={dayCells} rangeStart={range.start} rangeDays={range.days} />
                    ))}
                </tbody>
            </table>
            {/* Legend fase */}
            <div className="w-full px-4 md:px-6 py-3 border-t-2 border-border bg-muted/20 flex flex-wrap items-center gap-x-5 gap-y-2 text-base">
                <span className="font-semibold text-muted-foreground">Warna:</span>
                {(Object.keys(PHASE_COLOR) as Phase[]).map((p) => (
                    <span key={p} className="flex items-center gap-2">
                        <span className={`inline-block w-4 h-4 rounded ${PHASE_COLOR[p].solid}`} />
                        {PHASE_COLOR[p].label}
                    </span>
                ))}
            </div>
        </>
    );
}

function EventRow({ ev, dayCells, rangeStart, rangeDays }: {
    ev: PublicTimelineEvent;
    dayCells: Array<{ idx: number; isToday: boolean; isWeekend: boolean }>;
    rangeStart: Date; rangeDays: number;
}) {
    const dayPhase = new Map<number, Phase>();
    const order: Record<Phase, number> = { event: 4, setup: 3, dismantle: 2, departure: 1 };
    getPhaseRanges(ev).forEach((r) => {
        const s = Math.max(0, daysBetween(rangeStart, r.start));
        const e = Math.min(rangeDays - 1, daysBetween(rangeStart, r.end));
        for (let d = s; d <= e; d++) {
            const cur = dayPhase.get(d);
            if (!cur || order[r.phase] > order[cur]) dayPhase.set(d, r.phase);
        }
    });

    const pic = ev.picWorker?.name ?? ev.picName;

    return (
        <tr className="border-b-2 border-border/60 align-top">
            <td className="px-3 py-2.5 sticky left-0 bg-card border-r-2 border-border" style={{ width: LEFT_W, minWidth: LEFT_W, height: ROW_H }}>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base md:text-lg leading-snug">{ev.name}</span>
                    {ev.status === "IN_PROGRESS" && <LiveBadge />}
                </div>
                {ev.venue && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1"><MapPin className="h-4 w-4 shrink-0" />{ev.venue}</div>
                )}
                {pic && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1.5"><UserIcon className="h-4 w-4 shrink-0" /><span className="font-semibold text-foreground">{pic}</span></div>
                )}
                {ev.productCategory?.trim() && (
                    <div className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
                        <Tag className="h-4 w-4 shrink-0" />{ev.productCategory}
                    </div>
                )}
                {ev.teams.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                        {ev.teams.map((t) => (
                            <span key={t.id} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: t.color + "22", color: t.color }}>
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />{t.name}
                            </span>
                        ))}
                    </div>
                )}
                {ev.orderDescription ? (
                    <div className="mt-1.5 flex items-start gap-1.5 text-sm bg-primary/5 border border-primary/20 rounded-lg px-2 py-1.5 leading-relaxed">
                        <Package className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                        <span className="whitespace-pre-line">{ev.orderDescription}</span>
                    </div>
                ) : (
                    <div className="text-sm text-muted-foreground italic mt-1.5">Order belum diisi</div>
                )}
            </td>
            {dayCells.map((d) => {
                const phase = dayPhase.get(d.idx);
                return (
                    <td
                        key={d.idx}
                        className={`p-0 border-l border-border/50 ${d.isToday ? "bg-primary/10" : d.isWeekend ? "bg-muted/30" : ""}`}
                        style={{ width: CELL_W, minWidth: CELL_W, height: ROW_H }}
                    >
                        {phase && (
                            <div
                                className={`${PHASE_COLOR[phase].solid} h-[60%] my-[20%] mx-0.5 rounded animate-grow`}
                                style={{ animationDelay: `${Math.min(d.idx, 20) * 20}ms` }}
                                title={`${PHASE_COLOR[phase].label} — ${ev.name}`}
                            />
                        )}
                    </td>
                );
            })}
        </tr>
    );
}
