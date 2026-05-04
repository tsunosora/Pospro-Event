"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
    checkPicToken,
    getPicContext,
    getPicTeam,
    addPicTeamMember,
    removePicTeamMember,
    submitPicAttendance,
    type AttendanceStatus,
    type PicContext,
    type PicTeamData,
} from "@/lib/api/payroll";
import { Calendar, Check, Clock, Loader2, Lock, Plus, RefreshCw, Trash2, User as UserIcon, Users as UsersIcon, X } from "lucide-react";

const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string; emoji: string; cls: string; activeCls: string }> = [
    {
        value: "FULL_DAY", label: "HADIR", emoji: "✓",
        cls: "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50",
        activeCls: "border-emerald-600 bg-emerald-600 text-white ring-4 ring-emerald-200",
    },
    {
        value: "HALF_DAY", label: "½ HARI", emoji: "½",
        cls: "border-amber-300 bg-white text-amber-700 hover:bg-amber-50",
        activeCls: "border-amber-600 bg-amber-600 text-white ring-4 ring-amber-200",
    },
    {
        value: "ABSENT", label: "ABSEN", emoji: "✗",
        cls: "border-red-300 bg-white text-red-700 hover:bg-red-50",
        activeCls: "border-red-600 bg-red-600 text-white ring-4 ring-red-200",
    },
];

interface RowState {
    workerId: number;
    status: AttendanceStatus;
    overtimeHours: number;
    notes: string;
    eventId: number | null;
    cityKey: string | null;
    divisionKey: string | null;
}

function todayLocalIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PicAttendancePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const [date, setDate] = useState<string>(todayLocalIso());
    const [rows, setRows] = useState<Map<number, RowState>>(new Map());
    const [savedAt, setSavedAt] = useState<string | null>(null);

    // PIN gate state — load dari sessionStorage supaya gak prompt ulang dalam 1 session
    const [pin, setPin] = useState<string | null>(() => {
        if (typeof window === "undefined") return null;
        try { return sessionStorage.getItem(`pic-pin:${token}`); } catch { return null; }
    });
    const [pinInput, setPinInput] = useState("");
    const [pinError, setPinError] = useState<string | null>(null);
    const [showTeamModal, setShowTeamModal] = useState(false);

    // Step 1: cek apakah token valid + needs PIN (sebelum render form atau gate)
    const { data: tokenCheck, isLoading: checkingToken, error: checkError } = useQuery({
        queryKey: ["pic-token-check", token],
        queryFn: () => checkPicToken(token),
        retry: false,
    });

    const needsPin = tokenCheck?.needsPin ?? false;
    const pinValid = !needsPin || !!pin;

    // Step 2: fetch context — tunggu pin gate cleared
    const { data, isLoading, error, refetch, isFetching } = useQuery<PicContext>({
        queryKey: ["pic-context", token, date, pin],
        queryFn: () => getPicContext(token, date, pin),
        retry: false,
        enabled: pinValid,
    });

    // Auto-clear stored PIN kalau backend reject (PIN diganti admin)
    useEffect(() => {
        const e = error as any;
        const msg = e?.response?.data?.message;
        if (msg === "PIN_INVALID" || msg === "PIN_REQUIRED") {
            try { sessionStorage.removeItem(`pic-pin:${token}`); } catch { /* ignore */ }
            setPin(null);
            setPinError("PIN salah atau sudah diganti admin. Silakan input ulang.");
        }
    }, [error, token]);

    function submitPin() {
        const trimmed = pinInput.trim();
        if (!trimmed) { setPinError("PIN wajib diisi"); return; }
        try { sessionStorage.setItem(`pic-pin:${token}`, trimmed); } catch { /* ignore */ }
        setPin(trimmed);
        setPinInput("");
        setPinError(null);
    }

    function clearPin() {
        try { sessionStorage.removeItem(`pic-pin:${token}`); } catch { /* ignore */ }
        setPin(null);
        setPinInput("");
    }

    // Sync rows state setiap kali data berubah (date change atau initial load)
    // Saat tidak ada existing record, prefill dari worker default kota/divisi (kalau di-set admin).
    useEffect(() => {
        if (!data) return;
        const next = new Map<number, RowState>();
        for (const w of data.workers) {
            const e = w.existing;
            next.set(w.id, {
                workerId: w.id,
                status: (e?.status as AttendanceStatus) ?? "ABSENT",
                overtimeHours: e ? Number(e.overtimeHours) || 0 : 0,
                notes: e?.notes ?? "",
                eventId: e?.eventId ?? null,
                // Prefill priority: existing > worker default
                cityKey: e?.cityKey ?? w.defaultCityKey ?? null,
                divisionKey: e?.divisionKey ?? w.defaultDivisionKey ?? null,
            });
        }
        setRows(next);
    }, [data]);

    // Bulk apply helpers — set kota/divisi/event sekali, apply ke semua worker (yang status != ABSENT)
    const [bulkCity, setBulkCity] = useState<string>("");
    const [bulkDivision, setBulkDivision] = useState<string>("");
    const [bulkEventId, setBulkEventId] = useState<string>("");
    function applyBulk() {
        setRows((prev) => {
            const next = new Map(prev);
            for (const [k, r] of prev) {
                next.set(k, {
                    ...r,
                    cityKey: bulkCity || r.cityKey,
                    divisionKey: bulkDivision || r.divisionKey,
                    eventId: bulkEventId ? Number(bulkEventId) : r.eventId,
                });
            }
            return next;
        });
    }

    const submitMut = useMutation({
        mutationFn: () => {
            const entries = Array.from(rows.values()).map((r) => ({
                workerId: r.workerId,
                status: r.status,
                overtimeHours: r.overtimeHours,
                notes: r.notes || null,
                eventId: r.eventId,
                cityKey: r.cityKey,
                divisionKey: r.divisionKey,
            }));
            return submitPicAttendance(token, date, entries, pin);
        },
        onSuccess: (res) => {
            setSavedAt(new Date().toLocaleTimeString("id-ID"));
            refetch();
            // Toast simple
            alert(`✅ Tersimpan untuk ${res.upserted} pekerja`);
        },
        onError: (e: any) => {
            alert(`❌ Gagal simpan: ${e?.response?.data?.message || e?.message || "Unknown"}`);
        },
    });

    const totalCount = data?.workers.length ?? 0;
    const filledCount = useMemo(
        () => Array.from(rows.values()).filter((r) => r.status !== "ABSENT" || r.overtimeHours > 0).length,
        [rows],
    );

    function setStatus(workerId: number, status: AttendanceStatus) {
        setRows((prev) => {
            const next = new Map(prev);
            const cur = next.get(workerId);
            if (cur) next.set(workerId, { ...cur, status });
            return next;
        });
    }

    function setOvertime(workerId: number, hours: number) {
        setRows((prev) => {
            const next = new Map(prev);
            const cur = next.get(workerId);
            if (cur) next.set(workerId, { ...cur, overtimeHours: Math.max(0, Math.min(12, hours)) });
            return next;
        });
    }

    function setRowField(workerId: number, key: keyof RowState, value: any) {
        setRows((prev) => {
            const next = new Map(prev);
            const cur = next.get(workerId);
            if (cur) next.set(workerId, { ...cur, [key]: value });
            return next;
        });
    }

    // ─── Token check loading ──────────────────────────────────
    if (checkingToken) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    // ─── Token invalid (404 / 403 dari /check) ───────────────
    if (checkError) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
                <div className="max-w-md w-full bg-white rounded-2xl border-2 border-red-200 p-6 text-center">
                    <X className="h-12 w-12 mx-auto text-red-500 mb-3" />
                    <h1 className="text-xl font-bold text-red-700 mb-2">Link Tidak Valid</h1>
                    <p className="text-sm text-slate-600">
                        Link absensi PIC ini tidak valid atau sudah dinonaktifkan. Hubungi admin untuk dapat link baru.
                    </p>
                </div>
            </div>
        );
    }

    // ─── PIN Gate ─────────────────────────────────────────────
    if (needsPin && !pin) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
                <div className="max-w-sm w-full bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-lg">
                    <div className="text-center mb-4">
                        <div className="w-16 h-16 mx-auto rounded-full bg-blue-100 flex items-center justify-center mb-3">
                            <Lock className="h-8 w-8 text-blue-600" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-800">
                            Halo, {tokenCheck?.picName ?? "PIC"}
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">Masukkan PIN untuk lanjut</p>
                    </div>
                    <input
                        type="password"
                        inputMode="numeric"
                        autoFocus
                        value={pinInput}
                        onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6)); setPinError(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") submitPin(); }}
                        placeholder="••••"
                        maxLength={6}
                        className="w-full text-center text-3xl font-mono tracking-[0.5em] border-2 border-slate-300 rounded-xl py-4 focus:border-blue-500 focus:outline-none"
                    />
                    {pinError && (
                        <p className="text-sm text-red-600 mt-2 text-center">{pinError}</p>
                    )}
                    <button
                        type="button"
                        onClick={submitPin}
                        disabled={!pinInput.trim()}
                        className="w-full mt-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Masuk
                    </button>
                    <p className="text-xs text-center text-slate-400 mt-3">
                        Kalau lupa PIN, hubungi admin.
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
                <div className="max-w-md w-full bg-white rounded-2xl border-2 border-red-200 p-6 text-center">
                    <X className="h-12 w-12 mx-auto text-red-500 mb-3" />
                    <h1 className="text-xl font-bold text-red-700 mb-2">Link Tidak Valid</h1>
                    <p className="text-sm text-slate-600">
                        Link absensi PIC ini tidak valid atau sudah dinonaktifkan. Hubungi admin untuk dapat link baru.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-white border-b-2 border-slate-200 shadow-sm">
                <div className="max-w-2xl mx-auto px-4 py-4">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <div className="text-base sm:text-lg font-bold text-slate-800 truncate">
                                Selamat datang, {data?.pic.name ?? "..."}
                            </div>
                            <div className="text-xs text-slate-500">{data?.pic.position ?? "PIC"}</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                onClick={() => setShowTeamModal(true)}
                                className="p-2 rounded-lg border bg-white hover:bg-slate-100"
                                title="Kelola Tim"
                            >
                                <UsersIcon className="h-4 w-4" />
                            </button>
                            {needsPin && (
                                <button
                                    onClick={clearPin}
                                    className="p-2 rounded-lg border bg-white hover:bg-slate-100"
                                    title="Kunci & input PIN ulang"
                                >
                                    <Lock className="h-4 w-4" />
                                </button>
                            )}
                            <button
                                onClick={() => refetch()}
                                disabled={isFetching}
                                className="p-2 rounded-lg border bg-white hover:bg-slate-100"
                                title="Refresh"
                            >
                                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                            </button>
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-500 shrink-0" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="flex-1 px-3 py-2 border-2 border-slate-300 rounded-lg text-base font-medium"
                        />
                    </div>
                    {data?.team && (
                        <div className="mt-2 text-xs text-slate-600 flex items-center gap-1.5">
                            <UsersIcon className="h-3.5 w-3.5" />
                            Tim: <span className="font-semibold" style={{ color: data.team.color }}>{data.team.name}</span>
                            <span className="text-slate-400">· {data.workers.length} member</span>
                        </div>
                    )}
                    {savedAt && (
                        <div className="mt-2 text-xs text-emerald-600">
                            ✓ Tersimpan terakhir: {savedAt}
                        </div>
                    )}
                </div>
            </header>

            {/* Bulk apply panel */}
            {data && (data.cities.length > 0 || data.divisions.length > 0 || data.events.length > 0) && (
                <div className="max-w-2xl mx-auto px-4 pt-3">
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3">
                        <div className="text-xs font-bold text-blue-800 mb-2">⚙️ Set untuk Semua Worker</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <select
                                value={bulkCity}
                                onChange={(e) => setBulkCity(e.target.value)}
                                className="px-2 py-1.5 text-sm border-2 border-blue-300 rounded-lg bg-white"
                            >
                                <option value="">📍 Kota...</option>
                                {data.cities.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select
                                value={bulkDivision}
                                onChange={(e) => setBulkDivision(e.target.value)}
                                className="px-2 py-1.5 text-sm border-2 border-blue-300 rounded-lg bg-white"
                            >
                                <option value="">🏷️ Divisi...</option>
                                {data.divisions.map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <select
                                value={bulkEventId}
                                onChange={(e) => setBulkEventId(e.target.value)}
                                className="px-2 py-1.5 text-sm border-2 border-blue-300 rounded-lg bg-white"
                            >
                                <option value="">🎪 Event...</option>
                                {data.events.map((ev) => (
                                    <option key={ev.id} value={ev.id}>
                                        {ev.code} — {ev.name}{ev.hasWageOverride ? " 💰" : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={applyBulk}
                            disabled={!bulkCity && !bulkDivision && !bulkEventId}
                            className="mt-2 w-full sm:w-auto px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50"
                        >
                            Apply ke Semua
                        </button>
                    </div>
                </div>
            )}

            {/* Worker list */}
            <main className="max-w-2xl mx-auto px-4 py-4 space-y-3">
                {isLoading && (
                    <div className="p-6 text-center text-slate-500">
                        <Loader2 className="h-6 w-6 animate-spin inline" />
                        <div className="mt-2 text-sm">Memuat data...</div>
                    </div>
                )}
                {!isLoading && data && data.workers.length === 0 && (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 text-center">
                        <UsersIcon className="h-12 w-12 mx-auto text-amber-500 mb-2" />
                        <h3 className="font-bold text-amber-800 mb-1">Tim Anda Masih Kosong</h3>
                        <p className="text-sm text-amber-700 mb-3">
                            Tambahkan crew yang Anda handle. Klik tombol di bawah untuk pilih.
                        </p>
                        <button
                            onClick={() => setShowTeamModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                        >
                            <Plus className="h-4 w-4" />
                            Tambah Anggota Tim
                        </button>
                    </div>
                )}
                {!isLoading && data && data.workers.map((w) => {
                    const r = rows.get(w.id);
                    if (!r) return null;
                    return (
                        <div key={w.id} className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm">
                            {/* Worker info */}
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                    {w.photoUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={`${process.env.NEXT_PUBLIC_API_URL ?? ""}${w.photoUrl}`} alt={w.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <UserIcon className="h-6 w-6 text-slate-400" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold text-base text-slate-800 truncate">{w.name}</div>
                                    {w.position && <div className="text-xs text-slate-500">{w.position}</div>}
                                </div>
                                {!w.hasPayroll && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">
                                        Belum di-set gaji
                                    </span>
                                )}
                            </div>

                            {/* Status buttons — BIG, ramah orang tua */}
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                {STATUS_OPTIONS.map((opt) => {
                                    const active = r.status === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setStatus(w.id, opt.value)}
                                            className={`py-3 rounded-xl border-2 font-bold text-sm sm:text-base transition ${active ? opt.activeCls : opt.cls}`}
                                        >
                                            <div className="text-xl mb-0.5">{opt.emoji}</div>
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Overtime — dropdown + quick pick */}
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                                <div className="flex items-center gap-1.5 text-sm text-slate-700 font-medium">
                                    <Clock className="h-4 w-4" />
                                    Lembur:
                                </div>
                                <select
                                    value={r.overtimeHours}
                                    onChange={(e) => setOvertime(w.id, Number(e.target.value))}
                                    className="px-2 py-1.5 border-2 border-slate-300 rounded-lg text-sm font-mono bg-white"
                                >
                                    {Array.from({ length: 13 }, (_, i) => (
                                        <option key={i} value={i}>{i} jam</option>
                                    ))}
                                </select>
                                {/* Quick-pick chips */}
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4].map((h) => (
                                        <button
                                            key={h}
                                            type="button"
                                            onClick={() => setOvertime(w.id, h)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${r.overtimeHours === h ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"}`}
                                        >
                                            +{h}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Wage context — kota + divisi + event (per worker) */}
                            {(data.cities.length > 0 || data.divisions.length > 0 || data.events.length > 0) && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200">
                                    <select
                                        value={r.cityKey ?? ""}
                                        onChange={(e) => setRowField(w.id, "cityKey", e.target.value || null)}
                                        className="px-2 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                                        title="Kota"
                                    >
                                        <option value="">📍 Kota — default</option>
                                        {data.cities.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <select
                                        value={r.divisionKey ?? ""}
                                        onChange={(e) => setRowField(w.id, "divisionKey", e.target.value || null)}
                                        className="px-2 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                                        title="Divisi"
                                    >
                                        <option value="">🏷️ Divisi — default</option>
                                        {data.divisions.map((d) => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <select
                                        value={r.eventId ?? ""}
                                        onChange={(e) => setRowField(w.id, "eventId", e.target.value ? Number(e.target.value) : null)}
                                        className="px-2 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                                        title="Event"
                                    >
                                        <option value="">🎪 Tanpa event</option>
                                        {data.events.map((ev) => (
                                            <option key={ev.id} value={ev.id}>
                                                {ev.code}{ev.hasWageOverride ? " 💰" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    );
                })}
            </main>

            {/* Team management modal */}
            {showTeamModal && pinValid && (
                <TeamManagementModal
                    token={token}
                    pin={pin}
                    onClose={() => { setShowTeamModal(false); refetch(); }}
                />
            )}

            {/* Sticky save button */}
            {data && data.workers.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-slate-200 shadow-2xl p-3 z-30">
                    <div className="max-w-2xl mx-auto">
                        <button
                            type="button"
                            onClick={() => submitMut.mutate()}
                            disabled={submitMut.isPending}
                            className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-base sm:text-lg flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {submitMut.isPending ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Menyimpan...
                                </>
                            ) : (
                                <>
                                    <Check className="h-5 w-5" />
                                    💾 Simpan ({filledCount}/{totalCount})
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Team Management Modal ────────────────────────────────────────────────

function TeamManagementModal({
    token,
    pin,
    onClose,
}: {
    token: string;
    pin: string | null;
    onClose: () => void;
}) {
    const { data, isLoading, refetch } = useQuery<PicTeamData>({
        queryKey: ["pic-team", token, pin],
        queryFn: () => getPicTeam(token, pin),
    });

    const addMut = useMutation({
        mutationFn: (workerId: number) => addPicTeamMember(token, workerId, pin),
        onSuccess: () => refetch(),
        onError: (e: any) => alert(`❌ ${e?.response?.data?.message || "Gagal tambah"}`),
    });

    const removeMut = useMutation({
        mutationFn: (workerId: number) => removePicTeamMember(token, workerId, pin),
        onSuccess: () => refetch(),
        onError: (e: any) => alert(`❌ ${e?.response?.data?.message || "Gagal hapus"}`),
    });

    const [search, setSearch] = useState("");
    const filteredAvailable = useMemo(() => {
        const list = data?.available ?? [];
        const q = search.trim().toLowerCase();
        if (!q) return list;
        return list.filter((w) => `${w.name} ${w.position ?? ""}`.toLowerCase().includes(q));
    }, [data, search]);

    return (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-end sm:items-center justify-center p-2 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b-2 border-slate-200 sticky top-0 bg-white">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <UsersIcon className="h-5 w-5 text-blue-600" />
                            Kelola Tim
                        </h2>
                        {data?.team && (
                            <p className="text-xs text-slate-500" style={{ color: data.team.color }}>
                                {data.team.name}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {isLoading && (
                        <div className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin inline text-slate-400" />
                        </div>
                    )}

                    {/* Current members */}
                    {data && (
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">
                                Anggota Tim ({data.members.length})
                            </div>
                            {data.members.length === 0 ? (
                                <div className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-lg text-center">
                                    Belum ada anggota. Tambah dari list bawah.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {data.members.map((m) => (
                                        <div key={m.id} className="flex items-center gap-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0">
                                                {m.photoUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={`${process.env.NEXT_PUBLIC_API_URL ?? ""}${m.photoUrl}`} alt={m.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <UserIcon className="h-5 w-5 text-slate-400" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-sm truncate">{m.name}</div>
                                                {m.position && <div className="text-xs text-slate-500">{m.position}</div>}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Keluarkan ${m.name} dari tim?`)) removeMut.mutate(m.id);
                                                }}
                                                disabled={removeMut.isPending}
                                                className="p-2 rounded-lg text-red-600 hover:bg-red-100"
                                                title="Keluarkan dari tim"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Available workers */}
                    {data && data.available.length > 0 && (
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">
                                Tambah Anggota ({data.available.length} tersedia)
                            </div>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="🔍 Cari nama..."
                                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm mb-2"
                            />
                            <div className="space-y-2">
                                {filteredAvailable.length === 0 ? (
                                    <div className="text-sm text-slate-500 italic p-4 text-center">Tidak ada hasil.</div>
                                ) : filteredAvailable.map((w) => (
                                    <div key={w.id} className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-lg">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                            {w.photoUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={`${process.env.NEXT_PUBLIC_API_URL ?? ""}${w.photoUrl}`} alt={w.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <UserIcon className="h-5 w-5 text-slate-400" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-sm truncate">{w.name}</div>
                                            {w.position && <div className="text-xs text-slate-500">{w.position}</div>}
                                        </div>
                                        <button
                                            onClick={() => addMut.mutate(w.id)}
                                            disabled={addMut.isPending}
                                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            Tambah
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {data && data.available.length === 0 && (
                        <div className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-lg text-center">
                            Semua worker aktif sudah ada di tim. Hubungi admin kalau perlu pindah anggota antar tim.
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-slate-200 bg-slate-50 sticky bottom-0">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-semibold"
                    >
                        Selesai
                    </button>
                </div>
            </div>
        </div>
    );
}
