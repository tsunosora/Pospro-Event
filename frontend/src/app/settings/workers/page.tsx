"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus, Pencil, Trash2, Loader2, Check, X, Eye, EyeOff,
    Users as UsersIcon, Upload, User as UserIcon, Link as LinkIcon, RefreshCw, Copy,
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
    const [copiedTokenId, setCopiedTokenId] = useState<number | null>(null);

    const { data: workers = [], isLoading } = useQuery<Worker[]>({
        queryKey: ["workers", showInactive, positionFilter],
        queryFn: () => getWorkers(showInactive, { position: positionFilter || undefined }),
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
        setDefaultCityKey(""); setDefaultDivisionKey("");
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
                <div className="flex items-center gap-2 flex-wrap">
                    <select
                        value={positionFilter}
                        onChange={(e) => setPositionFilter(e.target.value)}
                        className="text-xs border rounded px-2 py-1.5 bg-white"
                    >
                        <option value="">Semua role</option>
                        {WORKER_POSITIONS.map((p) => (
                            <option key={p.value} value={p.value}>
                                {p.emoji} {p.label}
                            </option>
                        ))}
                    </select>
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
                                    <label className="text-xs font-medium block mb-1">
                                        Jabatan / Role <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={position}
                                        onChange={(e) => setPosition(e.target.value)}
                                        className="w-full border rounded px-3 py-2 text-sm bg-white"
                                    >
                                        <option value="">— Pilih Role —</option>
                                        {WORKER_POSITIONS.map((p) => (
                                            <option key={p.value} value={p.value}>
                                                {p.emoji} {p.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Pilih <b>Marketing</b> atau <b>Sales</b> untuk yang handle CRM lead. <b>Admin</b> untuk administrasi.
                                    </p>
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

                            {/* ── Custom nama untuk TTD ── */}
                            <div>
                                <label className="text-xs font-medium block mb-1">
                                    ✍️ Nama untuk TTD <span className="text-muted-foreground font-normal">(opsional)</span>
                                </label>
                                <input
                                    value={signatureDisplayName}
                                    onChange={(e) => setSignatureDisplayName(e.target.value)}
                                    placeholder={name ? `Default: "${name}"` : "Mis. Budi Santoso, S.T."}
                                    className="w-full border rounded px-3 py-2 text-sm"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    💡 Nama formal yang tampil di bawah tanda tangan di Penawaran/Invoice/SPK.
                                    Kosongkan kalau mau pakai nama panggilan di atas.
                                </p>
                            </div>

                            {/* ── Payroll section ── */}
                            <div className="pt-2 border-t border-dashed border-border">
                                <div className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1">
                                    💰 Payroll & Absensi
                                </div>
                                <div className="mb-3">
                                    <label className="text-xs font-medium block mb-1">Tim Crew (opsional)</label>
                                    <select
                                        value={teamId === "" ? "" : String(teamId)}
                                        onChange={(e) => setTeamId(e.target.value === "" ? "" : Number(e.target.value))}
                                        className="w-full border rounded px-3 py-2 text-sm bg-white"
                                    >
                                        <option value="">— Tidak ada tim (independent) —</option>
                                        {teams.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name}{t.leader ? ` (PIC: ${t.leader.name})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Worker hanya muncul di link absensi PIC tim-nya. Kalau PIC sendiri, biarkan kosong — sistem auto-bikin tim saat PIC pertama buka link.
                                    </p>
                                </div>
                                {/* Default kota & divisi — auto-prefill di PIC dropdown */}
                                <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-medium block mb-1">Default Kota</label>
                                        <input
                                            type="text"
                                            list="wage-cities-options"
                                            value={defaultCityKey}
                                            onChange={(e) => setDefaultCityKey(e.target.value)}
                                            placeholder="Jakarta"
                                            className="w-full border rounded px-3 py-2 text-sm"
                                        />
                                        <datalist id="wage-cities-options">
                                            {(wageDistinct?.cities ?? []).map((c) => <option key={c} value={c} />)}
                                        </datalist>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium block mb-1">Default Divisi</label>
                                        <input
                                            type="text"
                                            list="wage-divisions-options"
                                            value={defaultDivisionKey}
                                            onChange={(e) => setDefaultDivisionKey(e.target.value)}
                                            placeholder="Tukang Kayu"
                                            className="w-full border rounded px-3 py-2 text-sm"
                                        />
                                        <datalist id="wage-divisions-options">
                                            {(wageDistinct?.divisions ?? []).map((d) => <option key={d} value={d} />)}
                                        </datalist>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground md:col-span-2 -mt-1">
                                        Auto-pilih di dropdown PIC saat absensi worker ini. Bisa di-override per shift.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-medium block mb-1">Gaji Harian (Rp)</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={dailyWageRate}
                                            onChange={(e) => setDailyWageRate(e.target.value.replace(/[^\d.]/g, ""))}
                                            placeholder="150000"
                                            className="w-full border rounded px-3 py-2 text-sm"
                                        />
                                        <p className="text-[10px] text-muted-foreground mt-1">Setengah hari otomatis = 50%.</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium block mb-1">Lembur per Jam (Rp)</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={overtimeRatePerHour}
                                            onChange={(e) => setOvertimeRatePerHour(e.target.value.replace(/[^\d.]/g, ""))}
                                            placeholder="20000"
                                            className="w-full border rounded px-3 py-2 text-sm"
                                        />
                                        <p className="text-[10px] text-muted-foreground mt-1">Mulai dihitung setelah jam 17:00.</p>
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-sm mt-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isPic}
                                        onChange={(e) => setIsPic(e.target.checked)}
                                        className="h-4 w-4"
                                    />
                                    <span className="font-medium">Aktifkan sebagai PIC</span>
                                    <span className="text-[11px] text-muted-foreground">— bisa isi absensi via link tanpa login</span>
                                </label>
                                {isPic && (
                                    <div className="mt-2">
                                        <label className="text-xs font-medium block mb-1">
                                            PIN PIC (4-6 digit) <span className="text-[10px] text-muted-foreground font-normal">— opsional, security tambahan</span>
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={picPin}
                                            onChange={(e) => setPicPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                            placeholder="1234"
                                            maxLength={6}
                                            className="w-32 border rounded px-3 py-2 text-sm font-mono tracking-widest text-center"
                                        />
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            Kalau PIN di-set, PIC harus input PIN saat buka link. Kosongkan untuk hapus PIN.
                                        </p>
                                    </div>
                                )}
                                {editId && isPic && (
                                    <p className="text-[10px] text-muted-foreground mt-1.5">
                                        Setelah simpan, link PIC akan muncul di kartu worker.
                                    </p>
                                )}
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
                            {(() => {
                                const meta = getPositionMeta(w.position);
                                if (meta) {
                                    const colorCls: Record<string, string> = {
                                        blue: "bg-blue-100 text-blue-700 border-blue-200",
                                        emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
                                        violet: "bg-violet-100 text-violet-700 border-violet-200",
                                        amber: "bg-amber-100 text-amber-700 border-amber-200",
                                        red: "bg-red-100 text-red-700 border-red-200",
                                        slate: "bg-slate-100 text-slate-700 border-slate-200",
                                        pink: "bg-pink-100 text-pink-700 border-pink-200",
                                        cyan: "bg-cyan-100 text-cyan-700 border-cyan-200",
                                    };
                                    return (
                                        <span
                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border mt-0.5 ${colorCls[meta.color] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}
                                        >
                                            <span>{meta.emoji}</span>
                                            {meta.label}
                                        </span>
                                    );
                                }
                                return (
                                    <div className="text-xs text-muted-foreground">{w.position || "— belum di-set —"}</div>
                                );
                            })()}
                            {w.phone && <div className="text-xs text-muted-foreground">{w.phone}</div>}
                            <div className="text-[11px] text-muted-foreground mt-1">
                                {w._count?.withdrawals ?? 0} pengambilan
                            </div>

                            {/* Payroll info badges */}
                            {(w.dailyWageRate || w.isPic || w.team) && (
                                <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                                    {w.dailyWageRate && (
                                        <span
                                            className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-mono"
                                            title={`Gaji harian: Rp ${parseFloat(w.dailyWageRate).toLocaleString('id-ID')}${w.overtimeRatePerHour ? ` · Lembur Rp ${parseFloat(w.overtimeRatePerHour).toLocaleString('id-ID')}/jam` : ''}`}
                                        >
                                            💰 Rp {parseFloat(w.dailyWageRate).toLocaleString('id-ID')}/hari
                                        </span>
                                    )}
                                    {w.isPic && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">
                                            👤 PIC
                                        </span>
                                    )}
                                    {w.team && (
                                        <span
                                            className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                                            style={{ backgroundColor: `${w.team.color}20`, color: w.team.color, border: `1px solid ${w.team.color}40` }}
                                            title={`Member tim ${w.team.name}`}
                                        >
                                            🏷️ {w.team.name}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* PIC link section — tampil kalau worker = PIC dan punya token */}
                            {w.isPic && w.picAccessToken && (
                                <div className="mt-2 pt-2 border-t border-border/40">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-blue-600 mb-1 flex items-center gap-1">
                                        <LinkIcon className="h-3 w-3" />
                                        Link Absensi PIC
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <input
                                            readOnly
                                            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/pic/${w.picAccessToken}`}
                                            className="flex-1 px-2 py-1 text-[10px] font-mono border rounded bg-muted/30 truncate"
                                            onFocus={(e) => e.currentTarget.select()}
                                        />
                                        <button
                                            onClick={() => handleCopyLink(w)}
                                            title="Copy link"
                                            className="p-1.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                                        >
                                            {copiedTokenId === w.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                        </button>
                                        <button
                                            onClick={() => handleRegenerate(w)}
                                            disabled={regenerateTokenMut.isPending}
                                            title="Regenerate token (link lama jadi invalid)"
                                            className="p-1.5 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                                        >
                                            <RefreshCw className={`h-3 w-3 ${regenerateTokenMut.isPending ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        Kasih link ini ke {w.name} untuk isi absensi tanpa login.
                                        {w.picPin ? (
                                            <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold">
                                                🔐 PIN aktif
                                            </span>
                                        ) : (
                                            <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">
                                                ⚠️ Belum pakai PIN
                                            </span>
                                        )}
                                    </p>
                                </div>
                            )}

                            {/* Signature + Stamp untuk worker MARKETING/SALES (penawaran) atau ADMIN (invoice) */}
                            {isSignerPosition(w.position) && (
                                <div className="mt-2 pt-2 border-t border-border/40">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-violet-600 mb-1">
                                        Tanda Tangan & Stempel
                                        <span className="ml-1 font-normal text-muted-foreground normal-case">
                                            ({w.position === 'ADMIN' ? 'untuk Invoice' : 'untuk Penawaran'})
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {/* Signature slot */}
                                        <div>
                                            <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-between gap-1">
                                                <span>Tanda Tangan</span>
                                                {w.signatureDisplayName && (
                                                    <span className="text-[9px] px-1 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold" title={`Nama di TTD: ${w.signatureDisplayName}`}>
                                                        ✍️ {w.signatureDisplayName.length > 18 ? w.signatureDisplayName.slice(0, 16) + "…" : w.signatureDisplayName}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="aspect-[2/1] rounded border border-dashed bg-white overflow-hidden flex items-center justify-center">
                                                {w.signatureImageUrl ? (
                                                    <img
                                                        src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}${w.signatureImageUrl}`}
                                                        alt="TTD"
                                                        className="max-w-full max-h-full object-contain"
                                                    />
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground">— belum ada —</span>
                                                )}
                                            </div>
                                            <div className="flex gap-1 mt-1">
                                                <button
                                                    onClick={() => handleUploadSig(w.id)}
                                                    disabled={uploadSigMut.isPending}
                                                    className="flex-1 inline-flex items-center justify-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-violet-100 text-violet-700 hover:bg-violet-200 disabled:opacity-50"
                                                >
                                                    {uploadSigMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                                                    {w.signatureImageUrl ? "Ganti" : "Upload"}
                                                </button>
                                                {w.signatureImageUrl && (
                                                    <button
                                                        onClick={() => { if (confirm("Hapus tanda tangan?")) removeSigMut.mutate(w.id); }}
                                                        className="text-[10px] px-1 py-0.5 rounded text-red-600 hover:bg-red-50"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {/* Stamp slot */}
                                        <div>
                                            <div className="text-[10px] text-muted-foreground mb-0.5">Stempel</div>
                                            <div className="aspect-square rounded border border-dashed bg-white overflow-hidden flex items-center justify-center">
                                                {w.stampImageUrl ? (
                                                    <img
                                                        src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}${w.stampImageUrl}`}
                                                        alt="Stempel"
                                                        className="max-w-full max-h-full object-contain"
                                                    />
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground">— optional —</span>
                                                )}
                                            </div>
                                            <div className="flex gap-1 mt-1">
                                                <button
                                                    onClick={() => handleUploadStamp(w.id)}
                                                    disabled={uploadStampMut.isPending}
                                                    className="flex-1 inline-flex items-center justify-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                                                >
                                                    {uploadStampMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                                                    {w.stampImageUrl ? "Ganti" : "Upload"}
                                                </button>
                                                {w.stampImageUrl && (
                                                    <button
                                                        onClick={() => { if (confirm("Hapus stempel?")) removeStampMut.mutate(w.id); }}
                                                        className="text-[10px] px-1 py-0.5 rounded text-red-600 hover:bg-red-50"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
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
