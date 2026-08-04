"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, User as UserIcon, Package, Tag, CalendarDays } from "lucide-react";
import { brandColorOf, brandLabelOf, type PublicTimelineEvent } from "@/lib/api/publicTimeline";
import { LiveBadge } from "./LiveBadge";
import { CrewCards } from "./CrewCards";

const DOW_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
type Phase = "departure" | "setup" | "event" | "dismantle";
const PHASE_COLOR: Record<Phase, { solid: string; label: string }> = {
    departure: { solid: "bg-slate-500", label: "Berangkat" },
    setup: { solid: "bg-red-600", label: "Pasang / Setup" },
    event: { solid: "bg-amber-500", label: "Hari Event" },
    dismantle: { solid: "bg-blue-600", label: "Bongkar" },
};
const LEFT_W = 280;
const MAX_CELL = 40;   // lebar kolom hari maksimum (rentang pendek)
const MIN_CELL = 4;    // minimum saat rentang panjang
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

export function ScheduleCalendar({ events, year, month, months = 1 }: { events: PublicTimelineEvent[]; year: number; month: number; months?: number }) {
    const today = new Date();
    const rootRef = useRef<HTMLDivElement>(null);
    const [containerW, setContainerW] = useState(0);

    // Ukur lebar kontainer → auto-fit kolom agar seluruh rentang muat.
    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        const measure = () => setContainerW(el.clientWidth);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const range = useMemo(() => {
        const start = new Date(year, month - 1, 1);
        const endEx = new Date(year, month - 1 + months, 1);
        const days = Math.round((endEx.getTime() - start.getTime()) / 86400000);
        return { start, days };
    }, [year, month, months]);

    // Lebar kolom hari: pas-kan ke layar (kurangi kolom kiri), dibatasi MIN..MAX.
    const cellW = useMemo(() => {
        if (!containerW) return Math.min(MAX_CELL, months <= 1 ? MAX_CELL : 24);
        const fit = Math.floor((containerW - LEFT_W - 2) / range.days);
        return Math.max(MIN_CELL, Math.min(MAX_CELL, fit));
    }, [containerW, range.days, months]);
    // Angka tanggal SELALU ada, tapi diberi jarak agar tak berdesakan saat sempit:
    // kolom lebar → tiap hari; sedang → tiap 5 hari; sempit → tiap 10 hari.
    const stepDays = cellW >= 20 ? 1 : cellW >= 9 ? 5 : 10;

    const dayCells = useMemo(() => Array.from({ length: range.days }, (_, i) => {
        const d = new Date(range.start); d.setDate(d.getDate() + i);
        return {
            idx: i, date: d, day: d.getDate(), dow: DOW_ID[d.getDay()],
            isToday: startOfDay(d).getTime() === startOfDay(today).getTime(),
            isWeekend: d.getDay() === 0 || d.getDay() === 6,
            isMonthStart: d.getDate() === 1,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [range]);

    // Segmen bulan untuk pita label atas (colSpan = jumlah hari bulan itu).
    const monthSegments = useMemo(() => {
        const segs: Array<{ label: string; days: number }> = [];
        let m = new Date(range.start);
        let remaining = range.days;
        while (remaining > 0) {
            const dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
            const take = Math.min(dim, remaining);
            segs.push({ label: `${MONTHS_ID[m.getMonth()]} ${m.getFullYear()}`, days: take });
            remaining -= take;
            m = new Date(m.getFullYear(), m.getMonth() + 1, 1);
        }
        return segs;
    }, [range]);

    const filtered = useMemo(
        () => events.filter((e) => getPhaseRanges(e).some((r) => r.end >= range.start && daysBetween(range.start, r.start) < range.days)),
        [events, range],
    );

    return (
        <div ref={rootRef} className="w-full">
            {filtered.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground animate-fade">
                    <CalendarDays className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50 animate-float" />
                    <p className="text-lg">Tidak ada event di rentang ini.</p>
                </div>
            ) : (
                <>
                    <table className="border-collapse w-full" style={{ minWidth: LEFT_W + range.days * cellW }}>
                        <thead className="sticky top-0 bg-card z-20">
                            {/* Pita label bulan */}
                            <tr className="border-b border-border">
                                <th rowSpan={2} className="text-left text-base font-bold px-3 sticky left-0 bg-card border-r-2 border-border z-10" style={{ width: LEFT_W, minWidth: LEFT_W }}>
                                    Event & Barang
                                </th>
                                {monthSegments.map((s, i) => (
                                    <th key={i} colSpan={s.days} className="text-center text-sm font-bold text-primary py-1.5 border-l-2 border-l-primary/50 bg-primary/5 whitespace-nowrap">
                                        {s.label}
                                    </th>
                                ))}
                            </tr>
                            {/* Baris hari */}
                            <tr className="border-b-2 border-border">
                                {dayCells.map((d) => {
                                    const showNum = stepDays === 1 || d.isToday || d.day === 1 || d.day % stepDays === 0;
                                    return (
                                        <th
                                            key={d.idx}
                                            className={`text-center align-bottom overflow-visible ${d.isMonthStart ? "border-l-2 border-l-primary/50" : "border-l border-border/40"} ${d.isToday ? "bg-primary/15 animate-breathe" : d.isWeekend ? "bg-muted/40" : ""}`}
                                            style={{ width: cellW, minWidth: cellW }}
                                        >
                                            {stepDays === 1 && <div className="text-[10px] text-muted-foreground leading-none">{d.dow}</div>}
                                            {showNum ? (
                                                <div className={`font-bold leading-tight whitespace-nowrap ${stepDays === 1 ? "text-sm" : "text-[11px]"} ${d.isToday ? "text-primary" : ""}`}>{d.day}</div>
                                            ) : (
                                                <div className="h-4" />
                                            )}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((ev, i) => (
                                <EventRow key={ev.id} ev={ev} dayCells={dayCells} rangeStart={range.start} rangeDays={range.days} rowIndex={i} cellW={cellW} />
                            ))}
                        </tbody>
                    </table>
                    {/* Legend fase */}
                    <div className="w-full px-4 md:px-6 py-3 border-t-2 border-border bg-muted/20 flex flex-wrap items-center gap-x-5 gap-y-2 text-base animate-fade">
                        <span className="font-semibold text-muted-foreground">Warna:</span>
                        {(Object.keys(PHASE_COLOR) as Phase[]).map((p) => (
                            <span key={p} className="flex items-center gap-2">
                                <span className={`inline-block w-4 h-4 rounded animate-breathe ${PHASE_COLOR[p].solid}`} />
                                {PHASE_COLOR[p].label}
                            </span>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function EventRow({ ev, dayCells, rangeStart, rangeDays, rowIndex, cellW }: {
    ev: PublicTimelineEvent;
    dayCells: Array<{ idx: number; isToday: boolean; isWeekend: boolean; isMonthStart: boolean }>;
    rangeStart: Date; rangeDays: number; rowIndex: number; cellW: number;
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
    const brandColor = brandColorOf(ev);

    return (
        <tr className="border-b-2 border-border/60 align-top animate-fade" style={{ animationDelay: `${Math.min(rowIndex, 12) * 60}ms` }}>
            <td
                className="px-3 py-2.5 sticky left-0 bg-card border-r-2 border-border z-10"
                style={{
                    width: LEFT_W,
                    minWidth: LEFT_W,
                    height: ROW_H,
                    // Aksen kiri + tint warna brand. Gradient dipakai agar tint menumpuk di
                    // atas bg-card yang OPAQUE (kalau pakai backgroundColor transparan, konten
                    // yang scroll di belakang kolom sticky ini akan tembus).
                    borderLeft: `4px solid ${brandColor}`,
                    backgroundImage: `linear-gradient(${brandColor}0D, ${brandColor}0D)`,
                }}
            >
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base md:text-lg leading-snug">{ev.name}</span>
                    <span
                        className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: brandColor + "1F", color: brandColor }}
                    >
                        {brandLabelOf(ev)}
                    </span>
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
                                <span className="w-2 h-2 rounded-full animate-breathe" style={{ backgroundColor: t.color }} />{t.name}
                            </span>
                        ))}
                    </div>
                )}
                <CrewCards ev={ev} variant="compact" />
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
                        className={`p-0 ${d.isMonthStart ? "border-l-2 border-l-primary/40" : "border-l border-border/40"} ${d.isToday ? "bg-primary/10" : d.isWeekend ? "bg-muted/30" : ""}`}
                        style={{ width: cellW, minWidth: cellW, height: ROW_H }}
                    >
                        {phase && (
                            <div
                                className={`${PHASE_COLOR[phase].solid} h-[60%] my-[20%] mx-px rounded-sm animate-bar`}
                                style={{ animationDelay: `${(d.idx % 14) * 90}ms` }}
                                title={`${PHASE_COLOR[phase].label} — ${ev.name}`}
                            />
                        )}
                    </td>
                );
            })}
        </tr>
    );
}
