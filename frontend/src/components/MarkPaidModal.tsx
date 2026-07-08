"use client";

import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, CheckCircle2, Loader2, Building2, Upload, Image as ImageIcon, FileText, Trash2, AlertTriangle, Lightbulb, BarChart2, Clock, Landmark, Banknote, QrCode, HelpCircle, ClipboardList, ZoomIn } from "lucide-react";
import type { Quotation, MarkPaidPayload, PaymentMethodType } from "@/lib/api/quotations";
import { uploadPaymentProof } from "@/lib/api/quotations";
import { getBankAccounts } from "@/lib/api/transactions";

type BankAccount = {
    id: number;
    bankName: string;
    accountNumber: string;
    accountOwner: string;
    currentBalance: number;
    isActive: boolean;
};

interface Props {
    invoice: Quotation;
    onClose: () => void;
    onSubmit: (payload: MarkPaidPayload) => Promise<void> | void;
    pending?: boolean;
}

/**
 * Modal "Tandai Pembayaran" — admin record pembayaran masuk untuk Invoice tertentu.
 * Field: nominal, tanggal, metode, no. referensi, catatan, toggle catat ke Cashflow.
 */
export function MarkPaidModal({ invoice, onClose, onSubmit, pending }: Props) {
    const amountToPay = Number(invoice.amountToPay ?? invoice.total ?? 0);
    const alreadyPaid = Number((invoice as any).paidAmount ?? 0);
    const sisaTagihan = Math.max(0, amountToPay - alreadyPaid);

    // DP percent dari quotation (default 50 kalau gak ada)
    const dpPercentDefault = Math.max(1, Math.min(99, Number(invoice.dpPercent ?? 50) || 50));

    const [amount, setAmount] = useState<number>(sisaTagihan);
    const [paidAt, setPaidAt] = useState<string>(new Date().toISOString().slice(0, 10));
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("BANK_TRANSFER");
    const [paymentRef, setPaymentRef] = useState<string>("");
    const [paymentNote, setPaymentNote] = useState<string>("");
    const [createCashflow, setCreateCashflow] = useState<boolean>(true);
    const [bankAccountId, setBankAccountId] = useState<number | null>(null);
    const [customPercent, setCustomPercent] = useState<string>("");
    const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
    const [uploadingProof, setUploadingProof] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const proofFullUrl = paymentProofUrl
        ? (paymentProofUrl.startsWith("http") ? paymentProofUrl : `${apiBase}${paymentProofUrl}`)
        : null;
    const isPdfProof = paymentProofUrl?.toLowerCase().endsWith(".pdf");

    const handleProofUpload = async (file: File | null) => {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            return alert("File terlalu besar (max 10MB)");
        }
        setUploadingProof(true);
        try {
            const res = await uploadPaymentProof(invoice.id, file);
            setPaymentProofUrl(res.url);
        } catch (e: any) {
            alert(`❌ Upload gagal: ${e?.response?.data?.message || e?.message}`);
        } finally {
            setUploadingProof(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // Bank accounts list — di-fetch hanya kalau modal terbuka & dibutuhkan
    const { data: bankAccounts = [] } = useQuery({
        queryKey: ["bank-accounts"],
        queryFn: getBankAccounts as () => Promise<BankAccount[]>,
        staleTime: 60_000,
    });

    const activeBanks = useMemo(
        () => bankAccounts.filter((b) => b.isActive),
        [bankAccounts]
    );

    // Bank yang terdaftar di quotation ini (bankAccountIds CSV) — di-prioritaskan
    const registeredBankIds = useMemo(() => {
        const csv = (invoice as any).bankAccountIds as string | null;
        if (!csv) return new Set<number>();
        return new Set(
            csv.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
        );
    }, [invoice]);

    const isPartial = amount > 0 && amount < sisaTagihan;
    const isFull = amount >= sisaTagihan;
    const isOverpay = amount > sisaTagihan;
    const needBankPicker = paymentMethod === "BANK_TRANSFER" && createCashflow;

    /** Hitung berapa % nominal dari sisa tagihan. */
    const amountPercent = sisaTagihan > 0 ? (amount / sisaTagihan) * 100 : 0;

    const setAmountByPercent = (pct: number) => {
        const v = Math.round((sisaTagihan * pct) / 100);
        setAmount(v);
    };

    const applyCustomPercent = () => {
        const pct = parseFloat(customPercent);
        if (isNaN(pct) || pct <= 0 || pct > 100) {
            return alert("Persen harus antara 1-100");
        }
        setAmountByPercent(pct);
    };

    const handleSubmit = async () => {
        if (!amount || amount <= 0) return alert("Nominal harus > 0");
        if (needBankPicker && !bankAccountId) {
            return alert("Pilih rekening tujuan untuk pembayaran transfer.");
        }
        if (isOverpay) {
            if (!confirm(`Nominal Rp ${amount.toLocaleString("id-ID")} > sisa tagihan Rp ${sisaTagihan.toLocaleString("id-ID")}.\nYakin lanjut?`)) return;
        }
        await onSubmit({
            amount,
            paidAt,
            paymentMethod,
            paymentRef: paymentRef.trim() || null,
            paymentNote: paymentNote.trim() || null,
            paymentProofUrl: paymentProofUrl || null,
            createCashflow,
            cashflowBankAccountId: needBankPicker ? bankAccountId : null,
        });
    };

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-card rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-success/10">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-success" />
                        <div>
                            <h3 className="font-bold text-foreground">Tandai Pembayaran</h3>
                            <p className="text-[11px] text-muted-foreground">{invoice.invoiceNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded cursor-pointer transition-colors hover:bg-muted">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-4 space-y-3">
                    {/* Summary box */}
                    <div className="bg-muted border border-border rounded p-2.5 text-xs space-y-0.5">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Invoice:</span>
                            <span className="nums font-mono font-bold">Rp {amountToPay.toLocaleString("id-ID")}</span>
                        </div>
                        {alreadyPaid > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Sudah Dibayar:</span>
                                <span className="nums font-mono text-success">Rp {alreadyPaid.toLocaleString("id-ID")}</span>
                            </div>
                        )}
                        <div className="flex justify-between border-t border-border pt-1">
                            <span className="text-foreground font-semibold">Sisa Tagihan:</span>
                            <span className="nums font-mono font-bold text-warning">Rp {sisaTagihan.toLocaleString("id-ID")}</span>
                        </div>
                    </div>

                    {/* Nominal pembayaran */}
                    <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                            Nominal Diterima (Rp) <span className="text-destructive">*</span>
                        </label>
                        <input
                            type="number"
                            value={amount || ""}
                            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full border-2 border-success/50 rounded px-3 py-2 text-sm font-mono font-bold nums"
                            autoFocus
                        />
                        {/* Quick-fill: Lunas + DP (dari quotation) + 25/50/75% + custom */}
                        <div className="mt-1 space-y-1">
                            <div className="flex flex-wrap gap-1">
                                <button
                                    type="button"
                                    onClick={() => setAmount(sisaTagihan)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-success/15 hover:bg-success/25 text-success border border-success/30 font-semibold flex items-center gap-0.5 transition-colors cursor-pointer"
                                >
                                    <CheckCircle2 className="w-3 h-3" />Lunas
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAmountByPercent(dpPercentDefault)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 font-semibold flex items-center gap-0.5 transition-colors cursor-pointer"
                                    title={`DP sesuai persentase di Penawaran (${dpPercentDefault}%)`}
                                >
                                    <Banknote className="w-3 h-3" />DP {dpPercentDefault}%
                                </button>
                                {[25, 50, 75].filter((p) => p !== dpPercentDefault).map((pct) => (
                                    <button
                                        key={pct}
                                        type="button"
                                        onClick={() => setAmountByPercent(pct)}
                                        className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/60 text-muted-foreground border border-border transition-colors cursor-pointer"
                                    >
                                        {pct}%
                                    </button>
                                ))}
                            </div>
                            {/* Custom percent input */}
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">atau % kustom:</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    step="0.1"
                                    value={customPercent}
                                    onChange={(e) => setCustomPercent(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCustomPercent(); } }}
                                    placeholder="mis. 30"
                                    className="w-16 text-[10px] border border-border rounded px-1.5 py-0.5"
                                />
                                <span className="text-[10px] text-muted-foreground">%</span>
                                <button
                                    type="button"
                                    onClick={applyCustomPercent}
                                    disabled={!customPercent}
                                    className="text-[10px] px-2 py-0.5 rounded bg-warning/15 hover:bg-warning/25 text-warning border border-warning/30 font-semibold disabled:opacity-40 transition-colors cursor-pointer"
                                >
                                    Pakai
                                </button>
                                {customPercent && parseFloat(customPercent) > 0 && parseFloat(customPercent) <= 100 && (
                                    <span className="text-[10px] text-muted-foreground nums font-mono">
                                        = Rp {Math.round((sisaTagihan * parseFloat(customPercent)) / 100).toLocaleString("id-ID")}
                                    </span>
                                )}
                            </div>
                        </div>
                        {/* Visual status */}
                        {amount > 0 && (
                            <p className={`text-[11px] mt-1 font-semibold flex items-start gap-1 ${isFull ? "text-success" :
                                isOverpay ? "text-destructive" :
                                    "text-warning"
                                }`}>
                                {isOverpay && <><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" /><span>Lebih bayar Rp <span className="nums">{(amount - sisaTagihan).toLocaleString("id-ID")}</span> — sisa akan dianggap kelebihan</span></>}
                                {isPartial && <><Clock className="w-3.5 h-3.5 flex-shrink-0 mt-px" /><span>Pembayaran sebagian (<span className="nums">{amountPercent.toFixed(1)}</span>% dari sisa tagihan) — status jadi PARTIALLY_PAID. Sisa Rp <span className="nums">{(sisaTagihan - amount).toLocaleString("id-ID")}</span> masih harus dibayar.</span></>}
                                {isFull && !isOverpay && <><CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-px" /><span>Pembayaran lunas — status jadi PAID.</span></>}
                            </p>
                        )}
                    </div>

                    {/* Tanggal */}
                    <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                            Tanggal Pembayaran <span className="text-destructive">*</span>
                        </label>
                        <input
                            type="date"
                            value={paidAt}
                            onChange={(e) => setPaidAt(e.target.value)}
                            className="w-full border border-border rounded px-3 py-2 text-sm"
                        />
                    </div>

                    {/* Metode */}
                    <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">Metode Pembayaran</label>
                        <div className="grid grid-cols-4 gap-1">
                            {([
                                { v: "BANK_TRANSFER" as const, label: "Transfer", icon: Landmark },
                                { v: "CASH" as const, label: "Cash", icon: Banknote },
                                { v: "QRIS" as const, label: "QRIS", icon: QrCode },
                                { v: "OTHER" as const, label: "Lainnya", icon: HelpCircle },
                            ]).map((opt) => {
                                const Icon = opt.icon;
                                return (
                                <button
                                    key={opt.v}
                                    type="button"
                                    onClick={() => setPaymentMethod(opt.v)}
                                    className={`px-2 py-1.5 text-xs rounded border-2 font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 ${paymentMethod === opt.v
                                        ? "border-success bg-success/10 text-success"
                                        : "border-border bg-card text-muted-foreground hover:border-muted-foreground"
                                        }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {opt.label}
                                </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Pilihan Rekening Tujuan — hanya untuk BANK_TRANSFER + createCashflow */}
                    {needBankPicker && (
                        <div>
                            <label className="text-xs font-semibold text-foreground block mb-1">
                                <Building2 className="h-3 w-3 inline -mt-0.5 mr-0.5" />
                                Rekening Tujuan <span className="text-destructive">*</span>
                            </label>
                            {activeBanks.length === 0 ? (
                                <div className="text-xs text-warning bg-warning/15 border border-warning/30 rounded p-2 flex items-start gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                                    <span>Belum ada rekening aktif. Tambahkan dulu di <span className="font-mono">Settings → Bank Accounts</span>.</span>
                                </div>
                            ) : (
                                <div className="space-y-1 max-h-44 overflow-y-auto border border-border rounded p-1">
                                    {activeBanks
                                        // urut: yang terdaftar di quotation duluan
                                        .slice()
                                        .sort((a, b) => {
                                            const aReg = registeredBankIds.has(a.id) ? 0 : 1;
                                            const bReg = registeredBankIds.has(b.id) ? 0 : 1;
                                            return aReg - bReg;
                                        })
                                        .map((bank) => {
                                            const selected = bankAccountId === bank.id;
                                            const isRegistered = registeredBankIds.has(bank.id);
                                            return (
                                                <button
                                                    key={bank.id}
                                                    type="button"
                                                    onClick={() => setBankAccountId(bank.id)}
                                                    className={`w-full text-left px-2.5 py-1.5 rounded border-2 transition-colors cursor-pointer flex items-center justify-between gap-2 ${selected
                                                        ? "border-success bg-success/10"
                                                        : "border-border bg-card hover:border-muted-foreground"
                                                        }`}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs font-bold text-foreground truncate">
                                                                {bank.bankName}
                                                            </span>
                                                            {isRegistered && (
                                                                <span className="text-[9px] px-1 py-0.5 rounded bg-info/15 text-info border border-info/30 font-semibold flex-shrink-0 inline-flex items-center gap-0.5">
                                                                    <ClipboardList className="w-2.5 h-2.5" />Terdaftar
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                                                            {bank.accountNumber} — a.n. {bank.accountOwner}
                                                        </div>
                                                    </div>
                                                    {selected && (
                                                        <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                </div>
                            )}
                            {registeredBankIds.size > 0 && (
                                <p className="text-[10px] text-muted-foreground mt-1 flex items-start gap-1">
                                    <Lightbulb className="w-3 h-3 flex-shrink-0 mt-px" />
                                    <span>Rekening bertanda <span className="font-semibold text-info inline-flex items-center gap-0.5"><ClipboardList className="w-2.5 h-2.5" />Terdaftar</span> = yang dicantumkan di Invoice ini.</span>
                                </p>
                            )}
                        </div>
                    )}

                    {/* No. Referensi */}
                    <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                            No. Referensi <span className="font-normal text-muted-foreground">(opsional)</span>
                        </label>
                        <input
                            type="text"
                            value={paymentRef}
                            onChange={(e) => setPaymentRef(e.target.value)}
                            placeholder="No. transfer / bukti / referensi bank"
                            className="w-full border border-border rounded px-3 py-2 text-sm"
                        />
                    </div>

                    {/* Catatan */}
                    <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                            Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
                        </label>
                        <textarea
                            value={paymentNote}
                            onChange={(e) => setPaymentNote(e.target.value)}
                            placeholder="Mis. 'Bayar tunai via Pak Budi', 'Dipotong PPh 2.5%'"
                            rows={2}
                            className="w-full border border-border rounded px-3 py-2 text-sm"
                        />
                    </div>

                    {/* Bukti Pembayaran (image/PDF upload) */}
                    <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                            <ImageIcon className="h-3 w-3 inline -mt-0.5 mr-0.5" />
                            Bukti Pembayaran <span className="font-normal text-muted-foreground">(opsional)</span>
                        </label>
                        {paymentProofUrl ? (
                            <div className="border border-border rounded p-2 bg-muted flex items-start gap-2">
                                {isPdfProof ? (
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <FileText className="h-8 w-8 text-destructive flex-shrink-0" />
                                        <a
                                            href={proofFullUrl ?? "#"}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-info hover:underline truncate"
                                        >
                                            {paymentProofUrl.split("/").pop()}
                                        </a>
                                    </div>
                                ) : (
                                    <a
                                        href={proofFullUrl ?? "#"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block flex-1 min-w-0"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={proofFullUrl ?? ""}
                                            alt="Bukti pembayaran"
                                            className="max-h-32 max-w-full rounded border border-border object-contain"
                                        />
                                        <p className="text-[10px] text-info hover:underline mt-1 flex items-center gap-1">
                                            <ZoomIn className="w-3 h-3" />Klik untuk perbesar
                                        </p>
                                    </a>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setPaymentProofUrl(null)}
                                    className="p-1 rounded hover:bg-destructive/10 text-destructive flex-shrink-0 cursor-pointer transition-colors"
                                    title="Hapus bukti"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={(e) => handleProofUpload(e.target.files?.[0] ?? null)}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingProof}
                                    className="w-full border-2 border-dashed border-border hover:border-success hover:bg-success/10 rounded px-3 py-3 text-xs text-muted-foreground flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {uploadingProof ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Mengupload...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4" />
                                            Upload Screenshot/Foto Bukti (Image / PDF, max 10MB)
                                        </>
                                    )}
                                </button>
                                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                    <Lightbulb className="w-3 h-3 flex-shrink-0" />Disarankan: screenshot mutasi bank, foto struk QRIS, atau scan kwitansi.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Toggle Cashflow */}
                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded bg-info/10 border border-info/30">
                        <input
                            type="checkbox"
                            checked={createCashflow}
                            onChange={(e) => setCreateCashflow(e.target.checked)}
                            className="w-4 h-4 mt-0.5"
                        />
                        <div>
                            <div className="text-xs font-semibold text-info flex items-center gap-1"><BarChart2 className="w-3.5 h-3.5" />Auto-record di Cashflow</div>
                            <div className="text-[10px] text-info">
                                Otomatis buat entry Cashflow IN dengan kategori &quot;Pembayaran Invoice&quot;. Uncheck kalau ini bukan kas masuk (mis. potong piutang).
                            </div>
                        </div>
                    </label>
                </div>

                <div className="px-4 py-3 border-t border-border bg-muted flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        disabled={pending}
                        className="px-4 py-2 text-sm border-2 border-border rounded hover:bg-muted/60 disabled:opacity-50 cursor-pointer transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={pending || !amount || amount <= 0 || (needBankPicker && !bankAccountId)}
                        className={`px-4 py-2 text-sm rounded font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-colors ${isFull && !isOverpay
                            ? "bg-success text-success-foreground hover:bg-success/90"
                            : isOverpay
                                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                : "bg-warning text-warning-foreground hover:bg-warning/90"
                            }`}
                    >
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        {pending
                            ? "Memproses..."
                            : amount <= 0
                                ? "Catat Pembayaran"
                                : isOverpay
                                    ? `Catat Lebih Bayar (Rp ${amount.toLocaleString("id-ID")})`
                                    : isFull
                                        ? `Tandai Lunas (Rp ${amount.toLocaleString("id-ID")})`
                                        : `Catat Pembayaran Sebagian (Rp ${amount.toLocaleString("id-ID")})`}
                    </button>
                </div>
            </div>
        </div>
    );
}
