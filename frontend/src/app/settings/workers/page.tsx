"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus, Pencil, Trash2, Loader2, Check, X, Eye, EyeOff,
    Users as UsersIcon, Upload, User as UserIcon,
} from "lucide-react";
import {
    getWorkers, createWorker, updateWorker, deleteWorker, restoreWorker,
    type Worker,
} from "@/lib/api/workers";

export default function WorkersSettingsPage() {
    const qc = useQueryClient();
    const [showInactive, setShowInactive] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [name, setName] = useState("");
    const [position, setPosition] = useState("");
    const [phone, setPhone] = useState("");
    const [notes, setNotes] = useState("");
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<Worker | null>(null);

    const { data: workers = [], isLoading } = useQuery<Worker[]>({
        queryKey: ["workers", showInactive],
        queryFn: () => getWorkers(showInactive),
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ["workers"] });

    const createMut = useMutation({
        mutationFn: createWorker,
        onSuccess: () => { invalidate(); resetForm(); },
        onError: (e: any) => setError(e?.response?.data?.message || "Gagal menyimpan"),
    });
    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => updateWorker(id, data),
        onSuccess: () => { invalidate(); resetForm(); },
        onError: (e: any) => setError(e?.response?.data?.message || "Gagal menyimpan"),
    });
    const deleteMut = useMutation({
        mutationFn: deleteWorker,
        onSuccess: () => { invalidate(); setDeleteConfirm(null); },
    });
    const restoreMut = useMutation({ mutationFn: restoreWorker, onSuccess: invalidate });
    const toggleActiveMut = useMutation({
        mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => updateWorker(id, { isActive }),
        onSuccess: invalidate,
    });

    function resetForm() {
        setShowForm(false); setEditId(null);
        setName(""); setPosition(""); setPhone(""); setNotes("");
        setPhoto(null); setPhotoPreview(null); setError(null);
    }

    function startEdit(w: Worker) {
        setEditId(w.id);
        setName(w.name);
        setPosition(w.position ?? "");
        setPhone(w.phone ?? "");
        setNotes(w.notes ?? "");
        setPhoto(null);
        setPhotoPreview(w.photoUrl ? `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}${w.photoUrl}` : null);
        setShowForm(true);
        setError(null);
    }

    function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        if (!f) return;
        setPhoto(f);
        setPhotoPreview(URL.createObjectURL(f));
    }

    function handleSave() {
        setError(null);
        if (!name.trim()) { setError("Nama wajib diisi"); return; }
        const data: any = {
            name: name.trim(), position: position.trim(), phone: phone.trim(), notes: notes.trim(),
        };
        if (photo) data.photo = photo;
        if (editId) updateMut.mutate({ id: editId, data });
        else createMut.mutate(data);
    }

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <UsersIcon className="h-5 w-5 text-primary" /> Pekerja / Tukang
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Daftar pekerja yang dapat mengambil barang dari gudang. Foto dipakai untuk identifikasi.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                        Tampilkan nonaktif
                    </label>
                    <button
                        onClick={() => { resetForm(); setShowForm(true); }}
                        className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90"
                    >
                        <Plus className="h-4 w-4" /> Tambah Pekerja
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-4">
                        <div>
                            <label className="text-xs font-medium block mb-1">Foto</label>
                            <div className="w-28 h-28 border rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden">
                                {photoPreview ? (
                                    <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon className="h-10 w-10 text-muted-foreground" />
                                )}
                            </div>
                            <label className="mt-2 cursor-pointer inline-flex items-center gap-1 text-xs bg-muted hover:bg-muted/70 px-2 py-1 rounded">
                                <Upload className="h-3 w-3" /> {photoPreview ? "Ganti" : "Upload"}
                                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                            </label>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium block mb-1">Nama *</label>
                                    <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Budi Santoso" className="w-full border rounded px-3 py-2 text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium block mb-1">Jabatan</label>
                                    <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Tukang / Kepala Tim" className="w-full border rounded px-3 py-2 text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium block mb-1">HP/WA</label>
                                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812…" className="w-full border rounded px-3 py-2 text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1">Catatan</label>
                                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="(opsional)" className="w-full border rounded px-3 py-2 text-sm" />
                            </div>
                        </div>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {isLoading && (
                    <div className="col-span-full p-6 text-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
                    </div>
                )}
                {!isLoading && workers.length === 0 && (
                    <div className="col-span-full p-6 text-center text-muted-foreground text-sm">Belum ada pekerja.</div>
                )}
                {workers.map((w) => (
                    <div key={w.id} className={`border rounded-lg p-3 flex gap-3 ${!w.isActive ? "bg-muted/40 opacity-70" : ""}`}>
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                            {w.photoUrl ? (
                                <img src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}${w.photoUrl}`} alt={w.name} className="w-full h-full object-cover" />
                            ) : (
                                <UserIcon className="h-7 w-7 text-muted-foreground" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                                {w.name}
                                {!w.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">nonaktif</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">{w.position || "—"}</div>
                            {w.phone && <div className="text-xs text-muted-foreground">{w.phone}</div>}
                            <div className="text-[11px] text-muted-foreground mt-1">
                                {w._count?.withdrawals ?? 0} pengambilan
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <button onClick={() => startEdit(w)} title="Edit" className="p-1.5 hover:bg-muted rounded">
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {w.isActive ? (
                                <button onClick={() => toggleActiveMut.mutate({ id: w.id, isActive: false })} title="Nonaktifkan" className="p-1.5 hover:bg-muted rounded">
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
                    </div>
                ))}
            </div>

            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-background border rounded-lg shadow-lg max-w-md w-full p-5 space-y-3">
                        <h3 className="font-semibold">Hapus pekerja?</h3>
                        <p className="text-sm text-muted-foreground">
                            <b>{deleteConfirm.name}</b> akan {((deleteConfirm._count?.withdrawals ?? 0) > 0) ? "dinonaktifkan (riwayat pengambilan tetap utuh)" : "dihapus permanen"}.
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
