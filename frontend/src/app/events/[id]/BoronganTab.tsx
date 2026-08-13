"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HardHat, Plus, Trash2, Wallet, Loader2, Save, Pencil, Check, X } from "lucide-react";
import {
    getEventBorongan,
    setEventBoronganRates,
    addBoronganCrew,
    updateBoronganCrew,
    removeBoronganCrew,
    BORONGAN_CLASS_LABEL,
    type BoronganClass,
    type BoronganCrewEntry,
} from "@/lib/api/borongan";
import { getWorkers } from "@/lib/api/workers";

const rupiah = (n: number | string | null | undefined) =>
    "Rp " + Number(n || 0).toLocaleString("id-ID");

export default function BoronganTab({ eventId }: { eventId: number }) {
    const qc = useQueryClient();
    const key = ["event-borongan", eventId];
    const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => getEventBorongan(eventId) });
    const { data: workers = [] } = useQuery({ queryKey: ["workers", "active"], queryFn: () => getWorkers(false) });
    const invalidate = () => qc.invalidateQueries({ queryKey: key });

    // ── Tarif per kelas ──
    const [rateA, setRateA] = useState<string | null>(null);
    const [rateB, setRateB] = useState<string | null>(null);
    // Nilai efektif: state lokal kalau sudah diubah, else dari server
    const effA = rateA ?? (data?.rateA != null ? String(Number(data.rateA)) : "");
    const effB = rateB ?? (data?.rateB != null ? String(Number(data.rateB)) : "");
    const ratesMut = useMutation({
        mutationFn: () => setEventBoronganRates(eventId, { rateA: effA || null, rateB: effB || null }),
        onSuccess: () => { invalidate(); setRateA(null); setRateB(null); },
    });

    // ── Tambah tukang ──
    const [form, setForm] = useState({ workerId: "", boronganClass: "" as "" | BoronganClass, amount: "" });
    const addMut = useMutation({
        mutationFn: () =>
            addBoronganCrew(eventId, {
                workerId: Number(form.workerId),
                boronganClass: form.boronganClass || null,
                amount: form.amount || null,
            }),
        onSuccess: () => { invalidate(); setForm({ workerId: "", boronganClass: "", amount: "" }); },
        onError: (e: any) => alert(e?.response?.data?.message || "Gagal menambah tukang"),
    });

    const removeMut = useMutation({
        mutationFn: removeBoronganCrew,
        onSuccess: invalidate,
        onError: (e: any) => alert(e?.response?.data?.message || "Gagal menghapus"),
    });

    const crew = data?.crew ?? [];
    const assignedIds = new Set(crew.map((c) => c.workerId));
    const availableWorkers = workers.filter((w) => !assignedIds.has(w.id));
    const total = crew.reduce((a, c) => a + Number(c.amount), 0);

    function handleAdd(e: React.FormEvent) {
        e.preventDefault();
        if (!form.workerId) return;
        addMut.mutate();
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
                <HardHat className="h-4 w-4 text-muted-foreground" />
                Gaji Borongan — {crew.length} tukang · total {rupiah(total)}
            </div>

            {/* ── Tarif per kelas ── */}
            <details className="border border-success/30 bg-success/10 rounded-lg" open>
                <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-success flex items-center gap-2">
                    <Wallet className="h-4 w-4" /> Tarif Borongan per Kelas
                    <span className="text-[11px] font-normal text-muted-foreground ml-auto">nominal default saat assign tukang ▾</span>
                </summary>
                <div className="px-3 pb-3 space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                        Set tarif per kelas untuk event ini. Saat assign tukang, nominal otomatis mengikuti kelasnya (bisa dioverride manual).
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Tarif Kelas A (Rp)</label>
                            <input
                                inputMode="numeric"
                                value={effA}
                                onChange={(e) => setRateA(e.target.value.replace(/[^\d.]/g, ""))}
                                placeholder="mis. 250000"
                                className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background font-mono"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Tarif Kelas B (Rp)</label>
                            <input
                                inputMode="numeric"
                                value={effB}
                                onChange={(e) => setRateB(e.target.value.replace(/[^\d.]/g, ""))}
                                placeholder="mis. 180000"
                                className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background font-mono"
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => ratesMut.mutate()}
                        disabled={ratesMut.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success text-white text-sm hover:bg-success/90 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        {ratesMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Simpan Tarif
                    </button>
                </div>
            </details>

            {/* ── Tambah tukang ── */}
            <form onSubmit={handleAdd} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                <div className="text-xs font-semibold flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Tambah Tukang Borongan</div>
                <div className="grid md:grid-cols-3 gap-2">
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Tukang</label>
                        <select
                            value={form.workerId}
                            onChange={(e) => {
                                const w = workers.find((x) => x.id === Number(e.target.value));
                                setForm({ ...form, workerId: e.target.value, boronganClass: (w?.boronganClass ?? form.boronganClass) as "" | BoronganClass });
                            }}
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                        >
                            <option value="">— Pilih tukang —</option>
                            {availableWorkers.map((w) => (
                                <option key={w.id} value={w.id}>
                                    {w.name}{w.boronganClass ? ` · ${BORONGAN_CLASS_LABEL[w.boronganClass]}` : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Kelas</label>
                        <select
                            value={form.boronganClass}
                            onChange={(e) => setForm({ ...form, boronganClass: e.target.value as "" | BoronganClass })}
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                        >
                            <option value="">— default tukang / Kelas B —</option>
                            <option value="KELAS_A">Kelas A</option>
                            <option value="KELAS_B">Kelas B</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Nominal (Rp) <span className="text-[10px]">— opsional</span></label>
                        <input
                            inputMode="numeric"
                            value={form.amount}
                            onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, "") })}
                            placeholder="Kosong = tarif kelas"
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background font-mono"
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={addMut.isPending || !form.workerId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
                >
                    {addMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Tambah
                </button>
            </form>

            {/* ── Daftar tukang ── */}
            {isLoading ? (
                <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Memuat...</div>
            ) : crew.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground border rounded-lg">
                    Belum ada tukang borongan di event ini.
                </div>
            ) : (
                <div className="space-y-2">
                    {crew.map((c) => (
                        <CrewRow
                            key={c.id}
                            entry={c}
                            onSave={(patch) => updateBoronganCrew(c.id, patch).then(invalidate)}
                            onDelete={() => { if (confirm(`Hapus ${c.worker.name} dari borongan?`)) removeMut.mutate(c.id); }}
                            locked={c.slipId != null}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function CrewRow({ entry, onSave, onDelete, locked }: {
    entry: BoronganCrewEntry;
    onSave: (patch: { boronganClass?: BoronganClass; amount?: string | null }) => Promise<unknown>;
    onDelete: () => void;
    locked: boolean;
}) {
    const [editing, setEditing] = useState(false);
    const [kelas, setKelas] = useState<BoronganClass>(entry.boronganClass);
    const [amount, setAmount] = useState(String(Number(entry.amount)));
    const [saving, setSaving] = useState(false);

    async function save() {
        setSaving(true);
        try {
            await onSave({ boronganClass: kelas, amount: amount || null });
            setEditing(false);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="border rounded-lg p-3 bg-background flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{entry.worker.name}</span>
                {!editing && (
                    <>
                        <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${entry.boronganClass === "KELAS_A" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {BORONGAN_CLASS_LABEL[entry.boronganClass]}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-success/15 text-success font-medium">
                            <Wallet className="h-3 w-3" /> {rupiah(entry.amount)}
                        </span>
                        {locked && <span className="text-[10px] text-warning">terkunci (sudah masuk slip)</span>}
                    </>
                )}
                {editing && (
                    <div className="flex items-center gap-2">
                        <select value={kelas} onChange={(e) => setKelas(e.target.value as BoronganClass)} className="px-2 py-1 text-sm rounded-md border border-border bg-background">
                            <option value="KELAS_A">Kelas A</option>
                            <option value="KELAS_B">Kelas B</option>
                        </select>
                        <input
                            inputMode="numeric"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                            className="w-32 px-2 py-1 text-sm rounded-md border border-border bg-background font-mono"
                        />
                    </div>
                )}
            </div>
            <div className="flex items-center gap-1">
                {editing ? (
                    <>
                        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-success text-white hover:bg-success/90 disabled:opacity-50 cursor-pointer">
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Simpan
                        </button>
                        <button onClick={() => setEditing(false)} className="p-1.5 rounded hover:bg-muted cursor-pointer"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    </>
                ) : (
                    <>
                        <button onClick={() => setEditing(true)} disabled={locked} className="p-1.5 rounded hover:bg-muted disabled:opacity-40 cursor-pointer" title={locked ? "Terkunci — batalkan slip dulu" : "Edit"}>
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={onDelete} disabled={locked} className="p-1.5 rounded hover:bg-destructive/10 text-destructive disabled:opacity-40 cursor-pointer" title={locked ? "Terkunci — batalkan slip dulu" : "Hapus"}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
