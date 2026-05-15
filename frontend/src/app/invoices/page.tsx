"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
    AlertTriangle, ArrowUpRight, Loader2, Phone, Search,
    TrendingUp, Users, Wallet, Receipt, AlertCircle, ChevronRight,
} from "lucide-react";
import { getReceivablesDashboard, getQuotation, type ReceivablesDashboard, type Quotation } from "@/lib/api/quotations";
import { PaymentDetailModal } from "@/components/PaymentDetailModal";
import { DateRangeFilter, presetToRange, type DateRange } from "@/components/DateRangeFilter";

const fmtRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const fmtShort = (n: number) => {
    if (Math.abs(n) >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
    if (Math.abs(n) >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}k`;
    return `Rp ${n}`;
};
const fmtDate = (s: string | null | undefined) => {
    if (!s) return "—";
    try {
        return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    } catch { return s; }
};

function severity(days: number) {
    if (days <= 7) return { cls: "bg-amber-100 text-amber-800 border-amber-300", label: "Hampir Tempo" };
    if (days <= 30) return { cls: "bg-orange-100 text-orange-800 border-orange-300", label: "Lewat Tempo" };
    if (days <= 90) return { cls: "bg-red-100 text-red-800 border-red-300", label: "Telat Berat" };
    return { cls: "bg-red-200 text-red-900 border-red-400 font-bold", label: "Macet" };
}

function customerSeverity(c: ReceivablesDashboard["byCustomer"][number]) {
    if (c.sisaTagihan === 0) return { cls: "text-emerald-700", emoji: "✅" };
    if (c.overdueCount > 0) return { cls: "text-red-700", emoji: "🚨" };
    if (c.oldestUnpaidDays > 60) return { cls: "text-orange-700", emoji: "⚠️" };
    if (c.oldestUnpaidDays > 30) return { cls: "text-amber-700", emoji: "⏳" };
    return { cls: "text-slate-700", emoji: "📋" };
}

export default function InvoicesPiutangPage() {
    const { data, isLoading, error } = useQuery({
        queryKey: ["receivables-dashboard"],
        queryFn: getReceivablesDashboard,
        staleTime: 30_000,
    });

    const [filter, setFilter] = useState("");
    const [activeTab, setActiveTab] = useState<"customer" | "overdue" | "income">("customer");
    const [detailTargetId, setDetailTargetId] = useState<number | null>(null);
    const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRange>({ preset: "ALL" });

    // Compute date filter window
    const { from: rangeFrom, to: rangeTo } = useMemo(
        () => presetToRange(dateRange.preset, { from: dateRange.fromDate, to: dateRange.toDate }),
        [dateRange]
    );
    const hasDateFilter = !!(rangeFrom || rangeTo);

    // Filter overdueInvoices by date (issue date)
    const filteredOverdueInvoices = useMemo(() => {
        if (!data) return [];
        if (!hasDateFilter) return data.overdueInvoices;
        return data.overdueInvoices.filter((inv) => {
            if (!inv.date) return false;
            const d = new Date(inv.date);
            if (rangeFrom && d < rangeFrom) return false;
            if (rangeTo && d > rangeTo) return false;
            return true;
        });
    }, [data, hasDateFilter, rangeFrom, rangeTo]);

    // Filter incomeMonthly by date range (using month key)
    const filteredIncomeMonthly = useMemo(() => {
        if (!data) return [];
        if (!hasDateFilter) return data.incomeMonthly;
        return data.incomeMonthly.filter((m) => {
            // m.month = "YYYY-MM" → parse to first of month
            const [y, mo] = m.month.split("-");
            const dt = new Date(parseInt(y), parseInt(mo) - 1, 1);
            const dtEnd = new Date(parseInt(y), parseInt(mo), 0, 23, 59, 59);
            // Hit kalau bulan beririsan dengan range
            if (rangeFrom && dtEnd < rangeFrom) return false;
            if (rangeTo && dt > rangeTo) return false;
            return true;
        });
    }, [data, hasDateFilter, rangeFrom, rangeTo]);

    // Filtered income totals
    const filteredIncomeTotal = useMemo(
        () => filteredIncomeMonthly.reduce((s, m) => s + m.amount, 0),
        [filteredIncomeMonthly]
    );
    const filteredOverdueTotal = useMemo(
        () => filteredOverdueInvoices.reduce((s, inv) => s + inv.sisa, 0),
        [filteredOverdueInvoices]
    );

    // Fetch invoice detail saat user klik row
    const { data: detailInvoice } = useQuery<Quotation>({
        queryKey: ["quotation-detail", detailTargetId],
        queryFn: () => getQuotation(detailTargetId!),
        enabled: !!detailTargetId,
        staleTime: 30_000,
    });

    const filteredCustomers = useMemo(() => {
        if (!data) return [];
        const q = filter.trim().toLowerCase();
        if (!q) return data.byCustomer;
        return data.byCustomer.filter((c) =>
            c.customerName.toLowerCase().includes(q) ||
            (c.companyName?.toLowerCase().includes(q) ?? false) ||
            (c.phone?.includes(q) ?? false)
        );
    }, [data, filter]);

    const maxIncome = useMemo(() => {
        if (!data) return 0;
        return Math.max(1, ...data.incomeMonthly.map((m) => m.amount));
    }, [data]);
    const filteredMaxIncome = useMemo(() => {
        return Math.max(1, ...filteredIncomeMonthly.map((m) => m.amount));
    }, [filteredIncomeMonthly]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] text-slate-600">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Memuat dashboard piutang...
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 text-sm">
                    ❌ Gagal memuat data piutang. Pastikan backend sudah running &amp; schema sudah di-migrate.
                    <br />
                    <code className="text-xs mt-2 block">{(error as any)?.message ?? "no error message"}</code>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Receipt className="h-7 w-7 text-emerald-600" />
                    Dashboard Piutang &amp; Pemasukan
                </h1>
                <p className="text-sm text-slate-600">
                    Rekap semua invoice — siapa belum bayar, berapa lama, &amp; pemasukan dari Cashflow.
                </p>
            </div>

            {/* Date filter — apply ke overdue & income chart */}
            <div className="bg-white border rounded-lg p-3">
                <DateRangeFilter value={dateRange} onChange={setDateRange} />
                <p className="text-[10px] text-slate-500 mt-1.5">
                    💡 Filter ini berlaku untuk <b>tab Overdue</b> &amp; <b>chart Pemasukan</b>. Rekap per-customer (di tab Per Customer) tetap menampilkan semua data karena aggregat per-pelanggan.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard
                    title="Total Piutang"
                    value={fmtShort(data.kpi.totalOutstanding)}
                    fullValue={fmtRp(data.kpi.totalOutstanding)}
                    sub={`${data.kpi.customersWithDebt} customer`}
                    color="amber"
                    icon={<Wallet className="h-5 w-5" />}
                />
                <KpiCard
                    title={hasDateFilter ? "🚨 Overdue (filtered)" : "🚨 Overdue"}
                    value={fmtShort(hasDateFilter ? filteredOverdueTotal : data.kpi.overdueAmount)}
                    fullValue={fmtRp(hasDateFilter ? filteredOverdueTotal : data.kpi.overdueAmount)}
                    sub={`${hasDateFilter ? filteredOverdueInvoices.length : data.kpi.overdueCount} invoice lewat tempo`}
                    color={(hasDateFilter ? filteredOverdueInvoices.length : data.kpi.overdueCount) > 0 ? "red" : "slate"}
                    icon={<AlertTriangle className="h-5 w-5" />}
                />
                <KpiCard
                    title="💰 Pemasukan Bulan Ini"
                    value={fmtShort(data.kpi.totalIncomeMonth)}
                    fullValue={fmtRp(data.kpi.totalIncomeMonth)}
                    sub="dari pembayaran invoice"
                    color="emerald"
                    icon={<ArrowUpRight className="h-5 w-5" />}
                />
                <KpiCard
                    title="📈 Pemasukan YTD"
                    value={fmtShort(data.kpi.totalIncomeYTD)}
                    fullValue={fmtRp(data.kpi.totalIncomeYTD)}
                    sub="tahun berjalan"
                    color="blue"
                    icon={<TrendingUp className="h-5 w-5" />}
                />
            </div>

            {/* Warning banner kalau ada overdue */}
            {data.kpi.overdueCount > 0 && (
                <div className="bg-red-50 border-l-4 border-red-500 rounded p-3 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="font-bold text-red-900 text-sm">
                            ⚠️ Ada {data.kpi.overdueCount} invoice lewat tempo senilai {fmtRp(data.kpi.overdueAmount)}!
                        </h3>
                        <p className="text-xs text-red-700 mt-0.5">
                            Disarankan segera kontak customer atau kirim reminder pembayaran.
                        </p>
                        <button
                            onClick={() => setActiveTab("overdue")}
                            className="text-xs text-red-700 underline hover:text-red-900 mt-1 font-semibold"
                        >
                            Lihat daftar overdue →
                        </button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-slate-200 flex gap-1 overflow-x-auto">
                <TabButton active={activeTab === "customer"} onClick={() => setActiveTab("customer")}>
                    <Users className="h-4 w-4" /> Per Customer ({data.byCustomer.length})
                </TabButton>
                <TabButton active={activeTab === "overdue"} onClick={() => setActiveTab("overdue")}>
                    <AlertTriangle className="h-4 w-4" /> Overdue ({hasDateFilter ? filteredOverdueInvoices.length : data.overdueInvoices.length})
                </TabButton>
                <TabButton active={activeTab === "income"} onClick={() => setActiveTab("income")}>
                    <TrendingUp className="h-4 w-4" /> Pemasukan 12 Bulan
                </TabButton>
            </div>

            {/* TAB: Per Customer */}
            {activeTab === "customer" && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                placeholder="Cari customer (nama / perusahaan / hp)"
                                className="w-full pl-8 pr-3 py-2 text-sm border rounded"
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b text-xs">
                                <tr>
                                    <th className="text-left px-3 py-2 font-semibold text-slate-700">Customer</th>
                                    <th className="text-right px-3 py-2 font-semibold text-slate-700">Total Invoice</th>
                                    <th className="text-right px-3 py-2 font-semibold text-slate-700">Sudah Bayar</th>
                                    <th className="text-right px-3 py-2 font-semibold text-slate-700">Sisa Piutang</th>
                                    <th className="text-center px-3 py-2 font-semibold text-slate-700">Status</th>
                                    <th className="px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-6 text-slate-500 text-xs">
                                        {filter ? "Tidak ada customer cocok dengan filter." : "Belum ada data invoice."}
                                    </td></tr>
                                ) : filteredCustomers.map((c) => {
                                    const sev = customerSeverity(c);
                                    const paidPct = c.totalInvoiced > 0 ? (c.totalPaid / c.totalInvoiced) * 100 : 0;
                                    const customerKey = `${c.customerId ?? c.customerName}`;
                                    const isExpanded = expandedCustomer === customerKey;
                                    return (
                                        <FragmentRows key={customerKey}>
                                        <tr
                                            className="border-b hover:bg-slate-50 cursor-pointer"
                                            onClick={() => setExpandedCustomer(isExpanded ? null : customerKey)}
                                        >
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`} />
                                                    <span className="text-lg">{sev.emoji}</span>
                                                    <div>
                                                        {c.customerId ? (
                                                            <Link href={`/customers/${c.customerId}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-slate-900 hover:text-blue-600 hover:underline">
                                                                {c.customerName}
                                                            </Link>
                                                        ) : (
                                                            <span className="font-semibold text-slate-900">{c.customerName}</span>
                                                        )}
                                                        {c.companyName && (
                                                            <div className="text-[11px] text-slate-500">{c.companyName}</div>
                                                        )}
                                                        {c.phone && (
                                                            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                                <Phone className="h-2.5 w-2.5" /> {c.phone}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="font-mono font-semibold">{fmtShort(c.totalInvoiced)}</div>
                                                <div className="text-[10px] text-slate-500">{c.invoiceCount} invoice</div>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="font-mono text-emerald-700 font-semibold">{fmtShort(c.totalPaid)}</div>
                                                <div className="text-[10px] text-slate-500">{paidPct.toFixed(0)}%</div>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <div className={`font-mono font-bold ${c.sisaTagihan > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                                                    {c.sisaTagihan > 0 ? fmtShort(c.sisaTagihan) : "LUNAS"}
                                                </div>
                                                {c.sisaTagihan > 0 && c.oldestUnpaidDays > 0 && (
                                                    <div className="text-[10px] text-slate-500">
                                                        {c.oldestUnpaidDays} hari sejak invoice terlama
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <div className="inline-flex flex-col gap-0.5">
                                                    {c.overdueCount > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-300 font-semibold">
                                                            🚨 {c.overdueCount} overdue
                                                        </span>
                                                    )}
                                                    {c.partialCount > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300">
                                                            ⏳ {c.partialCount} partial
                                                        </span>
                                                    )}
                                                    {c.unpaidCount > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                                                            📝 {c.unpaidCount} belum bayar
                                                        </span>
                                                    )}
                                                    {c.sisaTagihan === 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-300 font-semibold">
                                                            ✅ Lunas Semua
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <Link
                                                    href={c.customerId ? `/customers/${c.customerId}` : "/penawaran"}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-0.5"
                                                >
                                                    Customer <ChevronRight className="h-3 w-3" />
                                                </Link>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-slate-50/70">
                                                <td colSpan={6} className="px-3 py-2">
                                                    <CustomerInvoices invoiceIds={c.invoiceIds} onOpenDetail={setDetailTargetId} />
                                                </td>
                                            </tr>
                                        )}
                                        </FragmentRows>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB: Overdue */}
            {activeTab === "overdue" && (
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    {filteredOverdueInvoices.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                            <div className="text-4xl mb-2">🎉</div>
                            <div className="font-semibold text-emerald-700">Tidak ada invoice lewat tempo!</div>
                            <div className="text-xs mt-1">Semua piutang masih dalam masa pembayaran.</div>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-red-50 border-b text-xs">
                                <tr>
                                    <th className="text-left px-3 py-2 font-semibold text-red-900">Invoice</th>
                                    <th className="text-left px-3 py-2 font-semibold text-red-900">Customer</th>
                                    <th className="text-right px-3 py-2 font-semibold text-red-900">Sisa Tagihan</th>
                                    <th className="text-center px-3 py-2 font-semibold text-red-900">Jatuh Tempo</th>
                                    <th className="text-center px-3 py-2 font-semibold text-red-900">Telat</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOverdueInvoices.map((inv) => {
                                    const sev = severity(inv.daysOverdue);
                                    return (
                                        <tr key={inv.id} className="border-b hover:bg-red-50/30">
                                            <td className="px-3 py-2">
                                                <button
                                                    onClick={() => setDetailTargetId(inv.id)}
                                                    className="font-mono text-xs text-blue-600 hover:underline font-semibold"
                                                    title="Lihat detail pembayaran"
                                                >
                                                    {inv.invoiceNumber}
                                                </button>
                                                <div className="text-[10px] text-slate-500">{fmtDate(inv.date)}</div>
                                            </td>
                                            <td className="px-3 py-2">
                                                {inv.customerId ? (
                                                    <Link href={`/customers/${inv.customerId}`} className="font-semibold text-slate-900 hover:text-blue-600 hover:underline text-xs">
                                                        {inv.customerName}
                                                    </Link>
                                                ) : (
                                                    <span className="font-semibold text-xs">{inv.customerName}</span>
                                                )}
                                                {inv.companyName && (
                                                    <div className="text-[10px] text-slate-500">{inv.companyName}</div>
                                                )}
                                                {inv.phone && (
                                                    <a
                                                        href={`https://wa.me/${inv.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Halo, mohon konfirmasi pembayaran invoice ${inv.invoiceNumber}`)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10px] text-green-600 hover:underline inline-flex items-center gap-0.5 mt-0.5"
                                                    >
                                                        💬 WA: {inv.phone}
                                                    </a>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="font-mono font-bold text-red-700">{fmtShort(inv.sisa)}</div>
                                                <div className="text-[10px] text-slate-500">dari {fmtShort(inv.amountToPay)}</div>
                                            </td>
                                            <td className="px-3 py-2 text-center text-xs">
                                                {fmtDate(inv.dueDate)}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`inline-block text-[10px] px-2 py-0.5 rounded border font-semibold ${sev.cls}`}>
                                                    {inv.daysOverdue} hari · {sev.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* TAB: Income Chart */}
            {activeTab === "income" && (
                <div className="bg-white rounded-lg shadow-sm border p-4">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                        Pemasukan {hasDateFilter ? `(${filteredIncomeMonthly.length} bulan terfilter)` : "12 Bulan Terakhir"}
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                        Sumber: Cashflow IN kategori &quot;Pembayaran Invoice&quot;. Auto-tercatat saat admin Tandai Lunas.
                    </p>
                    <div className="space-y-1.5">
                        {(hasDateFilter ? filteredIncomeMonthly : data.incomeMonthly).map((m) => {
                            const pct = (m.amount / (hasDateFilter ? filteredMaxIncome : maxIncome)) * 100;
                            return (
                                <div key={m.month} className="flex items-center gap-2 text-xs">
                                    <div className="w-14 text-slate-600 font-semibold text-right flex-shrink-0">
                                        {m.label}
                                    </div>
                                    <div className="flex-1 bg-slate-100 rounded h-6 relative overflow-hidden">
                                        <div
                                            className={`h-full ${m.amount > 0 ? "bg-gradient-to-r from-emerald-400 to-emerald-600" : ""}`}
                                            style={{ width: `${Math.max(pct, 0)}%` }}
                                        />
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-slate-900 mix-blend-difference">
                                            {m.amount > 0 ? fmtShort(m.amount) : "—"}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs">
                        <span className="text-slate-600">
                            Total pemasukan {hasDateFilter ? "(filtered)" : "12 bulan"}:
                        </span>
                        <span className="font-mono font-bold text-emerald-700">
                            {fmtRp(hasDateFilter ? filteredIncomeTotal : data.incomeMonthly.reduce((s, m) => s + m.amount, 0))}
                        </span>
                    </div>
                </div>
            )}

            {/* Modal detail pembayaran — semua cicilan + bukti tf */}
            {detailTargetId && detailInvoice && (
                <PaymentDetailModal
                    invoice={detailInvoice}
                    onClose={() => setDetailTargetId(null)}
                />
            )}
        </div>
    );
}

/** Wrapper untuk render multiple rows dari .map() callback (React.Fragment shortcut tidak boleh punya key di tbody). */
function FragmentRows({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}

/** Sub-table di expand row: list invoice milik 1 customer, clickable buat buka detail pembayaran. */
function CustomerInvoices({ invoiceIds, onOpenDetail }: { invoiceIds: number[]; onOpenDetail: (id: number) => void }) {
    const { data, isLoading } = useQuery<Quotation[]>({
        queryKey: ["customer-invoices", invoiceIds.join(",")],
        queryFn: async () => {
            const results = await Promise.all(invoiceIds.map((id) => getQuotation(id)));
            return results;
        },
        enabled: invoiceIds.length > 0,
        staleTime: 30_000,
    });

    if (isLoading) {
        return (
            <div className="text-xs text-slate-500 py-2 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Memuat invoice...
            </div>
        );
    }

    if (!data || data.length === 0) {
        return <div className="text-xs text-slate-500 py-2 italic">Tidak ada invoice.</div>;
    }

    const STATUS_BADGE: Record<string, string> = {
        PAID: "bg-emerald-100 text-emerald-800",
        PARTIALLY_PAID: "bg-amber-100 text-amber-800",
        SENT: "bg-blue-100 text-blue-800",
        DRAFT: "bg-slate-100 text-slate-700",
        CANCELLED: "bg-red-100 text-red-700",
    };

    return (
        <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-600 uppercase mb-1">Daftar Invoice ({data.length})</div>
            {data.map((inv) => {
                const amountToPay = Number(inv.amountToPay ?? inv.total ?? 0);
                const paidAmount = Number((inv as any).paidAmount ?? 0);
                const sisa = Math.max(0, amountToPay - paidAmount);
                const badgeCls = STATUS_BADGE[inv.status] ?? "bg-slate-100 text-slate-700";
                return (
                    <div key={inv.id} className="bg-white border border-slate-200 rounded p-2 flex items-center justify-between gap-2 text-xs hover:border-emerald-400 transition">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onOpenDetail(inv.id)}
                                    className="font-mono font-bold text-blue-600 hover:underline"
                                >
                                    {inv.invoiceNumber}
                                </button>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded ${badgeCls} font-semibold`}>
                                    {inv.status}
                                </span>
                                {inv.invoicePart && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                        {inv.invoicePart}
                                    </span>
                                )}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                                {fmtDate(inv.date)}
                                {inv.projectName && ` · ${inv.projectName}`}
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <div className="text-[10px] text-slate-500">
                                Total: <span className="font-mono">{fmtShort(amountToPay)}</span>
                            </div>
                            <div className="text-[10px] text-emerald-700 font-semibold">
                                Bayar: <span className="font-mono">{fmtShort(paidAmount)}</span>
                            </div>
                            {sisa > 0 && (
                                <div className="text-[10px] text-amber-700 font-bold">
                                    Sisa: <span className="font-mono">{fmtShort(sisa)}</span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => onOpenDetail(inv.id)}
                            className="text-[10px] px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded font-semibold whitespace-nowrap"
                            title="Lihat semua cicilan + bukti transfer"
                        >
                            🧾 Detail
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

function KpiCard({ title, value, fullValue, sub, color, icon }: {
    title: string;
    value: string;
    fullValue: string;
    sub: string;
    color: "amber" | "red" | "emerald" | "blue" | "slate";
    icon: React.ReactNode;
}) {
    const colorMap = {
        amber: "bg-amber-50 border-amber-200 text-amber-900",
        red: "bg-red-50 border-red-300 text-red-900",
        emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
        blue: "bg-blue-50 border-blue-200 text-blue-900",
        slate: "bg-slate-50 border-slate-200 text-slate-900",
    };
    const iconColorMap = {
        amber: "text-amber-600",
        red: "text-red-600",
        emerald: "text-emerald-600",
        blue: "text-blue-600",
        slate: "text-slate-600",
    };
    return (
        <div className={`rounded-lg border p-3 ${colorMap[color]}`} title={fullValue}>
            <div className="flex items-start justify-between mb-1">
                <div className="text-[10px] font-semibold uppercase tracking-wide opacity-75">{title}</div>
                <span className={iconColorMap[color]}>{icon}</span>
            </div>
            <div className="text-xl font-bold font-mono">{value}</div>
            <div className="text-[10px] opacity-70 mt-0.5">{sub}</div>
        </div>
    );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition whitespace-nowrap ${active
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
        >
            {children}
        </button>
    );
}
