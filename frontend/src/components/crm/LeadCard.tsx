"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Building2, CalendarClock, CalendarDays, ChevronDown, GripVertical, Loader2, PartyPopper, User } from "lucide-react";
import dayjs from "dayjs";
import { LEAD_STATUS_META, updateLead, type Lead } from "@/lib/api/crm";
import { ACTIVE_BRANDS, BRAND_META, type Brand } from "@/lib/api/brands";
import { getWorkers, MARKETER_POSITIONS, type Worker } from "@/lib/api/workers";
import { LevelBadge } from "./LevelBadge";
import { WaButton } from "./WaButton";
import { formatLeadEventDateRange, formatLeadEventDateRangeShort } from "@/lib/utils/date-range";

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
    const qc = useQueryClient();
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

    // Inline edit state — popover open per field
    const [editing, setEditing] = useState<"marketing" | "brand" | null>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Click outside → close popover
    useEffect(() => {
        if (!editing) return;
        const handler = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setEditing(null);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [editing]);

    // Fetch active marketers (cached) — only when popover open to avoid useless calls
    const { data: marketers = [] } = useQuery<Worker[]>({
        queryKey: ["workers", "marketers"],
        queryFn: () => getWorkers(false, { positions: [...MARKETER_POSITIONS] }),
        enabled: editing === "marketing",
        staleTime: 5 * 60 * 1000,
    });

    const updateMut = useMutation({
        mutationFn: (data: Partial<Lead>) => updateLead(lead.id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["crm-board"] });
            qc.invalidateQueries({ queryKey: ["crm-lead", lead.id] });
            setEditing(null);
        },
        onError: (e: any) => alert(`❌ ${e?.response?.data?.message || e?.message || "Gagal update"}`),
    });

    const brandMeta = lead.brand ? BRAND_META[lead.brand] : null;

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
            {/* Marketing & Brand chips — inline editable */}
            <div className="flex items-center gap-1.5 flex-wrap">
                {/* Marketing chip */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setEditing(editing === "marketing" ? null : "marketing"); }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                        title="Klik untuk ganti marketing"
                    >
                        <User className="h-2.5 w-2.5" />
                        <span className="truncate max-w-[120px]">{lead.assignedWorker?.name ?? "— belum di-assign —"}</span>
                        <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                    </button>
                    {editing === "marketing" && (
                        <div ref={popoverRef} className="absolute z-30 top-full left-0 mt-1 w-56 bg-white border-2 border-border rounded-lg shadow-xl py-1 max-h-64 overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}>
                            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground border-b">
                                Pilih Marketing
                            </div>
                            <button
                                type="button"
                                onClick={() => updateMut.mutate({ assignedWorkerId: null })}
                                disabled={updateMut.isPending}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted ${!lead.assignedWorkerId ? "bg-blue-50 text-blue-700 font-semibold" : ""}`}
                            >
                                — Tanpa Marketing —
                            </button>
                            {marketers.map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => updateMut.mutate({ assignedWorkerId: m.id })}
                                    disabled={updateMut.isPending}
                                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2 ${lead.assignedWorkerId === m.id ? "bg-blue-50 text-blue-700 font-semibold" : ""}`}
                                >
                                    <User className="h-3 w-3 text-muted-foreground" />
                                    <span className="truncate">{m.name}</span>
                                    {m.position && <span className="text-[9px] text-muted-foreground">{m.position}</span>}
                                </button>
                            ))}
                            {updateMut.isPending && (
                                <div className="px-3 py-2 text-center"><Loader2 className="h-3 w-3 animate-spin inline" /></div>
                            )}
                        </div>
                    )}
                </div>
                {/* Brand chip */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setEditing(editing === "brand" ? null : "brand"); }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border hover:opacity-80"
                        style={brandMeta ? { backgroundColor: `${brandMeta.color}20`, borderColor: `${brandMeta.color}60`, color: brandMeta.color } : { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1", color: "#475569" }}
                        title="Klik untuk ganti brand"
                    >
                        {brandMeta?.emoji} {brandMeta?.label ?? "— brand —"}
                        <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                    </button>
                    {editing === "brand" && (
                        <div ref={popoverRef} className="absolute z-30 top-full left-0 mt-1 w-44 bg-white border-2 border-border rounded-lg shadow-xl py-1"
                            onClick={(e) => e.stopPropagation()}>
                            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground border-b">
                                Pilih Brand
                            </div>
                            {ACTIVE_BRANDS.map((b) => {
                                const m = BRAND_META[b];
                                return (
                                    <button
                                        key={b}
                                        type="button"
                                        onClick={() => updateMut.mutate({ brand: b as Brand })}
                                        disabled={updateMut.isPending}
                                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2 ${lead.brand === b ? "font-bold" : ""}`}
                                        style={lead.brand === b ? { backgroundColor: `${m.color}15` } : {}}
                                    >
                                        <span>{m.emoji}</span>
                                        <span style={{ color: m.color }}>{m.label}</span>
                                    </button>
                                );
                            })}
                            {updateMut.isPending && (
                                <div className="px-3 py-2 text-center"><Loader2 className="h-3 w-3 animate-spin inline" /></div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Status badge — selalu tampil supaya owner cepat lihat fase lead */}
            {(() => {
                const meta = LEAD_STATUS_META[lead.status];
                if (!meta) return null;
                return (
                    <div className="flex items-center">
                        <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${meta.bg} ${meta.text} border ${meta.border}`}
                            title={`Status: ${meta.label}`}
                        >
                            <span>{meta.emoji}</span>
                            {meta.label}
                        </span>
                    </div>
                );
            })()}

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
                Kasus umum: deal sudah closed tapi event masih 1-2 bulan lagi → harus visible biar owner tau prioritas persiapan.
                Display smart range: 1 hari = "18 Mei", multi-hari = "18-21 Mei" atau "29 Mei - 3 Jun". */}
            {lead.eventDateStart && (() => {
                const c = eventDateColor(lead.eventDateStart);
                const d = dayjs(lead.eventDateStart).startOf("day");
                const today = dayjs().startOf("day");
                const diffDays = d.diff(today, "day");
                const rangeTitle = formatLeadEventDateRange(lead) ?? "";
                const rangeShort = formatLeadEventDateRangeShort(lead) ?? "";
                return (
                    <div
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold ${c.bg} ${c.text} border ${c.border}`}
                        title={`Event: ${rangeTitle}${lead.eventLocation ? ` · ${lead.eventLocation}` : ""}`}
                    >
                        <PartyPopper className="h-3 w-3 shrink-0" />
                        <span className="truncate flex-1">
                            🎪 {rangeShort}
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
