"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getCustomersWithStats, getCustomerAnalytics, getCustomersExportData,
    createCustomer, updateCustomer, deleteCustomer,
} from "@/lib/api";
import { exportToExcel, exportToPDF } from "@/lib/export";
import { useState } from "react";
import {
    Plus, Edit2, Trash2, Search, X, Users, TrendingUp, Wallet,
    Phone, MapPin, BarChart2, FileSpreadsheet, FileText, MessageCircle,
    ShoppingBag, Calendar, ChevronRight, Loader2, Package,
} from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/id";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    AreaChart, Area, CartesianGrid,
} from "recharts";
dayjs.locale("id");

// ─── Analytics Modal ──────────────────────────────────────────────────────────

function AnalyticsModal({ customerId, onClose }: { customerId: number; onClose: () => void }) {
    const { data, isLoading } = useQuery({
        queryKey: ["customer-analytics", customerId],
        queryFn: () => getCustomerAnalytics(customerId),
    });

    const STATUS_LABEL: Record<string, string> = { PAID: "Lunas", PARTIAL: "DP", PENDING: "Pending", FAILED: "Gagal" };
    const STATUS_CLS: Record<string, string> = {
        PAID: "bg-emerald-100 text-emerald-700",
        PARTIAL: "bg-amber-100 text-amber-700",
        PENDING: "bg-muted text-muted-foreground",
        FAILED: "bg-destructive/10 text-destructive",
    };

    const avgOrder = data && data.totalOrders > 0 ? data.totalRevenue / data.totalOrders : 0;

    const waLink = data?.customer?.phone
        ? `https://wa.me/${data.customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
            `Halo ${data.customer.name}, kami dari toko kami ingin menginformasikan promo & produk terbaru untuk Anda. Terima kasih sudah menjadi pelanggan setia kami! 🙏`
        )}`
        : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-background/95 backdrop-blur-sm flex items-center justify-between p-5 border-b border-border z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg leading-tight">{data?.customer?.name ?? "Memuat..."}</h2>
                            <p className="text-xs text-muted-foreground">Analitik Pelanggan</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {waLink && (
                            <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
                            >
                                <MessageCircle className="w-3.5 h-3.5" /> WA Blast
                            </a>
                        )}
                        <button onClick={onClose} className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : data ? (
                    <div className="p-5 space-y-6">
                        {/* Customer Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                            {data.customer.phone && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Phone className="w-4 h-4 shrink-0" />
                                    <span>{data.customer.phone}</span>
                                </div>
                            )}
                            {data.customer.address && (
                                <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
                                    <MapPin className="w-4 h-4 shrink-0" />
                                    <span className="truncate">{data.customer.address}</span>
                                </div>
                            )}
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: "Total Order", value: `${data.totalOrders}x`, icon: ShoppingBag, cls: "text-primary bg-primary/10" },
                                { label: "Total Pendapatan", value: `Rp ${data.totalRevenue.toLocaleString("id-ID")}`, icon: Wallet, cls: "text-emerald-600 bg-emerald-100" },
                                { label: "Rata-rata Order", value: `Rp ${Math.round(avgOrder).toLocaleString("id-ID")}`, icon: TrendingUp, cls: "text-amber-600 bg-amber-100" },
                                {
                                    label: "Terakhir Order",
                                    value: data.lastOrderDate ? dayjs(data.lastOrderDate).format("DD MMM YYYY") : "–",
                                    icon: Calendar,
                                    cls: "text-violet-600 bg-violet-100"
                                },
                            ].map(s => (
                                <div key={s.label} className="rounded-xl border border-border p-3 space-y-2">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.cls}`}>
                                        <s.icon className="w-4 h-4" />
                                    </div>
                                    <p className="text-xs text-muted-foreground">{s.label}</p>
                                    <p className="text-sm font-bold leading-tight break-words">{s.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Charts */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Top Products */}
                            <div className="rounded-xl border border-border p-4">
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Package className="w-4 h-4 text-muted-foreground" /> Produk Sering Dipesan
                                </h3>
                                {data.topProducts.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={180}>
                                        <BarChart
                                            data={data.topProducts}
                                            layout="vertical"
                                            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                                        >
                                            <XAxis type="number" hide />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                width={90}
                                                tick={{ fontSize: 10, fill: "#6b7280" }}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <Tooltip
                                                formatter={(v: any) => [`${v}x`, "Qty"]}
                                                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: 12 }}
                                            />
                                            <Bar dataKey="qty" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">
                                        Belum ada data produk.
                                    </div>
                                )}
                            </div>

                            {/* Monthly Spend */}
                            <div className="rounded-xl border border-border p-4">
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <BarChart2 className="w-4 h-4 text-muted-foreground" /> Pengeluaran 6 Bulan Terakhir
                                </h3>
                                <ResponsiveContainer width="100%" height={180}>
                                    <AreaChart data={data.monthlySpend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6} />
                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.4} />
                                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                        <YAxis hide />
                                        <Tooltip
                                            formatter={(v: any) => [`Rp ${Number(v).toLocaleString("id-ID")}`, "Total"]}
                                            contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: 12 }}
                                        />
                                        <Area type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={2} fill="url(#spendGrad)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Recent Transactions */}
                        {data.recentTransactions.length > 0 && (
                            <div className="rounded-xl border border-border overflow-hidden">
                                <div className="px-4 py-3 border-b border-border bg-muted/30">
                                    <h3 className="text-sm font-semibold">Riwayat Transaksi Terbaru</h3>
                                </div>
                                <div className="divide-y divide-border">
                                    {data.recentTransactions.map((t: any) => (
                                        <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium">{t.invoiceNumber}</p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {t.items.slice(0, 2).join(", ")}{t.items.length > 2 ? ` +${t.items.length - 2} lainnya` : ""}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0 space-y-1">
                                                <p className="text-sm font-semibold">Rp {t.downPayment.toLocaleString("id-ID")}</p>
                                                <div className="flex items-center gap-1.5 justify-end">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_CLS[t.status] ?? ""}`}>
                                                        {STATUS_LABEL[t.status] ?? t.status}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {dayjs(t.createdAt).format("DD MMM YY")}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CustomersPage() {
    const queryClient = useQueryClient();
    const { data: customers, isLoading } = useQuery({
        queryKey: ["customers-with-stats"],
        queryFn: getCustomersWithStats,
    });

    const [searchQuery, setSearchQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({ name: "", phone: "", address: "" });
    const [analyticsId, setAnalyticsId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [exportingExcel, setExportingExcel] = useState(false);
    const [exportingPDF, setExportingPDF] = useState(false);

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["customers-with-stats"] });

    const createMutation = useMutation({ mutationFn: createCustomer, onSuccess: () => { invalidate(); closeModal(); } });
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => updateCustomer(id, data),
        onSuccess: () => { invalidate(); closeModal(); },
    });
    const deleteMutation = useMutation({ mutationFn: deleteCustomer, onSuccess: () => { invalidate(); setDeletingId(null); } });

    const openModal = (customer?: any) => {
        setEditingId(customer?.id ?? null);
        setFormData({ name: customer?.name ?? "", phone: customer?.phone ?? "", address: customer?.address ?? "" });
        setIsModalOpen(true);
    };
    const closeModal = () => { setIsModalOpen(false); setEditingId(null); setFormData({ name: "", phone: "", address: "" }); };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) updateMutation.mutate({ id: editingId, data: formData });
        else createMutation.mutate(formData);
    };

    const filtered = (customers as any[] ?? []).filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone && c.phone.includes(searchQuery))
    );

    // Summary stats
    const totalCustomers = customers?.length ?? 0;
    const totalRevenue = (customers as any[] ?? []).reduce((s: number, c: any) => s + (c.totalRevenue ?? 0), 0);
    const activeCustomers = (customers as any[] ?? []).filter((c: any) => c.totalOrders > 0).length;

    const PAYMENT_LABEL: Record<string, string> = {
        CASH: "Tunai", QRIS: "QRIS", BANK_TRANSFER: "Transfer",
    };

    // Export handlers
    const handleExportExcel = async () => {
        setExportingExcel(true);
        try {
            const data: any[] = await getCustomersExportData();
            // Apply same search filter as table
            const exportRows = data.filter((c: any) =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.phone && c.phone.includes(searchQuery))
            );

            // Sheet 1 — Ringkasan Pelanggan
            const summary = exportRows.map((c: any) => ({
                "Nama Pelanggan": c.name,
                "No HP / WA": c.phone ?? "-",
                "Alamat": c.address ?? "-",
                "Total Order": c.totalOrders,
                "Total Pendapatan (Rp)": c.totalRevenue,
                "Rata-rata Per Order (Rp)": c.avgOrder,
                "Metode Bayar Favorit": c.preferredPayment ? (PAYMENT_LABEL[c.preferredPayment] ?? c.preferredPayment) : "-",
                "Terakhir Order": c.lastOrderDate ? dayjs(c.lastOrderDate).format("DD/MM/YYYY") : "-",
                "Produk Favorit #1": c.topProducts?.[0] ? `${c.topProducts[0].name} (${c.topProducts[0].qty}x)` : "-",
                "Produk Favorit #2": c.topProducts?.[1] ? `${c.topProducts[1].name} (${c.topProducts[1].qty}x)` : "-",
                "Produk Favorit #3": c.topProducts?.[2] ? `${c.topProducts[2].name} (${c.topProducts[2].qty}x)` : "-",
                "Produk Favorit #4": c.topProducts?.[3] ? `${c.topProducts[3].name} (${c.topProducts[3].qty}x)` : "-",
                "Produk Favorit #5": c.topProducts?.[4] ? `${c.topProducts[4].name} (${c.topProducts[4].qty}x)` : "-",
                "Status": c.totalOrders > 0 ? "Aktif" : "Baru",
            }));

            // Sheet 2 — Detail Kebiasaan Produk (satu baris per produk per pelanggan)
            const productDetail: any[] = [];
            for (const c of exportRows) {
                if (c.topProducts?.length > 0) {
                    for (const p of c.topProducts) {
                        productDetail.push({
                            "Nama Pelanggan": c.name,
                            "No HP / WA": c.phone ?? "-",
                            "Produk": p.name,
                            "Total Qty Dipesan": p.qty,
                            "Total Pendapatan dari Produk (Rp)": p.revenue,
                        });
                    }
                }
            }

            // Build multi-sheet workbook
            const XLSX = await import("xlsx");
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Ringkasan Pelanggan");
            if (productDetail.length > 0) {
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productDetail), "Detail Produk");
            }
            const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
            const { saveAs } = await import("file-saver");
            saveAs(new Blob([buf], { type: "application/octet-stream" }), `database_pelanggan_${dayjs().format("YYYYMMDD")}.xlsx`);
        } finally {
            setExportingExcel(false);
        }
    };

    const handleExportPDF = async () => {
        setExportingPDF(true);
        try {
            const data: any[] = await getCustomersExportData();
            const exportRows = data.filter((c: any) =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.phone && c.phone.includes(searchQuery))
            );

            exportToPDF(
                "Database Pelanggan — Lengkap dengan Analitik",
                ["Nama", "No HP", "Total Order", "Total Pendapatan", "Avg/Order", "Favorit #1", "Favorit #2", "Favorit #3", "Terakhir Order"],
                exportRows.map((c: any) => [
                    c.name,
                    c.phone ?? "-",
                    `${c.totalOrders}x`,
                    `Rp ${c.totalRevenue.toLocaleString("id-ID")}`,
                    `Rp ${c.avgOrder.toLocaleString("id-ID")}`,
                    c.topProducts?.[0] ? `${c.topProducts[0].name} (${c.topProducts[0].qty}x)` : "-",
                    c.topProducts?.[1] ? `${c.topProducts[1].name} (${c.topProducts[1].qty}x)` : "-",
                    c.topProducts?.[2] ? `${c.topProducts[2].name} (${c.topProducts[2].qty}x)` : "-",
                    c.lastOrderDate ? dayjs(c.lastOrderDate).format("DD/MM/YY") : "-",
                ]),
                `database_pelanggan_${dayjs().format("YYYYMMDD")}.pdf`
            );
        } finally {
            setExportingPDF(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Database Pelanggan</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Kelola data, analitik pembelian, dan remarketing pelanggan.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Export */}
                    <button
                        onClick={handleExportExcel}
                        disabled={exportingExcel}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/50 hover:bg-muted text-sm font-medium transition-colors disabled:opacity-60"
                        title="Export Excel (2 sheet: Ringkasan + Detail Produk)"
                    >
                        {exportingExcel
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        }
                        {exportingExcel ? "Mengekspor..." : "Excel"}
                    </button>
                    <button
                        onClick={handleExportPDF}
                        disabled={exportingPDF}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/50 hover:bg-muted text-sm font-medium transition-colors disabled:opacity-60"
                        title="Export PDF lengkap dengan analitik"
                    >
                        {exportingPDF
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <FileText className="w-4 h-4 text-rose-500" />
                        }
                        {exportingPDF ? "Mengekspor..." : "PDF"}
                    </button>
                    <button
                        onClick={() => openModal()}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm text-sm"
                    >
                        <Plus className="w-4 h-4" /> Tambah Pelanggan
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass rounded-xl p-4 border border-border flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Total Pelanggan</p>
                        <p className="text-2xl font-bold">{totalCustomers}</p>
                    </div>
                </div>
                <div className="glass rounded-xl p-4 border border-border flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Pernah Bertransaksi</p>
                        <p className="text-2xl font-bold">{activeCustomers}</p>
                    </div>
                </div>
                <div className="glass rounded-xl p-4 border border-border flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Total Pendapatan dari Pelanggan</p>
                        <p className="text-xl font-bold">Rp {totalRevenue.toLocaleString("id-ID")}</p>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative w-full md:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Cari nama atau no HP..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden space-y-3">
                {isLoading ? (
                    <div className="glass rounded-xl border border-border p-10 flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-sm">Memuat data...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="glass rounded-xl border border-border p-10 flex flex-col items-center gap-2 text-muted-foreground">
                        <Users className="w-8 h-8 opacity-20" />
                        <span className="text-sm">{searchQuery ? "Pelanggan tidak ditemukan." : "Belum ada pelanggan. Silakan tambah."}</span>
                    </div>
                ) : (
                    filtered.map((c: any) => (
                        <div key={c.id} className="glass rounded-xl border border-border p-4 space-y-3">
                            {/* Name + badges */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-bold text-foreground">{c.name}</p>
                                    {c.address && (
                                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                            <MapPin className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{c.address}</span>
                                        </p>
                                    )}
                                </div>
                                <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${c.totalOrders > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                    {c.totalOrders}x
                                </span>
                            </div>

                            {/* Phone + Revenue */}
                            <div className="flex items-center justify-between gap-3 text-sm">
                                <div>
                                    {c.phone ? (
                                        <div className="flex items-center gap-1.5">
                                            <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-foreground">{c.phone}</span>
                                            <a
                                                href={`https://wa.me/${c.phone.replace(/\D/g, "")}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                title="Buka WhatsApp"
                                            >
                                                <MessageCircle className="w-3.5 h-3.5" />
                                            </a>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground text-xs">Tidak ada kontak</span>
                                    )}
                                </div>
                                <div className="text-right">
                                    {c.totalRevenue > 0 ? (
                                        <p className="font-semibold text-emerald-600 text-sm">Rp {c.totalRevenue.toLocaleString("id-ID")}</p>
                                    ) : (
                                        <p className="text-muted-foreground text-xs">Belum ada transaksi</p>
                                    )}
                                    {c.lastOrderDate && (
                                        <p className="text-[10px] text-muted-foreground">{dayjs(c.lastOrderDate).format("DD MMM YYYY")}</p>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                                <button
                                    onClick={() => setAnalyticsId(c.id)}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-semibold"
                                >
                                    <BarChart2 className="w-3.5 h-3.5" /> Detail Analitik
                                </button>
                                <button
                                    onClick={() => openModal(c)}
                                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                {deletingId === c.id ? (
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-destructive font-medium">Hapus?</span>
                                        <button onClick={() => deleteMutation.mutate(c.id)} disabled={deleteMutation.isPending} className="p-1.5 rounded text-destructive hover:bg-destructive/10 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setDeletingId(null)} className="p-1.5 rounded text-muted-foreground hover:bg-muted transition-colors">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setDeletingId(c.id)}
                                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                        title="Hapus"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
                {filtered.length > 0 && (
                    <p className="text-xs text-muted-foreground text-center py-1">{filtered.length} pelanggan</p>
                )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block glass rounded-xl border border-border overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-5 py-3 text-left">Pelanggan</th>
                                <th className="px-5 py-3 text-left">Kontak</th>
                                <th className="px-5 py-3 text-center">Total Order</th>
                                <th className="px-5 py-3 text-right">Total Pendapatan</th>
                                <th className="px-5 py-3 text-center">Terakhir Order</th>
                                <th className="px-5 py-3 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Memuat data...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                                        <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                        {searchQuery ? "Pelanggan tidak ditemukan." : "Belum ada pelanggan. Silakan tambah."}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((c: any) => (
                                    <tr key={c.id} className="hover:bg-muted/30 transition-colors group">
                                        {/* Name + Address */}
                                        <td className="px-5 py-3.5">
                                            <p className="font-semibold text-foreground">{c.name}</p>
                                            {c.address && (
                                                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                                                    <MapPin className="w-3 h-3 inline mr-0.5" />{c.address}
                                                </p>
                                            )}
                                        </td>
                                        {/* Phone + WA */}
                                        <td className="px-5 py-3.5">
                                            {c.phone ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-foreground">{c.phone}</span>
                                                    <a
                                                        href={`https://wa.me/${c.phone.replace(/\D/g, "")}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                        title="Buka WhatsApp"
                                                    >
                                                        <MessageCircle className="w-3.5 h-3.5" />
                                                    </a>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        {/* Total orders */}
                                        <td className="px-5 py-3.5 text-center">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${c.totalOrders > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                                {c.totalOrders}x
                                            </span>
                                        </td>
                                        {/* Revenue */}
                                        <td className="px-5 py-3.5 text-right font-semibold">
                                            {c.totalRevenue > 0 ? (
                                                <span className="text-emerald-600">Rp {c.totalRevenue.toLocaleString("id-ID")}</span>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        {/* Last order */}
                                        <td className="px-5 py-3.5 text-center text-xs text-muted-foreground">
                                            {c.lastOrderDate ? dayjs(c.lastOrderDate).format("DD MMM YYYY") : "—"}
                                        </td>
                                        {/* Actions */}
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setAnalyticsId(c.id)}
                                                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                                                    title="Lihat Analitik"
                                                >
                                                    <BarChart2 className="w-3.5 h-3.5" /> Detail
                                                    <ChevronRight className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => openModal(c)}
                                                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                {deletingId === c.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-xs text-destructive">Hapus?</span>
                                                        <button onClick={() => deleteMutation.mutate(c.id)} disabled={deleteMutation.isPending} className="p-1 rounded text-destructive hover:bg-destructive/10 transition-colors">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={() => setDeletingId(null)} className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setDeletingId(c.id)}
                                                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                                        title="Hapus"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {filtered.length > 0 && (
                    <div className="px-5 py-2.5 border-t border-border bg-muted/20 text-xs text-muted-foreground">
                        {filtered.length} pelanggan
                    </div>
                )}
            </div>

            {/* Analytics Modal */}
            {analyticsId !== null && (
                <AnalyticsModal customerId={analyticsId} onClose={() => setAnalyticsId(null)} />
            )}

            {/* Form Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6 relative">
                        <button onClick={closeModal} className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-xl font-bold mb-5">{editingId ? "Edit Data Pelanggan" : "Tambah Pelanggan Baru"}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Nama Lengkap *</label>
                                <input
                                    type="text" required
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 ring-primary/20 outline-none transition-all text-sm"
                                    placeholder="Contoh: Budi Santoso"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">No HP / WhatsApp</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 ring-primary/20 outline-none transition-all text-sm"
                                    placeholder="Contoh: 081234567890"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Alamat</label>
                                <textarea
                                    rows={3}
                                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 ring-primary/20 outline-none transition-all resize-none text-sm"
                                    placeholder="Contoh: Jl. Merdeka No. 1..."
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={closeModal} className="flex-1 py-2.5 bg-muted hover:bg-border text-foreground font-semibold rounded-xl transition-all text-sm">
                                    Batal
                                </button>
                                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-all disabled:opacity-50 text-sm">
                                    {(createMutation.isPending || updateMutation.isPending) ? "Menyimpan..." : "Simpan"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
