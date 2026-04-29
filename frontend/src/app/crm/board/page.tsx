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
import { getBoard, listLabels, reorderLead, type BoardData, type Lead } from "@/lib/api/crm";
import { StageColumn } from "@/components/crm/StageColumn";
import { LeadCard } from "@/components/crm/LeadCard";
import { LeadDrawer } from "@/components/crm/LeadDrawer";
import { Plus, Upload, RefreshCw, Search, X } from "lucide-react";

export default function CrmBoardPage() {
    const qc = useQueryClient();
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
    const [activeLead, setActiveLead] = useState<Lead | null>(null);
    const [drawerLeadId, setDrawerLeadId] = useState<number | null>(null);

    const [search, setSearch] = useState("");
    const [workerFilter, setWorkerFilter] = useState<number | "">("");
    const [labelFilter, setLabelFilter] = useState<number | "">("");

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

    const filtersActive = !!search || workerFilter !== "" || labelFilter !== "";

    const leadsByStage = useMemo(() => {
        if (!filtersActive) return leadsByStageRaw;
        const q = search.trim().toLowerCase();
        const out: Record<number, Lead[]> = {};
        for (const sid in leadsByStageRaw) {
            out[sid] = leadsByStageRaw[sid].filter((l) => {
                if (workerFilter !== "" && l.assignedWorkerId !== workerFilter) return false;
                if (labelFilter !== "" && !l.labels?.some((x) => x.label.id === labelFilter)) return false;
                if (q) {
                    const hay = [l.name, l.phone, l.organization, l.productCategory, l.orderDescription, l.notes]
                        .filter(Boolean).join(" ").toLowerCase();
                    if (!hay.includes(q)) return false;
                }
                return true;
            });
        }
        return out;
    }, [leadsByStageRaw, search, workerFilter, labelFilter, filtersActive]);

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
                {filtersActive && (
                    <button
                        onClick={() => { setSearch(""); setWorkerFilter(""); setLabelFilter(""); }}
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
                        {stages.map((stage) => (
                            <StageColumn
                                key={stage.id}
                                stage={stage}
                                leads={leadsByStage[stage.id] ?? []}
                                onCardClick={(lead) => setDrawerLeadId(lead.id)}
                            />
                        ))}
                    </div>
                </div>
                <DragOverlay>
                    {activeLead && <LeadCard lead={activeLead} />}
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
