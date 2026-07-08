"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft, Pencil, Trash2, MessageCircle, Phone, Mail, MapPin, Building2,
    User as UserIcon, Loader2, X, Check, Calendar, FileText, Calculator,
    MapPinned, ShoppingBag, ArrowUpRight, ArrowDownRight, TrendingUp,
    Target, CheckCircle2, XCircle, Clock, Package, Wrench, CalendarDays, BarChart2,
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
    if (pct >= 30) return "text-success";
    if (pct >= 15) return "text-warning";
    if (pct < 0) return "text-destructive";
    return "text-destructive";
}

const EVENT_STATUS: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: "Draft", cls: "bg-muted text-muted-foreground" },
    SCHEDULED: { label: "Terjadwal", cls: "bg-info/15 text-info" },
    IN_PROGRESS: { label: "Berlangsung", cls: "bg-warning/15 text-warning" },
    COMPLETED: { label: "Selesai", cls: "bg-success/15 text-success" },
    CANCELLED: { label: "Batal", cls: "bg-destructive/12 text-destructive" },
};

const INV_STATUS_CLS: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    SENT: "bg-info/15 text-info",
    ACCEPTED: "bg-success/15 text-success",
    REJECTED: "bg-destructive/12 text-destructive",
    EXPIRED: "bg-warning/15 text-warning",
    PAID: "bg-success/15 text-success",
    CANCELLED: "bg-destructive/12 text-destructive",
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
                color: isQuotation ? "bg-primary/15 text-primary" : "bg-success/15 text-success",
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
                color: "bg-info/15 text-info",
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
                color: "bg-info/15 text-info",
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
                badge: { text: t.status, cls: INV_STATUS_CLS[t.status] ?? "bg-muted text-muted-foreground" },
                color: "bg-warning/15 text-warning",
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
            <div className="glass rounded-xl p-5">
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
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success text-white text-sm hover:bg-success/90 transition-colors"
                            >
                                <MessageCircle className="h-3.5 w-3.5" /> WA
                            </a>
                        )}
                        <button
                            onClick={() => setEditMode(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-sm hover:bg-muted transition-colors cursor-pointer"
                        >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                            onClick={() => setShowDelete(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-destructive/30 bg-destructive/12 text-destructive text-sm hover:bg-destructive/20 transition-colors cursor-pointer"
                        >
                            <Trash2 className="h-3.5 w-3.5" /> Hapus
                        </button>
                    </div>
                </div>

                {/* Quick stats */}
                {ea && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4 pt-4 border-t">
                        <QuickStat label="Penawaran ACC" value={String(ea.quotationCount)} sub={fmtShort(ea.totalQuotationValue)} />
                        <QuickStat label="Invoice PAID" value={String(ea.invoiceCount)} sub={fmtShort(ea.totalInvoicePaid)} valueClass="text-success" />
                        <QuickStat label="RAB Plan" value={String(ea.rabCount)} sub={`Margin ${ea.rabMarginPct.toFixed(1)}%`} subClass={marginColor(ea.rabMarginPct)} />
                        <QuickStat label="Event" value={String(ea.eventCount)} sub={`Profit ${fmtShort(ea.eventGrossProfit)}`} subClass={marginColor(ea.eventMarginPct)} />
                    </div>
                )}

                {/* Closing/conversion stats — penawaran ACC vs ditolak */}
                {ea && (ea.quotationsTotal ?? 0) > 0 && (
                    <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                            <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
                                <Target className="h-4 w-4 text-primary" /> Riwayat Closing Penawaran
                            </h3>
                            <div className="text-xs text-muted-foreground">
                                Total <b>{ea.quotationsTotal}</b> penawaran ke klien ini
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <ClosingStat label="Closing (ACC)" icon={<CheckCircle2 className="h-3 w-3" />} value={ea.quotationsAccepted} total={ea.quotationsTotal} cls="bg-success/15 border-success/30 text-success" />
                            <ClosingStat label="Tidak Closing" icon={<XCircle className="h-3 w-3" />} value={ea.quotationsRejected} total={ea.quotationsTotal} cls="bg-destructive/12 border-destructive/30 text-destructive" hint="Rejected/Expired/Cancelled" />
                            <ClosingStat label="Belum Diputus" icon={<Clock className="h-3 w-3" />} value={ea.quotationsPending} total={ea.quotationsTotal} cls="bg-warning/15 border-warning/30 text-warning" hint="Sent/Draft" />
                            <div className="border rounded-lg p-2 bg-primary/5 border-primary/20">
                                <div className="text-[10px] uppercase text-muted-foreground">Conversion Rate</div>
                                <div className={`text-2xl font-bold nums ${(ea.conversionRatePct ?? 0) >= 50 ? "text-success" : (ea.conversionRatePct ?? 0) >= 25 ? "text-warning" : "text-destructive"}`}>
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
                                    const label = t === "SEWA"
                                        ? <span className="flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> Sewa Perlengkapan</span>
                                        : <span className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Pengadaan Booth</span>;
                                    return (
                                        <div key={t} className="glass rounded-lg p-2.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="text-sm font-semibold">{label}</div>
                                                <div className="text-xs text-muted-foreground">{b.total} penawaran</div>
                                            </div>
                                            <div className="mt-1.5 flex items-center gap-3 text-xs">
                                                <span className="text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {b.accepted} ACC</span>
                                                <span className="text-destructive flex items-center gap-1"><XCircle className="h-3 w-3" /> {b.rejected} ditolak</span>
                                                <span className="ml-auto font-mono nums text-muted-foreground">{fmtShort(b.value)}</span>
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
                    { k: "documents", label: `Penawaran & Invoice${ea?.allInvoices ? ` (${ea.allInvoices.length})` : ""}` },
                    { k: "timeline", label: "Timeline" },
                    { k: "analytics", label: "Analytics" },
                ] as const).map((t) => (
                    <button
                        key={t.k}
                        onClick={() => setTab(t.k)}
                        className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${tab === t.k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                        {t.k === "documents" && <FileText className="h-3.5 w-3.5" />}
                        {t.k === "timeline" && <CalendarDays className="h-3.5 w-3.5" />}
                        {t.k === "analytics" && <BarChart2 className="h-3.5 w-3.5" />}
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
                            <div className="bg-destructive/12 p-2 rounded-full">
                                <Trash2 className="h-5 w-5 text-destructive" />
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
                                className="px-3 py-1.5 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
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
            <div className={`text-xl font-bold nums ${valueClass ?? ""}`}>{value}</div>
            <div className={`text-[10px] nums ${subClass ?? "text-muted-foreground"}`}>{sub}</div>
        </div>
    );
}

function ClosingStat({ label, icon, value, total, cls, hint }: { label: string; icon?: React.ReactNode; value: number; total: number; cls: string; hint?: string }) {
    const pct = total > 0 ? (value / total) * 100 : 0;
    return (
        <div className={`border rounded-lg p-2 ${cls}`}>
            <div className="text-[10px] uppercase opacity-80 flex items-center gap-1">{icon}{label}</div>
            <div className="text-2xl font-bold nums">{value}</div>
            <div className="text-[10px] nums opacity-80">{pct.toFixed(0)}% dari total{hint ? ` · ${hint}` : ""}</div>
        </div>
    );
}

function InfoTab({ customer }: { customer: Customer }) {
    return (
        <div className="grid md:grid-cols-2 gap-3">
            <div className="glass rounded-xl p-4 space-y-2 text-sm">
                <div className="font-semibold text-xs text-muted-foreground uppercase mb-2">Kontak</div>
                <InfoRow label="Nama" value={customer.name} />
                <InfoRow label="Phone" value={customer.phone ?? "—"} />
                <InfoRow label="Email" value={customer.email ?? "—"} />
                <InfoRow label="Alamat" value={customer.address ?? "—"} />
            </div>
            <div className="glass rounded-xl p-4 space-y-2 text-sm">
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
            <div className="glass rounded-xl p-8 text-center">
                <FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
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
                    title="Penawaran"
                    icon={<FileText className="h-4 w-4" />}
                    docs={quotations}
                    hrefPrefix="/penawaran"
                    emptyText="Belum ada penawaran"
                />
            )}
            {realInvoices.length > 0 && (
                <DocSection
                    title="Invoice"
                    icon={<FileText className="h-4 w-4" />}
                    docs={realInvoices}
                    hrefPrefix="/invoices"
                    emptyText="Belum ada invoice"
                />
            )}
        </div>
    );
}

function DocSection({
    title, icon, docs, hrefPrefix,
}: {
    title: string;
    icon?: React.ReactNode;
    docs: any[];
    hrefPrefix: string;
    emptyText: string;
}) {
    return (
        <div className="glass rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">{icon}{title}</h3>
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
                                <td className="px-3 py-2 text-right font-mono nums text-xs">
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
            <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                Belum ada aktivitas tercatat untuk customer ini.
            </div>
        );
    }
    return (
        <div className="glass rounded-xl overflow-hidden">
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
                <div className="glass rounded-xl p-4">
                    <div className="font-semibold text-sm mb-2 flex items-center gap-1.5"><Package className="h-4 w-4" /> POS / Lini Printing</div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <div className="text-xs text-muted-foreground">Total Order</div>
                            <div className="text-lg font-bold nums">{analytics.totalOrders}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Revenue</div>
                            <div className="text-lg font-bold nums">{fmtShort(analytics.totalRevenue)}</div>
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
                <div className="glass rounded-xl p-4 space-y-3">
                    <div className="font-semibold text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-info" /> Event / Project (Booth/Event B2B)
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                                <ArrowUpRight className="h-3 w-3 text-success" /> Income
                            </div>
                            <div className="text-lg font-bold nums text-success">{fmtShort(ea.totalEventIncome)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                                <ArrowDownRight className="h-3 w-3 text-destructive" /> Expense
                            </div>
                            <div className="text-lg font-bold nums text-destructive">{fmtShort(ea.totalEventExpense)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                                <TrendingUp className="h-3 w-3" /> Profit
                            </div>
                            <div className={`text-lg font-bold nums ${marginColor(ea.eventMarginPct)}`}>{fmtShort(ea.eventGrossProfit)}</div>
                            <div className={`text-[10px] nums ${marginColor(ea.eventMarginPct)}`}>({ea.eventMarginPct.toFixed(1)}%)</div>
                        </div>
                    </div>
                </div>
            )}

            {(!ea || (ea.eventCount === 0 && analytics.totalOrders === 0)) && (
                <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">
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
