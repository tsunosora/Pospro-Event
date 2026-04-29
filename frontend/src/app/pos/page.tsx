"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
    Search, Plus, Minus, Trash2, ShoppingCart, X, Package, Loader2,
    Wrench, FileText, Calculator, Banknote, ArrowRight,
    Users, FileSignature, ChevronDown, AlertCircle, MapPin,
} from "lucide-react";
import { getProducts } from "@/lib/api/products";
import { createQuotation, getQuotations, updateQuotation, type Quotation } from "@/lib/api/quotations";
import { getRabList, getRab, updateRab, type RabPlan } from "@/lib/api/rab";
import { createCashflow } from "@/lib/api/cashflow";
import { createInvoice } from "@/lib/api/invoices";
import { CustomerPickerModal } from "@/components/CustomerPickerModal";
import type { Customer } from "@/lib/api/customers";
import { ACTIVE_BRANDS, BRAND_META, type Brand } from "@/lib/api/brands";
import { BrandBadge } from "@/components/BrandBadge";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// ════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════

type OrderMode = "SEWA" | "OPERASIONAL" | "PINJAM" | "TAMBAH_RAB" | "TAMBAH_PENAWARAN";

interface CartItem {
    variantId: number;
    productName: string;
    variantName: string | null;
    sku: string;
    qty: number;
    price: number;          // harga jual
    hpp: number;            // modal cost (untuk operasional)
    stock: number;
    imageUrl: string | null;
    unit: string | null;
    notes?: string;
}

const MODE_META: Record<OrderMode, { label: string; emoji: string; color: string; description: string }> = {
    SEWA: {
        label: "Sewa Booth/Event",
        emoji: "🎪",
        color: "blue",
        description: "Klien sewa peralatan booth/event → terbit Invoice & stok keluar",
    },
    OPERASIONAL: {
        label: "Operasional",
        emoji: "🔧",
        color: "amber",
        description: "Item dipakai internal → stok keluar + tercatat sebagai expense",
    },
    PINJAM: {
        label: "Pinjam",
        emoji: "📦",
        color: "violet",
        description: "Pinjam barang dengan return tracking → redirect ke Gudang Ambil",
    },
    TAMBAH_RAB: {
        label: "Tambah ke RAB",
        emoji: "💰",
        color: "indigo",
        description: "Tambahkan item ke RAB Plan yang sudah ada (Draft)",
    },
    TAMBAH_PENAWARAN: {
        label: "Tambah ke Penawaran",
        emoji: "📄",
        color: "emerald",
        description: "Tambahkan item ke Penawaran existing (Draft)",
    },
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

export default function PosPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Memuat…</div>}>
            <PosInner />
        </Suspense>
    );
}

function PosInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialMode = (searchParams.get("mode") as OrderMode | null) ?? "SEWA";

    const [mode, setMode] = useState<OrderMode>(initialMode);
    const [search, setSearch] = useState("");
    const [categoryId, setCategoryId] = useState<number | "all">("all");
    const [cart, setCart] = useState<CartItem[]>([]);

    const { data: products = [], isLoading } = useQuery({
        queryKey: ["pos-products"],
        queryFn: getProducts,
    });

    // Restore Pinjam cart kalau user balik dari /gudang/ambil
    useEffect(() => {
        try {
            const saved = sessionStorage.getItem("pos:cart");
            if (saved) {
                const arr = JSON.parse(saved);
                if (Array.isArray(arr) && arr.length > 0) setCart(arr);
                sessionStorage.removeItem("pos:cart");
            }
        } catch { /* ignore */ }
    }, []);

    const flatVariants = useMemo(() => {
        const items: Array<{
            variantId: number;
            productId: number;
            productName: string;
            variantName: string | null;
            sku: string;
            stock: number;
            price: number;
            hpp: number;
            imageUrl: string | null;
            unit: string | null;
            warehouseName: string | null;
            categoryId: number | null;
            categoryName: string | null;
        }> = [];
        for (const p of (products as any[])) {
            for (const v of p.variants ?? []) {
                items.push({
                    variantId: v.id,
                    productId: p.id,
                    productName: p.name,
                    variantName: v.variantName,
                    sku: v.sku,
                    stock: v.stock,
                    price: Number(v.price) || 0,
                    hpp: Number(v.hpp) || 0,
                    imageUrl: v.variantImageUrl ?? p.imageUrl,
                    unit: p.unit?.name ?? null,
                    warehouseName: v.defaultWarehouse?.name ?? null,
                    categoryId: p.category?.id ?? null,
                    categoryName: p.category?.name ?? null,
                });
            }
        }
        return items;
    }, [products]);

    // Build category list dengan count items per kategori
    const categories = useMemo(() => {
        const counter = new Map<number, { id: number; name: string; count: number }>();
        for (const v of flatVariants) {
            if (v.categoryId && v.categoryName) {
                const existing = counter.get(v.categoryId);
                if (existing) {
                    existing.count += 1;
                } else {
                    counter.set(v.categoryId, { id: v.categoryId, name: v.categoryName, count: 1 });
                }
            }
        }
        return Array.from(counter.values()).sort((a, b) => b.count - a.count);
    }, [flatVariants]);

    const uncategorizedCount = useMemo(
        () => flatVariants.filter((v) => !v.categoryId).length,
        [flatVariants]
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        let list = flatVariants;
        // Filter by category
        if (categoryId !== "all") {
            list = list.filter((v) => v.categoryId === categoryId);
        }
        // Filter by search
        if (q) {
            list = list.filter((v) =>
                `${v.productName} ${v.variantName ?? ""} ${v.sku} ${v.categoryName ?? ""}`.toLowerCase().includes(q)
            );
        }
        return list.slice(0, q ? 80 : 60);
    }, [flatVariants, search, categoryId]);

    function addToCart(v: (typeof flatVariants)[0]) {
        setCart((c) => {
            const existing = c.find((x) => x.variantId === v.variantId);
            if (existing) {
                if (existing.qty >= v.stock) return c; // limit
                return c.map((x) =>
                    x.variantId === v.variantId ? { ...x, qty: x.qty + 1 } : x
                );
            }
            return [
                ...c,
                {
                    variantId: v.variantId,
                    productName: v.productName,
                    variantName: v.variantName,
                    sku: v.sku,
                    qty: 1,
                    price: v.price,
                    hpp: v.hpp,
                    stock: v.stock,
                    imageUrl: v.imageUrl,
                    unit: v.unit,
                },
            ];
        });
    }

    function updateQty(variantId: number, qty: number) {
        if (qty <= 0) {
            setCart((c) => c.filter((x) => x.variantId !== variantId));
            return;
        }
        setCart((c) =>
            c.map((x) =>
                x.variantId === variantId
                    ? { ...x, qty: Math.min(qty, x.stock) }
                    : x
            )
        );
    }

    function removeFromCart(variantId: number) {
        setCart((c) => c.filter((x) => x.variantId !== variantId));
    }

    function clearCart() {
        if (cart.length === 0) return;
        if (window.confirm(`Hapus ${cart.length} item dari cart?`)) {
            setCart([]);
        }
    }

    const totalQty = cart.reduce((s, x) => s + x.qty, 0);
    const totalPrice = cart.reduce((s, x) => s + x.qty * x.price, 0);
    const totalHpp = cart.reduce((s, x) => s + x.qty * x.hpp, 0);

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            {/* Header — Mode picker */}
            <div className="bg-background border-b px-3 sm:px-4 py-2.5 shrink-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <h1 className="text-base sm:text-lg font-bold inline-flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                        Order Booth/Event
                    </h1>
                    {cart.length > 0 && (
                        <button
                            onClick={clearCart}
                            className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded inline-flex items-center gap-1"
                        >
                            <Trash2 className="h-3 w-3" /> Bersihkan ({cart.length})
                        </button>
                    )}
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
                    {(Object.keys(MODE_META) as OrderMode[]).map((m) => {
                        const meta = MODE_META[m];
                        const active = mode === m;
                        const colorActive: Record<string, string> = {
                            blue: "bg-blue-600 border-blue-600 text-white",
                            amber: "bg-amber-600 border-amber-600 text-white",
                            violet: "bg-violet-600 border-violet-600 text-white",
                            indigo: "bg-indigo-600 border-indigo-600 text-white",
                            emerald: "bg-emerald-600 border-emerald-600 text-white",
                        };
                        const colorIdle: Record<string, string> = {
                            blue: "bg-white text-blue-700 border-blue-200 hover:bg-blue-50",
                            amber: "bg-white text-amber-700 border-amber-200 hover:bg-amber-50",
                            violet: "bg-white text-violet-700 border-violet-200 hover:bg-violet-50",
                            indigo: "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50",
                            emerald: "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50",
                        };
                        return (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs sm:text-sm font-semibold transition ${active ? colorActive[meta.color] : colorIdle[meta.color]
                                    }`}
                            >
                                <span>{meta.emoji}</span>
                                <span>{meta.label}</span>
                            </button>
                        );
                    })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                    {MODE_META[mode].emoji} {MODE_META[mode].description}
                </p>
            </div>

            {/* Body — split: products + cart */}
            <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_380px] overflow-hidden">
                {/* Products picker */}
                <div className="flex flex-col min-h-0 overflow-hidden border-r">
                    <div className="p-3 border-b shrink-0 space-y-2">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari produk / SKU / kategori…"
                                className="w-full pl-9 pr-3 py-2.5 text-sm border-2 rounded-lg"
                                autoFocus
                            />
                        </div>
                        {/* Category chips strip */}
                        {categories.length > 0 && (
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-3 px-3 [scrollbar-width:thin]">
                                <button
                                    onClick={() => setCategoryId("all")}
                                    className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition ${categoryId === "all"
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-white text-foreground border-border hover:bg-muted"
                                        }`}
                                >
                                    📂 Semua
                                    <span className={`text-[10px] font-mono px-1 rounded-full ${categoryId === "all" ? "bg-white/30" : "bg-muted"}`}>
                                        {flatVariants.length}
                                    </span>
                                </button>
                                {categories.map((c) => {
                                    const active = categoryId === c.id;
                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => setCategoryId(c.id)}
                                            className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition ${active
                                                ? "bg-blue-600 text-white border-blue-700"
                                                : "bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
                                                }`}
                                        >
                                            {c.name}
                                            <span className={`text-[10px] font-mono px-1 rounded-full ${active ? "bg-white/30" : "bg-blue-50 text-blue-700"}`}>
                                                {c.count}
                                            </span>
                                        </button>
                                    );
                                })}
                                {uncategorizedCount > 0 && (
                                    <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                        Tanpa kategori: {uncategorizedCount}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto p-3 [scrollbar-width:thin]">
                        {isLoading ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                Memuat produk…
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground text-sm">
                                {search
                                    ? `Tidak ada hasil untuk "${search}"`
                                    : categoryId !== "all"
                                        ? "Tidak ada produk di kategori ini"
                                        : "Belum ada produk"}
                                {(search || categoryId !== "all") && (
                                    <button
                                        onClick={() => { setSearch(""); setCategoryId("all"); }}
                                        className="block mx-auto mt-2 text-xs text-primary hover:underline"
                                    >
                                        Reset filter
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                {filtered.map((v) => {
                                    const inCart = cart.find((c) => c.variantId === v.variantId);
                                    return (
                                        <button
                                            key={v.variantId}
                                            onClick={() => addToCart(v)}
                                            disabled={v.stock === 0 || (inCart && inCart.qty >= v.stock)}
                                            className={`relative bg-card border-2 rounded-lg p-2 hover:border-primary/40 transition text-left overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed ${inCart ? "border-primary ring-2 ring-primary/30" : "border-border"
                                                }`}
                                        >
                                            <div className="aspect-square w-full bg-muted rounded mb-1.5 overflow-hidden flex items-center justify-center">
                                                {v.imageUrl ? (
                                                    /* eslint-disable-next-line @next/next/no-img-element */
                                                    <img src={`${API_BASE}${v.imageUrl}`} alt={v.productName} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Package className="h-8 w-8 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div className="text-xs font-semibold leading-tight line-clamp-2">
                                                {v.productName}
                                                {v.variantName && v.variantName !== "Default" && (
                                                    <span className="text-muted-foreground"> · {v.variantName}</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground truncate mt-0.5">{v.sku}</div>
                                            {v.categoryName && categoryId === "all" && (
                                                <div className="text-[9px] text-blue-700 truncate mt-0.5 font-medium">
                                                    📂 {v.categoryName}
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-[11px] font-bold text-primary">
                                                    Rp {v.price.toLocaleString("id-ID")}
                                                </span>
                                                <span className={`text-[10px] font-semibold ${v.stock > 0 ? "text-emerald-700" : "text-red-600"}`}>
                                                    Stok: {v.stock}
                                                </span>
                                            </div>
                                            {v.warehouseName && (
                                                <div className="mt-0.5 text-[9px] text-blue-700 inline-flex items-center gap-0.5">
                                                    <MapPin className="h-2.5 w-2.5" /> {v.warehouseName}
                                                </div>
                                            )}
                                            {inCart && (
                                                <div className="absolute top-1 right-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                    ×{inCart.qty}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Cart panel */}
                <div className="flex flex-col min-h-0 overflow-hidden bg-muted/10">
                    {/* Cart items */}
                    <div className="flex-1 min-h-0 overflow-y-auto p-3 [scrollbar-width:thin]">
                        {cart.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground text-sm">
                                <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                Cart kosong<br />
                                <span className="text-[11px]">Pilih produk dari kiri</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {cart.map((item) => (
                                    <div
                                        key={item.variantId}
                                        className="bg-background border rounded-lg p-2.5"
                                    >
                                        <div className="flex items-start gap-2">
                                            {item.imageUrl ? (
                                                /* eslint-disable-next-line @next/next/no-img-element */
                                                <img src={`${API_BASE}${item.imageUrl}`} alt="" className="w-10 h-10 rounded object-cover bg-muted shrink-0" />
                                            ) : (
                                                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                                                    <Package className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-semibold truncate">{item.productName}</div>
                                                {item.variantName && item.variantName !== "Default" && (
                                                    <div className="text-[10px] text-muted-foreground truncate">{item.variantName}</div>
                                                )}
                                                <div className="text-[10px] text-muted-foreground">
                                                    Rp {item.price.toLocaleString("id-ID")} {item.unit ? `/ ${item.unit}` : ""}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.variantId)}
                                                className="p-1 hover:bg-red-50 text-red-600 rounded shrink-0"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <button
                                                onClick={() => updateQty(item.variantId, item.qty - 1)}
                                                className="h-8 w-8 rounded bg-muted hover:bg-muted/80 inline-flex items-center justify-center"
                                            >
                                                <Minus className="h-3.5 w-3.5" />
                                            </button>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                min={1}
                                                max={item.stock}
                                                value={item.qty}
                                                onChange={(e) => updateQty(item.variantId, Number(e.target.value) || 0)}
                                                className="flex-1 h-8 text-center text-sm font-bold border rounded"
                                            />
                                            <button
                                                onClick={() => updateQty(item.variantId, item.qty + 1)}
                                                disabled={item.qty >= item.stock}
                                                className="h-8 w-8 rounded bg-muted hover:bg-muted/80 inline-flex items-center justify-center disabled:opacity-50"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                            </button>
                                            <span className="text-xs font-mono font-bold w-20 text-right">
                                                Rp {(item.qty * item.price).toLocaleString("id-ID")}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Cart total */}
                    {cart.length > 0 && (
                        <div className="px-3 py-2 border-t bg-background shrink-0">
                            <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground">{totalQty} item</span>
                                <span className="text-muted-foreground">Modal: Rp {totalHpp.toLocaleString("id-ID")}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm font-bold">
                                <span>Total Harga</span>
                                <span className="font-mono text-primary">Rp {totalPrice.toLocaleString("id-ID")}</span>
                            </div>
                        </div>
                    )}

                    {/* Mode action panel */}
                    <div className="border-t bg-background shrink-0 p-3">
                        {mode === "SEWA" && <SewaPanel cart={cart} totalPrice={totalPrice} onSuccess={() => setCart([])} />}
                        {mode === "OPERASIONAL" && <OperasionalPanel cart={cart} totalHpp={totalHpp} onSuccess={() => setCart([])} />}
                        {mode === "PINJAM" && <PinjamPanel cart={cart} router={router} />}
                        {mode === "TAMBAH_RAB" && <TambahRabPanel cart={cart} onSuccess={() => setCart([])} router={router} />}
                        {mode === "TAMBAH_PENAWARAN" && <TambahPenawaranPanel cart={cart} onSuccess={() => setCart([])} router={router} />}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// MODE 1: SEWA — Buat Invoice
// ════════════════════════════════════════════════════════════════════════════

function SewaPanel({
    cart, totalPrice, onSuccess,
}: { cart: CartItem[]; totalPrice: number; onSuccess: () => void }) {
    const router = useRouter();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [showPicker, setShowPicker] = useState(false);
    const [projectName, setProjectName] = useState("");
    const [eventLocation, setEventLocation] = useState("");
    const [brand, setBrand] = useState<Brand>("EXINDO");

    const mut = useMutation({
        mutationFn: async () => {
            if (cart.length === 0) throw new Error("Cart kosong");
            if (!customer) throw new Error("Pilih klien dulu");
            const items = cart.map((c, idx) => ({
                description: c.productName + (c.variantName && c.variantName !== "Default" ? ` — ${c.variantName}` : ""),
                unit: c.unit || "unit",
                quantity: c.qty,
                price: c.price,
                orderIndex: idx,
                productVariantId: c.variantId,
            }));
            return createQuotation({
                quotationVariant: "SEWA",
                brand,
                customerId: customer.id,
                clientName: customer.companyPIC || customer.name,
                clientCompany: customer.companyName ?? undefined,
                clientAddress: customer.address ?? undefined,
                clientPhone: customer.phone ?? undefined,
                clientEmail: customer.email ?? undefined,
                projectName: projectName.trim() || undefined,
                eventLocation: eventLocation.trim() || undefined,
                items,
            });
        },
        onSuccess: (res) => {
            onSuccess();
            router.push(`/penawaran/${res.id}`);
        },
    });

    const canSubmit = cart.length > 0 && customer && !mut.isPending;

    return (
        <div className="space-y-2">
            {/* Brand */}
            <div className="grid grid-cols-2 gap-1.5">
                {ACTIVE_BRANDS.map((b) => {
                    const meta = BRAND_META[b];
                    const active = brand === b;
                    return (
                        <button
                            key={b}
                            type="button"
                            onClick={() => setBrand(b)}
                            className={`p-1.5 rounded border-2 text-xs flex items-center gap-1 ${active ? `${meta.bg} ${meta.border} ${meta.text} font-bold` : "bg-white border-slate-200"
                                }`}
                        >
                            <span>{meta.emoji}</span>
                            <span className="truncate">{meta.short}</span>
                        </button>
                    );
                })}
            </div>

            {/* Customer */}
            {customer ? (
                <div className="rounded border-2 border-blue-300 bg-blue-50 p-2 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{customer.companyName || customer.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                            {customer.phone ?? "—"}
                        </div>
                    </div>
                    <button
                        onClick={() => setCustomer(null)}
                        className="p-1 hover:bg-red-100 rounded text-red-600"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setShowPicker(true)}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded border-2 border-dashed border-blue-300 bg-blue-50/50 text-blue-700 text-xs font-semibold"
                >
                    <Users className="h-3.5 w-3.5" /> Pilih Klien
                </button>
            )}

            {/* Project info */}
            <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Nama Project / Event (opsional)"
                className="w-full border rounded px-2 py-1.5 text-xs"
            />
            <input
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                placeholder="Lokasi Event (opsional)"
                className="w-full border rounded px-2 py-1.5 text-xs"
            />

            {mut.isError && (
                <div className="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded p-1.5">
                    {(mut.error as any)?.response?.data?.message || (mut.error as Error).message}
                </div>
            )}

            <button
                disabled={!canSubmit}
                onClick={() => mut.mutate()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-lg disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
                {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <FileText className="h-4 w-4" />
                Buat Penawaran ({cart.length} item, Rp {totalPrice.toLocaleString("id-ID")})
            </button>
            <p className="text-[10px] text-muted-foreground text-center">
                Penawaran akan dibuat sebagai Draft. Lanjut edit/sign di halaman detail.
            </p>

            {showPicker && (
                <CustomerPickerModal
                    onClose={() => setShowPicker(false)}
                    onPick={(c) => { setCustomer(c); setShowPicker(false); }}
                />
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// MODE 2: OPERASIONAL — Stock OUT + Cashflow EXPENSE
// ════════════════════════════════════════════════════════════════════════════

function OperasionalPanel({
    cart, totalHpp, onSuccess,
}: { cart: CartItem[]; totalHpp: number; onSuccess: () => void }) {
    const [reason, setReason] = useState("");

    const mut = useMutation({
        mutationFn: async () => {
            if (cart.length === 0) throw new Error("Cart kosong");
            const finalReason = reason.trim() || "Pemakaian operasional internal";
            // Create Cashflow EXPENSE entry — stock movement OUT bisa dilakukan
            // via stock-movement API atau pakai logStockMovement. Tapi karena
            // operasi cuma Cashflow + StockMovement, langsung lewat 2 panggilan.
            const desc = cart.map((c) => `${c.qty}× ${c.productName}${c.variantName && c.variantName !== "Default" ? ` (${c.variantName})` : ""}`).join(", ");

            // 1. Create cashflow expense
            await createCashflow({
                type: "EXPENSE",
                category: "Operasional",
                amount: totalHpp,
                note: `${finalReason} — ${desc}`,
                excludeFromShift: true,
            });

            // 2. Decrement stock per item (via cashflow won't decrement stock; need separate API)
            // Pakai logStockMovement helper kalau ada, atau langsung POST /stock-movements
            for (const c of cart) {
                await fetch(`${API_BASE}/stock-movements`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("token") || sessionStorage.getItem("token") || ""}`,
                    },
                    body: JSON.stringify({
                        productVariantId: c.variantId,
                        type: "OUT",
                        quantity: c.qty,
                        reason: `Operasional — ${finalReason}`,
                    }),
                });
            }
            return { ok: true };
        },
        onSuccess: () => {
            alert(`✅ Operasional tercatat: ${cart.length} item (modal Rp ${totalHpp.toLocaleString("id-ID")})\nLihat Cashflow → category "Operasional"`);
            onSuccess();
            setReason("");
        },
    });

    return (
        <div className="space-y-2">
            <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Alasan / detail pemakaian (mis. Setup booth event Marina, perbaikan rutin)"
                className="w-full border rounded px-2 py-1.5 text-xs min-h-[60px] resize-y"
                maxLength={300}
            />

            <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 space-y-0.5">
                <div>📦 <b>Stok</b> akan otomatis berkurang sesuai cart</div>
                <div>💸 <b>Cashflow EXPENSE</b> dibuat: <b className="font-mono">Rp {totalHpp.toLocaleString("id-ID")}</b></div>
                <div>🏷️ Kategori: <b>Operasional</b></div>
            </div>

            {mut.isError && (
                <div className="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded p-1.5">
                    {(mut.error as Error).message}
                </div>
            )}

            <button
                disabled={cart.length === 0 || mut.isPending}
                onClick={() => mut.mutate()}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm py-3 rounded-lg disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
                {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Wrench className="h-4 w-4" />
                Catat Operasional
            </button>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// MODE 3: PINJAM — redirect ke /gudang/ambil
// ════════════════════════════════════════════════════════════════════════════

function PinjamPanel({ cart, router }: { cart: CartItem[]; router: ReturnType<typeof useRouter> }) {
    function goToGudang() {
        if (cart.length === 0) return;
        try {
            sessionStorage.setItem("gudang:cart", JSON.stringify(cart));
        } catch { /* ignore */ }
        router.push("/gudang/ambil");
    }

    return (
        <div className="space-y-2">
            <div className="rounded border border-violet-200 bg-violet-50 p-2 text-[11px] text-violet-800 space-y-0.5">
                <div>👷 Klik tombol untuk lanjut ke <b>Gudang Ambil</b></div>
                <div>🔑 Pakai PIN gudang untuk akses</div>
                <div>📋 Pilih event + nama karyawan yang pinjam</div>
                <div>📅 Set tanggal kembali</div>
            </div>

            <button
                disabled={cart.length === 0}
                onClick={goToGudang}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm py-3 rounded-lg disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
                Lanjut ke Gudang Ambil
                <ArrowRight className="h-4 w-4" />
            </button>
            <p className="text-[10px] text-muted-foreground text-center">
                Cart akan ter-bawa ke kiosk gudang.
            </p>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// MODE 4: TAMBAH KE RAB
// ════════════════════════════════════════════════════════════════════════════

function TambahRabPanel({
    cart, onSuccess, router,
}: { cart: CartItem[]; onSuccess: () => void; router: ReturnType<typeof useRouter> }) {
    const [selectedRabId, setSelectedRabId] = useState<number | null>(null);

    const { data: rabs = [], isLoading } = useQuery({
        queryKey: ["rab-list-pos"],
        queryFn: getRabList,
    });

    const mut = useMutation({
        mutationFn: async () => {
            if (!selectedRabId) throw new Error("Pilih RAB target dulu");
            if (cart.length === 0) throw new Error("Cart kosong");
            // Fetch detail RAB untuk get items & categories existing
            const rab = await getRab(selectedRabId);
            const existingItems = rab.items ?? [];
            // Tentukan kategori default — pakai kategori pertama dari existing items, atau cari kategori "Lainnya"
            const defaultCategoryId = existingItems[0]?.categoryId ?? null;
            if (!defaultCategoryId) {
                throw new Error("RAB target belum punya kategori. Buka RAB-nya dulu di /rab dan tambah kategori secara manual.");
            }
            const newItems = cart.map((c, idx) => ({
                categoryId: defaultCategoryId,
                description: c.productName + (c.variantName && c.variantName !== "Default" ? ` — ${c.variantName}` : ""),
                unit: c.unit ?? "unit",
                quantity: c.qty,
                quantityCost: c.qty,
                priceRab: c.price,
                priceCost: c.hpp,
                orderIndex: existingItems.length + idx,
                productVariantId: c.variantId,
            }));
            const allItems = [
                ...existingItems.map((it: any) => ({
                    categoryId: it.categoryId,
                    description: it.description,
                    unit: it.unit,
                    quantity: Number(it.quantity),
                    quantityCost: Number(it.quantityCost ?? it.quantity),
                    priceRab: Number(it.priceRab),
                    priceCost: Number(it.priceCost),
                    orderIndex: it.orderIndex ?? 0,
                    productVariantId: it.productVariantId ?? null,
                })),
                ...newItems,
            ];
            return updateRab(selectedRabId, { items: allItems });
        },
        onSuccess: (rab) => {
            onSuccess();
            router.push(`/rab/${rab.id}`);
        },
    });

    return (
        <div className="space-y-2">
            <select
                value={selectedRabId ?? ""}
                onChange={(e) => setSelectedRabId(e.target.value ? Number(e.target.value) : null)}
                className="w-full border-2 rounded px-2 py-2 text-xs"
                disabled={isLoading}
            >
                <option value="">— Pilih RAB target —</option>
                {(rabs as RabPlan[]).slice(0, 50).map((r) => (
                    <option key={r.id} value={r.id}>
                        {r.code} — {r.title}{r.customer?.name ? ` · ${r.customer.name}` : ""}
                    </option>
                ))}
            </select>

            <div className="rounded border border-indigo-200 bg-indigo-50 p-2 text-[11px] text-indigo-800 space-y-0.5">
                <div>📋 Item dari cart akan di-append ke RAB</div>
                <div>⚠️ Kategori default = kategori item pertama RAB target</div>
                <div>💰 Harga jual = harga produk, COST = HPP produk</div>
            </div>

            {mut.isError && (
                <div className="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded p-1.5">
                    {(mut.error as any)?.response?.data?.message || (mut.error as Error).message}
                </div>
            )}

            <button
                disabled={!selectedRabId || cart.length === 0 || mut.isPending}
                onClick={() => mut.mutate()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3 rounded-lg disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
                {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Calculator className="h-4 w-4" />
                Tambahkan ke RAB
            </button>

            <Link
                href="/rab"
                className="block text-[10px] text-center text-muted-foreground hover:text-foreground underline"
            >
                Belum ada RAB? Buat RAB baru →
            </Link>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// MODE 5: TAMBAH KE PENAWARAN
// ════════════════════════════════════════════════════════════════════════════

function TambahPenawaranPanel({
    cart, onSuccess, router,
}: { cart: CartItem[]; onSuccess: () => void; router: ReturnType<typeof useRouter> }) {
    const [selectedQId, setSelectedQId] = useState<number | null>(null);

    const { data: quotations = [], isLoading } = useQuery({
        queryKey: ["quotations-pos"],
        queryFn: () => getQuotations({ status: "DRAFT", type: "QUOTATION" }),
    });

    const mut = useMutation({
        mutationFn: async () => {
            if (!selectedQId) throw new Error("Pilih Penawaran target dulu");
            if (cart.length === 0) throw new Error("Cart kosong");
            // Fetch existing quotation items — pakai endpoint quotation update merge logic
            // Karena update endpoint pakai full items array (replace), kita perlu ambil existing dulu
            // Backend createQuotation accept items, but updateQuotation also requires full items
            // Strategy: hit update with new combined items
            const target = (quotations as Quotation[]).find((q) => q.id === selectedQId);
            const existing = target?.items ?? [];
            const newItems = cart.map((c, idx) => ({
                description: c.productName + (c.variantName && c.variantName !== "Default" ? ` — ${c.variantName}` : ""),
                unit: c.unit || "unit",
                quantity: c.qty,
                price: c.price,
                orderIndex: existing.length + idx,
                productVariantId: c.variantId,
            }));
            const combined = [
                ...existing.map((it: any) => ({
                    description: it.description,
                    unit: it.unit,
                    quantity: Number(it.quantity),
                    price: Number(it.price),
                    orderIndex: it.orderIndex ?? 0,
                    productVariantId: it.productVariantId ?? null,
                })),
                ...newItems,
            ];
            return updateQuotation(selectedQId, { items: combined });
        },
        onSuccess: (res: any) => {
            onSuccess();
            router.push(`/penawaran/${res.id}`);
        },
    });

    const draftQuotations = (quotations as Quotation[]).filter((q) => q.status === "DRAFT");

    return (
        <div className="space-y-2">
            <select
                value={selectedQId ?? ""}
                onChange={(e) => setSelectedQId(e.target.value ? Number(e.target.value) : null)}
                className="w-full border-2 rounded px-2 py-2 text-xs"
                disabled={isLoading}
            >
                <option value="">— Pilih Penawaran target —</option>
                {draftQuotations.slice(0, 50).map((q) => (
                    <option key={q.id} value={q.id}>
                        {q.invoiceNumber} — {q.clientName}
                    </option>
                ))}
            </select>

            {draftQuotations.length === 0 && !isLoading && (
                <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                    ⚠️ Belum ada Penawaran draft. Buat penawaran baru di <Link href="/penawaran" className="underline font-semibold">/penawaran</Link>
                </div>
            )}

            <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-800 space-y-0.5">
                <div>📄 Hanya penawaran <b>status DRAFT</b> yang bisa di-edit</div>
                <div>💰 Harga = harga produk saat ini</div>
                <div>✏️ Lanjut edit di halaman detail penawaran</div>
            </div>

            {mut.isError && (
                <div className="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded p-1.5">
                    {(mut.error as any)?.response?.data?.message || (mut.error as Error).message}
                </div>
            )}

            <button
                disabled={!selectedQId || cart.length === 0 || mut.isPending}
                onClick={() => mut.mutate()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3 rounded-lg disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
                {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <FileSignature className="h-4 w-4" />
                Tambahkan ke Penawaran
            </button>

            <Link
                href="/penawaran"
                className="block text-[10px] text-center text-muted-foreground hover:text-foreground underline"
            >
                Belum ada Penawaran? Buat baru →
            </Link>
        </div>
    );
}
