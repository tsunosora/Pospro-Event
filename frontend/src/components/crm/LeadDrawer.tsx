"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    addActivity,
    convertLead,
    deleteLead,
    getLead,
    listActivities,
    removeLeadImage,
    updateLead,
    uploadLeadImage,
    waLink,
    LEAD_STATUS_META,
    LEAD_STATUS_ORDER,
    LEAD_SOURCE_META,
    LEAD_SOURCE_ORDER,
    type Lead,
    type LeadActivity,
    type LeadSource,
    type LeadStatus,
} from "@/lib/api/crm";
import { LevelBadge } from "./LevelBadge";
import { WaButton } from "./WaButton";
import { formatLeadEventDateRange } from "@/lib/utils/date-range";
import { BrandBadge } from "@/components/BrandBadge";
import { AdditionalEventsEditor, additionalEventsToEditor, editorToAdditionalEvents, type AdditionalEvent } from "./AdditionalEventsEditor";
import { createQuotationFromLead } from "@/lib/api/quotations";
import { useRouter } from "next/navigation";
import { Building2, Check, ImagePlus, Loader2, MapPin, Pencil, Trash2, X, MessageCircle, FileText, Send, CheckCircle2 } from "lucide-react";

const LEAD_LEVELS: Array<{ value: "" | "HOT" | "WARM" | "COLD" | "UNQUALIFIED"; label: string }> = [
    { value: "", label: "— (kosong)" },
    { value: "HOT", label: "🔴 HOT" },
    { value: "WARM", label: "🟡 WARM" },
    { value: "COLD", label: "🔵 COLD" },
    { value: "UNQUALIFIED", label: "⚫ UNQUALIFIED" },
];

// Note: LEAD_SOURCES sekarang ambil dari LEAD_SOURCE_META + LEAD_SOURCE_ORDER (lib/api/crm.ts)
// supaya konsisten dengan list di /crm/leads/new — single source of truth.

/** Convert ISO datetime ke format "YYYY-MM-DD" untuk <input type="date">. */
function toDateInput(iso: string | null | undefined): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
}

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
    const router = useRouter();
    const [tab, setTab] = useState<"detail" | "activities" | "convert">("detail");
    const [noteText, setNoteText] = useState("");
    const [editAdditionalEvents, setEditAdditionalEvents] = useState<AdditionalEvent[]>([]);

    // Edit mode state — controlled inputs untuk semua field yang bisa di-edit
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState<{
        name: string;
        phone: string;
        organization: string;
        productCategory: string;
        city: string;
        level: "" | "HOT" | "WARM" | "COLD" | "UNQUALIFIED";
        status: LeadStatus;
        source: LeadSource;
        sourceDetail: string;
        followUpDate: string;
        eventDateStart: string;
        eventDateEnd: string;
        eventLocation: string;
        orderDescription: string;
        projectValueEst: string;
        greetingTemplate: string;
        notes: string;
    }>({
        name: "", phone: "", organization: "", productCategory: "", city: "",
        level: "", status: "NEW", source: "OTHER", sourceDetail: "",
        followUpDate: "", eventDateStart: "", eventDateEnd: "", eventLocation: "",
        orderDescription: "", projectValueEst: "", greetingTemplate: "", notes: "",
    });

    useEffect(() => {
        if (open) {
            setTab("detail");
            setEditMode(false);
        }
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
            setEditMode(false);
        },
        onError: (e: any) => {
            alert(`❌ Gagal simpan: ${e?.response?.data?.message || e?.message || "Unknown"}`);
        },
    });

    // Populate form saat masuk edit mode (atau lead berubah saat sedang edit)
    function startEdit() {
        if (!lead) return;
        setEditForm({
            name: lead.name ?? "",
            phone: lead.phone ?? "",
            organization: lead.organization ?? "",
            productCategory: lead.productCategory ?? "",
            city: lead.city ?? "",
            level: (lead.level ?? "") as any,
            status: lead.status,
            source: lead.source,
            sourceDetail: lead.sourceDetail ?? "",
            followUpDate: toDateInput(lead.followUpDate),
            eventDateStart: toDateInput(lead.eventDateStart),
            eventDateEnd: toDateInput(lead.eventDateEnd),
            eventLocation: lead.eventLocation ?? "",
            orderDescription: lead.orderDescription ?? "",
            projectValueEst: lead.projectValueEst ?? "",
            greetingTemplate: lead.greetingTemplate ?? "",
            notes: lead.notes ?? "",
        });
        setEditAdditionalEvents(additionalEventsToEditor(lead.additionalEvents));
        setEditMode(true);
    }

    function saveEdit() {
        const payload: Partial<Lead> = {
            name: editForm.name.trim() || null,
            phone: editForm.phone.trim(),
            organization: editForm.organization.trim() || null,
            productCategory: editForm.productCategory.trim() || null,
            city: editForm.city.trim() || null,
            level: (editForm.level || null) as any,
            status: editForm.status,
            source: editForm.source,
            sourceDetail: editForm.sourceDetail.trim() || null,
            followUpDate: editForm.followUpDate ? new Date(editForm.followUpDate).toISOString() : null,
            eventDateStart: editForm.eventDateStart ? new Date(editForm.eventDateStart).toISOString() : null,
            eventDateEnd: editForm.eventDateEnd ? new Date(editForm.eventDateEnd).toISOString() : null,
            eventLocation: editForm.eventLocation.trim() || null,
            additionalEvents: editorToAdditionalEvents(editAdditionalEvents) as any,
            orderDescription: editForm.orderDescription.trim() || null,
            projectValueEst: editForm.projectValueEst.trim() || null,
            greetingTemplate: editForm.greetingTemplate.trim() || null,
            notes: editForm.notes.trim() || null,
        };
        updateMut.mutate(payload);
    }

    // Image upload state & mutations
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadImageMut = useMutation({
        mutationFn: (file: File) => uploadLeadImage(leadId!, file),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });
            qc.invalidateQueries({ queryKey: ["crm-board"] });
        },
        onError: (e: any) => {
            alert(`❌ Gagal upload: ${e?.response?.data?.message || e?.message || "Unknown"}`);
        },
    });
    const removeImageMut = useMutation({
        mutationFn: () => removeLeadImage(leadId!),
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


                        {/* Image / Foto Referensi */}
                        <div className="space-y-1.5">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Foto Referensi
                            </div>
                            {lead.imageUrl ? (
                                <div className="relative group rounded-lg border border-border overflow-hidden bg-muted/20">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={`${process.env.NEXT_PUBLIC_API_URL ?? ""}${lead.imageUrl}`}
                                        alt={`Foto ${lead.name ?? "lead"}`}
                                        className="w-full max-h-64 object-contain bg-muted/10"
                                    />
                                    <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploadImageMut.isPending || removeImageMut.isPending}
                                            className="px-2 py-1 rounded-md text-[10px] font-medium bg-background/90 backdrop-blur border border-border hover:bg-muted shadow disabled:opacity-50"
                                            title="Ganti foto"
                                        >
                                            Ganti
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (confirm("Hapus foto referensi lead?")) removeImageMut.mutate();
                                            }}
                                            disabled={removeImageMut.isPending || uploadImageMut.isPending}
                                            className="px-2 py-1 rounded-md text-[10px] font-medium bg-red-500/90 text-white hover:bg-red-600 shadow disabled:opacity-50"
                                            title="Hapus foto"
                                        >
                                            {removeImageMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Hapus"}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadImageMut.isPending}
                                    className="w-full border-2 border-dashed border-border rounded-lg p-4 hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center gap-1 text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {uploadImageMut.isPending ? (
                                        <>
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                            <span className="text-xs">Mengupload...</span>
                                        </>
                                    ) : (
                                        <>
                                            <ImagePlus className="h-6 w-6" />
                                            <span className="text-xs">Tambah foto referensi</span>
                                            <span className="text-[10px] opacity-70">JPG/PNG/WebP, max 5 MB</span>
                                        </>
                                    )}
                                </button>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) uploadImageMut.mutate(file);
                                    e.target.value = ""; // reset supaya bisa pilih file sama 2x
                                }}
                            />
                        </div>

                        {/* Toggle Edit / Read mode */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {editMode ? "Edit Detail Lead" : "Detail Lead"}
                            </div>
                            {!editMode ? (
                                <button
                                    onClick={startEdit}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border border-border bg-card hover:bg-muted/60 transition"
                                >
                                    <Pencil className="h-3 w-3" />
                                    Edit
                                </button>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setEditMode(false)}
                                        disabled={updateMut.isPending}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border border-border bg-card hover:bg-muted/60 transition disabled:opacity-50"
                                    >
                                        <X className="h-3 w-3" />
                                        Batal
                                    </button>
                                    <button
                                        onClick={saveEdit}
                                        disabled={updateMut.isPending}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
                                    >
                                        {updateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                        {updateMut.isPending ? "Menyimpan..." : "Simpan"}
                                    </button>
                                </div>
                            )}
                        </div>

                        {!editMode ? (
                            <>
                                {(() => {
                                    const m = LEAD_STATUS_META[lead.status];
                                    if (!m) return null;
                                    return (
                                        <div>
                                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Status</div>
                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${m.bg} ${m.text} border ${m.border}`}
                                            >
                                                {m.emoji} {m.label}
                                            </span>
                                        </div>
                                    );
                                })()}
                                <Field label="Nomor HP" value={lead.phone} />
                                <Field label="Organization" value={lead.organization} icon={<Building2 className="h-3 w-3" />} />
                                <Field label="Product Category" value={lead.productCategory} />
                                <Field label="Kota" value={lead.city} icon={<MapPin className="h-3 w-3" />} />
                                <Field label="Order Description" value={lead.orderDescription} />
                                <Field label="Project Value Est." value={lead.projectValueEst ? `Rp ${Number(lead.projectValueEst).toLocaleString("id-ID")}` : null} />
                                <Field label="Tanggal Event" value={formatLeadEventDateRange(lead)} />
                                <Field label="Event Location" value={lead.eventLocation} icon={<MapPin className="h-3 w-3" />} />
                                {lead.additionalEvents && lead.additionalEvents.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-semibold text-muted-foreground uppercase">🎪 Event Tambahan ({lead.additionalEvents.length})</div>
                                        {lead.additionalEvents.map((ev, idx) => (
                                            <div key={idx} className="text-xs bg-slate-50 border border-slate-200 rounded p-2 space-y-0.5">
                                                <div className="font-semibold text-slate-800">#{idx + 2} {ev.name || <span className="italic text-slate-400">(tanpa nama)</span>}</div>
                                                {ev.location && <div className="flex items-center gap-1 text-[11px]"><MapPin className="h-3 w-3 text-slate-400" />{ev.location}</div>}
                                                {(ev.dateStart || ev.dateEnd) && (
                                                    <div className="text-[10px] text-slate-500">
                                                        {ev.dateStart ? new Date(ev.dateStart).toLocaleDateString("id-ID") : "?"}
                                                        {ev.dateEnd ? ` — ${new Date(ev.dateEnd).toLocaleDateString("id-ID")}` : ""}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <Field label="Source" value={lead.source} />
                                <Field label="Greeting Template" value={lead.greetingTemplate} />
                                <Field label="Notes" value={lead.notes} multiline />
                                <Field label="Lead Came At" value={new Date(lead.leadCameAt).toLocaleString("id-ID")} />
                                <Field label="Last Contacted" value={lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleString("id-ID") : null} />
                            </>
                        ) : (
                            <div className="space-y-2.5">
                                <EditField label="Nama" value={editForm.name} onChange={v => setEditForm(f => ({ ...f, name: v }))} />
                                <EditField label="Nomor HP" value={editForm.phone} onChange={v => setEditForm(f => ({ ...f, phone: v }))} required />
                                <EditField label="Organization" value={editForm.organization} onChange={v => setEditForm(f => ({ ...f, organization: v }))} />
                                <EditField label="Product Category" value={editForm.productCategory} onChange={v => setEditForm(f => ({ ...f, productCategory: v }))} />
                                <EditField label="Kota" value={editForm.city} onChange={v => setEditForm(f => ({ ...f, city: v }))} />
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-muted-foreground">Status Lead</label>
                                    <select
                                        value={editForm.status}
                                        onChange={(e) => setEditForm(f => ({ ...f, status: e.target.value as LeadStatus }))}
                                        className="w-full px-2 py-1.5 text-xs border border-input rounded-md bg-background"
                                    >
                                        {LEAD_STATUS_ORDER.map(s => {
                                            const m = LEAD_STATUS_META[s];
                                            return <option key={s} value={s}>{m.emoji} {m.label}</option>;
                                        })}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-medium text-muted-foreground">Level</label>
                                        <select
                                            value={editForm.level}
                                            onChange={(e) => setEditForm(f => ({ ...f, level: e.target.value as any }))}
                                            className="w-full px-2 py-1.5 text-xs border border-input rounded-md bg-background"
                                        >
                                            {LEAD_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-medium text-muted-foreground">Source</label>
                                        <select
                                            value={editForm.source}
                                            onChange={(e) => setEditForm(f => ({ ...f, source: e.target.value as LeadSource }))}
                                            className="w-full px-2 py-1.5 text-xs border border-input rounded-md bg-background"
                                        >
                                            {LEAD_SOURCE_ORDER.map(s => {
                                                const m = LEAD_SOURCE_META[s];
                                                return <option key={s} value={s}>{m.emoji} {m.label}</option>;
                                            })}
                                        </select>
                                    </div>
                                </div>
                                <EditField label="Source Detail" value={editForm.sourceDetail} onChange={v => setEditForm(f => ({ ...f, sourceDetail: v }))} placeholder="mis. nama campaign Meta Ads" />
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-medium text-muted-foreground">Follow-Up Date</label>
                                        <input
                                            type="date"
                                            value={editForm.followUpDate}
                                            onChange={(e) => setEditForm(f => ({ ...f, followUpDate: e.target.value }))}
                                            className="w-full px-2 py-1.5 text-xs border border-input rounded-md bg-background"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-medium text-muted-foreground">Tgl Mulai Event</label>
                                        <input
                                            type="date"
                                            value={editForm.eventDateStart}
                                            onChange={(e) => setEditForm(f => ({ ...f, eventDateStart: e.target.value }))}
                                            className="w-full px-2 py-1.5 text-xs border border-input rounded-md bg-background"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-muted-foreground">Tgl Selesai Event (opsional)</label>
                                    <input
                                        type="date"
                                        value={editForm.eventDateEnd}
                                        onChange={(e) => setEditForm(f => ({ ...f, eventDateEnd: e.target.value }))}
                                        min={editForm.eventDateStart || undefined}
                                        disabled={!editForm.eventDateStart}
                                        className="w-full px-2 py-1.5 text-xs border border-input rounded-md bg-background disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <p className="text-[9px] text-muted-foreground">💡 Untuk event multi-hari (mis. 1-3 Mei).</p>
                                </div>
                                <EditField label="Event Location" value={editForm.eventLocation} onChange={v => setEditForm(f => ({ ...f, eventLocation: v }))} />
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-muted-foreground">
                                        🎪 Event Tambahan (multi-kota / multi-tanggal)
                                    </label>
                                    <AdditionalEventsEditor
                                        value={editAdditionalEvents}
                                        onChange={setEditAdditionalEvents}
                                        compact
                                    />
                                </div>
                                <EditField label="Project Value Est. (Rp)" value={editForm.projectValueEst} onChange={v => setEditForm(f => ({ ...f, projectValueEst: v.replace(/[^\d.]/g, "") }))} placeholder="50000000" />
                                <EditField label="Order Description" value={editForm.orderDescription} onChange={v => setEditForm(f => ({ ...f, orderDescription: v }))} multiline />
                                <EditField label="Greeting Template" value={editForm.greetingTemplate} onChange={v => setEditForm(f => ({ ...f, greetingTemplate: v }))} multiline placeholder="Pesan WhatsApp template" />
                                <EditField label="Notes" value={editForm.notes} onChange={v => setEditForm(f => ({ ...f, notes: v }))} multiline />
                            </div>
                        )}

                        {/* Status Dokumen — sebelum tombol Hapus Lead. Hanya kalau lead sudah converted. */}
                        {lead.convertedCustomerId && (
                            <div className="rounded-md border border-emerald-200 bg-emerald-50/30 p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 flex items-center gap-1">
                                        📊 Status Dokumen
                                    </span>
                                    <a
                                        href={`/customers/${lead.convertedCustomerId}`}
                                        className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 border border-violet-200 hover:bg-violet-200 font-semibold"
                                    >
                                        👤 Customer #{lead.convertedCustomerId}
                                    </a>
                                </div>

                                {/* RAB section */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                                            🧮 RAB
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                            {lead.convertedCustomer?.rabPlans?.length ?? 0} dokumen
                                        </span>
                                    </div>
                                    {(lead.convertedCustomer?.rabPlans?.length ?? 0) > 0 ? (
                                        <div className="space-y-1">
                                            {lead.convertedCustomer!.rabPlans!.map((r) => (
                                                <a
                                                    key={r.id}
                                                    href={`/rab/${r.id}`}
                                                    className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-400 transition"
                                                >
                                                    <span className="text-[10px] font-mono font-bold text-emerald-800">{r.code}</span>
                                                    <span className="text-[11px] text-slate-700 truncate flex-1">{r.title}</span>
                                                    <span className="text-[10px] text-emerald-700">→</span>
                                                </a>
                                            ))}
                                        </div>
                                    ) : (
                                        <a
                                            href={`/rab?customerId=${lead.convertedCustomerId}`}
                                            className="block text-center px-2 py-1.5 rounded text-[11px] font-medium border-2 border-dashed border-slate-300 text-slate-500 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
                                        >
                                            + Belum ada RAB — klik untuk buat baru
                                        </a>
                                    )}
                                </div>

                                {/* Penawaran section */}
                                <div className="space-y-1 pt-1 border-t border-dashed border-emerald-200">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                                            📄 Penawaran
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                            {lead.convertedCustomer?.invoices?.length ?? 0} dokumen
                                        </span>
                                    </div>
                                    {(lead.convertedCustomer?.invoices?.length ?? 0) > 0 ? (
                                        <div className="space-y-1">
                                            {lead.convertedCustomer!.invoices!.map((q) => (
                                                <a
                                                    key={q.id}
                                                    href={`/penawaran/${q.id}`}
                                                    className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:border-blue-400 transition"
                                                >
                                                    <span className="text-[10px] font-mono font-bold text-blue-800">{q.invoiceNumber}</span>
                                                    <span className="flex-1 text-right">
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 font-semibold">
                                                            {q.status}
                                                        </span>
                                                    </span>
                                                    <span className="text-[10px] text-blue-700">→</span>
                                                </a>
                                            ))}
                                        </div>
                                    ) : (
                                        <a
                                            href={`/penawaran?customerId=${lead.convertedCustomerId}`}
                                            className="block text-center px-2 py-1.5 rounded text-[11px] font-medium border-2 border-dashed border-slate-300 text-slate-500 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
                                        >
                                            + Belum ada Penawaran — klik untuk buat baru
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}

                        {!editMode && (
                            <button
                                onClick={() => {
                                    if (confirm("Hapus lead ini?")) deleteMut.mutate();
                                }}
                                className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100"
                            >
                                <Trash2 className="h-4 w-4" />
                                Hapus Lead
                            </button>
                        )}
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

                        {/* Quick status change — pakai select biar gak nambah tombol per-status */}
                        {lead && (
                            <div className="space-y-1 border-t border-border pt-3">
                                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Ubah Status Lead
                                </label>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${LEAD_STATUS_META[lead.status]?.bg} ${LEAD_STATUS_META[lead.status]?.text} border ${LEAD_STATUS_META[lead.status]?.border}`}
                                    >
                                        {LEAD_STATUS_META[lead.status]?.emoji} {LEAD_STATUS_META[lead.status]?.label}
                                    </span>
                                    <span className="text-muted-foreground text-xs">→</span>
                                    <select
                                        disabled={updateMut.isPending}
                                        value=""
                                        onChange={(e) => {
                                            const newStatus = e.target.value as LeadStatus;
                                            if (newStatus && newStatus !== lead.status) {
                                                updateMut.mutate({ status: newStatus });
                                            }
                                        }}
                                        className="flex-1 px-2 py-1.5 text-xs border border-input rounded-md bg-background disabled:opacity-50"
                                    >
                                        <option value="">— Pilih status baru —</option>
                                        {LEAD_STATUS_ORDER.filter(s => s !== lead.status).map(s => {
                                            const m = LEAD_STATUS_META[s];
                                            return <option key={s} value={s}>{m.emoji} {m.label}</option>;
                                        })}
                                    </select>
                                </div>
                            </div>
                        )}

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
                                {/* Tombol khusus: auto-pull event utama + additionalEvents dari Lead → Penawaran */}
                                <button
                                    onClick={async () => {
                                        if (!lead.id) return;
                                        const variant = window.confirm(
                                            "Pilih jenis Penawaran:\n\n" +
                                            "OK = SEWA (sewa booth/equipment)\n" +
                                            "Batal = PENGADAAN_BOOTH (jual/buat booth)"
                                        ) ? "SEWA" : "PENGADAAN_BOOTH";
                                        try {
                                            const q = await createQuotationFromLead(lead.id, variant as any);
                                            router.push(`/penawaran/${q.id}`);
                                        } catch (e: any) {
                                            alert(`❌ Gagal: ${e?.response?.data?.message || e?.message}`);
                                        }
                                    }}
                                    className="w-full text-left px-3 py-2 rounded-md border-2 border-blue-300 bg-blue-50 text-sm hover:bg-blue-100 text-blue-800 font-medium"
                                >
                                    📄 Buat Penawaran (auto-pull event & multi-kota dari Lead)
                                    {lead.additionalEvents && lead.additionalEvents.length > 0 && (
                                        <span className="block text-[10px] mt-0.5 text-blue-600">
                                            ✨ Lead ini punya {lead.additionalEvents.length + 1} event — semua akan ter-copy otomatis
                                        </span>
                                    )}
                                </button>
                                <a
                                    href={`/penawaran?customerId=${lead.convertedCustomerId}`}
                                    className="block px-3 py-2 rounded-md border border-border bg-background text-xs hover:bg-muted text-muted-foreground"
                                >
                                    📄 Atau buat Penawaran kosong dari customer ini
                                </a>
                                <a
                                    href={`/rab?customerId=${lead.convertedCustomerId}`}
                                    className="block px-3 py-2 rounded-md border border-border bg-background text-sm hover:bg-muted"
                                >
                                    💰 Buat RAB untuk customer ini
                                </a>
                                <a
                                    href={(() => {
                                        // Prefill event form dari data lead — nama event, venue, customer, brand, dll.
                                        const params = new URLSearchParams();
                                        params.set("customerId", String(lead.convertedCustomerId));
                                        if (lead.organization) params.set("customerName", lead.organization);
                                        if (lead.orderDescription || lead.organization) {
                                            params.set("name", lead.orderDescription || lead.organization || "");
                                        }
                                        if (lead.eventLocation) params.set("venue", lead.eventLocation);
                                        if (lead.eventDateStart) params.set("eventStart", lead.eventDateStart);
                                        if (lead.eventDateEnd) params.set("eventEnd", lead.eventDateEnd);
                                        if (lead.brand) params.set("brand", lead.brand);
                                        if (lead.assignedWorker?.name) params.set("picName", lead.assignedWorker.name);
                                        if (lead.notes) params.set("notes", lead.notes);
                                        return `/events/new?${params.toString()}`;
                                    })()}
                                    className="block px-3 py-2 rounded-md border-2 border-emerald-300 bg-emerald-50 text-sm hover:bg-emerald-100 text-emerald-800 font-medium"
                                >
                                    🎪 Jadikan Event
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

function EditField({
    label, value, onChange, placeholder, multiline, required,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    multiline?: boolean;
    required?: boolean;
}) {
    return (
        <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                {label}
                {required && <span className="text-red-500">*</span>}
            </label>
            {multiline ? (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={2}
                    className="w-full px-2 py-1.5 text-xs border border-input rounded-md bg-background resize-y"
                />
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-2 py-1.5 text-xs border border-input rounded-md bg-background"
                />
            )}
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
