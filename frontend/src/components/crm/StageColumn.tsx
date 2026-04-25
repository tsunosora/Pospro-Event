"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import type { Lead, LeadStage } from "@/lib/api/crm";
import { LeadCard } from "./LeadCard";

export function StageColumn({
    stage,
    leads,
    onCardClick,
}: {
    stage: LeadStage;
    leads: Lead[];
    onCardClick: (lead: Lead) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `stage-${stage.id}`,
        data: { type: "stage", stageId: stage.id },
    });

    return (
        <div className="flex flex-col w-72 shrink-0 bg-muted/40 rounded-lg border border-border">
            <div
                className="flex items-center justify-between px-3 py-2 rounded-t-lg border-b border-border"
                style={{ backgroundColor: `${stage.color}15` }}
            >
                <div className="flex items-center gap-2">
                    <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: stage.color }}
                    />
                    <span className="font-semibold text-sm">{stage.name}</span>
                </div>
                <span className="text-xs text-muted-foreground font-medium">{leads.length}</span>
            </div>

            <div
                ref={setNodeRef}
                className={`flex-1 p-2 space-y-2 min-h-[120px] transition-colors ${isOver ? "bg-primary/5" : ""
                    }`}
            >
                <SortableContext
                    items={leads.map((l) => l.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {leads.map((lead) => (
                        <LeadCard key={lead.id} lead={lead} onClick={() => onCardClick(lead)} />
                    ))}
                </SortableContext>
                {leads.length === 0 && (
                    <div className="text-[11px] text-muted-foreground/70 text-center py-6">
                        Drop di sini
                    </div>
                )}
            </div>
        </div>
    );
}
