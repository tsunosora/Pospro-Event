"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Building2, GripVertical, User } from "lucide-react";
import type { Lead } from "@/lib/api/crm";
import { LevelBadge } from "./LevelBadge";
import { WaButton } from "./WaButton";

export function LeadCard({ lead, onClick }: { lead: Lead; onClick?: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: lead.id,
        data: { type: "lead", stageId: lead.stageId },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const display = lead.name?.trim() || `— ${lead.phoneNormalized.slice(-4)}`;
    const labels = lead.labels ?? [];

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onClick}
            className="group bg-card border border-border rounded-lg p-2.5 shadow-sm hover:shadow-md cursor-pointer space-y-1.5"
        >
            <div className="flex items-start gap-1.5">
                <button
                    {...attributes}
                    {...listeners}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5 text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing"
                    title="Drag untuk pindah"
                >
                    <GripVertical className="h-4 w-4" />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{display}</div>
                    {lead.productCategory && (
                        <div className="text-[11px] text-emerald-700 truncate">{lead.productCategory}</div>
                    )}
                </div>
                <LevelBadge level={lead.level} />
            </div>

            {lead.organization && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                    <Building2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">{lead.organization}</span>
                </div>
            )}
            {lead.assignedWorker && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">{lead.assignedWorker.name}</span>
                </div>
            )}

            {labels.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {labels.map((l) => (
                        <span
                            key={l.label.id}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border"
                            style={{
                                backgroundColor: `${l.label.color}15`,
                                borderColor: `${l.label.color}40`,
                                color: l.label.color,
                            }}
                        >
                            {l.label.name}
                        </span>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between gap-1 pt-1">
                <span className="text-[10px] text-muted-foreground font-mono truncate">
                    {lead.phone}
                </span>
                <WaButton phone={lead.phone} text={lead.greetingTemplate || undefined} label="WA" />
            </div>
        </div>
    );
}
