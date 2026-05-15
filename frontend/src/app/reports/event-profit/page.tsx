"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
    TrendingUp, ArrowUpRight, ArrowDownRight, Trophy, Loader2, Download, Calendar, MapPin, ExternalLink, FileDown,
} from "lucide-react";
import { getAllEventsProfit, type EventProfitRow } from "@/lib/api";
import { downloadProjectReportPdf, downloadProjectReportsZip } from "@/lib/api/events";
import { Package } from "lucide-react";
import dayjs from "dayjs";

type PeriodKey = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'all' | 'custom';
const PERIODS: { key: PeriodKey; label: string }[] = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'yesterday', label: 'Kemarin' },
    { key: 'this_week', label: 'Minggu Ini' },
    { key: 'this_month', label: 'Bulan Ini' },
    { key: 'last_month', label: 'Bulan Lalu' },
    { key: 'last_3_months', label: '3 Bulan' },
    { key: 'this_year', label: '1 Tahun' },
    { key: 'all', label: 'Semua' },
    { key: 'custom', label: 'Kustom' },
];

function getPeriodDates(period: PeriodKey, customStart?: string, customEnd?: string): { startDate?: string; endDate?: string } {
    const now = dayjs();
    if (period === 'today') return { startDate: now.format('YYYY-MM-DD'), endDate: now.format('YYYY-MM-DD') };
    if (period === 'yesterday') { const y = now.subtract(1, 'day'); return { startDate: y.format('YYYY-MM-DD'), endDate: y.format('YYYY-MM-DD') }; }
    if (period === 'this_week') return { startDate: now.startOf('week').format('YYYY-MM-DD'), endDate: now.endOf('week').format('YYYY-MM-DD') };
    if (period === 'this_month') return { startDate: now.startOf('month').format('YYYY-MM-DD'), endDate: now.endOf('month').format('YYYY-MM-DD') };
    if (period === 'last_month') { const lm = now.subtract(1, 'month'); return { startDate: lm.startOf('month').format('YYYY-MM-DD'), endDate: lm.endOf('month').format('YYYY-MM-DD') }; }
    if (period === 'last_3_months') return { startDate: now.subtract(2, 'month').startOf('month').format('YYYY-MM-DD'), endDate: now.endOf('month').format('YYYY-MM-DD') };
    if (period === 'this_year') return { startDate: now.startOf('year').format('YYYY-MM-DD'), endDate: now.endOf('year').format('YYYY-MM-DD') };
    if (period === 'custom') return { startDate: customStart || undefined, endDate: customEnd || undefined };
    return {};
}

const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const fmtShort = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
    if (Math.abs(n) >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}k`;
    return `Rp ${n}`;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: "Draft", cls: "bg-gray-100 text-gray-700" },
    SCHEDULED: { label: "Terjadwal", cls: "bg-blue-100 text-blue-700" },
    IN_PROGRESS: { label: "Berlangsung", cls: "bg-amber-100 text-amber-800" },
    COMPLETED: { label: "Selesai", cls: "bg-green-100 text-green-700" },
    CANCELLED: { label: "Batal", cls: "bg-red-100 text-red-700" },
};

function marginColor(pct: number) {
    if (pct >= 30) return "text-green-600";
    if (pct >= 15) return "text-amber-600";
    if (pct < 0) return "text-red-600";
    return "text-red-500";
}

function marginBg(pct: number) {
    if (pct >= 30) return "bg-green-50 border-green-200";
    if (pct >= 15) return "bg-amber-50 border-amber-200";
    if (pct < 0) return "bg-red-50 border-red-200";
    return "bg-red-50 border-red-200";
}

function medal(idx: number) {
    if (idx === 0) return "🥇";
    if (idx === 1) return "🥈";
    if (idx === 2) return "🥉";
    return `#${idx + 1}`;
}

export default function EventProfitPage() {
    const [period, setPeriod] = useState<PeriodKey>('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [sortMode, setSortMode] = useState<'profit' | 'income' | 'expense' | 'margin'>('profit');
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkDownloading, setBulkDownloading] = useState(false);

    async function handleDownloadReport(eventId: number) {
        try {
            setDownloadingId(eventId);
            await downloadProjectReportPdf(eventId);
        } catch (err) {
            console.error(err);
            alert("Gagal download report. Pastikan backend running.");
        } finally {
            setDownloadingId(null);
        }
    }

    function toggleSelect(eventId: number) {
        const s = new Set(selectedIds);
        if (s.has(eventId)) s.delete(eventId); else s.add(eventId);
        setSelectedIds(s);
    }

    async function handleBulkDownload() {
        if (selectedIds.size === 0) return;
        try {
            setBulkDownloading(true);
            const ids = Array.from(selectedIds);
            const res = await downloadProjectReportsZip(ids);
            if (res.failed.length > 0) {
                alert(`✅ ${res.count} PDF berhasil di-zip. Gagal untuk ${res.failed.length} event (id: ${res.failed.join(", ")}).`);
            } else {
                alert(`✅ ${res.count} PDF berhasil di-download dalam ZIP.`);
            }
            setSelectedIds(new Set());
        } catch (err) {
            console.error(err);
            alert("Gagal generate bulk ZIP. Pastikan backend running.");
        } finally {
            setBulkDownloading(false);
        }
    }

    const { startDate, endDate } = getPeriodDates(period, customStart, customEnd);

    const { data, isLoading } = useQuery({
        queryKey: ['event-profit-leaderboard', startDate, endDate],
        queryFn: () => getAllEventsProfit(startDate, endDate),
    });

    const filteredRows = useMemo(() => {
        if (!data) return [] as EventProfitRow[];
        let rows = [...data.rows];
        if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
        rows.sort((a, b) => {
            if (sortMode === 'profit') return b.grossProfit - a.grossProfit;
            if (sortMode === 'income') return b.totalIncome - a.totalIncome;
            if (sortMode === 'expense') return b.totalExpense - a.totalExpense;
            return b.marginPct - a.marginPct;
        });
        return rows;
    }, [data, statusFilter, sortMode]);

    const maxAbs = useMemo(() => {
        if (filteredRows.length === 0) return 1;
        return Math.max(...filteredRows.map((r) => Math.abs(r.grossProfit)));
    }, [filteredRows]);

    function exportCsv() {
        if (!data) return;
        const escape = (v: unknown) => {
            const s = v == null ? "" : String(v);
            if (s.includes(",") || s.includes('"') || s.includes("\n")) {
                return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
        };

        const periodLabel = period === "custom"
            ? `${customStart || "—"} → ${customEnd || "—"}`
            : PERIODS.find((p) => p.key === period)?.label ?? period;

        const totalIncome = filteredRows.reduce((s, r) => s + r.totalIncome, 0);
        const totalExpense = filteredRows.reduce((s, r) => s + r.totalExpense, 0);
        const grandProfit = totalIncome - totalExpense;
        const avgMargin = filteredRows.length > 0
            ? filteredRows.reduce((s, r) => s + r.marginPct, 0) / filteredRows.length
            : 0;

        const lines: string[] = [];
        // Meta header
        lines.push(`# Pospro Event — Laporan Laba per Project`);
        lines.push(`# Periode: ${periodLabel}`);
        if (statusFilter) lines.push(`# Filter Status: ${statusFilter}`);
        lines.push(`# Sort: ${sortMode}`);
        lines.push(`# Generated: ${new Date().toLocaleString("id-ID")}`);
        lines.push(`# Total Event: ${filteredRows.length}`);
        lines.push("");

        // Data
        lines.push([
            "Rank",
            "Event Code",
            "Event Name",
            "Customer",
            "Customer Company",
            "Venue",
            "Event Start",
            "Status",
            "Income",
            "Expense",
            "Profit",
            "Margin %",
            "Entries",
        ].join(","));

        filteredRows.forEach((r, i) => {
            lines.push([
                i + 1,
                r.eventCode,
                r.eventName,
                r.customerName,
                r.customerCompany ?? "",
                r.venue ?? "",
                r.eventStart ? new Date(r.eventStart).toISOString().slice(0, 10) : "",
                r.status,
                r.totalIncome,
                r.totalExpense,
                r.grossProfit,
                r.marginPct.toFixed(2),
                r.entryCount,
            ].map(escape).join(","));
        });

        // Footer summary
        lines.push("");
        lines.push(["", "", "", "", "", "", "", "TOTAL", totalIncome, totalExpense, grandProfit, avgMargin.toFixed(2), ""].map(escape).join(","));

        // BOM untuk Excel auto-detect UTF-8
        const csv = "﻿" + lines.join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `event-profit-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Trophy className="h-6 w-6 text-amber-500" />
                        Laba per Project (Event)
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Leaderboard event sorted by profit. Sumber data: cashflow yang ter-tag eventId.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={exportCsv}
                        disabled={!data || filteredRows.length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-sm hover:bg-muted disabled:opacity-50"
                    >
                        <Download className="h-3.5 w-3.5" /> Export CSV
                    </button>
                </div>
            </div>

            {/* Period filter */}
            <div className="flex items-center gap-2 flex-wrap">
                {PERIODS.map((p) => (
                    <button
                        key={p.key}
                        onClick={() => setPeriod(p.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === p.key ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:bg-muted/70'}`}
                    >
                        {p.label}
                    </button>
                ))}
                {period === 'custom' && (
                    <>
                        <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-2 py-1.5 text-xs rounded-md border border-input bg-background" />
                        <span>—</span>
                        <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-2 py-1.5 text-xs rounded-md border border-input bg-background" />
                    </>
                )}
                <span className="w-px h-5 bg-border mx-1" />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs rounded-md border border-input bg-background py-1.5 px-2"
                >
                    <option value="">Semua Status</option>
                    {Object.keys(STATUS_LABEL).map((s) => (
                        <option key={s} value={s}>{STATUS_LABEL[s].label}</option>
                    ))}
                </select>
                <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
                    className="text-xs rounded-md border border-input bg-background py-1.5 px-2"
                >
                    <option value="profit">Sort: Profit</option>
                    <option value="income">Sort: Income</option>
                    <option value="expense">Sort: Expense</option>
                    <option value="margin">Sort: Margin %</option>
                </select>
            </div>

            {isLoading ? (
                <div className="p-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin inline mr-2" /> Memuat...
                </div>
            ) : !data || data.summary.eventCount === 0 ? (
                <div className="p-12 text-center border rounded-lg text-sm text-muted-foreground">
                    <Trophy className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                    <p>Belum ada cashflow yang ter-tag event.</p>
                    <p className="mt-2">
                        Buka <Link href="/cashflow" className="text-primary hover:underline">Cashflow</Link> &amp; tag entry ke event,
                        atau klik <Link href="/rab" className="text-primary hover:underline">RAB</Link> dan generate cashflow.
                    </p>
                </div>
            ) : (
                <>
                    {/* Grand summary */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <StatCard label="Total Event" value={String(data.summary.eventCount)} />
                        <StatCard label="Total Income" value={fmtShort(data.summary.totalIncome)} valueClass="text-green-600" />
                        <StatCard label="Total Expense" value={fmtShort(data.summary.totalExpense)} valueClass="text-red-600" />
                        <StatCard
                            label="Total Profit"
                            value={fmtShort(data.summary.grossProfit)}
                            valueClass={marginColor(data.summary.marginPct)}
                        />
                        <StatCard
                            label="Avg Margin %"
                            value={`${data.summary.marginPct.toFixed(1)}%`}
                            valueClass={marginColor(data.summary.marginPct)}
                        />
                    </div>

                    {/* Leaderboard */}
                    <div className="border rounded-lg overflow-hidden bg-background">
                        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between flex-wrap gap-2">
                            <h2 className="font-semibold flex items-center gap-2">
                                <Trophy className="h-4 w-4 text-amber-500" /> Leaderboard ({filteredRows.length} event)
                            </h2>
                            {selectedIds.size > 0 ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-primary">
                                        {selectedIds.size} dipilih
                                    </span>
                                    <button
                                        onClick={() => setSelectedIds(new Set(filteredRows.map((r) => r.eventId)))}
                                        className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                                    >
                                        Pilih Semua ({filteredRows.length})
                                    </button>
                                    <button
                                        onClick={() => setSelectedIds(new Set())}
                                        className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                                    >
                                        Bersihkan
                                    </button>
                                    <button
                                        onClick={handleBulkDownload}
                                        disabled={bulkDownloading}
                                        className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1"
                                    >
                                        {bulkDownloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Package className="h-3 w-3" />}
                                        Download ZIP ({selectedIds.size})
                                    </button>
                                </div>
                            ) : (
                                <span className="text-xs text-muted-foreground">
                                    Bar = ratio profit terhadap event terbaik · Centang untuk bulk download
                                </span>
                            )}
                        </div>
                        <div className="divide-y">
                            {filteredRows.map((r, i) => {
                                const isPositive = r.grossProfit >= 0;
                                const pct = (Math.abs(r.grossProfit) / maxAbs) * 100;
                                const status = STATUS_LABEL[r.status] ?? STATUS_LABEL.SCHEDULED;
                                return (
                                    <Link
                                        key={r.eventId}
                                        href={`/events/${r.eventId}`}
                                        className={`block px-4 py-3 hover:bg-muted/30 transition-colors relative group ${selectedIds.has(r.eventId) ? "bg-primary/5" : ""}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(r.eventId)}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    toggleSelect(r.eventId);
                                                }}
                                                className="mt-1.5 shrink-0"
                                            />
                                            <div className="text-lg font-bold w-10 shrink-0">{medal(i)}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold text-sm">{r.eventName}</span>
                                                    <span className="text-xs text-muted-foreground">{r.eventCode}</span>
                                                    <span className={`px-1.5 py-0.5 text-[10px] rounded ${status.cls} font-medium`}>{status.label}</span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                                                    <span>👤 {r.customerName}{r.customerCompany ? ` (${r.customerCompany})` : ""}</span>
                                                    {r.venue && (
                                                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.venue}</span>
                                                    )}
                                                    {r.eventStart && (
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            {new Date(r.eventStart).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                                        </span>
                                                    )}
                                                    <span>📋 {r.entryCount} entry</span>
                                                </div>

                                                {/* Bar */}
                                                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${isPositive ? (i < 3 ? "bg-amber-500" : "bg-primary/60") : "bg-red-500"}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>

                                                <div className="mt-1.5 flex items-center gap-4 text-xs flex-wrap">
                                                    <span className="text-green-600">
                                                        <ArrowUpRight className="h-3 w-3 inline" /> {fmtShort(r.totalIncome)}
                                                    </span>
                                                    <span className="text-red-600">
                                                        <ArrowDownRight className="h-3 w-3 inline" /> {fmtShort(r.totalExpense)}
                                                    </span>
                                                    <span className={`font-bold ${marginColor(r.marginPct)} flex items-center gap-1 ml-auto`}>
                                                        <TrendingUp className="h-3 w-3" />
                                                        {fmt(r.grossProfit)} · {r.marginPct.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5 shrink-0 mt-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleDownloadReport(r.eventId);
                                                    }}
                                                    disabled={downloadingId === r.eventId}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-border bg-background hover:bg-muted disabled:opacity-50"
                                                    title="Download Project Report PDF"
                                                >
                                                    {downloadingId === r.eventId ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <FileDown className="h-3 w-3" />
                                                    )}
                                                    PDF
                                                </button>
                                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function StatCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
    return (
        <div className="border rounded-lg bg-background p-3">
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className={`text-xl font-bold ${valueClass ?? ""}`}>{value}</div>
        </div>
    );
}
