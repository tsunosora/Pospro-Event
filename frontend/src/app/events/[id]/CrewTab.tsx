"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Users, Plus, Trash2, Copy, RefreshCw, Loader2, Camera, Clock, Check,
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
    type EventCrewAssignment,
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

    const [showForm, setShowForm] = useState(false);
    const [mode, setMode] = useState<"single" | "bulk">("single");
    const [form, setForm] = useState({ workerId: "", teamId: "", role: "", scheduledStart: "", scheduledEnd: "" });
    const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<number>>(new Set());
    const [autoNotify, setAutoNotify] = useState(true);
    const [notifyResult, setNotifyResult] = useState<{ crew: boolean; leader: boolean; workerName: string } | null>(null);

    const createMut = useMutation({
        mutationFn: ({ input, notify }: { input: Parameters<typeof createCrewAssignment>[0]; notify: boolean }) =>
            createCrewAssignment(input, { notify }),
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["event-crew", eventId] });
            setShowForm(false);
            setForm({ workerId: "", teamId: "", role: "", scheduledStart: "", scheduledEnd: "" });
            if (data._notified && (data._notified.crew || data._notified.leader)) {
                setNotifyResult({ crew: data._notified.crew, leader: data._notified.leader, workerName: data.worker.name });
                setTimeout(() => setNotifyResult(null), 5000);
            }
        },
    });

    const bulkMut = useMutation({
        mutationFn: createCrewAssignmentsBulk,
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ["event-crew", eventId] });
            setShowForm(false);
            setBulkSelectedIds(new Set());
            setForm({ workerId: "", teamId: "", role: "", scheduledStart: "", scheduledEnd: "" });
            alert(`✅ Berhasil assign ${res.created} crew${res.skipped > 0 ? ` (${res.skipped} skip karena sudah pernah di-assign)` : ""}`);
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
        mutationFn: ({ id, ...patch }: { id: number; role?: string; scheduledStart?: string; scheduledEnd?: string }) =>
            updateCrewAssignment(id, patch),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["event-crew", eventId] }),
    });

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
        if (mode === "single") {
            if (!form.workerId) return;
            createMut.mutate({
                input: {
                    eventId,
                    workerId: Number(form.workerId),
                    teamId: form.teamId ? Number(form.teamId) : null,
                    role: form.role || null,
                    scheduledStart: form.scheduledStart || null,
                    scheduledEnd: form.scheduledEnd || null,
                },
                notify: autoNotify,
            });
        } else {
            if (bulkSelectedIds.size === 0) return;
            bulkMut.mutate({
                eventId,
                workerIds: Array.from(bulkSelectedIds),
                teamId: form.teamId ? Number(form.teamId) : null,
                role: form.role || null,
                scheduledStart: form.scheduledStart || null,
                scheduledEnd: form.scheduledEnd || null,
            });
        }
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
                    {/* Mode toggle */}
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Mode:</span>
                        <div className="inline-flex rounded-md border border-border p-0.5 bg-background">
                            <button
                                type="button"
                                onClick={() => { setMode("single"); setBulkSelectedIds(new Set()); }}
                                className={`px-3 py-1 rounded ${mode === "single" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                            >
                                Single Crew
                            </button>
                            <button
                                type="button"
                                onClick={() => { setMode("bulk"); setForm({ ...form, workerId: "" }); }}
                                className={`px-3 py-1 rounded ${mode === "bulk" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                            >
                                Bulk (Banyak Sekaligus)
                            </button>
                        </div>
                        {mode === "bulk" && (
                            <span className="text-muted-foreground">
                                {bulkSelectedIds.size} dipilih
                            </span>
                        )}
                    </div>

                    {mode === "single" ? (
                        <div className="grid md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Worker</label>
                                <select
                                    required
                                    value={form.workerId}
                                    onChange={(e) => setForm({ ...form, workerId: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                                >
                                    <option value="">— Pilih Worker —</option>
                                    {availableWorkers.map((w) => (
                                        <option key={w.id} value={w.id}>{w.name}{w.position ? ` (${w.position})` : ""}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-muted-foreground">Pilih Worker (centang banyak)</label>
                                <div className="flex gap-2 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => setBulkSelectedIds(new Set(availableWorkers.map((w) => w.id)))}
                                        className="text-primary hover:underline"
                                    >
                                        Pilih Semua
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBulkSelectedIds(new Set())}
                                        className="text-muted-foreground hover:underline"
                                    >
                                        Bersihkan
                                    </button>
                                </div>
                            </div>
                            <div className="border rounded-md bg-background max-h-48 overflow-y-auto p-1">
                                {availableWorkers.length === 0 ? (
                                    <div className="p-3 text-xs text-muted-foreground italic text-center">Semua worker sudah ditugaskan ke event ini.</div>
                                ) : (
                                    availableWorkers.map((w) => (
                                        <label
                                            key={w.id}
                                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={bulkSelectedIds.has(w.id)}
                                                onChange={() => toggleBulkWorker(w.id)}
                                            />
                                            <span className="font-medium">{w.name}</span>
                                            {w.position && <span className="text-xs text-muted-foreground">({w.position})</span>}
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-3">
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
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t">
                        {mode === "single" ? (
                            <label className="flex items-center gap-1.5 text-xs text-foreground/80">
                                <input
                                    type="checkbox"
                                    checked={autoNotify}
                                    onChange={(e) => setAutoNotify(e.target.checked)}
                                />
                                <span>💬 Kirim WA otomatis ke crew {form.teamId ? "& leader team" : ""}</span>
                            </label>
                        ) : (
                            <span className="text-xs text-muted-foreground italic">
                                Bulk mode tidak kirim WA otomatis (assign 1-per-1 untuk WA)
                            </span>
                        )}
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted">Cancel</button>
                            <button
                                type="submit"
                                disabled={
                                    createMut.isPending || bulkMut.isPending ||
                                    (mode === "bulk" && bulkSelectedIds.size === 0)
                                }
                                className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                                {createMut.isPending || bulkMut.isPending
                                    ? "Menyimpan..."
                                    : mode === "bulk"
                                        ? `Save (${bulkSelectedIds.size})`
                                        : "Save"}
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {notifyResult && (
                <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800 flex items-center gap-2">
                    <span>✅</span>
                    <span>
                        WA terkirim ke <strong>{notifyResult.workerName}</strong>
                        {notifyResult.crew ? "" : " (gagal — bot tidak ready / no phone)"}
                        {notifyResult.leader && " + leader team"}
                    </span>
                </div>
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
