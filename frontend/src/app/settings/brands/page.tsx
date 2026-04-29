"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Building, Save, Upload, Image as ImageIcon, ImageOff, Loader2,
    AlertCircle, Check, Hash, MapPin, Phone, Mail, FileText,
} from "lucide-react";
import {
    listBrands, upsertBrand, uploadBrandLogo, removeBrandLogo,
    uploadBrandLetterhead, removeBrandLetterhead,
    uploadBrandStamp, removeBrandStamp, getBrandStats,
    BRAND_META, ACTIVE_BRANDS,
    DEFAULT_DISCLAIMER, DEFAULT_PAYMENT_TERMS, DEFAULT_CLOSING, DEFAULT_INVOICE_CLOSING,
    type Brand, type BrandSettings,
} from "@/lib/api/brands";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

const toast = {
    success: (m: string) => alert(m),
    error: (m: string) => alert(m),
};

export default function BrandsSettingsPage() {
    const qc = useQueryClient();
    const [activeBrand, setActiveBrand] = useState<Brand>("EXINDO");

    const { data: brands = [], isLoading } = useQuery({
        queryKey: ["brand-settings"],
        queryFn: listBrands,
    });

    const current = brands.find((b) => b.brand === activeBrand) ?? null;

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Building className="h-6 w-6 text-blue-600" />
                    Brand / Multi-Perusahaan
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Atur identitas tiap brand. Surat penawaran akan otomatis pakai header & nomor seri sesuai brand
                    yang dipilih saat input lead/RAB.
                </p>
            </div>

            {/* Tab brand picker — kartu besar dengan logo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ACTIVE_BRANDS.map((b) => {
                    const meta = BRAND_META[b];
                    const data = brands.find((x) => x.brand === b);
                    const isActive = activeBrand === b;
                    return (
                        <button
                            key={b}
                            onClick={() => setActiveBrand(b)}
                            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition text-left ${isActive
                                ? `${meta.bg} ${meta.border} shadow-sm`
                                : "bg-white border-slate-200 hover:border-slate-300"
                                }`}
                        >
                            <div className="w-14 h-14 rounded-lg bg-white border flex items-center justify-center overflow-hidden shrink-0">
                                {data?.logoImageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={`${apiBase}${data.logoImageUrl}`} alt={meta.label} className="w-full h-full object-contain" />
                                ) : (
                                    <span className="text-2xl">{meta.emoji}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className={`font-bold ${isActive ? meta.text : "text-slate-800"}`}>
                                    {data?.companyName ?? meta.label}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Kode: <span className="font-mono font-semibold">{data?.companyCode ?? "—"}</span>
                                </div>
                                {!data && (
                                    <div className="text-[10px] text-amber-600 flex items-center gap-1 mt-0.5">
                                        <AlertCircle className="h-3 w-3" />
                                        Belum di-setup
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Form */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat data...
                </div>
            ) : (
                <BrandForm key={activeBrand} brand={activeBrand} initial={current} onSaved={() => qc.invalidateQueries({ queryKey: ["brand-settings"] })} />
            )}
        </div>
    );
}

function BrandForm({
    brand,
    initial,
    onSaved,
}: {
    brand: Brand;
    initial: BrandSettings | null;
    onSaved: () => void;
}) {
    const qc = useQueryClient();
    const [companyName, setCompanyName] = useState(initial?.companyName ?? BRAND_META[brand].label);
    const [companyCode, setCompanyCode] = useState(initial?.companyCode ?? (brand === "EXINDO" ? "Ep" : "Xp"));
    const [directorName, setDirectorName] = useState(initial?.directorName ?? "");
    const [address, setAddress] = useState(initial?.address ?? "");
    const [phone, setPhone] = useState(initial?.phone ?? "");
    const [email, setEmail] = useState(initial?.email ?? "");
    const [npwp, setNpwp] = useState(initial?.npwp ?? "");
    const [bankAccountIds, setBankAccountIds] = useState(initial?.bankAccountIds ?? "");
    const [letterheadFooter, setLetterheadFooter] = useState(initial?.letterheadFooter ?? "");
    const [quotationDisclaimer, setQuotationDisclaimer] = useState(initial?.quotationDisclaimer ?? DEFAULT_DISCLAIMER);
    const [quotationPaymentTerms, setQuotationPaymentTerms] = useState(initial?.quotationPaymentTerms ?? DEFAULT_PAYMENT_TERMS);
    const [quotationClosing, setQuotationClosing] = useState(initial?.quotationClosing ?? DEFAULT_CLOSING);
    const [invoiceClosingText, setInvoiceClosingText] = useState(initial?.invoiceClosingText ?? DEFAULT_INVOICE_CLOSING);
    const [isActive, setIsActive] = useState(initial?.isActive ?? true);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const letterheadInputRef = useRef<HTMLInputElement>(null);
    const stampInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Refresh form when initial changes (brand swap)
        setCompanyName(initial?.companyName ?? BRAND_META[brand].label);
        setCompanyCode(initial?.companyCode ?? (brand === "EXINDO" ? "Ep" : "Xp"));
        setDirectorName(initial?.directorName ?? "");
        setAddress(initial?.address ?? "");
        setPhone(initial?.phone ?? "");
        setEmail(initial?.email ?? "");
        setNpwp(initial?.npwp ?? "");
        setBankAccountIds(initial?.bankAccountIds ?? "");
        setLetterheadFooter(initial?.letterheadFooter ?? "");
        setQuotationDisclaimer(initial?.quotationDisclaimer ?? DEFAULT_DISCLAIMER);
        setQuotationPaymentTerms(initial?.quotationPaymentTerms ?? DEFAULT_PAYMENT_TERMS);
        setQuotationClosing(initial?.quotationClosing ?? DEFAULT_CLOSING);
        setInvoiceClosingText(initial?.invoiceClosingText ?? DEFAULT_INVOICE_CLOSING);
        setIsActive(initial?.isActive ?? true);
    }, [initial, brand]);

    const { data: stats } = useQuery({
        queryKey: ["brand-stats", brand],
        queryFn: () => getBrandStats(brand),
    });

    const saveMut = useMutation({
        mutationFn: () => upsertBrand(brand, {
            companyName, companyCode, directorName, address, phone, email,
            npwp, bankAccountIds, letterheadFooter,
            quotationDisclaimer, quotationPaymentTerms, quotationClosing,
            invoiceClosingText,
            isActive,
        }),
        onSuccess: () => {
            toast.success(`Setting ${BRAND_META[brand].short} tersimpan`);
            onSaved();
        },
        onError: (e: any) => toast.error(e?.response?.data?.message || "Gagal simpan"),
    });

    const uploadLetterheadMut = useMutation({
        mutationFn: (file: File) => uploadBrandLetterhead(brand, file),
        onSuccess: () => {
            toast.success("Kop surat terupload");
            qc.invalidateQueries({ queryKey: ["brand-settings"] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.message || "Gagal upload"),
    });

    const removeLetterheadMut = useMutation({
        mutationFn: () => removeBrandLetterhead(brand),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["brand-settings"] }),
    });

    const uploadStampMut = useMutation({
        mutationFn: (file: File) => uploadBrandStamp(brand, file),
        onSuccess: () => {
            toast.success("Stempel terupload");
            qc.invalidateQueries({ queryKey: ["brand-settings"] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.message || "Gagal upload"),
    });
    const removeStampMut = useMutation({
        mutationFn: () => removeBrandStamp(brand),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["brand-settings"] }),
    });

    const uploadMut = useMutation({
        mutationFn: (file: File) => uploadBrandLogo(brand, file),
        onSuccess: () => {
            toast.success("Logo terupload");
            qc.invalidateQueries({ queryKey: ["brand-settings"] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.message || "Gagal upload"),
    });

    const removeLogoMut = useMutation({
        mutationFn: () => removeBrandLogo(brand),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["brand-settings"] }),
    });

    const meta = BRAND_META[brand];
    const codeLocked = (stats?.quotationCount ?? 0) > 0;

    return (
        <div className={`rounded-xl border-2 ${meta.border} ${meta.bg} p-5 space-y-5`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h2 className={`text-lg font-bold ${meta.text} flex items-center gap-2`}>
                        {meta.emoji} {meta.label}
                    </h2>
                    {stats && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {stats.leadCount} lead · {stats.rabCount} RAB · {stats.quotationCount} quotation
                        </p>
                    )}
                </div>
                <label className="inline-flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                    Brand aktif
                </label>
            </div>

            {/* Logo upload */}
            <div className="flex gap-4 items-start">
                <div className="w-28 h-28 rounded-lg bg-white border-2 border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    {initial?.logoImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`${apiBase}${initial.logoImageUrl}`} alt="logo" className="w-full h-full object-contain" />
                    ) : (
                        <span className="text-4xl">{meta.emoji}</span>
                    )}
                </div>
                <div className="flex-1 space-y-2">
                    <label className="text-sm font-semibold">Logo Brand</label>
                    <p className="text-xs text-muted-foreground">PNG/JPG transparant, dipakai di header surat penawaran. Max 5 MB.</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadMut.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {uploadMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            {initial?.logoImageUrl ? "Ganti Logo" : "Upload Logo"}
                        </button>
                        {initial?.logoImageUrl && (
                            <button
                                onClick={() => { if (confirm("Hapus logo?")) removeLogoMut.mutate(); }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50"
                            >
                                <ImageOff className="h-3.5 w-3.5" /> Hapus
                            </button>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = "";
                                if (f) uploadMut.mutate(f);
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Form fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Nama Perusahaan *" required>
                    <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="form-input"
                        placeholder="CV. Exindo Pratama"
                    />
                </Field>
                <Field label="Kode Perusahaan *" hint={codeLocked ? "🔒 Tidak bisa diubah karena sudah ada quotation" : "Dipakai di nomor seri (mis. Ep / Xp)"} required>
                    <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            value={companyCode}
                            onChange={(e) => setCompanyCode(e.target.value)}
                            disabled={codeLocked}
                            className="form-input pl-10 font-mono uppercase disabled:bg-slate-100"
                            placeholder="Ep"
                            maxLength={20}
                        />
                    </div>
                </Field>

                <Field label="Nama Direktur (untuk tanda tangan)">
                    <input
                        type="text"
                        value={directorName}
                        onChange={(e) => setDirectorName(e.target.value)}
                        className="form-input"
                        placeholder="Nama yang muncul di tanda tangan surat"
                    />
                </Field>
                <Field label="No. Telp / WA" hint="Tampil di kop surat">
                    <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="form-input pl-10"
                            placeholder="0812-xxxx-xxxx"
                        />
                    </div>
                </Field>

                <Field label="Email">
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="form-input pl-10"
                            placeholder="halo@example.com"
                        />
                    </div>
                </Field>
                <Field label="NPWP" hint="Optional, ditampilkan di footer surat">
                    <input
                        type="text"
                        value={npwp}
                        onChange={(e) => setNpwp(e.target.value)}
                        className="form-input"
                        placeholder="00.000.000.0-000.000"
                    />
                </Field>
            </div>

            <Field label="Alamat Lengkap">
                <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <textarea
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        rows={2}
                        className="form-input pl-10 min-h-[60px]"
                        placeholder="Jl. xxx No. xx, Kelurahan, Kota"
                    />
                </div>
            </Field>

            <Field label="Bank Default" hint="ID rekening bank dipisah koma (mis. 1,3) — diambil dari Settings > Rekening Bank">
                <input
                    type="text"
                    value={bankAccountIds}
                    onChange={(e) => setBankAccountIds(e.target.value)}
                    className="form-input font-mono"
                    placeholder="1,2"
                />
            </Field>

            {/* ── Kop Surat (background full-page untuk PDF surat penawaran) ── */}
            <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-4">
                <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <h3 className="font-bold text-slate-900">Kop Surat Brand</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                    Upload <b>file gambar kop surat full-page A4</b> (PNG/JPG, ukuran ideal 2480×3508px atau A4 portrait).
                    Akan dipakai sebagai background otomatis di setiap surat penawaran brand ini.
                </p>
                <div className="flex gap-3 items-start flex-wrap">
                    <div className="w-32 aspect-[210/297] rounded border-2 border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                        {initial?.letterheadImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`${apiBase}${initial.letterheadImageUrl}`} alt="kop surat" className="w-full h-full object-contain" />
                        ) : (
                            <span className="text-xs text-muted-foreground text-center px-2">Belum upload<br />kop surat</span>
                        )}
                    </div>
                    <div className="flex-1 min-w-[200px] space-y-2">
                        <div className="flex gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => letterheadInputRef.current?.click()}
                                disabled={uploadLetterheadMut.isPending}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                                {uploadLetterheadMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                {initial?.letterheadImageUrl ? "Ganti Kop Surat" : "Upload Kop Surat"}
                            </button>
                            {initial?.letterheadImageUrl && (
                                <button
                                    type="button"
                                    onClick={() => { if (confirm("Hapus kop surat? Surat penawaran akan pakai header default.")) removeLetterheadMut.mutate(); }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50"
                                >
                                    <ImageOff className="h-3.5 w-3.5" /> Hapus
                                </button>
                            )}
                            <input
                                ref={letterheadInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    e.target.value = "";
                                    if (f) uploadLetterheadMut.mutate(f);
                                }}
                            />
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                            💡 Tip: pastikan area tengah kop surat kosong (ruang untuk text body surat). Margin atas ~40mm, bawah ~35mm.
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Stempel Default Brand (fallback kalau marketing belum punya stempel pribadi) ── */}
            <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-4">
                <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-amber-600" />
                    <h3 className="font-bold text-slate-900">Stempel Default Brand</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                    Stempel ini dipakai di surat penawaran <b>kalau marketing yang menandatangani belum punya stempel pribadi</b>.
                    PNG transparan ideal supaya menyatu dengan tanda tangan.
                </p>
                <div className="flex gap-3 items-start flex-wrap">
                    <div className="w-28 h-28 rounded-lg border-2 border-slate-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
                        {initial?.stampImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`${apiBase}${initial.stampImageUrl}`} alt="stempel" className="w-full h-full object-contain" />
                        ) : (
                            <span className="text-xs text-muted-foreground text-center px-2">Belum ada stempel</span>
                        )}
                    </div>
                    <div className="flex-1 min-w-[200px] space-y-2">
                        <div className="flex gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => stampInputRef.current?.click()}
                                disabled={uploadStampMut.isPending}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                            >
                                {uploadStampMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                {initial?.stampImageUrl ? "Ganti Stempel" : "Upload Stempel"}
                            </button>
                            {initial?.stampImageUrl && (
                                <button
                                    type="button"
                                    onClick={() => { if (confirm("Hapus stempel default?")) removeStampMut.mutate(); }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50"
                                >
                                    <ImageOff className="h-3.5 w-3.5" /> Hapus
                                </button>
                            )}
                            <input
                                ref={stampInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    e.target.value = "";
                                    if (f) uploadStampMut.mutate(f);
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Text Custom untuk Surat Penawaran ── */}
            <div className="rounded-lg border bg-white p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-violet-600" />
                    <h3 className="font-bold text-slate-900">Text Surat Penawaran (Editable)</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                    Bagian text di bawah ini dipakai otomatis di surat penawaran brand <b>{meta.short}</b>. Boleh edit sesuai kebutuhan.
                </p>

                <Field label="📝 Catatan Harga / Disclaimer" hint="Daftar yang tidak termasuk dalam harga, dll. Pakai # di awal kalau mau bullet-style.">
                    <textarea
                        value={quotationDisclaimer}
                        onChange={(e) => setQuotationDisclaimer(e.target.value)}
                        rows={5}
                        className="form-input font-mono text-xs min-h-[120px]"
                        placeholder={DEFAULT_DISCLAIMER}
                    />
                </Field>

                <Field label="💳 Sistem Pembayaran" hint="Term of payment, pasang/bongkar, dll.">
                    <textarea
                        value={quotationPaymentTerms}
                        onChange={(e) => setQuotationPaymentTerms(e.target.value)}
                        rows={5}
                        className="form-input text-xs min-h-[120px]"
                        placeholder={DEFAULT_PAYMENT_TERMS}
                    />
                </Field>

                <Field label="🤝 Penutup Surat" hint="Kalimat penutup yang muncul sebelum tanda tangan.">
                    <textarea
                        value={quotationClosing}
                        onChange={(e) => setQuotationClosing(e.target.value)}
                        rows={3}
                        className="form-input text-xs min-h-[80px]"
                        placeholder={DEFAULT_CLOSING}
                    />
                </Field>

                <div className="flex justify-between gap-2 pt-2 border-t">
                    <button
                        type="button"
                        onClick={() => {
                            if (confirm("Reset 3 text di atas ke template default?")) {
                                setQuotationDisclaimer(DEFAULT_DISCLAIMER);
                                setQuotationPaymentTerms(DEFAULT_PAYMENT_TERMS);
                                setQuotationClosing(DEFAULT_CLOSING);
                            }
                        }}
                        className="text-xs text-violet-700 hover:underline"
                    >
                        Reset ke template default
                    </button>
                </div>
            </div>

            {/* ── Text Khusus Invoice (Nb pembatalan dll) ── */}
            <div className="rounded-lg border bg-white p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-pink-600" />
                    <h3 className="font-bold text-slate-900">Text Khusus Invoice (Editable)</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                    Text di bawah ini hanya muncul di <b>surat Invoice</b> (tidak di Penawaran).
                    Bagian rekening bank otomatis dari <b>Bank Default Brand</b> di atas.
                </p>

                <Field label="📑 Catatan Invoice (Nb)" hint='Catatan/syarat khusus invoice. Boleh kasih awalan "#" untuk bullet style. Akan tampil setelah list rekening transfer di PDF invoice.'>
                    <textarea
                        value={invoiceClosingText}
                        onChange={(e) => setInvoiceClosingText(e.target.value)}
                        rows={3}
                        className="form-input text-xs min-h-[80px]"
                        placeholder={DEFAULT_INVOICE_CLOSING}
                    />
                </Field>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <button
                        type="button"
                        onClick={() => {
                            if (confirm("Reset Catatan Invoice ke default?")) {
                                setInvoiceClosingText(DEFAULT_INVOICE_CLOSING);
                            }
                        }}
                        className="text-xs text-pink-700 hover:underline"
                    >
                        Reset ke default
                    </button>
                </div>
            </div>

            <Field label="Footer Lama (legacy, optional)" hint="Tidak dipakai lagi — gunakan 'Penutup Surat' di atas.">
                <textarea
                    value={letterheadFooter}
                    onChange={(e) => setLetterheadFooter(e.target.value)}
                    rows={2}
                    className="form-input text-xs min-h-[50px] opacity-60"
                    placeholder="(kosongkan)"
                />
            </Field>

            <div className="flex justify-end pt-2 border-t">
                <button
                    onClick={() => saveMut.mutate()}
                    disabled={saveMut.isPending || !companyName.trim() || !companyCode.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                    {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Simpan {meta.short}
                </button>
            </div>
        </div>
    );
}

function Field({
    label,
    hint,
    required,
    children,
}: {
    label: string;
    hint?: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                {label}
            </span>
            {children}
            {hint && <span className="text-[11px] text-muted-foreground mt-0.5 block">{hint}</span>}
        </label>
    );
}
