"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    listWageRates, createWageRate, updateWageRate, deleteWageRate,
    listCustomWagePresets, createCustomWagePreset, updateCustomWagePreset, deleteCustomWagePreset,
    type WageRate, type WageRateInput, type CustomWagePreset,
} from "@/lib/api/wage-rates";
import { Wallet, Plus, Minus, Pencil, Trash2, Check, Loader2, Search, MapPin, Coins } from "lucide-react";

function formatRp(n: number | string): string {
    const v = typeof n === "string" ? parseFloat(n) : n;
    return (Number.isNaN(v) ? 0 : v).toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

export default function WageRatesPage() {
    const qc = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<WageRateInput>({
        city: "", division: "", dailyWageRate: "", overtimeRatePerHour: "", notes: "", isActive: true,
    });
    const [search, setSearch] = useState("");
    const [error, setError] = useState<string | null>(null);

    const { data: rates = [], isLoading } = useQuery<WageRate[]>({
        queryKey: ["wage-rates", true],
        queryFn: () => listWageRates(true),
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ["wage-rates"] });

    const createMut = useMutation({
        mutationFn: createWageRate,
        onSuccess: () => { invalidate(); resetForm(); },
        onError: (e: any) => setError(e?.response?.data?.message || "Gagal simpan"),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<WageRateInput> }) => updateWageRate(id, data),
        onSuccess: () => { invalidate(); resetForm(); },
        onError: (e: any) => setError(e?.response?.data?.message || "Gagal update"),
    });

    const deleteMut = useMutation({
        mutationFn: deleteWageRate,
        onSuccess: invalidate,
    });

    function resetForm() {
        setShowForm(false); setEditId(null); setError(null);
        setForm({ city: "", division: "", dailyWageRate: "", overtimeRatePerHour: "", notes: "", isActive: true });
    }

    function startEdit(r: WageRate) {
        setEditId(r.id);
        setForm({
            city: r.city, division: r.division,
            dailyWageRate: r.dailyWageRate, overtimeRatePerHour: r.overtimeRatePerHour,
            notes: r.notes ?? "", isActive: r.isActive,
        });
        setShowForm(true);
        setError(null);
    }

    function handleSave() {
        setError(null);
        if (editId) updateMut.mutate({ id: editId, data: form });
        else createMut.mutate(form);
    }

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rates;
        return rates.filter((r) => `${r.city} ${r.division} ${r.notes ?? ""}`.toLowerCase().includes(q));
    }, [rates, search]);

    // Group by city untuk display matrix
    const grouped = useMemo(() => {
        const map = new Map<string, WageRate[]>();
        for (const r of filtered) {
            if (!map.has(r.city)) map.set(r.city, []);
            map.get(r.city)!.push(r);
        }
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "id"));
    }, [filtered]);

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                        <Wallet className="h-6 w-6 text-primary" />
                        Tarif Gaji per Kota & Divisi
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Set tarif harian + lembur per kombinasi kota & divisi. PIC pilih kota+divisi saat input absensi.
                        Prioritas: Event override → Matrix ini → Default Worker.
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors cursor-pointer"
                >
                    <Plus className="h-4 w-4" /> Tambah Tarif
                </button>
            </div>

            {showForm && (
                <div className="glass rounded-xl p-4 space-y-3 border border-primary/30">
                    <div className="text-sm font-bold text-foreground">
                        {editId ? "Edit" : "Tambah"} Tarif Gaji
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium block mb-1">Kota <span className="text-red-500">*</span></label>
                            <input
                                value={form.city}
                                onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
                                placeholder="Jakarta, Bandung, ..."
                                className="w-full border border-border rounded px-3 py-2 text-sm bg-card"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium block mb-1">Divisi <span className="text-red-500">*</span></label>
                            <input
                                value={form.division}
                                onChange={(e) => setForm(f => ({ ...f, division: e.target.value }))}
                                placeholder="Tukang Kayu, Welder, Helper, ..."
                                className="w-full border border-border rounded px-3 py-2 text-sm bg-card"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium block mb-1">Gaji Harian (Rp) <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={form.dailyWageRate}
                                onChange={(e) => setForm(f => ({ ...f, dailyWageRate: e.target.value.replace(/[^\d.]/g, "") }))}
                                placeholder="200000"
                                className="w-full border border-border rounded px-3 py-2 text-sm bg-card nums"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium block mb-1">Lembur per Jam (Rp)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={form.overtimeRatePerHour}
                                onChange={(e) => setForm(f => ({ ...f, overtimeRatePerHour: e.target.value.replace(/[^\d.]/g, "") }))}
                                placeholder="25000"
                                className="w-full border border-border rounded px-3 py-2 text-sm bg-card nums"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-medium block mb-1">Catatan</label>
                            <input
                                value={form.notes ?? ""}
                                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                                placeholder="(opsional)"
                                className="w-full border border-border rounded px-3 py-2 text-sm bg-card"
                            />
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={form.isActive ?? true}
                            onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))}
                        />
                        Aktif (kalau dimatikan, tidak muncul di dropdown PIC)
                    </label>
                    {error && <p className="text-xs text-destructive">{error}</p>}
                    <div className="flex gap-2 justify-end">
                        <button onClick={resetForm} className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted transition-colors cursor-pointer">Batal</button>
                        <button
                            onClick={handleSave}
                            disabled={createMut.isPending || updateMut.isPending}
                            className="inline-flex items-center gap-1 px-4 py-1.5 rounded text-sm bg-primary hover:bg-primary/90 text-white disabled:opacity-50 transition-colors cursor-pointer"
                        >
                            {(createMut.isPending || updateMut.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            {editId ? "Update" : "Simpan"}
                        </button>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari tarif (kota/divisi) atau gaji custom..."
                    className="w-full max-w-md pl-9 pr-3 py-2 border rounded-lg text-sm"
                />
            </div>

            {/* List grouped by city */}
            {isLoading && (
                <div className="text-center p-8 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin inline" /></div>
            )}
            {!isLoading && filtered.length === 0 && (
                <div className="text-center p-8 text-muted-foreground text-sm">
                    Belum ada tarif gaji. Klik &quot;+ Tambah Tarif&quot; untuk mulai.
                </div>
            )}
            <div className="space-y-3">
                {grouped.map(([city, list]) => (
                    <div key={city} className="border rounded-lg overflow-hidden">
                        <div className="bg-muted px-3 py-2 font-bold text-sm flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            {city}
                            <span className="text-xs text-muted-foreground font-normal">· {list.length} divisi</span>
                        </div>
                        <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/30 text-xs">
                                <tr>
                                    <th className="text-left p-2">Divisi</th>
                                    <th className="text-right p-2">Gaji Harian</th>
                                    <th className="text-right p-2">Lembur/jam</th>
                                    <th className="text-left p-2">Catatan</th>
                                    <th className="text-center p-2 w-24">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((r) => (
                                    <tr key={r.id} className={`border-t ${!r.isActive ? "opacity-50 bg-muted/10" : ""}`}>
                                        <td className="p-2 font-medium">
                                            {r.division}
                                            {!r.isActive && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">nonaktif</span>}
                                        </td>
                                        <td className="p-2 text-right nums">Rp {formatRp(r.dailyWageRate)}</td>
                                        <td className="p-2 text-right nums text-muted-foreground">
                                            {parseFloat(r.overtimeRatePerHour) > 0 ? `Rp ${formatRp(r.overtimeRatePerHour)}` : "—"}
                                        </td>
                                        <td className="p-2 text-xs text-muted-foreground">{r.notes ?? "—"}</td>
                                        <td className="p-2 text-center">
                                            <div className="inline-flex gap-1">
                                                <button
                                                    onClick={() => startEdit(r)}
                                                    className="p-1.5 rounded hover:bg-info/15 text-info transition-colors cursor-pointer"
                                                    title="Edit"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Hapus tarif "${r.city} - ${r.division}"?`)) deleteMut.mutate(r.id);
                                                    }}
                                                    disabled={deleteMut.isPending}
                                                    className="p-1.5 rounded hover:bg-destructive/12 text-destructive disabled:opacity-50 transition-colors cursor-pointer"
                                                    title="Hapus"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Daftar Gaji Custom (+/-) ── */}
            <CustomWagePresetsSection search={search} />
        </div>
    );
}

// ─── Section: Preset Gaji Custom (bisa menambah / mengurangi) ───────────────
type PresetForm = { label: string; sign: "+" | "-"; amount: string; notes: string; isActive: boolean };
const EMPTY_PRESET: PresetForm = { label: "", sign: "+", amount: "", notes: "", isActive: true };

function CustomWagePresetsSection({ search }: { search: string }) {
    const qc = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<PresetForm>(EMPTY_PRESET);
    const [error, setError] = useState<string | null>(null);

    const { data: presets = [], isLoading } = useQuery<CustomWagePreset[]>({
        queryKey: ["custom-wage-presets", true],
        queryFn: () => listCustomWagePresets(true),
    });

    // Pencarian ikut kotak search halaman (cari nama/catatan preset).
    const q = search.trim().toLowerCase();
    const shown = q ? presets.filter((p) => `${p.label} ${p.notes ?? ""}`.toLowerCase().includes(q)) : presets;

    const invalidate = () => qc.invalidateQueries({ queryKey: ["custom-wage-presets"] });
    const createMut = useMutation({
        mutationFn: createCustomWagePreset,
        onSuccess: () => { invalidate(); resetForm(); },
        onError: (e: any) => setError(e?.response?.data?.message || "Gagal simpan"),
    });
    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => updateCustomWagePreset(id, data),
        onSuccess: () => { invalidate(); resetForm(); },
        onError: (e: any) => setError(e?.response?.data?.message || "Gagal update"),
    });
    const deleteMut = useMutation({ mutationFn: deleteCustomWagePreset, onSuccess: invalidate });

    function resetForm() { setShowForm(false); setEditId(null); setError(null); setForm(EMPTY_PRESET); }

    function startEdit(p: CustomWagePreset) {
        const amt = parseFloat(p.amount);
        setEditId(p.id);
        setForm({
            label: p.label,
            sign: amt < 0 ? "-" : "+",
            amount: String(Math.abs(amt) || ""),
            notes: p.notes ?? "",
            isActive: p.isActive,
        });
        setShowForm(true);
        setError(null);
    }

    function handleSave() {
        setError(null);
        const abs = Number(form.amount);
        if (!form.label.trim()) { setError("Nama preset wajib diisi"); return; }
        if (!abs || abs <= 0) { setError("Nominal harus lebih dari 0"); return; }
        const signed = (form.sign === "-" ? -1 : 1) * abs;
        const data = { label: form.label.trim(), amount: signed, notes: form.notes.trim() || null, isActive: form.isActive };
        if (editId) updateMut.mutate({ id: editId, data });
        else createMut.mutate(data);
    }

    return (
        <div className="pt-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                <div>
                    <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                        <Coins className="h-5 w-5 text-primary" /> Daftar Gaji Custom
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                        Preset nominal siap-pakai yang bisa <b className="text-success">menambah (+)</b> atau <b className="text-destructive">mengurangi (−)</b> gaji. Mis. Uang Makan, Bonus, Potongan Kasbon.
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                    <Plus className="h-4 w-4" /> Tambah Preset
                </button>
            </div>

            {showForm && (
                <div className="glass rounded-xl p-4 space-y-3 border border-primary/30 mb-3">
                    <div className="text-sm font-bold">{editId ? "Edit" : "Tambah"} Gaji Custom</div>
                    {/* Jenis: Tambah / Kurang */}
                    <div>
                        <label className="text-xs font-medium block mb-1">Jenis <span className="text-red-500">*</span></label>
                        <div className="inline-flex rounded-lg border border-border overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setForm(f => ({ ...f, sign: "+" }))}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm cursor-pointer transition-colors ${form.sign === "+" ? "bg-success text-white" : "bg-card hover:bg-muted text-muted-foreground"}`}
                            >
                                <Plus className="h-3.5 w-3.5" /> Tambah
                            </button>
                            <button
                                type="button"
                                onClick={() => setForm(f => ({ ...f, sign: "-" }))}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm cursor-pointer transition-colors border-l border-border ${form.sign === "-" ? "bg-destructive text-white" : "bg-card hover:bg-muted text-muted-foreground"}`}
                            >
                                <Minus className="h-3.5 w-3.5" /> Kurang
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium block mb-1">Nama Preset <span className="text-red-500">*</span></label>
                            <input
                                value={form.label}
                                onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
                                placeholder="Uang Makan, Bonus, Potongan Kasbon..."
                                className="w-full border border-border rounded px-3 py-2 text-sm bg-card"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium block mb-1">Nominal (Rp) <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${form.sign === "-" ? "text-destructive" : "text-success"}`}>{form.sign}</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={form.amount}
                                    onChange={(e) => setForm(f => ({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") }))}
                                    placeholder="20000"
                                    className="w-full border border-border rounded pl-7 pr-3 py-2 text-sm bg-card nums"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-medium block mb-1">Catatan</label>
                            <input
                                value={form.notes}
                                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                                placeholder="(opsional)"
                                className="w-full border border-border rounded px-3 py-2 text-sm bg-card"
                            />
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={form.isActive} onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                        Aktif
                    </label>
                    {error && <p className="text-xs text-destructive">{error}</p>}
                    <div className="flex gap-2 justify-end">
                        <button onClick={resetForm} className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted transition-colors cursor-pointer">Batal</button>
                        <button
                            onClick={handleSave}
                            disabled={createMut.isPending || updateMut.isPending}
                            className="inline-flex items-center gap-1 px-4 py-1.5 rounded text-sm bg-primary hover:bg-primary/90 text-white disabled:opacity-50 transition-colors cursor-pointer"
                        >
                            {(createMut.isPending || updateMut.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            {editId ? "Update" : "Simpan"}
                        </button>
                    </div>
                </div>
            )}

            {isLoading && <div className="text-center p-8 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin inline" /></div>}
            {!isLoading && presets.length === 0 && (
                <div className="text-center p-8 text-muted-foreground text-sm border rounded-lg">
                    Belum ada preset gaji custom. Klik &quot;+ Tambah Preset&quot; untuk mulai.
                </div>
            )}
            {!isLoading && presets.length > 0 && shown.length === 0 && (
                <div className="text-center p-8 text-muted-foreground text-sm border rounded-lg">
                    Tidak ada gaji custom cocok dengan &quot;{search}&quot;.
                </div>
            )}
            {shown.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {shown.map((p) => {
                        const amt = parseFloat(p.amount);
                        const neg = amt < 0;
                        return (
                            <div key={p.id} className={`glass rounded-xl p-3 flex items-start gap-3 ${!p.isActive ? "opacity-55" : ""}`}>
                                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${neg ? "bg-destructive/12 text-destructive" : "bg-success/15 text-success"}`}>
                                    {neg ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                                        {p.label}
                                        {!p.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">nonaktif</span>}
                                    </div>
                                    <div className={`text-sm font-bold nums ${neg ? "text-destructive" : "text-success"}`}>
                                        {neg ? "−" : "+"}Rp {formatRp(Math.abs(amt))}
                                    </div>
                                    {p.notes && <div className="text-[11px] text-muted-foreground mt-0.5 truncate" title={p.notes}>{p.notes}</div>}
                                </div>
                                <div className="flex flex-col gap-1 shrink-0">
                                    <button onClick={() => startEdit(p)} title="Edit" className="p-1.5 rounded hover:bg-info/15 text-info transition-colors cursor-pointer"><Pencil className="h-3.5 w-3.5" /></button>
                                    <button
                                        onClick={() => { if (confirm(`Hapus preset "${p.label}"?`)) deleteMut.mutate(p.id); }}
                                        disabled={deleteMut.isPending}
                                        title="Hapus"
                                        className="p-1.5 rounded hover:bg-destructive/12 text-destructive disabled:opacity-50 transition-colors cursor-pointer"
                                    ><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
