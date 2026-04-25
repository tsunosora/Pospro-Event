"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus, Pencil, Trash2, Loader2, Check, X, ArrowUp, ArrowDown,
    Eye, EyeOff, Tags,
} from "lucide-react";
import {
    getRabCategories, createRabCategory, updateRabCategory,
    deleteRabCategory, restoreRabCategory, reorderRabCategories,
    type RabCategory,
} from "@/lib/api/rab-categories";

export default function RabCategoriesPage() {
    const qc = useQueryClient();
    const [showInactive, setShowInactive] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<RabCategory | null>(null);

    const { data: categories = [], isLoading } = useQuery<RabCategory[]>({
        queryKey: ["rab-categories", showInactive],
        queryFn: () => getRabCategories(showInactive),
    });

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ["rab-categories"] });
    };

    const createMut = useMutation({
        mutationFn: createRabCategory,
        onSuccess: () => { invalidate(); resetForm(); },
        onError: (e: any) => setError(e?.response?.data?.message || "Gagal menyimpan"),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => updateRabCategory(id, data),
        onSuccess: () => { invalidate(); resetForm(); },
        onError: (e: any) => setError(e?.response?.data?.message || "Gagal menyimpan"),
    });

    const deleteMut = useMutation({
        mutationFn: deleteRabCategory,
        onSuccess: (res) => {
            invalidate();
            setDeleteConfirm(null);
            if (res.mode === "soft-delete") {
                alert(
                    `Kategori dinonaktifkan (soft-delete) karena ${res.usage > 0 ? `dipakai oleh ${res.usage} item RAB` : "merupakan kategori bawaan"}. Data RAB lama tetap utuh.`,
                );
            }
        },
    });

    const restoreMut = useMutation({
        mutationFn: restoreRabCategory,
        onSuccess: invalidate,
    });

    const reorderMut = useMutation({
        mutationFn: reorderRabCategories,
        onSuccess: invalidate,
    });

    const toggleActiveMut = useMutation({
        mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
            updateRabCategory(id, { isActive }),
        onSuccess: invalidate,
    });

    function resetForm() {
        setShowForm(false);
        setEditId(null);
        setName("");
        setError(null);
    }

    function startEdit(c: RabCategory) {
        setEditId(c.id);
        setName(c.name);
        setShowForm(true);
        setError(null);
    }

    function handleSave() {
        setError(null);
        if (!name.trim()) {
            setError("Nama wajib diisi");
            return;
        }
        if (editId) {
            updateMut.mutate({ id: editId, data: { name: name.trim() } });
        } else {
            createMut.mutate({ name: name.trim() });
        }
    }

    function move(idx: number, dir: -1 | 1) {
        const target = idx + dir;
        if (target < 0 || target >= categories.length) return;
        const next = [...categories];
        [next[idx], next[target]] = [next[target], next[idx]];
        reorderMut.mutate(next.map((c) => c.id));
    }

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Tags className="h-5 w-5 text-primary" /> Kategori RAB
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Kategori dipakai untuk mengelompokkan item dalam RAB. Hapus = nonaktifkan
                        (data RAB lama tetap utuh).
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={(e) => setShowInactive(e.target.checked)}
                        />
                        Tampilkan nonaktif
                    </label>
                    <button
                        onClick={() => { setShowForm(true); setEditId(null); setName(""); setError(null); }}
                        className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90"
                    >
                        <Plus className="h-4 w-4" /> Tambah Kategori
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium w-24">Nama:</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Contoh: Konsumsi"
                            autoFocus
                            className="flex-1 border rounded px-3 py-2 text-sm"
                            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                        />
                    </div>
                    {error && <p className="text-xs text-red-600">{error}</p>}
                    <div className="flex items-center gap-2 justify-end">
                        <button
                            onClick={resetForm}
                            className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={createMut.isPending || updateMut.isPending}
                            className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded text-sm hover:opacity-90 disabled:opacity-50"
                        >
                            {(createMut.isPending || updateMut.isPending) ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Check className="h-3.5 w-3.5" />
                            )}
                            {editId ? "Update" : "Simpan"}
                        </button>
                    </div>
                </div>
            )}

            <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                        <tr>
                            <th className="p-2 w-[50px]">Urut</th>
                            <th className="p-2">Nama</th>
                            <th className="p-2 w-[100px] text-center">Item</th>
                            <th className="p-2 w-[100px] text-center">Status</th>
                            <th className="p-2 w-[180px] text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && (
                            <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
                            </td></tr>
                        )}
                        {!isLoading && categories.length === 0 && (
                            <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                                Belum ada kategori.
                            </td></tr>
                        )}
                        {categories.map((c, idx) => (
                            <tr key={c.id} className={`border-t ${!c.isActive ? "bg-muted/30 text-muted-foreground" : "hover:bg-muted/20"}`}>
                                <td className="p-2">
                                    <div className="flex flex-col gap-0.5">
                                        <button
                                            onClick={() => move(idx, -1)}
                                            disabled={idx === 0 || reorderMut.isPending}
                                            className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                                        ><ArrowUp className="h-3 w-3" /></button>
                                        <button
                                            onClick={() => move(idx, 1)}
                                            disabled={idx === categories.length - 1 || reorderMut.isPending}
                                            className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                                        ><ArrowDown className="h-3 w-3" /></button>
                                    </div>
                                </td>
                                <td className="p-2">
                                    <div className="flex items-center gap-2">
                                        <span className={!c.isActive ? "line-through" : ""}>{c.name}</span>
                                        {c.key && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono">
                                                bawaan
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-2 text-center font-mono text-xs">
                                    {c._count?.items ?? 0}
                                </td>
                                <td className="p-2 text-center">
                                    {c.isActive ? (
                                        <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">Aktif</span>
                                    ) : (
                                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">Nonaktif</span>
                                    )}
                                </td>
                                <td className="p-2">
                                    <div className="flex items-center justify-center gap-1">
                                        <button
                                            onClick={() => startEdit(c)}
                                            title="Edit"
                                            className="p-1.5 hover:bg-muted rounded"
                                        ><Pencil className="h-3.5 w-3.5" /></button>
                                        {c.isActive ? (
                                            <button
                                                onClick={() => toggleActiveMut.mutate({ id: c.id, isActive: false })}
                                                title="Nonaktifkan"
                                                className="p-1.5 hover:bg-muted rounded"
                                            ><EyeOff className="h-3.5 w-3.5" /></button>
                                        ) : (
                                            <button
                                                onClick={() => restoreMut.mutate(c.id)}
                                                title="Aktifkan kembali"
                                                className="p-1.5 hover:bg-muted rounded"
                                            ><Eye className="h-3.5 w-3.5" /></button>
                                        )}
                                        <button
                                            onClick={() => setDeleteConfirm(c)}
                                            title="Hapus"
                                            className="p-1.5 hover:bg-red-50 text-red-600 rounded"
                                        ><Trash2 className="h-3.5 w-3.5" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Delete confirm modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-background border rounded-lg shadow-lg max-w-md w-full p-5 space-y-3">
                        <h3 className="font-semibold">Hapus kategori?</h3>
                        <p className="text-sm text-muted-foreground">
                            Kategori <b>{deleteConfirm.name}</b> akan dinonaktifkan
                            {(deleteConfirm._count?.items ?? 0) > 0
                                ? ` karena masih dipakai oleh ${deleteConfirm._count?.items} item RAB`
                                : deleteConfirm.key ? " karena merupakan kategori bawaan" : ""}.
                            {(deleteConfirm._count?.items === 0 && !deleteConfirm.key) && " Karena belum dipakai dan bukan bawaan, kategori akan dihapus permanen."}
                        </p>
                        <div className="flex items-center gap-2 justify-end">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
                            ><X className="h-4 w-4 inline -mt-0.5" /> Batal</button>
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
