"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MapPin, User as UserIcon, Package, Tag, CalendarDays, Building2, Megaphone } from "lucide-react";
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

// ── Versi 1: satu kolom kiri menumpuk semua info.
const LEFT_W_V1 = 280;

// ── Versi 2: info dipecah jadi beberapa kolom tetap (tanpa drag).
type ColKey = "name" | "work" | "venue" | "pic" | "client" | "marketing";
const COLUMNS: Array<{ key: ColKey; label: string; icon: typeof MapPin; width: number }> = [
    { key: "name", label: "Nama Event", icon: CalendarDays, width: 190 },
    { key: "work", label: "Pekerjaan", icon: Package, width: 180 },
    { key: "venue", label: "Venue", icon: MapPin, width: 120 },
    { key: "pic", label: "PIC", icon: UserIcon, width: 140 },
    { key: "client", label: "Client", icon: Building2, width: 140 },
    { key: "marketing", label: "Marketing", icon: Megaphone, width: 110 },
];
// Offset kiri kumulatif tiap kolom (untuk sticky left saat grid digeser horizontal).
const COL_OFFSETS = COLUMNS.reduce<number[]>((acc, _c, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + COLUMNS[i - 1].width);
    return acc;
}, []);
const LEFT_W_V2 = COLUMNS.reduce((s, c) => s + c.width, 0);

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

export function ScheduleCalendar({ events, year, month, months = 1, variant = 2 }: { events: PublicTimelineEvent[]; year: number; month: number; months?: number; variant?: 1 | 2 }) {
    const today = new Date();
    const rootRef = useRef<HTMLDivElement>(null);
    const [containerW, setContainerW] = useState(0);
    const leftW = variant === 1 ? LEFT_W_V1 : LEFT_W_V2;

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
        const fit = Math.floor((containerW - leftW - 2) / range.days);
        return Math.max(MIN_CELL, Math.min(MAX_CELL, fit));
    }, [containerW, range.days, months, leftW]);
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
                    <table className="border-collapse w-full" style={{ minWidth: leftW + range.days * cellW }}>
                        <thead className="sticky top-0 z-30 bg-card">
                            {/* Pita label bulan + header kolom kiri */}
                            <tr className="border-b border-border">
                                {variant === 1 ? (
                                    <th rowSpan={2} className="text-left text-base font-bold px-3 sticky left-0 bg-card border-r-2 border-border z-10" style={{ width: LEFT_W_V1, minWidth: LEFT_W_V1, zIndex: 40 }}>
                                        Event & Barang
                                    </th>
                                ) : (
                                    COLUMNS.map((c, i) => {
                                        const Icon = c.icon;
                                        return (
                                            <th
                                                key={c.key}
                                                rowSpan={2}
                                                className={`sticky bg-card align-bottom text-left px-2.5 py-2 border-border ${i === COLUMNS.length - 1 ? "border-r-2" : "border-r"}`}
                                                style={{ width: c.width, minWidth: c.width, left: COL_OFFSETS[i], zIndex: 40 }}
                                            >
                                                <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground uppercase tracking-wide">
                                                    <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />{c.label}
                                                </span>
                                            </th>
                                        );
                                    })
                                )}
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
                                variant === 1
                                    ? <EventRowV1 key={ev.id} ev={ev} dayCells={dayCells} rangeStart={range.start} rangeDays={range.days} rowIndex={i} cellW={cellW} />
                                    : <EventRowV2 key={ev.id} ev={ev} dayCells={dayCells} rangeStart={range.start} rangeDays={range.days} rowIndex={i} cellW={cellW} />
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

// Hitung fase per-hari (dipakai kedua varian): fase prioritas tertinggi menang.
function computeDayPhase(ev: PublicTimelineEvent, rangeStart: Date, rangeDays: number) {
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
    return dayPhase;
}

// Kolom-kolom grid hari (bar fase) — identik kedua varian.
function DayCells({ dayCells, dayPhase, cellW, evName }: {
    dayCells: Array<{ idx: number; isToday: boolean; isWeekend: boolean; isMonthStart: boolean }>;
    dayPhase: Map<number, Phase>; cellW: number; evName: string;
}) {
    return (
        <>
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
                                title={`${PHASE_COLOR[phase].label} — ${evName}`}
                            />
                        )}
                    </td>
                );
            })}
        </>
    );
}

type RowProps = {
    ev: PublicTimelineEvent;
    dayCells: Array<{ idx: number; isToday: boolean; isWeekend: boolean; isMonthStart: boolean }>;
    rangeStart: Date; rangeDays: number; rowIndex: number; cellW: number;
};

// ── Versi 1: satu kolom kiri menumpuk semua info.
function EventRowV1({ ev, dayCells, rangeStart, rangeDays, rowIndex, cellW }: RowProps) {
    const dayPhase = computeDayPhase(ev, rangeStart, rangeDays);
    const pic = ev.picWorker?.name ?? ev.picName;
    const brandColor = brandColorOf(ev);

    return (
        <tr className="border-b-2 border-border/60 align-top animate-fade" style={{ animationDelay: `${Math.min(rowIndex, 12) * 60}ms` }}>
            <td
                className="px-3 py-2.5 sticky left-0 bg-card border-r-2 border-border z-10"
                style={{
                    width: LEFT_W_V1,
                    minWidth: LEFT_W_V1,
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
            <DayCells dayCells={dayCells} dayPhase={dayPhase} cellW={cellW} evName={ev.name} />
        </tr>
    );
}

// Placeholder saat sebuah kolom kosong (versi 2).
function Empty() {
    return <span className="text-sm text-muted-foreground/60 italic">—</span>;
}

// ── Versi 2: info dipecah jadi kolom Nama Event / Pekerjaan / Venue / PIC / Client / Marketing.
function EventRowV2({ ev, dayCells, rangeStart, rangeDays, rowIndex, cellW }: RowProps) {
    const dayPhase = computeDayPhase(ev, rangeStart, rangeDays);
    const pic = ev.picWorker?.name ?? ev.picName;
    const client = ev.customerName ?? ev.customer?.name ?? null;
    const brandColor = brandColorOf(ev);

    const cell: Record<ColKey, ReactNode> = {
        name: (
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-base leading-snug">{ev.name}</span>
                    <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: brandColor + "1F", color: brandColor }}>
                        {brandLabelOf(ev)}
                    </span>
                    {ev.status === "IN_PROGRESS" && <LiveBadge />}
                </div>
                {ev.teams.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {ev.teams.map((t) => (
                            <span key={t.id} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: t.color + "22", color: t.color }}>
                                <span className="w-2 h-2 rounded-full animate-breathe" style={{ backgroundColor: t.color }} />{t.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        ),
        work: (ev.productCategory?.trim() || ev.orderDescription) ? (
            <div className="flex flex-col gap-1">
                {ev.productCategory?.trim() && (
                    <span className="self-start inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
                        <Tag className="h-3.5 w-3.5 shrink-0" />{ev.productCategory}
                    </span>
                )}
                {ev.orderDescription && (
                    <span className="text-sm leading-relaxed whitespace-pre-line">{ev.orderDescription}</span>
                )}
            </div>
        ) : <Empty />,
        venue: ev.venue
            ? <span className="text-sm flex items-start gap-1.5"><MapPin className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />{ev.venue}</span>
            : <Empty />,
        pic: (
            <div className="flex flex-col gap-1">
                {pic ? (
                    <span className="text-sm font-semibold flex items-center gap-1.5"><UserIcon className="h-4 w-4 shrink-0 text-primary" />{pic}</span>
                ) : <Empty />}
                {ev.crew.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {ev.crew.map((c) => (
                            <span key={c.id} className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border border-border bg-background/60">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.team?.color ?? "var(--muted-foreground)" }} />{c.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        ),
        client: client
            ? (
                <div className="text-sm leading-tight">
                    <div className="font-medium">{client}</div>
                    {ev.customer?.companyName && ev.customer.companyName !== client && (
                        <div className="text-xs text-muted-foreground">{ev.customer.companyName}</div>
                    )}
                </div>
            )
            : <Empty />,
        marketing: ev.marketing
            ? <span className="text-sm flex items-center gap-1.5"><Megaphone className="h-4 w-4 shrink-0 text-amber-500" /><span className="font-medium">{ev.marketing.name}</span></span>
            : <Empty />,
    };

    return (
        <tr className="border-b-2 border-border/60 align-top animate-fade" style={{ animationDelay: `${Math.min(rowIndex, 12) * 60}ms` }}>
            {COLUMNS.map((c, i) => {
                const isFirst = i === 0;
                const isLast = i === COLUMNS.length - 1;
                return (
                    <td
                        key={c.key}
                        className={`px-2.5 py-2.5 sticky bg-card border-border ${isLast ? "border-r-2" : "border-r"}`}
                        style={{
                            width: c.width,
                            minWidth: c.width,
                            left: COL_OFFSETS[i],
                            zIndex: 20,
                            minHeight: ROW_H,
                            // Aksen brand HANYA kolom pertama. Gradient dipakai agar tint menumpuk di
                            // atas bg-card yang OPAQUE (kalau pakai backgroundColor transparan, konten
                            // yang scroll di belakang kolom sticky ini akan tembus).
                            ...(isFirst
                                ? { borderLeft: `4px solid ${brandColor}`, backgroundImage: `linear-gradient(${brandColor}0D, ${brandColor}0D)` }
                                : null),
                        }}
                    >
                        {cell[c.key]}
                    </td>
                );
            })}
            <DayCells dayCells={dayCells} dayPhase={dayPhase} cellW={cellW} evName={ev.name} />
        </tr>
    );
}
