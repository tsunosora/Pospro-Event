"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus, Pencil, Trash2, Loader2, Check, X, Eye, EyeOff,
    Users as UsersIcon, Upload, User as UserIcon, Link as LinkIcon, RefreshCw, Copy,
    AlertTriangle, Lock, Tag, Wallet, Search, Phone as PhoneIcon, Package, IdCard, Info,
} from "lucide-react";
import {
    getWorkers, createWorker, updateWorker, deleteWorker, restoreWorker,
    uploadWorkerSignature, removeWorkerSignature,
    uploadWorkerStamp, removeWorkerStamp,
    regeneratePicToken,
    WORKER_POSITIONS, getPositionMeta, isSignerPosition,
    type Worker,
} from "@/lib/api/workers";
import { listCrewTeams, type CrewTeam } from "@/lib/api/crew-teams";
import { listWageRateDistinct } from "@/lib/api/wage-rates";

export default function WorkersSettingsPage() {
    const qc = useQueryClient();
    const [showInactive, setShowInactive] = useState(true);
    const [positionFilter, setPositionFilter] = useState<string>("");
    const [search, setSearch] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [name, setName] = useState("");
    const [position, setPosition] = useState("");
    const [phone, setPhone] = useState("");
    const [notes, setNotes] = useState("");
    const [signatureDisplayName, setSignatureDisplayName] = useState("");
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    // Payroll fields
    const [dailyWageRate, setDailyWageRate] = useState<string>("");
    const [overtimeRatePerHour, setOvertimeRatePerHour] = useState<string>("");
    const [isPic, setIsPic] = useState(false);
    const [picPin, setPicPin] = useState<string>("");
    const [teamId, setTeamId] = useState<number | "">("");
    const [defaultCityKey, setDefaultCityKey] = useState<string>("");
    const [defaultDivisionKey, setDefaultDivisionKey] = useState<string>("");
    const [boronganClass, setBoronganClass] = useState<string>("");

    const { data: teams = [] } = useQuery<CrewTeam[]>({
        queryKey: ["crew-teams", true],
        queryFn: () => listCrewTeams(true),
    });
    const { data: wageDistinct } = useQuery({
        queryKey: ["wage-rates", "distinct"],
        queryFn: listWageRateDistinct,
    });
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<Worker | null>(null);
    const [deleteResult, setDeleteResult] = useState<{ mode: 'hard-delete' | 'soft-delete'; usage: number; forced?: boolean } | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [forceConfirm, setForceConfirm] = useState(false); // langkah konfirmasi kedua untuk hapus permanen paksa
    const [copiedTokenId, setCopiedTokenId] = useState<number | null>(null);

    const { data: workers = [], isLoading } = useQuery<Worker[]>({
        queryKey: ["workers", showInactive, positionFilter],
        queryFn: () => getWorkers(showInactive, { position: positionFilter || undefined }),
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ["workers"] });

    // Worker yang sedang di-edit — dipakai untuk section TTD/Stempel & Link PIC
    // (butuh URL gambar & token aktual dari server, bukan hanya state form).
    const editingWorker = editId ? workers.find((x) => x.id === editId) ?? null : null;

    // Pencarian client-side by nama / HP — filter role & nonaktif tetap di server.
    const q = search.trim().toLowerCase();
    const filteredWorkers = q
        ? workers.filter((w) => w.name.toLowerCase().includes(q) || (w.phone ?? "").toLowerCase().includes(q))
        : workers;

    // Class konsisten untuk kontrol form (tinggi 40px, radius & focus ring seragam).
    const inputCls = "w-full h-10 border border-border rounded-xl px-3 text-sm bg-card outline-none focus:ring-2 focus:ring-ring/40 transition-shadow";
    const labelCls = "text-xs font-medium text-foreground/80 block mb-1.5";

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
        mutationFn: ({ id, force }: { id: number; force?: boolean }) => deleteWorker(id, force),
        // Reset status hasil/error tiap kali mulai, supaya feedback selalu fresh (bukan sisa klik sebelumnya).
        onMutate: () => { setDeleteResult(null); setDeleteError(null); },
        onSuccess: (res) => {
            invalidate();
            // Tampilkan hasil DI DALAM dialog (bukan alert() yang bisa dibungkam browser) supaya
            // jelas terhapus vs dinonaktifkan — dialog tetap terbuka sampai user menutup.
            setForceConfirm(false);
            setDeleteResult(res);
        },
        onError: (e: any) => setDeleteError(e?.response?.data?.message || e?.message || 'terjadi kesalahan'),
    });
    const closeDeleteDialog = () => { setDeleteConfirm(null); setDeleteResult(null); setDeleteError(null); setForceConfirm(false); };
    const restoreMut = useMutation({ mutationFn: restoreWorker, onSuccess: invalidate });
    const toggleActiveMut = useMutation({
        mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => updateWorker(id, { isActive }),
        onSuccess: invalidate,
    });
    const uploadSigMut = useMutation({
        mutationFn: ({ id, file }: { id: number; file: File }) => uploadWorkerSignature(id, file),
        onSuccess: invalidate,
    });
    const removeSigMut = useMutation({
        mutationFn: removeWorkerSignature,
        onSuccess: invalidate,
    });
    const uploadStampMut = useMutation({
        mutationFn: ({ id, file }: { id: number; file: File }) => uploadWorkerStamp(id, file),
        onSuccess: invalidate,
    });
    const removeStampMut = useMutation({
        mutationFn: removeWorkerStamp,
        onSuccess: invalidate,
    });

    function handleUploadSig(workerId: number) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = () => {
            const f = input.files?.[0];
            if (f) uploadSigMut.mutate({ id: workerId, file: f });
        };
        input.click();
    }

    function handleUploadStamp(workerId: number) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = () => {
            const f = input.files?.[0];
            if (f) uploadStampMut.mutate({ id: workerId, file: f });
        };
        input.click();
    }

    function resetForm() {
        setShowForm(false); setEditId(null);
        setName(""); setPosition(""); setPhone(""); setNotes("");
        setSignatureDisplayName("");
        setPhoto(null); setPhotoPreview(null); setError(null);
        setDailyWageRate(""); setOvertimeRatePerHour(""); setIsPic(false); setPicPin(""); setTeamId("");
        setDefaultCityKey(""); setDefaultDivisionKey(""); setBoronganClass("");
    }

    function startEdit(w: Worker) {
        setEditId(w.id);
        setName(w.name);
        setPosition(w.position ?? "");
        setPhone(w.phone ?? "");
        setNotes(w.notes ?? "");
        setSignatureDisplayName(w.signatureDisplayName ?? "");
        setPhoto(null);
        setPhotoPreview(w.photoUrl ? `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}${w.photoUrl}` : null);
        setDailyWageRate(w.dailyWageRate ?? "");
        setOvertimeRatePerHour(w.overtimeRatePerHour ?? "");
        setIsPic(w.isPic);
        setPicPin(w.picPin ?? "");
        setTeamId(w.teamId ?? "");
        setDefaultCityKey(w.defaultCityKey ?? "");
        setDefaultDivisionKey(w.defaultDivisionKey ?? "");
        setBoronganClass(w.boronganClass ?? "");
        setShowForm(true);
        setError(null);
    }

    const regenerateTokenMut = useMutation({
        mutationFn: regeneratePicToken,
        onSuccess: () => invalidate(),
        onError: (e: any) => alert(`Gagal regenerate: ${e?.response?.data?.message || e?.message}`),
    });

    function handleCopyLink(w: Worker) {
        if (!w.picAccessToken) return;
        const url = `${window.location.origin}/pic/${w.picAccessToken}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopiedTokenId(w.id);
            setTimeout(() => setCopiedTokenId(null), 2000);
        });
    }

    function handleRegenerate(w: Worker) {
        if (!confirm(`Regenerate token PIC untuk ${w.name}?\n\nLink lama akan langsung tidak valid.`)) return;
        regenerateTokenMut.mutate(w.id);
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
            signatureDisplayName: signatureDisplayName.trim() || null,
            dailyWageRate: dailyWageRate.trim() || null,
            overtimeRatePerHour: overtimeRatePerHour.trim() || null,
            isPic,
            picPin: picPin.trim() || null,
            teamId: teamId === "" ? null : Number(teamId),
            defaultCityKey: defaultCityKey.trim() || null,
            defaultDivisionKey: defaultDivisionKey.trim() || null,
            boronganClass: boronganClass || null,
        };
        if (photo) data.photo = photo;
        if (editId) updateMut.mutate({ id: editId, data });
        else createMut.mutate(data);
    }

    return (
        <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
            {/* ── Header ── */}
            <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <UsersIcon className="h-5.5 w-5.5" />
                </div>
                <div className="min-w-0">
                    <h1 className="text-xl font-bold leading-tight">Pekerja / Tukang</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Daftar pekerja yang dapat mengambil barang dari gudang. Foto dipakai untuk identifikasi.
                    </p>
                </div>
            </div>

            {/* ── Toolbar (sticky) ── */}
            <div className="glass-strong rounded-2xl p-2 flex flex-col gap-2 sm:flex-row sm:items-center sticky top-2 z-20">
                {/* Search */}
                <div className="relative flex-1 min-w-0">
                    <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari nama atau nomor HP…"
                        className="w-full h-10 pl-9 pr-8 rounded-xl border border-border bg-card text-sm outline-none focus:ring-2 focus:ring-ring/40 transition-shadow"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            title="Bersihkan"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted cursor-pointer transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* Filter role */}
                    <select
                        value={positionFilter}
                        onChange={(e) => setPositionFilter(e.target.value)}
                        className="h-10 border border-border rounded-xl px-3 text-sm bg-card cursor-pointer outline-none focus:ring-2 focus:ring-ring/40"
                    >
                        <option value="">Semua role</option>
                        {WORKER_POSITIONS.map((p) => (
                            <option key={p.value} value={p.value}>
                                {p.label}
                            </option>
                        ))}
                    </select>
                    {/* Toggle nonaktif */}
                    <button
                        onClick={() => setShowInactive((v) => !v)}
                        title={showInactive ? "Sembunyikan pekerja nonaktif" : "Tampilkan pekerja nonaktif"}
                        className={`h-10 px-3 inline-flex items-center gap-1.5 rounded-xl border text-sm cursor-pointer transition-colors ${showInactive ? "border-border bg-card hover:bg-muted" : "border-transparent bg-muted text-muted-foreground"}`}
                    >
                        {showInactive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        <span className="hidden sm:inline">Nonaktif</span>
                    </button>
                    {/* Tambah */}
                    <button
                        onClick={() => { resetForm(); setShowForm(true); }}
                        className="h-10 px-3.5 inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium shadow-sm hover:opacity-90 cursor-pointer transition-opacity whitespace-nowrap"
                    >
                        <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Tambah</span>
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="glass-strong rounded-2xl overflow-hidden animate-in">
                    {/* Panel header */}
                    <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border/60 bg-card/40">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                {editId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">{editId ? `Edit — ${name || "Pekerja"}` : "Tambah Pekerja"}</div>
                                <div className="text-[11px] text-muted-foreground">Lengkapi data lalu simpan</div>
                            </div>
                        </div>
                        <button onClick={resetForm} title="Tutup" className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-muted cursor-pointer transition-colors shrink-0">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-4 sm:p-5 space-y-6">
                        {/* ── SECTION: Identitas ── */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                                <IdCard className="h-4 w-4 text-primary shrink-0" /> Identitas
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-[128px_1fr] gap-4 sm:gap-5">
                                {/* Foto */}
                                <div>
                                    <label className={labelCls}>Foto</label>
                                    <div className="w-28 h-28 border border-border rounded-2xl bg-muted/40 flex items-center justify-center overflow-hidden">
                                        {photoPreview ? (
                                            <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <UserIcon className="h-9 w-9 text-muted-foreground" />
                                        )}
                                    </div>
                                    <label className="mt-2 cursor-pointer inline-flex items-center gap-1.5 text-xs bg-muted hover:bg-muted/70 px-2.5 py-1.5 rounded-lg transition-colors">
                                        <Upload className="h-3.5 w-3.5" /> {photoPreview ? "Ganti foto" : "Upload foto"}
                                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                                    </label>
                                </div>
                                {/* Fields */}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className={labelCls}>Nama <span className="text-destructive">*</span></label>
                                            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Budi Santoso" className={inputCls} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Jabatan / Role <span className="text-destructive">*</span></label>
                                            <select
                                                value={position}
                                                onChange={(e) => setPosition(e.target.value)}
                                                className={`${inputCls} cursor-pointer`}
                                            >
                                                <option value="">— Pilih Role —</option>
                                                {WORKER_POSITIONS.map((p) => (
                                                    <option key={p.value} value={p.value}>{p.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <p className="text-[11px] text-muted-foreground -mt-1">
                                                Pilih <b>Marketing</b> atau <b>Sales</b> untuk yang handle CRM lead. <b>Admin</b> untuk administrasi.
                                            </p>
                                        </div>
                                        <div>
                                            <label className={labelCls}>HP / WA</label>
                                            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812…" className={inputCls} />
                                        </div>
                                        <div>
                                            <label className={`${labelCls} flex items-center gap-1`}>
                                                Nama untuk TTD <span className="text-muted-foreground font-normal">(opsional)</span>
                                            </label>
                                            <input
                                                value={signatureDisplayName}
                                                onChange={(e) => setSignatureDisplayName(e.target.value)}
                                                placeholder={name ? `Default: "${name}"` : "Mis. Budi Santoso, S.T."}
                                                className={inputCls}
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <p className="text-[11px] text-muted-foreground -mt-1 flex items-start gap-1">
                                                <Info className="h-3.5 w-3.5 mt-px shrink-0" />
                                                <span>Nama formal yang tampil di bawah tanda tangan di Penawaran/Invoice/SPK. Kosongkan kalau mau pakai nama di atas.</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Catatan</label>
                                        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="(opsional)" className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-card outline-none focus:ring-2 focus:ring-ring/40 transition-shadow" />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* ── SECTION: Tanda Tangan & Stempel (hanya saat edit + role signer) ── */}
                        {isSignerPosition(position) && (
                            <section className="space-y-3 pt-5 border-t border-border/60">
                                <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                                    <Pencil className="h-4 w-4 text-primary shrink-0" /> Tanda Tangan & Stempel
                                    <span className="font-normal text-muted-foreground text-[11px]">
                                        ({position === 'ADMIN' ? 'untuk Invoice' : 'untuk Penawaran'})
                                    </span>
                                </div>
                                {editingWorker ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                                        {/* Signature slot */}
                                        <div>
                                            <div className="text-[11px] text-muted-foreground mb-1">Tanda Tangan</div>
                                            <div className="aspect-[2/1] rounded-xl border border-dashed border-border bg-card overflow-hidden flex items-center justify-center">
                                                {editingWorker.signatureImageUrl ? (
                                                    <img src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}${editingWorker.signatureImageUrl}`} alt="TTD" className="max-w-full max-h-full object-contain" />
                                                ) : (
                                                    <span className="text-[11px] text-muted-foreground">— belum ada —</span>
                                                )}
                                            </div>
                                            <div className="flex gap-1.5 mt-1.5">
                                                <button
                                                    onClick={() => handleUploadSig(editingWorker.id)}
                                                    disabled={uploadSigMut.isPending}
                                                    className="flex-1 h-9 inline-flex items-center justify-center gap-1 text-xs px-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 cursor-pointer transition-colors"
                                                >
                                                    {uploadSigMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                                    {editingWorker.signatureImageUrl ? "Ganti" : "Upload"}
                                                </button>
                                                {editingWorker.signatureImageUrl && (
                                                    <button
                                                        onClick={() => { if (confirm("Hapus tanda tangan?")) removeSigMut.mutate(editingWorker.id); }}
                                                        title="Hapus tanda tangan"
                                                        className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {/* Stamp slot */}
                                        <div>
                                            <div className="text-[11px] text-muted-foreground mb-1">Stempel <span className="opacity-70">(opsional)</span></div>
                                            <div className="aspect-[2/1] rounded-xl border border-dashed border-border bg-card overflow-hidden flex items-center justify-center">
                                                {editingWorker.stampImageUrl ? (
                                                    <img src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}${editingWorker.stampImageUrl}`} alt="Stempel" className="max-w-full max-h-full object-contain" />
                                                ) : (
                                                    <span className="text-[11px] text-muted-foreground">— belum ada —</span>
                                                )}
                                            </div>
                                            <div className="flex gap-1.5 mt-1.5">
                                                <button
                                                    onClick={() => handleUploadStamp(editingWorker.id)}
                                                    disabled={uploadStampMut.isPending}
                                                    className="flex-1 h-9 inline-flex items-center justify-center gap-1 text-xs px-2 rounded-lg bg-warning/15 text-warning hover:bg-warning/25 disabled:opacity-50 cursor-pointer transition-colors"
                                                >
                                                    {uploadStampMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                                    {editingWorker.stampImageUrl ? "Ganti" : "Upload"}
                                                </button>
                                                {editingWorker.stampImageUrl && (
                                                    <button
                                                        onClick={() => { if (confirm("Hapus stempel?")) removeStampMut.mutate(editingWorker.id); }}
                                                        title="Hapus stempel"
                                                        className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                                        <Info className="h-3.5 w-3.5 mt-px shrink-0" />
                                        <span>Simpan pekerja ini dulu, lalu buka lagi untuk mengunggah tanda tangan & stempel.</span>
                                    </p>
                                )}
                            </section>
                        )}

                        {/* ── SECTION: Payroll & Absensi ── */}
                        <section className="space-y-4 pt-5 border-t border-border/60">
                            <div className="flex items-center gap-2 text-[13px] font-semibold text-success">
                                <Wallet className="h-4 w-4 shrink-0" /> Payroll & Absensi
                            </div>
                            <div>
                                <label className={labelCls}>Tim Crew <span className="text-muted-foreground font-normal">(opsional)</span></label>
                                <select
                                    value={teamId === "" ? "" : String(teamId)}
                                    onChange={(e) => setTeamId(e.target.value === "" ? "" : Number(e.target.value))}
                                    className={`${inputCls} cursor-pointer`}
                                >
                                    <option value="">— Tidak ada tim (independent) —</option>
                                    {teams.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name}{t.leader ? ` (PIC: ${t.leader.name})` : ""}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-muted-foreground mt-1.5">
                                    Worker hanya muncul di link absensi PIC tim-nya. Kalau PIC sendiri, biarkan kosong — sistem auto-bikin tim saat PIC pertama buka link.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className={labelCls}>Default Kota</label>
                                    <input type="text" list="wage-cities-options" value={defaultCityKey} onChange={(e) => setDefaultCityKey(e.target.value)} placeholder="Jakarta" className={inputCls} />
                                    <datalist id="wage-cities-options">
                                        {(wageDistinct?.cities ?? []).map((c) => <option key={c} value={c} />)}
                                    </datalist>
                                </div>
                                <div>
                                    <label className={labelCls}>Default Divisi</label>
                                    <input type="text" list="wage-divisions-options" value={defaultDivisionKey} onChange={(e) => setDefaultDivisionKey(e.target.value)} placeholder="Tukang Kayu" className={inputCls} />
                                    <datalist id="wage-divisions-options">
                                        {(wageDistinct?.divisions ?? []).map((d) => <option key={d} value={d} />)}
                                    </datalist>
                                </div>
                                <p className="text-[11px] text-muted-foreground md:col-span-2 -mt-1">
                                    Auto-pilih di dropdown PIC saat absensi worker ini. Bisa di-override per shift.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className={labelCls}>Gaji Harian (Rp)</label>
                                    <input type="text" inputMode="numeric" value={dailyWageRate} onChange={(e) => setDailyWageRate(e.target.value.replace(/[^\d.]/g, ""))} placeholder="150000" className={`${inputCls} font-mono nums`} />
                                    <p className="text-[11px] text-muted-foreground mt-1.5">Setengah hari otomatis = 50%.</p>
                                </div>
                                <div>
                                    <label className={labelCls}>Lembur per Jam (Rp)</label>
                                    <input type="text" inputMode="numeric" value={overtimeRatePerHour} onChange={(e) => setOvertimeRatePerHour(e.target.value.replace(/[^\d.]/g, ""))} placeholder="20000" className={`${inputCls} font-mono nums`} />
                                    <p className="text-[11px] text-muted-foreground mt-1.5">Dihitung setelah jam 17:00.</p>
                                </div>
                                <div>
                                    <label className={labelCls}>Kelas Borongan</label>
                                    <select value={boronganClass} onChange={(e) => setBoronganClass(e.target.value)} className={`${inputCls} cursor-pointer`}>
                                        <option value="">— Tanpa kelas —</option>
                                        <option value="KELAS_A">Kelas A</option>
                                        <option value="KELAS_B">Kelas B</option>
                                    </select>
                                    <p className="text-[11px] text-muted-foreground mt-1.5">Default gaji borongan per event.</p>
                                </div>
                            </div>

                            {/* PIC toggle — card style */}
                            <div className={`rounded-xl border p-3 transition-colors ${isPic ? "border-info/40 bg-info/5" : "border-border bg-card/40"}`}>
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input type="checkbox" checked={isPic} onChange={(e) => setIsPic(e.target.checked)} className="h-4 w-4 accent-info" />
                                    <span className="min-w-0">
                                        <span className="text-sm font-medium">Aktifkan sebagai PIC</span>
                                        <span className="block text-[11px] text-muted-foreground">Bisa isi absensi via link tanpa perlu login.</span>
                                    </span>
                                </label>
                                {isPic && (
                                    <div className="mt-3 pl-7">
                                        <label className={labelCls}>
                                            PIN PIC (4–6 digit) <span className="text-muted-foreground font-normal">— opsional</span>
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={picPin}
                                            onChange={(e) => setPicPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                            placeholder="1234"
                                            maxLength={6}
                                            className="w-32 h-10 border border-border rounded-xl px-3 text-sm bg-card font-mono tracking-[0.3em] text-center outline-none focus:ring-2 focus:ring-ring/40"
                                        />
                                        <p className="text-[11px] text-muted-foreground mt-1.5">
                                            Kalau PIN di-set, PIC harus input PIN saat buka link. Kosongkan untuk hapus PIN.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* ── SECTION: Link Absensi PIC (hanya saat edit + sudah punya token) ── */}
                        {editingWorker?.isPic && editingWorker.picAccessToken && (
                            <section className="space-y-2 pt-5 border-t border-border/60">
                                <div className="flex items-center gap-2 text-[13px] font-semibold text-info">
                                    <LinkIcon className="h-4 w-4 shrink-0" /> Link Absensi PIC
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        readOnly
                                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/pic/${editingWorker.picAccessToken}`}
                                        className="flex-1 min-w-0 h-10 px-3 text-xs font-mono border border-border rounded-xl bg-muted/30 truncate outline-none"
                                        onFocus={(e) => e.currentTarget.select()}
                                    />
                                    <button
                                        onClick={() => handleCopyLink(editingWorker)}
                                        title="Copy link"
                                        className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-info/15 text-info hover:bg-info/25 cursor-pointer transition-colors shrink-0"
                                    >
                                        {copiedTokenId === editingWorker.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                    </button>
                                    <button
                                        onClick={() => handleRegenerate(editingWorker)}
                                        disabled={regenerateTokenMut.isPending}
                                        title="Regenerate token (link lama jadi invalid)"
                                        className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-warning/15 text-warning hover:bg-warning/25 disabled:opacity-50 cursor-pointer transition-colors shrink-0"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${regenerateTokenMut.isPending ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                    <span>Kasih link ini ke {editingWorker.name} untuk isi absensi tanpa login.</span>
                                    {editingWorker.picPin ? (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold">
                                            <Lock className="h-3 w-3" /> PIN aktif
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-warning/15 text-warning font-semibold">
                                            <AlertTriangle className="h-3 w-3" /> Belum pakai PIN
                                        </span>
                                    )}
                                </p>
                            </section>
                        )}

                        {editId && isPic && !editingWorker?.picAccessToken && (
                            <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                                <Info className="h-3.5 w-3.5 mt-px shrink-0" />
                                <span>Simpan dulu — link absensi PIC akan muncul di sini setelah tersimpan.</span>
                            </p>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 sm:px-5 py-3 border-t border-border/60 bg-card/40 flex items-center gap-2">
                        {error && (
                            <p className="text-xs text-destructive flex items-center gap-1.5 mr-auto">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
                            </p>
                        )}
                        <button onClick={resetForm} className="h-10 px-4 text-sm border border-border rounded-xl hover:bg-muted cursor-pointer transition-colors ml-auto">Batal</button>
                        <button
                            onClick={handleSave}
                            disabled={createMut.isPending || updateMut.isPending}
                            className="h-10 inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 rounded-xl text-sm font-medium shadow-sm hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
                        >
                            {(createMut.isPending || updateMut.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            {editId ? "Update" : "Simpan"}
                        </button>
                    </div>
                </div>
            )}

            {!isLoading && workers.length > 0 && (
                <div className="text-[11px] text-muted-foreground px-0.5">
                    {filteredWorkers.length} dari {workers.length} pekerja{q ? ` cocok "${search}"` : ""}
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {isLoading && (
                    <div className="col-span-full p-10 text-center text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Memuat…
                    </div>
                )}
                {!isLoading && workers.length === 0 && (
                    <div className="col-span-full glass rounded-2xl p-10 text-center">
                        <UsersIcon className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Belum ada pekerja.</p>
                        <button onClick={() => { resetForm(); setShowForm(true); }} className="mt-3 h-9 px-3.5 inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity">
                            <Plus className="h-4 w-4" /> Tambah Pekerja
                        </button>
                    </div>
                )}
                {!isLoading && workers.length > 0 && filteredWorkers.length === 0 && (
                    <div className="col-span-full glass rounded-2xl p-10 text-center">
                        <Search className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Tidak ada pekerja cocok dengan "{search}".</p>
                    </div>
                )}
                {filteredWorkers.map((w) => (
                    <div key={w.id} className={`glass rounded-2xl p-3.5 flex gap-3 hover:shadow-md transition-shadow ${!w.isActive ? "opacity-75 ring-1 ring-warning/40 bg-warning/5" : ""}`}>
                        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
                            {w.photoUrl ? (
                                <img src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}${w.photoUrl}`} alt={w.name} className="w-full h-full object-cover" />
                            ) : (
                                <UserIcon className="h-7 w-7 text-muted-foreground" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                                {w.name}
                                {!w.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning font-semibold uppercase inline-flex items-center gap-0.5"><EyeOff className="h-3 w-3" /> Nonaktif</span>}
                            </div>
                            {(() => {
                                const meta = getPositionMeta(w.position);
                                if (meta) {
                                    const colorCls: Record<string, string> = {
                                        blue: "bg-info/15 text-info border-info/30",
                                        emerald: "bg-success/15 text-success border-success/30",
                                        violet: "bg-primary/15 text-primary border-primary/30",
                                        amber: "bg-warning/15 text-warning border-warning/30",
                                        red: "bg-destructive/12 text-destructive border-destructive/30",
                                        slate: "bg-muted text-muted-foreground border-border",
                                        pink: "bg-pink-100 text-pink-700 border-pink-200",
                                        cyan: "bg-cyan-100 text-cyan-700 border-cyan-200",
                                    };
                                    return (
                                        <span
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border mt-1 ${colorCls[meta.color] ?? "bg-muted text-muted-foreground border-border"}`}
                                        >
                                            {meta.label}
                                        </span>
                                    );
                                }
                                return (
                                    <div className="text-xs text-muted-foreground">{w.position || "— belum di-set —"}</div>
                                );
                            })()}
                            <div className="mt-1.5 flex flex-col gap-0.5">
                                {w.phone && (
                                    <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                                        <PhoneIcon className="h-3 w-3 shrink-0" /> {w.phone}
                                    </div>
                                )}
                                <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                                    <Package className="h-3 w-3 shrink-0" /> {w._count?.withdrawals ?? 0} pengambilan
                                </div>
                            </div>

                            {/* Payroll info badges */}
                            {(w.dailyWageRate || w.isPic || w.team) && (
                                <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                                    {w.dailyWageRate && (
                                        <span
                                            className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success font-mono nums inline-flex items-center gap-0.5"
                                            title={`Gaji harian: Rp ${parseFloat(w.dailyWageRate).toLocaleString('id-ID')}${w.overtimeRatePerHour ? ` · Lembur Rp ${parseFloat(w.overtimeRatePerHour).toLocaleString('id-ID')}/jam` : ''}`}
                                        >
                                            <Wallet className="h-3 w-3" /> Rp {parseFloat(w.dailyWageRate).toLocaleString('id-ID')}/hari
                                        </span>
                                    )}
                                    {w.isPic && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-info/15 text-info font-semibold inline-flex items-center gap-0.5">
                                            <UserIcon className="h-3 w-3" /> PIC
                                        </span>
                                    )}
                                    {w.team && (
                                        <span
                                            className="text-[10px] px-1.5 py-0.5 rounded font-semibold inline-flex items-center gap-0.5"
                                            style={{ backgroundColor: `${w.team.color}20`, color: w.team.color, border: `1px solid ${w.team.color}40` }}
                                            title={`Member tim ${w.team.name}`}
                                        >
                                            <Tag className="h-3 w-3" /> {w.team.name}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Indikator kelengkapan TTD/Stempel & Link PIC — detail dikelola di form edit */}
                            {(isSignerPosition(w.position) || (w.isPic && w.picAccessToken)) && (
                                <div className="mt-2 flex items-center gap-1 flex-wrap">
                                    {isSignerPosition(w.position) && (
                                        <span
                                            className={`text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 border ${w.signatureImageUrl ? "bg-success/12 text-success border-success/25" : "bg-muted text-muted-foreground border-border"}`}
                                            title={w.signatureImageUrl ? "Tanda tangan sudah diunggah" : "Tanda tangan belum ada — klik Edit untuk unggah"}
                                        >
                                            <Pencil className="h-3 w-3" /> TTD {w.signatureImageUrl ? "✓" : "—"}
                                        </span>
                                    )}
                                    {w.isPic && w.picAccessToken && (
                                        <span
                                            className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 bg-info/12 text-info border border-info/25"
                                            title="Punya link absensi PIC — kelola di Edit"
                                        >
                                            <LinkIcon className="h-3 w-3" /> Link PIC
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                            <button onClick={() => startEdit(w)} title="Edit" className="h-9 w-9 inline-flex items-center justify-center hover:bg-muted rounded-lg cursor-pointer transition-colors">
                                <Pencil className="h-4 w-4" />
                            </button>
                            {w.isActive ? (
                                <button onClick={() => toggleActiveMut.mutate({ id: w.id, isActive: false })} title="Nonaktifkan" className="h-9 w-9 inline-flex items-center justify-center hover:bg-muted rounded-lg cursor-pointer transition-colors">
                                    <EyeOff className="h-4 w-4" />
                                </button>
                            ) : (
                                <button onClick={() => restoreMut.mutate(w.id)} title="Aktifkan" className="h-9 w-9 inline-flex items-center justify-center hover:bg-success/10 text-success rounded-lg cursor-pointer transition-colors">
                                    <Eye className="h-4 w-4" />
                                </button>
                            )}
                            <button onClick={() => { setDeleteResult(null); setDeleteError(null); setForceConfirm(false); setDeleteConfirm(w); }} title="Hapus" className="h-9 w-9 inline-flex items-center justify-center hover:bg-destructive/10 text-destructive rounded-lg cursor-pointer transition-colors">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Portal ke document.body: keluar dari containing-block .glass (backdrop-filter) di
                settings/layout agar `fixed inset-0` benar-benar center di viewport, bukan tenggelam
                di atas konten saat halaman di-scroll. */}
            {deleteConfirm && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-background border rounded-lg shadow-lg max-w-md w-full p-5 space-y-3">
                        {/* STATE 2: konfirmasi keras hapus permanen paksa (destruktif) */}
                        {forceConfirm ? (
                            <>
                                <h3 className="font-semibold flex items-center gap-2 text-destructive">
                                    <AlertTriangle className="h-5 w-5" /> Hapus PERMANEN? Tidak bisa dibatalkan
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Menghapus <b>{deleteConfirm.name}</b> secara permanen akan <b>ikut menghapus</b> seluruh
                                    data terkait: <b>absensi</b>, <b>penugasan crew</b>, <b>pengambilan barang</b>,
                                    <b> borongan &amp; slip gaji borongan</b>. Riwayat lead akan dilepas (nama pekerja hilang dari lead).
                                    Data yang terhapus <b>tidak dapat dikembalikan</b>.
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Kalau ragu, pakai <b>Nonaktifkan</b> saja — pekerja hilang dari daftar aktif tapi riwayat tetap aman.
                                </p>
                                {deleteError && (
                                    <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2 flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                        <span>Gagal menghapus: {deleteError}</span>
                                    </p>
                                )}
                                <div className="flex items-center gap-2 justify-end">
                                    <button onClick={() => { setForceConfirm(false); setDeleteError(null); }} disabled={deleteMut.isPending} className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted disabled:opacity-50 cursor-pointer transition-colors">
                                        <X className="h-4 w-4 inline -mt-0.5" /> Batal
                                    </button>
                                    <button
                                        onClick={() => deleteMut.mutate({ id: deleteConfirm.id, force: true })}
                                        disabled={deleteMut.isPending}
                                        className="flex items-center gap-1 bg-destructive text-destructive-foreground px-3 py-1.5 rounded text-sm hover:bg-destructive/90 disabled:opacity-50 cursor-pointer transition-colors"
                                    >
                                        {deleteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                        {deleteMut.isPending ? 'Menghapus…' : 'Ya, hapus permanen'}
                                    </button>
                                </div>
                            </>
                        ) : /* STATE 1: hasil sukses (terhapus permanen ATAU dinonaktifkan) */
                        deleteResult ? (
                            deleteResult.mode === 'hard-delete' ? (
                                <>
                                    <h3 className="font-semibold flex items-center gap-2 text-success">
                                        <Check className="h-5 w-5" /> Terhapus permanen
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {deleteResult.forced
                                            ? <><b>{deleteConfirm.name}</b> beserta seluruh riwayat terkait (absensi, penugasan crew, pengambilan barang, borongan) telah dihapus permanen dari sistem.</>
                                            : <><b>{deleteConfirm.name}</b> belum punya riwayat, jadi dihapus permanen dari sistem.</>}
                                    </p>
                                    <div className="flex justify-end">
                                        <button onClick={closeDeleteDialog} className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted cursor-pointer transition-colors">Tutup</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h3 className="font-semibold flex items-center gap-2 text-warning">
                                        <EyeOff className="h-5 w-5" /> Dinonaktifkan (bukan gagal)
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        <b>{deleteConfirm.name}</b> tidak bisa dihapus permanen karena masih punya
                                        {deleteResult.usage > 0 ? <> <b>{deleteResult.usage}</b> data</> : <> data</>} riwayat terkait
                                        (absensi, penugasan crew, pengambilan barang, borongan, lead, dll).
                                        Karyawan sudah <b>dinonaktifkan</b> (ditandai badge <b>Nonaktif</b> di daftar) dan tidak lagi muncul di dropdown/pilihan aktif — seluruh riwayat tetap aman.
                                        Kamu bisa mengaktifkannya lagi kapan saja lewat tombol <Eye className="h-3.5 w-3.5 inline -mt-0.5" />.
                                    </p>
                                    <div className="flex items-center justify-between gap-2">
                                        <button
                                            onClick={() => { setDeleteError(null); setForceConfirm(true); }}
                                            className="text-xs text-destructive hover:underline inline-flex items-center gap-1 cursor-pointer"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" /> Hapus permanen paksa…
                                        </button>
                                        <button onClick={closeDeleteDialog} className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted cursor-pointer transition-colors">Mengerti</button>
                                    </div>
                                </>
                            )
                        ) : (
                            /* STATE 0: konfirmasi (dengan error inline bila ada) */
                            <>
                                <h3 className="font-semibold">Hapus pekerja?</h3>
                                <p className="text-sm text-muted-foreground">
                                    <b>{deleteConfirm.name}</b> akan dihapus permanen bila belum punya riwayat. Jika sudah dipakai (penugasan crew, pengambilan barang, absensi, borongan, dll), otomatis <b>dinonaktifkan</b> dan seluruh riwayat tetap utuh.
                                </p>
                                {deleteError && (
                                    <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2 flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                        <span>Gagal menghapus: {deleteError}</span>
                                    </p>
                                )}
                                <div className="flex items-center gap-2 justify-end">
                                    <button onClick={closeDeleteDialog} className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted cursor-pointer transition-colors">
                                        <X className="h-4 w-4 inline -mt-0.5" /> Batal
                                    </button>
                                    <button
                                        onClick={() => deleteMut.mutate({ id: deleteConfirm.id, force: false })}
                                        disabled={deleteMut.isPending}
                                        className="flex items-center gap-1 bg-destructive text-destructive-foreground px-3 py-1.5 rounded text-sm hover:bg-destructive/90 disabled:opacity-50 cursor-pointer transition-colors"
                                    >
                                        {deleteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                        {deleteMut.isPending ? 'Memproses…' : (deleteError ? 'Coba lagi' : 'Hapus')}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
