"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import "dayjs/locale/id";
import {
    getWeeklySummary, getMonthlySummary, bulkUpsertAttendance,
    exportWeeklyXlsx, exportMonthlyXlsx, exportPayslipPdf,
    approveAttendance, rejectAttendance, bulkApproveAttendance,
    getAttendanceAuditLog,
    listAdjustments, createAdjustment, updateAdjustment, deleteAdjustment,
    getWeeklyInputContext, saveWeekAttendance,
    type AttendanceStatus, type AttendanceApprovalStatus, type WeeklySummary, type MonthlySummary,
    type PayrollAdjustment, type PayrollAdjustmentType, type AdjustmentInput, type AuditLogEntry,
    type WeeklyInputContext, type AttendanceWeekRowInput,
} from "@/lib/api/payroll";
import { getWorkers, type Worker } from "@/lib/api/workers";
import { getEvents } from "@/lib/api/events";
import { listCrewByEvent } from "@/lib/api/event-crew";
import {
    Calendar, Check, CheckCheck, ChevronLeft, ChevronRight, ClipboardList, Download, FileText, History,
    Loader2, Plus, Trash2, Wallet, X,
} from "lucide-react";

dayjs.extend(isoWeek);
dayjs.locale("id");

type Tab = "input-mingguan" | "weekly" | "monthly" | "manual" | "adjustments";

/** Awal minggu gajian = MINGGU (Sun). dayjs.day(0) = Minggu pada minggu berjalan. */
function startOfPayWeek(d?: string | dayjs.Dayjs): string {
    return dayjs(d).day(0).format("YYYY-MM-DD");
}

const STATUS_LABEL: Record<AttendanceStatus, { emoji: string; label: string; cls: string }> = {
    FULL_DAY: { emoji: "✓", label: "Hadir", cls: "bg-emerald-100 text-emerald-700 border-emerald-300" },
    HALF_DAY: { emoji: "½", label: "½ hari", cls: "bg-amber-100 text-amber-700 border-amber-300" },
    ABSENT: { emoji: "✗", label: "Absen", cls: "bg-red-100 text-red-700 border-red-300" },
};

const APPROVAL_LABEL: Record<AttendanceApprovalStatus, { label: string; cls: string }> = {
    PENDING: { label: "Pending", cls: "bg-amber-100 text-amber-800 border-amber-300" },
    APPROVED: { label: "Approved", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    REJECTED: { label: "Rejected", cls: "bg-red-100 text-red-800 border-red-300" },
};

const ADJ_TYPE_LABEL: Record<PayrollAdjustmentType, { emoji: string; label: string; cls: string; sign: 1 | -1 }> = {
    BONUS: { emoji: "🎁", label: "Bonus", cls: "bg-emerald-100 text-emerald-700", sign: 1 },
    ALLOWANCE: { emoji: "🍱", label: "Tunjangan", cls: "bg-blue-100 text-blue-700", sign: 1 },
    DEDUCTION: { emoji: "⚠️", label: "Potongan", cls: "bg-red-100 text-red-700", sign: -1 },
    ADVANCE: { emoji: "💸", label: "Kasbon", cls: "bg-purple-100 text-purple-700", sign: -1 },
};

function formatRp(n: number): string {
    return n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function PayrollPage() {
    const [tab, setTab] = useState<Tab>("input-mingguan");

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                    <Wallet className="h-6 w-6 text-emerald-600" />
                    Payroll & Absensi
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                    Rekap gaji harian + lembur + tunjangan/potongan. Approve PIC submission sebelum payroll cair.
                </p>
            </div>

            <div className="flex border-b border-border overflow-x-auto">
                {([
                    { key: "input-mingguan", label: "🗓️ Input Mingguan" },
                    { key: "weekly", label: "📅 Rekap Mingguan" },
                    { key: "monthly", label: "🗓️ Bulanan" },
                    { key: "manual", label: "✏️ Input Harian" },
                    { key: "adjustments", label: "💰 Tunjangan/Potongan" },
                ] as const).map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === "input-mingguan" && <InputMingguanTab />}
            {tab === "weekly" && <WeeklyTab />}
            {tab === "monthly" && <MonthlyTab />}
            {tab === "manual" && <ManualEntryTab />}
            {tab === "adjustments" && <AdjustmentsTab />}
        </div>
    );
}

// ─── Input Mingguan Tab (admin isi absensi 1 minggu sekaligus) ─────────────

type GridCell = { status: AttendanceStatus | null; overtime: number; city: string | null; division: string | null; eventId: number | null };
type GridRow = { city: string | null; division: string | null; eventId: number | null; days: Record<string, GridCell> };

const KEEP = "__keep__"; // sentinel: pada bulk apply = "biarkan, jangan ubah"

const STATUS_CYCLE: (AttendanceStatus | null)[] = [null, "FULL_DAY", "HALF_DAY", "ABSENT"];
function cycleStatus(s: AttendanceStatus | null): AttendanceStatus | null {
    return STATUS_CYCLE[(STATUS_CYCLE.indexOf(s) + 1) % STATUS_CYCLE.length];
}

function InputMingguanTab() {
    const qc = useQueryClient();
    const [weekStart, setWeekStart] = useState<string>(startOfPayWeek());
    const [teamId, setTeamId] = useState<number | null>(null);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const [grid, setGrid] = useState<Map<number, GridRow>>(new Map());
    // Seleksi banyak pekerja untuk aksi bulk
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [bulkEvent, setBulkEvent] = useState<string>(KEEP);
    const [bulkCity, setBulkCity] = useState<string>(KEEP);
    const [bulkDivision, setBulkDivision] = useState<string>(KEEP);

    const { data, isLoading } = useQuery<WeeklyInputContext>({
        queryKey: ["weekly-input", weekStart, teamId],
        queryFn: () => getWeeklyInputContext(weekStart, teamId ?? undefined),
        // Jangan refetch saat window focus — supaya input admin yang belum disimpan tidak ke-reset.
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000,
    });

    // Bangun ulang grid tiap kali data dari server berubah (ganti minggu/tim/refetch setelah simpan)
    useEffect(() => {
        if (!data) return;
        const next = new Map<number, GridRow>();
        for (const w of data.workers) {
            const days: Record<string, GridCell> = {};
            let rowEventId: number | null = null;
            for (const d of data.days) {
                const c = w.cells[d];
                days[d] = c
                    ? { status: c.status, overtime: c.overtimeHours, city: c.cityKey ?? w.defaultCityKey, division: c.divisionKey ?? w.defaultDivisionKey, eventId: c.eventId }
                    : { status: null, overtime: 0, city: w.defaultCityKey, division: w.defaultDivisionKey, eventId: null };
                if (c?.eventId != null && rowEventId == null) rowEventId = c.eventId;
            }
            next.set(w.id, { city: w.defaultCityKey, division: w.defaultDivisionKey, eventId: rowEventId, days });
        }
        setGrid(next);
        setSelected(new Set());
    }, [data]);

    const rateMap = useMemo(() => {
        const m = new Map<string, { daily: number; ot: number }>();
        for (const r of data?.rates ?? []) m.set(`${r.city.toLowerCase()}|${r.division.toLowerCase()}`, { daily: r.dailyWageRate, ot: r.overtimeRatePerHour });
        return m;
    }, [data]);

    const eventMap = useMemo(() => {
        const m = new Map<number, WeeklyInputContext["events"][number]>();
        for (const e of data?.events ?? []) m.set(e.id, e);
        return m;
    }, [data]);

    // Prioritas estimasi (selaras backend): override event > matriks kota×divisi > default worker.
    function resolveRate(w: WeeklyInputContext["workers"][number], city: string | null, division: string | null, eventId: number | null) {
        if (eventId != null) {
            const ev = eventMap.get(eventId);
            if (ev && ev.dailyWageRate != null) return { daily: ev.dailyWageRate, ot: ev.overtimeRatePerHour ?? 0 };
        }
        if (city && division) {
            const r = rateMap.get(`${city.toLowerCase()}|${division.toLowerCase()}`);
            if (r) return r;
        }
        return { daily: w.dailyWageRate, ot: w.overtimeRatePerHour };
    }

    function workerEstimate(w: WeeklyInputContext["workers"][number]): number {
        const row = grid.get(w.id);
        if (!row) return 0;
        let total = 0;
        for (const c of Object.values(row.days)) {
            if (!c.status) continue;
            const { daily, ot } = resolveRate(w, c.city, c.division, c.eventId);
            const base = c.status === "FULL_DAY" ? daily : c.status === "HALF_DAY" ? daily * 0.5 : 0;
            total += base + c.overtime * ot;
        }
        return total;
    }

    function setCell(workerId: number, date: string, patch: Partial<GridCell>) {
        setGrid((prev) => {
            const next = new Map(prev);
            const row = next.get(workerId);
            if (!row) return prev;
            next.set(workerId, { ...row, days: { ...row.days, [date]: { ...row.days[date], ...patch } } });
            return next;
        });
    }

    // Terapkan event/kota/divisi ke beberapa pekerja sekaligus → ke semua hari (override per-sel ikut di-set).
    function applyContext(workerIds: number[], patch: { eventId?: number | null; city?: string | null; division?: string | null }) {
        setGrid((prev) => {
            const next = new Map(prev);
            for (const id of workerIds) {
                const row = next.get(id);
                if (!row) continue;
                const eventId = patch.eventId !== undefined ? patch.eventId : row.eventId;
                const city = patch.city !== undefined ? patch.city : row.city;
                const division = patch.division !== undefined ? patch.division : row.division;
                const days: Record<string, GridCell> = {};
                for (const [k, c] of Object.entries(row.days)) days[k] = { ...c, eventId, city, division };
                next.set(id, { eventId, city, division, days });
            }
            return next;
        });
    }

    // Bulk: terapkan pilihan toolbar ke semua pekerja terpilih (hanya field yang bukan KEEP).
    function applyBulk() {
        if (selected.size === 0) { alert("Centang dulu pekerja yang mau di-set."); return; }
        const patch: { eventId?: number | null; city?: string | null; division?: string | null } = {};
        if (bulkEvent !== KEEP) patch.eventId = bulkEvent === "" ? null : Number(bulkEvent);
        if (bulkCity !== KEEP) patch.city = bulkCity || null;
        if (bulkDivision !== KEEP) patch.division = bulkDivision || null;
        if (Object.keys(patch).length === 0) { alert("Pilih minimal satu: Event / Kota / Divisi."); return; }
        applyContext([...selected], patch);
    }

    function toggleSelect(id: number) {
        setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    }
    function toggleSelectAll() {
        const ids = (data?.workers ?? []).map((w) => w.id);
        setSelected((prev) => (prev.size === ids.length ? new Set() : new Set(ids)));
    }

    function fillRow(workerId: number, status: AttendanceStatus | null) {
        setGrid((prev) => {
            const next = new Map(prev);
            const row = next.get(workerId);
            if (!row) return prev;
            const days: Record<string, GridCell> = {};
            for (const [k, c] of Object.entries(row.days)) days[k] = { ...c, status };
            next.set(workerId, { ...row, days });
            return next;
        });
    }

    const saveMut = useMutation({
        mutationFn: () => {
            const rows: AttendanceWeekRowInput[] = [];
            for (const w of data!.workers) {
                const row = grid.get(w.id);
                if (!row) continue;
                for (const d of data!.days) {
                    const c = row.days[d];
                    const existed = !!w.cells[d];
                    if (!c.status) {
                        if (existed) rows.push({ workerId: w.id, date: d, status: null }); // kosongkan
                        continue;
                    }
                    rows.push({
                        workerId: w.id, date: d, status: c.status,
                        overtimeHours: c.overtime,
                        eventId: c.eventId ?? row.eventId ?? null,
                        cityKey: c.city ?? row.city ?? null,
                        divisionKey: c.division ?? row.division ?? null,
                    });
                }
            }
            if (rows.length === 0) throw new Error("Belum ada absensi untuk disimpan.");
            return saveWeekAttendance(rows);
        },
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ["weekly-input"] });
            qc.invalidateQueries({ queryKey: ["payroll-weekly"] });
            qc.invalidateQueries({ queryKey: ["payroll-monthly"] });
            alert(`✅ Tersimpan: ${res.upserted} entri${res.deleted ? `, ${res.deleted} dikosongkan` : ""}.`);
        },
        onError: (e: any) => alert(`❌ ${e?.response?.data?.message || e?.message}`),
    });

    const goPrev = () => setWeekStart(startOfPayWeek(dayjs(weekStart).subtract(1, "week")));
    const goNext = () => setWeekStart(startOfPayWeek(dayjs(weekStart).add(1, "week")));
    const goToday = () => setWeekStart(startOfPayWeek());

    const grandEstimate = (data?.workers ?? []).reduce((s, w) => s + workerEstimate(w), 0);
    const noMatrix = (data?.rates.length ?? 0) === 0;

    return (
        <div className="space-y-3">
            {/* Kontrol minggu + tim */}
            <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-3 flex-wrap">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <button onClick={goPrev} className="p-1.5 rounded hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
                <span className="text-sm font-semibold min-w-[170px] text-center">
                    {dayjs(weekStart).format("DD MMM")} – {dayjs(weekStart).add(6, "day").format("DD MMM YYYY")}
                </span>
                <button onClick={goNext} className="p-1.5 rounded hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
                <button onClick={goToday} className="px-2 py-1 text-xs rounded border hover:bg-muted">Minggu ini</button>

                <span className="text-sm font-medium ml-2">Tim:</span>
                <select
                    value={teamId ?? ""}
                    onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : null)}
                    className="px-3 py-1.5 border rounded bg-white text-sm"
                >
                    <option value="">— Semua pekerja —</option>
                    {(data?.teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>

            <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                <span>Klik sel: kosong → ✓ Hadir → ½ → ✗ Absen → kosong.</span>
                <span>Tarif otomatis dari <b>Event</b> (kalau dipilih) lalu <b>Kota × Divisi</b>; ubah per hari lewat tombol ⚙.</span>
            </div>

            {/* Toolbar BULK: set Event + Kota + Divisi utk banyak pekerja sekaligus */}
            <div className="flex items-center gap-2 bg-blue-50/60 border border-blue-200 rounded-lg p-2.5 flex-wrap text-sm">
                <span className="font-medium text-blue-900 whitespace-nowrap">⚡ Bulk ({selected.size} dipilih):</span>
                <select value={bulkEvent} onChange={(e) => setBulkEvent(e.target.value)} className="px-2 py-1 border rounded bg-white text-xs max-w-[220px]" title="Event">
                    <option value={KEEP}>Event — biarkan —</option>
                    <option value="">(tanpa event)</option>
                    {(data?.events ?? []).map((ev) => <option key={ev.id} value={ev.id}>{ev.name}{ev.code ? ` (${ev.code})` : ""}</option>)}
                </select>
                <select value={bulkCity} onChange={(e) => setBulkCity(e.target.value)} className="px-2 py-1 border rounded bg-white text-xs" title="Kota">
                    <option value={KEEP}>Kota — biarkan —</option>
                    <option value="">(kosongkan)</option>
                    {(data?.cities ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={bulkDivision} onChange={(e) => setBulkDivision(e.target.value)} className="px-2 py-1 border rounded bg-white text-xs" title="Divisi">
                    <option value={KEEP}>Divisi — biarkan —</option>
                    <option value="">(kosongkan)</option>
                    {(data?.divisions ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={applyBulk} disabled={selected.size === 0}
                    className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50">
                    Terapkan ke {selected.size} pekerja
                </button>
                {selected.size > 0 && <button onClick={() => setSelected(new Set())} className="text-xs text-blue-700 underline">batal pilih</button>}
            </div>

            {noMatrix && (
                <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
                    ⚠️ Tabel tarif (Kota × Divisi) masih kosong. Isi dulu di <b>Pengaturan → Tarif Gaji (WageRate)</b> agar gaji otomatis terhitung. Sementara ini tarif memakai default per pekerja.
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground p-6"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div>
            ) : (data?.workers.length ?? 0) === 0 ? (
                <div className="text-sm text-muted-foreground bg-muted/30 border rounded p-4">
                    Tidak ada pekerja {teamId ? "di tim ini" : "aktif"}. {teamId ? "Pilih tim lain atau " : ""}tambah pekerja di menu Pekerja.
                </div>
            ) : (
                <div className="overflow-x-auto border rounded-lg">
                    <table className="text-sm border-collapse">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="p-2 w-8 text-center">
                                    <input
                                        type="checkbox"
                                        checked={(data?.workers.length ?? 0) > 0 && selected.size === (data?.workers.length ?? 0)}
                                        onChange={toggleSelectAll}
                                        title="Pilih semua"
                                    />
                                </th>
                                <th className="text-left p-2 min-w-[150px]">Pekerja</th>
                                <th className="p-2 text-left min-w-[110px]">Kota</th>
                                <th className="p-2 text-left min-w-[110px]">Divisi</th>
                                {(data?.days ?? []).map((d) => (
                                    <th key={d} className="p-1 text-center min-w-[44px]">
                                        <div className="text-[10px] capitalize">{dayjs(d).format("ddd")}</div>
                                        <div className="text-[10px] text-muted-foreground">{dayjs(d).format("DD/MM")}</div>
                                    </th>
                                ))}
                                <th className="p-2 text-right min-w-[100px]">Estimasi</th>
                                <th className="p-1 w-8"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data?.workers ?? []).map((w) => {
                                const row = grid.get(w.id);
                                if (!row) return null;
                                const isOpen = expanded.has(w.id);
                                return (
                                    <FragmentRow key={w.id}>
                                        <tr className={`border-t hover:bg-muted/20 ${selected.has(w.id) ? "bg-blue-50/40" : ""}`}>
                                            <td className="p-2 text-center align-top">
                                                <input type="checkbox" checked={selected.has(w.id)} onChange={() => toggleSelect(w.id)} />
                                            </td>
                                            <td className="p-2 align-top">
                                                <div className="font-medium leading-tight">{w.name}</div>
                                                {row.eventId != null && (
                                                    <div className="text-[10px] text-blue-700 font-medium truncate max-w-[140px]" title={eventMap.get(row.eventId)?.name ?? ""}>
                                                        🎪 {eventMap.get(row.eventId)?.code ?? eventMap.get(row.eventId)?.name ?? `#${row.eventId}`}
                                                    </div>
                                                )}
                                                <div className="flex gap-1 mt-0.5">
                                                    <button onClick={() => fillRow(w.id, "FULL_DAY")} title="Isi semua Hadir" className="text-[10px] px-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">✓×7</button>
                                                    <button onClick={() => fillRow(w.id, null)} title="Kosongkan semua" className="text-[10px] px-1 rounded bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100">bersihkan</button>
                                                </div>
                                            </td>
                                            <td className="p-1 align-top">
                                                <select value={row.city ?? ""} onChange={(e) => applyContext([w.id], { city: e.target.value || null })} className="w-full text-xs border rounded px-1 py-1 bg-white">
                                                    <option value="">(default pekerja)</option>
                                                    {(data?.cities ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </td>
                                            <td className="p-1 align-top">
                                                <select value={row.division ?? ""} onChange={(e) => applyContext([w.id], { division: e.target.value || null })} className="w-full text-xs border rounded px-1 py-1 bg-white">
                                                    <option value="">(default pekerja)</option>
                                                    {(data?.divisions ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </td>
                                            {(data?.days ?? []).map((d) => {
                                                const cell = row.days[d];
                                                return (
                                                    <td key={d} className="p-1 text-center align-top">
                                                        <button
                                                            onClick={() => setCell(w.id, d, { status: cycleStatus(cell.status) })}
                                                            className={`w-9 h-8 rounded border text-sm font-bold ${cell.status ? STATUS_LABEL[cell.status].cls : "bg-slate-50 text-slate-300 border-slate-200"}`}
                                                        >
                                                            {cell.status ? STATUS_LABEL[cell.status].emoji : "·"}
                                                        </button>
                                                        {cell.status && (
                                                            <input
                                                                type="number" min={0} max={12} step={0.5} value={cell.overtime}
                                                                onChange={(e) => setCell(w.id, d, { overtime: Math.max(0, Math.min(12, Number(e.target.value) || 0)) })}
                                                                title="Jam lembur"
                                                                className="mt-1 w-9 px-1 py-0.5 border rounded text-[10px] font-mono text-center"
                                                            />
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="p-2 text-right font-semibold tabular-nums">
                                                {formatRp(workerEstimate(w))}
                                            </td>
                                            <td className="p-1 text-center">
                                                <button
                                                    onClick={() => setExpanded((prev) => { const n = new Set(prev); n.has(w.id) ? n.delete(w.id) : n.add(w.id); return n; })}
                                                    title="Rincian Kota/Divisi per hari"
                                                    className={`text-xs px-1.5 py-1 rounded border ${isOpen ? "bg-amber-100 border-amber-300" : "hover:bg-muted"}`}
                                                >⚙</button>
                                            </td>
                                        </tr>
                                        {isOpen && (
                                            <tr className="bg-amber-50/40 border-t border-amber-200">
                                                <td colSpan={4} className="p-2 text-[10px] text-amber-800 align-top">
                                                    Override Event/Kota/Divisi per hari (untuk hari kerja di event/kota berbeda):
                                                </td>
                                                {(data?.days ?? []).map((d) => {
                                                    const cell = row.days[d];
                                                    return (
                                                        <td key={d} className="p-1 align-top">
                                                            <select value={cell.eventId ?? ""} onChange={(e) => setCell(w.id, d, { eventId: e.target.value ? Number(e.target.value) : null })} className="w-[44px] text-[9px] border rounded mb-1 bg-white" title="Event">
                                                                <option value="">event</option>
                                                                {(data?.events ?? []).map((ev) => <option key={ev.id} value={ev.id}>{ev.code || ev.name}</option>)}
                                                            </select>
                                                            <select value={cell.city ?? ""} onChange={(e) => setCell(w.id, d, { city: e.target.value || null })} className="w-[44px] text-[9px] border rounded mb-1 bg-white" title="Kota">
                                                                <option value="">kota</option>
                                                                {(data?.cities ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                                                            </select>
                                                            <select value={cell.division ?? ""} onChange={(e) => setCell(w.id, d, { division: e.target.value || null })} className="w-[44px] text-[9px] border rounded bg-white" title="Divisi">
                                                                <option value="">div</option>
                                                                {(data?.divisions ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                                                            </select>
                                                        </td>
                                                    );
                                                })}
                                                <td colSpan={2}></td>
                                            </tr>
                                        )}
                                    </FragmentRow>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="flex items-center justify-between gap-3 flex-wrap sticky bottom-0 bg-background/95 py-2 border-t">
                <div className="text-sm">
                    Estimasi total minggu ini: <b className="text-emerald-700">Rp {formatRp(grandEstimate)}</b>
                </div>
                <button
                    onClick={() => saveMut.mutate()}
                    disabled={saveMut.isPending || (data?.workers.length ?? 0) === 0}
                    className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 inline-flex items-center gap-2"
                >
                    {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    💾 Simpan minggu ini (auto-approve)
                </button>
            </div>
        </div>
    );
}

/** Helper agar bisa render 2 <tr> (baris utama + detail) tanpa wrapper DOM ilegal di <tbody>. */
function FragmentRow({ children }: { children: ReactNode }) {
    return <>{children}</>;
}

// ─── Weekly Tab ──────────────────────────────────────────────────────────

function WeeklyTab() {
    const qc = useQueryClient();
    const [weekStart, setWeekStart] = useState<string>(startOfPayWeek());
    const [exporting, setExporting] = useState(false);
    const [auditCellId, setAuditCellId] = useState<number | null>(null);

    const { data, isLoading } = useQuery<WeeklySummary>({
        queryKey: ["payroll-weekly", weekStart],
        queryFn: () => getWeeklySummary(weekStart),
    });

    const approveMut = useMutation({
        mutationFn: (id: number) => approveAttendance(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-weekly"] }),
        onError: (e: any) => alert(`❌ ${e?.response?.data?.message || e?.message}`),
    });
    const rejectMut = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason: string }) => rejectAttendance(id, reason),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-weekly"] }),
    });
    const bulkApproveMut = useMutation({
        mutationFn: bulkApproveAttendance,
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ["payroll-weekly"] });
            alert(`✅ ${res.approved} attendance ter-approve.`);
        },
    });

    const goPrev = () => setWeekStart(dayjs(weekStart).subtract(1, "week").format("YYYY-MM-DD"));
    const goNext = () => setWeekStart(dayjs(weekStart).add(1, "week").format("YYYY-MM-DD"));
    const goToday = () => setWeekStart(startOfPayWeek());

    async function handleExport() {
        setExporting(true);
        try {
            const blob = await exportWeeklyXlsx(weekStart);
            downloadBlob(blob, `payroll-mingguan-${weekStart}.xlsx`);
        } catch (e: any) {
            alert(`Gagal export: ${e?.response?.data?.message || e?.message || "Unknown"}`);
        } finally { setExporting(false); }
    }

    function handleBulkApproveAll() {
        const pendingIds: number[] = [];
        for (const r of data?.rows ?? []) {
            for (const c of r.cells) if (c.id && c.approvalStatus === "PENDING") pendingIds.push(c.id);
        }
        if (pendingIds.length === 0) { alert("Tidak ada PENDING."); return; }
        if (!confirm(`Approve ${pendingIds.length} attendance PENDING di minggu ini?`)) return;
        bulkApproveMut.mutate(pendingIds);
    }

    function handleReject(id: number) {
        const reason = prompt("Alasan reject (opsional):");
        if (reason === null) return;
        rejectMut.mutate({ id, reason });
    }

    const dayLabels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap bg-muted/30 rounded-lg p-2">
                <button onClick={goPrev} className="p-2 rounded hover:bg-background border"><ChevronLeft className="h-4 w-4" /></button>
                <div className="flex-1 text-center text-sm font-medium">
                    <Calendar className="h-4 w-4 inline mr-1.5 text-muted-foreground" />
                    {data ? `${dayjs(data.weekStart).format("DD MMM")} – ${dayjs(data.weekEnd).format("DD MMM YYYY")}` : "—"}
                </div>
                <button onClick={goNext} className="p-2 rounded hover:bg-background border"><ChevronRight className="h-4 w-4" /></button>
                <button onClick={goToday} className="px-3 py-1.5 text-xs border rounded hover:bg-background">Hari ini</button>
                {data && data.pendingCount > 0 && (
                    <button
                        onClick={handleBulkApproveAll}
                        disabled={bulkApproveMut.isPending}
                        className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium disabled:opacity-50"
                    >
                        {bulkApproveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                        Approve Semua ({data.pendingCount})
                    </button>
                )}
                <button
                    onClick={handleExport}
                    disabled={exporting || !data}
                    className={`${data && data.pendingCount > 0 ? "" : "ml-auto"} inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded font-medium disabled:opacity-50`}
                >
                    {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Export Excel
                </button>
            </div>

            {isLoading && <div className="text-center p-8 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin inline" /></div>}

            {data && (
                <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <SummaryCard label="Total Attendance" value={`Rp ${formatRp(data.grandTotal)}`} hint="Termasuk pending" />
                        <SummaryCard label="Approved" value={`Rp ${formatRp(data.grandApproved)}`} hint={`${data.pendingCount} pending`} color="emerald" />
                        <SummaryCard label="Adjustments" value={`Rp ${formatRp(data.grandAdjustment)}`} hint="Bonus + Tunjangan − Potongan/Kasbon" color={data.grandAdjustment >= 0 ? "blue" : "red"} />
                        <SummaryCard label="Final Cair" value={`Rp ${formatRp(data.grandFinal)}`} hint="Approved + Adjustment net" color="navy" />
                    </div>

                    <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="text-left p-2 sticky left-0 bg-muted/50">Pekerja</th>
                                    {dayLabels.map((d, i) => (
                                        <th key={i} className="p-2 text-center min-w-[68px]">
                                            <div>{d}</div>
                                            <div className="text-[10px] font-normal text-muted-foreground">{dayjs(data.days[i]).format("DD")}</div>
                                        </th>
                                    ))}
                                    <th className="p-2 text-right whitespace-nowrap">Approved</th>
                                    <th className="p-2 text-right whitespace-nowrap">Adj</th>
                                    <th className="p-2 text-right whitespace-nowrap">Final</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.rows.map((row) => (
                                    <tr key={row.workerId} className="border-t hover:bg-muted/20">
                                        <td className="p-2 sticky left-0 bg-background min-w-[160px]">
                                            <div className="font-medium">{row.name}</div>
                                            <div className="text-[10px] text-muted-foreground">
                                                {row.hasPayroll ? `Rp ${formatRp(row.dailyWageRate)}/hari` : <span className="text-amber-600">Gaji belum diset</span>}
                                            </div>
                                        </td>
                                        {row.cells.map((cell, i) => (
                                            <td key={i} className="p-1 text-center">
                                                {cell.status ? (
                                                    <AttendanceCell
                                                        cell={cell}
                                                        onApprove={() => cell.id && approveMut.mutate(cell.id)}
                                                        onReject={() => cell.id && handleReject(cell.id)}
                                                        onAudit={() => cell.id && setAuditCellId(cell.id)}
                                                    />
                                                ) : (
                                                    <span className="text-muted-foreground/50 text-xs">—</span>
                                                )}
                                            </td>
                                        ))}
                                        <td className="p-2 text-right font-mono text-emerald-700 whitespace-nowrap">
                                            {row.approvedWage > 0 ? `Rp ${formatRp(row.approvedWage)}` : "—"}
                                        </td>
                                        <td className="p-2 text-right font-mono whitespace-nowrap">
                                            {row.adjustments.net !== 0 ? (
                                                <span className={row.adjustments.net >= 0 ? "text-blue-700" : "text-red-700"}>
                                                    {row.adjustments.net >= 0 ? "+" : ""}Rp {formatRp(row.adjustments.net)}
                                                </span>
                                            ) : "—"}
                                        </td>
                                        <td className="p-2 text-right font-mono font-bold text-navy whitespace-nowrap">
                                            {row.grandTotal > 0 ? `Rp ${formatRp(row.grandTotal)}` : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-emerald-50 border-t-2 border-emerald-200">
                                <tr>
                                    <td colSpan={8} className="p-2 text-right font-bold text-emerald-800">GRAND TOTAL FINAL CAIR:</td>
                                    <td colSpan={2} className="p-2"></td>
                                    <td className="p-2 text-right font-mono font-bold text-emerald-800">Rp {formatRp(data.grandFinal)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </>
            )}

            {auditCellId && (
                <AuditLogModal attendanceId={auditCellId} onClose={() => setAuditCellId(null)} />
            )}
        </div>
    );
}

function SummaryCard({ label, value, hint, color = "slate" }: { label: string; value: string; hint?: string; color?: "slate" | "emerald" | "blue" | "red" | "navy" }) {
    const colors: Record<string, string> = {
        slate: "border-slate-300 bg-slate-50",
        emerald: "border-emerald-300 bg-emerald-50",
        blue: "border-blue-300 bg-blue-50",
        red: "border-red-300 bg-red-50",
        navy: "border-blue-700 bg-blue-100",
    };
    return (
        <div className={`border rounded-lg p-2 ${colors[color]}`}>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
            <div className="text-sm sm:text-base font-bold font-mono mt-0.5">{value}</div>
            {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
        </div>
    );
}

function AttendanceCell({ cell, onApprove, onReject, onAudit }: {
    cell: WeeklySummary["rows"][number]["cells"][number];
    onApprove: () => void;
    onReject: () => void;
    onAudit: () => void;
}) {
    const sBadge = cell.status ? STATUS_LABEL[cell.status] : null;
    const aBadge = cell.approvalStatus ? APPROVAL_LABEL[cell.approvalStatus] : null;
    const sourceLabel = cell.source === 'assignment' ? '💰 Gaji Crew' : cell.source === 'event-pic' ? '👑 Event PIC' : cell.source === 'event' ? '🎪 Event Member' : cell.source === 'matrix' ? '📊 Matrix' : cell.source === 'worker' ? '👤 Default' : '';
    const tooltip = sBadge
        ? `${sBadge.label}${cell.overtimeHours ? ` + ${cell.overtimeHours}j` : ''} = Rp ${formatRp(cell.total)}\nSumber: ${sourceLabel}\nStatus: ${aBadge?.label ?? '-'}`
        : '';
    return (
        <div className="inline-flex flex-col items-center gap-0.5 group relative">
            <div className={`inline-flex flex-col items-center justify-center px-1 py-0.5 rounded border text-xs ${sBadge?.cls ?? ''}`} title={tooltip}>
                <span className="font-bold text-sm">{sBadge?.emoji}</span>
                {cell.overtimeHours > 0 && <span className="text-[9px] font-mono">+{cell.overtimeHours}j</span>}
            </div>
            {aBadge && (
                <span className={`text-[8px] px-1 rounded border ${aBadge.cls} font-medium`}>{aBadge.label.charAt(0)}</span>
            )}
            {/* Hover actions */}
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-white border rounded shadow-lg z-10 p-0.5">
                {cell.approvalStatus !== 'APPROVED' && (
                    <button onClick={onApprove} className="p-1 hover:bg-emerald-100 text-emerald-700 rounded" title="Approve">
                        <Check className="h-3 w-3" />
                    </button>
                )}
                {cell.approvalStatus !== 'REJECTED' && (
                    <button onClick={onReject} className="p-1 hover:bg-red-100 text-red-700 rounded" title="Reject">
                        <X className="h-3 w-3" />
                    </button>
                )}
                <button onClick={onAudit} className="p-1 hover:bg-blue-100 text-blue-700 rounded" title="Audit log">
                    <History className="h-3 w-3" />
                </button>
            </div>
        </div>
    );
}

// ─── Audit Log Modal ─────────────────────────────────────────────────────

function AuditLogModal({ attendanceId, onClose }: { attendanceId: number; onClose: () => void }) {
    const { data: logs = [], isLoading } = useQuery<AuditLogEntry[]>({
        queryKey: ["attendance-audit", attendanceId],
        queryFn: () => getAttendanceAuditLog(attendanceId),
    });

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-bold flex items-center gap-2"><History className="h-5 w-5 text-blue-600" /> Audit Log Attendance #{attendanceId}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="h-5 w-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {isLoading && <div className="text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>}
                    {!isLoading && logs.length === 0 && <div className="text-center text-muted-foreground text-sm">Belum ada history.</div>}
                    {logs.map((log) => {
                        const actionColor: Record<string, string> = {
                            CREATE: "bg-blue-100 text-blue-800",
                            UPDATE: "bg-amber-100 text-amber-800",
                            DELETE: "bg-red-100 text-red-800",
                            APPROVE: "bg-emerald-100 text-emerald-800",
                            REJECT: "bg-red-100 text-red-800",
                        };
                        const oldData = log.oldData ? JSON.parse(log.oldData) : null;
                        const newData = log.newData ? JSON.parse(log.newData) : null;
                        return (
                            <div key={log.id} className="border rounded p-3 text-xs space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`px-2 py-0.5 rounded font-bold ${actionColor[log.action] ?? "bg-slate-100"}`}>{log.action}</span>
                                    <span className="text-muted-foreground">{dayjs(log.createdAt).format("DD MMM YYYY HH:mm")}</span>
                                    {log.changedBy && <span className="text-muted-foreground">by {log.changedBy.name ?? log.changedBy.email}</span>}
                                    {log.changedByPic && <span className="text-muted-foreground">by PIC: {log.changedByPic.name}</span>}
                                </div>
                                {log.notes && <div className="text-amber-700 italic">📝 {log.notes}</div>}
                                {oldData && (
                                    <details>
                                        <summary className="cursor-pointer text-muted-foreground">Sebelum</summary>
                                        <pre className="bg-red-50 p-2 rounded text-[10px] overflow-x-auto mt-1">{JSON.stringify(oldData, null, 2)}</pre>
                                    </details>
                                )}
                                {newData && (
                                    <details>
                                        <summary className="cursor-pointer text-muted-foreground">Sesudah</summary>
                                        <pre className="bg-emerald-50 p-2 rounded text-[10px] overflow-x-auto mt-1">{JSON.stringify(newData, null, 2)}</pre>
                                    </details>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ─── Monthly Tab ─────────────────────────────────────────────────────────

function MonthlyTab() {
    const now = dayjs();
    const [year, setYear] = useState(now.year());
    const [month, setMonth] = useState(now.month() + 1);
    const [exporting, setExporting] = useState(false);
    const [slipLoadingId, setSlipLoadingId] = useState<number | null>(null);

    const { data, isLoading } = useQuery<MonthlySummary>({
        queryKey: ["payroll-monthly", year, month],
        queryFn: () => getMonthlySummary(year, month),
    });

    async function handleExport() {
        setExporting(true);
        try {
            const blob = await exportMonthlyXlsx(year, month);
            downloadBlob(blob, `payroll-bulanan-${year}-${String(month).padStart(2, "0")}.xlsx`);
        } catch (e: any) {
            alert(`Gagal: ${e?.response?.data?.message || e?.message}`);
        } finally { setExporting(false); }
    }

    async function handlePayslip(workerId: number, workerName: string) {
        setSlipLoadingId(workerId);
        try {
            const blob = await exportPayslipPdf(workerId, data!.periodStart, data!.periodEnd);
            const safeName = workerName.replace(/[^a-zA-Z0-9-]+/g, "_");
            downloadBlob(blob, `slip-gaji-${safeName}-${year}-${String(month).padStart(2, "0")}.pdf`);
        } catch (e: any) {
            alert(`Gagal generate slip: ${e?.response?.data?.message || e?.message}`);
        } finally { setSlipLoadingId(null); }
    }

    const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
        value: i + 1, label: dayjs().month(i).format("MMMM"),
    })), []);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap bg-muted/30 rounded-lg p-2">
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="px-3 py-1.5 border rounded bg-white text-sm">
                    {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 px-3 py-1.5 border rounded bg-white text-sm" />
                <button onClick={() => { setYear(now.year()); setMonth(now.month() + 1); }} className="px-3 py-1.5 text-xs border rounded hover:bg-background">Bulan ini</button>
                <button onClick={handleExport} disabled={exporting || !data}
                    className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded font-medium disabled:opacity-50">
                    {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Export Excel
                </button>
            </div>

            {isLoading && <div className="text-center p-8 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin inline" /></div>}

            {data && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <SummaryCard label="Total Attendance" value={`Rp ${formatRp(data.grandTotal)}`} />
                        <SummaryCard label="Approved" value={`Rp ${formatRp(data.grandApproved)}`} color="emerald" />
                        <SummaryCard label="Adjustments" value={`Rp ${formatRp(data.grandAdjustment)}`} color={data.grandAdjustment >= 0 ? "blue" : "red"} />
                        <SummaryCard label="Final Cair" value={`Rp ${formatRp(data.grandFinal)}`} color="navy" />
                    </div>

                    <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="text-left p-2">Pekerja</th>
                                    <th className="p-2 text-center">Hadir</th>
                                    <th className="p-2 text-center">½</th>
                                    <th className="p-2 text-center">Lembur (j)</th>
                                    <th className="p-2 text-right">Approved</th>
                                    <th className="p-2 text-right">Adj</th>
                                    <th className="p-2 text-center">Pending</th>
                                    <th className="p-2 text-right whitespace-nowrap">Final Cair</th>
                                    <th className="p-2 text-center w-16">Slip</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.rows.map((row) => (
                                    <tr key={row.workerId} className="border-t">
                                        <td className="p-2">
                                            <div className="font-medium">{row.name}</div>
                                            <div className="text-[10px] text-muted-foreground">
                                                {row.hasPayroll ? `Rp ${formatRp(row.dailyWageRate)}/hari` : <span className="text-amber-600">Belum diset</span>}
                                            </div>
                                        </td>
                                        <td className="p-2 text-center">{row.fullDays}</td>
                                        <td className="p-2 text-center">{row.halfDays}</td>
                                        <td className="p-2 text-center font-mono">{row.overtimeHours}</td>
                                        <td className="p-2 text-right font-mono text-emerald-700">Rp {formatRp(row.approvedTotal)}</td>
                                        <td className={`p-2 text-right font-mono ${row.adjustments.net >= 0 ? "text-blue-700" : "text-red-700"}`}>
                                            {row.adjustments.net !== 0 ? `${row.adjustments.net >= 0 ? "+" : ""}Rp ${formatRp(row.adjustments.net)}` : "—"}
                                        </td>
                                        <td className="p-2 text-center">
                                            {row.pendingCount > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">{row.pendingCount}</span>}
                                        </td>
                                        <td className="p-2 text-right font-mono font-bold text-navy whitespace-nowrap">Rp {formatRp(row.grandTotal)}</td>
                                        <td className="p-2 text-center">
                                            <button
                                                onClick={() => handlePayslip(row.workerId, row.name)}
                                                disabled={slipLoadingId === row.workerId}
                                                title="Download Slip Gaji PDF"
                                                className="p-1.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-50"
                                            >
                                                {slipLoadingId === row.workerId
                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    : <FileText className="h-3.5 w-3.5" />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-emerald-50 border-t-2 border-emerald-200">
                                <tr>
                                    <td colSpan={7} className="p-2 text-right font-bold text-emerald-800">GRAND TOTAL FINAL CAIR:</td>
                                    <td className="p-2 text-right font-mono font-bold text-emerald-800">Rp {formatRp(data.grandFinal)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Manual Entry Tab ────────────────────────────────────────────────────

function ManualEntryTab() {
    const qc = useQueryClient();
    const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
    const [eventId, setEventId] = useState<number | null>(null);
    const [rows, setRows] = useState<Map<number, { status: AttendanceStatus; overtime: number }>>(new Map());

    const { data: allWorkers = [] } = useQuery<Worker[]>({
        queryKey: ["workers", false, ""],
        queryFn: () => getWorkers(false),
    });

    // Event list — pilih event supaya tarif tier/override crew kepakai di payroll.
    const { data: events = [] } = useQuery({
        queryKey: ["events", "for-attendance"],
        queryFn: () => getEvents({}),
    });

    // Crew ter-assign ke event terpilih (untuk filter worker + tampilkan tarif).
    const { data: crew = [] } = useQuery({
        queryKey: ["event-crew", eventId],
        queryFn: () => listCrewByEvent(eventId as number),
        enabled: eventId != null,
    });
    const crewByWorker = useMemo(() => {
        const m = new Map<number, typeof crew[number]>();
        for (const a of crew) m.set(a.workerId, a);
        return m;
    }, [crew]);

    // Worker yang ditampilkan: kalau event dipilih → hanya crew event itu; else semua.
    const displayWorkers = useMemo(() => {
        if (eventId == null) return allWorkers;
        const ids = new Set(crew.map((a) => a.workerId));
        return allWorkers.filter((w) => ids.has(w.id));
    }, [eventId, crew, allWorkers]);

    function rateLabel(workerId: number): string {
        const a = crewByWorker.get(workerId);
        if (!a) return "";
        const manual = a.dailyWageRate != null;
        const daily = manual ? Number(a.dailyWageRate) : (a.wageTier?.dailyWageRate != null ? Number(a.wageTier.dailyWageRate) : null);
        if (daily == null) return a.wageTier ? `Tier: ${a.wageTier.name}` : "";
        return `${manual ? "Custom" : (a.wageTier?.name ?? "Gaji")}: Rp ${daily.toLocaleString("id-ID")}/hari`;
    }

    const { data: existing } = useQuery<WeeklySummary>({
        queryKey: ["payroll-weekly", date],
        queryFn: () => getWeeklySummary(date),
        enabled: !!date,
    });

    useEffect(() => {
        const next = new Map<number, { status: AttendanceStatus; overtime: number }>();
        for (const w of displayWorkers) {
            const existingRow = existing?.rows.find((r) => r.workerId === w.id);
            const cell = existingRow?.cells.find((c) => c.date === date);
            next.set(w.id, {
                status: cell?.status ?? "ABSENT",
                overtime: cell?.overtimeHours ?? 0,
            });
        }
        setRows(next);
    }, [displayWorkers, existing, date]);

    const submitMut = useMutation({
        mutationFn: () => {
            const entries = Array.from(rows.entries()).map(([workerId, r]) => ({
                workerId, status: r.status, overtimeHours: r.overtime,
                eventId: eventId ?? null,
            }));
            return bulkUpsertAttendance(date, entries);
        },
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ["payroll-weekly"] });
            qc.invalidateQueries({ queryKey: ["payroll-monthly"] });
            alert(`✅ Tersimpan untuk ${res.upserted} pekerja`);
        },
    });

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3 flex-wrap">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Tanggal:</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-1.5 border rounded bg-white text-sm" />
                <span className="text-sm font-medium ml-1">Event:</span>
                <select
                    value={eventId ?? ""}
                    onChange={(e) => setEventId(e.target.value ? Number(e.target.value) : null)}
                    className="px-3 py-1.5 border rounded bg-white text-sm max-w-[260px]"
                >
                    <option value="">— Umum (tanpa event) —</option>
                    {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>{ev.name}{ev.code ? ` (${ev.code})` : ""}</option>
                    ))}
                </select>
                <span className="text-xs text-muted-foreground">
                    {eventId ? "Hanya crew event ini; tarif ikut tier/override crew." : "Pilih event agar tarif tier crew kepakai di payroll."}
                </span>
            </div>

            {eventId != null && displayWorkers.length === 0 && (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
                    Belum ada crew ter-assign di event ini. Assign dulu di <b>Event → tab Crew</b>.
                </div>
            )}

            <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="text-left p-2">Pekerja</th>
                            <th className="p-2 text-center">Status</th>
                            <th className="p-2 text-center">Lembur (jam)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayWorkers.map((w) => {
                            const r = rows.get(w.id) ?? { status: "ABSENT" as AttendanceStatus, overtime: 0 };
                            const rl = rateLabel(w.id);
                            return (
                                <tr key={w.id} className="border-t">
                                    <td className="p-2">
                                        <div className="font-medium">{w.name}</div>
                                        <div className="text-[10px] text-muted-foreground">{w.position ?? ""}</div>
                                        {rl && <div className="text-[10px] text-emerald-700 font-medium">💰 {rl}</div>}
                                    </td>
                                    <td className="p-2 text-center">
                                        <select value={r.status} onChange={(e) => setRows((prev) => {
                                            const next = new Map(prev);
                                            next.set(w.id, { ...r, status: e.target.value as AttendanceStatus });
                                            return next;
                                        })} className="px-2 py-1 border rounded text-sm bg-white">
                                            <option value="FULL_DAY">✓ Hadir</option>
                                            <option value="HALF_DAY">½ Hari</option>
                                            <option value="ABSENT">✗ Absen</option>
                                        </select>
                                    </td>
                                    <td className="p-2 text-center">
                                        <input type="number" min={0} max={12} step={0.5} value={r.overtime} onChange={(e) => setRows((prev) => {
                                            const next = new Map(prev);
                                            next.set(w.id, { ...r, overtime: Math.max(0, Math.min(12, Number(e.target.value) || 0)) });
                                            return next;
                                        })} className="w-20 px-2 py-1 border rounded text-sm font-mono text-right" />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <button onClick={() => submitMut.mutate()} disabled={submitMut.isPending}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 inline-flex items-center gap-2">
                {submitMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                💾 Simpan Absensi {dayjs(date).format("DD MMM YYYY")}
            </button>
        </div>
    );
}

// ─── Adjustments Tab ─────────────────────────────────────────────────────

function AdjustmentsTab() {
    const qc = useQueryClient();
    const [from, setFrom] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
    const [to, setTo] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<AdjustmentInput>({
        workerId: 0, type: "BONUS", amount: "", effectiveDate: dayjs().format("YYYY-MM-DD"), notes: "",
    });

    const { data: workers = [] } = useQuery<Worker[]>({
        queryKey: ["workers", false, ""],
        queryFn: () => getWorkers(false),
    });
    const { data: list = [], isLoading } = useQuery<PayrollAdjustment[]>({
        queryKey: ["payroll-adjustments", from, to],
        queryFn: () => listAdjustments({ from, to }),
    });

    const createMut = useMutation({
        mutationFn: createAdjustment,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll-adjustments"] }); resetForm(); },
        onError: (e: any) => alert(`❌ ${e?.response?.data?.message || e?.message}`),
    });
    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<AdjustmentInput> }) => updateAdjustment(id, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll-adjustments"] }); resetForm(); },
    });
    const deleteMut = useMutation({
        mutationFn: deleteAdjustment,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-adjustments"] }),
    });

    function resetForm() {
        setShowForm(false); setEditId(null);
        setForm({ workerId: 0, type: "BONUS", amount: "", effectiveDate: dayjs().format("YYYY-MM-DD"), notes: "" });
    }

    function startEdit(a: PayrollAdjustment) {
        setEditId(a.id);
        setForm({
            workerId: a.workerId, type: a.type, amount: a.amount,
            effectiveDate: a.effectiveDate.slice(0, 10), notes: a.notes ?? "",
        });
        setShowForm(true);
    }

    function handleSave() {
        if (!form.workerId) { alert("Pilih worker"); return; }
        if (!Number(form.amount) || Number(form.amount) <= 0) { alert("Jumlah harus > 0"); return; }
        if (editId) updateMut.mutate({ id: editId, data: form });
        else createMut.mutate(form);
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap bg-muted/30 rounded-lg p-2">
                <span className="text-sm font-medium">Periode:</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1 border rounded text-sm bg-white" />
                <span className="text-muted-foreground">→</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1 border rounded text-sm bg-white" />
                <button onClick={() => { resetForm(); setShowForm(true); }}
                    className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium">
                    <Plus className="h-3.5 w-3.5" /> Tambah
                </button>
            </div>

            {showForm && (
                <div className="border-2 border-emerald-300 bg-emerald-50/50 rounded-lg p-4 space-y-3">
                    <div className="text-sm font-bold text-emerald-800">{editId ? "Edit" : "Tambah"} Tunjangan/Potongan</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium block mb-1">Worker *</label>
                            <select value={form.workerId || ""} onChange={(e) => setForm(f => ({ ...f, workerId: Number(e.target.value) }))}
                                className="w-full border rounded px-3 py-2 text-sm bg-white">
                                <option value="">— Pilih worker —</option>
                                {workers.map(w => <option key={w.id} value={w.id}>{w.name}{w.position ? ` (${w.position})` : ""}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium block mb-1">Tipe *</label>
                            <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value as PayrollAdjustmentType }))}
                                className="w-full border rounded px-3 py-2 text-sm bg-white">
                                {(Object.keys(ADJ_TYPE_LABEL) as PayrollAdjustmentType[]).map(t => (
                                    <option key={t} value={t}>{ADJ_TYPE_LABEL[t].emoji} {ADJ_TYPE_LABEL[t].label} ({ADJ_TYPE_LABEL[t].sign > 0 ? "+" : "−"})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium block mb-1">Jumlah (Rp) *</label>
                            <input type="text" inputMode="numeric" value={form.amount}
                                onChange={(e) => setForm(f => ({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") }))}
                                placeholder="100000" className="w-full border rounded px-3 py-2 text-sm font-mono" />
                            <p className="text-[10px] text-muted-foreground mt-1">Selalu positif. Sign ditentukan oleh tipe.</p>
                        </div>
                        <div>
                            <label className="text-xs font-medium block mb-1">Tanggal Berlaku *</label>
                            <input type="date" value={form.effectiveDate}
                                onChange={(e) => setForm(f => ({ ...f, effectiveDate: e.target.value }))}
                                className="w-full border rounded px-3 py-2 text-sm" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-medium block mb-1">Catatan</label>
                            <input value={form.notes ?? ""} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                                placeholder="(opsional)" className="w-full border rounded px-3 py-2 text-sm" />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={resetForm} className="px-3 py-1.5 text-sm border rounded hover:bg-white">Batal</button>
                        <button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}
                            className="inline-flex items-center gap-1 px-4 py-1.5 rounded text-sm bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
                            {(createMut.isPending || updateMut.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            {editId ? "Update" : "Simpan"}
                        </button>
                    </div>
                </div>
            )}

            {isLoading && <div className="text-center p-8 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin inline" /></div>}
            {!isLoading && list.length === 0 && (
                <div className="text-center p-8 text-muted-foreground text-sm">Belum ada adjustment di periode ini.</div>
            )}
            {list.length > 0 && (
                <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-left p-2">Tanggal</th>
                                <th className="text-left p-2">Worker</th>
                                <th className="text-left p-2">Tipe</th>
                                <th className="text-right p-2">Jumlah</th>
                                <th className="text-left p-2">Catatan</th>
                                <th className="text-center p-2 w-24">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.map((a) => {
                                const meta = ADJ_TYPE_LABEL[a.type];
                                const amt = parseFloat(a.amount);
                                return (
                                    <tr key={a.id} className="border-t">
                                        <td className="p-2 text-xs">{dayjs(a.effectiveDate).format("DD MMM YYYY")}</td>
                                        <td className="p-2">{a.worker?.name ?? `#${a.workerId}`}</td>
                                        <td className="p-2">
                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${meta.cls}`}>
                                                {meta.emoji} {meta.label}
                                            </span>
                                        </td>
                                        <td className={`p-2 text-right font-mono font-semibold ${meta.sign > 0 ? "text-emerald-700" : "text-red-700"}`}>
                                            {meta.sign > 0 ? "+" : "−"}Rp {formatRp(amt)}
                                        </td>
                                        <td className="p-2 text-xs text-muted-foreground">{a.notes ?? "—"}</td>
                                        <td className="p-2 text-center">
                                            <div className="inline-flex gap-1">
                                                <button onClick={() => startEdit(a)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Edit">
                                                    <Plus className="h-3.5 w-3.5 rotate-45" />
                                                </button>
                                                <button onClick={() => { if (confirm("Hapus adjustment ini?")) deleteMut.mutate(a.id); }}
                                                    className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Hapus">
                                                    <Trash2 className="h-3.5 w-3.5" />
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
        </div>
    );
}
