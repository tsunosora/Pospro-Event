"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
    ChevronLeft, ChevronRight, Printer, Loader2, Search, X,
    AlertTriangle, Calendar, Copy, Download, Layers, Pencil,
} from "lucide-react";
import { getEvents, updateEvent, type EventRecord, type EventBrand, type EventStatus } from "@/lib/api/events";
import { getRabSummary } from "@/lib/api/rab";

// ─── Constants ──────────────────────────────────────────────────────────
const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const DOW_EN = ["S","M","T","W","T","F","S"]; // index by jsDay (Sun=0)

type Phase = "departure" | "setup" | "event" | "dismantle";
const PHASE_COLOR: Record<Phase, { solid: string; faded: string; label: string }> = {
    departure: { solid: "bg-slate-400",  faded: "bg-slate-300/50",  label: "Departure" },
    setup:     { solid: "bg-red-500",    faded: "bg-red-300/60",    label: "Setup" },
    event:     { solid: "bg-yellow-400", faded: "bg-yellow-200/70", label: "Event Day" },
    dismantle: { solid: "bg-blue-500",   faded: "bg-blue-300/60",   label: "Dismantle" },
};

const STATUS_CFG: Record<EventStatus, { label: string; cls: string }> = {
    DRAFT:       { label: "Draft",       cls: "bg-gray-200 text-gray-800" },
    SCHEDULED:   { label: "Terjadwal",   cls: "bg-blue-100 text-blue-700" },
    IN_PROGRESS: { label: "Berlangsung", cls: "bg-amber-100 text-amber-800" },
    COMPLETED:   { label: "Selesai",     cls: "bg-green-100 text-green-700" },
    CANCELLED:   { label: "Batal",       cls: "bg-red-100 text-red-700" },
};

const BRAND_STRIP: Record<EventBrand, string> = {
    EXINDO: "bg-indigo-500",
    XPOSER: "bg-pink-500",
    OTHER:  "bg-gray-400",
};

type ZoomLevel = "day" | "week" | "quarter";
type GroupBy = "none" | "client" | "pic" | "brand" | "venue" | "team";
type ColorMode = "phase" | "brand" | "team";

// ─── Helpers ────────────────────────────────────────────────────────────
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function daysBetween(a: Date, b: Date) {
    return Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}
function fmtDateID(d: Date) {
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function clientName(e: EventRecord) { return e.customer?.name ?? e.customerName ?? "—"; }
function picName(e: EventRecord)    { return e.picWorker?.name ?? e.picName ?? "—"; }

function getTeamBreakdown(e: EventRecord): Array<{ id: number; name: string; color: string; count: number }> {
    const map = new Map<number, { id: number; name: string; color: string; count: number }>();
    (e.crewAssignments ?? []).forEach((a) => {
        if (!a.team) return;
        const cur = map.get(a.team.id) ?? { id: a.team.id, name: a.team.name, color: a.team.color, count: 0 };
        cur.count++;
        map.set(a.team.id, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function dominantTeamColor(e: EventRecord): string | null {
    const breakdown = getTeamBreakdown(e);
    return breakdown[0]?.color ?? null;
}

function getPhaseRanges(ev: EventRecord): Array<{ phase: Phase; start: Date; end: Date }> {
    const out: Array<{ phase: Phase; start: Date; end: Date }> = [];
    const push = (phase: Phase, s?: string | null, e?: string | null) => {
        if (!s) return;
        out.push({ phase, start: new Date(s), end: new Date(e ?? s) });
    };
    push("departure", ev.departureStart, ev.departureEnd);
    push("setup",     ev.setupStart,     ev.setupEnd);
    push("event",     ev.eventStart,     ev.eventEnd);
    push("dismantle", ev.loadingStart,   ev.loadingEnd);
    return out;
}

// ─── Component ──────────────────────────────────────────────────────────
export default function EventTimelinePage() {
    const today = new Date();
    const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [zoom, setZoom] = useState<ZoomLevel>("day");
    const [groupBy, setGroupBy] = useState<GroupBy>("none");
    const [colorMode, setColorMode] = useState<ColorMode>("phase");
    const [showDeparture, setShowDeparture] = useState(true);

    const [clientFilter, setClientFilter] = useState("");
    const [picFilter, setPicFilter] = useState("");
    const [venueFilter, setVenueFilter] = useState("");
    const [teamFilter, setTeamFilter] = useState<number | "">("");
    const [search, setSearch] = useState("");

    const [activeBar, setActiveBar] = useState<{ event: EventRecord; phase: Phase } | null>(null);
    const [editMode, setEditMode] = useState(false);
    const qc = useQueryClient();

    // Range — based on zoom
    const range = useMemo(() => {
        if (zoom === "day") {
            const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
            const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
            const end = new Date(cursor.getFullYear(), cursor.getMonth(), days);
            return { start, end, days, cellW: 28, label: `${MONTHS_ID[cursor.getMonth()]} ${cursor.getFullYear()}` };
        } else if (zoom === "week") {
            // 12 weeks centered on cursor
            const start = new Date(cursor); start.setDate(cursor.getDate() - 42);
            const end = new Date(cursor); end.setDate(cursor.getDate() + 42);
            return { start, end, days: 84, cellW: 12, label: `${fmtDateID(start)} → ${fmtDateID(end)}` };
        } else {
            // quarter — 3 months centered
            const start = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
            const end = new Date(cursor.getFullYear(), cursor.getMonth() + 2, 0);
            const days = daysBetween(start, end) + 1;
            return { start, end, days, cellW: 9, label: `Q ${MONTHS_ID[start.getMonth()]} → ${MONTHS_ID[end.getMonth()]}` };
        }
    }, [cursor, zoom]);

    const dayCells = useMemo(() => {
        return Array.from({ length: range.days }, (_, i) => {
            const d = new Date(range.start);
            d.setDate(d.getDate() + i);
            return {
                idx: i,
                date: d,
                day: d.getDate(),
                dow: DOW_EN[d.getDay()],
                isToday: startOfDay(d).getTime() === startOfDay(today).getTime(),
                isWeekend: d.getDay() === 0 || d.getDay() === 6,
                isMonthStart: d.getDate() === 1,
            };
        });
    }, [range, today]);

    // Fetch events from a wider window when zoomed out
    const fetchYear = cursor.getFullYear();
    const fetchMonth = cursor.getMonth() + 1;
    const { data: monthEvents = [], isLoading } = useQuery({
        queryKey: ["events-timeline-month", fetchYear, fetchMonth],
        queryFn: () => getEvents({ year: fetchYear, month: fetchMonth }),
    });
    const { data: prevEvents = [] } = useQuery({
        queryKey: ["events-timeline-month",
            fetchMonth === 1 ? fetchYear - 1 : fetchYear,
            fetchMonth === 1 ? 12 : fetchMonth - 1],
        queryFn: () => getEvents({
            year: fetchMonth === 1 ? fetchYear - 1 : fetchYear,
            month: fetchMonth === 1 ? 12 : fetchMonth - 1,
        }),
        enabled: zoom !== "day",
    });
    const { data: nextEvents = [] } = useQuery({
        queryKey: ["events-timeline-month",
            fetchMonth === 12 ? fetchYear + 1 : fetchYear,
            fetchMonth === 12 ? 1 : fetchMonth + 1],
        queryFn: () => getEvents({
            year: fetchMonth === 12 ? fetchYear + 1 : fetchYear,
            month: fetchMonth === 12 ? 1 : fetchMonth + 1,
        }),
        enabled: zoom !== "day",
    });
    const allEvents = useMemo(() => {
        const map = new Map<number, EventRecord>();
        [...prevEvents, ...monthEvents, ...nextEvents].forEach((e) => map.set(e.id, e));
        return Array.from(map.values());
    }, [monthEvents, prevEvents, nextEvents]);

    // ── RAB summaries for events that link to a RabPlan ──
    const rabPlanIds = useMemo(() => {
        const ids = new Set<number>();
        allEvents.forEach((e) => {
            const id = (e as { rabPlanId?: number | null }).rabPlanId;
            if (id) ids.add(id);
        });
        return Array.from(ids);
    }, [allEvents]);

    const rabQueries = useQueries({
        queries: rabPlanIds.map((id) => ({
            queryKey: ["rab-summary", id],
            queryFn: () => getRabSummary(id),
            staleTime: 60_000,
        })),
    });

    const rabSummaryMap = useMemo(() => {
        const map = new Map<number, { totalRab: number; totalCost: number; margin: number }>();
        rabQueries.forEach((q, i) => {
            const data = q.data;
            if (!data) return;
            const totalRab = Number(data.totals.totalRab) || 0;
            const totalCost = Number(data.totals.totalCost) || 0;
            const margin = totalRab > 0 ? ((totalRab - totalCost) / totalRab) * 100 : 0;
            map.set(rabPlanIds[i], { totalRab, totalCost, margin });
        });
        return map;
    }, [rabQueries, rabPlanIds]);

    // ── Resize mutation (drag-drop) ──
    const resizeMut = useMutation({
        mutationFn: ({ id, patch }: { id: number; patch: Record<string, string | null> }) => updateEvent(id, patch),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["events-timeline-month"] });
        },
    });

    // Options for filters
    const clientOptions = useMemo(() => Array.from(new Set(allEvents.map(clientName).filter((x) => x !== "—"))).sort(), [allEvents]);
    const picOptions = useMemo(() => Array.from(new Set(allEvents.map(picName).filter((x) => x !== "—"))).sort(), [allEvents]);
    const venueOptions = useMemo(() => Array.from(new Set(allEvents.map((e) => e.venue ?? "").filter(Boolean))).sort(), [allEvents]);
    const teamOptions = useMemo(() => {
        const map = new Map<number, { id: number; name: string; color: string }>();
        allEvents.forEach((e) => {
            (e.crewAssignments ?? []).forEach((a) => {
                if (a.team) map.set(a.team.id, a.team);
            });
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [allEvents]);

    // Apply filters + range overlap
    const filtered = useMemo(() => {
        return allEvents.filter((e) => {
            if (clientFilter && clientName(e) !== clientFilter) return false;
            if (picFilter && picName(e) !== picFilter) return false;
            if (venueFilter && (e.venue ?? "") !== venueFilter) return false;
            if (teamFilter !== "") {
                const hasTeam = (e.crewAssignments ?? []).some((a) => a.team?.id === teamFilter);
                if (!hasTeam) return false;
            }
            const ranges = getPhaseRanges(e).filter((r) => showDeparture || r.phase !== "departure");
            if (ranges.length === 0) return false;
            return ranges.some((r) => r.end >= range.start && r.start <= range.end);
        });
    }, [allEvents, clientFilter, picFilter, venueFilter, teamFilter, range, showDeparture]);

    // Conflict detection: same PIC overlapping phases
    const conflicts = useMemo(() => {
        const byPic = new Map<string, Array<{ ev: EventRecord; ranges: ReturnType<typeof getPhaseRanges> }>>();
        filtered.forEach((ev) => {
            const pic = picName(ev);
            if (pic === "—") return;
            const arr = byPic.get(pic) ?? [];
            arr.push({ ev, ranges: getPhaseRanges(ev) });
            byPic.set(pic, arr);
        });
        const conflictSet = new Set<string>(); // key: `${eventId}-${dayIdx}`
        byPic.forEach((arr) => {
            for (let i = 0; i < arr.length; i++) {
                for (let j = i + 1; j < arr.length; j++) {
                    arr[i].ranges.forEach((ra) => {
                        arr[j].ranges.forEach((rb) => {
                            if (ra.end < rb.start || rb.end < ra.start) return;
                            const ovStart = ra.start > rb.start ? ra.start : rb.start;
                            const ovEnd = ra.end < rb.end ? ra.end : rb.end;
                            const startIdx = Math.max(0, daysBetween(range.start, ovStart));
                            const endIdx = Math.min(range.days - 1, daysBetween(range.start, ovEnd));
                            for (let d = startIdx; d <= endIdx; d++) {
                                conflictSet.add(`${arr[i].ev.id}-${d}`);
                                conflictSet.add(`${arr[j].ev.id}-${d}`);
                            }
                        });
                    });
                }
            }
        });
        return conflictSet;
    }, [filtered, range]);

    // Stats
    const stats = useMemo(() => {
        let setupDays = 0, eventDays = 0, dismantleDays = 0;
        const teams = new Set<string>();
        filtered.forEach((e) => {
            const pic = picName(e);
            if (pic !== "—") teams.add(pic);
            getPhaseRanges(e).forEach((r) => {
                const d = daysBetween(r.start, r.end) + 1;
                if (r.phase === "setup") setupDays += d;
                if (r.phase === "event") eventDays += d;
                if (r.phase === "dismantle") dismantleDays += d;
            });
        });
        return { total: filtered.length, setupDays, eventDays, dismantleDays, activeTeams: teams.size };
    }, [filtered]);

    // Capacity histogram per day
    const capacityPerDay = useMemo(() => {
        const arr = new Array(range.days).fill(0);
        filtered.forEach((ev) => {
            getPhaseRanges(ev).forEach((r) => {
                const a = Math.max(0, daysBetween(range.start, r.start));
                const b = Math.min(range.days - 1, daysBetween(range.start, r.end));
                for (let d = a; d <= b; d++) arr[d]++;
            });
        });
        return arr;
    }, [filtered, range]);

    // Group rows
    const groupedRows = useMemo(() => {
        if (groupBy === "none") return [{ key: "", label: "", events: filtered }];
        const map = new Map<string, EventRecord[]>();
        filtered.forEach((e) => {
            let k = "—";
            if (groupBy === "client") k = clientName(e);
            else if (groupBy === "pic") k = picName(e);
            else if (groupBy === "brand") k = e.brand;
            else if (groupBy === "venue") k = e.venue ?? "—";
            else if (groupBy === "team") {
                const breakdown = getTeamBreakdown(e);
                k = breakdown.length === 0
                    ? "Tanpa Team"
                    : breakdown.length === 1
                        ? breakdown[0].name
                        : `Multi (${breakdown.map((b) => b.name).join(" + ")})`;
            }
            const arr = map.get(k) ?? [];
            arr.push(e);
            map.set(k, arr);
        });
        return Array.from(map.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, events]) => ({ key, label: key, events }));
    }, [filtered, groupBy]);

    // ── Drag-drop resize state ──
    const gridContainerRef = useRef<HTMLDivElement | null>(null);
    const FIXED_COLS_W = 200 + 180 + 140 + 220; // 4 sticky columns
    const [drag, setDrag] = useState<null | {
        eventId: number;
        phase: Phase;
        originalEndDate: Date;
        previewEndDate: Date;
    }>(null);

    const handleDragStart = useCallback((ev: EventRecord, phase: Phase, originalEnd: Date) => {
        if (!editMode) return;
        setDrag({ eventId: ev.id, phase, originalEndDate: originalEnd, previewEndDate: originalEnd });
    }, [editMode]);

    useEffect(() => {
        if (!drag) return;
        const onMove = (e: MouseEvent) => {
            const container = gridContainerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const xInGrid = e.clientX - rect.left + container.scrollLeft - FIXED_COLS_W;
            const dayIdx = Math.floor(xInGrid / range.cellW);
            const clamped = Math.max(0, Math.min(range.days - 1, dayIdx));
            const newEnd = new Date(range.start);
            newEnd.setDate(newEnd.getDate() + clamped);
            setDrag((d) => d ? { ...d, previewEndDate: newEnd } : d);
        };
        const onUp = () => {
            setDrag((d) => {
                if (!d) return null;
                if (startOfDay(d.previewEndDate).getTime() !== startOfDay(d.originalEndDate).getTime()) {
                    const ev = allEvents.find((x) => x.id === d.eventId);
                    if (ev) {
                        // Validate: end must be >= start
                        const ranges = getPhaseRanges(ev);
                        const range = ranges.find((r) => r.phase === d.phase);
                        if (range && d.previewEndDate >= range.start) {
                            const fieldMap: Record<Phase, string> = {
                                departure: "departureEnd",
                                setup: "setupEnd",
                                event: "eventEnd",
                                dismantle: "loadingEnd",
                            };
                            // ISO at end of day
                            const endIso = new Date(d.previewEndDate);
                            endIso.setHours(23, 59, 0, 0);
                            resizeMut.mutate({ id: d.eventId, patch: { [fieldMap[d.phase]]: endIso.toISOString() } });
                        }
                    }
                }
                return null;
            });
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [drag, range.cellW, range.days, range.start, allEvents]);

    function shift(delta: number) {
        const next = new Date(cursor);
        if (zoom === "day")        next.setMonth(next.getMonth() + delta);
        else if (zoom === "week")  next.setDate(next.getDate() + delta * 28);
        else                       next.setMonth(next.getMonth() + delta * 3);
        setCursor(next);
    }

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
            if (e.key === "ArrowLeft")  { e.preventDefault(); shift(-1); }
            if (e.key === "ArrowRight") { e.preventDefault(); shift(1); }
            if (e.key.toLowerCase() === "t") setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
            if (e.key === "1") setZoom("day");
            if (e.key === "2") setZoom("week");
            if (e.key === "3") setZoom("quarter");
            if (e.key === "Escape") setActiveBar(null);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cursor, zoom]);

    // Export iCal
    function exportICS() {
        const lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Pospro Event//Timeline//ID",
        ];
        const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
        filtered.forEach((ev) => {
            getPhaseRanges(ev).forEach((r, i) => {
                const end = new Date(r.end); end.setDate(end.getDate() + 1); // ical end exclusive
                lines.push(
                    "BEGIN:VEVENT",
                    `UID:event-${ev.id}-${r.phase}-${i}@pospro-event`,
                    `DTSTAMP:${stamp(new Date())}`,
                    `DTSTART:${stamp(r.start)}`,
                    `DTEND:${stamp(end)}`,
                    `SUMMARY:[${PHASE_COLOR[r.phase].label}] ${ev.name}`,
                    `LOCATION:${(ev.venue ?? "").replace(/\n/g, " ")}`,
                    `DESCRIPTION:Client: ${clientName(ev)} \\nPIC: ${picName(ev)} \\nStatus: ${ev.status}`,
                    "END:VEVENT",
                );
            });
        });
        lines.push("END:VCALENDAR");
        const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `event-timeline-${range.label.replace(/\s/g, "-")}.ics`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Copy WhatsApp summary
    async function copyWhatsappSummary() {
        const lines = [`*Jadwal Event — ${range.label}*`, ""];
        groupedRows.forEach((g) => {
            if (g.label) lines.push(`▸ *${g.label}*`);
            g.events.forEach((ev) => {
                const phases = getPhaseRanges(ev).map((r) => `${PHASE_COLOR[r.phase].label.charAt(0)}:${fmtDateID(r.start)}`).join(" · ");
                lines.push(`• ${ev.name} (${clientName(ev)}) — ${ev.venue ?? "—"} — PIC ${picName(ev)}\n  ${phases}`);
            });
            lines.push("");
        });
        try {
            await navigator.clipboard.writeText(lines.join("\n"));
            alert("Jadwal disalin ke clipboard. Paste ke grup WhatsApp.");
        } catch {
            alert("Gagal menyalin. Coba browser lain.");
        }
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-white">
            {/* ── Header ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-border print:hidden">
                <div>
                    <h1 className="text-xl font-bold text-foreground">Event Timeline</h1>
                    <p className="text-xs text-muted-foreground">
                        Gantt view per phase · Tekan <kbd className="px-1 border rounded text-[10px]">←</kbd>/<kbd className="px-1 border rounded text-[10px]">→</kbd> navigasi · <kbd className="px-1 border rounded text-[10px]">T</kbd> hari ini · <kbd className="px-1 border rounded text-[10px]">1</kbd>/<kbd className="px-1 border rounded text-[10px]">2</kbd>/<kbd className="px-1 border rounded text-[10px]">3</kbd> zoom
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 rounded-md border border-border p-0.5 bg-background">
                        {(["day","week","quarter"] as ZoomLevel[]).map((z) => (
                            <button
                                key={z}
                                onClick={() => setZoom(z)}
                                className={`px-2 py-1 text-xs rounded ${zoom === z ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                            >
                                {z === "day" ? "Hari" : z === "week" ? "Minggu" : "Kuartal"}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => shift(-1)} className="p-1.5 rounded-md border border-border hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
                    <span className="text-sm font-semibold min-w-[10rem] text-center">{range.label}</span>
                    <button onClick={() => shift(1)} className="p-1.5 rounded-md border border-border hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
                    <button
                        onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
                        className="px-2 py-1.5 text-xs rounded-md border border-border hover:bg-muted"
                    >
                        Today
                    </button>
                    <button onClick={() => window.print()} className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-sm hover:bg-muted">
                        <Printer className="h-3.5 w-3.5" /> Print
                    </button>
                    <button onClick={exportICS} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-sm hover:bg-muted">
                        <Download className="h-3.5 w-3.5" /> .ics
                    </button>
                    <button onClick={copyWhatsappSummary} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-sm hover:bg-muted">
                        <Copy className="h-3.5 w-3.5" /> Copy WA
                    </button>
                    <button
                        onClick={() => setEditMode((m) => !m)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${
                            editMode
                                ? "bg-amber-500 text-white hover:bg-amber-600"
                                : "border border-border bg-background hover:bg-muted"
                        }`}
                        title="Drag ujung kanan bar untuk geser tanggal selesai phase"
                    >
                        <Pencil className="h-3.5 w-3.5" /> {editMode ? "Edit ON" : "Edit"}
                    </button>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-border bg-muted/20 print:hidden">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari event..."
                        className="pl-7 pr-2 py-1.5 text-sm rounded-md border border-border bg-background w-56"
                    />
                </div>
                <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="text-sm rounded-md border border-border bg-background py-1.5 px-2">
                    <option value="">All Clients</option>
                    {clientOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={picFilter} onChange={(e) => setPicFilter(e.target.value)} className="text-sm rounded-md border border-border bg-background py-1.5 px-2">
                    <option value="">All Teams</option>
                    {picOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={venueFilter} onChange={(e) => setVenueFilter(e.target.value)} className="text-sm rounded-md border border-border bg-background py-1.5 px-2">
                    <option value="">All Locations</option>
                    {venueOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <select
                    value={teamFilter === "" ? "" : String(teamFilter)}
                    onChange={(e) => setTeamFilter(e.target.value ? Number(e.target.value) : "")}
                    className="text-sm rounded-md border border-border bg-background py-1.5 px-2"
                >
                    <option value="">All Teams</option>
                    {teamOptions.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
                <span className="w-px h-5 bg-border mx-1" />
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                    Group:
                    <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className="text-sm rounded-md border border-border bg-background py-1 px-1.5">
                        <option value="none">none</option>
                        <option value="client">Client</option>
                        <option value="pic">PIC</option>
                        <option value="brand">Brand</option>
                        <option value="venue">Venue</option>
                        <option value="team">Team</option>
                    </select>
                </label>
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                    Color:
                    <select value={colorMode} onChange={(e) => setColorMode(e.target.value as ColorMode)} className="text-sm rounded-md border border-border bg-background py-1 px-1.5">
                        <option value="phase">Phase</option>
                        <option value="brand">Brand</option>
                        <option value="team">Team</option>
                    </select>
                </label>
                <label className="text-xs flex items-center gap-1 text-muted-foreground">
                    <input type="checkbox" checked={showDeparture} onChange={(e) => setShowDeparture(e.target.checked)} />
                    Departure lane
                </label>
                {(clientFilter || picFilter || venueFilter || teamFilter !== "" || search) && (
                    <button onClick={() => { setClientFilter(""); setPicFilter(""); setVenueFilter(""); setTeamFilter(""); setSearch(""); }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" /> Reset
                    </button>
                )}
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-6 py-4 border-b border-border">
                <StatCard label="Total Events" value={stats.total} />
                <StatCard label="Setup Days" value={stats.setupDays} valueClass="text-red-500" />
                <StatCard label="Event Days" value={stats.eventDays} valueClass="text-yellow-500" />
                <StatCard label="Dismantle Days" value={stats.dismantleDays} valueClass="text-blue-500" />
                <StatCard label="Active Teams" value={stats.activeTeams} />
            </div>

            {/* ── Gantt ── */}
            <div ref={gridContainerRef} className="flex-1 overflow-auto relative">
                {isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Memuat timeline...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">Tidak ada event di periode ini.</div>
                ) : (
                    <GanttTable
                        groupedRows={groupedRows}
                        dayCells={dayCells}
                        rangeStart={range.start}
                        rangeDays={range.days}
                        cellW={range.cellW}
                        zoom={zoom}
                        colorMode={colorMode}
                        showDeparture={showDeparture}
                        searchQ={search.trim().toLowerCase()}
                        conflicts={conflicts}
                        capacityPerDay={capacityPerDay}
                        rabSummaryMap={rabSummaryMap}
                        editMode={editMode}
                        drag={drag}
                        onBarClick={(ev, phase) => !editMode && setActiveBar({ event: ev, phase })}
                        onDragStart={handleDragStart}
                    />
                )}
            </div>

            {/* ── Legend ── */}
            <div className="flex flex-wrap items-center gap-4 px-6 py-3 border-t border-border bg-muted/10 text-xs">
                <LegendChip color="bg-slate-400"  label="Departure (faded)" />
                <LegendChip color="bg-red-500"    label="Setup" />
                <LegendChip color="bg-yellow-400" label="Event Day" />
                <LegendChip color="bg-blue-500"   label="Dismantle" />
                <span className="w-px h-4 bg-border mx-1" />
                <LegendChip color="bg-blue-100 ring-1 ring-blue-400" label="Today (column highlight)" />
                <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3 w-3" /> Conflict PIC</span>
                <span className="ml-auto text-muted-foreground">Bar pudar = sudah lewat hari ini · Bar penuh = on-going / future</span>
            </div>

            {/* ── Quick Action Modal ── */}
            {activeBar && (
                <QuickActionModal
                    event={activeBar.event}
                    phase={activeBar.phase}
                    onClose={() => setActiveBar(null)}
                />
            )}

            {/* Print A3 landscape */}
            <style jsx global>{`
                @media print {
                    @page { size: A3 landscape; margin: 1cm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>
        </div>
    );
}

// ─── StatCard ──────────────────────────────────────────────────────────
function StatCard({ label, value, valueClass }: { label: string; value: number; valueClass?: string }) {
    return (
        <div className="rounded-lg border border-border bg-background py-3 px-4 text-center">
            <div className={`text-2xl font-bold ${valueClass ?? ""}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        </div>
    );
}
function LegendChip({ color, label }: { color: string; label: string }) {
    return <div className="flex items-center gap-1.5"><span className={`inline-block w-3 h-3 rounded-sm ${color}`} /><span className="text-foreground/80">{label}</span></div>;
}

// ─── GanttTable ────────────────────────────────────────────────────────
function GanttTable({
    groupedRows, dayCells, rangeStart, rangeDays, cellW, zoom, colorMode, showDeparture, searchQ, conflicts, capacityPerDay, rabSummaryMap, editMode, drag, onBarClick, onDragStart,
}: {
    groupedRows: Array<{ key: string; label: string; events: EventRecord[] }>;
    dayCells: Array<{ idx: number; date: Date; day: number; dow: string; isToday: boolean; isWeekend: boolean; isMonthStart: boolean }>;
    rangeStart: Date;
    rangeDays: number;
    cellW: number;
    zoom: ZoomLevel;
    colorMode: ColorMode;
    showDeparture: boolean;
    searchQ: string;
    conflicts: Set<string>;
    capacityPerDay: number[];
    rabSummaryMap: Map<number, { totalRab: number; totalCost: number; margin: number }>;
    editMode: boolean;
    drag: null | { eventId: number; phase: Phase; originalEndDate: Date; previewEndDate: Date };
    onBarClick: (ev: EventRecord, phase: Phase) => void;
    onDragStart: (ev: EventRecord, phase: Phase, originalEnd: Date) => void;
}) {
    const maxCapacity = Math.max(1, ...capacityPerDay);
    const todayIdx = dayCells.findIndex((c) => c.isToday);

    return (
        <div className="min-w-max relative">
            {/* Today vertical line */}
            {todayIdx >= 0 && (
                <div
                    className="absolute top-0 bottom-0 w-px bg-blue-500/60 z-10 pointer-events-none"
                    style={{ left: 200 + 180 + 140 + 220 + (todayIdx * cellW) + cellW / 2 }}
                />
            )}

            <table className="border-collapse">
                <thead className="sticky top-0 bg-white z-20">
                    <tr className="border-b border-border">
                        <th className="text-left text-xs font-semibold text-foreground px-3 py-2 sticky left-0 bg-white border-r border-border" style={{ width: 200 }}>Event Name</th>
                        <th className="text-left text-xs font-semibold text-foreground px-3 py-2" style={{ width: 180 }}>Client</th>
                        <th className="text-left text-xs font-semibold text-foreground px-3 py-2" style={{ width: 140 }}>PIC / Team</th>
                        <th className="text-left text-xs font-semibold text-foreground px-3 py-2" style={{ width: 220 }}>Venue</th>
                        {dayCells.map((d) => (
                            <th
                                key={d.idx}
                                className={`text-center text-[10px] font-medium py-1 border-l border-border/50 ${
                                    d.isToday ? "bg-blue-100" : d.isWeekend ? "bg-muted/30" : ""
                                } ${d.isMonthStart && zoom !== "day" ? "border-l-2 border-l-foreground/30" : ""}`}
                                style={{ width: cellW, minWidth: cellW }}
                            >
                                {(zoom === "day" || zoom === "week") && <div className="text-muted-foreground">{d.dow}</div>}
                                <div className="text-foreground/80">{d.day}</div>
                                {d.isMonthStart && zoom !== "day" && (
                                    <div className="text-[8px] text-foreground/60 font-semibold">{MONTHS_ID[d.date.getMonth()].slice(0, 3)}</div>
                                )}
                            </th>
                        ))}
                    </tr>
                    {/* Capacity histogram */}
                    <tr className="border-b border-border bg-muted/10 print:hidden">
                        <th colSpan={4} className="text-right text-[10px] text-muted-foreground px-3 py-1 sticky left-0 bg-muted/10 border-r border-border">
                            <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" /> Load</span>
                        </th>
                        {dayCells.map((d) => {
                            const c = capacityPerDay[d.idx] ?? 0;
                            const pct = (c / maxCapacity) * 100;
                            const color = c === 0 ? "bg-transparent" : c <= 2 ? "bg-green-400" : c <= 4 ? "bg-yellow-400" : "bg-red-500";
                            return (
                                <th key={d.idx} className="p-0 border-l border-border/30 align-bottom" style={{ width: cellW, minWidth: cellW, height: 24 }}>
                                    <div className="flex items-end justify-center h-full" title={`${c} event aktif`}>
                                        <div className={`${color} w-full`} style={{ height: `${Math.max(4, pct)}%` }} />
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {groupedRows.map((g) => (
                        <Fragment key={`group-${g.key || "all"}`}>
                            {g.label && (
                                <tr className="bg-muted/40 border-y border-border">
                                    <td colSpan={4 + dayCells.length} className="px-3 py-1.5 text-xs font-semibold text-foreground/80 sticky left-0 bg-muted/40">
                                        ▾ {g.label} <span className="text-muted-foreground font-normal">({g.events.length})</span>
                                    </td>
                                </tr>
                            )}
                            {g.events.map((ev) => (
                                <EventRow
                                    key={ev.id}
                                    event={ev}
                                    dayCells={dayCells}
                                    rangeStart={rangeStart}
                                    rangeDays={rangeDays}
                                    cellW={cellW}
                                    colorMode={colorMode}
                                    showDeparture={showDeparture}
                                    searchHit={!!searchQ && (
                                        ev.name.toLowerCase().includes(searchQ) ||
                                        clientName(ev).toLowerCase().includes(searchQ) ||
                                        picName(ev).toLowerCase().includes(searchQ) ||
                                        (ev.venue ?? "").toLowerCase().includes(searchQ)
                                    )}
                                    conflicts={conflicts}
                                    rabSummary={(() => {
                                        const id = (ev as { rabPlanId?: number | null }).rabPlanId;
                                        return id ? rabSummaryMap.get(id) ?? null : null;
                                    })()}
                                    editMode={editMode}
                                    drag={drag && drag.eventId === ev.id ? drag : null}
                                    onBarClick={onBarClick}
                                    onDragStart={onDragStart}
                                />
                            ))}
                        </Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── EventRow ──────────────────────────────────────────────────────────
function EventRow({
    event: ev, dayCells, rangeStart, rangeDays, cellW, colorMode, showDeparture, searchHit, conflicts, rabSummary, editMode, drag, onBarClick, onDragStart,
}: {
    event: EventRecord;
    dayCells: Array<{ idx: number; date: Date; day: number; dow: string; isToday: boolean; isWeekend: boolean; isMonthStart: boolean }>;
    rangeStart: Date;
    rangeDays: number;
    cellW: number;
    colorMode: ColorMode;
    showDeparture: boolean;
    searchHit: boolean;
    conflicts: Set<string>;
    rabSummary: { totalRab: number; totalCost: number; margin: number } | null;
    editMode: boolean;
    drag: null | { eventId: number; phase: Phase; originalEndDate: Date; previewEndDate: Date };
    onBarClick: (ev: EventRecord, phase: Phase) => void;
    onDragStart: (ev: EventRecord, phase: Phase, originalEnd: Date) => void;
}) {
    const today = startOfDay(new Date());
    let ranges = getPhaseRanges(ev).filter((r) => showDeparture || r.phase !== "departure");

    // Apply drag preview override
    if (drag) {
        ranges = ranges.map((r) => {
            if (r.phase === drag.phase) return { ...r, end: drag.previewEndDate };
            return r;
        });
    }

    // Build cell-day → phase map
    const dayPhase = new Map<number, Phase>();
    ranges.forEach((r) => {
        const startIdx = Math.max(0, daysBetween(rangeStart, r.start));
        const endIdx = Math.min(rangeDays - 1, daysBetween(rangeStart, r.end));
        for (let d = startIdx; d <= endIdx; d++) {
            const existing = dayPhase.get(d);
            // priority: event > setup > dismantle > departure
            const order: Record<Phase, number> = { event: 4, setup: 3, dismantle: 2, departure: 1 };
            if (!existing || order[r.phase] > order[existing]) dayPhase.set(d, r.phase);
        }
    });

    // Track which day idx is the LAST cell of each phase (for resize handle)
    const phaseLastIdx = new Map<Phase, number>();
    ranges.forEach((r) => {
        const endIdx = Math.min(rangeDays - 1, daysBetween(rangeStart, r.end));
        const startIdx = Math.max(0, daysBetween(rangeStart, r.start));
        if (endIdx >= 0 && startIdx <= rangeDays - 1) {
            phaseLastIdx.set(r.phase, endIdx);
        }
    });

    // Check for arrows (event starts before range / ends after range)
    const hasLeftArrow = ranges.some((r) => r.start < rangeStart);
    const hasRightArrow = ranges.some((r) => r.end > new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() + rangeDays));

    const status = STATUS_CFG[ev.status];
    const brandStrip = BRAND_STRIP[ev.brand];

    return (
        <tr className={`border-b border-border/50 hover:bg-muted/30 ${searchHit ? "bg-yellow-50" : ""}`}>
            <td className="px-3 py-2 text-sm font-medium sticky left-0 bg-white border-r border-border relative" style={{ width: 200 }}>
                {/* Brand strip */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${brandStrip}`} />
                <div className="pl-2">
                    <Link href={`/events/${ev.id}`} className="hover:text-primary block truncate" title={ev.name}>{ev.name}</Link>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        <span className={`inline-block px-1.5 py-0.5 text-[9px] rounded ${status.cls} font-medium`}>{status.label}</span>
                        {ev._count?.withdrawals ? (
                            <span className="text-[9px] text-muted-foreground" title={`${ev._count.withdrawals} pinjaman`}>📦 {ev._count.withdrawals}</span>
                        ) : null}
                        {ev._count?.crewAssignments ? (
                            <span className="text-[9px] text-muted-foreground" title={`${ev._count.crewAssignments} crew ditugaskan`}>👷 {ev._count.crewAssignments}</span>
                        ) : null}
                        {getTeamBreakdown(ev).map((t) => (
                            <span
                                key={t.id}
                                className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1 py-0.5 rounded"
                                style={{ backgroundColor: t.color + "33", color: t.color }}
                                title={`${t.count} crew dari Team ${t.name}`}
                            >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                                {t.name} {t.count}
                            </span>
                        ))}
                        {rabSummary && (
                            <span
                                className={`inline-block px-1.5 py-0.5 text-[9px] rounded font-bold ${
                                    rabSummary.margin >= 30
                                        ? "bg-green-100 text-green-700"
                                        : rabSummary.margin >= 15
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-red-100 text-red-700"
                                }`}
                                title={`RAB: Jual Rp ${rabSummary.totalRab.toLocaleString("id-ID")} · Modal Rp ${rabSummary.totalCost.toLocaleString("id-ID")} · Margin ${rabSummary.margin.toFixed(1)}%`}
                            >
                                {rabSummary.margin.toFixed(0)}%
                            </span>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-3 py-2 text-sm text-foreground/80 truncate" style={{ width: 180 }} title={clientName(ev)}>{clientName(ev)}</td>
            <td className="px-3 py-2 text-sm text-foreground/80 truncate" style={{ width: 140 }}>{picName(ev)}</td>
            <td className="px-3 py-2 text-sm text-foreground/70 truncate" style={{ width: 220 }} title={ev.venue ?? ""}>{ev.venue ?? "—"}</td>

            {dayCells.map((d) => {
                const phase = dayPhase.get(d.idx);
                const conflictKey = `${ev.id}-${d.idx}`;
                const isConflict = conflicts.has(conflictKey);
                let bg = "";
                let bgStyle: React.CSSProperties | undefined;
                if (phase) {
                    const isPast = d.date < today;
                    if (colorMode === "phase") {
                        bg = isPast ? PHASE_COLOR[phase].faded : PHASE_COLOR[phase].solid;
                    } else if (colorMode === "team") {
                        const teamColor = dominantTeamColor(ev);
                        if (teamColor) {
                            bgStyle = { backgroundColor: teamColor, opacity: isPast ? 0.5 : 1 };
                        } else {
                            // fallback: gray for events without team
                            bg = isPast ? "bg-gray-300" : "bg-gray-400";
                        }
                    } else {
                        // brand color mode
                        const brandSolid = BRAND_STRIP[ev.brand];
                        bg = isPast ? brandSolid.replace("500", "300") : brandSolid;
                    }
                }
                const isFirstOfRange = phase && (!dayPhase.get(d.idx - 1) || dayPhase.get(d.idx - 1) !== phase);
                const isLastOfRange = phase && (!dayPhase.get(d.idx + 1) || dayPhase.get(d.idx + 1) !== phase);

                return (
                    <td
                        key={d.idx}
                        className={`p-0 border-l border-border/50 relative ${d.isToday ? "bg-blue-50" : d.isWeekend ? "bg-muted/20" : ""}`}
                        style={{ width: cellW, minWidth: cellW, height: 38 }}
                    >
                        {phase && (
                            <div
                                className={`${bg} h-[60%] mx-0 my-[20%] ${editMode ? "cursor-default" : "cursor-pointer"} relative ${isConflict ? "ring-2 ring-amber-500 ring-inset" : ""}`}
                                style={bgStyle}
                                onClick={() => !editMode && onBarClick(ev, phase)}
                                title={
                                    `${PHASE_COLOR[phase].label}: ${ev.name}\n` +
                                    `📅 ${fmtDateID(d.date)}\n` +
                                    `🏢 ${clientName(ev)}\n` +
                                    `👤 ${picName(ev)}\n` +
                                    `📍 ${ev.venue ?? "—"}` +
                                    (isConflict ? "\n⚠️ KONFLIK PIC" : "") +
                                    (editMode ? "\n✏️ Drag handle kanan untuk geser tanggal selesai" : "")
                                }
                            >
                                {/* Left arrow if continues from prev range */}
                                {isFirstOfRange && hasLeftArrow && d.idx === 0 && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-white text-[10px] font-bold">◀</span>
                                )}
                                {/* Right arrow if continues to next range */}
                                {isLastOfRange && hasRightArrow && d.idx === rangeDays - 1 && (
                                    <span className="absolute right-0 top-1/2 -translate-y-1/2 text-white text-[10px] font-bold">▶</span>
                                )}
                                {/* Resize handle — only on last cell of phase, only in edit mode */}
                                {editMode && phaseLastIdx.get(phase) === d.idx && (
                                    <div
                                        className="absolute top-0 right-0 w-2 h-full bg-white/40 hover:bg-white/80 cursor-ew-resize border-r-2 border-foreground/60"
                                        onMouseDown={(e) => {
                                            e.stopPropagation();
                                            const phaseRange = ranges.find((r) => r.phase === phase);
                                            if (phaseRange) onDragStart(ev, phase, phaseRange.end);
                                        }}
                                        title="Drag untuk geser tanggal selesai"
                                    />
                                )}
                            </div>
                        )}
                    </td>
                );
            })}
        </tr>
    );
}

// ─── QuickActionModal ──────────────────────────────────────────────────
function QuickActionModal({ event: ev, phase, onClose }: { event: EventRecord; phase: Phase; onClose: () => void }) {
    const phaseRange = getPhaseRanges(ev).find((r) => r.phase === phase);
    const days = phaseRange ? daysBetween(phaseRange.start, phaseRange.end) + 1 : 0;
    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-background rounded-lg shadow-xl w-full max-w-md p-5 border border-border"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className={`inline-block w-3 h-3 rounded-sm ${PHASE_COLOR[phase].solid}`} />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{PHASE_COLOR[phase].label}</span>
                        </div>
                        <h2 className="text-lg font-bold mt-1">{ev.name}</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
                </div>
                <div className="space-y-2 text-sm mb-4 text-foreground/80">
                    {phaseRange && (
                        <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-muted-foreground" /> {fmtDateID(phaseRange.start)} → {fmtDateID(phaseRange.end)} ({days} hari)</div>
                    )}
                    <div>🏢 <strong>{clientName(ev)}</strong></div>
                    <div>👤 PIC: {picName(ev)}</div>
                    <div>📍 {ev.venue ?? "—"}</div>
                    <div className="flex items-center gap-2">
                        Status: <span className={`inline-block px-2 py-0.5 text-[10px] rounded ${STATUS_CFG[ev.status].cls} font-medium`}>{STATUS_CFG[ev.status].label}</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Link href={`/events/${ev.id}`} className="text-center px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Buka Detail</Link>
                    <Link href={`/events/${ev.id}#packing`} className="text-center px-3 py-2 rounded-md border border-border text-sm hover:bg-muted">Packing List</Link>
                    <Link href={`/gudang/peminjaman?eventId=${ev.id}`} className="text-center px-3 py-2 rounded-md border border-border text-sm hover:bg-muted">Pinjaman</Link>
                    {(ev as { rabPlanId?: number | null }).rabPlanId ? (
                        <Link href={`/rab/${(ev as { rabPlanId?: number | null }).rabPlanId}`} className="text-center px-3 py-2 rounded-md border border-border text-sm hover:bg-muted">Buka RAB</Link>
                    ) : (
                        <button disabled className="text-center px-3 py-2 rounded-md border border-border text-sm text-muted-foreground cursor-not-allowed">Belum ada RAB</button>
                    )}
                </div>
            </div>
        </div>
    );
}
