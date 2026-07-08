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
import { Calendar, Check, CheckCircle2, Clock, Loader2, Lock, Plus, RefreshCw, Search, Settings, Trash2, User as UserIcon, Users as UsersIcon, X } from "lucide-react";

const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string; emoji: string; cls: string; activeCls: string }> = [
    {
        value: "FULL_DAY", label: "HADIR", emoji: "✓",
        cls: "border-success/40 bg-card text-success hover:bg-success/10 transition-colors",
        activeCls: "border-success bg-success text-white ring-4 ring-success/20",
    },
    {
        value: "HALF_DAY", label: "½ HARI", emoji: "½",
        cls: "border-warning/40 bg-card text-warning hover:bg-warning/10 transition-colors",
        activeCls: "border-warning bg-warning text-warning-foreground ring-4 ring-warning/20",
    },
    {
        value: "ABSENT", label: "ABSEN", emoji: "✗",
        cls: "border-destructive/40 bg-card text-destructive hover:bg-destructive/10 transition-colors",
        activeCls: "border-destructive bg-destructive text-white ring-4 ring-destructive/20",
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
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // ─── Token invalid (404 / 403 dari /check) ───────────────
    if (checkError) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-background">
                <div className="max-w-md w-full glass rounded-xl border border-destructive/30 p-6 text-center">
                    <X className="h-12 w-12 mx-auto text-destructive mb-3" />
                    <h1 className="text-xl font-bold text-destructive mb-2">Link Tidak Valid</h1>
                    <p className="text-sm text-muted-foreground">
                        Link absensi PIC ini tidak valid atau sudah dinonaktifkan. Hubungi admin untuk dapat link baru.
                    </p>
                </div>
            </div>
        );
    }

    // ─── PIN Gate ─────────────────────────────────────────────
    if (needsPin && !pin) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-background">
                <div className="max-w-sm w-full glass rounded-xl p-6">
                    <div className="text-center mb-4">
                        <div className="w-16 h-16 mx-auto rounded-full bg-info/15 flex items-center justify-center mb-3">
                            <Lock className="h-8 w-8 text-info" />
                        </div>
                        <h1 className="text-xl font-bold text-foreground">
                            Halo, {tokenCheck?.picName ?? "PIC"}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">Masukkan PIN untuk lanjut</p>
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
                        className="w-full text-center text-3xl font-mono tracking-[0.5em] border-2 border-border rounded-xl py-4 focus:border-primary focus:outline-none bg-card"
                    />
                    {pinError && (
                        <p className="text-sm text-destructive mt-2 text-center">{pinError}</p>
                    )}
                    <button
                        type="button"
                        onClick={submitPin}
                        disabled={!pinInput.trim()}
                        className="w-full mt-4 py-3 rounded-xl bg-primary hover:bg-primary/90 active:bg-primary/80 text-white font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Masuk
                    </button>
                    <p className="text-xs text-center text-muted-foreground mt-3">
                        Kalau lupa PIN, hubungi admin.
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-background">
                <div className="max-w-md w-full glass rounded-xl border border-destructive/30 p-6 text-center">
                    <X className="h-12 w-12 mx-auto text-destructive mb-3" />
                    <h1 className="text-xl font-bold text-destructive mb-2">Link Tidak Valid</h1>
                    <p className="text-sm text-muted-foreground">
                        Link absensi PIC ini tidak valid atau sudah dinonaktifkan. Hubungi admin untuk dapat link baru.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-24">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-card border-b border-border shadow-sm">
                <div className="max-w-2xl mx-auto px-4 py-4">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <div className="text-base sm:text-lg font-bold text-foreground truncate">
                                Selamat datang, {data?.pic.name ?? "..."}
                            </div>
                            <div className="text-xs text-muted-foreground">{data?.pic.position ?? "PIC"}</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                onClick={() => setShowTeamModal(true)}
                                className="p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                                title="Kelola Tim"
                            >
                                <UsersIcon className="h-4 w-4" />
                            </button>
                            {needsPin && (
                                <button
                                    onClick={clearPin}
                                    className="p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                                    title="Kunci & input PIN ulang"
                                >
                                    <Lock className="h-4 w-4" />
                                </button>
                            )}
                            <button
                                onClick={() => refetch()}
                                disabled={isFetching}
                                className="p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                                title="Refresh"
                            >
                                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                            </button>
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="flex-1 px-3 py-2 border-2 border-border rounded-lg text-base font-medium bg-card"
                        />
                    </div>
                    {data?.team && (
                        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
                            <UsersIcon className="h-3.5 w-3.5" />
                            Tim: <span className="font-semibold" style={{ color: data.team.color }}>{data.team.name}</span>
                            <span className="text-muted-foreground/60">· {data.workers.length} member</span>
                        </div>
                    )}
                    {savedAt && (
                        <div className="mt-2 text-xs text-success flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Tersimpan terakhir: {savedAt}
                        </div>
                    )}
                </div>
            </header>

            {/* Bulk apply panel */}
            {data && (data.cities.length > 0 || data.divisions.length > 0 || data.events.length > 0) && (
                <div className="max-w-2xl mx-auto px-4 pt-3">
                    <div className="bg-info/10 border border-info/30 rounded-xl p-3">
                        <div className="text-xs font-bold text-info mb-2 flex items-center gap-1.5">
                            <Settings className="h-3.5 w-3.5" />
                            Set untuk Semua Worker
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <select
                                value={bulkCity}
                                onChange={(e) => setBulkCity(e.target.value)}
                                className="px-2 py-1.5 text-sm border border-info/40 rounded-lg bg-card"
                            >
                                <option value="">Kota...</option>
                                {data.cities.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select
                                value={bulkDivision}
                                onChange={(e) => setBulkDivision(e.target.value)}
                                className="px-2 py-1.5 text-sm border border-info/40 rounded-lg bg-card"
                            >
                                <option value="">Divisi...</option>
                                {data.divisions.map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <select
                                value={bulkEventId}
                                onChange={(e) => setBulkEventId(e.target.value)}
                                className="px-2 py-1.5 text-sm border border-info/40 rounded-lg bg-card"
                            >
                                <option value="">Event...</option>
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
                            className="mt-2 w-full sm:w-auto px-3 py-1.5 rounded-lg bg-info hover:bg-info/90 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                        >
                            Apply ke Semua
                        </button>
                    </div>
                </div>
            )}

            {/* Worker list */}
            <main className="max-w-2xl mx-auto px-4 py-4 space-y-3">
                {isLoading && (
                    <div className="p-6 text-center text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin inline" />
                        <div className="mt-2 text-sm">Memuat data...</div>
                    </div>
                )}
                {!isLoading && data && data.workers.length === 0 && (
                    <div className="bg-warning/10 border border-warning/30 rounded-xl p-6 text-center">
                        <UsersIcon className="h-12 w-12 mx-auto text-warning mb-2" />
                        <h3 className="font-bold text-warning mb-1">Tim Anda Masih Kosong</h3>
                        <p className="text-sm text-warning/80 mb-3">
                            Tambahkan crew yang Anda handle. Klik tombol di bawah untuk pilih.
                        </p>
                        <button
                            onClick={() => setShowTeamModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-warning hover:bg-warning/90 text-warning-foreground font-semibold transition-colors"
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
                        <div key={w.id} className="glass rounded-xl p-4 animate-in">
                            {/* Worker info */}
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                                    {w.photoUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={`${process.env.NEXT_PUBLIC_API_URL ?? ""}${w.photoUrl}`} alt={w.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <UserIcon className="h-6 w-6 text-muted-foreground" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold text-base text-foreground truncate">{w.name}</div>
                                    {w.position && <div className="text-xs text-muted-foreground">{w.position}</div>}
                                </div>
                                {!w.hasPayroll && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-warning/15 text-warning font-semibold">
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
                                <div className="flex items-center gap-1.5 text-sm text-foreground font-medium">
                                    <Clock className="h-4 w-4" />
                                    Lembur:
                                </div>
                                <select
                                    value={r.overtimeHours}
                                    onChange={(e) => setOvertime(w.id, Number(e.target.value))}
                                    className="px-2 py-1.5 border border-border rounded-lg text-sm nums bg-card"
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
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${r.overtimeHours === h ? "bg-info text-white border-info" : "bg-card text-info border-info/40 hover:bg-info/10"}`}
                                        >
                                            +{h}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Wage context — kota + divisi + event (per worker) */}
                            {(data.cities.length > 0 || data.divisions.length > 0 || data.events.length > 0) && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border">
                                    <select
                                        value={r.cityKey ?? ""}
                                        onChange={(e) => setRowField(w.id, "cityKey", e.target.value || null)}
                                        className="px-2 py-1.5 text-xs border border-border rounded-md bg-card"
                                        title="Kota"
                                    >
                                        <option value="">Kota — default</option>
                                        {data.cities.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <select
                                        value={r.divisionKey ?? ""}
                                        onChange={(e) => setRowField(w.id, "divisionKey", e.target.value || null)}
                                        className="px-2 py-1.5 text-xs border border-border rounded-md bg-card"
                                        title="Divisi"
                                    >
                                        <option value="">Divisi — default</option>
                                        {data.divisions.map((d) => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <select
                                        value={r.eventId ?? ""}
                                        onChange={(e) => setRowField(w.id, "eventId", e.target.value ? Number(e.target.value) : null)}
                                        className="px-2 py-1.5 text-xs border border-border rounded-md bg-card"
                                        title="Event"
                                    >
                                        <option value="">Tanpa event</option>
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
                <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-2xl p-3 z-30">
                    <div className="max-w-2xl mx-auto">
                        <button
                            type="button"
                            onClick={() => submitMut.mutate()}
                            disabled={submitMut.isPending}
                            className="w-full py-4 rounded-xl bg-success hover:bg-success/90 active:bg-success/80 text-white font-bold text-base sm:text-lg flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        >
                            {submitMut.isPending ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Menyimpan...
                                </>
                            ) : (
                                <>
                                    <Check className="h-5 w-5" />
                                    <span>Simpan <span className="nums">({filledCount}/{totalCount})</span></span>
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
            <div className="bg-card rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
                    <div>
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <UsersIcon className="h-5 w-5 text-primary" />
                            Kelola Tim
                        </h2>
                        {data?.team && (
                            <p className="text-xs text-muted-foreground" style={{ color: data.team.color }}>
                                {data.team.name}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {isLoading && (
                        <div className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin inline text-muted-foreground" />
                        </div>
                    )}

                    {/* Current members */}
                    {data && (
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                                Anggota Tim <span className="nums">({data.members.length})</span>
                            </div>
                            {data.members.length === 0 ? (
                                <div className="text-sm text-muted-foreground italic p-4 bg-muted rounded-lg text-center">
                                    Belum ada anggota. Tambah dari list bawah.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {data.members.map((m) => (
                                        <div key={m.id} className="flex items-center gap-3 p-2 bg-info/10 border border-info/30 rounded-lg">
                                            <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center overflow-hidden shrink-0">
                                                {m.photoUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={`${process.env.NEXT_PUBLIC_API_URL ?? ""}${m.photoUrl}`} alt={m.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <UserIcon className="h-5 w-5 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-sm truncate">{m.name}</div>
                                                {m.position && <div className="text-xs text-muted-foreground">{m.position}</div>}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Keluarkan ${m.name} dari tim?`)) removeMut.mutate(m.id);
                                                }}
                                                disabled={removeMut.isPending}
                                                className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
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
                            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                                Tambah Anggota <span className="nums">({data.available.length} tersedia)</span>
                            </div>
                            <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari nama..."
                                    className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card"
                                />
                            </div>
                            <div className="space-y-2">
                                {filteredAvailable.length === 0 ? (
                                    <div className="text-sm text-muted-foreground italic p-4 text-center">Tidak ada hasil.</div>
                                ) : filteredAvailable.map((w) => (
                                    <div key={w.id} className="flex items-center gap-3 p-2 bg-card border border-border rounded-lg">
                                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                                            {w.photoUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={`${process.env.NEXT_PUBLIC_API_URL ?? ""}${w.photoUrl}`} alt={w.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <UserIcon className="h-5 w-5 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-sm truncate">{w.name}</div>
                                            {w.position && <div className="text-xs text-muted-foreground">{w.position}</div>}
                                        </div>
                                        <button
                                            onClick={() => addMut.mutate(w.id)}
                                            disabled={addMut.isPending}
                                            className="px-3 py-1.5 rounded-lg bg-success hover:bg-success/90 text-white text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1 transition-colors"
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
                        <div className="text-sm text-muted-foreground italic p-4 bg-muted rounded-lg text-center">
                            Semua worker aktif sudah ada di tim. Hubungi admin kalau perlu pindah anggota antar tim.
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-border bg-muted sticky bottom-0">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 rounded-lg bg-foreground/90 hover:bg-foreground text-background font-semibold transition-colors"
                    >
                        Selesai
                    </button>
                </div>
            </div>
        </div>
    );
}
