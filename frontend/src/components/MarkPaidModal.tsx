"use client";

import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, CheckCircle2, Loader2, Building2, Upload, Image as ImageIcon, FileText, Trash2 } from "lucide-react";
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
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="px-4 py-3 border-b flex items-center justify-between bg-emerald-50">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <div>
                            <h3 className="font-bold text-slate-900">Tandai Pembayaran</h3>
                            <p className="text-[11px] text-slate-600">{invoice.invoiceNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-4 space-y-3">
                    {/* Summary box */}
                    <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-xs space-y-0.5">
                        <div className="flex justify-between">
                            <span className="text-slate-600">Total Invoice:</span>
                            <span className="font-mono font-bold">Rp {amountToPay.toLocaleString("id-ID")}</span>
                        </div>
                        {alreadyPaid > 0 && (
                            <div className="flex justify-between">
                                <span className="text-slate-600">Sudah Dibayar:</span>
                                <span className="font-mono text-emerald-700">Rp {alreadyPaid.toLocaleString("id-ID")}</span>
                            </div>
                        )}
                        <div className="flex justify-between border-t border-slate-300 pt-1">
                            <span className="text-slate-700 font-semibold">Sisa Tagihan:</span>
                            <span className="font-mono font-bold text-amber-700">Rp {sisaTagihan.toLocaleString("id-ID")}</span>
                        </div>
                    </div>

                    {/* Nominal pembayaran */}
                    <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Nominal Diterima (Rp) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            value={amount || ""}
                            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full border-2 border-emerald-300 rounded px-3 py-2 text-sm font-mono font-bold"
                            autoFocus
                        />
                        {/* Quick-fill: Lunas + DP (dari quotation) + 25/50/75% + custom */}
                        <div className="mt-1 space-y-1">
                            <div className="flex flex-wrap gap-1">
                                <button
                                    type="button"
                                    onClick={() => setAmount(sisaTagihan)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 font-semibold"
                                >
                                    💯 Lunas
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAmountByPercent(dpPercentDefault)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-300 font-semibold"
                                    title={`DP sesuai persentase di Penawaran (${dpPercentDefault}%)`}
                                >
                                    💰 DP {dpPercentDefault}%
                                </button>
                                {[25, 50, 75].filter((p) => p !== dpPercentDefault).map((pct) => (
                                    <button
                                        key={pct}
                                        type="button"
                                        onClick={() => setAmountByPercent(pct)}
                                        className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                                    >
                                        {pct}%
                                    </button>
                                ))}
                            </div>
                            {/* Custom percent input */}
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-500">atau % kustom:</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    step="0.1"
                                    value={customPercent}
                                    onChange={(e) => setCustomPercent(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCustomPercent(); } }}
                                    placeholder="mis. 30"
                                    className="w-16 text-[10px] border rounded px-1.5 py-0.5"
                                />
                                <span className="text-[10px] text-slate-500">%</span>
                                <button
                                    type="button"
                                    onClick={applyCustomPercent}
                                    disabled={!customPercent}
                                    className="text-[10px] px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 font-semibold disabled:opacity-40"
                                >
                                    Pakai
                                </button>
                                {customPercent && parseFloat(customPercent) > 0 && parseFloat(customPercent) <= 100 && (
                                    <span className="text-[10px] text-slate-600 font-mono">
                                        = Rp {Math.round((sisaTagihan * parseFloat(customPercent)) / 100).toLocaleString("id-ID")}
                                    </span>
                                )}
                            </div>
                        </div>
                        {/* Visual status */}
                        {amount > 0 && (
                            <p className={`text-[11px] mt-1 font-semibold ${isFull ? "text-emerald-700" :
                                isOverpay ? "text-red-700" :
                                    "text-amber-700"
                                }`}>
                                {isOverpay && `⚠️ Lebih bayar Rp ${(amount - sisaTagihan).toLocaleString("id-ID")} — sisa akan dianggap kelebihan`}
                                {isPartial && `⏳ Pembayaran sebagian (${amountPercent.toFixed(1)}% dari sisa tagihan) — status jadi PARTIALLY_PAID. Sisa Rp ${(sisaTagihan - amount).toLocaleString("id-ID")} masih harus dibayar.`}
                                {isFull && !isOverpay && `✅ Pembayaran lunas — status jadi PAID.`}
                            </p>
                        )}
                    </div>

                    {/* Tanggal */}
                    <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Tanggal Pembayaran <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={paidAt}
                            onChange={(e) => setPaidAt(e.target.value)}
                            className="w-full border rounded px-3 py-2 text-sm"
                        />
                    </div>

                    {/* Metode */}
                    <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Metode Pembayaran</label>
                        <div className="grid grid-cols-4 gap-1">
                            {([
                                { v: "BANK_TRANSFER" as const, label: "🏦 Transfer" },
                                { v: "CASH" as const, label: "💵 Cash" },
                                { v: "QRIS" as const, label: "📱 QRIS" },
                                { v: "OTHER" as const, label: "❓ Lainnya" },
                            ]).map((opt) => (
                                <button
                                    key={opt.v}
                                    type="button"
                                    onClick={() => setPaymentMethod(opt.v)}
                                    className={`px-2 py-1.5 text-xs rounded border-2 font-medium transition ${paymentMethod === opt.v
                                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Pilihan Rekening Tujuan — hanya untuk BANK_TRANSFER + createCashflow */}
                    {needBankPicker && (
                        <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">
                                <Building2 className="h-3 w-3 inline -mt-0.5 mr-0.5" />
                                Rekening Tujuan <span className="text-red-500">*</span>
                            </label>
                            {activeBanks.length === 0 ? (
                                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                                    ⚠️ Belum ada rekening aktif. Tambahkan dulu di <span className="font-mono">Settings → Bank Accounts</span>.
                                </div>
                            ) : (
                                <div className="space-y-1 max-h-44 overflow-y-auto border rounded p-1">
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
                                                    className={`w-full text-left px-2.5 py-1.5 rounded border-2 transition flex items-center justify-between gap-2 ${selected
                                                        ? "border-emerald-600 bg-emerald-50"
                                                        : "border-slate-200 bg-white hover:border-slate-400"
                                                        }`}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs font-bold text-slate-900 truncate">
                                                                {bank.bankName}
                                                            </span>
                                                            {isRegistered && (
                                                                <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-300 font-semibold flex-shrink-0">
                                                                    📋 Terdaftar
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-600 font-mono truncate">
                                                            {bank.accountNumber} — a.n. {bank.accountOwner}
                                                        </div>
                                                    </div>
                                                    {selected && (
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                </div>
                            )}
                            {registeredBankIds.size > 0 && (
                                <p className="text-[10px] text-slate-500 mt-1">
                                    💡 Rekening bertanda <span className="font-semibold text-blue-700">📋 Terdaftar</span> = yang dicantumkan di Invoice ini.
                                </p>
                            )}
                        </div>
                    )}

                    {/* No. Referensi */}
                    <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                            No. Referensi <span className="font-normal text-slate-500">(opsional)</span>
                        </label>
                        <input
                            type="text"
                            value={paymentRef}
                            onChange={(e) => setPaymentRef(e.target.value)}
                            placeholder="No. transfer / bukti / referensi bank"
                            className="w-full border rounded px-3 py-2 text-sm"
                        />
                    </div>

                    {/* Catatan */}
                    <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Catatan <span className="font-normal text-slate-500">(opsional)</span>
                        </label>
                        <textarea
                            value={paymentNote}
                            onChange={(e) => setPaymentNote(e.target.value)}
                            placeholder="Mis. 'Bayar tunai via Pak Budi', 'Dipotong PPh 2.5%'"
                            rows={2}
                            className="w-full border rounded px-3 py-2 text-sm"
                        />
                    </div>

                    {/* Bukti Pembayaran (image/PDF upload) */}
                    <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                            <ImageIcon className="h-3 w-3 inline -mt-0.5 mr-0.5" />
                            Bukti Pembayaran <span className="font-normal text-slate-500">(opsional)</span>
                        </label>
                        {paymentProofUrl ? (
                            <div className="border rounded p-2 bg-slate-50 flex items-start gap-2">
                                {isPdfProof ? (
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <FileText className="h-8 w-8 text-red-600 flex-shrink-0" />
                                        <a
                                            href={proofFullUrl ?? "#"}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:underline truncate"
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
                                            className="max-h-32 max-w-full rounded border object-contain"
                                        />
                                        <p className="text-[10px] text-blue-600 hover:underline mt-1">
                                            🔍 Klik untuk perbesar
                                        </p>
                                    </a>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setPaymentProofUrl(null)}
                                    className="p-1 rounded hover:bg-red-100 text-red-600 flex-shrink-0"
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
                                    className="w-full border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50 rounded px-3 py-3 text-xs text-slate-600 flex items-center justify-center gap-1.5 transition disabled:opacity-50"
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
                                <p className="text-[10px] text-slate-500 mt-1">
                                    💡 Disarankan: screenshot mutasi bank, foto struk QRIS, atau scan kwitansi.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Toggle Cashflow */}
                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded bg-blue-50 border border-blue-200">
                        <input
                            type="checkbox"
                            checked={createCashflow}
                            onChange={(e) => setCreateCashflow(e.target.checked)}
                            className="w-4 h-4 mt-0.5"
                        />
                        <div>
                            <div className="text-xs font-semibold text-blue-900">📊 Auto-record di Cashflow</div>
                            <div className="text-[10px] text-blue-700">
                                Otomatis buat entry Cashflow IN dengan kategori &quot;Pembayaran Invoice&quot;. Uncheck kalau ini bukan kas masuk (mis. potong piutang).
                            </div>
                        </div>
                    </label>
                </div>

                <div className="px-4 py-3 border-t bg-slate-50 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        disabled={pending}
                        className="px-4 py-2 text-sm border-2 rounded hover:bg-slate-100 disabled:opacity-50"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={pending || !amount || amount <= 0 || (needBankPicker && !bankAccountId)}
                        className={`px-4 py-2 text-sm text-white rounded font-bold flex items-center gap-1.5 disabled:opacity-50 ${isFull && !isOverpay
                            ? "bg-emerald-600 hover:bg-emerald-700"
                            : isOverpay
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-amber-600 hover:bg-amber-700"
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
                                        ? `✅ Tandai Lunas (Rp ${amount.toLocaleString("id-ID")})`
                                        : `⏳ Catat Pembayaran Sebagian (Rp ${amount.toLocaleString("id-ID")})`}
                    </button>
                </div>
            </div>
        </div>
    );
}
