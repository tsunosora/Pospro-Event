"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus, FileText, FileDown, Pencil, Trash2, Loader2, GitBranch, Hash, Eye, X, Download, Users, Search,
} from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/id";
import {
    getQuotations, createQuotation, deleteQuotation,
    assignQuotationNumber, reviseQuotation, downloadQuotationExport,
    backfillQuotationStatus,
    type Quotation, type QuotationVariant,
} from "@/lib/api/quotations";
import { ACTIVE_BRANDS, BRAND_META, type Brand } from "@/lib/api/brands";
import { BrandBadge } from "@/components/BrandBadge";
import { listQuotationVariants, type QuotationVariantConfig } from "@/lib/api/quotation-variants";
import { getWorkers, MARKETER_POSITIONS } from "@/lib/api/workers";
import { getCustomer, type Customer } from "@/lib/api/customers";
import { CustomerPickerModal } from "@/components/CustomerPickerModal";
import { DateRangeFilter, presetToRange, type DateRange } from "@/components/DateRangeFilter";

dayjs.locale("id");

const VARIANT_LABEL: Record<QuotationVariant, string> = {
    SEWA: "Sewa Perlengkapan Event",
    PENGADAAN_BOOTH: "Pengadaan Booth Special Design",
};

const STATUS_COLOR: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    SENT: "bg-blue-100 text-blue-700",
    ACCEPTED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    EXPIRED: "bg-yellow-100 text-yellow-700",
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
    const [showCreate, setShowCreate] = useState(false);
    const [previewQ, setPreviewQ] = useState<Quotation | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

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

    const handlePreview = async (q: Quotation) => {
        setPreviewQ(q);
        setPreviewLoading(true);
        try {
            const blob = await downloadQuotationExport(q.id, "pdf");
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(URL.createObjectURL(blob));
        } catch (err: any) {
            alert("Gagal preview: " + (err?.response?.data?.message || err.message));
            setPreviewQ(null);
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

    const reviseMut = useMutation({
        mutationFn: reviseQuotation,
        onSuccess: (q: Quotation) => {
            qc.invalidateQueries({ queryKey: ["quotations"] });
            window.location.href = `/penawaran/${q.id}`;
        },
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

    const handleExport = async (id: number, format: "pdf" | "docx", invoiceNumber: string) => {
        try {
            const blob = await downloadQuotationExport(id, format);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Penawaran_${invoiceNumber.replace(/[^a-zA-Z0-9._-]+/g, "_")}.${format}`;
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

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileText className="w-6 h-6" /> Penawaran Booth &amp; Event
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Kelola dokumen Penawaran Sewa Perlengkapan Event &amp; Pengadaan Booth Special Design
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleBackfillStatus}
                        disabled={backfillStatusMut.isPending}
                        title="Fix data lama: penawaran yang sudah punya nomor resmi tapi status masih DRAFT → ubah ke SENT"
                        className="flex items-center gap-2 px-3 py-2 border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {backfillStatusMut.isPending ? "Memproses..." : "🔧 Fix Status Lama"}
                    </button>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                    >
                        <Plus className="w-4 h-4" /> Buat Penawaran
                    </button>
                </div>
            </div>

            {/* Search bar */}
            <div className="mb-4 flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[260px] max-w-2xl">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari nomor, klien, perusahaan, project, lokasi, catatan…"
                        className="w-full pl-10 pr-10 py-2.5 text-sm rounded-lg border-2 border-border bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-muted"
                            aria-label="Bersihkan pencarian"
                        >
                            <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                    )}
                </div>
                {search && (
                    <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                        <strong>{quotations.length}</strong>/{allQuotations.length} cocok
                    </span>
                )}
            </div>

            {/* Tab tipe dokumen: Penawaran / Invoice / Semua */}
            <div className="mb-3 inline-flex gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                    onClick={() => setTypeFilter('QUOTATION')}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${typeFilter === 'QUOTATION'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    📄 Penawaran
                </button>
                <button
                    onClick={() => setTypeFilter('INVOICE')}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${typeFilter === 'INVOICE'
                        ? 'bg-white text-pink-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    📑 Invoice
                </button>
                <button
                    onClick={() => setTypeFilter('ALL')}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${typeFilter === 'ALL'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    Semua
                </button>
            </div>

            {/* Filter varian — dinamis dari /settings/quotation-variants */}
            <div className="flex gap-2 mb-4 flex-wrap items-center">
                <button
                    onClick={() => setVariantFilter("")}
                    className={`px-3 py-1.5 rounded-md text-sm font-semibold transition ${variantFilter === ""
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 hover:bg-gray-200 text-slate-700"
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
                            className="px-3 py-1.5 rounded-md text-sm font-semibold transition border-2"
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
                    className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-violet-700 border border-dashed border-violet-300 hover:bg-violet-50"
                    title="Kelola daftar varian penawaran"
                >
                    <Plus className="h-3.5 w-3.5" /> Tambah Varian
                </Link>
            </div>

            {/* Filter Tanggal — preset (Hari Ini, Kemarin, Minggu Ini, dll) + custom range */}
            <div className="mb-4">
                <DateRangeFilter value={dateRange} onChange={setDateRange} label="Tanggal Dokumen" />
                {dateRange.preset !== "ALL" && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                        Menampilkan <b>{quotations.length}</b> dari {allQuotations.length} dokumen
                    </p>
                )}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16 text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...
                </div>
            ) : quotations.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
                    Belum ada penawaran. Klik "Buat Penawaran" untuk mulai.
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-700 text-left">
                            <tr>
                                <th className="px-3 py-2">No. Penawaran</th>
                                <th className="px-3 py-2">Brand</th>
                                <th className="px-3 py-2">Varian</th>
                                <th className="px-3 py-2">Klien / Proyek</th>
                                <th className="px-3 py-2">Marketing</th>
                                <th className="px-3 py-2">Tanggal</th>
                                <th className="px-3 py-2 text-right">Total</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quotations.map((q) => {
                                const bm = q.brand ? BRAND_META[q.brand] : null;
                                const accentColor = bm?.color ?? "#94a3b8"; // slate-400 default
                                return (
                                <tr
                                    key={q.id}
                                    className="border-t transition-colors"
                                    style={{
                                        borderLeft: `4px solid ${accentColor}`,
                                        backgroundColor: bm ? `${accentColor}06` : undefined, // sangat tipis (~3% opacity hex)
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = bm ? `${accentColor}15` : "#f9fafb";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = bm ? `${accentColor}06` : "transparent";
                                    }}
                                >
                                    <td className="px-3 py-2 font-mono"
                                        style={{ borderLeft: `2px solid ${accentColor}40` }}>
                                        <Link
                                            href={`/penawaran/${q.id}`}
                                            className="hover:underline font-semibold"
                                            style={{ color: accentColor }}
                                        >
                                            {q.invoiceNumber}
                                        </Link>
                                        {q.revisionNumber > 0 && (
                                            <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 rounded">Rev. {q.revisionNumber}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        <BrandBadge brand={q.brand} size="xs" />
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
                                        {q.projectName && <div className="text-xs text-gray-500">{q.projectName}</div>}
                                    </td>
                                    <td className="px-3 py-2 text-xs">
                                        {q.signedByWorker ? (
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-800">{q.signedByWorker.name}</span>
                                                {q.signedByWorker.position && <span className="text-[10px] text-muted-foreground">{q.signedByWorker.position}</span>}
                                                {!q.signedByWorker.signatureImageUrl && (
                                                    <span className="text-[10px] text-amber-700 mt-0.5">⚠ TTD belum ada</span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground italic">— belum dipilih —</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600">{dayjs(q.date).format("DD MMM YYYY")}</td>
                                    <td className="px-3 py-2 text-right font-medium">{rp(q.total)}</td>
                                    <td className="px-3 py-2">
                                        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLOR[q.status] || "bg-gray-100"}`}>
                                            {q.status}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center justify-end gap-1">
                                            {q.invoiceNumber.startsWith("DRAFT-") && (
                                                <button
                                                    onClick={() => assignMut.mutate(q.id)}
                                                    disabled={assignMut.isPending}
                                                    title="Assign Nomor"
                                                    className="p-1.5 text-green-700 hover:bg-green-50 rounded"
                                                >
                                                    <Hash className="w-4 h-4" />
                                                </button>
                                            )}
                                            {!q.invoiceNumber.startsWith("DRAFT-") && (
                                                <button
                                                    onClick={() => reviseMut.mutate(q.id)}
                                                    disabled={reviseMut.isPending}
                                                    title="Buat Revisi"
                                                    className="p-1.5 text-amber-700 hover:bg-amber-50 rounded"
                                                >
                                                    <GitBranch className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handlePreview(q)}
                                                title="Preview surat penawaran"
                                                className="p-1.5 text-violet-700 hover:bg-violet-50 rounded"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleExport(q.id, "pdf", q.invoiceNumber)}
                                                title="Export PDF"
                                                className="p-1.5 text-red-700 hover:bg-red-50 rounded"
                                            >
                                                <FileDown className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleExport(q.id, "docx", q.invoiceNumber)}
                                                title="Export DOCX"
                                                className="p-1.5 text-blue-700 hover:bg-blue-50 rounded"
                                            >
                                                <FileText className="w-4 h-4" />
                                            </button>
                                            <Link
                                                href={`/penawaran/${q.id}`}
                                                className="p-1.5 text-gray-700 hover:bg-gray-100 rounded"
                                                title="Detail / Edit"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Link>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Hapus penawaran ${q.invoiceNumber}?`)) deleteMut.mutate(q.id);
                                                }}
                                                disabled={deleteMut.isPending}
                                                title="Hapus"
                                                className="p-1.5 text-red-700 hover:bg-red-50 rounded"
                                            >
                                                <Trash2 className="w-4 h-4" />
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

            {showCreate && (
                <CreateQuotationModal
                    onClose={() => { setShowCreate(false); setPresetCustomer(null); }}
                    onSubmit={(data) => createMut.mutate(data)}
                    isPending={createMut.isPending}
                    presetCustomer={presetCustomer}
                />
            )}

            {/* ─── Preview Modal (PDF iframe inline) ─── */}
            {previewQ && (
                <div
                    className="fixed inset-0 z-[100] bg-black/70 flex flex-col"
                    onClick={(e) => { if (e.target === e.currentTarget) closePreview(); }}
                >
                    <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between gap-3 shadow-sm">
                        <div className="flex items-center gap-2">
                            <Eye className="h-5 w-5 text-violet-600" />
                            <div>
                                <h2 className="font-bold text-slate-900">Preview Penawaran</h2>
                                <p className="text-xs text-muted-foreground">
                                    {previewQ.invoiceNumber}
                                    {previewQ.brand && <span> · Brand {previewQ.brand}</span>}
                                    {previewQ.clientName && <span> · {previewQ.clientName}</span>}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleExport(previewQ.id, "pdf", previewQ.invoiceNumber)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-semibold"
                            >
                                <Download className="h-4 w-4" /> Download PDF
                            </button>
                            <button
                                onClick={() => handleExport(previewQ.id, "docx", previewQ.invoiceNumber)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold"
                            >
                                <FileText className="h-4 w-4" /> DOCX
                            </button>
                            <button
                                onClick={closePreview}
                                className="p-2 rounded-md hover:bg-slate-100 text-slate-700"
                                aria-label="Tutup"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 bg-slate-200 overflow-hidden flex items-center justify-center">
                        {previewLoading ? (
                            <div className="flex flex-col items-center gap-2 text-slate-600">
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
                            <div className="text-slate-500 text-sm">Tidak ada preview</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function CreateQuotationModal(props: {
    onClose: () => void;
    onSubmit: (data: any) => void;
    isPending: boolean;
    presetCustomer?: Customer | null;
}) {
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
        if (signedByWorkerId === null && marketers.length > 0) {
            const last = (() => { try { return localStorage.getItem("pospro:quotation:lastSignedBy"); } catch { return null; } })();
            const lastId = last ? parseInt(last, 10) : null;
            const found = (lastId && marketers.find((m) => m.id === lastId)) || marketers[0];
            setSignedByWorkerId(found.id);
        }
    }, [marketers, signedByWorkerId]);
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
            <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-bold mb-4">Buat Penawaran Baru</h2>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-semibold mb-1.5">
                            Brand / Perusahaan <span className="text-red-500">*</span>
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
                                            : "bg-white border-slate-200 hover:border-slate-300"
                                            }`}
                                    >
                                        <span className="text-2xl">{meta.emoji}</span>
                                        <div className="text-left flex-1 min-w-0">
                                            <div className={`text-sm font-bold ${active ? meta.text : "text-slate-700"}`}>
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
                            Varian Penawaran <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={variantCode}
                            onChange={(e) => setVariantCode(e.target.value)}
                            className="w-full border rounded-md px-3 py-2"
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
                            Belum ada varian yang sesuai? <Link href="/settings/quotation-variants" className="text-violet-600 hover:underline">Tambah varian baru</Link>
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Marketing yang Menandatangani <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={signedByWorkerId ?? ""}
                            onChange={(e) => setSignedByWorkerId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full border rounded-md px-3 py-2"
                            disabled={marketers.length === 0}
                        >
                            <option value="">— Pilih Marketing —</option>
                            {marketers.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.name}{m.position ? ` · ${m.position}` : ""}
                                    {!m.signatureImageUrl ? " ⚠ TTD belum ada" : ""}
                                </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            TTD & stempel ngikut yang dipilih. Ingat last-used otomatis (per browser).
                            {marketers.length === 0 && <> · <Link href="/settings/workers" className="text-blue-600 hover:underline">Tambah marketing</Link></>}
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
                            <div className="rounded-md bg-white border border-primary/30 p-2 flex items-center justify-between gap-2">
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
                                    className="shrink-0 p-1 hover:bg-red-50 text-red-600 rounded"
                                    title="Lepas klien (isi manual)"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Nama PIC Klien <span className="text-red-500">*</span></label>
                        <input
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            className="w-full border rounded-md px-3 py-2"
                            placeholder="Contoh: Bpk. Marco"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Nama Perusahaan / Instansi</label>
                        <input
                            value={clientCompany}
                            onChange={(e) => setClientCompany(e.target.value)}
                            className="w-full border rounded-md px-3 py-2"
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
                    <div>
                        <label className="block text-sm font-medium mb-1">Alamat</label>
                        <input
                            value={clientAddress}
                            onChange={(e) => setClientAddress(e.target.value)}
                            className="w-full border rounded-md px-3 py-2"
                            placeholder="Alamat lengkap klien"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Nama Proyek/Event</label>
                        <input
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            className="w-full border rounded-md px-3 py-2"
                            placeholder="Summer Musik Festival, PETFEST, dll."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Lokasi Event</label>
                        <input
                            value={eventLocation}
                            onChange={(e) => setEventLocation(e.target.value)}
                            className="w-full border rounded-md px-3 py-2"
                            placeholder="JEC, ICE BSD, dll."
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={props.onClose}
                        className="px-4 py-2 border rounded-md hover:bg-gray-50"
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
                            props.onSubmit({
                                quotationVariant: enumVal,
                                variantCode,
                                brand,
                                signedByWorkerId: signedByWorkerId ?? null,
                                customerId: pickedCustomer?.id ?? null,
                                clientName,
                                clientCompany: clientCompany || undefined,
                                clientAddress: clientAddress || undefined,
                                clientPhone: clientPhone || undefined,
                                clientEmail: clientEmail || undefined,
                                projectName: projectName || undefined,
                                eventLocation: eventLocation || undefined,
                                dpPercent: selectedVariant ? Number(selectedVariant.defaultDpPercent) : undefined,
                            });
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
                    >
                        {props.isPending ? "Menyimpan..." : "Simpan &amp; Lanjut"}
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
