"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus, FileText, FileDown, Pencil, Trash2, Loader2, GitBranch, Hash, Eye, X, Download, Users, Search, ScrollText, Copy,
    Wrench, Send, CheckCircle2, XCircle, Receipt, AlertTriangle, Wallet, Lightbulb, MoreVertical, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import dayjs from "dayjs";
import "dayjs/locale/id";
import {
    getQuotations, createQuotation, deleteQuotation,
    assignQuotationNumber, editQuotationNumber, reviseQuotation, duplicateQuotation, downloadQuotationExport,
    backfillQuotationStatus,
    markInvoiceSent, markInvoicePaid, cancelInvoice,
    type Quotation, type QuotationVariant,
} from "@/lib/api/quotations";
import { ACTIVE_BRANDS, BRAND_META, listBrands, type Brand } from "@/lib/api/brands";
import { BrandBadge } from "@/components/BrandBadge";
import { listQuotationVariants } from "@/lib/api/quotation-variants";
import { getWorkers, MARKETER_POSITIONS } from "@/lib/api/workers";
import { getCustomer, type Customer } from "@/lib/api/customers";
import { CustomerPickerModal } from "@/components/CustomerPickerModal";
import { MarkPaidModal } from "@/components/MarkPaidModal";
import { PaymentDetailModal } from "@/components/PaymentDetailModal";
import { PhoneDuplicateBanner } from "@/components/PhoneDuplicateBanner";
import { DateRangeFilter, presetToRange, type DateRange } from "@/components/DateRangeFilter";

dayjs.locale("id");

const VARIANT_LABEL: Record<QuotationVariant, string> = {
    SEWA: "Sewa Perlengkapan Event",
    PENGADAAN_BOOTH: "Pengadaan Booth Special Design",
};

const STATUS_COLOR: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    SENT: "bg-info/15 text-info",
    PAID: "bg-success/15 text-success font-bold",
    PARTIALLY_PAID: "bg-warning/15 text-warning",
    ACCEPTED: "bg-success/15 text-success",
    REJECTED: "bg-destructive/12 text-destructive",
    EXPIRED: "bg-warning/15 text-warning",
    CANCELLED: "bg-destructive/12 text-destructive line-through",
};

function rp(v: string | number) {
    return "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

export default function PenawaranListPage() {
    return (
        <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Memuat…</div>}>
            <PenawaranListPageInner />
        </Suspense>
    );
}

function PenawaranListPageInner() {
    const qc = useQueryClient();
    const searchParams = useSearchParams();
    const customerIdParam = searchParams.get("customerId");
    const presetCustomerId = customerIdParam ? Number(customerIdParam) : null;

    const [variantFilter, setVariantFilter] = useState<string>("");
    const [typeFilter, setTypeFilter] = useState<'QUOTATION' | 'INVOICE' | 'ALL'>('QUOTATION');
    const [dateRange, setDateRange] = useState<DateRange>({ preset: "ALL" });
    const [search, setSearch] = useState("");
    // Pagination client-side — batasi scroll vertikal pada list yang panjang.
    const PAGE_SIZE = 20;
    const [page, setPage] = useState(1);
    const [showCreate, setShowCreate] = useState(false);
    const [previewQ, setPreviewQ] = useState<Quotation | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewType, setPreviewType] = useState<"pdf" | "spk-pdf">("pdf");

    // Customer prefill — diisi saat user buka via ?customerId=X (dari CRM convert) atau pilih manual
    const [presetCustomer, setPresetCustomer] = useState<Customer | null>(null);

    // Fetch customer dari URL param sekali
    const { data: prefillCustomer } = useQuery({
        queryKey: ["customer", presetCustomerId],
        queryFn: () => getCustomer(presetCustomerId!),
        enabled: !!presetCustomerId,
    });

    // Saat customer ter-fetch dari URL param, auto-open modal
    useEffect(() => {
        if (prefillCustomer && !showCreate) {
            setPresetCustomer(prefillCustomer);
            setShowCreate(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prefillCustomer]);

    const handlePreview = async (q: Quotation, type: "pdf" | "spk-pdf" = "pdf") => {
        setPreviewQ(q);
        setPreviewType(type);
        setPreviewLoading(true);
        try {
            const { blob } = await downloadQuotationExport(q.id, type);
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(URL.createObjectURL(blob));
        } catch (err: any) {
            alert("Gagal preview: " + (err?.response?.data?.message || err.message));
            setPreviewQ(null);
        } finally {
            setPreviewLoading(false);
        }
    };

    /** Switch type preview (Penawaran/SPK) tanpa close modal. */
    const switchPreviewType = async (type: "pdf" | "spk-pdf") => {
        if (!previewQ || type === previewType) return;
        setPreviewType(type);
        setPreviewLoading(true);
        try {
            const { blob } = await downloadQuotationExport(previewQ.id, type);
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(URL.createObjectURL(blob));
        } catch (err: any) {
            alert("Gagal switch preview: " + (err?.response?.data?.message || err.message));
        } finally {
            setPreviewLoading(false);
        }
    };

    const closePreview = () => {
        setPreviewQ(null);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
    };

    const { data, isLoading } = useQuery({
        queryKey: ["quotations", variantFilter, typeFilter],
        queryFn: () => getQuotations({
            ...(variantFilter ? { variantCode: variantFilter } : {}),
            type: typeFilter,
        }),
    });

    const { data: variantConfigs = [] } = useQuery({
        queryKey: ["quotation-variants", true],
        queryFn: () => listQuotationVariants(true), // include inactive untuk lookup label dari quotation lama
    });
    const variantConfigMap = new Map(variantConfigs.map((v) => [v.code, v]));

    // Theme color per brand — diambil dari /settings/brand (BrandSettings.themeColor).
    // Dipakai untuk mewarnai border + background row table sesuai brand setting user.
    const { data: brandSettingsList = [] } = useQuery({
        queryKey: ["brand-settings-all"],
        queryFn: listBrands,
        staleTime: 5 * 60 * 1000, // cache 5 menit, jarang berubah
    });
    const brandColorMap = new Map<Brand, string>(
        brandSettingsList
            .filter((b) => b.themeColor && b.themeColor.trim())
            .map((b) => [b.brand, b.themeColor!.trim()]),
    );

    const createMut = useMutation({
        mutationFn: createQuotation,
        onSuccess: (q: Quotation) => {
            qc.invalidateQueries({ queryKey: ["quotations"] });
            // Invalidate customer cache supaya penawaran baru langsung muncul di histori customer
            if (q.customerId) {
                qc.invalidateQueries({ queryKey: ["customer-analytics", q.customerId] });
                qc.invalidateQueries({ queryKey: ["customer", q.customerId] });
            }
            qc.invalidateQueries({ queryKey: ["customers-with-stats"] });
            setShowCreate(false);
            window.location.href = `/penawaran/${q.id}`;
        },
    });

    const deleteMut = useMutation({
        mutationFn: deleteQuotation,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["quotations"] }),
    });

    const assignMut = useMutation({
        mutationFn: (id: number) => assignQuotationNumber(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["quotations"] }),
    });

    /** Edit nomor penawaran via prompt inline — koreksi typo / format. */
    const editNumberMut = useMutation({
        mutationFn: ({ id, invoiceNumber }: { id: number; invoiceNumber: string }) =>
            editQuotationNumber(id, invoiceNumber),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["quotations"] }),
        onError: (err: any) => {
            alert(`Gagal edit nomor: ${err?.response?.data?.message || err?.message || 'Unknown error'}`);
        },
    });
    const handleEditNumber = (q: Quotation) => {
        const docLabel = q.type === 'INVOICE' ? 'invoice' : 'penawaran';
        const exampleFormat = q.type === 'INVOICE' ? '1234/Xp/Inv/V/26' : '5260/Xp.Pnwr/V/26';
        const current = q.invoiceNumber;
        const next = window.prompt(
            `Edit nomor ${docLabel}:\n\nFormat bebas (mis. "${exampleFormat}").\nKosongkan untuk batal.`,
            current,
        );
        if (next === null) return; // user cancel
        const trimmed = next.trim();
        if (!trimmed) return alert("Nomor tidak boleh kosong.");
        if (trimmed === current) return; // no change
        if (!confirm(`Ubah nomor ${docLabel}:\n\nDari: ${current}\nKe:   ${trimmed}\n\nLanjutkan?`)) return;
        editNumberMut.mutate({ id: q.id, invoiceNumber: trimmed });
    };

    const reviseMut = useMutation({
        mutationFn: reviseQuotation,
        onSuccess: (q: Quotation) => {
            qc.invalidateQueries({ queryKey: ["quotations"] });
            window.location.href = `/penawaran/${q.id}`;
        },
    });

    const duplicateMut = useMutation({
        mutationFn: duplicateQuotation,
        onSuccess: (q: Quotation) => {
            qc.invalidateQueries({ queryKey: ["quotations"] });
            window.location.href = `/penawaran/${q.id}`;
        },
        onError: (e: any) => alert(`❌ Duplicate gagal: ${e?.response?.data?.message || e?.message}`),
    });

    /** One-time admin backfill — fix penawaran lama yang status-nya masih DRAFT padahal sudah punya nomor resmi. */
    const backfillStatusMut = useMutation({
        mutationFn: backfillQuotationStatus,
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ["quotations"] });
            alert(`✅ Backfill selesai. ${res.updated} penawaran lama di-promote dari DRAFT → SENT.`);
        },
        onError: (e: any) => {
            alert(`❌ Gagal: ${e?.response?.data?.message || e?.message || "Unknown"}`);
        },
    });

    const handleBackfillStatus = () => {
        if (!confirm(
            "Promote semua penawaran yang sudah punya nomor resmi tapi status masih DRAFT → SENT?\n\n" +
            "Operasi ini aman dijalankan berkali-kali (idempotent). Status lain (ACCEPTED/REJECTED/CANCELLED/EXPIRED) tidak disentuh."
        )) return;
        backfillStatusMut.mutate();
    };

    // ─── Payment Status Actions ────────────────────────────────────
    const [markPaidTarget, setMarkPaidTarget] = useState<Quotation | null>(null);
    const [paymentDetailTarget, setPaymentDetailTarget] = useState<Quotation | null>(null);

    const markSentMut = useMutation({
        mutationFn: (id: number) => markInvoiceSent(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotations"] }); },
        onError: (e: any) => alert(`❌ Mark Sent gagal: ${e?.response?.data?.message || e?.message}`),
    });

    const markPaidMut = useMutation({
        mutationFn: (payload: { id: number; data: any }) => markInvoicePaid(payload.id, payload.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["quotations"] });
            qc.invalidateQueries({ queryKey: ["cashflows"] });   // refresh cashflow kalau ada di cache lain
            setMarkPaidTarget(null);
            alert("✅ Pembayaran tercatat. Cashflow IN sudah dibuat (kalau di-centang).");
        },
        onError: (e: any) => alert(`❌ Mark Paid gagal: ${e?.response?.data?.message || e?.message}`),
    });

    const cancelInvoiceMut = useMutation({
        mutationFn: (payload: { id: number; reason: string | null }) => cancelInvoice(payload.id, payload.reason),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotations"] }); },
        onError: (e: any) => alert(`❌ Cancel gagal: ${e?.response?.data?.message || e?.message}`),
    });

    const handleMarkSent = (q: Quotation) => {
        if (!confirm(`Tandai invoice ${q.invoiceNumber} sebagai SENT (sudah dikirim ke klien)?`)) return;
        markSentMut.mutate(q.id);
    };
    const handleCancelInvoice = (q: Quotation) => {
        const reason = window.prompt(`Batalkan invoice ${q.invoiceNumber}?\n\nAlasan (opsional):`, "");
        if (reason === null) return;
        if (!confirm(`Konfirmasi: Cancel invoice ${q.invoiceNumber}?`)) return;
        cancelInvoiceMut.mutate({ id: q.id, reason: reason.trim() || null });
    };

    const handleExport = async (id: number, format: "pdf" | "docx" | "spk-pdf", _invoiceNumber: string) => {
        try {
            const { blob, filename } = await downloadQuotationExport(id, format);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename; // pakai nama dari Content-Disposition server
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            alert("Gagal export: " + (err?.response?.data?.message || err.message));
        }
    };

    const allQuotations: Quotation[] = data ?? [];

    // Apply date range filter + search filter
    const quotations: Quotation[] = (() => {
        const { from, to } = presetToRange(dateRange.preset, {
            from: dateRange.fromDate, to: dateRange.toDate,
        });
        const q = search.trim().toLowerCase();
        let list = allQuotations;
        // Date filter
        if (from || to) {
            list = list.filter((doc) => {
                const d = doc.date ? new Date(doc.date) : null;
                if (!d) return false;
                if (from && d < from) return false;
                if (to && d > to) return false;
                return true;
            });
        }
        // Search filter — match invoiceNumber, clientName, clientCompany, projectName, eventLocation, notes
        if (q) {
            list = list.filter((doc) => {
                const haystack = [
                    doc.invoiceNumber,
                    doc.clientName,
                    doc.clientCompany ?? "",
                    doc.projectName ?? "",
                    doc.eventLocation ?? "",
                    doc.notes ?? "",
                ].join(" ").toLowerCase();
                return haystack.includes(q);
            });
        }
        return list;
    })();

    // Reset ke halaman 1 saat filter/pencarian berubah supaya tak "nyangkut" di halaman kosong
    useEffect(() => { setPage(1); }, [variantFilter, typeFilter, search, dateRange]);

    const totalItems = quotations.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pagedQuotations = quotations.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    // Ringkasan KPI — dihitung dari set yang sedang tampil (mengikuti filter aktif).
    const summary = (() => {
        let totalValue = 0;
        let waiting = 0; // DRAFT / SENT / PARTIALLY_PAID
        let done = 0;    // PAID / ACCEPTED
        for (const q of quotations) {
            // Nilai per dokumen — samakan dengan logika kolom "Total" di tabel.
            let val: number;
            if (q.type === "INVOICE") {
                const dpPaid = q.dpPaidMode === "custom" ? Number(q.dpPaidCustom ?? 0) : 0;
                val = dpPaid > 0 ? Math.max(0, Number(q.total) - dpPaid) : Number(q.amountToPay ?? q.total);
            } else {
                val = Number(q.total || 0);
            }
            totalValue += val;
            if (q.status === "PAID" || q.status === "ACCEPTED") done++;
            else if (q.status === "DRAFT" || q.status === "SENT" || q.status === "PARTIALLY_PAID") waiting++;
        }
        return { count: quotations.length, totalValue, waiting, done };
    })();

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileText className="w-6 h-6" /> Penawaran Booth &amp; Event
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Kelola dokumen Penawaran Sewa Perlengkapan Event &amp; Pengadaan Booth Special Design
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowCreate(true)}
                        className={`inline-flex items-center gap-2 px-4 py-2 ${typeFilter === 'INVOICE' ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'} text-white rounded-lg font-medium shadow-sm transition-colors cursor-pointer`}
                    >
                        <Plus className="w-4 h-4" /> {typeFilter === 'INVOICE' ? 'Buat Invoice Langsung' : 'Buat Penawaran'}
                    </button>
                    {/* Utilitas admin dipindah ke overflow menu supaya area aksi utama tetap bersih */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                title="Menu admin"
                                aria-label="Menu admin"
                                className="inline-flex items-center justify-center p-2.5 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer data-[state=open]:bg-muted"
                            >
                                {backfillStatusMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Utilitas Admin</DropdownMenuLabel>
                            <DropdownMenuItem onSelect={handleBackfillStatus} disabled={backfillStatusMut.isPending}>
                                <Wrench /> Fix Status Lama
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Toolbar filter — pencarian, tab tipe dokumen, varian, & tanggal disatukan
                dalam satu panel supaya rapi dan tidak tercerai-berai jadi banyak baris. */}
            <div className="glass rounded-xl p-3 sm:p-4 mb-6 space-y-3">
                {/* Baris 1: Pencarian + tab tipe dokumen */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari nomor, klien, perusahaan, project, lokasi, catatan…"
                            className="w-full pl-10 pr-10 py-2.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-colors"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                                aria-label="Bersihkan pencarian"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    {/* Tab tipe dokumen: Penawaran / Invoice / Semua */}
                    <div className="inline-flex gap-1 bg-muted p-1 rounded-lg border border-border shrink-0 self-start lg:self-auto">
                        <button
                            onClick={() => setTypeFilter('QUOTATION')}
                            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-bold transition cursor-pointer ${typeFilter === 'QUOTATION'
                                ? 'bg-card text-primary shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <FileText className="w-4 h-4" /> Penawaran
                        </button>
                        <button
                            onClick={() => setTypeFilter('INVOICE')}
                            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-bold transition cursor-pointer ${typeFilter === 'INVOICE'
                                ? 'bg-card text-destructive shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <ScrollText className="w-4 h-4" /> Invoice
                        </button>
                        <button
                            onClick={() => setTypeFilter('ALL')}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition cursor-pointer ${typeFilter === 'ALL'
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Semua
                        </button>
                    </div>
                </div>

                {/* Baris 2: Filter varian — baris penuh sendiri */}
                <div className="flex gap-2 flex-wrap items-center border-t border-border/60 pt-3">
                    <span className="text-xs font-semibold text-muted-foreground mr-0.5 shrink-0">Varian</span>
                    <button
                        onClick={() => setVariantFilter("")}
                        className={`px-3 py-1.5 rounded-md text-sm font-semibold transition cursor-pointer ${variantFilter === ""
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                            }`}
                    >
                        Semua
                    </button>
                    {variantConfigs.filter((v) => v.isActive).map((v) => {
                        const active = variantFilter === v.code;
                        const color = v.color || "#6366f1";
                        return (
                            <button
                                key={v.code}
                                onClick={() => setVariantFilter(v.code)}
                                className="px-3 py-1.5 rounded-md text-sm font-semibold transition border cursor-pointer"
                                style={active
                                    ? { backgroundColor: color, color: "#fff", borderColor: color }
                                    : { backgroundColor: `${color}15`, color, borderColor: `${color}40` }
                                }
                            >
                                {v.label}
                            </button>
                        );
                    })}
                    <Link
                        href="/settings/quotation-variants"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-primary border border-dashed border-primary/30 hover:bg-primary/10 transition-colors"
                        title="Kelola daftar varian penawaran"
                    >
                        <Plus className="h-3.5 w-3.5" /> Tambah Varian
                    </Link>
                </div>

                {/* Baris 3: Filter tanggal — baris penuh sendiri (punya layout chip preset sendiri) */}
                <div className="border-t border-border/60 pt-3">
                    <DateRangeFilter value={dateRange} onChange={setDateRange} label="Tanggal Dokumen" />
                </div>

                {/* Info hasil filter — satu baris ringkas, muncul saat search/tanggal aktif */}
                {(search || dateRange.preset !== "ALL") && (
                    <p className="text-[11px] text-muted-foreground border-t border-border/60 pt-2.5">
                        Menampilkan <b className="text-foreground nums">{quotations.length}</b> dari <b className="text-foreground nums">{allQuotations.length}</b> dokumen
                    </p>
                )}
            </div>

            {/* Ringkasan KPI — 4 kartu ringkas mengikuti filter aktif */}
            {!isLoading && quotations.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                    <StatCard
                        icon={FileText}
                        tone="primary"
                        label={typeFilter === 'INVOICE' ? 'Total Invoice' : 'Total Dokumen'}
                        value={summary.count.toLocaleString('id-ID')}
                        subtext={quotations.length !== allQuotations.length ? `dari ${allQuotations.length} total` : undefined}
                    />
                    <StatCard
                        icon={Wallet}
                        tone="info"
                        label="Total Nilai"
                        value={rp(summary.totalValue)}
                    />
                    <StatCard
                        icon={Send}
                        tone="warning"
                        label="Menunggu"
                        value={summary.waiting.toLocaleString('id-ID')}
                        subtext="Draft / Terkirim"
                    />
                    <StatCard
                        icon={CheckCircle2}
                        tone="success"
                        label="Selesai"
                        value={summary.done.toLocaleString('id-ID')}
                        subtext="Lunas / Diterima"
                    />
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...
                </div>
            ) : quotations.length === 0 ? (
                (() => {
                    const isFiltered = !!search || dateRange.preset !== "ALL" || !!variantFilter;
                    return (
                        <EmptyState
                            icon={FileText}
                            title={isFiltered ? "Tidak ada dokumen yang cocok" : "Belum ada penawaran"}
                            description={isFiltered
                                ? "Coba ubah kata kunci pencarian, varian, atau filter tanggal."
                                : "Mulai dengan membuat dokumen penawaran pertama Anda."}
                            action={!isFiltered ? (
                                <button
                                    onClick={() => setShowCreate(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium shadow-sm transition-colors cursor-pointer"
                                >
                                    <Plus className="w-4 h-4" /> {typeFilter === 'INVOICE' ? 'Buat Invoice' : 'Buat Penawaran'}
                                </button>
                            ) : undefined}
                        />
                    );
                })()
            ) : (
                <div className="glass rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/70 text-muted-foreground text-left text-[11px] uppercase tracking-wide border-b border-border">
                            <tr>
                                <th className="px-3 py-2.5 font-semibold">No. Penawaran</th>
                                <th className="px-3 py-2.5 font-semibold">Brand</th>
                                <th className="px-3 py-2.5 font-semibold">Varian</th>
                                <th className="px-3 py-2.5 font-semibold">Klien / Proyek</th>
                                <th className="px-3 py-2.5 font-semibold">Marketing</th>
                                <th className="px-3 py-2.5 font-semibold">Tanggal</th>
                                <th className="px-3 py-2.5 font-semibold text-right">Total</th>
                                <th className="px-3 py-2.5 font-semibold">Status</th>
                                <th className="px-3 py-2.5 font-semibold text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagedQuotations.map((q) => {
                                const bm = q.brand ? BRAND_META[q.brand] : null;
                                // Prioritas warna: themeColor dari pengaturan brand → fallback BRAND_META.color → slate-400.
                                const settingsColor = q.brand ? brandColorMap.get(q.brand) : null;
                                const accentColor = settingsColor || bm?.color || "#94a3b8";
                                return (
                                <tr
                                    key={q.id}
                                    className="border-t border-border transition-colors hover:bg-muted/50"
                                    style={{ borderLeft: `4px solid ${accentColor}` }}
                                >
                                    <td className="px-3 py-2 font-mono"
                                        style={{ borderLeft: `2px solid ${accentColor}40` }}>
                                        <div className="inline-flex items-center gap-1 group">
                                            <Link
                                                href={`/penawaran/${q.id}`}
                                                className="hover:underline font-semibold"
                                                style={{ color: accentColor }}
                                            >
                                                {q.invoiceNumber}
                                            </Link>
                                            {/* Tombol edit nomor — muncul hover, hanya untuk yang sudah di-assign (bukan DRAFT) */}
                                            {!q.invoiceNumber.startsWith("DRAFT-") && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditNumber(q)}
                                                    disabled={editNumberMut.isPending}
                                                    title={`Edit nomor ${q.type === 'INVOICE' ? 'invoice' : 'penawaran'}`}
                                                    className="opacity-0 group-hover:opacity-100 transition p-0.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-50 cursor-pointer"
                                                >
                                                    <Pencil className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                        {q.revisionNumber > 0 && (
                                            <span className="ml-2 text-xs bg-destructive/12 text-destructive px-1.5 rounded">Rev. {q.revisionNumber}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-1">
                                            <BrandBadge brand={q.brand} size="xs" />
                                            {q.language === 'en' && (
                                                <span
                                                    className="text-[10px] px-1 py-0.5 rounded bg-info/15 text-info border border-info/30 font-bold"
                                                    title="Surat dalam Bahasa Inggris"
                                                >
                                                    🇬🇧 EN
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        {(() => {
                                            const cfg = q.variantCode ? variantConfigMap.get(q.variantCode) : null;
                                            const label = cfg?.label
                                                || (q.quotationVariant ? VARIANT_LABEL[q.quotationVariant] : "-");
                                            const color = cfg?.color || "#6366f1";
                                            return (
                                                <span
                                                    className="text-xs px-2 py-0.5 rounded font-medium border"
                                                    style={{
                                                        backgroundColor: `${color}20`,
                                                        color,
                                                        borderColor: `${color}40`,
                                                    }}
                                                >
                                                    {label}
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="font-medium">{q.clientCompany || q.clientName}</div>
                                        {q.projectName && <div className="text-xs text-muted-foreground">{q.projectName}</div>}
                                    </td>
                                    <td className="px-3 py-2 text-xs">
                                        {q.signedByWorker ? (
                                            <div className="flex flex-col">
                                                <span className="font-medium text-foreground">{q.signedByWorker.name}</span>
                                                {q.signedByWorker.position && <span className="text-[10px] text-muted-foreground">{q.signedByWorker.position}</span>}
                                                {!q.signedByWorker.signatureImageUrl && (
                                                    <span className="text-[10px] text-warning mt-0.5 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> TTD belum ada</span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground italic">— belum dipilih —</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground">{dayjs(q.date).format("DD MMM YYYY")}</td>
                                    <td className="px-3 py-2 text-right font-medium nums">
                                        {/* Untuk Invoice → tampil amountToPay (DP/Pelunasan/Full sesuai invoicePart),
                                            karena total quotation utuh tidak relevan saat ini invoice cuma menagih sebagian.
                                            Untuk Penawaran → tampil total grand quotation. */}
                                        {q.type === "INVOICE" ? (() => {
                                            // Kalau ada "DP Sudah Dibayar" (mode custom), Total = Total proyek − DP
                                            // (= grand total setelah DP), konsisten dgn "Jumlah Ditagih" di preview.
                                            // Tanpa DP, pakai amountToPay (DP/Pelunasan/Full) apa adanya.
                                            const dpPaid = q.dpPaidMode === "custom" ? Number(q.dpPaidCustom ?? 0) : 0;
                                            const net = dpPaid > 0
                                                ? Math.max(0, Number(q.total) - dpPaid)
                                                : Number(q.amountToPay ?? q.total);
                                            return (
                                            <div className="flex flex-col items-end">
                                                <span>{rp(net)}</span>
                                                {q.invoicePart && (
                                                    <span className="text-[10px] text-muted-foreground font-normal">
                                                        {q.invoicePart === "DP" ? "Down Payment" :
                                                         q.invoicePart === "PELUNASAN" ? "Final Payment" :
                                                         q.invoicePart === "FULL" ? "Full Payment" : q.invoicePart}
                                                    </span>
                                                )}
                                                {dpPaid > 0 && (
                                                    <span className="text-[10px] text-warning font-normal nums">
                                                        DP dibayar: -{rp(dpPaid)}
                                                    </span>
                                                )}
                                                {Number((q as any).paidAmount ?? 0) > 0 && (
                                                    <span className="text-[10px] text-success font-normal nums">
                                                        Terbayar: {rp((q as any).paidAmount)}
                                                    </span>
                                                )}
                                            </div>
                                            );
                                        })() : (
                                            rp(q.total)
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLOR[q.status] || "bg-muted text-muted-foreground"}`}>
                                            {q.status}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => handlePreview(q)}
                                                title="Preview surat penawaran"
                                                className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors cursor-pointer"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        type="button"
                                                        title="Aksi lainnya"
                                                        aria-label="Aksi lainnya"
                                                        className="p-1.5 text-muted-foreground hover:bg-muted rounded transition-colors cursor-pointer data-[state=open]:bg-muted"
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/penawaran/${q.id}`}>
                                                            <Pencil /> Detail / Edit
                                                        </Link>
                                                    </DropdownMenuItem>

                                                    {q.invoiceNumber.startsWith("DRAFT-") && (
                                                        <DropdownMenuItem onSelect={() => assignMut.mutate(q.id)}>
                                                            <Hash /> Assign Nomor
                                                        </DropdownMenuItem>
                                                    )}
                                                    {!q.invoiceNumber.startsWith("DRAFT-") && q.type !== "INVOICE" && (
                                                        <DropdownMenuItem onSelect={() => reviseMut.mutate(q.id)}>
                                                            <GitBranch /> Buat Revisi
                                                        </DropdownMenuItem>
                                                    )}
                                                    {q.type !== "INVOICE" && (
                                                        <DropdownMenuItem
                                                            onSelect={() => {
                                                                if (confirm(`Duplicate Penawaran ${q.invoiceNumber}?\n\nAkan dibuat Penawaran BARU (terpisah) dengan data yang sama. Cocok untuk klien lain dengan kebutuhan serupa.`)) {
                                                                    duplicateMut.mutate(q.id);
                                                                }
                                                            }}
                                                        >
                                                            <Copy /> Duplicate
                                                        </DropdownMenuItem>
                                                    )}

                                                    {q.type === "INVOICE" && !q.invoiceNumber.startsWith("DRAFT-") && q.status !== "CANCELLED" && q.status !== "PAID" && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            {q.status === "DRAFT" && (
                                                                <DropdownMenuItem onSelect={() => handleMarkSent(q)}>
                                                                    <Send /> Tandai Sent
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem onSelect={() => setMarkPaidTarget(q)}>
                                                                <CheckCircle2 /> Tandai Pembayaran Masuk
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem variant="destructive" onSelect={() => handleCancelInvoice(q)}>
                                                                <XCircle /> Cancel Invoice
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                    {q.type === "INVOICE" && (q.status === "PAID" || q.status === "PARTIALLY_PAID" || Number((q as any).paidAmount ?? 0) > 0) && (
                                                        <DropdownMenuItem onSelect={() => setPaymentDetailTarget(q)}>
                                                            <Receipt /> Detail Pembayaran
                                                        </DropdownMenuItem>
                                                    )}

                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuLabel>Export</DropdownMenuLabel>
                                                    <DropdownMenuItem onSelect={() => handleExport(q.id, "pdf", q.invoiceNumber)}>
                                                        <FileDown /> Export PDF
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => handleExport(q.id, "spk-pdf", q.invoiceNumber)}>
                                                        <ScrollText /> Export SPK
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => handleExport(q.id, "docx", q.invoiceNumber)}>
                                                        <FileText /> Export DOCX
                                                    </DropdownMenuItem>

                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        onSelect={() => {
                                                            if (confirm(`Hapus penawaran ${q.invoiceNumber}?`)) deleteMut.mutate(q.id);
                                                        }}
                                                    >
                                                        <Trash2 /> Hapus
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </div>
                    {totalItems > PAGE_SIZE && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 py-2.5 border-t border-border">
                            <span className="text-xs text-muted-foreground">
                                Menampilkan <b className="text-foreground nums">{(currentPage - 1) * PAGE_SIZE + 1}</b>–<b className="text-foreground nums">{Math.min(currentPage * PAGE_SIZE, totalItems)}</b> dari <b className="text-foreground nums">{totalItems}</b> dokumen
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage <= 1}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                >
                                    <ChevronLeft className="w-4 h-4" /> Sebelumnya
                                </button>
                                <span className="px-2 text-xs text-muted-foreground nums">Hal. {currentPage}/{totalPages}</span>
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                >
                                    Berikutnya <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {showCreate && (
                <CreateQuotationModal
                    onClose={() => { setShowCreate(false); setPresetCustomer(null); }}
                    onSubmit={(data) => createMut.mutate(data)}
                    isPending={createMut.isPending}
                    presetCustomer={presetCustomer}
                    defaultType={typeFilter === 'INVOICE' ? 'INVOICE' : 'QUOTATION'}
                />
            )}

            {/* ─── Preview Modal (PDF iframe inline) ─── */}
            {previewQ && (
                <div
                    className="fixed inset-0 z-[100] bg-black/70 flex flex-col"
                    onClick={(e) => { if (e.target === e.currentTarget) closePreview(); }}
                >
                    <div className="bg-card border-b border-border px-4 py-2.5 flex items-center justify-between gap-3 shadow-sm">
                        <div className="flex items-center gap-2">
                            {previewType === "spk-pdf" ? (
                                <ScrollText className="h-5 w-5 text-success" />
                            ) : (
                                <Eye className="h-5 w-5 text-primary" />
                            )}
                            <div>
                                <h2 className="font-bold text-foreground">
                                    {previewType === "spk-pdf"
                                        ? "Preview SPK"
                                        : previewQ.type === 'INVOICE'
                                            ? "Preview Invoice"
                                            : "Preview Penawaran"}
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    {previewQ.invoiceNumber}
                                    {previewQ.brand && <span> · Brand {previewQ.brand}</span>}
                                    {previewQ.clientName && <span> · {previewQ.clientName}</span>}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Type switcher: Penawaran/Invoice ↔ SPK */}
                            <div className="inline-flex gap-0.5 bg-muted p-0.5 rounded-md border border-border" title="Pilih dokumen yang di-preview">
                                <button
                                    type="button"
                                    onClick={() => switchPreviewType("pdf")}
                                    disabled={previewLoading}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-50 cursor-pointer ${previewType === 'pdf'
                                        ? 'bg-card text-primary shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    {previewQ.type === 'INVOICE' ? <><Receipt className="w-3.5 h-3.5" /> Invoice</> : <><FileText className="w-3.5 h-3.5" /> Penawaran</>}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => switchPreviewType("spk-pdf")}
                                    disabled={previewLoading}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-50 cursor-pointer ${previewType === 'spk-pdf'
                                        ? 'bg-card text-success shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    <ScrollText className="w-3.5 h-3.5" /> SPK
                                </button>
                            </div>
                            <button
                                onClick={() => handleExport(previewQ.id, previewType, previewQ.invoiceNumber)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${previewType === 'spk-pdf' ? 'bg-success hover:bg-success/90 text-success-foreground' : 'bg-primary hover:bg-primary/90 text-white'} rounded-md text-sm font-semibold shadow-sm transition-colors cursor-pointer`}
                            >
                                <Download className="h-4 w-4" /> Download {previewType === 'spk-pdf' ? 'SPK' : 'PDF'}
                            </button>
                            {previewType === "pdf" && (
                                <button
                                    onClick={() => handleExport(previewQ.id, "docx", previewQ.invoiceNumber)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-info hover:bg-info/90 text-info-foreground rounded-md text-sm font-semibold shadow-sm transition-colors cursor-pointer"
                                >
                                    <FileText className="h-4 w-4" /> DOCX
                                </button>
                            )}
                            <button
                                onClick={closePreview}
                                className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                                aria-label="Tutup"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 bg-muted overflow-hidden flex items-center justify-center">
                        {previewLoading ? (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <span className="text-sm">Membuat preview PDF...</span>
                            </div>
                        ) : previewUrl ? (
                            <iframe
                                src={previewUrl}
                                className="w-full h-full bg-white"
                                title="Preview PDF"
                            />
                        ) : (
                            <div className="text-muted-foreground text-sm">Tidak ada preview</div>
                        )}
                    </div>
                </div>
            )}

            {/* Mark Paid Modal — admin record pembayaran masuk untuk Invoice */}
            {markPaidTarget && (
                <MarkPaidModal
                    invoice={markPaidTarget}
                    onClose={() => setMarkPaidTarget(null)}
                    pending={markPaidMut.isPending}
                    onSubmit={async (payload) => {
                        await markPaidMut.mutateAsync({ id: markPaidTarget.id, data: payload });
                    }}
                />
            )}

            {/* Payment Detail Modal — read-only view detail pembayaran + bukti transfer */}
            {paymentDetailTarget && (
                <PaymentDetailModal
                    invoice={paymentDetailTarget}
                    onClose={() => setPaymentDetailTarget(null)}
                />
            )}
        </div>
    );
}

function CreateQuotationModal(props: {
    onClose: () => void;
    onSubmit: (data: any) => void;
    isPending: boolean;
    presetCustomer?: Customer | null;
    /** Tipe dokumen default. 'INVOICE' = invoice langsung tanpa penawaran. */
    defaultType?: 'QUOTATION' | 'INVOICE';
}) {
    const isInvoiceMode = props.defaultType === 'INVOICE';
    // ─── Invoice-specific state (cuma dipakai kalau isInvoiceMode) ──
    const [invoicePart, setInvoicePart] = useState<'DP' | 'PELUNASAN' | 'FULL'>('FULL');
    const [dueDate, setDueDate] = useState<string>("");
    const [dpPercentInvoice, setDpPercentInvoice] = useState<number>(50);
    const { data: variantConfigs = [] } = useQuery({
        queryKey: ["quotation-variants", false],
        queryFn: () => listQuotationVariants(false),
    });

    const [variantCode, setVariantCode] = useState<string>("");
    // Auto-pick first variant saat data loaded (kalau belum ada pilihan)
    useEffect(() => {
        if (!variantCode && variantConfigs.length > 0) {
            const last = (() => { try { return localStorage.getItem("pospro:quotation:lastVariant"); } catch { return null; } })();
            const found = (last && variantConfigs.find((v) => v.code === last)) || variantConfigs[0];
            setVariantCode(found.code);
        }
    }, [variantConfigs, variantCode]);

    const selectedVariant = variantConfigs.find((v) => v.code === variantCode);

    // Marketers untuk dropdown penandatangan
    const { data: marketers = [] } = useQuery({
        queryKey: ["workers", "marketers-signing-modal"],
        queryFn: () => getWorkers(false, { positions: [...MARKETER_POSITIONS] }),
    });
    const [signedByWorkerId, setSignedByWorkerId] = useState<number | null>(null);
    useEffect(() => {
        // Auto-pick first marketer cuma untuk PENAWARAN (wajib). Invoice mandiri: biarkan null (opsional).
        if (signedByWorkerId === null && marketers.length > 0 && !isInvoiceMode) {
            const last = (() => { try { return localStorage.getItem("pospro:quotation:lastSignedBy"); } catch { return null; } })();
            const lastId = last ? parseInt(last, 10) : null;
            const found = (lastId && marketers.find((m) => m.id === lastId)) || marketers[0];
            setSignedByWorkerId(found.id);
        }
    }, [marketers, signedByWorkerId, isInvoiceMode]);

    // Admin untuk dropdown penandatangan — cuma dipakai untuk invoice mandiri (admin TTD invoice/finance).
    const { data: admins = [] } = useQuery({
        queryKey: ["workers", "admin-signing-modal"],
        queryFn: () => getWorkers(false, { positions: ['ADMIN'] }),
        enabled: isInvoiceMode,
    });
    const [signedByAdminId, setSignedByAdminId] = useState<number | null>(null);
    const [brand, setBrand] = useState<Brand>(() => {
        try {
            const v = localStorage.getItem("pospro:quotation:lastBrand");
            if (v === "EXINDO" || v === "XPOSER") return v;
        } catch { /* ignore */ }
        return "EXINDO";
    });
    const [pickedCustomer, setPickedCustomer] = useState<Customer | null>(props.presetCustomer ?? null);
    const [showCustomerPicker, setShowCustomerPicker] = useState(false);
    const [clientName, setClientName] = useState(props.presetCustomer?.companyPIC || props.presetCustomer?.name || "");
    const [clientCompany, setClientCompany] = useState(props.presetCustomer?.companyName || "");
    const [clientAddress, setClientAddress] = useState(props.presetCustomer?.address || "");
    const [clientPhone, setClientPhone] = useState(props.presetCustomer?.phone || "");
    const [clientEmail, setClientEmail] = useState(props.presetCustomer?.email || "");
    const [projectName, setProjectName] = useState("");
    const [eventLocation, setEventLocation] = useState("");

    // Helper: pakai data customer untuk fill semua field klien
    function applyCustomer(c: Customer) {
        setPickedCustomer(c);
        setClientName(c.companyPIC || c.name || "");
        setClientCompany(c.companyName || "");
        setClientAddress(c.address || "");
        setClientPhone(c.phone || "");
        setClientEmail(c.email || "");
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    {isInvoiceMode ? <><Receipt className="w-5 h-5 text-destructive" /> Buat Invoice Langsung</> : "Buat Penawaran Baru"}
                </h2>
                {isInvoiceMode && (
                    <p className="text-xs text-muted-foreground mb-4 -mt-3">
                        Invoice mandiri tanpa proses penawaran. Nomor langsung di-issue format <code>Inv/XXX/YY</code>.
                    </p>
                )}
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-semibold mb-1.5">
                            Brand / Perusahaan <span className="text-destructive">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {ACTIVE_BRANDS.map((b) => {
                                const meta = BRAND_META[b];
                                const active = brand === b;
                                return (
                                    <button
                                        key={b}
                                        type="button"
                                        onClick={() => setBrand(b)}
                                        className={`p-3 rounded-lg border-2 transition flex items-center gap-2 ${active
                                            ? `${meta.bg} ${meta.border}`
                                            : "bg-card border-border hover:border-border/80"
                                            }`}
                                    >
                                        <span className="text-2xl">{meta.emoji}</span>
                                        <div className="text-left flex-1 min-w-0">
                                            <div className={`text-sm font-bold ${active ? meta.text : "text-foreground"}`}>
                                                {meta.short}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground truncate">{meta.label}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Brand menentukan kop surat & nomor seri penawaran.
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Varian Penawaran <span className="text-destructive">*</span>
                        </label>
                        <select
                            value={variantCode}
                            onChange={(e) => setVariantCode(e.target.value)}
                            className="w-full border border-border rounded-md px-3 py-2 bg-background focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
                            disabled={variantConfigs.length === 0}
                        >
                            {variantConfigs.length === 0 && (
                                <option value="">Memuat...</option>
                            )}
                            {variantConfigs.map((v) => (
                                <option key={v.code} value={v.code}>{v.label}</option>
                            ))}
                        </select>
                        {selectedVariant?.description && (
                            <p className="text-[11px] text-muted-foreground mt-1">{selectedVariant.description}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Belum ada varian yang sesuai? <Link href="/settings/quotation-variants" className="text-primary hover:underline">Tambah varian baru</Link>
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Marketing yang Menandatangani {!isInvoiceMode && <span className="text-destructive">*</span>}
                            {isInvoiceMode && <span className="text-[11px] font-normal text-muted-foreground"> (opsional)</span>}
                        </label>
                        <select
                            value={signedByWorkerId ?? ""}
                            onChange={(e) => setSignedByWorkerId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full border border-border rounded-md px-3 py-2 bg-background focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
                            disabled={marketers.length === 0}
                        >
                            <option value="">— {isInvoiceMode ? "Tidak ada / pakai Admin" : "Pilih Marketing"} —</option>
                            {marketers.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.name}{m.position ? ` · ${m.position}` : ""}
                                    {!m.signatureImageUrl ? " ⚠ TTD belum ada" : ""}
                                </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            TTD & stempel ngikut yang dipilih. Ingat last-used otomatis (per browser).
                            {marketers.length === 0 && <> · <Link href="/settings/workers" className="text-primary hover:underline">Tambah marketing</Link></>}
                        </p>
                    </div>
                    {/* ── Customer Picker — auto-fill nama / perusahaan / alamat / telp / email ── */}
                    <div className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-primary inline-flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5" />
                                    Pilih dari Data Pelanggan
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                    Pilih klien terdaftar atau tambah baru — semua kolom di bawah otomatis terisi
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCustomerPicker(true)}
                                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
                            >
                                <Search className="h-3.5 w-3.5" />
                                {pickedCustomer ? "Ganti Klien" : "Pilih Klien"}
                            </button>
                        </div>
                        {pickedCustomer && (
                            <div className="rounded-md bg-card border border-primary/30 p-2 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1 text-xs">
                                    <div className="font-semibold truncate">{pickedCustomer.companyName || pickedCustomer.name}</div>
                                    <div className="text-muted-foreground truncate">
                                        {pickedCustomer.companyName && pickedCustomer.name && <span>{pickedCustomer.name}</span>}
                                        {pickedCustomer.companyPIC && <span> · PIC {pickedCustomer.companyPIC}</span>}
                                        {pickedCustomer.phone && <span> · {pickedCustomer.phone}</span>}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPickedCustomer(null);
                                        setClientName(""); setClientCompany(""); setClientAddress("");
                                        setClientPhone(""); setClientEmail("");
                                    }}
                                    className="shrink-0 p-1 hover:bg-destructive/10 text-destructive rounded transition-colors cursor-pointer"
                                    title="Lepas klien (isi manual)"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Nama PIC Klien <span className="text-destructive">*</span></label>
                        <input
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            className="w-full border border-border rounded-md px-3 py-2 bg-background focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
                            placeholder="Contoh: Bpk. Marco"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Nama Perusahaan / Instansi</label>
                        <input
                            value={clientCompany}
                            onChange={(e) => setClientCompany(e.target.value)}
                            className="w-full border border-border rounded-md px-3 py-2 bg-background focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
                            placeholder="PT / CV / event organizer"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium mb-1">No. Telepon</label>
                            <input
                                value={clientPhone}
                                onChange={(e) => setClientPhone(e.target.value)}
                                className="w-full border rounded-md px-3 py-2"
                                placeholder="08xxxxxxxxxx"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Email</label>
                            <input
                                type="email"
                                value={clientEmail}
                                onChange={(e) => setClientEmail(e.target.value)}
                                className="w-full border rounded-md px-3 py-2"
                                placeholder="email@domain.com"
                            />
                        </div>
                    </div>
                    {/* Anti-duplikat: instant lookup berdasarkan nama ATAU nomor HP yang sedang di-input */}
                    {!pickedCustomer && (
                        <PhoneDuplicateBanner
                            phone={clientPhone}
                            name={clientName || clientCompany}
                            onUseCustomer={(c) => applyCustomer(c as unknown as Customer)}
                            compact
                        />
                    )}
                    <div>
                        <label className="block text-sm font-medium mb-1">Alamat</label>
                        <input
                            value={clientAddress}
                            onChange={(e) => setClientAddress(e.target.value)}
                            className="w-full border border-border rounded-md px-3 py-2 bg-background focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
                            placeholder="Alamat lengkap klien"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Nama Proyek/Event</label>
                        <input
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            className="w-full border border-border rounded-md px-3 py-2 bg-background focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
                            placeholder="Summer Musik Festival, PETFEST, dll."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Lokasi Event</label>
                        <input
                            value={eventLocation}
                            onChange={(e) => setEventLocation(e.target.value)}
                            className="w-full border border-border rounded-md px-3 py-2 bg-background focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
                            placeholder="JEC, ICE BSD, dll."
                        />
                    </div>
                </div>
                {/* ─── Detail Invoice — cuma untuk mode INVOICE langsung ─── */}
                {isInvoiceMode && (
                    <div className="mt-3 rounded-lg border-2 border-pink-200 bg-pink-50/50 p-3 space-y-3">
                        <div className="text-xs font-bold text-pink-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5" /> Detail Invoice
                        </div>
                        <div>
                            <label className="block text-xs font-semibold mb-1.5">
                                Admin yang Menandatangani <span className="text-[11px] font-normal text-muted-foreground">(opsional)</span>
                            </label>
                            <select
                                value={signedByAdminId ?? ""}
                                onChange={(e) => setSignedByAdminId(e.target.value ? Number(e.target.value) : null)}
                                className="w-full border border-pink-200 rounded-md px-2 py-1.5 text-sm bg-background"
                                disabled={admins.length === 0}
                            >
                                <option value="">— Tidak ada admin —</option>
                                {admins.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}{a.position ? ` · ${a.position}` : ""}
                                        {!a.signatureImageUrl ? " ⚠ TTD belum ada" : ""}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[10px] text-pink-700 mt-0.5">
                                Admin/Finance biasanya TTD invoice (vs Marketing untuk penawaran). Kosongkan kalau pakai Marketing di atas atau tanpa TTD.
                                {admins.length === 0 && <> · <Link href="/settings/workers" className="text-destructive hover:underline">Tambah admin</Link></>}
                            </p>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold mb-1.5">Tipe Invoice</label>
                            <div className="grid grid-cols-3 gap-1.5">
                                {(['DP', 'PELUNASAN', 'FULL'] as const).map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setInvoicePart(p)}
                                        className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-bold border-2 transition cursor-pointer ${invoicePart === p
                                            ? 'bg-destructive text-white border-destructive'
                                            : 'bg-card text-foreground border-border hover:border-destructive/30'
                                            }`}
                                    >
                                        {p === 'DP' ? <><Wallet className="w-3.5 h-3.5" /> DP</> : p === 'PELUNASAN' ? <><CheckCircle2 className="w-3.5 h-3.5" /> Pelunasan</> : 'Full'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {invoicePart === 'DP' && (
                            <div>
                                <label className="block text-xs font-semibold mb-1">DP Persentase (%)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    step="0.5"
                                    value={dpPercentInvoice}
                                    onChange={(e) => setDpPercentInvoice(parseFloat(e.target.value) || 50)}
                                    className="w-full border-2 border-pink-200 rounded-md px-2 py-1.5 text-sm font-mono text-right focus:border-pink-500 outline-none bg-background"
                                />
                                <p className="text-[10px] text-pink-700 mt-0.5">Persentase DP dari total invoice. Sisa = pelunasan nanti.</p>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-semibold mb-1">Jatuh Tempo</label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="w-full border-2 border-pink-200 rounded-md px-2 py-1.5 text-sm focus:border-pink-500 outline-none bg-background"
                            />
                            <p className="text-[10px] text-pink-700 mt-0.5">Opsional. Bisa di-edit nanti.</p>
                        </div>
                        <p className="text-[11px] text-pink-700 border-t border-pink-200 pt-2 flex items-center gap-1">
                            <Lightbulb className="w-3.5 h-3.5 shrink-0" /> Items, harga, &amp; total ditambahkan setelah invoice tercipta (halaman detail).
                        </p>
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={props.onClose}
                        className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors cursor-pointer"
                    >
                        Batal
                    </button>
                    <button
                        disabled={!clientName || !variantCode || props.isPending}
                        onClick={() => {
                            try {
                                localStorage.setItem("pospro:quotation:lastBrand", brand);
                                localStorage.setItem("pospro:quotation:lastVariant", variantCode);
                                if (signedByWorkerId) localStorage.setItem("pospro:quotation:lastSignedBy", String(signedByWorkerId));
                            } catch { /* ignore */ }
                            const enumVal: QuotationVariant = selectedVariant?.templateKey === "sewa" ? "SEWA" : "PENGADAAN_BOOTH";
                            // Untuk invoice mode: prioritas Admin > Marketing > null (kedua-nya opsional)
                            const finalSignerId = isInvoiceMode
                                ? (signedByAdminId ?? signedByWorkerId ?? null)
                                : signedByWorkerId;
                            props.onSubmit({
                                // Invoice mandiri vs Penawaran biasa
                                ...(isInvoiceMode ? {
                                    type: 'INVOICE',
                                    invoicePart,
                                    dueDate: dueDate || null,
                                    // dpPercent berlaku untuk semua tipe; saat INVOICE DP, jadi base hitung amountToPay nanti
                                    dpPercent: invoicePart === 'DP' ? dpPercentInvoice : undefined,
                                } : {}),
                                quotationVariant: enumVal,
                                variantCode,
                                brand,
                                signedByWorkerId: finalSignerId,
                                customerId: pickedCustomer?.id ?? null,
                                clientName,
                                clientCompany: clientCompany || undefined,
                                clientAddress: clientAddress || undefined,
                                clientPhone: clientPhone || undefined,
                                clientEmail: clientEmail || undefined,
                                projectName: projectName || undefined,
                                eventLocation: eventLocation || undefined,
                                ...(isInvoiceMode ? {} : {
                                    dpPercent: selectedVariant ? Number(selectedVariant.defaultDpPercent) : undefined,
                                }),
                            });
                        }}
                        className={`px-4 py-2 ${isInvoiceMode ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'} text-white rounded-md disabled:opacity-50 transition-colors cursor-pointer`}
                    >
                        {props.isPending ? "Menyimpan..." : (isInvoiceMode ? "Buat Invoice" : "Simpan &amp; Lanjut")}
                    </button>
                </div>
            </div>

            {/* Overlay: customer picker (di atas create modal) */}
            {showCustomerPicker && (
                <CustomerPickerModal
                    onClose={() => setShowCustomerPicker(false)}
                    onPick={(c) => {
                        applyCustomer(c);
                        setShowCustomerPicker(false);
                    }}
                />
            )}
        </div>
    );
}
