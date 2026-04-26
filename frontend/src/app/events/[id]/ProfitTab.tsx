"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    TrendingUp, ArrowDownRight, ArrowUpRight, Loader2, ExternalLink, Wallet, Plus, X, Pencil, Trash2, FileDown,
} from "lucide-react";
import { getEventProfit, getCashflows, createCashflow, updateCashflow, deleteCashflow, deleteCashflowsBulk } from "@/lib/api";
import { downloadProjectReportPdf, downloadEventCashflowCsv } from "@/lib/api/events";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
    ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const INCOME_CATEGORIES = [
    'Sewa Booth',
    'Pengadaan Booth',
    'Jasa Setup Event',
    'DP Booth/Event',
    'Pelunasan Booth/Event',
    'Pendapatan Printing',
    'Pembayaran DP',
    'Pelunasan DP',
    'Lainnya',
];

const EXPENSE_CATEGORIES = [
    'Material Booth (Kayu/MDF)',
    'Material Booth (Lighting/Hardware)',
    'Jasa Crew Lapangan',
    'Jasa Tukang Workshop',
    'Transport Event',
    'Akomodasi Crew',
    'Sewa Alat Event',
    'Konsumsi Crew',
    'Bahan Baku Printing',
    'Designer Fee',
    'Marketing META Ads',
    'Lainnya',
];

const fmt = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const fmtShort = (n: number) => {
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
    if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}k`;
    return `Rp ${n}`;
};

type CashflowListItem = {
    id: number;
    type: "INCOME" | "EXPENSE";
    category: string;
    amount: string;
    note?: string | null;
    date: string;
    userId?: number | null;
};

export default function ProfitTab({ eventId }: { eventId: number }) {
    const qc = useQueryClient();
    const { isManager } = useCurrentUser();
    const { data: profit, isLoading: loadingProfit } = useQuery({
        queryKey: ["event-profit", eventId],
        queryFn: () => getEventProfit(eventId),
    });
    const { data: cashflowList } = useQuery({
        queryKey: ["cashflows", "event", eventId],
        queryFn: () => getCashflows(undefined, undefined, eventId),
    });

    const [showAddModal, setShowAddModal] = useState(false);
    const [form, setForm] = useState({
        type: "EXPENSE" as "INCOME" | "EXPENSE",
        category: "",
        customCategory: "",
        amount: "",
        note: "",
    });

    const createMut = useMutation({
        mutationFn: createCashflow,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["event-profit", eventId] });
            qc.invalidateQueries({ queryKey: ["cashflows"] });
            setShowAddModal(false);
            setForm({ type: "EXPENSE", category: "", customCategory: "", amount: "", note: "" });
        },
    });

    // Edit / Delete state
    const [editEntry, setEditEntry] = useState<CashflowListItem | null>(null);
    const [editForm, setEditForm] = useState({ category: "", customCategory: "", amount: "", note: "" });
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const editMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: { category?: string; amount?: number; note?: string } }) =>
            updateCashflow(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["event-profit", eventId] });
            qc.invalidateQueries({ queryKey: ["cashflows"] });
            setEditEntry(null);
        },
    });

    const deleteMut = useMutation({
        mutationFn: deleteCashflow,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["event-profit", eventId] });
            qc.invalidateQueries({ queryKey: ["cashflows"] });
            setDeleteId(null);
        },
    });

    // Bulk select
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [showBulkConfirm, setShowBulkConfirm] = useState(false);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [downloadingCsv, setDownloadingCsv] = useState(false);

    const bulkDeleteMut = useMutation({
        mutationFn: deleteCashflowsBulk,
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ["event-profit", eventId] });
            qc.invalidateQueries({ queryKey: ["cashflows"] });
            setSelectedIds(new Set());
            setShowBulkConfirm(false);
            alert(`✅ ${res.deleted} entry dihapus.`);
        },
    });

    function toggleSelect(id: number) {
        const s = new Set(selectedIds);
        if (s.has(id)) s.delete(id); else s.add(id);
        setSelectedIds(s);
    }

    function selectAll() {
        setSelectedIds(new Set(recentEntries.map((e) => e.id)));
    }

    function openEdit(e: CashflowListItem) {
        setEditEntry(e);
        // category: kalau ada di standard list pakai langsung; kalau tidak, jadi "Lainnya" + customCategory
        const standardLists = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
        const inStandard = standardLists.includes(e.category);
        setEditForm({
            category: inStandard ? e.category : "Lainnya",
            customCategory: inStandard ? "" : e.category,
            amount: String(parseFloat(e.amount)),
            note: e.note ?? "",
        });
    }

    function handleEditSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!editEntry) return;
        const finalCategory = editForm.category === "Lainnya" ? editForm.customCategory : editForm.category;
        if (!finalCategory || !editForm.amount) return;
        editMut.mutate({
            id: editEntry.id,
            data: {
                category: finalCategory,
                amount: parseFloat(editForm.amount),
                note: editForm.note,
            },
        });
    }

    const editCategoryOptions = editEntry?.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const finalCategory = form.category === "Lainnya" ? form.customCategory : form.category;
        if (!finalCategory || !form.amount) return;
        createMut.mutate({
            type: form.type,
            category: finalCategory,
            amount: parseFloat(form.amount),
            note: form.note,
            eventId,
        });
    }

    const categoryOptions = form.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

    const recentEntries: CashflowListItem[] = useMemo(() => {
        const list = (cashflowList?.list ?? []) as CashflowListItem[];
        return list.slice(0, 10);
    }, [cashflowList]);

    if (loadingProfit) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Memuat...
            </div>
        );
    }

    if (!profit || profit.entryCount === 0) {
        return (
            <>
                <div className="p-8 border rounded-lg text-center text-sm text-muted-foreground">
                    <Wallet className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                    <p>Belum ada cashflow yang ter-tag ke event ini.</p>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" /> Tambah Entry Pertama
                    </button>
                    <p className="mt-3 text-xs">
                        atau buka <Link href={`/cashflow`} className="text-primary hover:underline">Cashflow</Link> dan pilih event ini di dropdown &quot;Tag Event&quot;.
                    </p>
                </div>
                {renderAddModal()}
            </>
        );
    }

    function renderAddModal() {
        if (!showAddModal) return null;
        return (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
                <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-5 border border-border" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">+ Cashflow Entry untuk Event</h2>
                        <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-muted rounded">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-3">
                        {/* Type toggle */}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, type: "INCOME", category: "" }))}
                                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border ${form.type === "INCOME" ? "bg-green-500 text-white border-green-500" : "border-border hover:bg-muted"}`}
                            >
                                ↗ Pemasukan
                            </button>
                            <button
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, type: "EXPENSE", category: "" }))}
                                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border ${form.type === "EXPENSE" ? "bg-red-500 text-white border-red-500" : "border-border hover:bg-muted"}`}
                            >
                                ↘ Pengeluaran
                            </button>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Kategori *</label>
                            <select
                                required
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                            >
                                <option value="">— Pilih Kategori —</option>
                                {categoryOptions.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            {form.category === "Lainnya" && (
                                <input
                                    required
                                    value={form.customCategory}
                                    onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
                                    placeholder="Kategori custom"
                                    className="w-full mt-1 px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                                />
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Nominal (Rp) *</label>
                            <input
                                required
                                type="number"
                                min="0"
                                value={form.amount}
                                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                placeholder="0"
                                className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Catatan (Opsional)</label>
                            <textarea
                                value={form.note}
                                onChange={(e) => setForm({ ...form, note: e.target.value })}
                                rows={2}
                                placeholder="Detail transaksi..."
                                className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background resize-none"
                            />
                        </div>

                        <div className="bg-indigo-50 border border-indigo-200 rounded p-2 text-xs text-indigo-700">
                            🎪 Auto-tag ke event ini. Buka <Link href="/cashflow" className="underline">/cashflow</Link> untuk form lengkap (bank account, payment method, dll).
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted">Batal</button>
                            <button type="submit" disabled={createMut.isPending} className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                                {createMut.isPending ? "Menyimpan..." : "Simpan"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    const marginColor = profit.marginPct >= 30
        ? "text-green-600"
        : profit.marginPct >= 15
            ? "text-amber-600"
            : "text-red-600";
    const marginBg = profit.marginPct >= 30
        ? "bg-green-50 border-green-200"
        : profit.marginPct >= 15
            ? "bg-amber-50 border-amber-200"
            : "bg-red-50 border-red-200";

    // Sort categories: income first (desc), expense desc
    const incomeCategories = profit.byCategory.filter((c) => c.income > 0).sort((a, b) => b.income - a.income);
    const expenseCategories = profit.byCategory.filter((c) => c.expense > 0).sort((a, b) => b.expense - a.expense);

    const maxIncome = Math.max(1, ...incomeCategories.map((c) => c.income));
    const maxExpense = Math.max(1, ...expenseCategories.map((c) => c.expense));

    return (
        <div className="space-y-4">
            {/* Header dengan tombol tambah & download */}
            <div className="flex items-center justify-end gap-2 flex-wrap">
                <button
                    onClick={async () => {
                        try {
                            setDownloadingCsv(true);
                            await downloadEventCashflowCsv(eventId);
                        } catch (err) {
                            console.error(err);
                            alert("Gagal download CSV. Pastikan backend running.");
                        } finally {
                            setDownloadingCsv(false);
                        }
                    }}
                    disabled={downloadingCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-sm hover:bg-muted disabled:opacity-50"
                    title="Export semua entry cashflow event ini sebagai CSV (untuk Excel)"
                >
                    {downloadingCsv ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                    Export CSV
                </button>
                <button
                    onClick={async () => {
                        try {
                            setDownloadingPdf(true);
                            await downloadProjectReportPdf(eventId);
                        } catch (err) {
                            console.error(err);
                            alert("Gagal download report. Pastikan backend running.");
                        } finally {
                            setDownloadingPdf(false);
                        }
                    }}
                    disabled={downloadingPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-sm hover:bg-muted disabled:opacity-50"
                >
                    {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                    Download Project Report (PDF)
                </button>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                >
                    <Plus className="h-3.5 w-3.5" /> Tambah Entry Cashflow
                </button>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="border rounded-lg bg-background p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        Total Income <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
                    </div>
                    <div className="text-xl font-bold text-green-600">{fmt(profit.totalIncome)}</div>
                </div>
                <div className="border rounded-lg bg-background p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        Total Expense <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                    </div>
                    <div className="text-xl font-bold text-red-600">{fmt(profit.totalExpense)}</div>
                </div>
                <div className={`border rounded-lg p-3 ${marginBg}`}>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        Laba Kotor <TrendingUp className="h-3.5 w-3.5" />
                    </div>
                    <div className={`text-xl font-bold ${marginColor}`}>{fmt(profit.grossProfit)}</div>
                </div>
                <div className={`border rounded-lg p-3 ${marginBg}`}>
                    <div className="text-xs text-muted-foreground mb-1">Margin %</div>
                    <div className={`text-xl font-bold ${marginColor}`}>{profit.marginPct.toFixed(1)}%</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                        {profit.marginPct >= 30 ? "Sehat ✅" : profit.marginPct >= 15 ? "Minim ⚠️" : "Risky 🔴"}
                    </div>
                </div>
            </div>

            {/* Monthly trend chart */}
            {profit.monthlyTrend && profit.monthlyTrend.some((m) => m.income > 0 || m.expense > 0) && (
                <div className="border rounded-lg bg-background p-3">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-sm flex items-center gap-1.5">
                            <TrendingUp className="h-4 w-4" /> Tren 6 Bulan Terakhir
                        </h3>
                        <span className="text-[10px] text-muted-foreground">
                            Bar = Income/Expense · Garis = Profit
                        </span>
                    </div>
                    <div style={{ width: "100%", height: 240 }}>
                        <ResponsiveContainer>
                            <ComposedChart data={profit.monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}jt` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(v)}
                                />
                                <Tooltip
                                    formatter={((value: unknown) => fmt(Number(value))) as never}
                                    contentStyle={{ fontSize: 12 }}
                                />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                <Line
                                    type="monotone"
                                    dataKey="profit"
                                    name="Profit"
                                    stroke="#6366f1"
                                    strokeWidth={2.5}
                                    dot={{ r: 4, fill: "#6366f1" }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Breakdown per category */}
            <div className="grid md:grid-cols-2 gap-3">
                {/* Income categories */}
                <div className="border rounded-lg bg-background overflow-hidden">
                    <div className="px-3 py-2 border-b bg-green-50 text-green-700 text-sm font-semibold flex items-center gap-1">
                        <ArrowUpRight className="h-4 w-4" /> Income per Kategori
                    </div>
                    {incomeCategories.length === 0 ? (
                        <div className="p-4 text-xs text-muted-foreground italic text-center">Belum ada income.</div>
                    ) : (
                        <div className="divide-y">
                            {incomeCategories.map((c) => {
                                const pct = (c.income / maxIncome) * 100;
                                return (
                                    <div key={c.category} className="px-3 py-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm text-foreground/80">{c.category}</span>
                                            <span className="font-semibold text-sm">{fmtShort(c.income)}</span>
                                        </div>
                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Expense categories */}
                <div className="border rounded-lg bg-background overflow-hidden">
                    <div className="px-3 py-2 border-b bg-red-50 text-red-700 text-sm font-semibold flex items-center gap-1">
                        <ArrowDownRight className="h-4 w-4" /> Expense per Kategori
                    </div>
                    {expenseCategories.length === 0 ? (
                        <div className="p-4 text-xs text-muted-foreground italic text-center">Belum ada expense.</div>
                    ) : (
                        <div className="divide-y">
                            {expenseCategories.map((c) => {
                                const pct = (c.expense / maxExpense) * 100;
                                return (
                                    <div key={c.category} className="px-3 py-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm text-foreground/80">{c.category}</span>
                                            <span className="font-semibold text-sm">{fmtShort(c.expense)}</span>
                                        </div>
                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-red-500" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Recent entries */}
            <div className="border rounded-lg bg-background overflow-hidden">
                <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-sm font-semibold">10 Entry Cashflow Terbaru</span>
                    {isManager && selectedIds.size > 0 ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-primary">
                                {selectedIds.size} dipilih
                            </span>
                            <button
                                onClick={selectAll}
                                className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                            >
                                Pilih Semua ({recentEntries.length})
                            </button>
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                            >
                                Bersihkan
                            </button>
                            <button
                                onClick={() => setShowBulkConfirm(true)}
                                disabled={bulkDeleteMut.isPending}
                                className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1"
                            >
                                <Trash2 className="h-3 w-3" /> Hapus ({selectedIds.size})
                            </button>
                        </div>
                    ) : (
                        <Link
                            href={`/cashflow?eventId=${eventId}`}
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                            Lihat semua di Cashflow <ExternalLink className="h-3 w-3" />
                        </Link>
                    )}
                </div>
                <div className="divide-y">
                    {recentEntries.map((e) => {
                        const isIncome = e.type === "INCOME";
                        const isSelected = selectedIds.has(e.id);
                        return (
                            <div
                                key={e.id}
                                className={`px-3 py-2 flex items-center justify-between gap-2 group ${isSelected ? "bg-primary/10" : ""}`}
                            >
                                {isManager && (
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelect(e.id)}
                                        className="shrink-0"
                                    />
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded ${isIncome ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                                            {isIncome ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                        </span>
                                        <span className="text-sm font-medium truncate">{e.category}</span>
                                    </div>
                                    {e.note && <div className="text-xs text-muted-foreground truncate ml-7">{e.note}</div>}
                                    <div className="text-[10px] text-muted-foreground ml-7">
                                        {new Date(e.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                    </div>
                                </div>
                                <div className={`text-sm font-bold shrink-0 ${isIncome ? "text-green-600" : "text-red-600"}`}>
                                    {isIncome ? "+" : "−"} {fmt(parseFloat(e.amount))}
                                </div>
                                {isManager && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button
                                            onClick={() => openEdit(e)}
                                            className="p-1 rounded hover:bg-muted"
                                            title="Edit entry"
                                        >
                                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                        </button>
                                        <button
                                            onClick={() => setDeleteId(e.id)}
                                            className="p-1 rounded hover:bg-red-50 text-red-600"
                                            title="Hapus entry"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="text-xs text-muted-foreground italic">
                💡 Tombol &quot;Tambah Entry Cashflow&quot; auto-tag event ini. Untuk form lengkap (bank account, payment method, RAB tag), buka <Link href="/cashflow" className="text-primary hover:underline">Cashflow</Link>.
            </div>

            {renderAddModal()}

            {/* Edit modal */}
            {editEntry && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditEntry(null)}>
                    <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-5 border border-border" onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-semibold">
                                {editEntry.type === "INCOME" ? "✏️ Edit Pemasukan" : "✏️ Edit Pengeluaran"}
                            </h2>
                            <button onClick={() => setEditEntry(null)} className="p-1 hover:bg-muted rounded">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                            Tipe (Income/Expense) tidak bisa diubah. Untuk ganti tipe, hapus & buat baru.
                        </p>
                        <form onSubmit={handleEditSubmit} className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Kategori *</label>
                                <select
                                    required
                                    value={editForm.category}
                                    onChange={(ev) => setEditForm({ ...editForm, category: ev.target.value })}
                                    className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                                >
                                    <option value="">— Pilih Kategori —</option>
                                    {editCategoryOptions.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                    {editForm.category && !editCategoryOptions.includes(editForm.category) && editForm.category !== "Lainnya" && (
                                        <option value={editForm.category}>{editForm.category}</option>
                                    )}
                                </select>
                                {editForm.category === "Lainnya" && (
                                    <input
                                        required
                                        value={editForm.customCategory}
                                        onChange={(ev) => setEditForm({ ...editForm, customCategory: ev.target.value })}
                                        placeholder="Kategori custom"
                                        className="w-full mt-1 px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                                    />
                                )}
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Nominal (Rp) *</label>
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    value={editForm.amount}
                                    onChange={(ev) => setEditForm({ ...editForm, amount: ev.target.value })}
                                    className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Catatan</label>
                                <textarea
                                    value={editForm.note}
                                    onChange={(ev) => setEditForm({ ...editForm, note: ev.target.value })}
                                    rows={2}
                                    className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background resize-none"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t">
                                <button type="button" onClick={() => setEditEntry(null)} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted">
                                    Batal
                                </button>
                                <button type="submit" disabled={editMut.isPending} className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                                    {editMut.isPending ? "Menyimpan..." : "Simpan"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk delete confirm */}
            {showBulkConfirm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowBulkConfirm(false)}>
                    <div className="bg-background rounded-lg shadow-xl w-full max-w-sm p-5 border border-border" onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex items-start gap-3">
                            <div className="bg-red-100 p-2 rounded-full">
                                <Trash2 className="h-5 w-5 text-red-600" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-semibold">Hapus {selectedIds.size} Entry?</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {selectedIds.size} cashflow entry akan dihapus permanen. Aksi ini tidak bisa di-undo.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-4 mt-3 border-t">
                            <button onClick={() => setShowBulkConfirm(false)} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted">
                                Batal
                            </button>
                            <button
                                onClick={() => bulkDeleteMut.mutate(Array.from(selectedIds))}
                                disabled={bulkDeleteMut.isPending}
                                className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                {bulkDeleteMut.isPending ? "Menghapus..." : `Hapus ${selectedIds.size}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirm */}
            {deleteId !== null && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
                    <div className="bg-background rounded-lg shadow-xl w-full max-w-sm p-5 border border-border" onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex items-start gap-3">
                            <div className="bg-red-100 p-2 rounded-full">
                                <Trash2 className="h-5 w-5 text-red-600" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-semibold">Hapus Entry?</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Entry cashflow akan dihapus permanen. Aksi ini tidak bisa di-undo.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-4 mt-3 border-t">
                            <button onClick={() => setDeleteId(null)} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted">
                                Batal
                            </button>
                            <button
                                onClick={() => deleteMut.mutate(deleteId)}
                                disabled={deleteMut.isPending}
                                className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                {deleteMut.isPending ? "Menghapus..." : "Hapus"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
