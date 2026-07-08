"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
    CalendarDays, Plus, MapPin, User as UserIcon, Loader2, Search,
} from "lucide-react";
import { getEvents, type EventBrand, type EventRecord, type EventStatus } from "@/lib/api/events";
import { DateRangeFilter, presetToRange, type DateRange } from "@/components/DateRangeFilter";

const MONTHS_ID = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const STATUS_CFG: Record<EventStatus, { label: string; cls: string }> = {
    DRAFT: { label: "Draft", cls: "bg-muted text-muted-foreground" },
    SCHEDULED: { label: "Terjadwal", cls: "bg-info/15 text-info" },
    IN_PROGRESS: { label: "Berlangsung", cls: "bg-warning/15 text-warning" },
    COMPLETED: { label: "Selesai", cls: "bg-success/15 text-success" },
    CANCELLED: { label: "Dibatalkan", cls: "bg-destructive/12 text-destructive" },
};

const BRAND_CFG: Record<EventBrand, { label: string; cls: string }> = {
    EXINDO: { label: "CV. Exindo", cls: "bg-info/15 text-info border-info/30" },
    XPOSER: { label: "CV. Xposer", cls: "bg-primary/15 text-primary border-primary/30" },
    OTHER: { label: "Lain", cls: "bg-muted text-muted-foreground border-border" },
};

function fmtDate(d: string | null | undefined) {
    if (!d) return null;
    return new Date(d).toLocaleDateString("id-ID", {
        day: "numeric", month: "short", year: "numeric",
    });
}

function dateRange(a: string | null | undefined, b: string | null | undefined) {
    if (!a && !b) return "—";
    if (a && b) {
        const s = fmtDate(a);
        const e = fmtDate(b);
        return s === e ? s : `${s} → ${e}`;
    }
    return fmtDate(a ?? b);
}

function groupByMonth(list: EventRecord[]) {
    const groups = new Map<string, { label: string; key: string; sortKey: number; items: EventRecord[] }>();
    for (const ev of list) {
        const ref = ev.eventStart ?? ev.setupStart ?? ev.departureStart ?? ev.createdAt;
        const d = new Date(ref);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = `${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
        if (!groups.has(key)) {
            groups.set(key, { label, key, sortKey: d.getFullYear() * 12 + d.getMonth(), items: [] });
        }
        groups.get(key)!.items.push(ev);
    }
    return Array.from(groups.values()).sort((a, b) => a.sortKey - b.sortKey);
}

export default function EventsListPage() {
    const [statusFilter, setStatusFilter] = useState<EventStatus | "ALL">("ALL");
    const [brandFilter, setBrandFilter] = useState<EventBrand | "ALL">("ALL");
    const [search, setSearch] = useState("");
    const [dateRange, setDateRange] = useState<DateRange>({ preset: "ALL" });

    const { data: events = [], isLoading } = useQuery({
        queryKey: ["events", statusFilter, brandFilter, search],
        queryFn: () => getEvents({
            status: statusFilter === "ALL" ? undefined : statusFilter,
            brand: brandFilter === "ALL" ? undefined : brandFilter,
            search: search.trim() || undefined,
        }),
    });

    // Filter date range — client-side karena dataset event biasanya tidak ribuan.
    // Field acuan: eventStart > setupStart > departureStart > createdAt (sama dgn groupByMonth).
    // Event di-include kalau ada OVERLAP dgn range yang dipilih (start≤rangeTo & end≥rangeFrom).
    const filteredEvents = useMemo(() => {
        const { from, to } = presetToRange(dateRange.preset, {
            from: dateRange.fromDate,
            to: dateRange.toDate,
        });
        if (!from && !to) return events;
        return events.filter((ev) => {
            const startRef = ev.eventStart ?? ev.setupStart ?? ev.departureStart ?? ev.createdAt;
            const endRef = ev.eventEnd ?? ev.setupEnd ?? ev.departureEnd ?? startRef;
            if (!startRef) return false;
            const evStart = new Date(startRef);
            const evEnd = new Date(endRef);
            // Overlap: event yang melintasi range ikut tampil
            if (from && evEnd < from) return false;
            if (to && evStart > to) return false;
            return true;
        });
    }, [events, dateRange]);

    const groups = useMemo(() => groupByMonth(filteredEvents), [filteredEvents]);

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" /> Jadwal Event
                </h1>
                <Link
                    href="/events/new"
                    className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 transition-opacity cursor-pointer"
                >
                    <Plus className="h-4 w-4" /> Event Baru
                </Link>
            </div>

            <div className="flex items-center flex-wrap gap-2">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari nama/venue/klien…"
                        className="pl-7 pr-2 py-1.5 border border-border rounded bg-card text-sm w-56"
                    />
                </div>
                <div className="inline-flex border border-border rounded overflow-hidden text-xs">
                    {(["ALL", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "DRAFT"] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-2.5 py-1.5 cursor-pointer transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                        >
                            {s === "ALL" ? "Semua" : STATUS_CFG[s as EventStatus].label}
                        </button>
                    ))}
                </div>
                <div className="inline-flex border border-border rounded overflow-hidden text-xs">
                    {(["ALL", "EXINDO", "XPOSER", "OTHER"] as const).map((b) => (
                        <button
                            key={b}
                            onClick={() => setBrandFilter(b)}
                            className={`px-2.5 py-1.5 cursor-pointer transition-colors ${brandFilter === b ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                        >
                            {b === "ALL" ? "Semua Brand" : BRAND_CFG[b as EventBrand].label}
                        </button>
                    ))}
                </div>
                {/* Date range filter — preset (Hari Ini/Bulan Ini/3 Bulan/dll) atau Custom tanggal */}
                <DateRangeFilter value={dateRange} onChange={setDateRange} label="Periode" />
                {dateRange.preset !== "ALL" && (
                    <span className="text-xs text-muted-foreground">
                        {filteredEvents.length} dari {events.length} event
                    </span>
                )}
            </div>

            {isLoading ? (
                <div className="text-muted-foreground text-sm py-10 text-center">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Memuat…
                </div>
            ) : filteredEvents.length === 0 ? (
                <div className="glass rounded-xl py-10 text-center text-muted-foreground text-sm">
                    {dateRange.preset !== "ALL" || statusFilter !== "ALL" || brandFilter !== "ALL" || search.trim() ? (
                        <>
                            Tidak ada event yang cocok dengan filter.
                            <button
                                onClick={() => {
                                    setDateRange({ preset: "ALL" });
                                    setStatusFilter("ALL");
                                    setBrandFilter("ALL");
                                    setSearch("");
                                }}
                                className="block mx-auto mt-3 text-xs text-primary hover:underline cursor-pointer transition-colors"
                            >
                                Reset semua filter
                            </button>
                        </>
                    ) : (
                        <>Belum ada event. Klik <b>Event Baru</b> untuk mulai.</>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    {groups.map((g) => (
                        <div key={g.key} className="space-y-2">
                            <h2 className="font-semibold text-sm border-b border-border pb-1 text-foreground">{g.label}</h2>
                            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                {g.items.map((ev) => (
                                    <EventCard key={ev.id} ev={ev} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function EventCard({ ev }: { ev: EventRecord }) {
    const brand = BRAND_CFG[ev.brand];
    const status = STATUS_CFG[ev.status];
    const phases: Array<{ key: string; label: string; cls: string; a: string | null; b: string | null }> = [
        { key: "dep", label: "Berangkat", cls: "bg-warning", a: ev.departureStart, b: ev.departureEnd },
        { key: "setup", label: "Pasang", cls: "bg-orange-400", a: ev.setupStart, b: ev.setupEnd },
        { key: "event", label: "Event", cls: "bg-success", a: ev.eventStart, b: ev.eventEnd },
        { key: "dismantle", label: "Bongkar", cls: "bg-info", a: ev.loadingStart, b: ev.loadingEnd },
    ];

    return (
        <Link
            href={`/events/${ev.id}`}
            className="block glass rounded-xl p-3 hover:border-primary hover:shadow-sm transition-colors"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{ev.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{ev.code}</div>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${brand.cls}`}>{brand.label}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {ev.venue && (
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{ev.venue}</span>
                )}
                {(ev.picName || ev.picWorker) && (
                    <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" />{ev.picWorker?.name ?? ev.picName}</span>
                )}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1 text-[9px]">
                {phases.map((p) => (
                    <div key={p.key} className="text-center">
                        <div className={`h-1.5 rounded ${p.a ? p.cls : "bg-muted"}`} title={p.label} />
                        <div className="mt-0.5 text-muted-foreground">
                            {p.a ? fmtDate(p.a) : "—"}
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className={`px-1.5 py-0.5 rounded ${status.cls}`}>{status.label}</span>
                <span className="text-muted-foreground">
                    {ev._count?.withdrawals ?? 0} pengeluaran
                </span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
                {dateRange(ev.eventStart, ev.eventEnd)}
            </div>
        </Link>
    );
}
