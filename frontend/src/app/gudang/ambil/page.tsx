"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Search, Trash2, Plus, Minus, Camera, Package, AlertTriangle,
    Loader2, ShoppingCart, Warehouse as WarehouseIcon, User, KeyRound, CheckCircle2, LogOut,
    RotateCcw, ShoppingBag, ChevronDown, ChevronUp, Calendar,
} from "lucide-react";
import {
    bootstrapPublicGudang, checkoutPublicGudang, savePin, clearPin, readPin,
    getPublicActiveBorrows, returnPublicWithdrawal,
    type Bootstrap, type PublicActiveBorrow,
} from "@/lib/api/publicGudang";
import { verifyWarehousePin, getWarehousePinStatus } from "@/lib/api/warehousePin";
import { CameraCaptureModal } from "@/components/CameraCaptureModal";

type WithdrawalType = "BORROW" | "USE";

interface CartItem {
    variantId: number;
    productName: string;
    variantName: string | null;
    sku: string;
    qty: number;
    available: number;
    imageUrl: string | null;
    notes?: string;
}

interface VariantRow {
    variantId: number;
    productName: string;
    variantName: string | null;
    sku: string;
    stock: number;
    imageUrl: string | null;
}

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
                    <h1 className="text-lg font-bold">Kiosk Ambil Gudang</h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Masukkan PIN untuk membuka halaman pengambilan barang.
                    </p>
                </div>

                {status?.isSet === false && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                        PIN belum diatur oleh admin. Minta admin mengatur PIN di <b>Pengaturan → PIN Gudang Kiosk</b>.
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
                    href="/"
                    className="w-full border rounded py-2 text-sm text-red-600 hover:bg-red-50 border-red-200 flex items-center justify-center gap-2"
                >
                    <LogOut className="h-4 w-4" /> Keluar
                </a>
            </form>
        </div>
    );
}

export default function GudangAmbilPage() {
    const qc = useQueryClient();
    const [unlocked, setUnlocked] = useState(false);

    // Cek sessionStorage saat mount — kalau ada PIN tersimpan, langsung unlock
    useEffect(() => {
        if (readPin()) setUnlocked(true);
    }, []);

    if (!unlocked) {
        return <PinGate onUnlock={() => setUnlocked(true)} />;
    }

    return <KioskContent onLock={() => { clearPin(); setUnlocked(false); qc.clear(); }} />;
}

function KioskContent({ onLock }: { onLock: () => void }) {
    const [mode, setMode] = useState<"ambil" | "kembali">("ambil");

    const { data, isLoading, error: bootErr } = useQuery<Bootstrap>({
        queryKey: ["public-gudang-bootstrap"],
        queryFn: bootstrapPublicGudang,
        retry: false,
    });

    useEffect(() => {
        const e = bootErr as any;
        if (e?.response?.status === 401) onLock();
    }, [bootErr, onLock]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat data gudang…
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-background">
            <div className="border-b bg-card flex items-center px-2 py-1.5 gap-2">
                <button onClick={onLock} className="flex items-center gap-1 border rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                    <LogOut className="h-3.5 w-3.5" /> Kunci
                </button>
                <a
                    href="/"
                    onClick={() => clearPin()}
                    className="flex items-center gap-1 border rounded px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 border-red-200"
                    title="Keluar dari mode kiosk gudang"
                >
                    <LogOut className="h-3.5 w-3.5" /> Keluar
                </a>
                <div className="flex-1 flex justify-center">
                    <div className="inline-flex border rounded-lg overflow-hidden">
                        <button
                            onClick={() => setMode("ambil")}
                            className={`px-4 py-2 text-sm font-semibold flex items-center gap-1.5 ${mode === "ambil" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                        >
                            <ShoppingBag className="h-4 w-4" /> Ambil Barang
                        </button>
                        <button
                            onClick={() => setMode("kembali")}
                            className={`px-4 py-2 text-sm font-semibold flex items-center gap-1.5 ${mode === "kembali" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                        >
                            <RotateCcw className="h-4 w-4" /> Kembalikan
                        </button>
                    </div>
                </div>
                <div className="w-[60px]" />
            </div>

            <div className="flex-1 min-h-0">
                {mode === "ambil" ? <AmbilMode bootstrap={data} /> : <KembaliMode bootstrap={data} />}
            </div>
        </div>
    );
}

function AmbilMode({ bootstrap }: { bootstrap: Bootstrap | undefined }) {
    const qc = useQueryClient();
    const [warehouseId, setWarehouseId] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [workerId, setWorkerId] = useState<number | null>(null);
    const [eventId, setEventId] = useState<number | null>(null);
    const [type, setType] = useState<WithdrawalType>("USE");
    const [purpose, setPurpose] = useState("");
    const [scheduledReturnAt, setScheduledReturnAt] = useState("");
    const [notes, setNotes] = useState("");
    const [cameraOpen, setCameraOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successCode, setSuccessCode] = useState<string | null>(null);

    const warehouses = bootstrap?.warehouses ?? [];
    const workers = bootstrap?.workers ?? [];
    const products = bootstrap?.products ?? [];
    const events = bootstrap?.events ?? [];

    const effectiveWarehouseId = warehouseId ?? warehouses[0]?.id ?? null;

    const variantRows = useMemo<VariantRow[]>(() => {
        const rows: VariantRow[] = [];
        for (const p of products) {
            for (const v of p.variants ?? []) {
                rows.push({
                    variantId: v.id,
                    productName: p.name,
                    variantName: v.variantName,
                    sku: v.sku,
                    stock: Number(v.stock ?? 0),
                    imageUrl: v.variantImageUrl || p.imageUrl || null,
                });
            }
        }
        return rows;
    }, [products]);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return variantRows;
        return variantRows.filter((r) => {
            const hay = `${r.productName} ${r.variantName ?? ""} ${r.sku}`.toLowerCase();
            return hay.includes(q);
        });
    }, [variantRows, search]);

    function addToCart(r: VariantRow) {
        if (r.stock <= 0) return;
        setCart((prev) => {
            const idx = prev.findIndex((x) => x.variantId === r.variantId);
            if (idx >= 0) {
                const next = [...prev];
                if (next[idx].qty < r.stock) next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
                return next;
            }
            return [
                ...prev,
                {
                    variantId: r.variantId,
                    productName: r.productName,
                    variantName: r.variantName,
                    sku: r.sku,
                    qty: 1,
                    available: r.stock,
                    imageUrl: r.imageUrl,
                },
            ];
        });
    }

    function updateQty(variantId: number, qty: number) {
        setCart((prev) =>
            prev.map((x) =>
                x.variantId === variantId
                    ? { ...x, qty: Math.max(0, Math.min(qty, x.available)) }
                    : x,
            ).filter((x) => x.qty > 0),
        );
    }

    function removeFromCart(variantId: number) {
        setCart((prev) => prev.filter((x) => x.variantId !== variantId));
    }

    function resetForm() {
        setCart([]);
        setWorkerId(null);
        setEventId(null);
        setPurpose("");
        setScheduledReturnAt("");
        setNotes("");
        setType("USE");
        setError(null);
    }

    const checkoutMut = useMutation({
        mutationFn: async (photo: Blob) => {
            const fd = new FormData();
            fd.append("workerId", String(workerId));
            fd.append("warehouseId", String(effectiveWarehouseId));
            if (eventId) fd.append("eventId", String(eventId));
            fd.append("type", type);
            fd.append("purpose", purpose.trim());
            if (type === "BORROW" && scheduledReturnAt) fd.append("scheduledReturnAt", scheduledReturnAt);
            if (notes.trim()) fd.append("notes", notes.trim());
            fd.append("items", JSON.stringify(cart.map((c) => ({
                productVariantId: c.variantId,
                quantity: c.qty,
                notes: c.notes,
            }))));
            fd.append("photo", photo, `checkout-${Date.now()}.jpg`);
            return checkoutPublicGudang(fd);
        },
        onSuccess: (res: any) => {
            qc.invalidateQueries({ queryKey: ["public-gudang-bootstrap"] });
            setCameraOpen(false);
            setSuccessCode(res?.code || "OK");
            resetForm();
        },
        onError: (e: any) => {
            setError(e?.response?.data?.message || "Gagal checkout");
            setCameraOpen(false);
        },
    });

    function openCamera() {
        setError(null);
        if (!workerId) { setError("Pekerja wajib dipilih"); return; }
        if (!purpose.trim()) { setError("Keperluan wajib diisi"); return; }
        if (cart.length === 0) { setError("Keranjang masih kosong"); return; }
        if (type === "BORROW" && !scheduledReturnAt) {
            setError("Tanggal rencana kembali wajib diisi untuk peminjaman");
            return;
        }
        setCameraOpen(true);
    }

    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

    if (successCode) {
        return (
            <div className="flex items-center justify-center h-full p-4">
                <div className="bg-card border rounded-2xl shadow-lg max-w-md w-full p-8 text-center space-y-4">
                    <div className="rounded-full bg-green-100 text-green-600 p-4 inline-flex">
                        <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <h2 className="text-xl font-bold">Berhasil!</h2>
                    <p className="text-sm text-muted-foreground">
                        Kode pengambilan: <span className="font-mono font-bold text-foreground">{successCode}</span>
                    </p>
                    <button
                        onClick={() => setSuccessCode(null)}
                        className="w-full bg-primary text-primary-foreground rounded py-2.5 font-semibold text-sm hover:opacity-90"
                    >
                        Ambil Lagi
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 p-4 h-full bg-background">
            <div className="flex flex-col min-h-0">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-2 ml-auto">
                        <WarehouseIcon className="h-4 w-4 text-muted-foreground" />
                        <select
                            value={effectiveWarehouseId ?? ""}
                            onChange={(e) => setWarehouseId(Number(e.target.value))}
                            className="border rounded px-2 py-1.5 text-sm"
                        >
                            {warehouses.map((w) => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari produk / varian / SKU…"
                        className="flex-1 border rounded px-3 py-2 text-sm"
                    />
                </div>

                <div className="flex-1 overflow-y-auto border rounded-lg">
                    {filteredRows.length === 0 ? (
                        <div className="p-6 text-center text-muted-foreground text-sm">
                            {variantRows.length === 0 ? "Belum ada varian produk." : "Tidak ada varian cocok."}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2">
                            {filteredRows.map((r) => {
                                const empty = r.stock <= 0;
                                return (
                                    <button
                                        key={r.variantId}
                                        onClick={() => addToCart(r)}
                                        disabled={empty}
                                        className={`text-left border rounded-lg p-2 transition ${empty ? "opacity-50 cursor-not-allowed bg-muted/30" : "hover:border-primary hover:bg-primary/5"}`}
                                    >
                                        <div className="aspect-square bg-muted/40 rounded mb-2 flex items-center justify-center overflow-hidden">
                                            {r.imageUrl ? (
                                                <img src={`${API}${r.imageUrl}`} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <Package className="h-8 w-8 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div className="text-xs font-medium line-clamp-2">{r.productName}</div>
                                        {r.variantName && (
                                            <div className="text-[11px] text-muted-foreground">{r.variantName}</div>
                                        )}
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-[10px] font-mono text-muted-foreground">{r.sku}</span>
                                            <span className={`text-xs font-bold ${empty ? "text-red-500" : "text-green-600"}`}>{r.stock}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Cart / checkout panel */}
            <div className="border rounded-lg flex flex-col min-h-0 bg-card">
                <div className="p-3 border-b flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Keranjang ({cart.length})</span>
                    {cart.length > 0 && (
                        <button onClick={() => setCart([])} className="ml-auto text-xs text-red-600 hover:underline">Kosongkan</button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto">
                    {cart.length === 0 ? (
                        <div className="p-6 text-center text-muted-foreground text-sm">
                            Klik barang di kiri untuk menambah ke keranjang.
                        </div>
                    ) : (
                        cart.map((c) => (
                            <div key={c.variantId} className="p-2 border-b flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{c.productName}</div>
                                    <div className="text-xs text-muted-foreground truncate">{c.variantName ?? "—"} · <span className="font-mono">{c.sku}</span></div>
                                    <div className="flex items-center gap-1 mt-1">
                                        <button onClick={() => updateQty(c.variantId, c.qty - 1)} className="p-0.5 hover:bg-muted rounded">
                                            <Minus className="h-3 w-3" />
                                        </button>
                                        <input
                                            type="number" value={c.qty} min={1} max={c.available}
                                            onChange={(e) => updateQty(c.variantId, Number(e.target.value))}
                                            className="w-14 border rounded px-1 py-0.5 text-xs text-center"
                                        />
                                        <button onClick={() => updateQty(c.variantId, c.qty + 1)} disabled={c.qty >= c.available} className="p-0.5 hover:bg-muted rounded disabled:opacity-30">
                                            <Plus className="h-3 w-3" />
                                        </button>
                                        <span className="text-[10px] text-muted-foreground ml-1">/ {c.available}</span>
                                    </div>
                                </div>
                                <button onClick={() => removeFromCart(c.variantId)} className="p-1 hover:bg-red-50 text-red-600 rounded">
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
                <div className="p-3 border-t space-y-2 bg-muted/30">
                    <div>
                        <label className="text-[11px] font-medium flex items-center gap-1"><User className="h-3 w-3" /> Pekerja *</label>
                        <select
                            value={workerId ?? ""}
                            onChange={(e) => setWorkerId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                        >
                            <option value="">-- Pilih Pekerja --</option>
                            {workers.map((w) => (
                                <option key={w.id} value={w.id}>{w.name}{w.position ? ` (${w.position})` : ""}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[11px] font-medium">Tipe</label>
                        <div className="grid grid-cols-2 gap-1 mt-0.5">
                            <button
                                onClick={() => setType("USE")}
                                className={`px-2 py-1.5 text-xs rounded border ${type === "USE" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
                            >
                                Pakai (stok berkurang)
                            </button>
                            <button
                                onClick={() => setType("BORROW")}
                                className={`px-2 py-1.5 text-xs rounded border ${type === "BORROW" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
                            >
                                Pinjam (kembalikan)
                            </button>
                        </div>
                    </div>
                    {events.length > 0 && (
                        <div>
                            <label className="text-[11px] font-medium">Event (opsional)</label>
                            <select
                                value={eventId ?? ""}
                                onChange={(e) => {
                                    const id = e.target.value ? Number(e.target.value) : null;
                                    setEventId(id);
                                    if (id && !purpose.trim()) {
                                        const ev = events.find((x) => x.id === id);
                                        if (ev) setPurpose(ev.name);
                                    }
                                }}
                                className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                            >
                                <option value="">— Tanpa event —</option>
                                {events.map((ev) => (
                                    <option key={ev.id} value={ev.id}>
                                        {ev.code} · {ev.name}{ev.venue ? ` (${ev.venue})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="text-[11px] font-medium">Keperluan *</label>
                        <input
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                            placeholder="Proyek/event apa…"
                            className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                        />
                    </div>
                    {type === "BORROW" && (
                        <div>
                            <label className="text-[11px] font-medium">Rencana Kembali *</label>
                            <input
                                type="datetime-local" value={scheduledReturnAt}
                                onChange={(e) => setScheduledReturnAt(e.target.value)}
                                className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                            />
                        </div>
                    )}
                    <div>
                        <label className="text-[11px] font-medium">Catatan</label>
                        <input
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="(opsional)"
                            className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                        />
                    </div>
                    {error && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 flex items-start gap-1">
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {error}
                        </div>
                    )}
                    <button
                        onClick={openCamera}
                        disabled={cart.length === 0 || checkoutMut.isPending}
                        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded font-semibold text-sm hover:opacity-90 disabled:opacity-50"
                    >
                        <Camera className="h-4 w-4" /> Checkout & Ambil Foto
                    </button>
                </div>
            </div>

            {cameraOpen && (
                <CameraCaptureModal
                    title="Foto Selfie Pekerja"
                    onCancel={() => setCameraOpen(false)}
                    onConfirm={(blob) => checkoutMut.mutate(blob)}
                    submitting={checkoutMut.isPending}
                />
            )}
        </div>
    );
}

function KembaliMode({ bootstrap }: { bootstrap: Bootstrap | undefined }) {
    const qc = useQueryClient();
    const [workerId, setWorkerId] = useState<number | null>(null);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [returnQty, setReturnQty] = useState<Record<number, string>>({});
    const [returnNotes, setReturnNotes] = useState("");
    const [cameraOpen, setCameraOpen] = useState(false);
    const [activeWithdrawalId, setActiveWithdrawalId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successCode, setSuccessCode] = useState<string | null>(null);

    const workers = bootstrap?.workers ?? [];

    const { data: borrows = [], isLoading: loadingBorrows } = useQuery<PublicActiveBorrow[]>({
        queryKey: ["public-active-borrows", workerId],
        queryFn: () => getPublicActiveBorrows(workerId ?? undefined),
        enabled: workerId !== null,
    });

    const returnMut = useMutation({
        mutationFn: async ({ id, photo }: { id: number; photo: Blob }) => {
            const w = borrows.find((b) => b.id === id);
            if (!w) throw new Error("Withdrawal tidak ditemukan");
            const items = w.items
                .map((it) => {
                    const qty = Number(returnQty[it.id] ?? 0);
                    return { withdrawalItemId: it.id, returnQuantity: qty };
                })
                .filter((x) => x.returnQuantity > 0);
            if (!items.length) throw new Error("Isi minimal 1 qty kembali");
            const fd = new FormData();
            fd.append("items", JSON.stringify(items));
            if (returnNotes.trim()) fd.append("notes", returnNotes.trim());
            fd.append("photo", photo, `return-${Date.now()}.jpg`);
            return returnPublicWithdrawal(id, fd);
        },
        onSuccess: (res: any) => {
            qc.invalidateQueries({ queryKey: ["public-active-borrows"] });
            qc.invalidateQueries({ queryKey: ["public-gudang-bootstrap"] });
            setCameraOpen(false);
            setActiveWithdrawalId(null);
            setExpandedId(null);
            setReturnQty({});
            setReturnNotes("");
            setSuccessCode(res?.code || "OK");
        },
        onError: (e: any) => {
            setError(e?.response?.data?.message || e?.message || "Gagal mengembalikan");
            setCameraOpen(false);
        },
    });

    function openCameraFor(id: number) {
        setError(null);
        const w = borrows.find((b) => b.id === id);
        if (!w) return;
        const totalReturn = w.items.reduce((s, it) => s + Number(returnQty[it.id] ?? 0), 0);
        if (totalReturn <= 0) { setError("Isi minimal 1 qty kembali"); return; }
        setActiveWithdrawalId(id);
        setCameraOpen(true);
    }

    function fillAllRemaining(w: PublicActiveBorrow) {
        const next: Record<number, string> = { ...returnQty };
        for (const it of w.items) {
            const remaining = Number(it.quantity) - Number(it.returnedQty);
            next[it.id] = String(Math.max(0, remaining));
        }
        setReturnQty(next);
    }

    if (successCode) {
        return (
            <div className="flex items-center justify-center h-full p-4">
                <div className="bg-card border rounded-2xl shadow-lg max-w-md w-full p-8 text-center space-y-4">
                    <div className="rounded-full bg-green-100 text-green-600 p-4 inline-flex">
                        <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <h2 className="text-xl font-bold">Barang Dikembalikan!</h2>
                    <p className="text-sm text-muted-foreground">
                        Kode pinjaman: <span className="font-mono font-bold text-foreground">{successCode}</span>
                    </p>
                    <button
                        onClick={() => setSuccessCode(null)}
                        className="w-full bg-primary text-primary-foreground rounded py-2.5 font-semibold text-sm hover:opacity-90"
                    >
                        Kembalikan Lagi
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-4 h-full overflow-y-auto space-y-3">
            <div className="bg-card border rounded-lg p-3 sticky top-0 z-10 shadow-sm">
                <label className="text-xs font-medium flex items-center gap-1 mb-1"><User className="h-3 w-3" /> Pekerja yang Meminjam</label>
                <select
                    value={workerId ?? ""}
                    onChange={(e) => { setWorkerId(e.target.value ? Number(e.target.value) : null); setExpandedId(null); setReturnQty({}); }}
                    className="w-full border rounded px-3 py-2 text-sm"
                >
                    <option value="">-- Pilih Pekerja --</option>
                    {workers.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}{w.position ? ` (${w.position})` : ""}</option>
                    ))}
                </select>
            </div>

            {workerId === null ? (
                <div className="text-center text-muted-foreground text-sm p-8">
                    Pilih pekerja untuk melihat pinjaman aktifnya.
                </div>
            ) : loadingBorrows ? (
                <div className="text-center text-muted-foreground text-sm p-8">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Memuat pinjaman…
                </div>
            ) : borrows.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm p-8">
                    Tidak ada pinjaman aktif untuk pekerja ini.
                </div>
            ) : (
                borrows.map((w) => {
                    const isOpen = expandedId === w.id;
                    const overdue = w.scheduledReturnAt && new Date(w.scheduledReturnAt) < new Date();
                    const totalQty = w.items.reduce((s, it) => s + Number(it.quantity), 0);
                    const returnedQty = w.items.reduce((s, it) => s + Number(it.returnedQty), 0);
                    return (
                        <div key={w.id} className={`border rounded-lg bg-card ${overdue ? "border-red-300" : ""}`}>
                            <button
                                onClick={() => { setExpandedId(isOpen ? null : w.id); setError(null); }}
                                className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30 rounded-lg"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="font-mono text-xs text-muted-foreground">{w.code}</div>
                                    <div className="font-medium text-sm truncate">{w.purpose}</div>
                                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                                        <span className="flex items-center gap-0.5"><Calendar className="h-3 w-3" /> {w.scheduledReturnAt ? new Date(w.scheduledReturnAt).toLocaleDateString("id-ID") : "—"}</span>
                                        <span>{returnedQty}/{totalQty} sudah kembali</span>
                                        {overdue && <span className="text-red-600 font-semibold">TERLAMBAT</span>}
                                    </div>
                                </div>
                                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </button>
                            {isOpen && (
                                <div className="border-t p-3 space-y-2">
                                    <div className="flex justify-end">
                                        <button onClick={() => fillAllRemaining(w)} className="text-xs text-primary hover:underline">
                                            Isi semua sisa
                                        </button>
                                    </div>
                                    {w.items.map((it) => {
                                        const total = Number(it.quantity);
                                        const already = Number(it.returnedQty);
                                        const remaining = total - already;
                                        const done = remaining <= 0;
                                        return (
                                            <div key={it.id} className={`flex items-center gap-2 p-2 border rounded ${done ? "bg-muted/30 opacity-60" : ""}`}>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium truncate">{it.productVariant.product.name}</div>
                                                    <div className="text-[11px] text-muted-foreground">
                                                        {it.productVariant.variantName ?? "—"} · <span className="font-mono">{it.productVariant.sku}</span> · Sisa <b>{remaining}</b>/{total}
                                                    </div>
                                                </div>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={remaining}
                                                    disabled={done}
                                                    value={returnQty[it.id] ?? ""}
                                                    onChange={(e) => setReturnQty((prev) => ({ ...prev, [it.id]: e.target.value }))}
                                                    placeholder="0"
                                                    className="w-20 border rounded px-2 py-1 text-sm text-center disabled:bg-muted"
                                                />
                                            </div>
                                        );
                                    })}
                                    <div>
                                        <label className="text-[11px] font-medium">Catatan Kembali</label>
                                        <input
                                            value={returnNotes}
                                            onChange={(e) => setReturnNotes(e.target.value)}
                                            placeholder="(opsional, mis. kondisi barang)"
                                            className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                                        />
                                    </div>
                                    {error && activeWithdrawalId === null && expandedId === w.id && (
                                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 flex items-start gap-1">
                                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {error}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => openCameraFor(w.id)}
                                        disabled={returnMut.isPending}
                                        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded font-semibold text-sm hover:opacity-90 disabled:opacity-50"
                                    >
                                        <Camera className="h-4 w-4" /> Foto & Kembalikan
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })
            )}

            {cameraOpen && activeWithdrawalId !== null && (
                <CameraCaptureModal
                    title="Foto Selfie Pekerja"
                    onCancel={() => { setCameraOpen(false); setActiveWithdrawalId(null); }}
                    onConfirm={(blob) => returnMut.mutate({ id: activeWithdrawalId, photo: blob })}
                    submitting={returnMut.isPending}
                />
            )}
        </div>
    );
}
