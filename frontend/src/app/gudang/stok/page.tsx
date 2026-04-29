"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Search, Plus, Minus, Camera, Package, Loader2,
    User, KeyRound, LogOut, X, Check, ArrowUpCircle, Edit3, PackagePlus, AlertCircle,
    UserCheck, UserPlus, Phone, Briefcase,
} from "lucide-react";
import {
    bootstrapPublicGudang, savePin, clearPin, readPin,
    restockPublicGudang, adjustStockPublicGudang, createNewItemPublicGudang,
    registerPublicWorker,
    type Bootstrap, type PublicWorker, type PublicWarehouse, type PublicProduct,
} from "@/lib/api/publicGudang";
import { verifyWarehousePin, getWarehousePinStatus } from "@/lib/api/warehousePin";
import { CameraCaptureModal } from "@/components/CameraCaptureModal";

// ════════════════════════════════════════════════════════════════════════════
// PIN GATE (sama dengan /gudang/ambil — pakai pattern yang sudah ada)
// ════════════════════════════════════════════════════════════════════════════

function PinGate({ onUnlock }: { onUnlock: () => void }) {
    const [pin, setPin] = useState("");
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const { data: status } = useQuery({
        queryKey: ["warehouse-pin-status"],
        queryFn: getWarehousePinStatus,
    });

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);
        if (!/^\d{4,8}$/.test(pin)) {
            setErr("PIN harus angka 4–8 digit");
            return;
        }
        setLoading(true);
        try {
            const res = await verifyWarehousePin(pin);
            if (!res.ok) {
                setErr("PIN salah");
                return;
            }
            savePin(pin);
            onUnlock();
        } catch (e: any) {
            setErr(e?.response?.data?.message || "Gagal verifikasi");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-primary/20 via-background to-background flex items-center justify-center p-4 z-50">
            <form onSubmit={handleSubmit} className="bg-card border rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
                <div className="flex flex-col items-center text-center">
                    <div className="rounded-full bg-primary/10 p-3 mb-3">
                        <KeyRound className="h-8 w-8 text-primary" />
                    </div>
                    <h1 className="text-lg font-bold">Stok Gudang Lapangan</h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Masukkan PIN untuk tambah/edit stok atau daftar barang baru.
                    </p>
                </div>

                {status?.isSet === false && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                        PIN belum diatur oleh admin.
                    </div>
                )}

                <div>
                    <label className="text-xs font-medium block mb-1">PIN</label>
                    <input
                        type="password"
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={8}
                        autoFocus
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                        className="w-full border rounded px-3 py-3 text-center text-xl font-mono tracking-[0.5em]"
                        placeholder="••••"
                    />
                </div>
                {err && <p className="text-xs text-red-600">{err}</p>}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-primary-foreground rounded py-2.5 font-semibold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Buka
                </button>
                <a
                    href="/gudang/ambil"
                    className="w-full border rounded py-2 text-xs text-center block hover:bg-muted"
                >
                    Ke halaman Ambil/Kembali
                </a>
                <a
                    href="/"
                    className="w-full border rounded py-2 text-sm text-red-600 hover:bg-red-50 border-red-200 flex items-center justify-center gap-2"
                >
                    <LogOut className="h-4 w-4" /> Keluar
                </a>
            </form>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// WORKER SELECTOR (sticky di top)
// ════════════════════════════════════════════════════════════════════════════

function WorkerGreetingBar({
    workers,
    selectedId,
    onSwitch,
}: {
    workers: PublicWorker[];
    selectedId: number | null;
    onSwitch: () => void;
}) {
    const selected = workers.find((w) => w.id === selectedId);
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    const greeting = (() => {
        const h = new Date().getHours();
        if (h < 11) return "Selamat pagi";
        if (h < 15) return "Selamat siang";
        if (h < 18) return "Selamat sore";
        return "Selamat malam";
    })();

    if (!selected) return null;

    const initials = (selected.fullName || selected.name)
        .split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();

    return (
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b-2 border-primary/20 px-3 sm:px-4 py-2.5 sticky top-0 z-20">
            <div className="flex items-center gap-3 max-w-3xl mx-auto">
                {/* Avatar */}
                <div className="w-11 h-11 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center shrink-0 overflow-hidden">
                    {selected.photoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={`${apiBase}${selected.photoUrl}`} alt={selected.name} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-sm font-bold text-primary">{initials}</span>
                    )}
                </div>
                {/* Name + greeting */}
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-muted-foreground leading-none">{greeting}, 👋</div>
                    <div className="text-sm font-bold leading-tight truncate">{selected.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                        {selected.position ?? "—"}
                    </div>
                </div>
                {/* Switch button */}
                <button
                    onClick={onSwitch}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border bg-white hover:bg-muted text-[11px] font-medium"
                >
                    Bukan saya
                </button>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// VARIANT SEARCH (dipakai mode 1 & 2)
// ════════════════════════════════════════════════════════════════════════════

interface FlatVariant {
    variantId: number;
    sku: string;
    productId: number;
    productName: string;
    variantName: string | null;
    stock: number;
    imageUrl: string | null;
    categoryName: string | null;
    unitName: string | null;
    warehouseName: string | null;     // 🆕 gudang lokasi varian
    warehouseId: number | null;
}

function flattenProducts(products: PublicProduct[]): FlatVariant[] {
    return products.flatMap((p) =>
        p.variants.map((v) => ({
            variantId: v.id,
            sku: v.sku,
            productId: p.id,
            productName: p.name,
            variantName: v.variantName,
            stock: v.stock,
            imageUrl: v.variantImageUrl ?? p.imageUrl,
            categoryName: p.category?.name ?? null,
            unitName: p.unit?.name ?? null,
            warehouseName: v.defaultWarehouse?.name ?? null,
            warehouseId: v.defaultWarehouse?.id ?? null,
        }))
    );
}

function VariantPicker({
    flat,
    onPick,
    selectedId,
    apiBase,
}: {
    flat: FlatVariant[];
    onPick: (v: FlatVariant) => void;
    selectedId: number | null;
    apiBase: string;
}) {
    const [q, setQ] = useState("");
    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return flat.slice(0, 30);
        return flat
            .filter((v) =>
                `${v.productName} ${v.variantName ?? ""} ${v.sku} ${v.categoryName ?? ""}`
                    .toLowerCase()
                    .includes(s)
            )
            .slice(0, 50);
    }, [flat, q]);

    return (
        <div className="space-y-2">
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Cari nama / SKU / kategori…"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border-2 rounded-lg"
                />
            </div>
            <div className="max-h-72 overflow-y-auto border rounded-lg divide-y bg-background">
                {filtered.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                        {q ? `Tidak ada yang cocok dengan "${q}"` : "Mulai ketik untuk cari…"}
                    </div>
                ) : (
                    filtered.map((v) => {
                        const active = v.variantId === selectedId;
                        return (
                            <button
                                key={v.variantId}
                                type="button"
                                onClick={() => onPick(v)}
                                className={`w-full text-left p-2.5 hover:bg-muted/50 transition flex items-center gap-2.5 ${active ? "bg-primary/10" : ""}`}
                            >
                                {v.imageUrl ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                        src={`${apiBase}${v.imageUrl}`}
                                        alt={v.productName}
                                        className="w-10 h-10 rounded object-cover bg-muted shrink-0"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                                        <Package className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">
                                        {v.productName}
                                        {v.variantName && v.variantName !== "Default" && <span className="text-muted-foreground"> · {v.variantName}</span>}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground truncate">
                                        {v.sku}{v.categoryName ? ` · ${v.categoryName}` : ""}
                                        {v.warehouseName && (
                                            <span className="ml-1 inline-flex items-center gap-0.5 px-1 py-0 rounded bg-blue-100 text-blue-800 text-[9px] font-semibold">
                                                📍 {v.warehouseName}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className={`text-sm font-bold ${v.stock > 0 ? "text-emerald-700" : "text-red-600"}`}>
                                        {v.stock}
                                    </div>
                                    <div className="text-[9px] text-muted-foreground">{v.unitName ?? "unit"}</div>
                                </div>
                                {active && <Check className="h-4 w-4 text-primary shrink-0" />}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

type Mode = "restock" | "adjust" | "new-item";

export default function GudangStokPage() {
    const [unlocked, setUnlocked] = useState<boolean | null>(null);

    useEffect(() => {
        setUnlocked(!!readPin());
    }, []);

    if (unlocked === null) {
        return <div className="p-8 text-center text-sm text-muted-foreground">Memuat…</div>;
    }
    if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;
    return <Inner onLock={() => { clearPin(); setUnlocked(false); }} />;
}

function Inner({ onLock }: { onLock: () => void }) {
    const qc = useQueryClient();
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    const [mode, setMode] = useState<Mode>("restock");

    // Restore last-selected worker dari localStorage
    const [workerId, setWorkerId] = useState<number | null>(() => {
        if (typeof window === "undefined") return null;
        const v = localStorage.getItem("pospro:gudang:lastWorkerId");
        const n = v ? Number(v) : NaN;
        return Number.isFinite(n) && n > 0 ? n : null;
    });
    useEffect(() => {
        if (workerId) localStorage.setItem("pospro:gudang:lastWorkerId", String(workerId));
    }, [workerId]);

    // Welcome screen: tampil saat user belum pilih nama (workerId null)
    // atau klik "Bukan Saya" dari main page
    const [showWelcome, setShowWelcome] = useState(false);
    const [showRegister, setShowRegister] = useState(false);

    const { data: bootstrap, isLoading, error } = useQuery({
        queryKey: ["public-gudang-bootstrap-stok"],
        queryFn: bootstrapPublicGudang,
    });

    // Trigger welcome screen kalau belum ada workerId pilihan & sudah load
    useEffect(() => {
        if (bootstrap && !workerId) {
            setShowWelcome(true);
        }
    }, [bootstrap, workerId]);

    const flat = useMemo(() => bootstrap ? flattenProducts(bootstrap.products) : [], [bootstrap]);

    if (isLoading) {
        return (
            <div className="p-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Memuat data gudang…</p>
            </div>
        );
    }
    if (error || !bootstrap) {
        return (
            <div className="p-8 text-center">
                <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <p className="text-sm text-red-600">Gagal load data — coba refresh.</p>
                <button onClick={onLock} className="mt-3 text-xs underline text-muted-foreground">Logout PIN</button>
            </div>
        );
    }

    const selectedWorker = bootstrap.workers.find((w) => w.id === workerId) ?? null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background pb-12">
            {/* Header — bigger, more visual */}
            <div className="bg-background border-b shadow-sm px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                        <PackagePlus className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-base sm:text-lg font-bold leading-tight">Stok Lapangan</h1>
                        <p className="text-[10px] text-muted-foreground hidden sm:block leading-tight">
                            Catat stok masuk · Hitung ulang · Daftar barang baru
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <a
                        href="/gudang/ambil"
                        className="text-[11px] sm:text-xs px-2.5 py-1.5 border-2 border-blue-200 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium inline-flex items-center gap-1"
                        title="Ambil / Kembalikan barang"
                    >
                        📦 <span className="hidden sm:inline">Ambil/Kembali</span>
                    </a>
                    <button
                        onClick={onLock}
                        className="text-[11px] sm:text-xs px-2.5 py-1.5 border-2 rounded-lg hover:bg-red-50 text-red-600 border-red-200 inline-flex items-center gap-1"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Keluar</span>
                    </button>
                </div>
            </div>

            {/* Worker selector sticky */}
            <WorkerGreetingBar
                workers={bootstrap.workers}
                selectedId={workerId}
                onSwitch={() => { setWorkerId(null); setShowWelcome(true); }}
            />

            {/* Mode picker — card-style yang besar & visual */}
            <div className="bg-background border-b px-3 sm:px-4 py-3">
                <div className="max-w-3xl mx-auto">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Mau melakukan apa?
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <ModeCard
                            active={mode === "restock"}
                            onClick={() => setMode("restock")}
                            emoji="📥"
                            title="Barang Masuk"
                            subtitle="Tambah stok"
                            cls="emerald"
                        />
                        <ModeCard
                            active={mode === "adjust"}
                            onClick={() => setMode("adjust")}
                            emoji="✏️"
                            title="Hitung Ulang"
                            subtitle="Koreksi stok"
                            cls="amber"
                        />
                        <ModeCard
                            active={mode === "new-item"}
                            onClick={() => setMode("new-item")}
                            emoji="🆕"
                            title="Barang Baru"
                            subtitle="Belum ada"
                            cls="violet"
                        />
                    </div>
                    {/* Hint text per mode aktif */}
                    <div className="text-[11px] text-center text-muted-foreground mt-2 italic">
                        {mode === "restock" && "💡 Pakai saat barang masuk gudang (pulang event, beli dari supplier)"}
                        {mode === "adjust" && "💡 Pakai untuk koreksi setelah cek fisik (hilang, rusak, selisih)"}
                        {mode === "new-item" && "💡 Pakai untuk daftarkan barang yang belum ada di sistem"}
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="max-w-3xl mx-auto p-3 sm:p-4">
                {!workerId && (
                    <div className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 p-4 text-center">
                        <User className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-amber-900">Pilih nama Anda dulu di atas</p>
                        <p className="text-xs text-amber-700 mt-1">Wajib untuk audit log siapa yang melakukan perubahan stok.</p>
                    </div>
                )}

                {workerId && mode === "restock" && (
                    <RestockForm
                        workerId={workerId}
                        worker={selectedWorker}
                        warehouses={bootstrap.warehouses}
                        flat={flat}
                        apiBase={apiBase}
                        onSuccess={() => qc.invalidateQueries({ queryKey: ["public-gudang-bootstrap-stok"] })}
                    />
                )}
                {workerId && mode === "adjust" && (
                    <AdjustForm
                        workerId={workerId}
                        worker={selectedWorker}
                        warehouses={bootstrap.warehouses}
                        flat={flat}
                        apiBase={apiBase}
                        onSuccess={() => qc.invalidateQueries({ queryKey: ["public-gudang-bootstrap-stok"] })}
                    />
                )}
                {workerId && mode === "new-item" && (
                    <NewItemForm
                        workerId={workerId}
                        worker={selectedWorker}
                        warehouses={bootstrap.warehouses}
                        categories={bootstrap.categories}
                        units={bootstrap.units}
                        onSuccess={() => qc.invalidateQueries({ queryKey: ["public-gudang-bootstrap-stok"] })}
                    />
                )}

                {/* Tombol "Bukan saya" — tukang bisa ganti nama (mis. HP dipakai bareng) */}
                {workerId && (
                    <div className="text-center pt-3">
                        <button
                            type="button"
                            onClick={() => { setWorkerId(null); setShowWelcome(true); }}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                        >
                            Bukan saya, ganti nama
                        </button>
                    </div>
                )}
            </div>

            {/* Welcome modal — tampil saat user belum pilih identitas */}
            {showWelcome && (
                <WelcomeModal
                    workers={bootstrap.workers}
                    onPickExisting={(id) => {
                        setWorkerId(id);
                        setShowWelcome(false);
                    }}
                    onWantRegister={() => {
                        setShowWelcome(false);
                        setShowRegister(true);
                    }}
                    onClose={() => setShowWelcome(false)}
                />
            )}

            {/* Register modal — form lengkap */}
            {showRegister && (
                <RegisterWorkerModal
                    onClose={() => {
                        setShowRegister(false);
                        if (!workerId) setShowWelcome(true);
                    }}
                    onRegistered={(newWorker) => {
                        // Auto-select worker yang baru daftar
                        setWorkerId(newWorker.id);
                        setShowRegister(false);
                        setShowWelcome(false);
                        qc.invalidateQueries({ queryKey: ["public-gudang-bootstrap-stok"] });
                    }}
                />
            )}
        </div>
    );
}

function ModeCard({
    active, onClick, emoji, title, subtitle, cls,
}: {
    active: boolean;
    onClick: () => void;
    emoji: string;
    title: string;
    subtitle: string;
    cls: "emerald" | "amber" | "violet";
}) {
    const activeCls = {
        emerald: "bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-300",
        amber: "bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-300",
        violet: "bg-violet-600 text-white border-violet-700 shadow-md ring-2 ring-violet-300",
    }[cls];
    const idleCls = {
        emerald: "bg-emerald-50/50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-400",
        amber: "bg-amber-50/50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-400",
        violet: "bg-violet-50/50 text-violet-700 border-violet-200 hover:bg-violet-100 hover:border-violet-400",
    }[cls];
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex flex-col items-center justify-center gap-0.5 px-2 py-3 rounded-xl border-2 transition-all active:scale-95 ${active ? activeCls : idleCls}`}
        >
            <span className="text-2xl sm:text-3xl leading-none">{emoji}</span>
            <span className="text-xs sm:text-sm font-bold mt-1">{title}</span>
            <span className={`text-[9px] sm:text-[10px] ${active ? "opacity-90" : "opacity-70"}`}>{subtitle}</span>
        </button>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// MODE 1: RESTOCK FORM
// ════════════════════════════════════════════════════════════════════════════

function RestockForm({
    workerId, worker, warehouses, flat, apiBase, onSuccess,
}: {
    workerId: number;
    worker: PublicWorker | null;
    warehouses: PublicWarehouse[];
    flat: FlatVariant[];
    apiBase: string;
    onSuccess: () => void;
}) {
    const [picked, setPicked] = useState<FlatVariant | null>(null);
    const [qty, setQty] = useState(1);
    const [warehouseId, setWarehouseId] = useState<number | null>(warehouses[0]?.id ?? null);
    const [reason, setReason] = useState("");
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);

    const mut = useMutation({
        mutationFn: async () => {
            if (!picked) throw new Error("Pilih item dulu");
            if (qty <= 0) throw new Error("Quantity harus > 0");
            const fd = new FormData();
            fd.append("workerId", String(workerId));
            fd.append("productVariantId", String(picked.variantId));
            if (warehouseId) fd.append("warehouseId", String(warehouseId));
            fd.append("quantity", String(qty));
            if (reason.trim()) fd.append("reason", reason.trim());
            if (photo) fd.append("photo", photo);
            return restockPublicGudang(fd);
        },
        onSuccess: (res) => {
            setSuccess(`✅ Berhasil restok "${res.variant.productName}" — stok ${res.variant.stockBefore} → ${res.variant.stockAfter}`);
            setPicked(null);
            setQty(1);
            setReason("");
            setPhoto(null);
            setPhotoPreview(null);
            onSuccess();
            setTimeout(() => setSuccess(null), 5000);
        },
    });

    return (
        <div className="space-y-3">
            <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/40 p-3">
                <h2 className="text-sm font-bold text-emerald-900 inline-flex items-center gap-1.5">
                    <ArrowUpCircle className="h-4 w-4" /> Tambah Stok (Restok Barang Masuk)
                </h2>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                    Untuk barang yang baru kembali dari event / pembelian baru. Stok akan <b>bertambah</b>.
                </p>
            </div>

            {/* Pick item */}
            <div className="bg-background border rounded-lg p-3 space-y-2">
                <label className="text-xs font-semibold text-foreground block">1. Pilih Barang</label>
                {picked ? (
                    <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded border border-emerald-200">
                        {picked.imageUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={`${apiBase}${picked.imageUrl}`} alt="" className="w-12 h-12 rounded object-cover" />
                        ) : (
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">{picked.productName}</div>
                            <div className="text-[10px] text-muted-foreground">
                                {picked.sku} · Stok skrg: <b>{picked.stock}</b> {picked.unitName ?? "unit"}
                                {picked.warehouseName && (
                                    <span className="ml-1 inline-flex items-center gap-0.5 px-1 py-0 rounded bg-blue-100 text-blue-800 text-[9px] font-semibold">
                                        📍 {picked.warehouseName}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button onClick={() => setPicked(null)} className="p-1 hover:bg-red-100 rounded text-red-600"><X className="h-4 w-4" /></button>
                    </div>
                ) : (
                    <VariantPicker flat={flat} onPick={setPicked} selectedId={null} apiBase={apiBase} />
                )}
            </div>

            {picked && (
                <>
                    {/* Qty stepper */}
                    <div className="bg-background border rounded-lg p-3 space-y-2">
                        <label className="text-xs font-semibold block">2. Jumlah Tambahan</label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setQty((q) => Math.max(1, q - 1))}
                                className="h-12 w-12 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 inline-flex items-center justify-center text-xl font-bold"
                            >
                                <Minus className="h-5 w-5" />
                            </button>
                            <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                value={qty}
                                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                                className="flex-1 h-12 text-center text-2xl font-bold border-2 border-emerald-300 rounded-lg"
                            />
                            <button
                                type="button"
                                onClick={() => setQty((q) => q + 1)}
                                className="h-12 w-12 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 inline-flex items-center justify-center text-xl font-bold"
                            >
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                            {[5, 10, 25, 50].map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => setQty((q) => q + n)}
                                    className="text-xs py-1.5 rounded border bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                >
                                    +{n}
                                </button>
                            ))}
                        </div>
                        <p className="text-[11px] text-emerald-700 bg-emerald-50 rounded p-1.5 text-center">
                            Stok setelah: <b>{picked.stock + qty}</b> {picked.unitName ?? "unit"} (sebelumnya {picked.stock})
                        </p>
                    </div>

                    {/* Warehouse + reason + photo */}
                    <div className="bg-background border rounded-lg p-3 space-y-2.5">
                        <div>
                            <label className="text-xs font-semibold block mb-1">3. Gudang Tujuan (opsional)</label>
                            <select
                                value={warehouseId ?? ""}
                                onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : null)}
                                className="w-full border rounded px-2 py-2 text-sm"
                            >
                                <option value="">— Tidak spesifik —</option>
                                {warehouses.map((w) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold block mb-1">Catatan / Sumber (opsional)</label>
                            <input
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Mis. Pulang event Marina, Beli dari supplier X"
                                className="w-full border rounded px-2 py-2 text-sm"
                                maxLength={200}
                            />
                        </div>
                        <PhotoCapture
                            photo={photo}
                            preview={photoPreview}
                            onCapture={(file, preview) => { setPhoto(file); setPhotoPreview(preview); }}
                            onClear={() => { setPhoto(null); setPhotoPreview(null); }}
                            showCamera={showCamera}
                            setShowCamera={setShowCamera}
                            label="Foto bukti barang masuk (opsional)"
                        />
                    </div>

                    {/* Submit */}
                    <button
                        type="button"
                        disabled={mut.isPending || !picked || qty <= 0}
                        onClick={() => mut.mutate()}
                        className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow"
                    >
                        {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        ✅ Konfirmasi Restok +{qty} oleh {worker?.name ?? "—"}
                    </button>

                    {mut.isError && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                            {(mut.error as any)?.response?.data?.message || (mut.error as Error).message}
                        </div>
                    )}
                </>
            )}

            {success && (
                <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 shadow-md animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-start gap-2">
                        <div className="text-2xl">🎉</div>
                        <div className="flex-1">{success}</div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// MODE 2: ADJUST FORM
// ════════════════════════════════════════════════════════════════════════════

const ADJUST_REASONS = [
    "Hilang / rusak",
    "Selisih hitung fisik",
    "Pecah saat bongkar muat",
    "Tidak ditemukan",
    "Dipinjam tanpa catat",
    "Lainnya",
];

function AdjustForm({
    workerId, worker, warehouses, flat, apiBase, onSuccess,
}: {
    workerId: number;
    worker: PublicWorker | null;
    warehouses: PublicWarehouse[];
    flat: FlatVariant[];
    apiBase: string;
    onSuccess: () => void;
}) {
    const [picked, setPicked] = useState<FlatVariant | null>(null);
    const [newStock, setNewStock] = useState<number>(0);
    const [warehouseId, setWarehouseId] = useState<number | null>(warehouses[0]?.id ?? null);
    const [reasonType, setReasonType] = useState<string>(ADJUST_REASONS[0]);
    const [reasonNote, setReasonNote] = useState("");
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (picked) setNewStock(picked.stock);
    }, [picked]);

    const diff = picked ? newStock - picked.stock : 0;

    const mut = useMutation({
        mutationFn: async () => {
            if (!picked) throw new Error("Pilih item dulu");
            if (newStock < 0) throw new Error("Stok baru tidak boleh negatif");
            if (diff === 0) throw new Error("Stok sama, tidak perlu adjust");
            const finalReason = reasonNote.trim()
                ? `${reasonType}: ${reasonNote.trim()}`
                : reasonType;
            const fd = new FormData();
            fd.append("workerId", String(workerId));
            fd.append("productVariantId", String(picked.variantId));
            if (warehouseId) fd.append("warehouseId", String(warehouseId));
            fd.append("newStock", String(newStock));
            fd.append("reason", finalReason);
            if (photo) fd.append("photo", photo);
            return adjustStockPublicGudang(fd);
        },
        onSuccess: (res) => {
            setSuccess(`✏️ Stok "${res.variant.productName}" diubah dari ${res.variant.stockBefore} → ${res.variant.stockAfter} (${res.variant.diff > 0 ? "+" : ""}${res.variant.diff})`);
            setPicked(null);
            setNewStock(0);
            setReasonNote("");
            setPhoto(null);
            setPhotoPreview(null);
            onSuccess();
            setTimeout(() => setSuccess(null), 6000);
        },
    });

    return (
        <div className="space-y-3">
            <div className="rounded-lg border-2 border-amber-200 bg-amber-50/40 p-3">
                <h2 className="text-sm font-bold text-amber-900 inline-flex items-center gap-1.5">
                    <Edit3 className="h-4 w-4" /> Edit Stok (Adjust ke Jumlah Riil)
                </h2>
                <p className="text-[11px] text-amber-700 mt-0.5">
                    Untuk koreksi setelah cek fisik. Set stok ke <b>jumlah pasti</b> yang ada di gudang. Reason wajib diisi.
                </p>
            </div>

            <div className="bg-background border rounded-lg p-3 space-y-2">
                <label className="text-xs font-semibold block">1. Pilih Barang</label>
                {picked ? (
                    <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200">
                        {picked.imageUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={`${apiBase}${picked.imageUrl}`} alt="" className="w-12 h-12 rounded object-cover" />
                        ) : (
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">{picked.productName}</div>
                            <div className="text-[10px] text-muted-foreground">
                                {picked.sku} · Sistem catat: <b>{picked.stock}</b> {picked.unitName ?? "unit"}
                                {picked.warehouseName && (
                                    <span className="ml-1 inline-flex items-center gap-0.5 px-1 py-0 rounded bg-blue-100 text-blue-800 text-[9px] font-semibold">
                                        📍 {picked.warehouseName}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button onClick={() => setPicked(null)} className="p-1 hover:bg-red-100 rounded text-red-600"><X className="h-4 w-4" /></button>
                    </div>
                ) : (
                    <VariantPicker flat={flat} onPick={setPicked} selectedId={null} apiBase={apiBase} />
                )}
            </div>

            {picked && (
                <>
                    <div className="bg-background border rounded-lg p-3 space-y-2">
                        <label className="text-xs font-semibold block">2. Stok Riil Setelah Cek Fisik</label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setNewStock((s) => Math.max(0, s - 1))}
                                className="h-12 w-12 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 inline-flex items-center justify-center"
                            >
                                <Minus className="h-5 w-5" />
                            </button>
                            <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                value={newStock}
                                onChange={(e) => setNewStock(Math.max(0, Number(e.target.value) || 0))}
                                className="flex-1 h-12 text-center text-2xl font-bold border-2 border-amber-300 rounded-lg"
                            />
                            <button
                                type="button"
                                onClick={() => setNewStock((s) => s + 1)}
                                className="h-12 w-12 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 inline-flex items-center justify-center"
                            >
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>
                        <div className={`text-center text-sm font-bold p-2 rounded ${diff === 0 ? "bg-slate-100 text-slate-600" : diff > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {diff === 0 ? "Sama (tidak ada perubahan)" : `Selisih: ${diff > 0 ? "+" : ""}${diff} ${picked.unitName ?? "unit"}`}
                        </div>
                    </div>

                    <div className="bg-background border rounded-lg p-3 space-y-2.5">
                        <div>
                            <label className="text-xs font-semibold block mb-1">3. Alasan Selisih <span className="text-red-500">*</span></label>
                            <select
                                value={reasonType}
                                onChange={(e) => setReasonType(e.target.value)}
                                className="w-full border rounded px-2 py-2 text-sm"
                            >
                                {ADJUST_REASONS.map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold block mb-1">Catatan Detail (opsional)</label>
                            <input
                                value={reasonNote}
                                onChange={(e) => setReasonNote(e.target.value)}
                                placeholder="Mis. Pecah saat bongkar truk pulang event"
                                className="w-full border rounded px-2 py-2 text-sm"
                                maxLength={200}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold block mb-1">Gudang (opsional)</label>
                            <select
                                value={warehouseId ?? ""}
                                onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : null)}
                                className="w-full border rounded px-2 py-2 text-sm"
                            >
                                <option value="">— Tidak spesifik —</option>
                                {warehouses.map((w) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                        <PhotoCapture
                            photo={photo}
                            preview={photoPreview}
                            onCapture={(file, preview) => { setPhoto(file); setPhotoPreview(preview); }}
                            onClear={() => { setPhoto(null); setPhotoPreview(null); }}
                            showCamera={showCamera}
                            setShowCamera={setShowCamera}
                            label="Foto bukti / kondisi barang (opsional)"
                        />
                    </div>

                    <button
                        type="button"
                        disabled={mut.isPending || !picked || diff === 0}
                        onClick={() => {
                            const confirmText = `Adjust stok "${picked.productName}":\n${picked.stock} → ${newStock} (${diff > 0 ? "+" : ""}${diff})\n\nReason: ${reasonType}${reasonNote ? `: ${reasonNote}` : ""}\n\nLanjut?`;
                            if (window.confirm(confirmText)) mut.mutate();
                        }}
                        className="w-full bg-amber-600 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-amber-700 disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow"
                    >
                        {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        ✏️ Konfirmasi Adjust ({diff > 0 ? "+" : ""}{diff})
                    </button>

                    {mut.isError && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                            {(mut.error as any)?.response?.data?.message || (mut.error as Error).message}
                        </div>
                    )}
                </>
            )}

            {success && (
                <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    {success}
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// MODE 3: NEW ITEM FORM
// ════════════════════════════════════════════════════════════════════════════

interface VariantRow {
    _key: string;
    variantName: string;
    initialStock: number;
    description: string;       // Keterangan / spesifikasi varian
    notes: string;             // Catatan internal
    photo: File | null;        // Foto khusus varian (override foto utama)
    photoPreview: string | null;
    showDetail: boolean;       // Toggle expand detail (foto/desc/notes) per row
}

function NewItemForm({
    workerId, worker, warehouses, categories, units, onSuccess,
}: {
    workerId: number;
    worker: PublicWorker | null;
    warehouses: PublicWarehouse[];
    categories: { id: number; name: string }[];
    units: { id: number; name: string }[];
    onSuccess: () => void;
}) {
    const [name, setName] = useState("");
    const [categoryId, setCategoryId] = useState<number | null>(categories[0]?.id ?? null);
    const [unitId, setUnitId] = useState<number | null>(units[0]?.id ?? null);
    const [warehouseId, setWarehouseId] = useState<number | null>(warehouses[0]?.id ?? null);

    // Multi-varian: minimal 1 row. Default 1 varian "Default".
    const [hasMultiVariant, setHasMultiVariant] = useState(false);
    const [variants, setVariants] = useState<VariantRow[]>([
        {
            _key: `v-${Date.now()}`, variantName: "", initialStock: 1,
            description: "", notes: "", photo: null, photoPreview: null, showDetail: false,
        },
    ]);

    const [notes, setNotes] = useState("");
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);

    function addVariantRow() {
        setVariants((vs) => [
            ...vs,
            {
                _key: `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                variantName: "", initialStock: 1,
                description: "", notes: "", photo: null, photoPreview: null, showDetail: false,
            },
        ]);
    }
    function removeVariantRow(key: string) {
        setVariants((vs) => (vs.length > 1 ? vs.filter((v) => v._key !== key) : vs));
    }
    function updateVariantRow(key: string, patch: Partial<VariantRow>) {
        setVariants((vs) => vs.map((v) => (v._key === key ? { ...v, ...patch } : v)));
    }

    function resetForm() {
        setName("");
        setNotes("");
        setHasMultiVariant(false);
        setVariants([{
            _key: `v-${Date.now()}`, variantName: "", initialStock: 1,
            description: "", notes: "", photo: null, photoPreview: null, showDetail: false,
        }]);
        setPhoto(null);
        setPhotoPreview(null);
    }

    const mut = useMutation({
        mutationFn: async () => {
            if (!name.trim()) throw new Error("Nama barang wajib diisi");
            if (!categoryId) throw new Error("Kategori wajib dipilih");
            if (!unitId) throw new Error("Satuan wajib dipilih");

            // Build variants payload (data fields only — photos di-attach terpisah ke FormData)
            const cleanVariants = variants.map((v, idx) => ({
                variantName: v.variantName.trim() || (hasMultiVariant ? `Varian ${idx + 1}` : "Default"),
                initialStock: Math.max(0, Math.round(v.initialStock || 0)),
                description: v.description.trim() || null,
                notes: v.notes.trim() || null,
            }));

            // Cek duplikat varian (kalau multi)
            if (hasMultiVariant) {
                const seen = new Set<string>();
                for (const v of cleanVariants) {
                    const k = v.variantName.toLowerCase();
                    if (seen.has(k)) throw new Error(`Nama varian "${v.variantName}" duplikat. Pakai nama unik.`);
                    seen.add(k);
                }
            }

            const fd = new FormData();
            fd.append("workerId", String(workerId));
            fd.append("name", name.trim());
            fd.append("categoryId", String(categoryId));
            fd.append("unitId", String(unitId));
            fd.append("variants", JSON.stringify(cleanVariants));
            if (warehouseId) fd.append("warehouseId", String(warehouseId));
            if (notes.trim()) fd.append("notes", notes.trim());
            if (photo) fd.append("photo", photo);
            // Per-variant photos: attach by index (variantPhoto_0, variantPhoto_1, dst.)
            variants.forEach((v, idx) => {
                if (v.photo) fd.append(`variantPhoto_${idx}`, v.photo);
            });
            return createNewItemPublicGudang(fd);
        },
        onSuccess: (res) => {
            const totalStock = res.variants.reduce((s, v) => s + v.stock, 0);
            const variantSummary = res.variants.length > 1
                ? `${res.variants.length} varian (${res.variants.map((v) => v.variantName ?? "—").join(", ")})`
                : `1 varian (${res.variants[0]?.variantName ?? "Default"})`;
            setSuccess(`📦 "${res.product.name}" berhasil ditambahkan — ${variantSummary}, total stok ${totalStock}`);
            resetForm();
            onSuccess();
            setTimeout(() => setSuccess(null), 8000);
        },
    });

    const totalAllStock = variants.reduce((s, v) => s + (v.initialStock || 0), 0);
    const canSubmit = !!name.trim() && !!categoryId && !!unitId &&
        (!hasMultiVariant || variants.every((v) => v.variantName.trim().length > 0));

    return (
        <div className="space-y-3">
            <div className="rounded-lg border-2 border-violet-200 bg-violet-50/40 p-3">
                <h2 className="text-sm font-bold text-violet-900 inline-flex items-center gap-1.5">
                    <PackagePlus className="h-4 w-4" /> Tambah Barang Baru ke Sistem
                </h2>
                <p className="text-[11px] text-violet-700 mt-0.5">
                    Untuk barang yang belum pernah ada di sistem (misal: Kursi Tiffany model baru). SKU auto-generate.
                </p>
            </div>

            <div className="bg-background border rounded-lg p-3 space-y-2.5">
                <div>
                    <label className="text-xs font-semibold block mb-1">Nama Barang <span className="text-red-500">*</span></label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Mis. Kursi Tiffany, TV LED, Meja Lipat"
                        className="w-full border-2 rounded-lg px-3 py-2.5 text-sm"
                        maxLength={200}
                        autoFocus
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs font-semibold block mb-1">Kategori <span className="text-red-500">*</span></label>
                        <select
                            value={categoryId ?? ""}
                            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full border rounded px-2 py-2 text-sm"
                        >
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-semibold block mb-1">Satuan <span className="text-red-500">*</span></label>
                        <select
                            value={unitId ?? ""}
                            onChange={(e) => setUnitId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full border rounded px-2 py-2 text-sm"
                        >
                            {units.map((u) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Toggle multi-varian */}
                <div className="rounded-lg border-2 border-violet-200 bg-violet-50/30 p-2.5">
                    <label className="flex items-start gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={hasMultiVariant}
                            onChange={(e) => {
                                setHasMultiVariant(e.target.checked);
                                if (!e.target.checked) {
                                    // Reset ke 1 varian saat off (preserve stok existing)
                                    setVariants([{
                                        _key: `v-${Date.now()}`, variantName: "",
                                        initialStock: variants[0]?.initialStock ?? 1,
                                        description: variants[0]?.description ?? "",
                                        notes: variants[0]?.notes ?? "",
                                        photo: variants[0]?.photo ?? null,
                                        photoPreview: variants[0]?.photoPreview ?? null,
                                        showDetail: false,
                                    }]);
                                }
                                // Saat checkbox on dari off → tetap pakai varian existing apa adanya
                            }}
                            className="mt-0.5 h-4 w-4 accent-violet-600"
                        />
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold">Ada varian/ukuran/warna?</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                                Centang kalau barang punya beberapa varian (mis. warna Putih/Merah, ukuran 32"/43"). Bisa daftar semua sekaligus.
                            </div>
                        </div>
                    </label>
                </div>

                {/* Varian rows */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold inline-flex items-center gap-1.5">
                            {hasMultiVariant ? "🎨 Varian-varian" : "Stok Awal"}
                            {hasMultiVariant && (
                                <span className="text-[10px] font-normal text-violet-700">
                                    ({variants.length} varian, total {totalAllStock} stok)
                                </span>
                            )}
                        </label>
                        {hasMultiVariant && (
                            <button
                                type="button"
                                onClick={addVariantRow}
                                className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded bg-violet-100 hover:bg-violet-200 text-violet-700 font-semibold"
                            >
                                <Plus className="h-3 w-3" /> Tambah Varian
                            </button>
                        )}
                    </div>

                    <div className="space-y-2">
                        {variants.map((v, idx) => (
                            <div
                                key={v._key}
                                className={`border-2 rounded-lg p-2 ${hasMultiVariant ? "border-violet-200 bg-violet-50/30" : "border-violet-100 bg-background"}`}
                            >
                                {hasMultiVariant && (
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] font-bold text-violet-700">Varian #{idx + 1}</span>
                                        {variants.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeVariantRow(v._key)}
                                                className="p-0.5 hover:bg-red-100 text-red-600 rounded"
                                                title="Hapus varian ini"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {hasMultiVariant && (
                                    <input
                                        value={v.variantName}
                                        onChange={(e) => updateVariantRow(v._key, { variantName: e.target.value })}
                                        placeholder="Nama varian (Putih, 32 inch, Merah, dll)"
                                        className="w-full border-2 rounded-lg px-2 py-1.5 text-sm mb-1.5"
                                        maxLength={100}
                                    />
                                )}

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => updateVariantRow(v._key, { initialStock: Math.max(0, v.initialStock - 1) })}
                                        className="h-10 w-10 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-700 inline-flex items-center justify-center shrink-0"
                                    >
                                        <Minus className="h-4 w-4" />
                                    </button>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        value={v.initialStock}
                                        onChange={(e) => updateVariantRow(v._key, { initialStock: Math.max(0, Number(e.target.value) || 0) })}
                                        className="flex-1 h-10 text-center text-lg font-bold border-2 border-violet-300 rounded-lg"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => updateVariantRow(v._key, { initialStock: v.initialStock + 1 })}
                                        className="h-10 w-10 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-700 inline-flex items-center justify-center shrink-0"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </button>
                                    {hasMultiVariant && (
                                        <div className="grid grid-cols-2 gap-1 shrink-0">
                                            {[5, 10].map((n) => (
                                                <button
                                                    key={n}
                                                    type="button"
                                                    onClick={() => updateVariantRow(v._key, { initialStock: v.initialStock + n })}
                                                    className="text-[10px] py-1 px-1.5 rounded border bg-violet-50 text-violet-700 hover:bg-violet-100"
                                                >
                                                    +{n}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Toggle detail: foto, keterangan, catatan per varian */}
                                <button
                                    type="button"
                                    onClick={() => updateVariantRow(v._key, { showDetail: !v.showDetail })}
                                    className="mt-1.5 w-full text-[10px] font-medium text-violet-700 hover:bg-violet-100 rounded px-2 py-1 inline-flex items-center justify-center gap-1 transition"
                                >
                                    {v.showDetail ? "▲ Tutup detail" : "▼ Detail varian"}
                                    {(v.photo || v.description || v.notes) && (
                                        <span className="ml-1 px-1 py-0 rounded-full bg-violet-200 text-violet-900 text-[9px]">
                                            {[v.photo && "📷", v.description && "📝", v.notes && "💬"].filter(Boolean).join(" ")}
                                        </span>
                                    )}
                                </button>

                                {v.showDetail && (
                                    <div className="mt-1.5 pt-1.5 border-t border-violet-200 space-y-1.5">
                                        {/* Foto khusus varian */}
                                        <div>
                                            <label className="text-[10px] font-semibold block mb-1 inline-flex items-center gap-1">
                                                <Camera className="h-3 w-3" /> Foto Varian Khusus
                                                <span className="text-[9px] font-normal text-muted-foreground">(opsional, override foto utama)</span>
                                            </label>
                                            <VariantPhotoCapture
                                                photo={v.photo}
                                                preview={v.photoPreview}
                                                onCapture={(file, preview) => updateVariantRow(v._key, { photo: file, photoPreview: preview })}
                                                onClear={() => updateVariantRow(v._key, { photo: null, photoPreview: null })}
                                            />
                                        </div>
                                        {/* Keterangan */}
                                        <div>
                                            <label className="text-[10px] font-semibold block mb-0.5">
                                                Keterangan / Spesifikasi <span className="text-[9px] font-normal text-muted-foreground">(opsional)</span>
                                            </label>
                                            <textarea
                                                value={v.description}
                                                onChange={(e) => updateVariantRow(v._key, { description: e.target.value })}
                                                placeholder="Mis. Bahan kayu jati, ukuran 60x60cm, warna doff"
                                                className="w-full border rounded px-2 py-1.5 text-xs resize-y min-h-[44px]"
                                                maxLength={1000}
                                            />
                                        </div>
                                        {/* Catatan */}
                                        <div>
                                            <label className="text-[10px] font-semibold block mb-0.5">
                                                Catatan Internal <span className="text-[9px] font-normal text-muted-foreground">(opsional, tidak terlihat klien)</span>
                                            </label>
                                            <textarea
                                                value={v.notes}
                                                onChange={(e) => updateVariantRow(v._key, { notes: e.target.value })}
                                                placeholder="Mis. Hanya untuk event premium, ada cacat kecil di kaki"
                                                className="w-full border rounded px-2 py-1.5 text-xs resize-y min-h-[36px]"
                                                maxLength={1000}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {hasMultiVariant && (
                        <button
                            type="button"
                            onClick={addVariantRow}
                            className="w-full mt-2 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 border-dashed border-violet-300 text-violet-700 text-xs font-semibold hover:bg-violet-50"
                        >
                            <Plus className="h-3.5 w-3.5" /> Tambah Varian Lain
                        </button>
                    )}
                </div>

                <div>
                    <label className="text-xs font-semibold block mb-1">Gudang (opsional)</label>
                    <select
                        value={warehouseId ?? ""}
                        onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : null)}
                        className="w-full border rounded px-2 py-2 text-sm"
                    >
                        <option value="">— Tidak spesifik —</option>
                        {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-xs font-semibold block mb-1">Catatan (opsional)</label>
                    <input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Mis. Pinjam dari Pak Joni, dari supplier baru"
                        className="w-full border rounded px-2 py-2 text-sm"
                        maxLength={200}
                    />
                </div>

                <PhotoCapture
                    photo={photo}
                    preview={photoPreview}
                    onCapture={(file, preview) => { setPhoto(file); setPhotoPreview(preview); }}
                    onClear={() => { setPhoto(null); setPhotoPreview(null); }}
                    showCamera={showCamera}
                    setShowCamera={setShowCamera}
                    label="Foto barang (recommended)"
                />
            </div>

            <button
                type="button"
                disabled={mut.isPending || !canSubmit}
                onClick={() => mut.mutate()}
                className="w-full bg-violet-600 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-violet-700 disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow"
            >
                {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                📦 Tambah "{name || "barang baru"}" {hasMultiVariant ? `(${variants.length} varian)` : ""} oleh {worker?.name ?? "—"}
            </button>

            {mut.isError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                    {(mut.error as any)?.response?.data?.message || (mut.error as Error).message}
                </div>
            )}

            {success && (
                <div className="rounded-lg border-2 border-violet-300 bg-violet-50 p-3 text-sm text-violet-900">
                    {success}
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// PHOTO CAPTURE (shared by all 3 modes)
// ════════════════════════════════════════════════════════════════════════════

function PhotoCapture({
    photo, preview, onCapture, onClear, showCamera, setShowCamera, label,
}: {
    photo: File | null;
    preview: string | null;
    onCapture: (file: File, preview: string) => void;
    onClear: () => void;
    showCamera: boolean;
    setShowCamera: (show: boolean) => void;
    label: string;
}) {
    return (
        <div>
            <label className="text-xs font-semibold block mb-1">{label}</label>
            {photo && preview ? (
                <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Preview" className="w-32 h-32 rounded-lg object-cover border-2" />
                    <button
                        type="button"
                        onClick={onClear}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    className="w-full inline-flex items-center justify-center gap-2 border-2 border-dashed rounded-lg py-4 text-sm hover:bg-muted/50 transition"
                >
                    <Camera className="h-5 w-5" />
                    Ambil Foto
                </button>
            )}
            {showCamera && (
                <CameraCaptureModal
                    title="Foto Bukti"
                    onCancel={() => setShowCamera(false)}
                    onConfirm={(blob) => {
                        const file = new File([blob], `stockphoto-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });
                        const reader = new FileReader();
                        reader.onload = () => {
                            onCapture(file, reader.result as string);
                        };
                        reader.readAsDataURL(file);
                        setShowCamera(false);
                    }}
                />
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// WELCOME MODAL — tampil saat tukang baru masuk, tanya sudah/belum daftar
// ════════════════════════════════════════════════════════════════════════════

function WelcomeModal({
    workers,
    onPickExisting,
    onWantRegister,
    onClose,
}: {
    workers: PublicWorker[];
    onPickExisting: (workerId: number) => void;
    onWantRegister: () => void;
    onClose: () => void;
}) {
    const [showPicker, setShowPicker] = useState(false);
    const [q, setQ] = useState("");

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return workers;
        return workers.filter((w) =>
            `${w.name} ${w.fullName ?? ""} ${w.phone ?? ""} ${w.position ?? ""}`.toLowerCase().includes(s)
        );
    }, [workers, q]);

    if (showPicker) {
        return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
                <div className="bg-background rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
                    <div className="p-4 border-b flex items-center justify-between gap-2">
                        <h2 className="text-base font-bold inline-flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-primary" /> Pilih Nama Anda
                        </h2>
                        <button onClick={() => setShowPicker(false)} className="p-1 hover:bg-muted rounded">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="p-4 border-b">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="search"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Cari nama / panggilan / HP…"
                                autoFocus
                                className="w-full pl-9 pr-3 py-2.5 border-2 rounded-lg text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="p-6 text-center text-sm text-muted-foreground">
                                {workers.length === 0
                                    ? "Belum ada karyawan terdaftar. Klik daftar di bawah."
                                    : `Tidak ada yang cocok dengan "${q}"`}
                            </div>
                        ) : (
                            <ul className="divide-y">
                                {filtered.map((w) => (
                                    <li key={w.id}>
                                        <button
                                            onClick={() => onPickExisting(w.id)}
                                            className="w-full text-left p-3 hover:bg-primary/5 flex items-center gap-3"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                                                {w.photoUrl ? (
                                                    /* eslint-disable-next-line @next/next/no-img-element */
                                                    <img
                                                        src={`${process.env.NEXT_PUBLIC_API_URL || ""}${w.photoUrl}`}
                                                        alt={w.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <User className="h-5 w-5 text-primary" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-sm">{w.name}</div>
                                                <div className="text-[11px] text-muted-foreground truncate">
                                                    {w.fullName && w.fullName !== w.name ? `${w.fullName} · ` : ""}
                                                    {w.position ?? "—"}
                                                    {w.phone ? ` · ${w.phone}` : ""}
                                                </div>
                                            </div>
                                            <Check className="h-4 w-4 text-primary opacity-0" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="p-3 border-t bg-muted/20">
                        <button
                            onClick={() => { setShowPicker(false); onWantRegister(); }}
                            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 text-primary text-sm font-semibold hover:bg-primary/10"
                        >
                            <UserPlus className="h-4 w-4" />
                            Tidak ada nama saya — daftar baru
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-primary/30 via-background to-background p-4">
            <div className="bg-background border-2 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
                <div className="text-center">
                    <div className="inline-flex rounded-full bg-primary/10 p-3 mb-3">
                        <UserCheck className="h-8 w-8 text-primary" />
                    </div>
                    <h1 className="text-xl font-bold">Selamat Datang!</h1>
                    <p className="text-sm text-muted-foreground mt-1.5">
                        Apakah Anda <b>sudah terdaftar</b> sebagai karyawan di sistem ini?
                    </p>
                </div>

                <div className="space-y-2.5">
                    <button
                        onClick={() => setShowPicker(true)}
                        className="w-full inline-flex items-center justify-center gap-3 py-4 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition active:scale-[0.98]"
                    >
                        <UserCheck className="h-5 w-5" />
                        <div className="text-left">
                            <div className="text-sm font-bold">✅ Sudah Terdaftar</div>
                            <div className="text-[11px] opacity-90">Pilih nama saya dari daftar</div>
                        </div>
                    </button>

                    <button
                        onClick={onWantRegister}
                        className="w-full inline-flex items-center justify-center gap-3 py-4 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-md transition active:scale-[0.98]"
                    >
                        <UserPlus className="h-5 w-5" />
                        <div className="text-left">
                            <div className="text-sm font-bold">➕ Belum, Daftar Dulu</div>
                            <div className="text-[11px] opacity-90">Isi data diri saya (1 menit)</div>
                        </div>
                    </button>
                </div>

                <div className="pt-3 border-t text-[11px] text-muted-foreground text-center">
                    💡 Pendaftaran wajib supaya setiap perubahan stok tercatat siapa yang melakukan (audit log).
                </div>

                <button
                    onClick={onClose}
                    className="w-full text-xs text-muted-foreground hover:text-foreground underline pt-1"
                >
                    Batal, kembali
                </button>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// REGISTER WORKER MODAL — form pendaftaran lengkap
// ════════════════════════════════════════════════════════════════════════════

const POSITIONS_LIST = [
    { value: "TUKANG", label: "🪚 Tukang / Crew" },
    { value: "KEPALA_TIM", label: "👷 Kepala Tim" },
    { value: "PRODUKSI", label: "🔨 Produksi" },
    { value: "OPERATOR", label: "⚙️ Operator" },
    { value: "ADMIN", label: "🗂️ Admin" },
    { value: "MARKETING", label: "📣 Marketing" },
    { value: "SALES", label: "💼 Sales" },
    { value: "DESAINER", label: "🎨 Desainer" },
];

function RegisterWorkerModal({
    onClose,
    onRegistered,
}: {
    onClose: () => void;
    onRegistered: (worker: PublicWorker) => void;
}) {
    const [fullName, setFullName] = useState("");
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [position, setPosition] = useState("TUKANG");
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [showCamera, setShowCamera] = useState(false);

    const mut = useMutation({
        mutationFn: async () => {
            const trimmedFull = fullName.trim();
            const trimmedNick = name.trim();
            if (!trimmedFull) throw new Error("Nama lengkap wajib diisi");
            if (!trimmedNick) throw new Error("Nama panggilan wajib diisi");
            const fd = new FormData();
            fd.append("name", trimmedNick);
            fd.append("fullName", trimmedFull);
            if (phone.trim()) fd.append("phone", phone.trim());
            if (position) fd.append("position", position);
            if (photo) fd.append("photo", photo);
            return registerPublicWorker(fd);
        },
        onSuccess: (worker) => {
            onRegistered(worker);
        },
    });

    const canSubmit = fullName.trim().length > 0 && name.trim().length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
            <div className="bg-background rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[95vh] overflow-y-auto">
                <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-background z-10">
                    <h2 className="text-base font-bold inline-flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-violet-600" /> Daftar Karyawan Baru
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-4 space-y-3.5">
                    {/* Foto wajah */}
                    <div>
                        <label className="text-xs font-semibold block mb-1.5 inline-flex items-center gap-1.5">
                            <Camera className="h-3.5 w-3.5" /> Foto Wajah
                            <span className="text-[10px] font-normal text-muted-foreground">(opsional tapi disarankan)</span>
                        </label>
                        <div className="flex items-center gap-3">
                            {photo && photoPreview ? (
                                <div className="relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={photoPreview} alt="Foto" className="w-20 h-20 rounded-full object-cover border-2 border-violet-300" />
                                    <button
                                        type="button"
                                        onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ) : (
                                <div className="w-20 h-20 rounded-full bg-muted border-2 border-dashed flex items-center justify-center">
                                    <User className="h-8 w-8 text-muted-foreground" />
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowCamera(true)}
                                className="flex-1 inline-flex items-center justify-center gap-2 border-2 border-dashed border-violet-300 rounded-lg py-3 text-sm text-violet-700 hover:bg-violet-50"
                            >
                                <Camera className="h-4 w-4" />
                                {photo ? "Ganti Foto" : "Ambil Foto"}
                            </button>
                        </div>
                    </div>

                    {/* Nama lengkap */}
                    <div>
                        <label className="text-xs font-semibold block mb-1">
                            Nama Lengkap <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Mis. Sutejo Budiman"
                                className="w-full pl-9 pr-3 py-2.5 border-2 rounded-lg text-sm"
                                maxLength={150}
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Nama panggilan */}
                    <div>
                        <label className="text-xs font-semibold block mb-1">
                            Nama Panggilan <span className="text-red-500">*</span>
                            <span className="text-[10px] font-normal text-muted-foreground ml-1">(yang dipakai sehari-hari)</span>
                        </label>
                        <div className="relative">
                            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Mis. Budi"
                                className="w-full pl-9 pr-3 py-2.5 border-2 rounded-lg text-sm"
                                maxLength={100}
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            ⚠️ Harus unik. Kalau "Budi" sudah dipakai orang lain, coba "Budi 2" atau "Budi T".
                        </p>
                    </div>

                    {/* Nomor HP */}
                    <div>
                        <label className="text-xs font-semibold block mb-1">
                            Nomor HP <span className="text-[10px] font-normal text-muted-foreground">(opsional)</span>
                        </label>
                        <div className="relative">
                            <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="tel"
                                inputMode="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="08xxxxxxxxxx"
                                className="w-full pl-9 pr-3 py-2.5 border-2 rounded-lg text-sm"
                                maxLength={50}
                            />
                        </div>
                    </div>

                    {/* Jabatan */}
                    <div>
                        <label className="text-xs font-semibold block mb-1 inline-flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5" /> Jabatan
                        </label>
                        <select
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                            className="w-full border-2 rounded-lg px-3 py-2.5 text-sm bg-background"
                        >
                            {POSITIONS_LIST.map((p) => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                        </select>
                    </div>

                    {mut.isError && (
                        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2.5">
                            ❌ {(mut.error as any)?.response?.data?.message || (mut.error as Error).message}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-muted/20 sticky bottom-0">
                    <button
                        type="button"
                        disabled={!canSubmit || mut.isPending}
                        onClick={() => mut.mutate()}
                        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm disabled:opacity-50 shadow"
                    >
                        {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                        {mut.isPending ? "Mendaftarkan…" : "✅ Daftar Sekarang"}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={mut.isPending}
                        className="w-full text-xs text-muted-foreground hover:text-foreground underline pt-2"
                    >
                        Batal
                    </button>
                </div>

                {showCamera && (
                    <CameraCaptureModal
                        title="Foto Wajah"
                        onCancel={() => setShowCamera(false)}
                        onConfirm={(blob) => {
                            const file = new File([blob], `worker-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });
                            const reader = new FileReader();
                            reader.onload = () => {
                                setPhoto(file);
                                setPhotoPreview(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                            setShowCamera(false);
                        }}
                    />
                )}
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// VARIANT PHOTO CAPTURE — compact mini version untuk per-variant row
// ════════════════════════════════════════════════════════════════════════════

function VariantPhotoCapture({
    photo, preview, onCapture, onClear,
}: {
    photo: File | null;
    preview: string | null;
    onCapture: (file: File, preview: string) => void;
    onClear: () => void;
}) {
    const [showCamera, setShowCamera] = useState(false);
    return (
        <div>
            {photo && preview ? (
                <div className="flex items-center gap-2">
                    <div className="relative shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview} alt="Foto varian" className="w-16 h-16 rounded-lg object-cover border-2 border-violet-200" />
                        <button
                            type="button"
                            onClick={onClear}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow"
                        >
                            <X className="h-2.5 w-2.5" />
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowCamera(true)}
                        className="text-[10px] px-2 py-1 rounded border bg-violet-50 text-violet-700 hover:bg-violet-100"
                    >
                        Ganti
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    className="w-full inline-flex items-center justify-center gap-1.5 border border-dashed border-violet-300 rounded py-2 text-[11px] text-violet-700 hover:bg-violet-50"
                >
                    <Camera className="h-3.5 w-3.5" />
                    Ambil Foto Varian
                </button>
            )}
            {showCamera && (
                <CameraCaptureModal
                    title="Foto Varian"
                    onCancel={() => setShowCamera(false)}
                    onConfirm={(blob) => {
                        const file = new File([blob], `variant-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });
                        const reader = new FileReader();
                        reader.onload = () => {
                            onCapture(file, reader.result as string);
                        };
                        reader.readAsDataURL(file);
                        setShowCamera(false);
                    }}
                />
            )}
        </div>
    );
}


