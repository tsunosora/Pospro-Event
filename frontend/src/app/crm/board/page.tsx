"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import Link from "next/link";
import { getBoard, listLabels, reorderLead, LEAD_STATUS_META, LEAD_STATUS_ORDER, type BoardData, type Lead, type LeadStatus } from "@/lib/api/crm";
import { StageColumn } from "@/components/crm/StageColumn";
import { LeadCard } from "@/components/crm/LeadCard";
import { LeadDrawer } from "@/components/crm/LeadDrawer";
import { Plus, Upload, RefreshCw, Search, X, LayoutGrid, Rows3, Maximize2, Settings2, Eye, EyeOff } from "lucide-react";
import { DateRangeFilter, presetToRange, type DateRange } from "@/components/DateRangeFilter";
import type { LeadCardDensity } from "@/components/crm/LeadCard";
import type { StageColumnWidth } from "@/components/crm/StageColumn";

export default function CrmBoardPage() {
    const qc = useQueryClient();
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
    const [activeLead, setActiveLead] = useState<Lead | null>(null);
    const [drawerLeadId, setDrawerLeadId] = useState<number | null>(null);

    const [search, setSearch] = useState("");
    const [workerFilter, setWorkerFilter] = useState<number | "">("");
    const [labelFilter, setLabelFilter] = useState<number | "">("");
    /** Multi-select status filter — Set kosong = tampil semua. Set berisi = whitelist. */
    const [statusFilter, setStatusFilter] = useState<Set<LeadStatus>>(new Set());
    const [statusOpen, setStatusOpen] = useState(false);
    /**
     * Date filter — bisa filter berdasarkan 1 dari 3 field tanggal:
     *  - leadCameAt: kapan lead masuk pipeline (default — paling umum dipakai)
     *  - eventDateStart: kapan event mulai (untuk track persiapan)
     *  - followUpDate: kapan follow-up direncanakan
     */
    const [dateField, setDateField] = useState<"leadCameAt" | "eventDateStart" | "followUpDate">("leadCameAt");
    const [dateRange, setDateRange] = useState<DateRange>({ preset: "ALL" });

    /**
     * View options — disimpan di localStorage supaya preferensi user persisten across sessions.
     * - density: comfortable (full info) / compact (minus foto) / minimal (cuma nama + level + WA)
     * - columnWidth: narrow / normal / wide
     * - hideEmptyStages: sembunyikan kolom yang gak ada lead-nya (fokus stage aktif)
     */
    const [density, setDensity] = useState<LeadCardDensity>("comfortable");
    const [columnWidth, setColumnWidth] = useState<StageColumnWidth>("normal");
    const [hideEmptyStages, setHideEmptyStages] = useState(false);
    const [viewOptionsOpen, setViewOptionsOpen] = useState(false);

    // Hydrate dari localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem("pospro:crm:viewOpts");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.density) setDensity(parsed.density);
                if (parsed.columnWidth) setColumnWidth(parsed.columnWidth);
                if (typeof parsed.hideEmptyStages === "boolean") setHideEmptyStages(parsed.hideEmptyStages);
            }
        } catch { /* ignore */ }
    }, []);
    // Persist
    useEffect(() => {
        try {
            localStorage.setItem("pospro:crm:viewOpts", JSON.stringify({ density, columnWidth, hideEmptyStages }));
        } catch { /* ignore */ }
    }, [density, columnWidth, hideEmptyStages]);

    const { data, isLoading, refetch, isFetching } = useQuery({
        queryKey: ["crm-board"],
        queryFn: getBoard,
    });
    const { data: labels } = useQuery({ queryKey: ["crm-labels"], queryFn: listLabels });

    // Optimistic local copy so drag is smooth
    const [local, setLocal] = useState<BoardData | null>(null);
    useEffect(() => {
        if (data) setLocal(data);
    }, [data]);

    const reorderMut = useMutation({
        mutationFn: reorderLead,
        onError: () => {
            qc.invalidateQueries({ queryKey: ["crm-board"] });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["crm-board"] });
        },
    });

    const stages = local?.stages ?? [];
    const leadsByStageRaw = local?.leadsByStage ?? {};

    const workerOptions = useMemo(() => {
        const seen = new Map<number, string>();
        for (const sid in leadsByStageRaw) {
            for (const l of leadsByStageRaw[sid]) {
                if (l.assignedWorker) seen.set(l.assignedWorker.id, l.assignedWorker.name);
            }
        }
        return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [leadsByStageRaw]);

    const filtersActive = !!search || workerFilter !== "" || labelFilter !== "" || dateRange.preset !== "ALL" || statusFilter.size > 0;

    const leadsByStage = useMemo(() => {
        if (!filtersActive) return leadsByStageRaw;
        const q = search.trim().toLowerCase();
        const { from: dateFrom, to: dateTo } = presetToRange(dateRange.preset, {
            from: dateRange.fromDate, to: dateRange.toDate,
        });
        const out: Record<number, Lead[]> = {};
        for (const sid in leadsByStageRaw) {
            out[sid] = leadsByStageRaw[sid].filter((l) => {
                if (workerFilter !== "" && l.assignedWorkerId !== workerFilter) return false;
                if (labelFilter !== "" && !l.labels?.some((x) => x.label.id === labelFilter)) return false;
                if (statusFilter.size > 0 && !statusFilter.has(l.status)) return false;
                if (q) {
                    const hay = [l.name, l.phone, l.organization, l.productCategory, l.orderDescription, l.notes]
                        .filter(Boolean).join(" ").toLowerCase();
                    if (!hay.includes(q)) return false;
                }
                // Date filter — apply hanya kalau range aktif (ALL → from/to null → skip)
                if (dateFrom || dateTo) {
                    const sourceIso = l[dateField];
                    if (!sourceIso) return false; // lead tanpa tanggal di-exclude saat filter aktif
                    const d = new Date(sourceIso);
                    if (Number.isNaN(d.getTime())) return false;
                    if (dateFrom && d < dateFrom) return false;
                    if (dateTo && d > dateTo) return false;
                }
                return true;
            });
        }
        return out;
    }, [leadsByStageRaw, search, workerFilter, labelFilter, statusFilter, dateField, dateRange, filtersActive]);

    const allLeads = useMemo(() => {
        const arr: Lead[] = [];
        for (const sid in leadsByStageRaw) arr.push(...leadsByStageRaw[sid]);
        return arr;
    }, [leadsByStageRaw]);

    function handleDragStart(e: DragStartEvent) {
        const lead = allLeads.find((l) => l.id === e.active.id);
        if (lead) setActiveLead(lead);
    }

    function handleDragEnd(e: DragEndEvent) {
        setActiveLead(null);
        const { active, over } = e;
        if (!over || !local) return;

        const draggedLead = allLeads.find((l) => l.id === active.id);
        if (!draggedLead) return;

        const overData = over.data.current as { type?: string; stageId?: number } | undefined;
        const overLead = allLeads.find((l) => l.id === over.id);

        let targetStageId: number;
        let targetOrderIndex: number;

        if (overLead) {
            targetStageId = overLead.stageId;
            const targetCol = leadsByStageRaw[targetStageId] ?? [];
            const overIdx = targetCol.findIndex((l) => l.id === overLead.id);
            if (draggedLead.stageId === targetStageId) {
                const fromIdx = targetCol.findIndex((l) => l.id === draggedLead.id);
                targetOrderIndex = overIdx;
                if (fromIdx === overIdx) return;
            } else {
                targetOrderIndex = overIdx;
            }
        } else if (overData?.type === "stage" && overData.stageId !== undefined) {
            targetStageId = overData.stageId;
            const targetCol = leadsByStageRaw[targetStageId] ?? [];
            targetOrderIndex = targetCol.length;
            if (draggedLead.stageId === targetStageId) return;
        } else {
            return;
        }

        // Optimistic update — apply to raw board state
        const next: BoardData = {
            stages: local.stages,
            leadsByStage: { ...leadsByStageRaw },
        };

        if (draggedLead.stageId === targetStageId) {
            const col = next.leadsByStage[targetStageId] ?? [];
            const fromIdx = col.findIndex((l) => l.id === draggedLead.id);
            next.leadsByStage[targetStageId] = arrayMove(col, fromIdx, targetOrderIndex);
        } else {
            next.leadsByStage[draggedLead.stageId] = (next.leadsByStage[draggedLead.stageId] ?? []).filter(
                (l) => l.id !== draggedLead.id,
            );
            const dst = [...(next.leadsByStage[targetStageId] ?? [])];
            const moved: Lead = { ...draggedLead, stageId: targetStageId };
            dst.splice(targetOrderIndex, 0, moved);
            next.leadsByStage[targetStageId] = dst;
        }

        setLocal(next);
        reorderMut.mutate({
            leadId: draggedLead.id,
            newStageId: targetStageId,
            newOrderIndex: targetOrderIndex,
        });
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] min-h-0 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 sm:px-4 py-2 sm:py-3 border-b border-border bg-background shrink-0">
                <div className="min-w-0">
                    <h1 className="text-base sm:text-lg font-bold">Pipeline Lead</h1>
                    <p className="text-[11px] sm:text-xs text-muted-foreground hidden sm:block">Drag-drop card antar stage</p>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md border border-border bg-background text-xs sm:text-sm hover:bg-muted disabled:opacity-50"
                        title="Refresh"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                    </button>
                    {/* Quick density toggle — 3 icon button (Lengkap / Padat / Minimal) */}
                    <div className="hidden md:inline-flex items-center gap-0 rounded-md border border-border bg-background p-0.5">
                        <button
                            type="button"
                            onClick={() => setDensity("comfortable")}
                            title="Tampilan Lengkap (foto + semua info)"
                            className={`px-1.5 py-1 rounded text-xs transition ${density === "comfortable" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-muted"}`}
                        >
                            🃏
                        </button>
                        <button
                            type="button"
                            onClick={() => setDensity("compact")}
                            title="Tampilan Padat (tanpa foto)"
                            className={`px-1.5 py-1 rounded text-xs transition ${density === "compact" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-muted"}`}
                        >
                            📋
                        </button>
                        <button
                            type="button"
                            onClick={() => setDensity("minimal")}
                            title="Tampilan Minimal (cuma nama)"
                            className={`px-1.5 py-1 rounded text-xs transition ${density === "minimal" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-muted"}`}
                        >
                            📝
                        </button>
                    </div>

                    {/* View Options popover */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setViewOptionsOpen((o) => !o)}
                            className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md border border-border bg-background text-xs sm:text-sm hover:bg-muted"
                            title="Opsi tampilan board"
                        >
                            <Settings2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Tampilan</span>
                        </button>
                        {viewOptionsOpen && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setViewOptionsOpen(false)} />
                                <div className="absolute z-40 mt-1 right-0 w-72 rounded-lg border border-input bg-card shadow-xl">
                                    <div className="p-3 border-b border-border">
                                        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">🎨 Opsi Tampilan Board</div>
                                    </div>

                                    {/* Density */}
                                    <div className="p-3 border-b border-border space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                            <LayoutGrid className="h-3 w-3" /> Kepadatan Card
                                        </label>
                                        <div className="grid grid-cols-3 gap-1">
                                            {(["comfortable", "compact", "minimal"] as LeadCardDensity[]).map((d) => (
                                                <button
                                                    key={d}
                                                    type="button"
                                                    onClick={() => setDensity(d)}
                                                    className={`text-[10px] px-2 py-1.5 rounded border-2 font-semibold transition ${density === d
                                                        ? "bg-indigo-600 text-white border-indigo-600"
                                                        : "bg-white text-slate-700 border-slate-200 hover:border-indigo-400"
                                                        }`}
                                                >
                                                    {d === "comfortable" ? "🃏 Lengkap" :
                                                     d === "compact" ? "📋 Padat" :
                                                     "📝 Minimal"}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            {density === "comfortable" && "Foto + semua info"}
                                            {density === "compact" && "Tanpa foto, info ringkas"}
                                            {density === "minimal" && "Hanya nama + brand + status"}
                                        </p>
                                    </div>

                                    {/* Column width */}
                                    <div className="p-3 border-b border-border space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                            <Maximize2 className="h-3 w-3" /> Lebar Kolom
                                        </label>
                                        <div className="grid grid-cols-3 gap-1">
                                            {(["narrow", "normal", "wide"] as StageColumnWidth[]).map((w) => (
                                                <button
                                                    key={w}
                                                    type="button"
                                                    onClick={() => setColumnWidth(w)}
                                                    className={`text-[10px] px-2 py-1.5 rounded border-2 font-semibold transition ${columnWidth === w
                                                        ? "bg-indigo-600 text-white border-indigo-600"
                                                        : "bg-white text-slate-700 border-slate-200 hover:border-indigo-400"
                                                        }`}
                                                >
                                                    {w === "narrow" ? "🔹 Sempit" : w === "normal" ? "🔸 Normal" : "🔺 Lebar"}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            {columnWidth === "narrow" && "Lebih banyak kolom muat di layar"}
                                            {columnWidth === "normal" && "Default, balance antara density & info"}
                                            {columnWidth === "wide" && "Info card lebih luas, gampang dibaca"}
                                        </p>
                                    </div>

                                    {/* Hide empty stages */}
                                    <div className="p-3 space-y-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setHideEmptyStages((h) => !h)}
                                            className={`w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-md border-2 text-xs font-semibold transition ${hideEmptyStages
                                                ? "bg-amber-100 text-amber-800 border-amber-400"
                                                : "bg-white text-slate-700 border-slate-200 hover:border-amber-300"
                                                }`}
                                        >
                                            <span className="inline-flex items-center gap-1.5">
                                                {hideEmptyStages ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                Sembunyikan Stage Kosong
                                            </span>
                                            <span className="text-[10px]">
                                                {hideEmptyStages ? "✓ Aktif" : "Off"}
                                            </span>
                                        </button>
                                        <p className="text-[10px] text-muted-foreground">
                                            Fokus ke stage yang ada lead-nya, kolom kosong di-hide.
                                        </p>
                                    </div>

                                    {/* Reset */}
                                    <div className="p-2 border-t border-border bg-slate-50/50">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDensity("comfortable");
                                                setColumnWidth("normal");
                                                setHideEmptyStages(false);
                                            }}
                                            className="w-full text-[10px] text-slate-600 hover:text-slate-900 hover:bg-white rounded px-2 py-1.5"
                                        >
                                            ↺ Reset ke default
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <Link
                        href="/crm/import"
                        className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md border border-border bg-background text-xs sm:text-sm hover:bg-muted"
                    >
                        <Upload className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Import XLSX</span>
                    </Link>
                    <Link
                        href="/crm/leads/new"
                        className="inline-flex items-center gap-1.5 px-2.5 sm:px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs sm:text-sm font-medium hover:bg-primary/90"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add Lead
                    </Link>
                </div>
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2 border-b border-border bg-muted/20 shrink-0">
                <div className="relative flex-1 min-w-[160px] max-w-sm">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari nama / HP / organisasi..."
                        className="w-full pl-7 pr-2 py-1.5 text-sm rounded-md border border-border bg-background"
                    />
                </div>
                <select
                    value={workerFilter}
                    onChange={(e) => setWorkerFilter(e.target.value ? Number(e.target.value) : "")}
                    className="text-xs sm:text-sm rounded-md border border-border bg-background py-1.5 px-2 max-w-[140px]"
                >
                    <option value="">Semua Marketing</option>
                    {workerOptions.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                </select>
                <select
                    value={labelFilter}
                    onChange={(e) => setLabelFilter(e.target.value ? Number(e.target.value) : "")}
                    className="text-xs sm:text-sm rounded-md border border-border bg-background py-1.5 px-2 max-w-[140px]"
                >
                    <option value="">Semua label</option>
                    {labels?.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                </select>
                {/* Multi-select Status filter — popover dengan checkbox per status */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setStatusOpen(o => !o)}
                        className="text-xs sm:text-sm rounded-md border border-border bg-background py-1.5 px-2 hover:bg-muted/40 flex items-center gap-1"
                        title="Filter status lead"
                    >
                        {statusFilter.size === 0
                            ? "Semua status"
                            : `${statusFilter.size} status`}
                        <span className="text-muted-foreground">▾</span>
                    </button>
                    {statusOpen && (
                        <>
                            <div className="fixed inset-0 z-30" onClick={() => setStatusOpen(false)} />
                            <div className="absolute z-40 mt-1 left-0 w-60 rounded-lg border border-input bg-card shadow-lg max-h-80 overflow-y-auto">
                                <div className="p-2 border-b border-border flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Filter Status</span>
                                    {statusFilter.size > 0 && (
                                        <button
                                            onClick={() => setStatusFilter(new Set())}
                                            className="text-[10px] text-blue-600 hover:underline"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </div>
                                <div className="py-1">
                                    {LEAD_STATUS_ORDER.map(s => {
                                        const m = LEAD_STATUS_META[s];
                                        const checked = statusFilter.has(s);
                                        return (
                                            <label
                                                key={s}
                                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/60 cursor-pointer text-xs"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => {
                                                        setStatusFilter(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(s)) next.delete(s);
                                                            else next.add(s);
                                                            return next;
                                                        });
                                                    }}
                                                    className="h-3.5 w-3.5 accent-primary"
                                                />
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${m.bg} ${m.text} border ${m.border}`}>
                                                    {m.emoji} {m.label}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>
                {/* Date field selector + range filter */}
                <div className="flex items-center gap-1 border-l border-border pl-2 ml-1">
                    <select
                        value={dateField}
                        onChange={(e) => setDateField(e.target.value as any)}
                        className="text-xs rounded-md border border-border bg-background py-1.5 px-2"
                        title="Pilih tanggal yang difilter"
                    >
                        <option value="leadCameAt">📥 Lead Masuk</option>
                        <option value="eventDateStart">🎪 Tanggal Event</option>
                        <option value="followUpDate">📞 Follow-Up</option>
                    </select>
                    <DateRangeFilter value={dateRange} onChange={setDateRange} label="" />
                </div>
                {filtersActive && (
                    <button
                        onClick={() => {
                            setSearch("");
                            setWorkerFilter("");
                            setLabelFilter("");
                            setStatusFilter(new Set());
                            setDateRange({ preset: "ALL" });
                            setDateField("leadCameAt");
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                        <X className="h-3 w-3" />
                        Reset
                    </button>
                )}
            </div>

            {isLoading && <div className="p-6 text-sm text-muted-foreground shrink-0">Memuat board...</div>}
            {!isLoading && stages.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground shrink-0">
                    Belum ada stage. Jalankan seed-crm.
                </div>
            )}

            {/* Kanban board area — fill remaining height, horizontal scroll between columns */}
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setActiveLead(null)}
            >
                <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden [scrollbar-width:thin]">
                    <div className="flex gap-3 p-3 sm:p-4 h-full min-h-0">
                        {stages
                            .filter((stage) => !hideEmptyStages || (leadsByStage[stage.id]?.length ?? 0) > 0)
                            .map((stage) => (
                                <StageColumn
                                    key={stage.id}
                                    stage={stage}
                                    leads={leadsByStage[stage.id] ?? []}
                                    onCardClick={(lead) => setDrawerLeadId(lead.id)}
                                    density={density}
                                    columnWidth={columnWidth}
                                />
                            ))}
                    </div>
                </div>
                <DragOverlay>
                    {activeLead && <LeadCard lead={activeLead} density={density} />}
                </DragOverlay>
            </DndContext>

            <LeadDrawer
                leadId={drawerLeadId}
                open={drawerLeadId !== null}
                onClose={() => setDrawerLeadId(null)}
            />
        </div>
    );
}
