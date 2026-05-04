"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    listWageRates, createWageRate, updateWageRate, deleteWageRate,
    type WageRate, type WageRateInput,
} from "@/lib/api/wage-rates";
import { Wallet, Plus, Pencil, Trash2, Check, X, Loader2, Search } from "lucide-react";

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
            <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                        <Wallet className="h-6 w-6 text-emerald-600" />
                        Tarif Gaji per Kota & Divisi
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Set tarif harian + lembur per kombinasi kota & divisi. PIC pilih kota+divisi saat input absensi.
                        Prioritas: Event override → Matrix ini → Default Worker.
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm"
                >
                    <Plus className="h-4 w-4" /> Tambah Tarif
                </button>
            </div>

            {showForm && (
                <div className="border-2 border-emerald-300 bg-emerald-50/50 rounded-lg p-4 space-y-3">
                    <div className="text-sm font-bold text-emerald-800">
                        {editId ? "Edit" : "Tambah"} Tarif Gaji
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium block mb-1">Kota <span className="text-red-500">*</span></label>
                            <input
                                value={form.city}
                                onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
                                placeholder="Jakarta, Bandung, ..."
                                className="w-full border rounded px-3 py-2 text-sm bg-white"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium block mb-1">Divisi <span className="text-red-500">*</span></label>
                            <input
                                value={form.division}
                                onChange={(e) => setForm(f => ({ ...f, division: e.target.value }))}
                                placeholder="Tukang Kayu, Welder, Helper, ..."
                                className="w-full border rounded px-3 py-2 text-sm bg-white"
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
                                className="w-full border rounded px-3 py-2 text-sm bg-white font-mono"
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
                                className="w-full border rounded px-3 py-2 text-sm bg-white font-mono"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-medium block mb-1">Catatan</label>
                            <input
                                value={form.notes ?? ""}
                                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                                placeholder="(opsional)"
                                className="w-full border rounded px-3 py-2 text-sm bg-white"
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
                    {error && <p className="text-xs text-red-600">{error}</p>}
                    <div className="flex gap-2 justify-end">
                        <button onClick={resetForm} className="px-3 py-1.5 text-sm border rounded hover:bg-white">Batal</button>
                        <button
                            onClick={handleSave}
                            disabled={createMut.isPending || updateMut.isPending}
                            className="inline-flex items-center gap-1 px-4 py-1.5 rounded text-sm bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
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
                    placeholder="Cari kota / divisi / catatan..."
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
                        <div className="bg-slate-100 px-3 py-2 font-bold text-sm flex items-center gap-2">
                            <span>📍</span>
                            {city}
                            <span className="text-xs text-muted-foreground font-normal">· {list.length} divisi</span>
                        </div>
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
                                            {!r.isActive && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">nonaktif</span>}
                                        </td>
                                        <td className="p-2 text-right font-mono">Rp {formatRp(r.dailyWageRate)}</td>
                                        <td className="p-2 text-right font-mono text-muted-foreground">
                                            {parseFloat(r.overtimeRatePerHour) > 0 ? `Rp ${formatRp(r.overtimeRatePerHour)}` : "—"}
                                        </td>
                                        <td className="p-2 text-xs text-muted-foreground">{r.notes ?? "—"}</td>
                                        <td className="p-2 text-center">
                                            <div className="inline-flex gap-1">
                                                <button
                                                    onClick={() => startEdit(r)}
                                                    className="p-1.5 rounded hover:bg-blue-50 text-blue-600"
                                                    title="Edit"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Hapus tarif "${r.city} - ${r.division}"?`)) deleteMut.mutate(r.id);
                                                    }}
                                                    disabled={deleteMut.isPending}
                                                    className="p-1.5 rounded hover:bg-red-50 text-red-600 disabled:opacity-50"
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
                ))}
            </div>
        </div>
    );
}
