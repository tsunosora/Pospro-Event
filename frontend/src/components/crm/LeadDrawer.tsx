"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    addActivity,
    convertLead,
    deleteLead,
    getLead,
    listActivities,
    updateLead,
    waLink,
    type Lead,
    type LeadActivity,
} from "@/lib/api/crm";
import { LevelBadge } from "./LevelBadge";
import { WaButton } from "./WaButton";
import { BrandBadge } from "@/components/BrandBadge";
import { Building2, MapPin, Trash2, X, MessageCircle, FileText, Send, CheckCircle2 } from "lucide-react";

const ACTIVITY_LABELS: Record<string, string> = {
    GREETING_SENT: "Greeting terkirim",
    COMPRO_SENT: "Company Profile terkirim",
    RESPONSE: "Klien merespon",
    NOTE: "Catatan",
    STAGE_CHANGED: "Pindah stage",
    CONVERTED: "Convert ke Customer",
    CALL: "Panggilan telepon",
    WHATSAPP: "Pesan WhatsApp",
};

export function LeadDrawer({
    leadId,
    open,
    onClose,
}: {
    leadId: number | null;
    open: boolean;
    onClose: () => void;
}) {
    const qc = useQueryClient();
    const [tab, setTab] = useState<"detail" | "activities" | "convert">("detail");
    const [noteText, setNoteText] = useState("");

    useEffect(() => {
        if (open) setTab("detail");
    }, [open, leadId]);

    const { data: lead } = useQuery({
        queryKey: ["crm-lead", leadId],
        queryFn: () => getLead(leadId!),
        enabled: open && !!leadId,
    });

    const { data: activities = [] } = useQuery({
        queryKey: ["crm-lead-activities", leadId],
        queryFn: () => listActivities(leadId!),
        enabled: open && !!leadId && tab === "activities",
    });

    const updateMut = useMutation({
        mutationFn: (data: Partial<Lead>) => updateLead(leadId!, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });
            qc.invalidateQueries({ queryKey: ["crm-board"] });
        },
    });

    const activityMut = useMutation({
        mutationFn: (input: { kind: string; text?: string }) => addActivity(leadId!, input),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["crm-lead-activities", leadId] });
            qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });
            setNoteText("");
        },
    });

    const convertMut = useMutation({
        mutationFn: (input: { createQuotation?: boolean; quotationVariant?: string; createRab?: boolean }) =>
            convertLead(leadId!, input),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });
            qc.invalidateQueries({ queryKey: ["crm-board"] });
            qc.invalidateQueries({ queryKey: ["crm-stats"] });
        },
    });

    const deleteMut = useMutation({
        mutationFn: () => deleteLead(leadId!),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["crm-board"] });
            onClose();
        },
    });

    if (!open || !leadId) return null;

    const display = lead?.name?.trim() || `— ${lead?.phoneNormalized.slice(-4) || ""}`;
    const isWinStage = lead?.stage?.isWinStage;
    const alreadyConverted = !!lead?.convertedCustomerId;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="fixed inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-background w-full max-w-md h-full overflow-y-auto border-l border-border shadow-xl">
                <div className="sticky top-0 bg-background z-10 border-b border-border p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="font-bold text-base truncate">{display}</h2>
                            <LevelBadge level={lead?.level} />
                            {lead && <BrandBadge brand={lead.brand} size="xs" />}
                        </div>
                        {lead?.stage && (
                            <div className="text-xs text-muted-foreground">
                                Stage: <span className="font-medium" style={{ color: lead.stage.color }}>{lead.stage.name}</span>
                            </div>
                        )}
                        {lead?.assignedWorker && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                                Marketing: <span className="font-medium text-slate-800">{lead.assignedWorker.name}</span>
                            </div>
                        )}
                        {lead?.previousAssignedWorker && (
                            <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                                🔄 Sebelumnya dipegang oleh <b>{lead.previousAssignedWorker.name}</b>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="border-b border-border bg-muted/30 px-3 py-2 flex gap-1">
                    {[
                        { k: "detail", label: "Detail" },
                        { k: "activities", label: "Aktivitas" },
                        { k: "convert", label: "Convert" },
                    ].map((t) => (
                        <button
                            key={t.k}
                            onClick={() => setTab(t.k as any)}
                            className={`px-3 py-1.5 text-xs font-medium rounded transition ${tab === t.k
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-muted"
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === "detail" && lead && (
                    <div className="p-3 space-y-3">
                        <div className="flex flex-wrap gap-2">
                            <WaButton phone={lead.phone} text={lead.greetingTemplate || undefined} />
                            <a
                                href={`tel:${lead.phone}`}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium border border-border bg-muted text-foreground hover:bg-muted/70"
                            >
                                Call {lead.phone}
                            </a>
                        </div>

                        <Field label="Nomor HP" value={lead.phone} />
                        <Field label="Organization" value={lead.organization} icon={<Building2 className="h-3 w-3" />} />
                        <Field label="Product Category" value={lead.productCategory} />
                        <Field label="Kota" value={lead.city} icon={<MapPin className="h-3 w-3" />} />
                        <Field label="Order Description" value={lead.orderDescription} />
                        <Field label="Project Value Est." value={lead.projectValueEst ? `Rp ${Number(lead.projectValueEst).toLocaleString("id-ID")}` : null} />
                        <Field label="Event Date" value={lead.eventDate ? new Date(lead.eventDate).toLocaleDateString("id-ID") : null} />
                        <Field label="Event Location" value={lead.eventLocation} icon={<MapPin className="h-3 w-3" />} />
                        <Field label="Source" value={lead.source} />
                        <Field label="Greeting Template" value={lead.greetingTemplate} />
                        <Field label="Notes" value={lead.notes} multiline />
                        <Field label="Lead Came At" value={new Date(lead.leadCameAt).toLocaleString("id-ID")} />
                        <Field label="Last Contacted" value={lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleString("id-ID") : null} />

                        <button
                            onClick={() => {
                                if (confirm("Hapus lead ini?")) deleteMut.mutate();
                            }}
                            className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100"
                        >
                            <Trash2 className="h-4 w-4" />
                            Hapus Lead
                        </button>
                    </div>
                )}

                {tab === "activities" && (
                    <div className="p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-1.5">
                            <QuickAction
                                icon={<Send className="h-3.5 w-3.5" />}
                                label="Greeting terkirim"
                                onClick={() => activityMut.mutate({ kind: "GREETING_SENT" })}
                                pending={activityMut.isPending}
                            />
                            <QuickAction
                                icon={<FileText className="h-3.5 w-3.5" />}
                                label="ComPro terkirim"
                                onClick={() => activityMut.mutate({ kind: "COMPRO_SENT" })}
                                pending={activityMut.isPending}
                            />
                            <QuickAction
                                icon={<MessageCircle className="h-3.5 w-3.5" />}
                                label="Klien merespon"
                                onClick={() => activityMut.mutate({ kind: "RESPONSE" })}
                                pending={activityMut.isPending}
                            />
                            <QuickAction
                                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                                label="Tidak Merespon"
                                onClick={() => updateMut.mutate({ status: "NO_RESPONSE" })}
                                pending={updateMut.isPending}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Tulis catatan baru..."
                                rows={2}
                                className="w-full text-sm border border-border rounded-md p-2 bg-background"
                            />
                            <button
                                disabled={!noteText.trim() || activityMut.isPending}
                                onClick={() => activityMut.mutate({ kind: "NOTE", text: noteText.trim() })}
                                className="w-full px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                            >
                                + Tambah Catatan
                            </button>
                        </div>

                        <div className="border-t border-border pt-2">
                            <h3 className="text-xs font-semibold text-muted-foreground mb-2">Timeline</h3>
                            <div className="space-y-2">
                                {activities.length === 0 && (
                                    <div className="text-xs text-muted-foreground/70 text-center py-3">
                                        Belum ada aktivitas
                                    </div>
                                )}
                                {activities.map((a) => (
                                    <ActivityItem key={a.id} a={a} />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {tab === "convert" && lead && (
                    <div className="p-3 space-y-3">
                        {alreadyConverted ? (
                            <div className="space-y-2">
                                <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
                                    ✓ Lead ini sudah di-convert ke Customer{" "}
                                    <a href={`/customers/${lead.convertedCustomerId}`} className="underline font-medium">
                                        #{lead.convertedCustomerId}
                                    </a>
                                </div>
                                <div className="text-xs text-muted-foreground">Langkah berikutnya:</div>
                                <a
                                    href={`/penawaran?customerId=${lead.convertedCustomerId}`}
                                    className="block px-3 py-2 rounded-md border border-border bg-background text-sm hover:bg-muted"
                                >
                                    📄 Buat Penawaran untuk customer ini
                                </a>
                                <a
                                    href={`/rab?customerId=${lead.convertedCustomerId}`}
                                    className="block px-3 py-2 rounded-md border border-border bg-background text-sm hover:bg-muted"
                                >
                                    💰 Buat RAB untuk customer ini
                                </a>
                                <a
                                    href={`/customers/${lead.convertedCustomerId}`}
                                    className="block px-3 py-2 rounded-md border border-border bg-background text-sm hover:bg-muted"
                                >
                                    👤 Buka detail customer
                                </a>
                            </div>
                        ) : (
                            <>
                                <p className="text-sm text-muted-foreground">
                                    Convert lead ini menjadi <strong className="text-foreground">Customer</strong>{" "}
                                    di pospenawaran. Setelah convert, lead tetap tersimpan untuk histori.
                                </p>
                                {!isWinStage && (
                                    <div className="p-2 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800">
                                        Lead masih di stage <strong>{lead.stage?.name}</strong>. Disarankan pindahkan ke stage <strong>Closed Deal</strong> dulu.
                                    </div>
                                )}
                                {!lead.name?.trim() && (
                                    <div className="p-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-800">
                                        Nama lead masih kosong — isi dulu via tab Detail.
                                    </div>
                                )}
                                <button
                                    disabled={!lead.name?.trim() || convertMut.isPending}
                                    onClick={() => {
                                        if (confirm(`Convert "${lead.name}" jadi Customer?`)) {
                                            convertMut.mutate({});
                                        }
                                    }}
                                    className="w-full px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                                >
                                    {convertMut.isPending ? "Memproses..." : "Convert ke Customer"}
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function Field({ label, value, icon, multiline }: { label: string; value: string | null | undefined; icon?: React.ReactNode; multiline?: boolean }) {
    if (!value) return null;
    return (
        <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5 flex items-center gap-1">
                {icon}
                {label}
            </div>
            <div className={`text-sm ${multiline ? "whitespace-pre-wrap" : ""}`}>{value}</div>
        </div>
    );
}

function QuickAction({ icon, label, onClick, pending }: { icon: React.ReactNode; label: string; onClick: () => void; pending: boolean }) {
    return (
        <button
            disabled={pending}
            onClick={onClick}
            className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border border-border bg-muted/40 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
            {icon}
            {label}
        </button>
    );
}

function ActivityItem({ a }: { a: LeadActivity }) {
    const label = ACTIVITY_LABELS[a.kind] || a.kind;
    return (
        <div className="border-l-2 border-primary/40 pl-2 py-0.5">
            <div className="text-xs font-medium">{label}</div>
            {a.text && <div className="text-xs text-muted-foreground whitespace-pre-wrap">{a.text}</div>}
            <div className="text-[10px] text-muted-foreground/70 font-mono">
                {new Date(a.createdAt).toLocaleString("id-ID")}
            </div>
        </div>
    );
}
