"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Users, Plus, Trash2, Copy, RefreshCw, Loader2, Camera, Clock, Check, Pencil, X,
} from "lucide-react";
import {
    listCrewByEvent,
    createCrewAssignment,
    createCrewAssignmentsBulk,
    deleteCrewAssignment,
    deleteCrewAssignmentsBulk,
    reassignCrewTeamBulk,
    regenerateCrewToken,
    updateCrewAssignment,
    listWageTiers,
    createWageTier,
    updateWageTier,
    deleteWageTier,
    type EventCrewAssignment,
    type EventWageTier,
} from "@/lib/api/event-crew";
import { getWorkers } from "@/lib/api/workers";
import { listCrewTeams } from "@/lib/api/crew-teams";

function fmtDateTime(d: string | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

function durationMin(start: string | null, end: string | null): string {
    if (!start || !end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const min = Math.round(ms / 60000);
    if (min < 60) return `${min} mnt`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}j ${m}m`;
}

export default function CrewTab({ eventId }: { eventId: number }) {
    const qc = useQueryClient();
    const { data: assignments = [], isLoading } = useQuery({
        queryKey: ["event-crew", eventId],
        queryFn: () => listCrewByEvent(eventId),
    });
    const { data: workers = [] } = useQuery({
        queryKey: ["workers", "active"],
        queryFn: () => getWorkers(false),
    });

    const { data: teams = [] } = useQuery({
        queryKey: ["crew-teams", "active"],
        queryFn: () => listCrewTeams(false),
    });

    // ── Tarif gaji (tier) per event ──
    const { data: tiers = [] } = useQuery({
        queryKey: ["event-wage-tiers", eventId],
        queryFn: () => listWageTiers(eventId),
    });
    const invalidateTiers = () => {
        qc.invalidateQueries({ queryKey: ["event-wage-tiers", eventId] });
        qc.invalidateQueries({ queryKey: ["event-crew", eventId] }); // gaji resolved bisa berubah
    };
    const createTierMut = useMutation({ mutationFn: createWageTier, onSuccess: invalidateTiers });
    const updateTierMut = useMutation({
        mutationFn: ({ id, ...patch }: { id: number; name?: string; dailyWageRate?: string | null; overtimeRatePerHour?: string | null }) => updateWageTier(id, patch),
        onSuccess: invalidateTiers,
    });
    const deleteTierMut = useMutation({ mutationFn: deleteWageTier, onSuccess: invalidateTiers });

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ workerId: "", teamId: "", role: "", scheduledStart: "", scheduledEnd: "", wageTierId: "", dailyWageRate: "", overtimeRatePerHour: "" });
    const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<number>>(new Set());
    const [autoNotify, setAutoNotify] = useState(true);

    // Assign crew terpilih (centang). Kalau WA aktif → loop single-create biar tiap crew
    // dapat WA + link check-in; kalau tidak → bulk (1 request, cepat).
    const assignMut = useMutation({
        mutationFn: async () => {
            const ids = Array.from(bulkSelectedIds);
            const common = {
                teamId: form.teamId ? Number(form.teamId) : null,
                role: form.role || null,
                scheduledStart: form.scheduledStart || null,
                scheduledEnd: form.scheduledEnd || null,
                wageTierId: form.wageTierId ? Number(form.wageTierId) : null,
                dailyWageRate: form.dailyWageRate || null,
                overtimeRatePerHour: form.overtimeRatePerHour || null,
            };
            if (autoNotify) {
                let notified = 0;
                for (const workerId of ids) {
                    const res = await createCrewAssignment({ eventId, workerId, ...common }, { notify: true });
                    if (res._notified?.crew) notified++;
                }
                return { created: ids.length, skipped: 0, notified };
            }
            const res = await createCrewAssignmentsBulk({ eventId, workerIds: ids, ...common });
            return { created: res.created, skipped: res.skipped, notified: 0 };
        },
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ["event-crew", eventId] });
            setShowForm(false);
            setBulkSelectedIds(new Set());
            setForm({ workerId: "", teamId: "", role: "", scheduledStart: "", scheduledEnd: "", wageTierId: "", dailyWageRate: "", overtimeRatePerHour: "" });
            alert(`✅ Assign ${res.created} crew${res.skipped > 0 ? ` (${res.skipped} skip, sudah ter-assign)` : ""}${res.notified > 0 ? ` · WA terkirim ke ${res.notified}` : ""}`);
        },
    });

    // ── Selection in list (for bulk delete / reassign team) ──
    const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<number>>(new Set());

    const bulkDeleteMut = useMutation({
        mutationFn: deleteCrewAssignmentsBulk,
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ["event-crew", eventId] });
            setSelectedAssignmentIds(new Set());
            alert(`✅ ${res.deleted} crew dihapus.`);
        },
    });

    const bulkReassignMut = useMutation({
        mutationFn: ({ ids, teamId }: { ids: number[]; teamId: number | null }) => reassignCrewTeamBulk(ids, teamId),
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ["event-crew", eventId] });
            setSelectedAssignmentIds(new Set());
            alert(`✅ ${res.updated} crew dipindah team.`);
        },
    });

    function toggleAssignmentSelect(id: number) {
        const s = new Set(selectedAssignmentIds);
        if (s.has(id)) s.delete(id); else s.add(id);
        setSelectedAssignmentIds(s);
    }

    function selectAllAssignments() {
        setSelectedAssignmentIds(new Set(assignments.map((a) => a.id)));
    }

    function handleBulkDelete() {
        const n = selectedAssignmentIds.size;
        if (n === 0) return;
        if (confirm(`Hapus ${n} assignment crew? Tidak bisa di-undo.`)) {
            bulkDeleteMut.mutate(Array.from(selectedAssignmentIds));
        }
    }

    function handleBulkReassign(teamId: number | null) {
        const n = selectedAssignmentIds.size;
        if (n === 0) return;
        const teamLabel = teamId === null ? "Tanpa Team" : teams.find((t) => t.id === teamId)?.name ?? "Team";
        if (confirm(`Pindahkan ${n} crew ke ${teamLabel}?`)) {
            bulkReassignMut.mutate({ ids: Array.from(selectedAssignmentIds), teamId });
        }
    }
    const deleteMut = useMutation({
        mutationFn: deleteCrewAssignment,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["event-crew", eventId] }),
    });
    const regenMut = useMutation({
        mutationFn: regenerateCrewToken,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["event-crew", eventId] }),
    });
    const updateMut = useMutation({
        mutationFn: ({ id, ...patch }: { id: number; role?: string | null; scheduledStart?: string | null; scheduledEnd?: string | null; wageTierId?: number | null; dailyWageRate?: string | null; overtimeRatePerHour?: string | null }) =>
            updateCrewAssignment(id, patch),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["event-crew", eventId] }); setEditingId(null); },
    });

    // Inline edit gaji/role per crew yang sudah ter-assign
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ role: "", wageTierId: "", dailyWageRate: "", overtimeRatePerHour: "" });
    function startEdit(a: EventCrewAssignment) {
        setEditingId(a.id);
        setEditForm({
            role: a.role ?? "",
            wageTierId: a.wageTierId != null ? String(a.wageTierId) : "",
            dailyWageRate: a.dailyWageRate != null ? String(Number(a.dailyWageRate)) : "",
            overtimeRatePerHour: a.overtimeRatePerHour != null ? String(Number(a.overtimeRatePerHour)) : "",
        });
    }
    function saveEdit() {
        if (editingId == null) return;
        updateMut.mutate({
            id: editingId,
            role: editForm.role || null,
            wageTierId: editForm.wageTierId ? Number(editForm.wageTierId) : null,
            dailyWageRate: editForm.dailyWageRate || null,
            overtimeRatePerHour: editForm.overtimeRatePerHour || null,
        });
    }

    const assignedIds = new Set(assignments.map((a) => a.workerId));
    const availableWorkers = workers.filter((w) => !assignedIds.has(w.id));

    function copyLink(token: string) {
        const url = `${window.location.origin}/public/crew/${token}`;
        navigator.clipboard.writeText(url).then(
            () => alert("Link disalin: " + url),
            () => alert("Gagal menyalin"),
        );
    }

    function shareWa(a: EventCrewAssignment) {
        const url = `${window.location.origin}/public/crew/${a.accessToken}`;
        const phone = a.worker.phone?.replace(/\D/g, "");
        const text = encodeURIComponent(
            `Halo ${a.worker.name},\n\nTugas event: ${a.role ?? "Crew"}\nLink check-in: ${url}\n\nTap link saat tiba di lokasi & saat selesai. Foto opsional.`,
        );
        const waUrl = phone
            ? `https://wa.me/${phone.startsWith("0") ? "62" + phone.slice(1) : phone}?text=${text}`
            : `https://wa.me/?text=${text}`;
        window.open(waUrl, "_blank");
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (bulkSelectedIds.size === 0) return;
        assignMut.mutate();
    }

    function toggleBulkWorker(id: number) {
        const s = new Set(bulkSelectedIds);
        if (s.has(id)) s.delete(id); else s.add(id);
        setBulkSelectedIds(s);
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Crew Lapangan ({assignments.length})
                </div>
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        disabled={availableWorkers.length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
                    >
                        <Plus className="h-3.5 w-3.5" /> Assign Crew
                    </button>
                )}
            </div>

            {/* ── Tarif Gaji (Tier) per event ── */}
            <details className="border border-emerald-200 bg-emerald-50/40 rounded-lg">
                <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-emerald-800 flex items-center gap-2">
                    💰 Tarif Gaji (Tier) — {tiers.length}
                    <span className="text-[11px] font-normal text-muted-foreground ml-auto">klik untuk atur ▾</span>
                </summary>
                <div className="px-3 pb-3 space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                        Tentukan tarif sekali (mis. PIC, Member, Crew Baru). Saat assign cukup pilih tier — gaji otomatis. Ubah tarif di sini → semua crew di tier itu ikut update.
                    </p>
                    {tiers.length > 0 && (
                        <div className="grid grid-cols-[1.3fr_1fr_1fr_auto] gap-2 text-[10px] font-semibold text-muted-foreground px-0.5">
                            <span>Nama Tier</span><span>Gaji Harian (Rp)</span><span>Lembur/Jam (Rp)</span><span></span>
                        </div>
                    )}
                    {tiers.map((t) => (
                        <TierRow
                            key={t.id}
                            tier={t}
                            onSave={(patch) => updateTierMut.mutate({ id: t.id, ...patch })}
                            onDelete={() => { if (confirm(`Hapus tier "${t.name}"? Crew yang pakai tier ini akan kembali ke default.`)) deleteTierMut.mutate(t.id); }}
                            saving={updateTierMut.isPending}
                        />
                    ))}
                    <AddTierForm onAdd={(draft) => createTierMut.mutate({ eventId, ...draft, sortOrder: tiers.length })} pending={createTierMut.isPending} />
                </div>
            </details>

            {/* Bulk action toolbar — visible saat ada selection */}
            {selectedAssignmentIds.size > 0 && (
                <div className="border border-primary/30 bg-primary/5 rounded-lg p-3 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                        {selectedAssignmentIds.size} crew dipilih
                    </span>
                    <div className="flex items-center gap-1 ml-auto flex-wrap">
                        <button
                            onClick={selectAllAssignments}
                            className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                        >
                            Pilih Semua ({assignments.length})
                        </button>
                        <button
                            onClick={() => setSelectedAssignmentIds(new Set())}
                            className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                        >
                            Bersihkan
                        </button>
                        <span className="w-px h-5 bg-border mx-1" />
                        {/* Reassign Team dropdown */}
                        <details className="relative">
                            <summary className="text-xs px-2 py-1 rounded border border-border hover:bg-muted cursor-pointer list-none">
                                🔄 Pindah Team ▾
                            </summary>
                            <div className="absolute right-0 mt-1 w-48 bg-background border border-border rounded-md shadow-lg z-10">
                                <button
                                    type="button"
                                    onClick={() => handleBulkReassign(null)}
                                    disabled={bulkReassignMut.isPending}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                                >
                                    <em>Tanpa Team</em>
                                </button>
                                {teams.map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => handleBulkReassign(t.id)}
                                        disabled={bulkReassignMut.isPending}
                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        </details>
                        <button
                            onClick={handleBulkDelete}
                            disabled={bulkDeleteMut.isPending}
                            className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1"
                        >
                            <Trash2 className="h-3 w-3" /> Hapus ({selectedAssignmentIds.size})
                        </button>
                    </div>
                </div>
            )}

            {showForm && (
                <form onSubmit={handleSubmit} className="border rounded-lg p-3 space-y-3 bg-muted/20">
                    {/* Step 1: centang worker */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold">
                                1. Centang worker {bulkSelectedIds.size > 0 && <span className="text-primary">({bulkSelectedIds.size} dipilih)</span>}
                            </label>
                            <div className="flex gap-2 text-xs">
                                <button type="button" onClick={() => setBulkSelectedIds(new Set(availableWorkers.map((w) => w.id)))} className="text-primary hover:underline">Pilih Semua</button>
                                <button type="button" onClick={() => setBulkSelectedIds(new Set())} className="text-muted-foreground hover:underline">Bersihkan</button>
                            </div>
                        </div>
                        <div className="border rounded-md bg-background max-h-56 overflow-y-auto p-1">
                            {availableWorkers.length === 0 ? (
                                <div className="p-3 text-xs text-muted-foreground italic text-center">Semua worker sudah ditugaskan ke event ini.</div>
                            ) : (
                                availableWorkers.map((w) => (
                                    <label key={w.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                                        <input type="checkbox" checked={bulkSelectedIds.has(w.id)} onChange={() => toggleBulkWorker(w.id)} />
                                        <span className="font-medium">{w.name}</span>
                                        {w.position && <span className="text-xs text-muted-foreground">({w.position})</span>}
                                    </label>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Step 2: opsi muncul setelah ada yang dicentang */}
                    {bulkSelectedIds.size > 0 && (
                    <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                    <div className="text-xs font-semibold text-primary">2. Atur untuk {bulkSelectedIds.size} crew terpilih</div>
                    <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">💰 Tarif Gaji (Tier)</label>
                        <select
                            value={form.wageTierId}
                            onChange={(e) => setForm({ ...form, wageTierId: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                        >
                            <option value="">— Default (event/worker) —</option>
                            {tiers.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}{t.dailyWageRate != null ? ` · Rp ${Number(t.dailyWageRate).toLocaleString("id-ID")}/hari` : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Team</label>
                        <select
                            value={form.teamId}
                            onChange={(e) => setForm({ ...form, teamId: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                        >
                            <option value="">— Pilih Team (opsional) —</option>
                            {teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}{t.leader ? ` — ${t.leader.name}` : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Role / Tugas</label>
                        <input
                            value={form.role}
                            onChange={(e) => setForm({ ...form, role: e.target.value })}
                            placeholder="Setter, Finisher, Loader, Driver..."
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Jadwal Mulai</label>
                        <input
                            type="datetime-local"
                            value={form.scheduledStart}
                            onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Jadwal Selesai</label>
                        <input
                            type="datetime-local"
                            value={form.scheduledEnd}
                            onChange={(e) => setForm({ ...form, scheduledEnd: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Gaji Harian (Rp) <span className="text-[10px]">— override manual, opsional</span></label>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={form.dailyWageRate}
                            onChange={(e) => setForm({ ...form, dailyWageRate: e.target.value.replace(/[^\d.]/g, "") })}
                            placeholder="Kosong = pakai tier / default"
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background font-mono"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Lembur / Jam (Rp) <span className="text-[10px]">— opsional</span></label>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={form.overtimeRatePerHour}
                            onChange={(e) => setForm({ ...form, overtimeRatePerHour: e.target.value.replace(/[^\d.]/g, "") })}
                            placeholder="Kosong = pakai default"
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background font-mono"
                        />
                    </div>
                    </div>
                    {(form.dailyWageRate || form.overtimeRatePerHour) && (
                        <p className="text-[11px] text-amber-700">
                            ⚠️ Override gaji manual ini diterapkan ke <b>semua</b> {bulkSelectedIds.size} crew terpilih. Untuk beda per orang, pakai tombol ✏️ Edit di tiap crew, atau pilih Tier berbeda.
                        </p>
                    )}
                    </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-2 border-t">
                        <label className="flex items-center gap-1.5 text-xs text-foreground/80">
                            <input
                                type="checkbox"
                                checked={autoNotify}
                                onChange={(e) => setAutoNotify(e.target.checked)}
                            />
                            <span>💬 Kirim WA + link check-in ke tiap crew</span>
                        </label>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => { setShowForm(false); setBulkSelectedIds(new Set()); }} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted">Tutup</button>
                            <button
                                type="submit"
                                disabled={assignMut.isPending || bulkSelectedIds.size === 0}
                                className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                                {assignMut.isPending ? "Menyimpan..." : `Assign${bulkSelectedIds.size > 0 ? ` (${bulkSelectedIds.size})` : ""}`}
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {isLoading ? (
                <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Memuat...</div>
            ) : assignments.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground border rounded-lg">
                    Belum ada crew yang ditugaskan ke event ini.
                </div>
            ) : (
                <div className="space-y-2">
                    {(() => {
                        // Group by team
                        const groups = new Map<string, EventCrewAssignment[]>();
                        assignments.forEach((a) => {
                            const key = a.team ? `team-${a.team.id}` : "no-team";
                            const arr = groups.get(key) ?? [];
                            arr.push(a);
                            groups.set(key, arr);
                        });
                        return Array.from(groups.entries()).map(([gkey, items]) => {
                            const team = items[0].team;
                            return (
                                <div key={gkey} className="space-y-1">
                                    {team ? (
                                        <div className="flex items-center gap-2 px-2 py-1 rounded bg-muted/30 text-xs">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.color }} />
                                            <strong>{team.name}</strong>
                                            {team.leader && (
                                                <span className="text-muted-foreground">
                                                    👑 {team.leader.name}
                                                    {team.leader.phone && ` · ${team.leader.phone}`}
                                                </span>
                                            )}
                                            <span className="ml-auto text-muted-foreground">{items.length} crew</span>
                                        </div>
                                    ) : (
                                        <div className="px-2 py-1 rounded bg-muted/30 text-xs text-muted-foreground">
                                            <em>Tanpa Team</em>
                                            <span className="ml-2">{items.length} crew</span>
                                        </div>
                                    )}
                                    {items.map((a) => {
                                        const status =
                                            a.finishedAt ? "DONE" :
                                            a.startedAt ? "ON_SITE" : "ASSIGNED";
                                        const statusCls =
                                            status === "DONE" ? "bg-green-100 text-green-700" :
                                            status === "ON_SITE" ? "bg-amber-100 text-amber-800" :
                                            "bg-gray-100 text-gray-700";
                                        const statusLabel =
                                            status === "DONE" ? "Selesai" :
                                            status === "ON_SITE" ? "On-Site" : "Belum Check-in";

                                        return (
                            <div key={a.id} className={`border rounded-lg p-3 bg-background ${selectedAssignmentIds.has(a.id) ? "ring-2 ring-primary" : ""}`}>
                                <div className="flex items-start justify-between flex-wrap gap-2">
                                    <div className="flex items-start gap-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedAssignmentIds.has(a.id)}
                                            onChange={() => toggleAssignmentSelect(a.id)}
                                            className="mt-1"
                                        />
                                        <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm">{a.worker.name}</span>
                                            <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${statusCls}`}>{statusLabel}</span>
                                            {a.role && <span className="text-xs text-muted-foreground">— {a.role}</span>}
                                        </div>
                                        {(a.scheduledStart || a.scheduledEnd) && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                                Jadwal: {fmtDateTime(a.scheduledStart)} → {fmtDateTime(a.scheduledEnd)}
                                            </div>
                                        )}
                                        {(() => {
                                            // Gaji efektif: override manual menang di atas tier.
                                            const manual = a.dailyWageRate != null;
                                            const daily = manual ? Number(a.dailyWageRate) : (a.wageTier?.dailyWageRate != null ? Number(a.wageTier.dailyWageRate) : null);
                                            const ot = manual ? a.overtimeRatePerHour : a.wageTier?.overtimeRatePerHour;
                                            if (daily == null && !a.wageTier) return null;
                                            return (
                                                <div className="text-xs mt-1">
                                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                                                        💰 {manual ? "Gaji custom" : `Tier: ${a.wageTier?.name}`}
                                                        {daily != null && `: Rp ${daily.toLocaleString("id-ID")}/hari`}
                                                        {ot != null && ` · lembur Rp ${Number(ot).toLocaleString("id-ID")}/jam`}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => copyLink(a.accessToken)} className="p-1.5 rounded hover:bg-muted" title="Copy link">
                                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                        </button>
                                        <button onClick={() => shareWa(a)} className="px-2 py-1 text-xs rounded-md border border-border hover:bg-muted" title="Kirim ke WA">
                                            💬 WA
                                        </button>
                                        <button
                                            onClick={() => (editingId === a.id ? setEditingId(null) : startEdit(a))}
                                            className="p-1.5 rounded hover:bg-muted"
                                            title="Edit gaji / role"
                                        >
                                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (confirm("Generate token baru? Link lama tidak akan bisa dipakai.")) regenMut.mutate(a.id);
                                            }}
                                            className="p-1.5 rounded hover:bg-muted"
                                            title="Regenerate token"
                                        >
                                            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (confirm(`Hapus assignment ${a.worker.name}?`)) deleteMut.mutate(a.id);
                                            }}
                                            className="p-1.5 rounded hover:bg-red-50 text-red-600"
                                            title="Hapus"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {editingId === a.id && (
                                    <div className="mt-2 p-2 rounded-md border border-emerald-300 bg-emerald-50/50 space-y-2">
                                        <div className="text-[11px] font-bold text-emerald-800">✏️ Edit gaji / role — {a.worker.name}</div>
                                        <div className="grid md:grid-cols-2 gap-2">
                                            <div className="space-y-0.5">
                                                <label className="text-[11px] text-muted-foreground">Role / Tugas</label>
                                                <input
                                                    value={editForm.role}
                                                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                                    placeholder="Setter, Driver..."
                                                    className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                                                />
                                            </div>
                                            <div className="space-y-0.5">
                                                <label className="text-[11px] text-muted-foreground">Tarif Gaji (Tier)</label>
                                                <select
                                                    value={editForm.wageTierId}
                                                    onChange={(e) => setEditForm({ ...editForm, wageTierId: e.target.value })}
                                                    className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                                                >
                                                    <option value="">— Default —</option>
                                                    {tiers.map((t) => (
                                                        <option key={t.id} value={t.id}>
                                                            {t.name}{t.dailyWageRate != null ? ` · Rp ${Number(t.dailyWageRate).toLocaleString("id-ID")}` : ""}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="grid md:grid-cols-2 gap-2">
                                            <div className="space-y-0.5">
                                                <label className="text-[11px] text-muted-foreground">Override Gaji Harian (Rp)</label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={editForm.dailyWageRate}
                                                    onChange={(e) => setEditForm({ ...editForm, dailyWageRate: e.target.value.replace(/[^\d.]/g, "") })}
                                                    placeholder="Kosong = default event/worker"
                                                    className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background font-mono"
                                                />
                                            </div>
                                            <div className="space-y-0.5">
                                                <label className="text-[11px] text-muted-foreground">Lembur / Jam (Rp)</label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={editForm.overtimeRatePerHour}
                                                    onChange={(e) => setEditForm({ ...editForm, overtimeRatePerHour: e.target.value.replace(/[^\d.]/g, "") })}
                                                    placeholder="Kosong = default"
                                                    className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background font-mono"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={saveEdit}
                                                disabled={updateMut.isPending}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                            >
                                                {updateMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                Simpan
                                            </button>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted"
                                            >
                                                <X className="h-3.5 w-3.5" /> Batal
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="grid md:grid-cols-2 gap-2 mt-2 text-xs">
                                    <div className="border rounded p-2 bg-muted/20">
                                        <div className="flex items-center gap-1 font-medium text-muted-foreground mb-1">
                                            <Clock className="h-3 w-3" /> Check-in
                                        </div>
                                        {a.startedAt ? (
                                            <>
                                                <div className="text-foreground">{fmtDateTime(a.startedAt)}</div>
                                                {a.startNote && <div className="italic mt-1">{a.startNote}</div>}
                                                {a.startPhotoUrl && (
                                                    <a href={`${process.env.NEXT_PUBLIC_API_URL}${a.startPhotoUrl}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-primary hover:underline">
                                                        <Camera className="h-3 w-3" /> Lihat foto
                                                    </a>
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-muted-foreground italic">Belum check-in</span>
                                        )}
                                    </div>
                                    <div className="border rounded p-2 bg-muted/20">
                                        <div className="flex items-center gap-1 font-medium text-muted-foreground mb-1">
                                            <Check className="h-3 w-3" /> Check-out
                                        </div>
                                        {a.finishedAt ? (
                                            <>
                                                <div className="text-foreground">{fmtDateTime(a.finishedAt)}</div>
                                                <div className="text-muted-foreground">Durasi: <strong>{durationMin(a.startedAt, a.finishedAt)}</strong></div>
                                                {a.endNote && <div className="italic mt-1">{a.endNote}</div>}
                                                {a.endPhotoUrl && (
                                                    <a href={`${process.env.NEXT_PUBLIC_API_URL}${a.endPhotoUrl}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-primary hover:underline">
                                                        <Camera className="h-3 w-3" /> Lihat foto
                                                    </a>
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-muted-foreground italic">Belum check-out</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                                        );
                                    })}
                                </div>
                            );
                        });
                    })()}
                </div>
            )}
        </div>
    );
}

// ── Baris tier yang bisa diedit inline ──
function TierRow({ tier, onSave, onDelete, saving }: {
    tier: EventWageTier;
    onSave: (patch: { name: string; dailyWageRate: string | null; overtimeRatePerHour: string | null }) => void;
    onDelete: () => void;
    saving: boolean;
}) {
    const initDaily = tier.dailyWageRate != null ? String(Number(tier.dailyWageRate)) : "";
    const initOt = tier.overtimeRatePerHour != null ? String(Number(tier.overtimeRatePerHour)) : "";
    const [name, setName] = useState(tier.name);
    const [daily, setDaily] = useState(initDaily);
    const [ot, setOt] = useState(initOt);
    const dirty = name !== tier.name || daily !== initDaily || ot !== initOt;
    return (
        <div className="grid grid-cols-[1.3fr_1fr_1fr_auto] gap-2 items-center">
            <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama tier"
                className="px-2 py-1.5 text-sm rounded-md border border-border bg-background"
            />
            <input
                value={daily}
                inputMode="numeric"
                onChange={(e) => setDaily(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="Gaji/hari"
                className="px-2 py-1.5 text-sm rounded-md border border-border bg-background font-mono"
            />
            <input
                value={ot}
                inputMode="numeric"
                onChange={(e) => setOt(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="Lembur/jam"
                className="px-2 py-1.5 text-sm rounded-md border border-border bg-background font-mono"
            />
            <div className="flex items-center gap-1">
                {dirty && (
                    <button
                        onClick={() => onSave({ name: name.trim() || "Tier", dailyWageRate: daily || null, overtimeRatePerHour: ot || null })}
                        disabled={saving}
                        className="px-2 py-1 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                        title="Simpan tier"
                    >
                        <Check className="h-3.5 w-3.5" />
                    </button>
                )}
                <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Hapus tier">
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

// ── Form tambah tier baru ──
function AddTierForm({ onAdd, pending }: {
    onAdd: (draft: { name: string; dailyWageRate: string | null; overtimeRatePerHour: string | null }) => void;
    pending: boolean;
}) {
    const [name, setName] = useState("");
    const [daily, setDaily] = useState("");
    const [ot, setOt] = useState("");
    function submit() {
        if (!name.trim()) return;
        onAdd({ name: name.trim(), dailyWageRate: daily || null, overtimeRatePerHour: ot || null });
        setName(""); setDaily(""); setOt("");
    }
    return (
        <div className="grid grid-cols-[1.3fr_1fr_1fr_auto] gap-2 items-center pt-1 border-t border-dashed border-emerald-200">
            <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="+ Tier baru (mis. PIC)"
                className="px-2 py-1.5 text-sm rounded-md border border-border bg-background"
            />
            <input
                value={daily}
                inputMode="numeric"
                onChange={(e) => setDaily(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="Gaji/hari"
                className="px-2 py-1.5 text-sm rounded-md border border-border bg-background font-mono"
            />
            <input
                value={ot}
                inputMode="numeric"
                onChange={(e) => setOt(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="Lembur/jam"
                className="px-2 py-1.5 text-sm rounded-md border border-border bg-background font-mono"
            />
            <button
                onClick={submit}
                disabled={pending || !name.trim()}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
                <Plus className="h-3.5 w-3.5" /> Tambah
            </button>
        </div>
    );
}
