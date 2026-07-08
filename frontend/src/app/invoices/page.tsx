"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
    AlertTriangle, ArrowUpRight, Loader2, Phone, Search,
    TrendingUp, Users, Wallet, Receipt, AlertCircle, ChevronRight,
    ExternalLink, Edit3, CheckCircle2, MapPin, TrendingDown,
    MessageCircle, CalendarDays, User, Clock, FileText, Info,
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

/** Tanggal tempo terdekat (paling awal) dari invoice yang masih ada sisa tagihan. */
function nearestUnpaidDue(
    invoices: Array<{ dueDate: string | null; dueDateEnd: string | null; sisa: number }>,
): string | null {
    let nearestMs: number | null = null;
    let nearestStr: string | null = null;
    for (const iv of invoices) {
        if (iv.sisa <= 0) continue;
        const eff = iv.dueDateEnd ?? iv.dueDate;
        if (!eff) continue;
        const t = new Date(eff).getTime();
        if (nearestMs === null || t < nearestMs) {
            nearestMs = t;
            nearestStr = eff;
        }
    }
    return nearestStr;
}

/** Badge tanggal jatuh tempo — warna berubah kalau sudah/hampir lewat tempo. */
function DueBadge({ date }: { date: string | null }) {
    if (!date) return <span className="text-muted-foreground">—</span>;
    const ms = new Date(date).getTime();
    const days = Math.floor((ms - Date.now()) / (1000 * 60 * 60 * 24));
    let cls = "text-muted-foreground";
    let note = "";
    if (days < 0) { cls = "text-destructive font-bold"; note = `telat ${-days}h`; }
    else if (days <= 7) { cls = "text-warning font-semibold"; note = `${days}h lagi`; }
    return (
        <span className={`text-xs ${cls}`}>
            {fmtDate(date)}
            {note && <span className="block text-[9px] font-normal">{note}</span>}
        </span>
    );
}

function severity(days: number) {
    if (days <= 7) return { cls: "bg-warning/15 text-warning border-warning/30", label: "Hampir Tempo" };
    if (days <= 30) return { cls: "bg-warning/15 text-warning border-warning/30", label: "Lewat Tempo" };
    if (days <= 90) return { cls: "bg-destructive/12 text-destructive border-destructive/30", label: "Telat Berat" };
    return { cls: "bg-destructive/20 text-destructive border-destructive/50 font-bold", label: "Macet" };
}

function customerSeverity(c: ReceivablesDashboard["byCustomer"][number]) {
    if (c.sisaTagihan === 0) return { cls: "text-success", icon: <CheckCircle2 className="h-4 w-4" /> };
    if (c.overdueCount > 0) return { cls: "text-destructive", icon: <AlertTriangle className="h-4 w-4" /> };
    if (c.oldestUnpaidDays > 60) return { cls: "text-warning", icon: <AlertTriangle className="h-4 w-4" /> };
    if (c.oldestUnpaidDays > 30) return { cls: "text-warning", icon: <Clock className="h-4 w-4" /> };
    return { cls: "text-foreground", icon: <FileText className="h-4 w-4" /> };
}

export default function InvoicesPiutangPage() {
    const [filter, setFilter] = useState("");
    const [activeTab, setActiveTab] = useState<"event" | "customer" | "overdue" | "income">("event");
    const [expandedQuotation, setExpandedQuotation] = useState<number | null>(null);
    const [detailTargetId, setDetailTargetId] = useState<number | null>(null);
    const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRange>({ preset: "ALL" });

    // Compute date filter window
    const { from: rangeFrom, to: rangeTo } = useMemo(
        () => presetToRange(dateRange.preset, { from: dateRange.fromDate, to: dateRange.toDate }),
        [dateRange]
    );
    const hasDateFilter = !!(rangeFrom || rangeTo);

    // Pass date range to backend supaya semua aggregat (per-customer, overdue, income) ikut filter.
    const fromStr = rangeFrom ? rangeFrom.toISOString().slice(0, 10) : undefined;
    const toStr = rangeTo ? rangeTo.toISOString().slice(0, 10) : undefined;

    const { data, isLoading, error } = useQuery({
        queryKey: ["receivables-dashboard", fromStr, toStr],
        queryFn: () => getReceivablesDashboard({ from: fromStr, to: toStr }),
        staleTime: 30_000,
    });

    // Backend sudah re-aggregat data sesuai filter — pakai langsung.
    const filteredOverdueInvoices = data?.overdueInvoices ?? [];
    const filteredIncomeMonthly = data?.incomeMonthly ?? [];
    const filteredIncomeTotal = useMemo(
        () => filteredIncomeMonthly.reduce((s, m) => s + m.amount, 0),
        [filteredIncomeMonthly]
    );
    const filteredOverdueTotal = data?.kpi?.overdueAmount ?? 0;

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
            <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Memuat dashboard piutang...
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6">
                <div className="bg-destructive/12 border border-destructive/30 rounded p-4 text-destructive text-sm">
                    Gagal memuat data piutang. Pastikan backend sudah running &amp; schema sudah di-migrate.
                    <br />
                    <code className="text-xs mt-2 block">{(error as any)?.message ?? "no error message"}</code>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Receipt className="h-7 w-7 text-primary" />
                    Dashboard Piutang &amp; Pemasukan
                </h1>
                <p className="text-sm text-muted-foreground">
                    Rekap semua invoice — siapa belum bayar, berapa lama, &amp; pemasukan dari Cashflow.
                </p>
            </div>

            {/* Date filter — berlaku untuk SEMUA section (KPI, per-customer, overdue, income).
                Backend re-aggregat data sesuai range yang dipilih. */}
            <div className="glass rounded-xl p-3">
                <DateRangeFilter value={dateRange} onChange={setDateRange} />
                {hasDateFilter && (
                    <p className="text-[10px] text-success font-semibold mt-1.5 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                        Filter aktif — semua section (KPI, per-customer, overdue, income) menampilkan data dalam rentang yang dipilih.
                    </p>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard
                    title={hasDateFilter ? "Piutang (filtered)" : "Total Piutang"}
                    value={fmtShort(data.kpi.totalOutstanding)}
                    fullValue={fmtRp(data.kpi.totalOutstanding)}
                    sub={`${data.kpi.customersWithDebt} customer`}
                    color="amber"
                    icon={<Wallet className="h-5 w-5" />}
                />
                <KpiCard
                    title={hasDateFilter ? "Overdue (filtered)" : "Overdue"}
                    value={fmtShort(data.kpi.overdueAmount)}
                    fullValue={fmtRp(data.kpi.overdueAmount)}
                    sub={`${data.kpi.overdueCount} invoice lewat tempo`}
                    color={data.kpi.overdueCount > 0 ? "red" : "slate"}
                    icon={<AlertTriangle className="h-5 w-5" />}
                />
                <KpiCard
                    title={hasDateFilter ? "Pemasukan (filtered)" : "Pemasukan Bulan Ini"}
                    value={fmtShort(data.kpi.totalIncomeMonth)}
                    fullValue={fmtRp(data.kpi.totalIncomeMonth)}
                    sub={hasDateFilter ? "dalam rentang filter" : "dari pembayaran invoice"}
                    color="emerald"
                    icon={<ArrowUpRight className="h-5 w-5" />}
                />
                <KpiCard
                    title={hasDateFilter ? "Total dalam rentang" : "Pemasukan YTD"}
                    value={fmtShort(data.kpi.totalIncomeYTD)}
                    fullValue={fmtRp(data.kpi.totalIncomeYTD)}
                    sub={hasDateFilter ? "akumulasi pemasukan" : "tahun berjalan"}
                    color="blue"
                    icon={<TrendingUp className="h-5 w-5" />}
                />
            </div>

            {/* PPh tracking banner — untuk laporan pajak owner */}
            {(data.kpi.totalPphPotongan ?? 0) > 0 && (
                <div className="bg-destructive/8 border-l-4 border-destructive rounded p-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div>
                        <div className="text-[10px] text-destructive uppercase font-bold tracking-wide flex items-center gap-1"><Wallet className="h-3 w-3" /> Gross Sebelum PPh</div>
                        <div className="text-base font-bold text-foreground font-mono nums">{fmtRp(data.kpi.totalGrossBeforePph ?? 0)}</div>
                        <div className="text-[10px] text-destructive">Nilai invoice sebelum PPh dipotong klien</div>
                    </div>
                    <div className="md:border-x md:border-destructive/20 md:px-3">
                        <div className="text-[10px] text-destructive uppercase font-bold tracking-wide flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Total PPh Dipotong</div>
                        <div className="text-base font-bold text-foreground font-mono nums">- {fmtRp(data.kpi.totalPphPotongan ?? 0)}</div>
                        <div className="text-[10px] text-destructive">Klien sudah potong, jadi pajak vendor</div>
                    </div>
                    <div>
                        <div className="text-[10px] text-success uppercase font-bold tracking-wide flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Net Diterima (Piutang)</div>
                        <div className="text-base font-bold text-success font-mono nums">{fmtRp((data.kpi.totalGrossBeforePph ?? 0) - (data.kpi.totalPphPotongan ?? 0))}</div>
                        <div className="text-[10px] text-success">Yang masuk ke kas vendor</div>
                    </div>
                </div>
            )}

            {/* Warning banner kalau ada overdue */}
            {data.kpi.overdueCount > 0 && (
                <div className="bg-destructive/8 border-l-4 border-destructive rounded p-3 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="font-bold text-destructive text-sm">
                            Ada {data.kpi.overdueCount} invoice lewat tempo senilai {fmtRp(data.kpi.overdueAmount)}!
                        </h3>
                        <p className="text-xs text-destructive mt-0.5">
                            Disarankan segera kontak customer atau kirim reminder pembayaran.
                        </p>
                        <button
                            onClick={() => setActiveTab("overdue")}
                            className="text-xs text-destructive underline hover:opacity-80 mt-1 font-semibold cursor-pointer transition-colors"
                        >
                            Lihat daftar overdue →
                        </button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-border flex gap-1 overflow-x-auto">
                <TabButton active={activeTab === "event"} onClick={() => setActiveTab("event")}>
                    <CalendarDays className="h-4 w-4" /> Per Event/Penawaran ({data.byQuotation?.length ?? 0})
                </TabButton>
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

            {/* TAB: Per Event/Penawaran — group invoice by parent quotation */}
            {activeTab === "event" && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Info className="h-3.5 w-3.5 flex-shrink-0" />
                        <span><b>Tip:</b> 1 baris = 1 event/penawaran. Klik baris untuk expand list invoice (DP1, DP2, Pelunasan, dll) dengan status masing-masing.</span>
                    </div>
                    {(data.byQuotation ?? []).length === 0 ? (
                        <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                            Belum ada Penawaran dengan invoice yang ter-generate.
                        </div>
                    ) : (
                        <div className="glass rounded-xl overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 border-b text-xs">
                                    <tr>
                                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Event / Penawaran</th>
                                        <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Invoice</th>
                                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Total Tagihan</th>
                                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Terbayar</th>
                                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Sisa</th>
                                        <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Jatuh Tempo</th>
                                        <th className="px-3 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data.byQuotation ?? []).map((q) => {
                                        const isExpanded = expandedQuotation === q.quotationId;
                                        const paidPct = q.totalInvoiced > 0 ? (q.totalPaid / q.totalInvoiced) * 100 : 0;
                                        const hasOverdue = q.invoices.some((iv) => iv.isOverdue);
                                        return (
                                            <FragmentRows key={q.quotationId}>
                                                <tr
                                                    className={`border-b hover:bg-muted/40 cursor-pointer transition-colors ${hasOverdue ? "bg-destructive/8" : ""}`}
                                                    onClick={() => setExpandedQuotation(isExpanded ? null : q.quotationId)}
                                                >
                                                    <td className="px-3 py-2">
                                                        <div className="flex items-center gap-2">
                                                            <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`} />
                                                            {hasOverdue
                                                                ? <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                                                                : <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />}

                                                            <div className="flex-1 min-w-0">
                                                                <Link
                                                                    href={`/penawaran/${q.quotationId}`}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="font-semibold text-info hover:underline text-xs font-mono block truncate"
                                                                >
                                                                    {q.quotationNumber}
                                                                </Link>
                                                                {q.projectName && (
                                                                    <div className="text-[11px] text-foreground font-semibold truncate">{q.projectName}</div>
                                                                )}
                                                                <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                                                                    <User className="h-3 w-3 flex-shrink-0" /> {q.customerName}{q.companyName ? ` · ${q.companyName}` : ""}
                                                                </div>
                                                                {q.eventLocation && (
                                                                    <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1"><MapPin className="h-3 w-3 flex-shrink-0" /> {q.eventLocation}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-info/15 text-info border border-info/30 font-semibold">
                                                            {q.invoiceCount} invoice
                                                        </span>
                                                        {hasOverdue && (
                                                            <div className="text-[9px] text-destructive font-bold mt-0.5 flex items-center gap-0.5"><AlertTriangle className="h-2.5 w-2.5" /> Ada overdue</div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <div className="font-mono font-semibold nums">{fmtShort(q.totalInvoiced)}</div>
                                                        <div className="text-[10px] text-muted-foreground">Quotation: {fmtShort(q.quotationTotal)}</div>
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <div className="font-mono text-success font-semibold nums">{fmtShort(q.totalPaid)}</div>
                                                        <div className="text-[10px] text-muted-foreground">{paidPct.toFixed(0)}% dari tagihan</div>
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <div className={`font-mono font-bold nums ${q.sisaTagihan > 0 ? "text-warning" : "text-success"}`}>
                                                            {q.sisaTagihan > 0 ? fmtShort(q.sisaTagihan) : <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> LUNAS</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        {q.sisaTagihan > 0
                                                            ? <DueBadge date={nearestUnpaidDue(q.invoices)} />
                                                            : <span className="text-muted-foreground">—</span>}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <Link
                                                            href={`/penawaran/${q.quotationId}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="text-[11px] text-info hover:underline inline-flex items-center gap-0.5"
                                                        >
                                                            Detail <ChevronRight className="h-3 w-3" />
                                                        </Link>
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-muted/30">
                                                        <td colSpan={7} className="px-3 py-2">
                                                            <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">
                                                                Breakdown Invoice ({q.invoices.length}):
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                {q.invoices.map((iv) => {
                                                                    const STATUS_CLS: Record<string, string> = {
                                                                        PAID: "bg-success/15 text-success",
                                                                        PARTIALLY_PAID: "bg-warning/15 text-warning",
                                                                        SENT: "bg-info/15 text-info",
                                                                        DRAFT: "bg-muted text-muted-foreground",
                                                                        CANCELLED: "bg-destructive/12 text-destructive",
                                                                    };
                                                                    return (
                                                                        <div key={iv.id} className={`bg-card border rounded p-2 flex items-center justify-between gap-2 text-xs ${iv.isOverdue ? "border-destructive/30 bg-destructive/8" : "border-border"}`}>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                                    <Link href={`/penawaran/${iv.id}`} className="font-mono font-bold text-info hover:underline">
                                                                                        {iv.invoiceNumber}
                                                                                    </Link>
                                                                                    {iv.invoicePart && (
                                                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-info/15 text-info border border-info/30 font-bold">
                                                                                            {iv.invoicePart === "DP" ? "Down Payment" :
                                                                                             iv.invoicePart === "PELUNASAN" ? "Final Payment" :
                                                                                             iv.invoicePart === "FULL" ? "Full Payment" : iv.invoicePart}
                                                                                        </span>
                                                                                    )}
                                                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${STATUS_CLS[iv.status] ?? "bg-muted text-muted-foreground"} font-semibold`}>
                                                                                        {iv.status}
                                                                                    </span>
                                                                                    {iv.isOverdue && (
                                                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/12 text-destructive border border-destructive/30 font-bold inline-flex items-center gap-0.5">
                                                                                            <AlertTriangle className="h-2.5 w-2.5" /> Telat {iv.daysOverdue}h
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                                                                    Terbit: {fmtDate(iv.date)}
                                                                                    {iv.dueDate && ` · Tempo: ${fmtDate(iv.dueDate)}${iv.dueDateEnd ? ` - ${fmtDate(iv.dueDateEnd)}` : ""}`}
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-right flex-shrink-0">
                                                                                <div className="text-[10px] text-muted-foreground">
                                                                                    Tagih: <span className="font-mono nums">{fmtShort(iv.amountToPay)}</span>
                                                                                </div>
                                                                                <div className="text-[10px] text-success font-semibold">
                                                                                    Bayar: <span className="font-mono nums">{fmtShort(iv.paidAmount)}</span>
                                                                                </div>
                                                                                {iv.sisa > 0 && (
                                                                                    <div className="text-[10px] text-warning font-bold">
                                                                                        Sisa: <span className="font-mono nums">{fmtShort(iv.sisa)}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-1">
                                                                                <button
                                                                                    onClick={() => setDetailTargetId(iv.id)}
                                                                                    className="p-1 rounded text-success hover:bg-success/10 border border-success/30 cursor-pointer transition-colors"
                                                                                    title="Lihat detail pembayaran"
                                                                                >
                                                                                    <Receipt className="h-3.5 w-3.5" />
                                                                                </button>
                                                                                <Link
                                                                                    href={`/penawaran/${iv.id}`}
                                                                                    className="p-1 rounded text-info hover:bg-info/10 border border-info/30 transition-colors"
                                                                                    title="Buka invoice"
                                                                                >
                                                                                    <Edit3 className="h-3.5 w-3.5" />
                                                                                </Link>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </FragmentRows>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Per Customer */}
            {activeTab === "customer" && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                placeholder="Cari customer (nama / perusahaan / hp)"
                                className="w-full pl-8 pr-3 py-2 text-sm border rounded"
                            />
                        </div>
                    </div>

                    <div className="glass rounded-xl overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b text-xs">
                                <tr>
                                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Customer</th>
                                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Total Invoice</th>
                                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Sudah Bayar</th>
                                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Sisa Piutang</th>
                                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Jatuh Tempo</th>
                                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Status</th>
                                    <th className="px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-6 text-muted-foreground text-xs">
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
                                            className="border-b hover:bg-muted/40 cursor-pointer transition-colors"
                                            onClick={() => setExpandedCustomer(isExpanded ? null : customerKey)}
                                        >
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`} />
                                                    <span className={sev.cls}>{sev.icon}</span>
                                                    <div>
                                                        {c.customerId ? (
                                                            <Link href={`/customers/${c.customerId}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-foreground hover:text-info hover:underline">
                                                                {c.customerName}
                                                            </Link>
                                                        ) : (
                                                            <span className="font-semibold text-foreground">{c.customerName}</span>
                                                        )}
                                                        {c.companyName && (
                                                            <div className="text-[11px] text-muted-foreground">{c.companyName}</div>
                                                        )}
                                                        {c.phone && (
                                                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                <Phone className="h-2.5 w-2.5" /> {c.phone}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="font-mono font-semibold nums">{fmtShort(c.totalInvoiced)}</div>
                                                <div className="text-[10px] text-muted-foreground">{c.invoiceCount} invoice</div>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="font-mono text-success font-semibold nums">{fmtShort(c.totalPaid)}</div>
                                                <div className="text-[10px] text-muted-foreground">{paidPct.toFixed(0)}%</div>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <div className={`font-mono font-bold nums ${c.sisaTagihan > 0 ? "text-warning" : "text-success"}`}>
                                                    {c.sisaTagihan > 0 ? fmtShort(c.sisaTagihan) : "LUNAS"}
                                                </div>
                                                {c.sisaTagihan > 0 && c.oldestUnpaidDays > 0 && (
                                                    <div className="text-[10px] text-muted-foreground">
                                                        {c.oldestUnpaidDays} hari sejak invoice terlama
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {c.sisaTagihan > 0
                                                    ? <DueBadge date={c.nearestUnpaidDueDate} />
                                                    : <span className="text-muted-foreground">—</span>}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <div className="inline-flex flex-col gap-0.5">
                                                    {c.overdueCount > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/12 text-destructive border border-destructive/30 font-semibold inline-flex items-center gap-0.5">
                                                            <AlertTriangle className="h-2.5 w-2.5" /> {c.overdueCount} overdue
                                                        </span>
                                                    )}
                                                    {c.partialCount > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/30 inline-flex items-center gap-0.5">
                                                            <Clock className="h-2.5 w-2.5" /> {c.partialCount} partial
                                                        </span>
                                                    )}
                                                    {c.unpaidCount > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border inline-flex items-center gap-0.5">
                                                            <FileText className="h-2.5 w-2.5" /> {c.unpaidCount} belum bayar
                                                        </span>
                                                    )}
                                                    {c.sisaTagihan === 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success border border-success/30 font-semibold inline-flex items-center gap-0.5">
                                                            <CheckCircle2 className="h-2.5 w-2.5" /> Lunas Semua
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <Link
                                                    href={c.customerId ? `/customers/${c.customerId}` : "/penawaran"}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-[11px] text-info hover:underline inline-flex items-center gap-0.5"
                                                >
                                                    Customer <ChevronRight className="h-3 w-3" />
                                                </Link>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-muted/30">
                                                <td colSpan={7} className="px-3 py-2">
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
                <div className="glass rounded-xl overflow-hidden">
                    {filteredOverdueInvoices.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-success" />
                            <div className="font-semibold text-success">Tidak ada invoice lewat tempo!</div>
                            <div className="text-xs mt-1">Semua piutang masih dalam masa pembayaran.</div>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-destructive/8 border-b text-xs">
                                <tr>
                                    <th className="text-left px-3 py-2 font-semibold text-destructive">Invoice</th>
                                    <th className="text-left px-3 py-2 font-semibold text-destructive">Customer</th>
                                    <th className="text-right px-3 py-2 font-semibold text-destructive">Sisa Tagihan</th>
                                    <th className="text-center px-3 py-2 font-semibold text-destructive">Jatuh Tempo</th>
                                    <th className="text-center px-3 py-2 font-semibold text-destructive">Telat</th>
                                    <th className="text-center px-3 py-2 font-semibold text-destructive">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOverdueInvoices.map((inv) => {
                                    const sev = severity(inv.daysOverdue);
                                    return (
                                        <tr key={inv.id} className="border-b hover:bg-destructive/8 transition-colors">
                                            <td className="px-3 py-2">
                                                <button
                                                    onClick={() => setDetailTargetId(inv.id)}
                                                    className="font-mono text-xs text-info hover:underline font-semibold cursor-pointer"
                                                    title="Lihat detail pembayaran"
                                                >
                                                    {inv.invoiceNumber}
                                                </button>
                                                <div className="text-[10px] text-muted-foreground">Terbit: {fmtDate(inv.date)}</div>
                                            </td>
                                            <td className="px-3 py-2">
                                                {inv.customerId ? (
                                                    <Link href={`/customers/${inv.customerId}`} className="font-semibold text-foreground hover:text-info hover:underline text-xs">
                                                        {inv.customerName}
                                                    </Link>
                                                ) : (
                                                    <span className="font-semibold text-xs">{inv.customerName}</span>
                                                )}
                                                {inv.companyName && (
                                                    <div className="text-[10px] text-muted-foreground">{inv.companyName}</div>
                                                )}
                                                {inv.phone && (
                                                    <a
                                                        href={`https://wa.me/${inv.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Halo, mohon konfirmasi pembayaran invoice ${inv.invoiceNumber}`)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10px] text-success hover:underline inline-flex items-center gap-0.5 mt-0.5"
                                                    >
                                                        <MessageCircle className="h-2.5 w-2.5" /> WA: {inv.phone}
                                                    </a>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="font-mono font-bold text-destructive nums">{fmtShort(inv.sisa)}</div>
                                                <div className="text-[10px] text-muted-foreground">dari {fmtShort(inv.amountToPay)}</div>
                                            </td>
                                            <td className="px-3 py-2 text-center text-xs">
                                                {inv.dueDateEnd ? (
                                                    <>
                                                        <div>{fmtDate(inv.dueDate)}</div>
                                                        <div className="text-[10px] text-muted-foreground">— s.d. —</div>
                                                        <div>{fmtDate(inv.dueDateEnd)}</div>
                                                    </>
                                                ) : (
                                                    fmtDate(inv.dueDate)
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`inline-block text-[10px] px-2 py-0.5 rounded border font-semibold ${sev.cls}`}>
                                                    {inv.daysOverdue} hari · {sev.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <div className="inline-flex items-center gap-1">
                                                    {/* Warning icon — overdue → buka invoice untuk extend dueDate */}
                                                    <Link
                                                        href={`/penawaran/${inv.id}`}
                                                        title="Overdue! Klik untuk perpanjang jatuh tempo (klien belum bayar)"
                                                        className="p-1.5 rounded-full bg-destructive/12 hover:bg-destructive/20 text-destructive border border-destructive/30 transition animate-pulse"
                                                    >
                                                        <AlertTriangle className="h-3.5 w-3.5" />
                                                    </Link>
                                                    {/* Tombol Buka Invoice */}
                                                    <Link
                                                        href={`/penawaran/${inv.id}`}
                                                        title="Buka invoice di tab baru"
                                                        className="inline-flex items-center gap-0.5 text-[10px] px-2 py-1 rounded bg-info/15 hover:bg-info/20 text-info border border-info/30 font-semibold transition-colors"
                                                    >
                                                        <Edit3 className="h-3 w-3" /> Edit
                                                    </Link>
                                                    {/* Tombol Detail Pembayaran */}
                                                    <button
                                                        onClick={() => setDetailTargetId(inv.id)}
                                                        title="Lihat detail pembayaran"
                                                        className="p-1.5 rounded text-success hover:bg-success/10 border border-success/30 cursor-pointer transition-colors"
                                                    >
                                                        <Receipt className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
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
                <div className="glass rounded-xl p-4">
                    <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-success" />
                        Pemasukan {hasDateFilter ? `(${filteredIncomeMonthly.length} bulan terfilter)` : "12 Bulan Terakhir"}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                        Sumber: Cashflow IN kategori &quot;Pembayaran Invoice&quot;. Auto-tercatat saat admin Tandai Lunas.
                    </p>
                    <div className="space-y-1.5">
                        {(hasDateFilter ? filteredIncomeMonthly : data.incomeMonthly).map((m) => {
                            const pct = (m.amount / (hasDateFilter ? filteredMaxIncome : maxIncome)) * 100;
                            return (
                                <div key={m.month} className="flex items-center gap-2 text-xs">
                                    <div className="w-14 text-muted-foreground font-semibold text-right flex-shrink-0">
                                        {m.label}
                                    </div>
                                    <div className="flex-1 bg-muted rounded h-6 relative overflow-hidden">
                                        <div
                                            className={`h-full ${m.amount > 0 ? "bg-gradient-to-r from-emerald-400 to-emerald-600" : ""}`}
                                            style={{ width: `${Math.max(pct, 0)}%` }}
                                        />
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold nums text-foreground mix-blend-difference">
                                            {m.amount > 0 ? fmtShort(m.amount) : "—"}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                            Total pemasukan {hasDateFilter ? "(filtered)" : "12 bulan"}:
                        </span>
                        <span className="font-mono font-bold nums text-success">
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
            <div className="text-xs text-muted-foreground py-2 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Memuat invoice...
            </div>
        );
    }

    if (!data || data.length === 0) {
        return <div className="text-xs text-muted-foreground py-2 italic">Tidak ada invoice.</div>;
    }

    const STATUS_BADGE: Record<string, string> = {
        PAID: "bg-success/15 text-success",
        PARTIALLY_PAID: "bg-warning/15 text-warning",
        SENT: "bg-info/15 text-info",
        DRAFT: "bg-muted text-muted-foreground",
        CANCELLED: "bg-destructive/12 text-destructive",
    };

    return (
        <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Daftar Invoice ({data.length})</div>
            {data.map((inv) => {
                const amountToPay = Number(inv.amountToPay ?? inv.total ?? 0);
                const paidAmount = Number((inv as any).paidAmount ?? 0);
                const sisa = Math.max(0, amountToPay - paidAmount);
                const badgeCls = STATUS_BADGE[inv.status] ?? "bg-muted text-muted-foreground";
                return (
                    <div key={inv.id} className="bg-card border border-border rounded p-2 flex items-center justify-between gap-2 text-xs hover:border-success transition-colors">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onOpenDetail(inv.id)}
                                    className="font-mono font-bold text-info hover:underline cursor-pointer"
                                >
                                    {inv.invoiceNumber}
                                </button>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded ${badgeCls} font-semibold`}>
                                    {inv.status}
                                </span>
                                {inv.invoicePart && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-info/15 text-info border border-info/30">
                                        {inv.invoicePart}
                                    </span>
                                )}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                                Terbit: {fmtDate(inv.date)}
                                {inv.projectName && ` · ${inv.projectName}`}
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <div className="text-[10px] text-muted-foreground">
                                Total: <span className="font-mono nums">{fmtShort(amountToPay)}</span>
                            </div>
                            <div className="text-[10px] text-success font-semibold">
                                Bayar: <span className="font-mono nums">{fmtShort(paidAmount)}</span>
                            </div>
                            {sisa > 0 && (
                                <div className="text-[10px] text-warning font-bold">
                                    Sisa: <span className="font-mono nums">{fmtShort(sisa)}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => onOpenDetail(inv.id)}
                                className="text-[10px] px-2 py-1 bg-success/10 hover:bg-success/20 text-success border border-success/30 rounded font-semibold whitespace-nowrap inline-flex items-center gap-0.5 cursor-pointer transition-colors"
                                title="Lihat semua cicilan + bukti transfer"
                            >
                                <Receipt className="h-3 w-3" /> Detail
                            </button>
                            <Link
                                href={`/penawaran/${inv.id}`}
                                className="text-[10px] px-2 py-1 bg-info/15 hover:bg-info/20 text-info border border-info/30 rounded font-semibold whitespace-nowrap inline-flex items-center gap-0.5 transition-colors"
                                title="Buka invoice (edit, extend dueDate, dll)"
                            >
                                <ExternalLink className="h-3 w-3" /> Buka
                            </Link>
                        </div>
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
        amber: "bg-warning/15 border-warning/30 text-warning",
        red: "bg-destructive/12 border-destructive/30 text-destructive",
        emerald: "bg-success/15 border-success/30 text-success",
        blue: "bg-info/15 border-info/30 text-info",
        slate: "bg-muted border-border text-foreground",
    };
    const iconColorMap = {
        amber: "text-warning",
        red: "text-destructive",
        emerald: "text-success",
        blue: "text-info",
        slate: "text-muted-foreground",
    };
    return (
        <div className={`glass rounded-xl border p-3 ${colorMap[color]}`} title={fullValue}>
            <div className="flex items-start justify-between mb-1">
                <div className="text-[10px] font-semibold uppercase tracking-wide opacity-75">{title}</div>
                <span className={iconColorMap[color]}>{icon}</span>
            </div>
            <div className="text-xl font-bold font-mono nums">{value}</div>
            <div className="text-[10px] opacity-70 mt-0.5">{sub}</div>
        </div>
    );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
        >
            {children}
        </button>
    );
}
