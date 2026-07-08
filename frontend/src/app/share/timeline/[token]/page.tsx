"use client";

import { Suspense, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, User as UserIcon, Package, Loader2, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { getPublicTimeline, type PublicTimelineEvent } from "@/lib/api/publicTimeline";

const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const DOW_ID = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];

type Phase = "departure" | "setup" | "event" | "dismantle";
const PHASE_COLOR: Record<Phase, { solid: string; label: string }> = {
    departure: { solid: "bg-slate-500",  label: "Berangkat" },
    setup:     { solid: "bg-red-600",    label: "Pasang / Setup" },
    event:     { solid: "bg-amber-500",  label: "Hari Event" },
    dismantle: { solid: "bg-blue-600",   label: "Bongkar" },
};

// Ukuran grid — dibesarkan supaya jelas di semua perangkat.
const LEFT_W = 280;   // lebar kolom kiri (nama event + order)
const CELL_W = 40;    // lebar 1 kolom hari
const ROW_H = 76;     // tinggi baris event

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
    return (
        <Suspense fallback={<div className="min-h-screen w-full flex items-center justify-center text-lg text-muted-foreground"><Loader2 className="h-7 w-7 animate-spin mr-2" /> Memuat…</div>}>
            <PublicTimelineInner />
        </Suspense>
    );
}

function PublicTimelineInner() {
    const params = useParams<{ token: string }>();
    const token = params.token;
    const searchParams = useSearchParams();
    const parseIds = (v: string | null) => v ? v.split(",").map(Number).filter((n) => Number.isFinite(n)) : [];
    const teamIds = parseIds(searchParams.get("team"));
    const picIds = parseIds(searchParams.get("pic"));
    const teamKey = teamIds.join(",");
    const picKey = picIds.join(",");
    const today = new Date();
    const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;

    const { data: events = [], isLoading, error } = useQuery({
        queryKey: ["public-timeline", token, year, month, teamKey, picKey],
        queryFn: () => getPublicTimeline(token, year, month, { teamIds, picIds }),
        retry: false,
    });

    // Label filter aktif (nama team & PIC) — diambil dari data event.
    const filterLabel = useMemo(() => {
        if (!teamIds.length && !picIds.length) return null;
        const teamNames = new Set<string>();
        const picNames = new Set<string>();
        for (const e of events) {
            e.teams.forEach((t) => { if (teamIds.includes(t.id)) teamNames.add(t.name); });
            if (e.picWorker && picIds.includes(e.picWorker.id) && e.picWorker.name) picNames.add(e.picWorker.name);
        }
        const parts: string[] = [];
        if (teamIds.length) parts.push(`Team: ${teamNames.size ? Array.from(teamNames).join(", ") : "—"}`);
        if (picIds.length) parts.push(`PIC: ${picNames.size ? Array.from(picNames).join(", ") : "—"}`);
        return parts.join(" · ");
    }, [events, teamKey, picKey]);

    const range = useMemo(() => {
        const start = new Date(year, month - 1, 1);
        const days = new Date(year, month, 0).getDate();
        return { start, days };
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

    // Link dicabut / token salah → halaman terkunci (huruf besar)
    if (error) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-6 bg-background">
                <div className="max-w-md text-center space-y-3">
                    <Lock className="h-12 w-12 text-muted-foreground mx-auto" />
                    <h1 className="text-2xl font-bold">Link tidak tersedia</h1>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Link timeline tidak valid atau sudah dicabut. Silakan minta link baru ke admin/kantor.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-full bg-background text-foreground flex flex-col">
            {/* ── Header sticky, full width, huruf besar ── */}
            <header className="shrink-0 bg-card border-b-2 border-border">
                <div className="w-full px-4 md:px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                        <CalendarDays className="h-7 w-7 text-primary shrink-0" />
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold leading-tight">Jadwal Event</h1>
                            <p className="text-sm md:text-base text-muted-foreground">
                                {filterLabel
                                    ? <>Khusus <span className="font-semibold text-foreground">{filterLabel}</span></>
                                    : "Timeline & barang yang dikerjakan"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => shift(-1)} aria-label="Bulan sebelumnya" className="h-11 w-11 inline-flex items-center justify-center rounded-lg border-2 border-border hover:bg-muted active:scale-95 transition">
                            <ChevronLeft className="h-6 w-6" />
                        </button>
                        <span className="text-lg md:text-xl font-bold min-w-[9.5rem] text-center">{MONTHS_ID[month - 1]} {year}</span>
                        <button onClick={() => shift(1)} aria-label="Bulan berikutnya" className="h-11 w-11 inline-flex items-center justify-center rounded-lg border-2 border-border hover:bg-muted active:scale-95 transition">
                            <ChevronRight className="h-6 w-6" />
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Gantt (mengisi sisa layar, scroll bila perlu) ── */}
            <div className="flex-1 overflow-auto">
                {isLoading ? (
                    <div className="py-20 text-center text-lg text-muted-foreground">
                        <Loader2 className="h-7 w-7 animate-spin inline mr-2 align-middle" /> Memuat jadwal…
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-20 text-center text-lg text-muted-foreground">Tidak ada event di bulan ini.</div>
                ) : (
                    <table className="border-collapse min-w-max">
                        <thead className="sticky top-0 bg-card z-20">
                            <tr className="border-b-2 border-border">
                                <th className="text-left text-base font-bold px-3 py-3 sticky left-0 bg-card border-r-2 border-border" style={{ width: LEFT_W, minWidth: LEFT_W }}>
                                    Event & Barang
                                </th>
                                {dayCells.map((d) => (
                                    <th
                                        key={d.idx}
                                        className={`text-center py-2 border-l border-border/50 ${d.isToday ? "bg-primary/15" : d.isWeekend ? "bg-muted/40" : ""}`}
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
                                <EventRow key={ev.id} ev={ev} dayCells={dayCells} rangeStart={range.start} rangeDays={range.days} today={today} />
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── Legend fase, huruf besar ── */}
            <footer className="shrink-0 w-full px-4 md:px-6 py-3 border-t-2 border-border bg-muted/20">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-base">
                    <span className="font-semibold text-muted-foreground">Warna:</span>
                    {(Object.keys(PHASE_COLOR) as Phase[]).map((p) => (
                        <span key={p} className="flex items-center gap-2">
                            <span className={`inline-block w-4 h-4 rounded ${PHASE_COLOR[p].solid}`} />
                            {PHASE_COLOR[p].label}
                        </span>
                    ))}
                </div>
            </footer>
        </div>
    );
}

// ── Baris event: kolom kiri (nama + order) + bar fase per hari ──
function EventRow({ ev, dayCells, rangeStart, rangeDays, today }: {
    ev: PublicTimelineEvent;
    dayCells: Array<{ idx: number; date: Date; isToday: boolean; isWeekend: boolean }>;
    rangeStart: Date; rangeDays: number; today: Date;
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
                {/* ATAS: nama event + venue + PIC (huruf besar) */}
                <div className="font-bold text-base md:text-lg leading-snug">{ev.name}</div>
                {ev.venue && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1"><MapPin className="h-4 w-4 shrink-0" />{ev.venue}</div>
                )}
                {pic && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1.5"><UserIcon className="h-4 w-4 shrink-0" /><span className="font-semibold text-foreground">{pic}</span></div>
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
                {/* BAWAH: order description (produk yang dipesan) */}
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
                                className={`${PHASE_COLOR[phase].solid} h-[60%] my-[20%] mx-0.5 rounded`}
                                title={`${PHASE_COLOR[phase].label} — ${ev.name}`}
                            />
                        )}
                    </td>
                );
            })}
        </tr>
    );
}
