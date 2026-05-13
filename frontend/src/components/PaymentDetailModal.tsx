"use client";

import { useQuery } from "@tanstack/react-query";
import {
    X, FileText, ExternalLink, Calendar, CreditCard, Hash, StickyNote,
    Receipt, Building2, Loader2, Image as ImageIcon,
} from "lucide-react";
import type { Quotation, PaymentInstallment } from "@/lib/api/quotations";
import { getPaymentDetail } from "@/lib/api/quotations";

interface Props {
    invoice: Quotation;
    onClose: () => void;
}

const METHOD_LABEL: Record<string, string> = {
    BANK_TRANSFER: "🏦 Transfer Bank",
    CASH: "💵 Cash",
    QRIS: "📱 QRIS",
    OTHER: "❓ Lainnya",
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    PAID: { label: "✅ LUNAS", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    PARTIALLY_PAID: { label: "⏳ SEBAGIAN", cls: "bg-amber-100 text-amber-800 border-amber-300" },
    SENT: { label: "📤 TERKIRIM", cls: "bg-blue-100 text-blue-800 border-blue-300" },
    DRAFT: { label: "📝 DRAFT", cls: "bg-slate-100 text-slate-800 border-slate-300" },
    CANCELLED: { label: "❌ CANCELLED", cls: "bg-red-100 text-red-800 border-red-300" },
};

function formatDate(s: string | null | undefined) {
    if (!s) return "—";
    try {
        return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    } catch { return s; }
}

function formatDateTime(s: string | null | undefined) {
    if (!s) return "—";
    try {
        const d = new Date(s);
        return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) +
            " · " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    } catch { return s; }
}

/**
 * Modal "Detail Pembayaran" — display semua cicilan + bukti transfer per cicilan.
 */
export function PaymentDetailModal({ invoice, onClose }: Props) {
    const { data: detail, isLoading } = useQuery({
        queryKey: ["payment-detail", invoice.id],
        queryFn: () => getPaymentDetail(invoice.id),
        staleTime: 30_000,
    });

    const amountToPay = detail?.amountToPay ?? Number(invoice.amountToPay ?? invoice.total ?? 0);
    const paidAmount = detail?.paidAmount ?? Number((invoice as any).paidAmount ?? 0);
    const sisa = Math.max(0, amountToPay - paidAmount);

    const statusInfo = STATUS_LABEL[invoice.status] ?? {
        label: invoice.status,
        cls: "bg-slate-100 text-slate-700 border-slate-300",
    };

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="px-4 py-3 border-b flex items-center justify-between bg-emerald-50 sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-emerald-600" />
                        <div>
                            <h3 className="font-bold text-slate-900">Detail Pembayaran</h3>
                            <p className="text-[11px] text-slate-600 font-mono">{invoice.invoiceNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-4 space-y-3">
                    {/* Status badge */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">Status:</span>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded border ${statusInfo.cls}`}>
                            {statusInfo.label}
                        </span>
                    </div>

                    {/* Summary box */}
                    <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-1">
                        <div className="flex justify-between">
                            <span className="text-slate-600">Total Invoice:</span>
                            <span className="font-mono font-bold">Rp {amountToPay.toLocaleString("id-ID")}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-600">Sudah Dibayar:</span>
                            <span className="font-mono font-bold text-emerald-700">Rp {paidAmount.toLocaleString("id-ID")}</span>
                        </div>
                        {sisa > 0 && (
                            <div className="flex justify-between border-t border-slate-300 pt-1">
                                <span className="text-slate-700 font-semibold">Sisa Tagihan:</span>
                                <span className="font-mono font-bold text-amber-700">Rp {sisa.toLocaleString("id-ID")}</span>
                            </div>
                        )}
                        {sisa === 0 && paidAmount > 0 && (
                            <div className="flex justify-between border-t border-slate-300 pt-1">
                                <span className="text-emerald-700 font-bold">✅ Lunas Penuh</span>
                            </div>
                        )}
                    </div>

                    {/* Loading state */}
                    {isLoading && (
                        <div className="flex items-center justify-center py-4 text-slate-500 text-xs">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Memuat riwayat pembayaran...
                        </div>
                    )}

                    {/* List of installments */}
                    {!isLoading && detail && detail.installments.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                    Riwayat Pembayaran
                                </h4>
                                <span className="text-[11px] text-slate-500 font-semibold">
                                    {detail.installmentCount} {detail.installmentCount > 1 ? "cicilan" : "pembayaran"}
                                </span>
                            </div>

                            {detail.installments.map((inst, idx) => (
                                <InstallmentCard
                                    key={inst.id || idx}
                                    installment={inst}
                                    isLatest={idx === detail.installments.length - 1}
                                />
                            ))}
                        </div>
                    )}

                    {/* Empty state */}
                    {!isLoading && detail && detail.installments.length === 0 && (
                        <div className="text-xs text-slate-500 italic bg-slate-50 rounded p-2 text-center">
                            Belum ada record pembayaran masuk.
                        </div>
                    )}
                </div>

                <div className="px-4 py-3 border-t bg-slate-50 flex justify-end gap-2 sticky bottom-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm border-2 rounded hover:bg-slate-100"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}

function InstallmentCard({ installment, isLatest }: { installment: PaymentInstallment; isLatest: boolean }) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const proofUrl = installment.paymentProofUrl
        ? (installment.paymentProofUrl.startsWith("http")
            ? installment.paymentProofUrl
            : `${apiBase}${installment.paymentProofUrl}`)
        : null;
    const isPdfProof = installment.paymentProofUrl?.toLowerCase().endsWith(".pdf");

    return (
        <div className={`border-2 rounded-lg p-3 ${isLatest ? "border-emerald-300 bg-emerald-50/30" : "border-slate-200 bg-white"}`}>
            {/* Header — installment number + amount */}
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isLatest ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-700"
                        }`}>
                        {installment.installmentNumber}
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-900">
                            Pembayaran ke-{installment.installmentNumber}
                            {isLatest && (
                                <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                                    TERAKHIR
                                </span>
                            )}
                            {installment.isLegacy && (
                                <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold" title="Data lama dari sebelum fitur cicilan">
                                    📦 LEGACY
                                </span>
                            )}
                        </div>
                        <div className="text-[10px] text-slate-500">{formatDateTime(installment.createdAt)}</div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="font-mono font-bold text-emerald-700 text-sm">
                        Rp {installment.amount.toLocaleString("id-ID")}
                    </div>
                </div>
            </div>

            {/* Payment details */}
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-start gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <div className="text-slate-500 text-[10px]">Tanggal Bayar</div>
                        <div className="font-semibold">{formatDate(installment.paidAt)}</div>
                    </div>
                </div>
                <div className="flex items-start gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <div className="text-slate-500 text-[10px]">Metode</div>
                        <div className="font-semibold">
                            {installment.paymentMethod ? (METHOD_LABEL[installment.paymentMethod] ?? installment.paymentMethod) : "—"}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bank account info — kalau transfer */}
            {installment.paymentMethod === "BANK_TRANSFER" && installment.bankAccount && (
                <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-blue-700 font-bold uppercase">
                        <Building2 className="h-3 w-3" />
                        Rekening Tujuan
                    </div>
                    <div className="text-xs font-bold text-blue-900">{installment.bankAccount.bankName}</div>
                    <div className="text-[11px] font-mono text-blue-800">{installment.bankAccount.accountNumber}</div>
                    <div className="text-[10px] text-blue-700">a.n. {installment.bankAccount.accountOwner}</div>
                </div>
            )}

            {/* Ref + Note */}
            {(installment.paymentRef || installment.paymentNote) && (
                <div className="mt-2 space-y-1.5">
                    {installment.paymentRef && (
                        <div className="flex items-start gap-1.5 text-xs">
                            <Hash className="h-3 w-3 text-slate-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="text-slate-500 text-[10px]">No. Referensi</div>
                                <div className="font-mono font-semibold break-all">{installment.paymentRef}</div>
                            </div>
                        </div>
                    )}
                    {installment.paymentNote && (
                        <div className="flex items-start gap-1.5 text-xs">
                            <StickyNote className="h-3 w-3 text-slate-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="text-slate-500 text-[10px]">Catatan</div>
                                <div className="whitespace-pre-wrap text-[11px]">{installment.paymentNote}</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Bukti pembayaran */}
            <div className="mt-2">
                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1 flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" />
                    Bukti Transfer Cicilan #{installment.installmentNumber}
                </div>
                {proofUrl ? (
                    <div className="border rounded bg-white">
                        {isPdfProof ? (
                            <a
                                href={proofUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 hover:bg-red-50 transition"
                            >
                                <FileText className="h-8 w-8 text-red-600 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-slate-900 truncate">
                                        {installment.paymentProofUrl?.split("/").pop()}
                                    </div>
                                    <div className="text-[10px] text-slate-600">Klik untuk buka PDF</div>
                                </div>
                                <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                            </a>
                        ) : (
                            <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="block">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={proofUrl}
                                    alt={`Bukti pembayaran ke-${installment.installmentNumber}`}
                                    className="max-h-48 w-full object-contain rounded"
                                />
                            </a>
                        )}
                    </div>
                ) : (
                    <div className="text-[10px] text-slate-400 italic bg-slate-50 border border-dashed border-slate-300 rounded p-2 text-center">
                        📷 Tidak ada bukti dilampirkan untuk cicilan ini
                    </div>
                )}
            </div>
        </div>
    );
}
