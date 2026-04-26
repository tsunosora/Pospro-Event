"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Users, Loader2, X, Phone, Crown } from "lucide-react";
import {
    listCrewTeams, createCrewTeam, updateCrewTeam, deleteCrewTeam,
    type CrewTeam, type CrewTeamInput,
} from "@/lib/api/crew-teams";
import { getWorkers } from "@/lib/api/workers";

const PRESET_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export default function CrewTeamsPage() {
    const qc = useQueryClient();
    const { data: teams = [], isLoading } = useQuery({
        queryKey: ["crew-teams", "all"],
        queryFn: () => listCrewTeams(true),
    });
    const { data: workers = [] } = useQuery({
        queryKey: ["workers", "active"],
        queryFn: () => getWorkers(false),
    });

    const [editing, setEditing] = useState<CrewTeam | null>(null);
    const [showForm, setShowForm] = useState(false);

    const createMut = useMutation({
        mutationFn: (input: CrewTeamInput) => createCrewTeam(input),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["crew-teams"] });
            setShowForm(false);
        },
    });
    const updateMut = useMutation({
        mutationFn: ({ id, input }: { id: number; input: Partial<CrewTeamInput> }) => updateCrewTeam(id, input),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["crew-teams"] });
            setEditing(null);
        },
    });
    const deleteMut = useMutation({
        mutationFn: deleteCrewTeam,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["crew-teams"] }),
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Users className="h-6 w-6" /> Team Crew
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Atur master team & leader masing-masing (mis. Team Kepuh, Team Sawah)
                    </p>
                </div>
                {!showForm && !editing && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90"
                    >
                        <Plus className="h-3.5 w-3.5" /> Team Baru
                    </button>
                )}
            </div>

            {(showForm || editing) && (
                <TeamForm
                    initial={editing}
                    workers={workers}
                    onCancel={() => { setShowForm(false); setEditing(null); }}
                    onSubmit={(input) => {
                        if (editing) updateMut.mutate({ id: editing.id, input });
                        else createMut.mutate(input);
                    }}
                    isPending={createMut.isPending || updateMut.isPending}
                />
            )}

            {isLoading ? (
                <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Memuat...</div>
            ) : teams.length === 0 ? (
                <div className="p-12 text-center border rounded-lg text-sm text-muted-foreground">
                    Belum ada team. Klik &quot;Team Baru&quot; untuk mulai.
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {teams.map((t) => (
                        <div key={t.id} className={`border rounded-lg p-4 bg-background ${t.isActive ? "" : "opacity-60"}`}>
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span
                                        className="w-3 h-3 rounded-full shrink-0"
                                        style={{ backgroundColor: t.color }}
                                    />
                                    <h3 className="font-bold text-base truncate">{t.name}</h3>
                                    {!t.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Inactive</span>}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <button onClick={() => setEditing(t)} className="p-1.5 hover:bg-muted rounded" title="Edit">
                                        <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if ((t._count?.assignments ?? 0) > 0) {
                                                alert(`Team ${t.name} tidak bisa dihapus karena masih ada ${t._count?.assignments} assignment. Set Inactive saja.`);
                                                return;
                                            }
                                            if (confirm(`Hapus team ${t.name}?`)) deleteMut.mutate(t.id);
                                        }}
                                        className="p-1.5 hover:bg-red-50 rounded text-red-600"
                                        title="Hapus"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-2 space-y-1 text-sm">
                                {t.leader ? (
                                    <div className="flex items-center gap-1.5 text-foreground/80">
                                        <Crown className="h-3.5 w-3.5 text-amber-500" />
                                        <span className="font-medium">{t.leader.name}</span>
                                        {t.leader.phone && <span className="text-xs text-muted-foreground">· {t.leader.phone}</span>}
                                    </div>
                                ) : (
                                    <div className="text-xs text-muted-foreground italic">Belum ada leader</div>
                                )}
                                {t.notes && (
                                    <div className="text-xs text-muted-foreground border-t pt-2 mt-2">{t.notes}</div>
                                )}
                                <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
                                    📋 {t._count?.assignments ?? 0} assignment total
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function TeamForm({
    initial, workers, onCancel, onSubmit, isPending,
}: {
    initial: CrewTeam | null;
    workers: Array<{ id: number; name: string; position: string | null }>;
    onCancel: () => void;
    onSubmit: (input: CrewTeamInput) => void;
    isPending: boolean;
}) {
    const [form, setForm] = useState({
        name: initial?.name ?? "",
        leaderWorkerId: initial?.leaderWorkerId ? String(initial.leaderWorkerId) : "",
        color: initial?.color ?? "#6366f1",
        notes: initial?.notes ?? "",
        isActive: initial?.isActive ?? true,
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSubmit({
            name: form.name,
            leaderWorkerId: form.leaderWorkerId ? Number(form.leaderWorkerId) : null,
            color: form.color,
            notes: form.notes || null,
            isActive: form.isActive,
        });
    }

    return (
        <form onSubmit={handleSubmit} className="border rounded-lg bg-background p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="font-semibold">{initial ? "Edit Team" : "Team Baru"}</h2>
                <button type="button" onClick={onCancel} className="p-1 rounded hover:bg-muted">
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
                <div>
                    <label className="text-xs text-muted-foreground">Nama Team *</label>
                    <input
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Team Kepuh"
                        className="w-full mt-1 px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                    />
                </div>
                <div>
                    <label className="text-xs text-muted-foreground">Leader (Worker yang menghandle)</label>
                    <select
                        value={form.leaderWorkerId}
                        onChange={(e) => setForm({ ...form, leaderWorkerId: e.target.value })}
                        className="w-full mt-1 px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                    >
                        <option value="">— Belum ada —</option>
                        {workers.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}{w.position ? ` (${w.position})` : ""}</option>
                        ))}
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Warna Identitas</label>
                    <div className="flex items-center gap-2 mt-1">
                        {PRESET_COLORS.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setForm({ ...form, color: c })}
                                className={`w-7 h-7 rounded-full border-2 ${form.color === c ? "border-foreground" : "border-transparent"}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                        <input
                            type="color"
                            value={form.color}
                            onChange={(e) => setForm({ ...form, color: e.target.value })}
                            className="w-7 h-7 rounded cursor-pointer"
                        />
                    </div>
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Catatan (Opsional)</label>
                    <textarea
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="Wilayah operasional, spesialisasi, dll"
                        rows={2}
                        className="w-full mt-1 px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                        Active
                    </label>
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isPending} className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {isPending ? "Menyimpan..." : "Save"}
                </button>
            </div>
        </form>
    );
}
