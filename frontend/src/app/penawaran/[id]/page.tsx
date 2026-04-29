"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft, Plus, Trash2, Save, Hash, GitBranch, FileDown, FileText, Loader2,
    Eye, X, Download, Calculator,
} from "lucide-react";
import QuotationItemCalculator, { type QuotationCalcResult } from "./QuotationItemCalculator";
import dayjs from "dayjs";
import "dayjs/locale/id";
import {
    getQuotation, updateQuotation, assignQuotationNumber, reviseQuotation,
    downloadQuotationExport, generateInvoiceFromQuotation, listInvoicesByQuotation,
    type Quotation, type QuotationItem,
} from "@/lib/api/quotations";
import { Receipt } from "lucide-react";
import { ACTIVE_BRANDS, BRAND_META, type Brand } from "@/lib/api/brands";
import { listQuotationVariants } from "@/lib/api/quotation-variants";
import { getWorkers, MARKETER_POSITIONS } from "@/lib/api/workers";
import { getBankAccounts } from "@/lib/api/transactions";
import { CustomerPickerModal } from "@/components/CustomerPickerModal";
import type { Customer } from "@/lib/api/customers";
import { Users, Search } from "lucide-react";

dayjs.locale("id");

function rp(v: string | number) {
    return "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

const STATUS_COLOR: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    SENT: "bg-blue-100 text-blue-700",
    ACCEPTED: "bg-green-100 text-green-700",
    PAID: "bg-emerald-100 text-emerald-700",
    REJECTED: "bg-red-100 text-red-700",
    CANCELLED: "bg-red-100 text-red-700",
    EXPIRED: "bg-yellow-100 text-yellow-700",
};

type ItemRow = QuotationItem & { _key: string };

function keyed(items: QuotationItem[]): ItemRow[] {
    return items.map((it, idx) => ({ ...it, _key: `${it.id ?? "new"}-${idx}-${Math.random()}` }));
}

export default function PenawaranDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = use(params);
    const id = parseInt(idStr, 10);
    const qc = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ["quotation", id],
        queryFn: () => getQuotation(id),
    });

    const [customerId, setCustomerIdState] = useState<number | null>(null);
    const [linkedCustomer, setLinkedCustomer] = useState<Customer | null>(null);
    const [showCustomerPicker, setShowCustomerPicker] = useState(false);
    const [clientName, setClientName] = useState("");
    const [clientCompany, setClientCompany] = useState("");
    const [clientAddress, setClientAddress] = useState("");
    const [clientPhone, setClientPhone] = useState("");
    const [clientEmail, setClientEmail] = useState("");
    const [projectName, setProjectName] = useState("");
    const [eventLocation, setEventLocation] = useState("");
    const [eventDateStart, setEventDateStart] = useState("");
    const [eventDateEnd, setEventDateEnd] = useState("");
    const [validUntil, setValidUntil] = useState("");
    const [docDate, setDocDate] = useState("");
    const [signCity, setSignCity] = useState("");
    const [taxRate, setTaxRate] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [dpPercent, setDpPercent] = useState(50);
    const [notes, setNotes] = useState("");
    const [brand, setBrand] = useState<Brand | null>(null);
    const [variantCode, setVariantCode] = useState<string | null>(null);
    const [signedByWorkerId, setSignedByWorkerId] = useState<number | null>(null);
    const [itemDisplayMode, setItemDisplayMode] = useState<'detailed' | 'category-summary'>('detailed');
    const [bankAccountIds, setBankAccountIds] = useState<string>("");
    const [items, setItems] = useState<ItemRow[]>([]);

    // Bank accounts dari /settings/bank-accounts
    const { data: allBanks = [] } = useQuery<Array<{ id: number; bankName: string; accountNumber: string; accountOwner: string }>>({
        queryKey: ["bank-accounts"],
        queryFn: getBankAccounts,
    });

    const { data: variantConfigs = [] } = useQuery({
        queryKey: ["quotation-variants", true],
        queryFn: () => listQuotationVariants(true),
    });

    // Workers untuk dropdown penandatangan.
    // Untuk QUOTATION → MARKETING/SALES (yang handle penjualan)
    // Untuk INVOICE → ADMIN + MARKETING/SALES (admin biasanya yang TTD invoice/finance)
    const isInvoiceMode = data?.type === "INVOICE";
    const { data: marketers = [] } = useQuery({
        queryKey: ["workers", "signers", isInvoiceMode ? "invoice" : "quotation"],
        queryFn: () => isInvoiceMode
            ? getWorkers(false, { positions: ["ADMIN", ...MARKETER_POSITIONS] })
            : getWorkers(false, { positions: [...MARKETER_POSITIONS] }),
        enabled: !!data,
    });

    // Preview state — modal dengan PDF iframe inline
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    // Calculator state — modal multiplier per row
    const [calcOpenKey, setCalcOpenKey] = useState<string | null>(null);

    const applyCalc = (key: string, r: QuotationCalcResult) => {
        setItems((prev) => prev.map((it) => it._key === key ? {
            ...it,
            description: r.descriptionText,
            unit: r.unit,
            quantity: r.quantity,
            price: r.pricePerUnit,
        } : it));
        setCalcOpenKey(null);
    };

    useEffect(() => {
        if (!data) return;
        setCustomerIdState(data.customerId ?? null);
        // Hydrate linkedCustomer dari data.customer kalau backend include relation
        if ((data as any).customer) {
            setLinkedCustomer((data as any).customer as Customer);
        } else {
            setLinkedCustomer(null);
        }
        setClientName(data.clientName ?? "");
        setClientCompany(data.clientCompany ?? "");
        setClientAddress(data.clientAddress ?? "");
        setClientPhone(data.clientPhone ?? "");
        setClientEmail(data.clientEmail ?? "");
        setProjectName(data.projectName ?? "");
        setEventLocation(data.eventLocation ?? "");
        setEventDateStart(data.eventDateStart ? data.eventDateStart.slice(0, 10) : "");
        setEventDateEnd(data.eventDateEnd ? data.eventDateEnd.slice(0, 10) : "");
        setValidUntil(data.validUntil ? data.validUntil.slice(0, 10) : "");
        setDocDate(data.date ? data.date.slice(0, 10) : "");
        setSignCity(data.signCity ?? "");
        setTaxRate(Number(data.taxRate ?? 0));
        setDiscount(Number(data.discount ?? 0));
        setDpPercent(Number(data.dpPercent ?? 50));
        setNotes(data.notes ?? "");
        setBrand(data.brand);
        setVariantCode(data.variantCode ?? null);
        setSignedByWorkerId(data.signedByWorkerId ?? null);
        setItemDisplayMode(
            data.itemDisplayMode === 'category-summary' ? 'category-summary' : 'detailed'
        );
        setBankAccountIds(data.bankAccountIds ?? "");
        setItems(keyed(data.items ?? []));
    }, [data]);

    const showErr = (label: string) => (err: any) =>
        alert(`${label}: ${err?.response?.data?.message || err?.message || "gagal"}`);

    const saveMut = useMutation({
        mutationFn: (payload: any) => updateQuotation(id, payload),
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ["quotation", id] });
            // Invalidate customer analytics — supaya histori penawaran muncul di /customers/[id]
            // Invalidate untuk customer baru (sekarang) dan customer lama (sebelum di-unlink/ganti)
            if (res?.customerId) {
                qc.invalidateQueries({ queryKey: ["customer-analytics", res.customerId] });
                qc.invalidateQueries({ queryKey: ["customer", res.customerId] });
            }
            if (data?.customerId && data.customerId !== res?.customerId) {
                qc.invalidateQueries({ queryKey: ["customer-analytics", data.customerId] });
                qc.invalidateQueries({ queryKey: ["customer", data.customerId] });
            }
            // Generic invalidation untuk semua customers-with-stats list
            qc.invalidateQueries({ queryKey: ["customers-with-stats"] });
        },
        onError: showErr("Gagal simpan"),
    });
    const assignMut = useMutation({
        mutationFn: (opts: { mode?: 'auto' | 'manual'; customNumber?: string } = {}) =>
            assignQuotationNumber(id, opts),
        onSuccess: (q: Quotation) => {
            qc.invalidateQueries({ queryKey: ["quotation", id] });
            setShowAssignModal(false);
            alert(`Nomor resmi: ${q.invoiceNumber}`);
        },
        onError: showErr("Gagal assign nomor"),
    });
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);

    // List invoices yang sudah di-generate dari quotation ini
    const { data: childInvoices = [] } = useQuery({
        queryKey: ["quotation-invoices", id],
        queryFn: () => listInvoicesByQuotation(id),
        enabled: !!data && !data?.invoiceNumber.startsWith("DRAFT-"),
    });

    const generateInvoiceMut = useMutation({
        mutationFn: (input: { part: 'DP' | 'PELUNASAN' | 'FULL'; customAmount?: number; dueDate?: string }) =>
            generateInvoiceFromQuotation(id, input),
        onSuccess: (inv) => {
            qc.invalidateQueries({ queryKey: ["quotation-invoices", id] });
            setShowInvoiceModal(false);
            alert(`Invoice ${inv.invoiceNumber} dibuat`);
            window.location.href = `/penawaran/${inv.id}`;
        },
        onError: showErr("Gagal generate invoice"),
    });
    const reviseMut = useMutation({
        mutationFn: () => reviseQuotation(id),
        onSuccess: (q: Quotation) => {
            qc.invalidateQueries({ queryKey: ["quotations"] });
            window.location.href = `/penawaran/${q.id}`;
        },
        onError: showErr("Gagal buat revisi"),
    });

    const subtotal = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.price || 0), 0);
    const taxAmount = (subtotal * (taxRate || 0)) / 100;
    const total = subtotal + taxAmount - (discount || 0);
    const dpAmount = (total * dpPercent) / 100;

    const addItem = () =>
        setItems([
            ...items,
            { _key: `new-${Date.now()}`, description: "", unit: "", quantity: 1, price: 0 },
        ]);
    const updateItem = (k: string, patch: Partial<QuotationItem>) =>
        setItems(items.map((it) => (it._key === k ? { ...it, ...patch } : it)));
    const removeItem = (k: string) => setItems(items.filter((it) => it._key !== k));

    const handleSave = () => {
        try {
            if (signedByWorkerId) localStorage.setItem("pospro:quotation:lastSignedBy", String(signedByWorkerId));
        } catch { /* ignore */ }
        saveMut.mutate({
            customerId,
            clientName,
            clientCompany,
            clientAddress,
            clientPhone,
            clientEmail,
            projectName,
            eventLocation,
            eventDateStart: eventDateStart || undefined,
            eventDateEnd: eventDateEnd || undefined,
            validUntil: validUntil || undefined,
            date: docDate || undefined,
            signCity: signCity.trim() || null,
            variantCode: variantCode || null,
            signedByWorkerId: signedByWorkerId ?? null,
            itemDisplayMode,
            bankAccountIds: bankAccountIds || undefined,
            taxRate,
            discount,
            dpPercent,
            notes,
            brand,
            items: items.map((it, idx) => ({
                description: it.description,
                unit: it.unit || undefined,
                quantity: it.quantity,
                price: it.price,
                orderIndex: idx,
                productVariantId: it.productVariantId ?? null,
                categoryName: it.categoryName ?? null,
            })),
        });
    };

    const handlePreview = async () => {
        setPreviewLoading(true);
        setPreviewOpen(true);
        try {
            const blob = await downloadQuotationExport(id, "pdf");
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
        } catch (err: any) {
            alert("Gagal preview: " + (err?.response?.data?.message || err.message));
            setPreviewOpen(false);
        } finally {
            setPreviewLoading(false);
        }
    };

    /**
     * Toggle item display mode dari dalam preview modal.
     * Save mode ke DB → re-fetch PDF → user langsung lihat hasilnya.
     */
    const togglePreviewMode = async (newMode: 'detailed' | 'category-summary') => {
        setItemDisplayMode(newMode);
        setPreviewLoading(true);
        try {
            // Save mode saja (tidak save semua field) lewat updateQuotation partial
            await updateQuotation(id, { itemDisplayMode: newMode });
            qc.invalidateQueries({ queryKey: ["quotation", id] });
            // Re-fetch PDF
            const blob = await downloadQuotationExport(id, "pdf");
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(URL.createObjectURL(blob));
        } catch (err: any) {
            alert("Gagal switch mode: " + (err?.response?.data?.message || err.message));
        } finally {
            setPreviewLoading(false);
        }
    };

    const closePreview = () => {
        setPreviewOpen(false);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
    };

    // Cleanup preview URL on unmount
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleExport = async (format: "pdf" | "docx") => {
        try {
            const blob = await downloadQuotationExport(id, format);
            const url = URL.createObjectURL(blob);
            if (format === "pdf") {
                window.open(url, "_blank");
            } else {
                const a = document.createElement("a");
                a.href = url;
                a.download = `Penawaran_${(data?.invoiceNumber ?? id).toString().replace(/[^a-zA-Z0-9._-]+/g, "_")}.${format}`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            }
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (err: any) {
            alert("Gagal export: " + (err?.response?.data?.message || err.message));
        }
    };

    if (isLoading || !data) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        );
    }

    const isDraft = data.invoiceNumber.startsWith("DRAFT-");

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-start justify-between mb-6">
                <div>
                    <Link href="/penawaran" className="text-sm text-blue-600 flex items-center gap-1 mb-2">
                        <ArrowLeft className="w-4 h-4" /> Kembali
                    </Link>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        Penawaran {data.invoiceNumber}
                        {data.revisionNumber > 0 && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Rev. {data.revisionNumber}</span>
                        )}
                    </h1>
                    <p className="text-sm text-gray-600">
                        {(() => {
                            const cfg = variantCode ? variantConfigs.find((v) => v.code === variantCode) : null;
                            return cfg?.label
                                || (data.quotationVariant === "PENGADAAN_BOOTH" ? "Pengadaan Booth Special Design" : "Sewa Perlengkapan Event");
                        })()}
                    </p>
                </div>
                <div className="flex gap-2">
                    {isDraft && (
                        <button
                            onClick={() => setShowAssignModal(true)}
                            disabled={assignMut.isPending}
                            className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm"
                        >
                            <Hash className="w-4 h-4" /> Assign Nomor
                        </button>
                    )}
                    {!isDraft && (
                        <button
                            onClick={() => reviseMut.mutate()}
                            disabled={reviseMut.isPending}
                            className="flex items-center gap-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm"
                        >
                            <GitBranch className="w-4 h-4" /> Buat Revisi
                        </button>
                    )}
                    {!isDraft && data.type !== "INVOICE" && (
                        <button
                            onClick={() => setShowInvoiceModal(true)}
                            className="flex items-center gap-1 px-3 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-md text-sm"
                            title="Generate Invoice DP / Pelunasan dari penawaran ini"
                        >
                            <Receipt className="w-4 h-4" /> Buat Invoice
                        </button>
                    )}
                    <button
                        onClick={handlePreview}
                        className="flex items-center gap-1 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md text-sm"
                        title="Lihat preview surat penawaran sebelum download"
                    >
                        <Eye className="w-4 h-4" /> Preview
                    </button>
                    <button
                        onClick={() => handleExport("pdf")}
                        className="flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm"
                    >
                        <FileDown className="w-4 h-4" /> PDF
                    </button>
                    <button
                        onClick={() => handleExport("docx")}
                        className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
                    >
                        <FileText className="w-4 h-4" /> DOCX
                    </button>
                </div>
            </div>

            {data.parent && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
                    Dokumen ini revisi dari{" "}
                    <Link href={`/penawaran/${data.parent.id}`} className="text-blue-600 hover:underline font-medium">
                        {data.parent.invoiceNumber}
                    </Link>
                </div>
            )}

            {/* Banner kalau dokumen ini adalah INVOICE (di-generate dari quotation) */}
            {data.type === "INVOICE" && (
                <div className="mb-4 p-3 bg-pink-50 border-2 border-pink-200 rounded-md text-sm flex items-center justify-between">
                    <div>
                        <span className="font-bold text-pink-900">📑 Ini Invoice {data.invoicePart}</span>
                        {data.parentQuotationId && (
                            <> · dari penawaran <Link href={`/penawaran/${data.parentQuotationId}`} className="text-pink-700 hover:underline font-medium">#{data.parentQuotationId}</Link></>
                        )}
                    </div>
                    {data.amountToPay && (
                        <div className="text-right">
                            <div className="text-[10px] uppercase text-pink-700 font-bold">Jumlah Tagihan</div>
                            <div className="font-bold text-lg text-pink-900 font-mono">{rp(data.amountToPay)}</div>
                        </div>
                    )}
                </div>
            )}

            {/* List child invoices (kalau quotation ini sudah pernah di-generate invoice) */}
            {data.type !== "INVOICE" && childInvoices.length > 0 && (
                <div className="mb-4 rounded-md border-2 border-pink-200 bg-pink-50/50 p-3">
                    <div className="text-xs font-bold text-pink-900 uppercase tracking-wide mb-2">
                        📑 Invoice yang Sudah Dibuat ({childInvoices.length})
                    </div>
                    <div className="space-y-1.5">
                        {childInvoices.map((inv) => (
                            <Link
                                key={inv.id}
                                href={`/penawaran/${inv.id}`}
                                className="flex items-center justify-between gap-3 p-2 bg-white rounded border hover:border-pink-400 hover:bg-pink-50 text-sm"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <Receipt className="h-4 w-4 text-pink-600 shrink-0" />
                                    <div className="min-w-0">
                                        <div className="font-mono text-xs text-pink-700">{inv.invoiceNumber}</div>
                                        <div className="text-[11px] text-muted-foreground">
                                            {inv.invoicePart === "DP" && "💰 Down Payment"}
                                            {inv.invoicePart === "PELUNASAN" && "✅ Pelunasan"}
                                            {inv.invoicePart === "FULL" && "💯 Full Payment"}
                                            · {dayjs(inv.date).format("DD MMM YYYY")}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="font-mono font-bold text-pink-900">
                                        {inv.amountToPay ? rp(inv.amountToPay) : rp(inv.total)}
                                    </div>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLOR[inv.status] || "bg-gray-100"}`}>
                                        {inv.status}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Brand picker — pilih brand untuk header surat & nomor seri */}
            <div className="mb-4 bg-white border-2 rounded-lg p-3 flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-slate-700">Brand:</span>
                {ACTIVE_BRANDS.map((b) => {
                    const meta = BRAND_META[b];
                    const active = brand === b;
                    return (
                        <button
                            key={b}
                            type="button"
                            onClick={() => setBrand(b)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition ${active
                                ? `${meta.bg} ${meta.text} ${meta.border}`
                                : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                                }`}
                        >
                            <span>{meta.emoji}</span>
                            {meta.short}
                        </button>
                    );
                })}
                {brand === null && (
                    <span className="text-xs text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                        ⚠ Belum di-tag — pilih agar surat penawaran pakai header & nomor seri brand benar
                    </span>
                )}
                <span className="text-[11px] text-muted-foreground ml-auto">
                    Brand menentukan kop surat & nomor seri saat assign nomor.
                </span>
            </div>

            {/* Varian Penawaran picker — dropdown dari config CRUD */}
            <div className="mb-4 bg-white border-2 rounded-lg p-3 flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-slate-700">Varian:</span>
                <select
                    value={variantCode ?? ""}
                    onChange={(e) => setVariantCode(e.target.value || null)}
                    className="border-2 rounded-md px-3 py-1.5 text-sm bg-white focus:border-violet-500 outline-none min-w-[260px]"
                >
                    <option value="">— Pilih Varian —</option>
                    {variantConfigs.map((v) => (
                        <option key={v.code} value={v.code} disabled={!v.isActive}>
                            {v.label}{!v.isActive ? " (nonaktif)" : ""}
                        </option>
                    ))}
                </select>
                {variantCode && (() => {
                    const cfg = variantConfigs.find((v) => v.code === variantCode);
                    if (!cfg) return null;
                    return (
                        <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium"
                            style={{
                                backgroundColor: `${cfg.color || "#6366f1"}20`,
                                color: cfg.color || "#6366f1",
                                borderColor: `${cfg.color || "#6366f1"}40`,
                            }}
                        >
                            Template: <code className="font-mono">{cfg.templateKey}</code>
                        </span>
                    );
                })()}
                <Link href="/settings/quotation-variants" className="text-[11px] text-violet-600 hover:underline ml-auto">
                    Atur varian →
                </Link>
            </div>

            {/* Penandatangan Surat — context-aware: marketing untuk penawaran, admin untuk invoice */}
            <div className="mb-4 bg-white border-2 rounded-lg p-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-slate-700">
                        Penandatangan:
                        {isInvoiceMode && <span className="ml-1 text-[11px] text-pink-600 font-normal">(Admin biasanya TTD invoice)</span>}
                    </span>
                    <select
                        value={signedByWorkerId ?? ""}
                        onChange={(e) => setSignedByWorkerId(e.target.value ? Number(e.target.value) : null)}
                        className="border-2 rounded-md px-3 py-1.5 text-sm bg-white focus:border-blue-500 outline-none min-w-[260px]"
                    >
                        <option value="">— Pilih {isInvoiceMode ? "Admin/Marketing" : "Marketing/Sales"} —</option>
                        {marketers.map((w) => (
                            <option key={w.id} value={w.id}>
                                {w.name}{w.position ? ` (${w.position})` : ""}
                                {!w.signatureImageUrl ? " ⚠ belum ada TTD" : ""}
                            </option>
                        ))}
                    </select>
                    <Link href="/settings/workers" className="text-[11px] text-blue-600 hover:underline ml-auto">
                        Kelola TTD & stempel →
                    </Link>
                </div>
                {/* Preview signature & stamp dari marketing terpilih */}
                {signedByWorkerId && (() => {
                    const w = marketers.find((m) => m.id === signedByWorkerId);
                    if (!w) return null;
                    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
                    return (
                        <div className="mt-2 pt-2 border-t flex items-center gap-3 flex-wrap">
                            <span className="text-[11px] text-muted-foreground">Preview di surat:</span>
                            <div className="inline-flex items-center gap-3 p-2 bg-slate-50 rounded">
                                {w.signatureImageUrl ? (
                                    <div className="relative h-16 w-32 bg-white rounded border flex items-center justify-center">
                                        {w.stampImageUrl && (
                                            <img
                                                src={`${apiBase}${w.stampImageUrl}`}
                                                alt="Stempel"
                                                className="absolute h-14 w-14 object-contain opacity-80"
                                                style={{ left: "8px", top: "1px", mixBlendMode: "multiply" }}
                                            />
                                        )}
                                        <img
                                            src={`${apiBase}${w.signatureImageUrl}`}
                                            alt="TTD"
                                            className="relative max-h-14 max-w-full object-contain z-10"
                                        />
                                    </div>
                                ) : (
                                    <div className="h-16 w-32 bg-amber-50 border border-amber-300 rounded flex items-center justify-center text-[10px] text-amber-700 px-2 text-center">
                                        ⚠ {w.name} belum upload TTD
                                    </div>
                                )}
                                <div>
                                    <div className="text-sm font-bold underline">{w.name}</div>
                                    <div className="text-[11px] text-muted-foreground">{w.position || "Marketing"}</div>
                                </div>
                            </div>
                        </div>
                    );
                })()}
                {!signedByWorkerId && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                        💡 Kalau dikosongkan, surat pakai nama direktur dari pengaturan brand.
                    </p>
                )}
            </div>

            {/* Bank picker — pilih rekening yang muncul di surat */}
            <div className="mb-4 bg-white border-2 rounded-lg p-3">
                <div className="flex items-start gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-slate-700 mt-1">Rekening Bank:</span>
                    <div className="flex-1 min-w-[280px]">
                        {allBanks.length === 0 ? (
                            <div className="text-xs bg-amber-50 border border-amber-300 rounded-md p-2 text-amber-800">
                                ⚠ Belum ada bank account terdaftar.
                                <Link href="/settings/bank-accounts" className="ml-1 text-amber-900 font-semibold hover:underline">
                                    Tambah dulu di /settings/bank-accounts →
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {allBanks.map((b) => {
                                    const ids = bankAccountIds.split(",").map((s) => s.trim()).filter(Boolean);
                                    const checked = ids.includes(String(b.id));
                                    return (
                                        <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded hover:bg-slate-50">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(e) => {
                                                    const newIds = e.target.checked
                                                        ? [...ids, String(b.id)]
                                                        : ids.filter((x) => x !== String(b.id));
                                                    setBankAccountIds(newIds.join(","));
                                                }}
                                            />
                                            <span className="font-bold">{b.bankName}</span>
                                            <span className="font-mono text-xs">{b.accountNumber}</span>
                                            <span className="text-xs text-muted-foreground">a.n. {b.accountOwner}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-2">
                            💡 Pilih rekening yang ditampilkan di surat. Default: dari Brand Settings. Setting ini menimpa default per dokumen.
                        </p>
                    </div>
                    <Link href="/settings/bank-accounts" className="text-[11px] text-blue-600 hover:underline">
                        Kelola Bank →
                    </Link>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <section className="bg-white rounded-lg border p-4 space-y-3">
                    <h3 className="font-semibold mb-2">Data Klien</h3>

                    {/* Tautkan ke Customer Database — supaya muncul di tab Penawaran customer */}
                    {linkedCustomer ? (
                        <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50/40 p-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-semibold text-emerald-700 inline-flex items-center gap-1.5 mb-0.5">
                                        <Users className="h-3.5 w-3.5" />
                                        ✅ Ter-link ke Data Pelanggan
                                    </div>
                                    <Link
                                        href={`/customers/${linkedCustomer.id}`}
                                        className="text-sm font-semibold text-emerald-900 hover:underline truncate block"
                                    >
                                        {linkedCustomer.companyName || linkedCustomer.name}
                                    </Link>
                                    <div className="text-[11px] text-emerald-700/80 truncate">
                                        {linkedCustomer.companyName && linkedCustomer.name && <span>{linkedCustomer.name}</span>}
                                        {linkedCustomer.companyPIC && <span> · PIC {linkedCustomer.companyPIC}</span>}
                                        {linkedCustomer.phone && <span> · {linkedCustomer.phone}</span>}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomerPicker(true)}
                                        className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-muted"
                                    >
                                        Ganti
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setCustomerIdState(null); setLinkedCustomer(null); }}
                                        className="text-[11px] px-2 py-1 rounded text-red-600 hover:bg-red-50"
                                        title="Lepas link customer (penawaran ini gak akan muncul di histori customer)"
                                    >
                                        Lepas
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/40 p-3">
                            <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-amber-800 inline-flex items-center gap-1.5 mb-1">
                                        ⚠️ Belum Ter-link ke Data Pelanggan
                                    </div>
                                    <p className="text-[11px] text-amber-700 mb-2">
                                        Penawaran ini <b>tidak akan muncul</b> di histori detail pelanggan.
                                        Klik tombol untuk pilih customer terdaftar atau tambah klien baru.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomerPicker(true)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
                                    >
                                        <Search className="h-3.5 w-3.5" />
                                        Pilih / Tambah Klien
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <Field label="Nama PIC" value={clientName} onChange={setClientName} />
                    <Field label="Perusahaan" value={clientCompany} onChange={setClientCompany} />
                    <Field label="Alamat" value={clientAddress} onChange={setClientAddress} multiline />
                    <Field label="Telepon" value={clientPhone} onChange={setClientPhone} />
                    <Field label="Email" value={clientEmail} onChange={setClientEmail} />
                </section>

                <section className="bg-white rounded-lg border p-4 space-y-3">
                    <h3 className="font-semibold mb-2">Event / Proyek</h3>
                    <Field label="Nama Proyek" value={projectName} onChange={setProjectName} />
                    <Field label="Lokasi" value={eventLocation} onChange={setEventLocation} />
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Tanggal Mulai" value={eventDateStart} onChange={setEventDateStart} type="date" />
                        <Field label="Tanggal Selesai" value={eventDateEnd} onChange={setEventDateEnd} type="date" />
                    </div>
                    <Field label="Berlaku Sampai" value={validUntil} onChange={setValidUntil} type="date" />
                </section>
            </div>

            {/* Header Surat — kota & tanggal yang muncul di pojok kanan-atas surat penawaran */}
            <section className="bg-white rounded-lg border p-4 mt-6">
                <div className="mb-3">
                    <h3 className="font-semibold">Header Surat (Kota & Tanggal Dibuat)</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        💡 Format di surat: <code className="bg-slate-100 px-1 rounded">{signCity || "Semarang"}, {docDate ? new Date(docDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—"}</code>
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field
                        label="Lokasi (Kota Surat Dibuat)"
                        value={signCity}
                        onChange={setSignCity}
                        placeholder="Semarang"
                    />
                    <Field
                        label="Tanggal Surat"
                        value={docDate}
                        onChange={setDocDate}
                        type="date"
                    />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                    Kalau <b>Lokasi</b> dikosongkan, otomatis pakai kota dari alamat brand di <code className="bg-slate-100 px-1 rounded">/settings/brands</code>.
                </p>
            </section>

            <section className="bg-white rounded-lg border p-4 mt-6">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div>
                        <h3 className="font-semibold">Rincian Item</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            💡 Item dengan <b>Kategori</b> sama otomatis dikelompokkan. Item tanpa kategori akan ikut grup atasnya. Klik <Calculator className="inline h-3 w-3" /> untuk hitung qty otomatis.
                        </p>
                    </div>
                    <button
                        onClick={addItem}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
                    >
                        <Plus className="w-4 h-4" /> Tambah Item
                    </button>
                </div>

                {/* Toggle Tampilan Item di PDF/DOCX */}
                <div className="mb-3 rounded-md border-2 border-slate-200 bg-slate-50 p-2.5 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Tampilan Item di PDF:</span>
                    <div className="inline-flex gap-0.5 bg-white p-0.5 rounded border">
                        <button
                            type="button"
                            onClick={() => setItemDisplayMode('detailed')}
                            className={`px-3 py-1 rounded text-xs font-semibold transition ${itemDisplayMode === 'detailed'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            📋 Detail (per item)
                        </button>
                        <button
                            type="button"
                            onClick={() => setItemDisplayMode('category-summary')}
                            className={`px-3 py-1 rounded text-xs font-semibold transition ${itemDisplayMode === 'category-summary'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            📊 Ringkas (total/kategori)
                        </button>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                        {itemDisplayMode === 'detailed'
                            ? 'Tampilkan qty + harga satuan + jumlah per item.'
                            : 'Sembunyikan harga & qty per item, hanya total per kategori.'}
                    </span>
                </div>
                <datalist id="quotation-category-list">
                    <option value="Konstruksi Utama Booth" />
                    <option value="Konstruksi Tambahan" />
                    <option value="Furniture" />
                    <option value="Lighting" />
                    <option value="Multimedia" />
                    <option value="Operasional" />
                    <option value="Mekanikal & Elektrikal" />
                    <option value="Grafis" />
                    <option value="Backwall" />
                    <option value="Stage" />
                </datalist>
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-700">
                        <tr>
                            <th className="px-2 py-1.5 w-40">Kategori</th>
                            <th className="px-2 py-1.5">Uraian</th>
                            <th className="px-2 py-1.5 w-24">Qty</th>
                            <th className="px-2 py-1.5 w-24">Satuan</th>
                            <th className="px-2 py-1.5 w-32">Harga Satuan</th>
                            <th className="px-2 py-1.5 w-32 text-right">Subtotal</th>
                            <th className="w-8"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => {
                            const sub = Number(it.quantity || 0) * Number(it.price || 0);
                            return (
                                <tr key={it._key} className="border-t">
                                    <td className="px-2 py-1">
                                        <input
                                            list="quotation-category-list"
                                            value={it.categoryName ?? ""}
                                            onChange={(e) => updateItem(it._key, { categoryName: e.target.value || null })}
                                            placeholder="(opsional)"
                                            className="w-full border rounded px-2 py-1 text-xs"
                                        />
                                    </td>
                                    <td className="px-2 py-1">
                                        <input
                                            value={it.description}
                                            onChange={(e) => updateItem(it._key, { description: e.target.value })}
                                            className="w-full border rounded px-2 py-1"
                                        />
                                    </td>
                                    <td className="px-2 py-1">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={Number(it.quantity)}
                                            onChange={(e) => updateItem(it._key, { quantity: parseFloat(e.target.value) || 0 })}
                                            className="w-full border rounded px-2 py-1 text-right"
                                        />
                                    </td>
                                    <td className="px-2 py-1">
                                        <input
                                            value={it.unit ?? ""}
                                            onChange={(e) => updateItem(it._key, { unit: e.target.value })}
                                            placeholder="unit/hari"
                                            className="w-full border rounded px-2 py-1"
                                        />
                                    </td>
                                    <td className="px-2 py-1">
                                        <input
                                            type="number"
                                            value={Number(it.price)}
                                            onChange={(e) => updateItem(it._key, { price: parseFloat(e.target.value) || 0 })}
                                            className="w-full border rounded px-2 py-1 text-right"
                                        />
                                    </td>
                                    <td className="px-2 py-1 text-right font-mono">{rp(sub)}</td>
                                    <td className="px-2 py-1 text-center">
                                        <div className="flex items-center justify-center gap-0.5">
                                            <button
                                                onClick={() => setCalcOpenKey(it._key)}
                                                className="text-blue-600 hover:bg-blue-50 p-1 rounded"
                                                title="Kalkulator: Unit × Hari × Jam × m²"
                                            >
                                                <Calculator className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => removeItem(it._key)}
                                                className="text-red-600 hover:bg-red-50 p-1 rounded"
                                                title="Hapus item"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-center py-6 text-gray-400">
                                    Belum ada item. Klik "Tambah Item".
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
                <section className="bg-white rounded-lg border p-4 space-y-3">
                    <h3 className="font-semibold mb-2">Pajak &amp; Pembayaran</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="PPN (%)" value={String(taxRate)} onChange={(v) => setTaxRate(parseFloat(v) || 0)} type="number" />
                        <Field label="Diskon (Rp)" value={String(discount)} onChange={(v) => setDiscount(parseFloat(v) || 0)} type="number" />
                    </div>
                    <Field label="DP (%)" value={String(dpPercent)} onChange={(v) => setDpPercent(parseFloat(v) || 0)} type="number" />
                    <Field label="Catatan / Terms" value={notes} onChange={setNotes} multiline />
                </section>

                <section className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold mb-2">Ringkasan</h3>
                    <table className="w-full text-sm">
                        <tbody>
                            <Row label="Subtotal" value={rp(subtotal)} />
                            {discount > 0 && <Row label="Diskon" value={`- ${rp(discount)}`} />}
                            <Row label={`PPN ${taxRate}%`} value={rp(taxAmount)} />
                            <tr className="border-t font-bold text-lg">
                                <td className="py-2">Grand Total</td>
                                <td className="py-2 text-right">{rp(total)}</td>
                            </tr>
                            <Row label={`DP ${dpPercent}%`} value={rp(dpAmount)} />
                            <Row label="Pelunasan" value={rp(total - dpAmount)} />
                        </tbody>
                    </table>
                </section>
            </div>

            <div className="flex justify-end mt-6">
                <button
                    onClick={handleSave}
                    disabled={saveMut.isPending}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50"
                >
                    <Save className="w-4 h-4" /> {saveMut.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
            </div>

            {/* ─── Generate Invoice Modal ─── */}
            {showInvoiceModal && (
                <GenerateInvoiceModal
                    quotation={data}
                    onClose={() => setShowInvoiceModal(false)}
                    onSubmit={(input) => generateInvoiceMut.mutate(input)}
                    pending={generateInvoiceMut.isPending}
                />
            )}

            {/* ─── Assign Number Modal — pilih auto atau manual ─── */}
            {showAssignModal && (
                <AssignNumberModal
                    onClose={() => setShowAssignModal(false)}
                    onAuto={() => assignMut.mutate({ mode: "auto" })}
                    onManual={(customNumber) => assignMut.mutate({ mode: "manual", customNumber })}
                    pending={assignMut.isPending}
                />
            )}

            {/* ─── Calculator Modal — pop saat klik tombol kalkulator di row item ─── */}
            {calcOpenKey && (() => {
                const target = items.find((it) => it._key === calcOpenKey);
                if (!target) return null;
                return (
                    <QuotationItemCalculator
                        initialDescription={target.description}
                        initialUnit={target.unit ?? undefined}
                        initialQuantity={Number(target.quantity) || 0}
                        initialPrice={Number(target.price) || 0}
                        onApply={(r) => applyCalc(target._key, r)}
                        onCancel={() => setCalcOpenKey(null)}
                    />
                );
            })()}

            {/* ─── Preview Modal ─── */}
            {previewOpen && (
                <div
                    className="fixed inset-0 z-[100] bg-black/70 flex flex-col"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closePreview();
                    }}
                >
                    {/* Header */}
                    <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between gap-3 shadow-sm">
                        <div className="flex items-center gap-2">
                            <Eye className="h-5 w-5 text-violet-600" />
                            <div>
                                <h2 className="font-bold text-slate-900">Preview Penawaran</h2>
                                <p className="text-xs text-muted-foreground">
                                    {data.invoiceNumber}
                                    {data.brand && <span> · Brand {data.brand}</span>}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Live toggle Tampilan Item — auto-save + reload PDF */}
                            <div className="inline-flex gap-0.5 bg-slate-100 p-0.5 rounded-md border" title="Pilih tampilan item: detail per row atau ringkas per kategori">
                                <button
                                    type="button"
                                    onClick={() => itemDisplayMode !== 'detailed' && togglePreviewMode('detailed')}
                                    disabled={previewLoading}
                                    className={`px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-50 ${itemDisplayMode === 'detailed'
                                        ? 'bg-white text-blue-700 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                >
                                    📋 Detail
                                </button>
                                <button
                                    type="button"
                                    onClick={() => itemDisplayMode !== 'category-summary' && togglePreviewMode('category-summary')}
                                    disabled={previewLoading}
                                    className={`px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-50 ${itemDisplayMode === 'category-summary'
                                        ? 'bg-white text-blue-700 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                >
                                    📊 Ringkas
                                </button>
                            </div>
                            <button
                                onClick={() => handleExport("pdf")}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-semibold"
                            >
                                <Download className="h-4 w-4" /> Download PDF
                            </button>
                            <button
                                onClick={() => handleExport("docx")}
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

                    {/* PDF Body */}
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
                                title="Preview PDF Penawaran"
                            />
                        ) : (
                            <div className="text-slate-500 text-sm">Tidak ada preview</div>
                        )}
                    </div>
                </div>
            )}

            {/* Customer picker overlay — link/ganti customer */}
            {showCustomerPicker && (
                <CustomerPickerModal
                    onClose={() => setShowCustomerPicker(false)}
                    onPick={(c) => {
                        setCustomerIdState(c.id);
                        setLinkedCustomer(c);
                        // Auto-fill field klien yang masih kosong
                        if (!clientName) setClientName(c.companyPIC || c.name || "");
                        if (!clientCompany) setClientCompany(c.companyName || "");
                        if (!clientAddress) setClientAddress(c.address || "");
                        if (!clientPhone) setClientPhone(c.phone || "");
                        if (!clientEmail) setClientEmail(c.email || "");
                        setShowCustomerPicker(false);
                    }}
                />
            )}
        </div>
    );
}

function Field({
    label, value, onChange, type = "text", multiline, placeholder,
}: {
    label: string; value: string; onChange: (v: string) => void; type?: string; multiline?: boolean; placeholder?: string;
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            {multiline ? (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    rows={2}
                    placeholder={placeholder}
                    className="w-full border rounded-md px-3 py-1.5 text-sm"
                />
            ) : (
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full border rounded-md px-3 py-1.5 text-sm"
                />
            )}
        </div>
    );
}

function GenerateInvoiceModal({
    quotation, onClose, onSubmit, pending,
}: {
    quotation: Quotation;
    onClose: () => void;
    onSubmit: (input: { part: 'DP' | 'PELUNASAN' | 'FULL'; customAmount?: number; dueDate?: string }) => void;
    pending: boolean;
}) {
    const [part, setPart] = useState<'DP' | 'PELUNASAN' | 'FULL'>('DP');
    const total = Number(quotation.total ?? 0);
    const dpPercent = Number(quotation.dpPercent ?? 50);

    // Mode input: 'preset' (pakai DP/Pelunasan/Full default) | 'percent' (pilih %) | 'amount' (ketik Rp langsung)
    const [mode, setMode] = useState<'preset' | 'percent' | 'amount'>('preset');
    const [percentInput, setPercentInput] = useState<number>(50);
    const [amountInput, setAmountInput] = useState<string>("");
    const [dueDate, setDueDate] = useState<string>("");

    // Auto-amount per part di mode 'preset'
    const presetAmount =
        part === 'DP' ? (total * dpPercent) / 100 :
        part === 'PELUNASAN' ? total - (total * dpPercent) / 100 :
        total;

    const computedAmount = (() => {
        if (mode === 'preset') return presetAmount;
        if (mode === 'percent') return (total * percentInput) / 100;
        if (mode === 'amount') return parseFloat(amountInput) || 0;
        return 0;
    })();

    const computedPercent = total > 0 ? (computedAmount / total) * 100 : 0;

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-pink-600" />
                        Buat Invoice
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <p className="text-sm text-muted-foreground">
                    Buat invoice dari penawaran <b className="font-mono">{quotation.invoiceNumber}</b>.
                    Total grand: <b>{rp(total)}</b>
                </p>

                {/* Tipe Invoice — label saja, untuk subject/heading di PDF */}
                <div>
                    <label className="block text-sm font-semibold mb-1.5">Tipe Invoice</label>
                    <div className="grid grid-cols-3 gap-2">
                        <PartBtn active={part === "DP"} onClick={() => setPart("DP")} label="💰 DP" sub="Down Payment" />
                        <PartBtn active={part === "PELUNASAN"} onClick={() => setPart("PELUNASAN")} label="✅ Pelunasan" sub="Final Payment" />
                        <PartBtn active={part === "FULL"} onClick={() => setPart("FULL")} label="💯 Full" sub="Sekali Bayar" />
                    </div>
                </div>

                {/* Cara Tentukan Jumlah */}
                <div>
                    <label className="block text-sm font-semibold mb-1.5">Cara Tentukan Jumlah</label>
                    <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-md w-full">
                        <ModeBtn active={mode === 'preset'} onClick={() => setMode('preset')} label="⚡ Default" />
                        <ModeBtn active={mode === 'percent'} onClick={() => setMode('percent')} label="% Persen" />
                        <ModeBtn active={mode === 'amount'} onClick={() => setMode('amount')} label="Rp Custom" />
                    </div>
                </div>

                {/* Mode: Preset (default) */}
                {mode === 'preset' && (
                    <div className="rounded-lg bg-slate-50 border p-3 text-xs text-slate-700">
                        ⚡ Pakai default sesuai tipe:
                        {part === "DP" && <> DP <b>{dpPercent}%</b> dari total</>}
                        {part === "PELUNASAN" && <> Sisa setelah DP {dpPercent}%</>}
                        {part === "FULL" && <> Total grand</>}
                    </div>
                )}

                {/* Mode: Persentase dengan preset & slider */}
                {mode === 'percent' && (
                    <div className="space-y-2">
                        <div className="grid grid-cols-5 gap-1">
                            {[10, 25, 30, 50, 70].map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPercentInput(p)}
                                    className={`px-2 py-1.5 rounded-md text-xs font-bold border-2 transition ${percentInput === p
                                        ? "bg-pink-500 text-white border-pink-500"
                                        : "bg-white text-slate-700 border-slate-200 hover:border-pink-300"
                                        }`}
                                >
                                    {p}%
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={percentInput}
                                onChange={(e) => setPercentInput(parseFloat(e.target.value))}
                                className="flex-1"
                            />
                            <div className="relative w-24">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={percentInput}
                                    onChange={(e) => setPercentInput(parseFloat(e.target.value) || 0)}
                                    className="w-full border-2 rounded px-2 py-1 text-sm font-mono text-right focus:border-pink-500 outline-none pr-7"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mode: Custom Rp */}
                {mode === 'amount' && (
                    <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-1">
                            {[
                                { label: "DP %", value: presetAmount, hint: `${dpPercent}%` },
                                { label: "Pelunasan", value: total - presetAmount, hint: `${(100 - dpPercent).toFixed(0)}%` },
                                { label: "Full", value: total, hint: "100%" },
                            ].map((preset) => (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => setAmountInput(String(preset.value))}
                                    className="px-2 py-1.5 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-left"
                                >
                                    <div>{preset.label}</div>
                                    <div className="font-mono text-pink-700">{rp(preset.value)}</div>
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">Rp</span>
                            <input
                                type="number"
                                min="0"
                                step="any"
                                value={amountInput}
                                onChange={(e) => setAmountInput(e.target.value)}
                                placeholder="contoh: 5000000"
                                inputMode="numeric"
                                className="w-full border-2 rounded-md pl-11 pr-3 py-2.5 text-base font-mono text-right focus:border-pink-500 outline-none"
                                autoFocus
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            💡 Ketik nominal langsung (mis. <code>5000000</code> untuk Rp 5 juta). Bisa untuk termin custom yang tidak persis persentase.
                        </p>
                    </div>
                )}

                {/* Hasil — selalu tampil prominent */}
                <div className="rounded-lg border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-rose-50 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-pink-700 mb-1">
                        Jumlah yang Akan Ditagihkan
                    </div>
                    <div className="text-3xl font-bold font-mono text-pink-900 leading-tight">
                        {rp(computedAmount)}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                        <div className="text-xs text-pink-700">
                            ≈ <b>{computedPercent.toFixed(1)}%</b> dari total
                        </div>
                        <div className="text-xs text-pink-700">
                            Sisa: <b className="font-mono">{rp(total - computedAmount)}</b>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold mb-1.5">
                        Jatuh Tempo <span className="text-xs font-normal text-muted-foreground">(opsional)</span>
                    </label>
                    <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full border-2 rounded-md px-3 py-2 text-sm focus:border-pink-500 outline-none"
                    />
                </div>

                <div className="flex gap-2 pt-3 border-t">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border-2 rounded-md text-sm font-semibold hover:bg-slate-50"
                    >
                        Batal
                    </button>
                    <button
                        onClick={() => onSubmit({
                            part,
                            // Kalau mode != preset, kirim customAmount agar backend pakai nilai itu
                            customAmount: mode === 'preset' ? undefined : computedAmount,
                            dueDate: dueDate || undefined,
                        })}
                        disabled={pending || computedAmount <= 0}
                        className="flex-[2] inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-md text-sm font-bold disabled:opacity-50"
                    >
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                        Buat Invoice {rp(computedAmount)}
                    </button>
                </div>
            </div>
        </div>
    );
}

function PartBtn({ active, onClick, label, sub }: { active: boolean; onClick: () => void; label: string; sub: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`p-3 rounded-lg border-2 transition ${active ? "border-pink-500 bg-pink-50 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}
        >
            <div className="font-bold text-sm">{label}</div>
            <div className="text-[11px] text-muted-foreground">{sub}</div>
        </button>
    );
}

function ModeBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex-1 px-3 py-1.5 rounded text-xs font-bold transition ${active ? "bg-white text-pink-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
        >
            {label}
        </button>
    );
}

function AssignNumberModal({
    onClose, onAuto, onManual, pending,
}: {
    onClose: () => void;
    onAuto: () => void;
    onManual: (customNumber: string) => void;
    pending: boolean;
}) {
    const [mode, setMode] = useState<"auto" | "manual">("auto");
    const [customNumber, setCustomNumber] = useState("");

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Hash className="h-5 w-5 text-green-600" />
                        Assign Nomor Resmi
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <p className="text-sm text-muted-foreground">
                    Pilih mode penomoran. Setelah assign, nomor draft akan diganti permanen.
                </p>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setMode("auto")}
                        className={`p-3 rounded-lg border-2 text-left transition ${mode === "auto"
                            ? "border-green-500 bg-green-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                    >
                        <div className="font-bold text-sm">⚡ Auto</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                            Generate dari counter (ikut urutan brand & tahun)
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode("manual")}
                        className={`p-3 rounded-lg border-2 text-left transition ${mode === "manual"
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                    >
                        <div className="font-bold text-sm">✍️ Manual</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                            Ketik nomor sendiri (tidak increment counter)
                        </div>
                    </button>
                </div>

                {mode === "manual" && (
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold">
                            Nomor Manual <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={customNumber}
                            onChange={(e) => setCustomNumber(e.target.value)}
                            placeholder="contoh: 100/Ep/Pnwr/V/26"
                            className="w-full border-2 rounded-md px-3 py-2 text-sm font-mono focus:border-blue-500 outline-none"
                            autoFocus
                        />
                        <p className="text-[11px] text-muted-foreground">
                            💡 Pakai format mirip auto biar konsisten. Sistem cek unique — kalau sudah dipakai, ditolak.
                        </p>
                    </div>
                )}

                {mode === "auto" && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-3 text-xs text-green-900">
                        ⚡ Sistem akan ambil nomor berikutnya dari counter (mis. <code className="bg-white px-1 rounded">42/Ep/Pnwr/IV/26</code> kalau sudah ada 41 quotation Exindo bulan ini).
                    </div>
                )}

                <div className="flex gap-2 pt-3 border-t">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border-2 rounded-md text-sm font-semibold hover:bg-slate-50"
                    >
                        Batal
                    </button>
                    <button
                        onClick={() => mode === "auto" ? onAuto() : onManual(customNumber)}
                        disabled={pending || (mode === "manual" && !customNumber.trim())}
                        className={`flex-[2] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-white rounded-md text-sm font-bold disabled:opacity-50 ${mode === "auto"
                            ? "bg-green-600 hover:bg-green-700"
                            : "bg-blue-600 hover:bg-blue-700"
                            }`}
                    >
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hash className="h-4 w-4" />}
                        Assign {mode === "auto" ? "Auto" : "Manual"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <tr>
            <td className="py-1 text-gray-600">{label}</td>
            <td className="py-1 text-right">{value}</td>
        </tr>
    );
}
