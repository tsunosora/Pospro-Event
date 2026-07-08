"use client";

import { useQuery } from "@tanstack/react-query";
import {
    X, FileText, ExternalLink, Calendar, CreditCard, Hash, StickyNote,
    Receipt, Building2, Loader2, Image as ImageIcon, CheckCircle2, Package,
} from "lucide-react";
import type { Quotation, PaymentInstallment } from "@/lib/api/quotations";
import { getPaymentDetail } from "@/lib/api/quotations";

interface Props {
    invoice: Quotation;
    onClose: () => void;
}

const METHOD_LABEL: Record<string, string> = {
    BANK_TRANSFER: "Transfer Bank",
    CASH: "Cash",
    QRIS: "QRIS",
    OTHER: "Lainnya",
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    PAID: { label: "LUNAS", cls: "bg-success/15 text-success border-success/30" },
    PARTIALLY_PAID: { label: "SEBAGIAN", cls: "bg-warning/15 text-warning border-warning/30" },
    SENT: { label: "TERKIRIM", cls: "bg-info/15 text-info border-info/30" },
    DRAFT: { label: "DRAFT", cls: "bg-muted text-muted-foreground border-border" },
    CANCELLED: { label: "CANCELLED", cls: "bg-destructive/12 text-destructive border-destructive/30" },
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
        cls: "bg-muted text-muted-foreground border-border",
    };

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-card rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-success/10 sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-success" />
                        <div>
                            <h3 className="font-bold text-foreground">Detail Pembayaran</h3>
                            <p className="text-[11px] text-muted-foreground font-mono">{invoice.invoiceNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded cursor-pointer transition-colors hover:bg-muted">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-4 space-y-3">
                    {/* Status badge */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Status:</span>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded border ${statusInfo.cls}`}>
                            {statusInfo.label}
                        </span>
                    </div>

                    {/* Summary box */}
                    <div className="bg-muted border border-border rounded p-3 text-xs space-y-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Invoice:</span>
                            <span className="nums font-mono font-bold">Rp {amountToPay.toLocaleString("id-ID")}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Sudah Dibayar:</span>
                            <span className="nums font-mono font-bold text-success">Rp {paidAmount.toLocaleString("id-ID")}</span>
                        </div>
                        {sisa > 0 && (
                            <div className="flex justify-between border-t border-border pt-1">
                                <span className="text-foreground font-semibold">Sisa Tagihan:</span>
                                <span className="nums font-mono font-bold text-warning">Rp {sisa.toLocaleString("id-ID")}</span>
                            </div>
                        )}
                        {sisa === 0 && paidAmount > 0 && (
                            <div className="flex justify-between border-t border-border pt-1">
                                <span className="text-success font-bold flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Lunas Penuh
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Loading state */}
                    {isLoading && (
                        <div className="flex items-center justify-center py-4 text-muted-foreground text-xs">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Memuat riwayat pembayaran...
                        </div>
                    )}

                    {/* List of installments */}
                    {!isLoading && detail && detail.installments.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
                                    Riwayat Pembayaran
                                </h4>
                                <span className="text-[11px] text-muted-foreground font-semibold">
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
                        <div className="text-xs text-muted-foreground italic bg-muted rounded p-2 text-center">
                            Belum ada record pembayaran masuk.
                        </div>
                    )}
                </div>

                <div className="px-4 py-3 border-t border-border bg-muted flex justify-end gap-2 sticky bottom-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm border-2 border-border rounded hover:bg-muted/60 cursor-pointer transition-colors"
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
        <div className={`border-2 rounded-lg p-3 ${isLatest ? "border-success/30 bg-success/10" : "border-border bg-card"}`}>
            {/* Header — installment number + amount */}
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isLatest ? "bg-success text-white" : "bg-muted text-muted-foreground"
                        }`}>
                        {installment.installmentNumber}
                    </div>
                    <div>
                        <div className="text-xs font-bold text-foreground">
                            Pembayaran ke-{installment.installmentNumber}
                            {isLatest && (
                                <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-success/15 text-success font-semibold">
                                    TERAKHIR
                                </span>
                            )}
                            {installment.isLegacy && (
                                <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-warning/15 text-warning font-semibold inline-flex items-center gap-0.5" title="Data lama dari sebelum fitur cicilan">
                                    <Package className="w-2.5 h-2.5" />LEGACY
                                </span>
                            )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{formatDateTime(installment.createdAt)}</div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="nums font-mono font-bold text-success text-sm">
                        Rp {installment.amount.toLocaleString("id-ID")}
                    </div>
                </div>
            </div>

            {/* Payment details */}
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-start gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                        <div className="text-muted-foreground text-[10px]">Tanggal Bayar</div>
                        <div className="font-semibold">{formatDate(installment.paidAt)}</div>
                    </div>
                </div>
                <div className="flex items-start gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                        <div className="text-muted-foreground text-[10px]">Metode</div>
                        <div className="font-semibold">
                            {installment.paymentMethod ? (METHOD_LABEL[installment.paymentMethod] ?? installment.paymentMethod) : "—"}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bank account info — kalau transfer */}
            {installment.paymentMethod === "BANK_TRANSFER" && installment.bankAccount && (
                <div className="bg-info/10 border border-info/30 rounded p-2 mt-2 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-info font-bold uppercase">
                        <Building2 className="h-3 w-3" />
                        Rekening Tujuan
                    </div>
                    <div className="text-xs font-bold text-info">{installment.bankAccount.bankName}</div>
                    <div className="text-[11px] font-mono text-info">{installment.bankAccount.accountNumber}</div>
                    <div className="text-[10px] text-info">a.n. {installment.bankAccount.accountOwner}</div>
                </div>
            )}

            {/* Ref + Note */}
            {(installment.paymentRef || installment.paymentNote) && (
                <div className="mt-2 space-y-1.5">
                    {installment.paymentRef && (
                        <div className="flex items-start gap-1.5 text-xs">
                            <Hash className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="text-muted-foreground text-[10px]">No. Referensi</div>
                                <div className="font-mono font-semibold break-all">{installment.paymentRef}</div>
                            </div>
                        </div>
                    )}
                    {installment.paymentNote && (
                        <div className="flex items-start gap-1.5 text-xs">
                            <StickyNote className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="text-muted-foreground text-[10px]">Catatan</div>
                                <div className="whitespace-pre-wrap text-[11px]">{installment.paymentNote}</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Bukti pembayaran */}
            <div className="mt-2">
                <div className="text-[10px] text-muted-foreground font-bold uppercase mb-1 flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" />
                    Bukti Transfer Cicilan #{installment.installmentNumber}
                </div>
                {proofUrl ? (
                    <div className="border border-border rounded bg-card">
                        {isPdfProof ? (
                            <a
                                href={proofUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 hover:bg-destructive/10 transition-colors"
                            >
                                <FileText className="h-8 w-8 text-destructive flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-foreground truncate">
                                        {installment.paymentProofUrl?.split("/").pop()}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">Klik untuk buka PDF</div>
                                </div>
                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
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
                    <div className="text-[10px] text-muted-foreground italic bg-muted border border-dashed border-border rounded p-2 text-center flex items-center justify-center gap-1">
                        <ImageIcon className="w-3 h-3" />Tidak ada bukti dilampirkan untuk cicilan ini
                    </div>
                )}
            </div>
        </div>
    );
}
