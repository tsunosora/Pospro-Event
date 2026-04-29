"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft, Pencil, Trash2, MessageCircle, Phone, Mail, MapPin, Building2,
    User as UserIcon, Loader2, X, Check, Calendar, FileText, Calculator,
    MapPinned, ShoppingBag, ArrowUpRight, ArrowDownRight, TrendingUp,
} from "lucide-react";
import {
    getCustomer, updateCustomer, deleteCustomer,
    getCustomerAnalytics,
    type Customer,
} from "@/lib/api/customers";
import dayjs from "dayjs";
import "dayjs/locale/id";
dayjs.locale("id");

const fmt = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const fmtShort = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
    if (Math.abs(n) >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}k`;
    return `Rp ${n}`;
};

function marginColor(pct: number) {
    if (pct >= 30) return "text-emerald-600";
    if (pct >= 15) return "text-amber-600";
    if (pct < 0) return "text-red-600";
    return "text-red-500";
}

const EVENT_STATUS: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: "Draft", cls: "bg-gray-100 text-gray-700" },
    SCHEDULED: { label: "Terjadwal", cls: "bg-blue-100 text-blue-700" },
    IN_PROGRESS: { label: "Berlangsung", cls: "bg-amber-100 text-amber-800" },
    COMPLETED: { label: "Selesai", cls: "bg-green-100 text-green-700" },
    CANCELLED: { label: "Batal", cls: "bg-red-100 text-red-700" },
};

const INV_STATUS_CLS: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    SENT: "bg-blue-100 text-blue-700",
    ACCEPTED: "bg-emerald-100 text-emerald-700",
    REJECTED: "bg-red-100 text-red-700",
    EXPIRED: "bg-yellow-100 text-yellow-800",
    PAID: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-red-100 text-red-700",
};

type TimelineEvent = {
    key: string;
    date: Date;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    badge?: { text: string; cls: string };
    href?: string;
    color: string;
};

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = use(params);
    const id = Number(idStr);
    const qc = useQueryClient();
    const router = useRouter();
    const [tab, setTab] = useState<"info" | "documents" | "timeline" | "analytics">("info");
    const [editMode, setEditMode] = useState(false);
    const [showDelete, setShowDelete] = useState(false);

    const { data: customer, isLoading } = useQuery({
        queryKey: ["customer", id],
        queryFn: () => getCustomer(id),
    });
    const { data: analytics } = useQuery({
        queryKey: ["customer-analytics", id],
        queryFn: () => getCustomerAnalytics(id),
    });

    const ea = analytics?.eventAnalytics;

    // Build timeline from analytics
    const timeline = useMemo<TimelineEvent[]>(() => {
        if (!analytics) return [];
        const items: TimelineEvent[] = [];

        // Recent invoices (Penawaran + Invoice)
        (ea?.recentInvoices ?? []).forEach((inv: any) => {
            const isQuotation = inv.type === "QUOTATION";
            items.push({
                key: `inv-${inv.id}`,
                date: new Date(inv.date),
                icon: <FileText className="h-4 w-4" />,
                title: `${isQuotation ? "Penawaran" : "Invoice"} ${inv.invoiceNumber}`,
                subtitle: inv.projectName || `${isQuotation ? "Quotation" : "Invoice"} dibuat`,
                badge: { text: inv.status, cls: INV_STATUS_CLS[inv.status] ?? "" },
                href: isQuotation ? `/penawaran/${inv.id}` : `/invoices/${inv.id}`,
                color: isQuotation ? "bg-purple-100 text-purple-600" : "bg-emerald-100 text-emerald-600",
            });
        });

        // RAB Plans
        (ea?.recentRabPlans ?? []).forEach((r: any) => {
            items.push({
                key: `rab-${r.id}`,
                date: r.periodStart ? new Date(r.periodStart) : new Date(),
                icon: <Calculator className="h-4 w-4" />,
                title: `${r.code} — ${r.title}`,
                subtitle: r.projectName ? `${r.projectName} · ${r.itemCount} item` : `${r.itemCount} item`,
                href: `/rab/${r.id}`,
                color: "bg-indigo-100 text-indigo-600",
            });
        });

        // Events
        (ea?.recentEvents ?? []).forEach((ev: any) => {
            const status = EVENT_STATUS[ev.status] ?? EVENT_STATUS.SCHEDULED;
            items.push({
                key: `event-${ev.id}`,
                date: ev.eventStart ? new Date(ev.eventStart) : new Date(),
                icon: <MapPinned className="h-4 w-4" />,
                title: ev.name,
                subtitle: `${ev.code}${ev.venue ? ` · ${ev.venue}` : ""}`,
                badge: { text: status.label, cls: status.cls },
                href: `/events/${ev.id}`,
                color: "bg-blue-100 text-blue-600",
            });
        });

        // POS Transactions
        (analytics.recentTransactions ?? []).forEach((t: any) => {
            items.push({
                key: `tx-${t.id}`,
                date: new Date(t.createdAt),
                icon: <ShoppingBag className="h-4 w-4" />,
                title: `POS ${t.invoiceNumber}`,
                subtitle: `${fmt(t.downPayment)} · ${t.itemCount} item`,
                badge: { text: t.status, cls: INV_STATUS_CLS[t.status] ?? "bg-gray-100 text-gray-700" },
                color: "bg-amber-100 text-amber-600",
            });
        });

        // Sort desc by date
        return items.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [analytics, ea]);

    const deleteMut = useMutation({
        mutationFn: () => deleteCustomer(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["customers-with-stats"] });
            router.push("/customers");
        },
    });

    if (isLoading) {
        return (
            <div className="p-12 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin inline mr-2" /> Memuat...
            </div>
        );
    }
    if (!customer) {
        return (
            <div className="p-12 text-center">
                <p className="text-muted-foreground">Customer tidak ditemukan.</p>
                <Link href="/customers" className="text-primary hover:underline mt-2 inline-block">← Kembali</Link>
            </div>
        );
    }

    const waLink = customer.phone
        ? `https://wa.me/${customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Halo ${customer.name},`)}`
        : null;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Link href="/customers" className="p-2 hover:bg-muted rounded-md">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <h1 className="text-xl font-bold">Detail Customer</h1>
            </div>

            {/* Profile card */}
            <div className="bg-background border rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <UserIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">{customer.name}</h2>
                            {customer.companyName && (
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                                    <Building2 className="h-3.5 w-3.5" />
                                    {customer.companyName}
                                    {customer.companyPIC && <span>· PIC: {customer.companyPIC}</span>}
                                </div>
                            )}
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                                {customer.phone && (
                                    <a href={`tel:${customer.phone}`} className="flex items-center gap-1 hover:text-primary">
                                        <Phone className="h-3 w-3" /> {customer.phone}
                                    </a>
                                )}
                                {customer.email && (
                                    <a href={`mailto:${customer.email}`} className="flex items-center gap-1 hover:text-primary">
                                        <Mail className="h-3 w-3" /> {customer.email}
                                    </a>
                                )}
                                {customer.address && (
                                    <span className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" /> {customer.address}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {waLink && (
                            <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500 text-white text-sm hover:bg-emerald-600"
                            >
                                <MessageCircle className="h-3.5 w-3.5" /> WA
                            </a>
                        )}
                        <button
                            onClick={() => setEditMode(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-sm hover:bg-muted"
                        >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                            onClick={() => setShowDelete(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-200 bg-red-50 text-red-600 text-sm hover:bg-red-100"
                        >
                            <Trash2 className="h-3.5 w-3.5" /> Hapus
                        </button>
                    </div>
                </div>

                {/* Quick stats */}
                {ea && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4 pt-4 border-t">
                        <QuickStat label="Penawaran ACC" value={String(ea.quotationCount)} sub={fmtShort(ea.totalQuotationValue)} />
                        <QuickStat label="Invoice PAID" value={String(ea.invoiceCount)} sub={fmtShort(ea.totalInvoicePaid)} valueClass="text-emerald-600" />
                        <QuickStat label="RAB Plan" value={String(ea.rabCount)} sub={`Margin ${ea.rabMarginPct.toFixed(1)}%`} subClass={marginColor(ea.rabMarginPct)} />
                        <QuickStat label="Event" value={String(ea.eventCount)} sub={`Profit ${fmtShort(ea.eventGrossProfit)}`} subClass={marginColor(ea.eventMarginPct)} />
                    </div>
                )}

                {/* Closing/conversion stats — penawaran ACC vs ditolak */}
                {ea && (ea.quotationsTotal ?? 0) > 0 && (
                    <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                            <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
                                🎯 Riwayat Closing Penawaran
                            </h3>
                            <div className="text-xs text-muted-foreground">
                                Total <b>{ea.quotationsTotal}</b> penawaran ke klien ini
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <ClosingStat label="✅ Closing (ACC)" value={ea.quotationsAccepted} total={ea.quotationsTotal} cls="bg-emerald-50 border-emerald-200 text-emerald-700" />
                            <ClosingStat label="❌ Tidak Closing" value={ea.quotationsRejected} total={ea.quotationsTotal} cls="bg-red-50 border-red-200 text-red-700" hint="Rejected/Expired/Cancelled" />
                            <ClosingStat label="⏳ Belum Diputus" value={ea.quotationsPending} total={ea.quotationsTotal} cls="bg-amber-50 border-amber-200 text-amber-700" hint="Sent/Draft" />
                            <div className="border rounded-lg p-2 bg-primary/5 border-primary/20">
                                <div className="text-[10px] uppercase text-muted-foreground">Conversion Rate</div>
                                <div className={`text-2xl font-bold ${(ea.conversionRatePct ?? 0) >= 50 ? "text-emerald-600" : (ea.conversionRatePct ?? 0) >= 25 ? "text-amber-600" : "text-red-600"}`}>
                                    {(ea.conversionRatePct ?? 0).toFixed(0)}%
                                </div>
                                <div className="text-[10px] text-muted-foreground">ACC ÷ (ACC + Ditolak)</div>
                            </div>
                        </div>

                        {/* Booth type breakdown */}
                        {ea.boothTypeBreakdown && (
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                {(["SEWA", "PENGADAAN_BOOTH"] as const).map((t) => {
                                    const b = ea.boothTypeBreakdown[t];
                                    if (!b || b.total === 0) return null;
                                    const label = t === "SEWA" ? "🏗️ Sewa Perlengkapan" : "🎪 Pengadaan Booth";
                                    return (
                                        <div key={t} className="border rounded-lg p-2.5 bg-background">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="text-sm font-semibold">{label}</div>
                                                <div className="text-xs text-muted-foreground">{b.total} penawaran</div>
                                            </div>
                                            <div className="mt-1.5 flex items-center gap-3 text-xs">
                                                <span className="text-emerald-700">✅ {b.accepted} ACC</span>
                                                <span className="text-red-600">❌ {b.rejected} ditolak</span>
                                                <span className="ml-auto font-mono text-muted-foreground">{fmtShort(b.value)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="inline-flex border rounded overflow-hidden text-sm flex-wrap">
                {([
                    { k: "info", label: "Info Lengkap" },
                    { k: "documents", label: `📄 Penawaran & Invoice${ea?.allInvoices ? ` (${ea.allInvoices.length})` : ""}` },
                    { k: "timeline", label: "📅 Timeline" },
                    { k: "analytics", label: "📊 Analytics" },
                ] as const).map((t) => (
                    <button
                        key={t.k}
                        onClick={() => setTab(t.k)}
                        className={`px-3 py-1.5 ${tab === t.k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {tab === "info" && (
                <InfoTab customer={customer} />
            )}

            {tab === "documents" && (
                <DocumentsTab invoices={ea?.allInvoices ?? []} />
            )}

            {tab === "timeline" && (
                <TimelineTab events={timeline} />
            )}

            {tab === "analytics" && analytics && (
                <AnalyticsTab analytics={analytics} ea={ea} />
            )}

            {/* Edit modal */}
            {editMode && (
                <EditModal
                    customer={customer}
                    onClose={() => setEditMode(false)}
                    onSaved={() => {
                        qc.invalidateQueries({ queryKey: ["customer", id] });
                        qc.invalidateQueries({ queryKey: ["customers-with-stats"] });
                        setEditMode(false);
                    }}
                />
            )}

            {/* Delete confirm */}
            {showDelete && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowDelete(false)}>
                    <div className="bg-background rounded-lg shadow-xl w-full max-w-sm p-5 border" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start gap-3">
                            <div className="bg-red-100 p-2 rounded-full">
                                <Trash2 className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold">Hapus Customer?</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {customer.name} akan dihapus permanen. Penawaran/RAB/Event/Lead yang ter-link customer ini akan tetap ada (link di-set null).
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
                            <button onClick={() => setShowDelete(false)} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted">Batal</button>
                            <button
                                onClick={() => deleteMut.mutate()}
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

function QuickStat({ label, value, sub, valueClass, subClass }: { label: string; value: string; sub: string; valueClass?: string; subClass?: string }) {
    return (
        <div className="text-center md:text-left">
            <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
            <div className={`text-xl font-bold ${valueClass ?? ""}`}>{value}</div>
            <div className={`text-[10px] ${subClass ?? "text-muted-foreground"}`}>{sub}</div>
        </div>
    );
}

function ClosingStat({ label, value, total, cls, hint }: { label: string; value: number; total: number; cls: string; hint?: string }) {
    const pct = total > 0 ? (value / total) * 100 : 0;
    return (
        <div className={`border rounded-lg p-2 ${cls}`}>
            <div className="text-[10px] uppercase opacity-80">{label}</div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-[10px] opacity-80">{pct.toFixed(0)}% dari total{hint ? ` · ${hint}` : ""}</div>
        </div>
    );
}

function InfoTab({ customer }: { customer: Customer }) {
    return (
        <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-background border rounded-lg p-4 space-y-2 text-sm">
                <div className="font-semibold text-xs text-muted-foreground uppercase mb-2">Kontak</div>
                <InfoRow label="Nama" value={customer.name} />
                <InfoRow label="Phone" value={customer.phone ?? "—"} />
                <InfoRow label="Email" value={customer.email ?? "—"} />
                <InfoRow label="Alamat" value={customer.address ?? "—"} />
            </div>
            <div className="bg-background border rounded-lg p-4 space-y-2 text-sm">
                <div className="font-semibold text-xs text-muted-foreground uppercase mb-2">Perusahaan / Instansi</div>
                <InfoRow label="Perusahaan" value={customer.companyName ?? "—"} />
                <InfoRow label="PIC Perusahaan" value={customer.companyPIC ?? "—"} />
                <InfoRow label="Customer ID" value={`#${customer.id}`} />
                <InfoRow label="Dibuat" value={customer.createdAt ? dayjs(customer.createdAt).format("DD MMM YYYY HH:mm") : "—"} />
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-right truncate">{value}</span>
        </div>
    );
}

function DocumentsTab({ invoices }: { invoices: any[] }) {
    const quotations = invoices.filter((i) => i.type === "QUOTATION");
    const realInvoices = invoices.filter((i) => i.type === "INVOICE");

    if (invoices.length === 0) {
        return (
            <div className="bg-background border rounded-xl p-8 text-center">
                <div className="text-4xl mb-2">📄</div>
                <h3 className="font-semibold mb-1">Belum ada penawaran/invoice</h3>
                <p className="text-sm text-muted-foreground">
                    Customer ini belum punya dokumen apa pun. Buat penawaran baru via tombol di atas.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {quotations.length > 0 && (
                <DocSection
                    title="📄 Penawaran"
                    docs={quotations}
                    hrefPrefix="/penawaran"
                    emptyText="Belum ada penawaran"
                />
            )}
            {realInvoices.length > 0 && (
                <DocSection
                    title="🧾 Invoice"
                    docs={realInvoices}
                    hrefPrefix="/invoices"
                    emptyText="Belum ada invoice"
                />
            )}
        </div>
    );
}

function DocSection({
    title, docs, hrefPrefix,
}: {
    title: string;
    docs: any[];
    hrefPrefix: string;
    emptyText: string;
}) {
    return (
        <div className="bg-background border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{title}</h3>
                <span className="text-xs text-muted-foreground">{docs.length} dokumen</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
                        <tr>
                            <th className="text-left px-3 py-2 font-semibold">No.</th>
                            <th className="text-left px-3 py-2 font-semibold">Tanggal</th>
                            <th className="text-left px-3 py-2 font-semibold">Project</th>
                            <th className="text-left px-3 py-2 font-semibold">Status</th>
                            <th className="text-right px-3 py-2 font-semibold">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {docs.map((d) => (
                            <tr key={d.id} className="hover:bg-muted/20">
                                <td className="px-3 py-2 font-mono text-xs">
                                    <Link href={`${hrefPrefix}/${d.id}`} className="text-primary hover:underline font-medium">
                                        {d.invoiceNumber || `#${d.id} (draft)`}
                                    </Link>
                                </td>
                                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                                    {d.date ? dayjs(d.date).format("DD MMM YYYY") : "—"}
                                </td>
                                <td className="px-3 py-2 text-xs">
                                    {d.projectName || <span className="italic text-muted-foreground">—</span>}
                                </td>
                                <td className="px-3 py-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${INV_STATUS_CLS[d.status] ?? "bg-gray-100 text-gray-700"}`}>
                                        {d.status}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-xs">
                                    {fmt(Number(d.total) || 0)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function TimelineTab({ events }: { events: TimelineEvent[] }) {
    if (events.length === 0) {
        return (
            <div className="p-8 border rounded-lg text-center text-sm text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                Belum ada aktivitas tercatat untuk customer ini.
            </div>
        );
    }
    return (
        <div className="bg-background border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
                <h3 className="text-sm font-semibold">Timeline Aktivitas ({events.length})</h3>
                <p className="text-xs text-muted-foreground">Penawaran · Invoice · RAB · Event · POS — sorted by tanggal</p>
            </div>
            <div className="divide-y">
                {events.map((e) => {
                    const RowContent = (
                        <div className="px-4 py-3 flex items-start gap-3 hover:bg-muted/30">
                            <div className={`w-8 h-8 rounded-full ${e.color} flex items-center justify-center shrink-0 mt-0.5`}>
                                {e.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold truncate">{e.title}</span>
                                    {e.badge && (
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${e.badge.cls}`}>{e.badge.text}</span>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground truncate mt-0.5">{e.subtitle}</div>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0 mt-1">
                                {dayjs(e.date).format("DD MMM YY")}
                            </span>
                        </div>
                    );
                    return e.href ? (
                        <Link key={e.key} href={e.href} className="block">{RowContent}</Link>
                    ) : (
                        <div key={e.key}>{RowContent}</div>
                    );
                })}
            </div>
        </div>
    );
}

function AnalyticsTab({ analytics, ea }: { analytics: any; ea: any }) {
    return (
        <div className="space-y-4">
            {/* POS section */}
            {analytics.totalOrders > 0 && (
                <div className="bg-background border rounded-lg p-4">
                    <div className="font-semibold text-sm mb-2">📦 POS / Lini Printing</div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <div className="text-xs text-muted-foreground">Total Order</div>
                            <div className="text-lg font-bold">{analytics.totalOrders}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Revenue</div>
                            <div className="text-lg font-bold">{fmtShort(analytics.totalRevenue)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Last Order</div>
                            <div className="text-sm font-medium">
                                {analytics.lastOrderDate ? dayjs(analytics.lastOrderDate).format("DD MMM YY") : "—"}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Event/Project section */}
            {ea && ea.eventCount > 0 && (
                <div className="bg-background border rounded-lg p-4 space-y-3">
                    <div className="font-semibold text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-indigo-600" /> Event / Project (Booth/Event B2B)
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                                <ArrowUpRight className="h-3 w-3 text-emerald-500" /> Income
                            </div>
                            <div className="text-lg font-bold text-emerald-600">{fmtShort(ea.totalEventIncome)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                                <ArrowDownRight className="h-3 w-3 text-red-500" /> Expense
                            </div>
                            <div className="text-lg font-bold text-red-600">{fmtShort(ea.totalEventExpense)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                                <TrendingUp className="h-3 w-3" /> Profit
                            </div>
                            <div className={`text-lg font-bold ${marginColor(ea.eventMarginPct)}`}>{fmtShort(ea.eventGrossProfit)}</div>
                            <div className={`text-[10px] ${marginColor(ea.eventMarginPct)}`}>({ea.eventMarginPct.toFixed(1)}%)</div>
                        </div>
                    </div>
                </div>
            )}

            {(!ea || (ea.eventCount === 0 && analytics.totalOrders === 0)) && (
                <div className="p-8 border rounded-lg text-center text-sm text-muted-foreground">
                    Belum ada aktivitas project / order untuk customer ini.
                </div>
            )}
        </div>
    );
}

function EditModal({ customer, onClose, onSaved }: { customer: Customer; onClose: () => void; onSaved: () => void }) {
    const [form, setForm] = useState({
        name: customer.name,
        phone: customer.phone ?? "",
        email: customer.email ?? "",
        address: customer.address ?? "",
        companyName: customer.companyName ?? "",
        companyPIC: customer.companyPIC ?? "",
    });

    const mut = useMutation({
        mutationFn: () =>
            updateCustomer(customer.id, {
                name: form.name,
                phone: form.phone || null,
                email: form.email || null,
                address: form.address || null,
                companyName: form.companyName || null,
                companyPIC: form.companyPIC || null,
            }),
        onSuccess: onSaved,
    });

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-5 border max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Edit Customer</h3>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!form.name.trim()) return;
                        mut.mutate();
                    }}
                    className="space-y-3"
                >
                    <Field label="Nama PIC *">
                        <input
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                        />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Phone">
                            <input
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                placeholder="08123..."
                                className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                            />
                        </Field>
                        <Field label="Email">
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="email@example.com"
                                className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                            />
                        </Field>
                    </div>
                    <Field label="Alamat">
                        <textarea
                            rows={2}
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background resize-none"
                        />
                    </Field>
                    <div className="border-t pt-3 space-y-3">
                        <div className="text-xs font-semibold text-muted-foreground uppercase">Perusahaan / Instansi (B2B)</div>
                        <Field label="Nama Perusahaan">
                            <input
                                value={form.companyName}
                                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                                placeholder="PT XYZ"
                                className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                            />
                        </Field>
                        <Field label="PIC Perusahaan (kalau beda dari nama)">
                            <input
                                value={form.companyPIC}
                                onChange={(e) => setForm({ ...form, companyPIC: e.target.value })}
                                placeholder="Bp. Direktur"
                                className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                            />
                        </Field>
                    </div>
                    <div className="flex justify-end gap-2 pt-3 border-t">
                        <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted">Batal</button>
                        <button type="submit" disabled={mut.isPending} className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5" />
                            {mut.isPending ? "Menyimpan..." : "Simpan"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{label}</label>
            {children}
        </div>
    );
}
