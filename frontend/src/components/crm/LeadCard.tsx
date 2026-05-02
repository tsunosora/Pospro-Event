"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Building2, CalendarClock, CalendarDays, GripVertical, PartyPopper, User } from "lucide-react";
import dayjs from "dayjs";
import type { Lead } from "@/lib/api/crm";
import { LevelBadge } from "./LevelBadge";
import { WaButton } from "./WaButton";

/** Format tanggal singkat — kalau hari ini "Hari ini", kalau kemarin "Kemarin", lainnya "DD MMM" / "DD MMM YYYY" */
function formatShortDate(iso: string): string {
    const d = dayjs(iso);
    const today = dayjs().startOf("day");
    const diffDays = d.startOf("day").diff(today, "day");
    if (diffDays === 0) return "Hari ini";
    if (diffDays === -1) return "Kemarin";
    if (diffDays === 1) return "Besok";
    if (Math.abs(diffDays) < 7) return diffDays > 0 ? `${diffDays} hari lagi` : `${Math.abs(diffDays)} hari lalu`;
    return d.year() === today.year() ? d.format("DD MMM") : d.format("DD MMM YYYY");
}

/** Tentuin warna untuk follow-up date — red kalau overdue, amber kalau ≤2 hari lagi, blue kalau future */
function followUpColor(iso: string): { bg: string; text: string; border: string } {
    const d = dayjs(iso).startOf("day");
    const today = dayjs().startOf("day");
    const diffDays = d.diff(today, "day");
    if (diffDays < 0) return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" };       // overdue
    if (diffDays <= 2) return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" }; // urgent
    return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };                       // future
}

/**
 * Warna untuk event date — banyak deal yang sudah closed tapi eventnya masih 1-2 bulan lagi.
 * Card harus jelas visualisasi-nya supaya owner tau prioritas persiapan.
 *  - Lewat (event sudah berlalu)        → ungu (Selesai)
 *  - ≤ 7 hari (minggu ini)              → merah  (urgent — last preparation)
 *  - 8-30 hari (bulan ini)              → orange (siap-siap intensif)
 *  - 31-60 hari (~1-2 bulan lagi)       → emerald (deal aman, siap-siap awal)
 *  - > 60 hari                          → hijau muda (planning jangka panjang)
 */
function eventDateColor(iso: string): { bg: string; text: string; border: string; label: string } {
    const d = dayjs(iso).startOf("day");
    const today = dayjs().startOf("day");
    const diffDays = d.diff(today, "day");
    if (diffDays < 0) return { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", label: "Selesai" };
    if (diffDays <= 7) return { bg: "bg-red-50", text: "text-red-700", border: "border-red-300", label: "Minggu ini" };
    if (diffDays <= 30) return { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", label: "Bulan ini" };
    if (diffDays <= 60) return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Siap-siap" };
    return { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", label: "Jangka panjang" };
}

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

            {/* Event Date — TAMPIL PALING DULU & MENONJOL kalau ada.
                Kasus umum: deal sudah closed tapi event masih 1-2 bulan lagi → harus visible biar owner tau prioritas persiapan. */}
            {lead.eventDate && (() => {
                const c = eventDateColor(lead.eventDate);
                const d = dayjs(lead.eventDate).startOf("day");
                const today = dayjs().startOf("day");
                const diffDays = d.diff(today, "day");
                return (
                    <div
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold ${c.bg} ${c.text} border ${c.border}`}
                        title={`Event: ${dayjs(lead.eventDate).format("DD MMMM YYYY")}${lead.eventLocation ? ` · ${lead.eventLocation}` : ""}`}
                    >
                        <PartyPopper className="h-3 w-3 shrink-0" />
                        <span className="truncate flex-1">
                            🎪 {formatShortDate(lead.eventDate)}
                            {diffDays > 7 && diffDays <= 60 && (
                                <span className="font-normal opacity-70"> ({diffDays} hari)</span>
                            )}
                        </span>
                        <span className="text-[9px] uppercase tracking-wide opacity-80 shrink-0">{c.label}</span>
                    </div>
                );
            })()}

            {/* Date row — Lead masuk + Follow-up (kalau ada) */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-200"
                    title={`Lead masuk: ${dayjs(lead.leadCameAt).format("DD MMM YYYY HH:mm")}`}
                >
                    <CalendarDays className="h-2.5 w-2.5" />
                    {formatShortDate(lead.leadCameAt)}
                </span>
                {lead.followUpDate && (() => {
                    const c = followUpColor(lead.followUpDate);
                    return (
                        <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text} border ${c.border}`}
                            title={`Follow-up: ${dayjs(lead.followUpDate).format("DD MMM YYYY")}`}
                        >
                            <CalendarClock className="h-2.5 w-2.5" />
                            FU: {formatShortDate(lead.followUpDate)}
                        </span>
                    );
                })()}
            </div>

            <div className="flex items-center justify-between gap-1 pt-1">
                <span className="text-[10px] text-muted-foreground font-mono truncate">
                    {lead.phone}
                </span>
                <WaButton phone={lead.phone} text={lead.greetingTemplate || undefined} label="WA" />
            </div>
        </div>
    );
}
