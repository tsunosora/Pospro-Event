"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getRabList,
    createRab,
    deleteRab,
    duplicateRab,
    downloadRabXlsx,
    type RabPlan,
} from "@/lib/api/rab";
import { Plus, FileSpreadsheet, Copy, Trash2, Eye, Loader2 } from "lucide-react";

const toast = {
    success: (msg: string) => alert(msg),
    error: (msg: string) => alert(msg),
};

function fmtRp(v: number | string) {
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (!isFinite(n)) return "Rp 0";
    return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

function fmtDate(s: string | null) {
    if (!s) return "-";
    try {
        return new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
        return "-";
    }
}

export default function RabListPage() {
    const qc = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({
        title: "",
        projectName: "",
        location: "",
        periodStart: "",
        periodEnd: "",
    });
    const [downloadingId, setDownloadingId] = useState<number | null>(null);

    const { data: rabs, isLoading } = useQuery({
        queryKey: ["rab-list"],
        queryFn: getRabList,
    });

    const createMut = useMutation({
        mutationFn: createRab,
        onSuccess: (rab) => {
            toast.success(`RAB ${rab.code} dibuat`);
            qc.invalidateQueries({ queryKey: ["rab-list"] });
            setShowCreate(false);
            setForm({ title: "", projectName: "", location: "", periodStart: "", periodEnd: "" });
            window.location.href = `/rab/${rab.id}`;
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal buat RAB"),
    });

    const duplicateMut = useMutation({
        mutationFn: (id: number) => duplicateRab(id, {}),
        onSuccess: (rab) => {
            toast.success(`Diduplikasi: ${rab.code}`);
            qc.invalidateQueries({ queryKey: ["rab-list"] });
        },
    });

    const deleteMut = useMutation({
        mutationFn: deleteRab,
        onSuccess: () => {
            toast.success("RAB dihapus");
            qc.invalidateQueries({ queryKey: ["rab-list"] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal hapus"),
    });

    const handleDownloadXlsx = async (rab: RabPlan) => {
        try {
            setDownloadingId(rab.id);
            const blob = await downloadRabXlsx(rab.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${rab.code}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            toast.error("Gagal download XLSX");
        } finally {
            setDownloadingId(null);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim()) return toast.error("Judul wajib diisi");
        createMut.mutate({
            title: form.title.trim(),
            projectName: form.projectName.trim() || undefined,
            location: form.location.trim() || undefined,
            periodStart: form.periodStart || undefined,
            periodEnd: form.periodEnd || undefined,
        });
    };

    // Hitung total items quick untuk preview (pakai data dari list)
    const computeTotalRab = (rab: RabPlan) =>
        (rab.items ?? []).reduce((acc, it) => {
            const q = typeof it.quantity === "string" ? parseFloat(it.quantity) : it.quantity;
            const p = typeof it.priceRab === "string" ? parseFloat(it.priceRab) : it.priceRab;
            return acc + (q || 0) * (p || 0);
        }, 0);

    const computeTotalCost = (rab: RabPlan) =>
        (rab.items ?? []).reduce((acc, it) => {
            // Cost pakai quantityCost (sisi internal/aktual) — fallback ke quantity untuk backward compat
            const qSrc = it.quantityCost ?? it.quantity;
            const q = typeof qSrc === "string" ? parseFloat(qSrc) : qSrc;
            const p = typeof it.priceCost === "string" ? parseFloat(it.priceCost) : it.priceCost;
            return acc + (q || 0) * (p || 0);
        }, 0);

    return (
        <div className="p-4 lg:p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">RAB — Rencana Anggaran Biaya</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Daftar RAB proyek booth / event. Two-tier costing: RAB (harga klien) vs COST (biaya riil).
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90"
                >
                    <Plus className="h-4 w-4" />
                    Buat RAB
                </button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
            ) : !rabs || rabs.length === 0 ? (
                <div className="border rounded-lg p-12 text-center text-muted-foreground">
                    Belum ada RAB. Klik <b>Buat RAB</b> untuk mulai.
                </div>
            ) : (
                <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left">
                            <tr>
                                <th className="p-3 font-medium">Kode</th>
                                <th className="p-3 font-medium">Judul / Proyek</th>
                                <th className="p-3 font-medium">Lokasi</th>
                                <th className="p-3 font-medium">Periode</th>
                                <th className="p-3 font-medium text-right">Total RAB</th>
                                <th className="p-3 font-medium text-right">Total COST</th>
                                <th className="p-3 font-medium text-right">Selisih</th>
                                <th className="p-3 font-medium text-center w-[200px]">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rabs.map((rab) => {
                                const totalRab = computeTotalRab(rab);
                                const totalCost = computeTotalCost(rab);
                                const selisih = totalRab - totalCost;
                                return (
                                    <tr key={rab.id} className="border-t hover:bg-muted/30">
                                        <td className="p-3 font-mono text-xs">{rab.code}</td>
                                        <td className="p-3">
                                            <div className="font-medium">{rab.title}</div>
                                            {rab.projectName && (
                                                <div className="text-xs text-muted-foreground">{rab.projectName}</div>
                                            )}
                                        </td>
                                        <td className="p-3 text-muted-foreground">{rab.location || "-"}</td>
                                        <td className="p-3 text-xs text-muted-foreground">
                                            {fmtDate(rab.periodStart)} {rab.periodEnd && `– ${fmtDate(rab.periodEnd)}`}
                                        </td>
                                        <td className="p-3 text-right font-mono">{fmtRp(totalRab)}</td>
                                        <td className="p-3 text-right font-mono text-muted-foreground">{fmtRp(totalCost)}</td>
                                        <td className={`p-3 text-right font-mono font-semibold ${selisih >= 0 ? "text-green-600" : "text-red-600"}`}>
                                            {fmtRp(selisih)}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <Link
                                                    href={`/rab/${rab.id}`}
                                                    className="p-1.5 hover:bg-muted rounded"
                                                    title="Buka"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Link>
                                                <button
                                                    onClick={() => handleDownloadXlsx(rab)}
                                                    disabled={downloadingId === rab.id}
                                                    className="p-1.5 hover:bg-muted rounded disabled:opacity-50"
                                                    title="Export XLSX"
                                                >
                                                    {downloadingId === rab.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <FileSpreadsheet className="h-4 w-4" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => duplicateMut.mutate(rab.id)}
                                                    className="p-1.5 hover:bg-muted rounded"
                                                    title="Duplikasi"
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Hapus RAB ${rab.code}?`)) deleteMut.mutate(rab.id);
                                                    }}
                                                    className="p-1.5 hover:bg-muted rounded text-red-600"
                                                    title="Hapus"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal Create */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <form
                        onSubmit={handleSubmit}
                        className="bg-background rounded-lg shadow-xl w-full max-w-md p-6 space-y-4"
                    >
                        <h2 className="text-lg font-semibold">Buat RAB Baru</h2>

                        <div>
                            <label className="text-sm font-medium block mb-1">
                                Judul <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                className="w-full border rounded-md px-3 py-2 text-sm"
                                placeholder="Contoh: Stand Pameran Inacraft 2026"
                                required
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium block mb-1">Nama Proyek / Klien</label>
                            <input
                                type="text"
                                value={form.projectName}
                                onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium block mb-1">Lokasi</label>
                            <input
                                type="text"
                                value={form.location}
                                onChange={(e) => setForm({ ...form, location: e.target.value })}
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium block mb-1">Mulai</label>
                                <input
                                    type="date"
                                    value={form.periodStart}
                                    onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                                    className="w-full border rounded-md px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium block mb-1">Selesai</label>
                                <input
                                    type="date"
                                    value={form.periodEnd}
                                    onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                                    className="w-full border rounded-md px-3 py-2 text-sm"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowCreate(false)}
                                className="px-4 py-2 text-sm border rounded-md hover:bg-muted"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={createMut.isPending}
                                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
                            >
                                {createMut.isPending ? "Membuat…" : "Buat"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
