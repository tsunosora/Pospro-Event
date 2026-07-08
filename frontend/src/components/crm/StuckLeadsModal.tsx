"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, X, MapPin, Building2, ChevronRight, Clock, Loader2, PartyPopper } from "lucide-react";
import { getStuckLeads, LEAD_STATUS_META, type StuckLead } from "@/lib/api/crm";

interface Props {
    open: boolean;
    onClose: () => void;
    /** Kalau di-set, modal hanya tampilkan lead stuck milik marketing ini. Null = semua marketing. */
    workerId?: number | null;
    workerName?: string | null;
    /** Periode filter (dari preset di halaman performa). */
    period?: { from?: string; to?: string };
}

export function StuckLeadsModal({ open, onClose, workerId, workerName, period }: Props) {
    const router = useRouter();

    const { data, isLoading } = useQuery({
        queryKey: ["crm-stuck-leads", workerId ?? "all", period?.from ?? "", period?.to ?? ""],
        queryFn: () => getStuckLeads({ workerId: workerId ?? undefined, ...period }),
        enabled: open,
    });

    const leads = data ?? [];

    // Kelompokkan per marketing kalau modal menampilkan semua marketing.
    const groups = useMemo(() => {
        if (workerId) return null;
        const map = new Map<string, { name: string; leads: StuckLead[] }>();
        for (const l of leads) {
            const key = l.assignedWorker ? `w:${l.assignedWorker.id}` : "none";
            const name = l.assignedWorker?.name ?? "Belum di-assign";
            if (!map.has(key)) map.set(key, { name, leads: [] });
            map.get(key)!.leads.push(l);
        }
        return Array.from(map.values()).sort((a, b) => b.leads.length - a.leads.length);
    }, [leads, workerId]);

    if (!open) return null;

    const openLead = (id: number) => {
        onClose();
        router.push(`/crm/board?leadId=${id}`);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={onClose}
        >
            <div
                className="glass-strong rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-destructive/10 rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        <div>
                            <h2 className="font-bold text-destructive">
                                {workerId ? `Lead Stuck — ${workerName ?? "Marketing"}` : "Peringatan: Lead Stuck"}
                            </h2>
                            <p className="text-xs text-destructive/90">
                                Lead masih open & belum di-follow up &gt; 7 hari. Klik lead untuk buka pipeline.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-destructive/10 text-destructive cursor-pointer transition-colors"
                        aria-label="Tutup"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto px-5 py-4 flex-1">
                    {isLoading && (
                        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" /> Memuat data...
                        </div>
                    )}

                    {!isLoading && leads.length === 0 && (
                        <div className="text-center py-10">
                            <PartyPopper className="h-10 w-10 mx-auto mb-2 text-success" />
                            <div className="font-semibold text-success">Tidak ada lead stuck!</div>
                            <div className="text-xs text-muted-foreground mt-1">
                                Semua lead aktif sudah di-follow up dalam 7 hari terakhir.
                            </div>
                        </div>
                    )}

                    {!isLoading && leads.length > 0 && groups && (
                        <div className="space-y-4">
                            {groups.map((g) => (
                                <div key={g.name}>
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                            {g.name}
                                        </span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/12 text-destructive font-bold">
                                            <span className="nums">{g.leads.length}</span> stuck
                                        </span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {g.leads.map((l) => (
                                            <StuckLeadRow key={l.id} lead={l} onClick={() => openLead(l.id)} />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!isLoading && leads.length > 0 && !groups && (
                        <div className="space-y-1.5">
                            {leads.map((l) => (
                                <StuckLeadRow key={l.id} lead={l} onClick={() => openLead(l.id)} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!isLoading && leads.length > 0 && (
                    <div className="px-5 py-3 border-t border-border bg-muted rounded-b-xl text-xs text-muted-foreground">
                        Total <b className="nums">{leads.length}</b> lead stuck perlu segera di-follow up.
                    </div>
                )}
            </div>
        </div>
    );
}

function StuckLeadRow({ lead, onClick }: { lead: StuckLead; onClick: () => void }) {
    const statusMeta = LEAD_STATUS_META[lead.status];
    return (
        <button
            onClick={onClick}
            className="w-full text-left bg-card border border-border rounded-lg p-2.5 flex items-center gap-2 hover:border-destructive/40 hover:bg-destructive/5 cursor-pointer transition-colors"
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground truncate">
                        {lead.name?.trim() || "— anonim —"}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">{lead.phone}</span>
                    {statusMeta && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${statusMeta.bg} ${statusMeta.text} ${statusMeta.border}`}>
                            {statusMeta.emoji} {statusMeta.label}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                    {lead.eventLocation && (
                        <span className="inline-flex items-center gap-0.5">
                            <Building2 className="h-2.5 w-2.5" /> {lead.eventLocation}
                        </span>
                    )}
                    {lead.city && (
                        <span className="inline-flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" /> {lead.city}
                        </span>
                    )}
                    {lead.stage && (
                        <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: `${lead.stage.color}20`, color: lead.stage.color }}
                        >
                            {lead.stage.name}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-destructive/12 text-destructive font-bold nums">
                    <Clock className="h-2.5 w-2.5" />
                    {lead.daysStuck}h
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
        </button>
    );
}
