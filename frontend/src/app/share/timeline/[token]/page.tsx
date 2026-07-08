"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, User as UserIcon, Package, Loader2, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { getPublicTimeline, type PublicTimelineEvent } from "@/lib/api/publicTimeline";

const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const DOW_ID = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];

type Phase = "departure" | "setup" | "event" | "dismantle";
const PHASE_COLOR: Record<Phase, { solid: string; label: string }> = {
    departure: { solid: "bg-slate-400",  label: "Berangkat" },
    setup:     { solid: "bg-red-500",    label: "Setup" },
    event:     { solid: "bg-yellow-400", label: "Event" },
    dismantle: { solid: "bg-blue-500",   label: "Bongkar" },
};

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function daysBetween(a: Date, b: Date) {
    return Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}
function getPhaseRanges(ev: PublicTimelineEvent): Array<{ phase: Phase; start: Date; end: Date }> {
    const out: Array<{ phase: Phase; start: Date; end: Date }> = [];
    const push = (phase: Phase, s?: string | null, e?: string | null) => {
        if (!s) return; out.push({ phase, start: new Date(s), end: new Date(e ?? s) });
    };
    push("departure", ev.departureStart, ev.departureEnd);
    push("setup",     ev.setupStart,     ev.setupEnd);
    push("event",     ev.eventStart,     ev.eventEnd);
    push("dismantle", ev.loadingStart,   ev.loadingEnd);
    return out;
}

export default function PublicTimelinePage() {
    const params = useParams<{ token: string }>();
    const token = params.token;
    const today = new Date();
    const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;

    const { data: events = [], isLoading, error } = useQuery({
        queryKey: ["public-timeline", token, year, month],
        queryFn: () => getPublicTimeline(token, year, month),
        retry: false,
    });

    const range = useMemo(() => {
        const start = new Date(year, month - 1, 1);
        const days = new Date(year, month, 0).getDate();
        return { start, days, cellW: 26, label: `${MONTHS_ID[month - 1]} ${year}` };
    }, [year, month]);

    const dayCells = useMemo(() => Array.from({ length: range.days }, (_, i) => {
        const d = new Date(range.start); d.setDate(d.getDate() + i);
        return {
            idx: i, date: d, day: d.getDate(), dow: DOW_ID[d.getDay()],
            isToday: startOfDay(d).getTime() === startOfDay(today).getTime(),
            isWeekend: d.getDay() === 0 || d.getDay() === 6,
        };
    }), [range, today]);

    const filtered = useMemo(() => events.filter((e) =>
        getPhaseRanges(e).some((r) => r.end >= range.start && daysBetween(range.start, r.start) < range.days)
    ), [events, range]);

    const shift = (delta: number) => setCursor(new Date(year, month - 1 + delta, 1));

    // Link dicabut / token salah → tampilkan halaman terkunci
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-background">
                <div className="max-w-sm text-center space-y-2">
                    <Lock className="h-8 w-8 text-muted-foreground mx-auto" />
                    <h1 className="text-lg font-bold">Link tidak tersedia</h1>
                    <p className="text-sm text-muted-foreground">Link timeline tidak valid atau sudah dicabut. Minta link baru ke admin.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header ringkas */}
            <div className="sticky top-0 z-30 bg-card border-b px-4 py-3 flex items-center justify-between gap-2">
                <div>
                    <h1 className="text-base font-bold flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> Jadwal Event</h1>
                    <p className="text-[11px] text-muted-foreground">Barang yang dikerjakan tiap event</p>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => shift(-1)} className="p-1.5 rounded border hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
                    <span className="text-sm font-semibold min-w-[7.5rem] text-center">{range.label}</span>
                    <button onClick={() => shift(1)} className="p-1.5 rounded border hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
                </div>
            </div>

            {isLoading ? (
                <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Memuat…</div>
            ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Tidak ada event di bulan ini.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="border-collapse min-w-max">
                        <thead className="sticky top-[57px] bg-card z-20">
                            <tr className="border-b">
                                <th className="text-left text-[11px] font-semibold px-2 py-2 sticky left-0 bg-card border-r" style={{ width: 210 }}>Event & Order</th>
                                {dayCells.map((d) => (
                                    <th key={d.idx} className={`text-center py-1 border-l border-border/40 ${d.isToday ? "bg-info/15" : d.isWeekend ? "bg-muted/30" : ""}`} style={{ width: range.cellW, minWidth: range.cellW }}>
                                        <div className="text-[9px] text-muted-foreground leading-none">{d.dow}</div>
                                        <div className="text-xs font-bold leading-tight">{d.day}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((ev) => (
                                <PublicEventRow key={ev.id} ev={ev} dayCells={dayCells} rangeStart={range.start} rangeDays={range.days} cellW={range.cellW} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t bg-muted/10 text-[11px]">
                {(Object.keys(PHASE_COLOR) as Phase[]).map((p) => (
                    <span key={p} className="flex items-center gap-1"><span className={`inline-block w-3 h-3 rounded-sm ${PHASE_COLOR[p].solid}`} />{PHASE_COLOR[p].label}</span>
                ))}
            </div>
        </div>
    );
}

// Baris event: kolom kiri "atas-bawah" (nama event + order description), lalu bar fase.
function PublicEventRow({ ev, dayCells, rangeStart, rangeDays, cellW }: {
    ev: PublicTimelineEvent;
    dayCells: Array<{ idx: number; date: Date; isToday: boolean; isWeekend: boolean }>;
    rangeStart: Date; rangeDays: number; cellW: number;
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
        <tr className="border-b border-border/50 align-top">
            <td className="px-2 py-2 sticky left-0 bg-card border-r" style={{ width: 210 }}>
                {/* ATAS: nama event + venue + PIC */}
                <div className="font-semibold text-xs leading-tight">{ev.name}</div>
                {ev.venue && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5"><MapPin className="h-2.5 w-2.5 shrink-0" />{ev.venue}</div>
                )}
                {pic && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-0.5"><UserIcon className="h-2.5 w-2.5 shrink-0" />{pic}</div>
                )}
                {/* BAWAH: order description (produk yang dipesan, dari Lead) */}
                {ev.orderDescription ? (
                    <div className="mt-1 flex items-start gap-1 text-[10px] bg-muted/60 rounded px-1.5 py-1 leading-snug">
                        <Package className="h-2.5 w-2.5 shrink-0 mt-0.5 text-muted-foreground" />
                        <span className="whitespace-pre-line">{ev.orderDescription}</span>
                    </div>
                ) : (
                    <div className="text-[9px] text-muted-foreground italic mt-1">Order belum diisi</div>
                )}
            </td>
            {dayCells.map((d) => {
                const phase = dayPhase.get(d.idx);
                return (
                    <td key={d.idx} className={`p-0 border-l border-border/40 ${d.isToday ? "bg-info/10" : d.isWeekend ? "bg-muted/20" : ""}`} style={{ width: cellW, minWidth: cellW, height: 48 }}>
                        {phase && <div className={`${PHASE_COLOR[phase].solid} h-[68%] my-[16%]`} title={PHASE_COLOR[phase].label} />}
                    </td>
                );
            })}
        </tr>
    );
}
