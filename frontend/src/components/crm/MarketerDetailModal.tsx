"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { X, Loader2, ChevronRight, MapPin, Building2, Trophy, XCircle, CalendarCheck, CalendarX } from "lucide-react";
import { getMarketerOutcomes, type OutcomeLead } from "@/lib/api/crm";

interface Props {
    open: boolean;
    onClose: () => void;
    workerId: number | null;
    workerName: string | null;
    period?: { from?: string; to?: string };
}

function fmtRp(v: number) {
    if (!isFinite(v) || v === 0) return "Rp 0";
    return `Rp ${Math.round(v).toLocaleString("id-ID")}`;
}

function fmtDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

// Kelas literal (bukan interpolasi) supaya tidak ter-purge Tailwind.
const ACCENT = {
    success: { text: "text-success", badge: "bg-success/12 text-success", hover: "hover:border-success/40 hover:bg-success/5" },
    destructive: { text: "text-destructive", badge: "bg-destructive/12 text-destructive", hover: "hover:border-destructive/40 hover:bg-destructive/5" },
} as const;

export function MarketerDetailModal({ open, onClose, workerId, workerName, period }: Props) {
    const router = useRouter();
    const { data, isLoading } = useQuery({
        queryKey: ["crm-marketer-outcomes", workerId ?? 0, period?.from ?? "", period?.to ?? ""],
        queryFn: () => getMarketerOutcomes({ workerId: workerId!, ...period }),
        enabled: open && workerId != null,
    });

    if (!open) return null;

    const openLead = (id: number) => {
        onClose();
        router.push(`/crm/board?leadId=${id}`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                className="glass-strong rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
                    <div>
                        <h2 className="font-bold text-foreground">Detail Lead — {workerName ?? "Marketing"}</h2>
                        <p className="text-xs text-muted-foreground">Closing & gagal pada periode terpilih.</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-muted cursor-pointer transition-colors" aria-label="Tutup">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto px-5 py-4 flex-1 space-y-5">
                    {isLoading && (
                        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" /> Memuat data...
                        </div>
                    )}

                    {!isLoading && data && (
                        <>
                            <OutcomeSection
                                title="Closing (Deal)"
                                icon={<Trophy className="h-4 w-4 text-success" />}
                                accent="success"
                                count={data.closed.count}
                                total={data.closed.totalValue}
                                leads={data.closed.leads}
                                dateKind="closing"
                                onLead={openLead}
                            />
                            <OutcomeSection
                                title="Gagal / Lost"
                                icon={<XCircle className="h-4 w-4 text-destructive" />}
                                accent="destructive"
                                count={data.lost.count}
                                total={data.lost.totalValue}
                                leads={data.lost.leads}
                                dateKind="lost"
                                onLead={openLead}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function OutcomeSection({
    title,
    icon,
    accent,
    count,
    total,
    leads,
    dateKind,
    onLead,
}: {
    title: string;
    icon: React.ReactNode;
    accent: keyof typeof ACCENT;
    count: number;
    total: number;
    leads: OutcomeLead[];
    dateKind: "closing" | "lost";
    onLead: (id: number) => void;
}) {
    const c = ACCENT[accent];
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                    {icon}
                    <span>{title}</span>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold nums ${c.badge}`}>{count}</span>
                </div>
                <div className={`text-sm font-bold nums ${c.text}`}>{fmtRp(total)}</div>
            </div>
            {count === 0 ? (
                <div className="text-xs text-muted-foreground py-3 text-center">Tidak ada data.</div>
            ) : (
                <div className="space-y-1.5">
                    {leads.map((l) => (
                        <button
                            key={l.id}
                            onClick={() => onLead(l.id)}
                            className={`w-full text-left bg-card border border-border rounded-lg p-2.5 flex items-center gap-2 cursor-pointer transition-colors ${c.hover}`}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-foreground truncate">{l.name?.trim() || "— anonim —"}</span>
                                    <span className="font-mono text-[10px] text-muted-foreground">{l.phone}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                                    {l.organization && (
                                        <span className="inline-flex items-center gap-0.5">
                                            <Building2 className="h-2.5 w-2.5" /> {l.organization}
                                        </span>
                                    )}
                                    {l.city && (
                                        <span className="inline-flex items-center gap-0.5">
                                            <MapPin className="h-2.5 w-2.5" /> {l.city}
                                        </span>
                                    )}
                                    {l.stage && (
                                        <span
                                            className="inline-flex items-center px-1.5 py-0.5 rounded-full font-medium"
                                            style={{ backgroundColor: `${l.stage.color}20`, color: l.stage.color }}
                                        >
                                            {l.stage.name}
                                        </span>
                                    )}
                                    {dateKind === "closing" ? (
                                        <span className={`inline-flex items-center gap-0.5 font-semibold ${c.text}`}>
                                            <CalendarCheck className="h-2.5 w-2.5" /> Closing: {fmtDate(l.closedDealAt ?? l.updatedAt)}
                                        </span>
                                    ) : (
                                        <span className={`inline-flex items-center gap-0.5 font-semibold ${c.text}`}>
                                            <CalendarX className="h-2.5 w-2.5" /> Lost: {fmtDate(l.updatedAt)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`text-xs font-bold nums ${c.text}`}>{fmtRp(Number(l.projectValueEst ?? 0))}</span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
