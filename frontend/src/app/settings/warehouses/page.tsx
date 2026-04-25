"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus, Pencil, Trash2, Loader2, Check, X, Eye, EyeOff, Building2,
} from "lucide-react";
import {
    getWarehouses, createWarehouse, updateWarehouse,
    deleteWarehouse, restoreWarehouse,
    type Warehouse,
} from "@/lib/api/warehouses";

export default function WarehousesSettingsPage() {
    const qc = useQueryClient();
    const [showInactive, setShowInactive] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [notes, setNotes] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<Warehouse | null>(null);

    const { data: warehouses = [], isLoading } = useQuery<Warehouse[]>({
        queryKey: ["warehouses", showInactive],
        queryFn: () => getWarehouses(showInactive),
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ["warehouses"] });

    const createMut = useMutation({
        mutationFn: createWarehouse,
        onSuccess: () => { invalidate(); resetForm(); },
        onError: (e: any) => setError(e?.response?.data?.message || "Gagal menyimpan"),
    });
    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => updateWarehouse(id, data),
        onSuccess: () => { invalidate(); resetForm(); },
        onError: (e: any) => setError(e?.response?.data?.message || "Gagal menyimpan"),
    });
    const deleteMut = useMutation({
        mutationFn: deleteWarehouse,
        onSuccess: (res) => {
            invalidate();
            setDeleteConfirm(null);
            if (res.mode === "soft-delete") {
                alert(`Gudang dinonaktifkan (sudah dipakai/berstok). Data lama tetap utuh.`);
            }
        },
    });
    const restoreMut = useMutation({ mutationFn: restoreWarehouse, onSuccess: invalidate });

    function resetForm() {
        setShowForm(false); setEditId(null); setName(""); setAddress(""); setNotes(""); setError(null);
    }

    function startEdit(w: Warehouse) {
        setEditId(w.id);
        setName(w.name);
        setAddress(w.address ?? "");
        setNotes(w.notes ?? "");
        setShowForm(true);
        setError(null);
    }

    function handleSave() {
        setError(null);
        if (!name.trim()) { setError("Nama gudang wajib diisi"); return; }
        const data = { name: name.trim(), address: address.trim(), notes: notes.trim() };
        if (editId) updateMut.mutate({ id: editId, data });
        else createMut.mutate(data);
    }

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" /> Gudang
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Lokasi penyimpanan barang untuk pelabelan pengambilan. Stok barang dikelola di <b>Manajemen Stok</b>.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                        Tampilkan nonaktif
                    </label>
                    <button
                        onClick={() => { setShowForm(true); setEditId(null); setName(""); setAddress(""); setNotes(""); setError(null); }}
                        className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90"
                    >
                        <Plus className="h-4 w-4" /> Tambah Gudang
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium block mb-1">Nama *</label>
                            <input
                                type="text" value={name} autoFocus
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Gudang Utama"
                                className="w-full border rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium block mb-1">Alamat</label>
                            <input
                                type="text" value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="(opsional)"
                                className="w-full border rounded px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium block mb-1">Catatan</label>
                        <textarea
                            value={notes} rows={2}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="(opsional)"
                            className="w-full border rounded px-3 py-2 text-sm"
                        />
                    </div>
                    {error && <p className="text-xs text-red-600">{error}</p>}
                    <div className="flex items-center gap-2 justify-end">
                        <button onClick={resetForm} className="px-3 py-1.5 text-sm border rounded hover:bg-muted">Batal</button>
                        <button
                            onClick={handleSave}
                            disabled={createMut.isPending || updateMut.isPending}
                            className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded text-sm hover:opacity-90 disabled:opacity-50"
                        >
                            {(createMut.isPending || updateMut.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            {editId ? "Update" : "Simpan"}
                        </button>
                    </div>
                </div>
            )}

            <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                        <tr>
                            <th className="p-2">Nama</th>
                            <th className="p-2">Alamat</th>
                            <th className="p-2 w-[100px] text-center">Pengambilan</th>
                            <th className="p-2 w-[100px] text-center">Status</th>
                            <th className="p-2 w-[200px] text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && (
                            <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
                            </td></tr>
                        )}
                        {!isLoading && warehouses.length === 0 && (
                            <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                                Belum ada gudang.
                            </td></tr>
                        )}
                        {warehouses.map((w) => (
                            <tr key={w.id} className={`border-t ${!w.isActive ? "bg-muted/30 text-muted-foreground" : "hover:bg-muted/20"}`}>
                                <td className="p-2">
                                    <span className={!w.isActive ? "line-through" : "font-medium"}>{w.name}</span>
                                </td>
                                <td className="p-2 text-xs text-muted-foreground">{w.address || "—"}</td>
                                <td className="p-2 text-center font-mono text-xs">{w._count?.withdrawals ?? 0}</td>
                                <td className="p-2 text-center">
                                    {w.isActive
                                        ? <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">Aktif</span>
                                        : <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">Nonaktif</span>
                                    }
                                </td>
                                <td className="p-2">
                                    <div className="flex items-center justify-center gap-1">
                                        <button onClick={() => startEdit(w)} title="Edit" className="p-1.5 hover:bg-muted rounded">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        {w.isActive ? (
                                            <button onClick={() => updateMut.mutate({ id: w.id, data: { isActive: false } })} title="Nonaktifkan" className="p-1.5 hover:bg-muted rounded">
                                                <EyeOff className="h-3.5 w-3.5" />
                                            </button>
                                        ) : (
                                            <button onClick={() => restoreMut.mutate(w.id)} title="Aktifkan" className="p-1.5 hover:bg-muted rounded">
                                                <Eye className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                        <button onClick={() => setDeleteConfirm(w)} title="Hapus" className="p-1.5 hover:bg-red-50 text-red-600 rounded">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-background border rounded-lg shadow-lg max-w-md w-full p-5 space-y-3">
                        <h3 className="font-semibold">Hapus gudang?</h3>
                        <p className="text-sm text-muted-foreground">
                            Gudang <b>{deleteConfirm.name}</b> akan {(deleteConfirm._count?.withdrawals ?? 0) > 0 ? "dinonaktifkan karena masih dipakai pengambilan" : "dihapus permanen"}.
                        </p>
                        <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 text-sm border rounded hover:bg-muted">
                                <X className="h-4 w-4 inline -mt-0.5" /> Batal
                            </button>
                            <button
                                onClick={() => deleteMut.mutate(deleteConfirm.id)}
                                disabled={deleteMut.isPending}
                                className="flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 disabled:opacity-50"
                            >
                                {deleteMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                <Trash2 className="h-3.5 w-3.5" /> Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
