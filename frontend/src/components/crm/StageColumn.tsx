"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import type { Lead, LeadStage } from "@/lib/api/crm";
import { LeadCard, type LeadCardDensity } from "./LeadCard";

export type StageColumnWidth = "narrow" | "normal" | "wide";

export function StageColumn({
    stage,
    leads,
    onCardClick,
    density = "comfortable",
    columnWidth = "normal",
}: {
    stage: LeadStage;
    leads: Lead[];
    onCardClick: (lead: Lead) => void;
    density?: LeadCardDensity;
    columnWidth?: StageColumnWidth;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `stage-${stage.id}`,
        data: { type: "stage", stageId: stage.id },
    });

    // Width responsive berdasarkan setting user
    const widthCls = columnWidth === "narrow"
        ? "w-[220px] sm:w-56"
        : columnWidth === "wide"
            ? "w-[320px] sm:w-80"
            : "w-[280px] sm:w-72";

    return (
        <div className={`flex flex-col ${widthCls} shrink-0 h-full max-h-full bg-muted/40 rounded-lg border border-border overflow-hidden`}>
            {/* Header — sticky di top column */}
            <div
                className="flex items-center justify-between px-3 py-2 rounded-t-lg border-b border-border shrink-0"
                style={{ backgroundColor: `${stage.color}15` }}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: stage.color }}
                    />
                    <span className="font-semibold text-sm truncate">{stage.name}</span>
                </div>
                <span className="text-xs text-muted-foreground font-medium shrink-0 ml-2 px-1.5 py-0.5 rounded-full bg-background/60">
                    {leads.length}
                </span>
            </div>

            {/* Lead list — internal vertical scroll */}
            <div
                ref={setNodeRef}
                className={`flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-2 transition-colors [scrollbar-width:thin] ${isOver ? "bg-primary/5" : ""
                    }`}
            >
                <SortableContext
                    items={leads.map((l) => l.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {leads.map((lead) => (
                        <LeadCard key={lead.id} lead={lead} onClick={() => onCardClick(lead)} density={density} />
                    ))}
                </SortableContext>
                {leads.length === 0 && (
                    <div className="text-[11px] text-muted-foreground/70 text-center py-6 border-2 border-dashed border-border/50 rounded-md">
                        Drop di sini
                    </div>
                )}
            </div>
        </div>
    );
}
