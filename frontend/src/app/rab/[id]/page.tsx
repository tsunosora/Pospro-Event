"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getRab,
    getRabSummary,
    updateRab,
    markRabReportStatus,
    generateQuotationFromRab,
    downloadRabXlsx,
    getBoothVariants,
    saveRabAsProduct,
    generateCashflowFromRab,
    parseRabTags,
    type RabItem,
    type BoothVariant,
} from "@/lib/api/rab";
import { getRabCategories, type RabCategory } from "@/lib/api/rab-categories";
import { getRabLooseItemSuggestions, type RabLooseItem } from "@/lib/api/rab-loose-items";
import { getCategories, getUnits } from "@/lib/api/products";
import {
    ArrowLeft,
    Plus,
    Trash2,
    FileSpreadsheet,
    FileSignature,
    Loader2,
    Save,
    ChevronDown,
    ChevronRight,
    Package,
    PackagePlus,
    X,
    Search,
    Users,
    ImagePlus,
    Bookmark,
    BookmarkCheck,
    Calculator,
} from "lucide-react";
import MultiplierCalculator, { type CalcResult } from "../MultiplierCalculator";
import { ACTIVE_BRANDS, BRAND_META, type Brand } from "@/lib/api/brands";
import { BrandBadge } from "@/components/BrandBadge";
import InventoryAcquisitionsSection from "./InventoryAcquisitionsSection";
import { CustomerPickerModal } from "@/components/CustomerPickerModal";
import { TagChipInput } from "@/components/TagChipInput";

const toast = {
    success: (msg: string) => alert(msg),
    error: (msg: string) => alert(msg),
};

function fmtRp(v: number) {
    if (!isFinite(v)) return "Rp 0";
    return `Rp ${Math.round(v).toLocaleString("id-ID")}`;
}

type LocalItem = RabItem & { _key: string };

function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function RabDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = use(params);
    const id = parseInt(idStr, 10);
    const qc = useQueryClient();

    const { data: rab, isLoading } = useQuery({
        queryKey: ["rab", id],
        queryFn: () => getRab(id),
        enabled: !isNaN(id),
    });

    const { data: summary } = useQuery({
        queryKey: ["rab-summary", id],
        queryFn: () => getRabSummary(id),
        enabled: !isNaN(id),
        refetchInterval: false,
    });

    // Kategori RAB dinamis dari DB. includeInactive=true supaya item lama yang
    // pakai kategori non-aktif tetap bisa di-render (label ikut ke-load).
    const { data: allCategoriesRaw = [] } = useQuery<RabCategory[]>({
        queryKey: ["rab-categories", true],
        queryFn: () => getRabCategories(true),
    });
    const activeCategories = useMemo(
        () => allCategoriesRaw.filter((c) => c.isActive),
        [allCategoriesRaw],
    );
    // Lookup label by id (pakai allCategoriesRaw supaya kategori non-aktif tetap punya label)
    const categoryLabel = (id: number) => allCategoriesRaw.find((c) => c.id === id)?.name ?? "?";

    const [title, setTitle] = useState("");
    const [projectName, setProjectName] = useState("");
    const [location, setLocation] = useState("");
    const [periodStart, setPeriodStart] = useState("");
    const [periodEnd, setPeriodEnd] = useState("");
    const [notes, setNotes] = useState("");
    const [dpAmount, setDpAmount] = useState(0);
    const [pelunasan, setPelunasan] = useState(0);
    const [incomeOther, setIncomeOther] = useState(0);
    const [items, setItems] = useState<LocalItem[]>([]);
    const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
    const [customerId, setCustomerId] = useState<number | null>(null);
    const [brand, setBrand] = useState<Brand | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [reportCompletedAt, setReportCompletedAt] = useState<string | null>(null);

    const [showPicker, setShowPicker] = useState<number | null>(null);
    const [showCustomerPicker, setShowCustomerPicker] = useState(false);
    const [showGenModal, setShowGenModal] = useState(false);
    const [showSaveProductModal, setShowSaveProductModal] = useState(false);
    const [showGenCashflowModal, setShowGenCashflowModal] = useState(false);
    const [genCashflowMode, setGenCashflowMode] = useState<'detail' | 'category'>('detail');
    const [genForm, setGenForm] = useState({
        quotationVariant: "SEWA" as "SEWA" | "PENGADAAN_BOOTH",
        clientName: "",
        clientCompany: "",
        clientAddress: "",
        clientPhone: "",
        clientEmail: "",
        dpPercent: 50,
    });
    const [downloading, setDownloading] = useState(false);

    // Hydrate
    useEffect(() => {
        if (!rab) return;
        setTitle(rab.title || "");
        setProjectName(rab.projectName || "");
        setLocation(rab.location || "");
        setBrand(rab.brand);
        setPeriodStart(rab.periodStart ? rab.periodStart.slice(0, 10) : "");
        setPeriodEnd(rab.periodEnd ? rab.periodEnd.slice(0, 10) : "");
        setNotes(rab.notes || "");
        setDpAmount(parseFloat(rab.dpAmount as any) || 0);
        setPelunasan(parseFloat(rab.pelunasan as any) || 0);
        setIncomeOther(parseFloat(rab.incomeOther as any) || 0);
        setCustomerId(rab.customerId ?? null);
        setTags(parseRabTags(rab.tags));
        setReportCompletedAt(rab.reportCompletedAt ?? null);
        setItems(
            (rab.items || []).map((it) => ({
                ...it,
                _key: uid(),
                quantity: typeof it.quantity === "string" ? parseFloat(it.quantity) : it.quantity,
                quantityCost:
                    it.quantityCost !== undefined && it.quantityCost !== null
                        ? typeof it.quantityCost === "string"
                            ? parseFloat(it.quantityCost)
                            : it.quantityCost
                        : typeof it.quantity === "string"
                            ? parseFloat(it.quantity)
                            : it.quantity,
                priceRab: typeof it.priceRab === "string" ? parseFloat(it.priceRab) : it.priceRab,
                priceCost: typeof it.priceCost === "string" ? parseFloat(it.priceCost) : it.priceCost,
            }))
        );
        setGenForm((f) => ({
            ...f,
            clientName: rab.customer?.name || f.clientName,
            clientCompany: rab.customer?.companyName || f.clientCompany,
        }));
    }, [rab]);

    // Grouping & totals (live)
    const grouped = useMemo(() => {
        const map = new Map<number, LocalItem[]>();
        activeCategories.forEach((c) => map.set(c.id, []));
        items.forEach((it) => {
            // jika item pakai kategori non-aktif, tetap masukin ke map (auto-add bucket)
            const arr = map.get(it.categoryId) || [];
            arr.push(it);
            map.set(it.categoryId, arr);
        });
        return map;
    }, [items, activeCategories]);

    // Daftar kategori untuk render: aktif + kategori non-aktif yang masih dipakai item lama
    const visibleCategories = useMemo(() => {
        const seen = new Set(activeCategories.map((c) => c.id));
        const extra = allCategoriesRaw.filter((c) => !c.isActive && items.some((it) => it.categoryId === c.id));
        return [...activeCategories, ...extra];
    }, [activeCategories, allCategoriesRaw, items]);

    const calcRow = (it: LocalItem) => {
        const qRab = Number(it.quantity) || 0;
        const qCost = Number(it.quantityCost ?? it.quantity) || 0;
        const r = Number(it.priceRab) || 0;
        const c = Number(it.priceCost) || 0;
        const subRab = qRab * r;
        const subCost = qCost * c;
        return { subRab, subCost, selisih: subRab - subCost };
    };

    const categorySubtotals = useMemo(() => {
        const m = new Map<number, { rab: number; cost: number; selisih: number }>();
        visibleCategories.forEach((c) => {
            const list = grouped.get(c.id) || [];
            const rabT = list.reduce((a, it) => a + calcRow(it).subRab, 0);
            const costT = list.reduce((a, it) => a + calcRow(it).subCost, 0);
            m.set(c.id, { rab: rabT, cost: costT, selisih: rabT - costT });
        });
        return m;
    }, [grouped, visibleCategories]);

    const totalRab = useMemo(
        () => Array.from(categorySubtotals.values()).reduce((a, s) => a + s.rab, 0),
        [categorySubtotals]
    );
    const totalCost = useMemo(
        () => Array.from(categorySubtotals.values()).reduce((a, s) => a + s.cost, 0),
        [categorySubtotals]
    );
    const totalSelisih = totalRab - totalCost;

    // Hitung cost inventaris (item yang ditandai sebagai aset perusahaan)
    const costInventory = useMemo(() =>
        items.filter((it) => it.isInventory).reduce((acc, it) => {
            const q = Number(it.quantityCost ?? it.quantity) || 0;
            const p = Number(it.priceCost) || 0;
            return acc + q * p;
        }, 0)
    , [items]);
    const costOperational = totalCost - costInventory;
    const operationalProfit = totalRab - costOperational;
    const inventoryItemCount = items.filter((it) => it.isInventory).length;

    const totalIncome = (dpAmount || 0) + (pelunasan || 0) + (incomeOther || 0);
    const saldo = totalIncome - totalCost;

    // Item dengan priceRab > 0 tapi priceCost = 0 — Real Cost belum diisi
    const missingCostCount = useMemo(() =>
        items.filter((it) => {
            const pRab = Number(it.priceRab) || 0;
            const pCost = Number(it.priceCost) || 0;
            return pRab > 0 && pCost === 0;
        }).length
    , [items]);
    const isMarginFake = totalCost === 0 && totalRab > 0;

    // Handlers
    const addItem = (catId: number) => {
        setItems((prev) => [
            ...prev,
            {
                _key: uid(),
                categoryId: catId,
                description: "",
                unit: "",
                quantity: 1,
                quantityCost: 1,
                priceRab: 0,
                priceCost: 0,
                orderIndex: prev.filter((p) => p.categoryId === catId).length,
            },
        ]);
        // Pastikan kategori expand setelah tambah
        setCollapsed((c) => {
            const next = new Set(c);
            next.delete(catId);
            return next;
        });
        setLastUsedCatId(catId);
    };

    const updateItem = (key: string, patch: Partial<LocalItem>) => {
        setItems((prev) => prev.map((it) => (it._key === key ? { ...it, ...patch } : it)));
    };

    const removeItem = (key: string) => {
        setItems((prev) => prev.filter((it) => it._key !== key));
    };

    // Kalkulator multiplier (org × hari × jam × kali) — popover per row.
    const [calcOpenKey, setCalcOpenKey] = useState<string | null>(null);

    // Ingat kategori terakhir yang user pakai (untuk FAB tambah cepat)
    const [lastUsedCatId, setLastUsedCatId] = useState<number | null>(null);

    const applyCalc = (key: string, r: CalcResult) => {
        const patch: Partial<LocalItem> = {
            description: r.descriptionText,
            notes: r.notesText,
        };
        if (r.target === "COST" || r.target === "BOTH") {
            patch.quantityCost = r.qty;
            patch.priceCost = r.unitPrice;
        }
        if (r.target === "RAB" || r.target === "BOTH") {
            patch.quantity = r.qty;
            patch.priceRab = r.unitPrice;
        }
        updateItem(key, patch);
        setCalcOpenKey(null);
    };

    const toggleCollapse = (catId: number) => {
        setCollapsed((c) => {
            const next = new Set(c);
            if (next.has(catId)) next.delete(catId);
            else next.add(catId);
            return next;
        });
    };

    const addFromVariant = (catId: number, v: BoothVariant) => {
        const price = Number(v.price) || 0;
        const cost = Number(v.hpp) || 0;
        const desc = `${v.product.name}${v.variantName ? ` — ${v.variantName}` : ""}`;
        const unit = v.defaultRentalUnit || v.product.unit?.name || "unit";
        setItems((prev) => [
            ...prev,
            {
                _key: uid(),
                categoryId: catId,
                description: desc,
                unit,
                quantity: 1,
                quantityCost: 1,
                priceRab: price,
                priceCost: cost,
                orderIndex: prev.filter((p) => p.categoryId === catId).length,
                productVariantId: v.id,
            },
        ]);
        setCollapsed((c) => {
            const next = new Set(c);
            next.delete(catId);
            return next;
        });
        setLastUsedCatId(catId);
    };

    // Save
    // Mutation: toggle status laporan lengkap
    const reportMut = useMutation({
        mutationFn: (complete: boolean) => markRabReportStatus(id, complete),
        onSuccess: (res) => {
            setReportCompletedAt(res.reportCompletedAt ?? null);
            qc.invalidateQueries({ queryKey: ["rab", id] });
            qc.invalidateQueries({ queryKey: ["rab-list"] });
            toast.success(
                res.reportCompletedAt
                    ? "✅ Laporan ditandai LENGKAP. Status berubah jadi 'Laporan Lengkap'."
                    : "↩️ Tanda laporan lengkap dibatalkan.",
            );
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal update status laporan"),
    });

    const saveMut = useMutation({
        mutationFn: () =>
            updateRab(id, {
                title: title.trim(),
                projectName: projectName.trim() || undefined,
                location: location.trim() || undefined,
                periodStart: periodStart || undefined,
                periodEnd: periodEnd || undefined,
                notes: notes.trim() || undefined,
                customerId: customerId,
                brand: brand,
                tags,
                dpAmount,
                pelunasan,
                incomeOther,
                items: items.map((it, idx) => ({
                    categoryId: it.categoryId,
                    description: it.description,
                    unit: it.unit || null,
                    quantity: Number(it.quantity) || 0,
                    quantityCost: Number(it.quantityCost ?? it.quantity) || 0,
                    priceRab: Number(it.priceRab) || 0,
                    priceCost: Number(it.priceCost) || 0,
                    orderIndex: idx,
                    productVariantId: it.productVariantId ?? null,
                    notes: it.notes ?? null,
                    saveAsLoose:
                        !it.productVariantId &&
                        !!it.description?.trim() &&
                        (it.saveAsLoose ?? true),
                    isInventory: it.isInventory ?? false,
                })),
            }),
        onSuccess: () => {
            toast.success("✅ RAB tersimpan · 💸 Cashflow auto-sync");
            qc.invalidateQueries({ queryKey: ["rab", id] });
            qc.invalidateQueries({ queryKey: ["rab-summary", id] });
            qc.invalidateQueries({ queryKey: ["rab-list"] });
            // Invalidate cashflow caches juga karena auto-sync di backend
            qc.invalidateQueries({ queryKey: ["cashflow"] });
            qc.invalidateQueries({ queryKey: ["cashflows"] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal simpan"),
    });

    // Ctrl+S / Cmd+S → trigger Simpan RAB (override default browser "save page")
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                e.preventDefault();
                if (!saveMut.isPending) saveMut.mutate();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saveMut.isPending]);

    const genMut = useMutation({
        mutationFn: () => generateQuotationFromRab(id, genForm),
        onSuccess: (quo: any) => {
            toast.success(`Penawaran ${quo.invoiceNumber} dibuat`);
            setShowGenModal(false);
            window.location.href = `/penawaran/${quo.id}`;
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal generate"),
    });

    const genCashflowMut = useMutation({
        mutationFn: () => generateCashflowFromRab(id, { mode: genCashflowMode }),
        onSuccess: (res) => {
            const total = res.totalAmount.toLocaleString("id-ID");
            toast.success(
                `${res.created} entry expense dibuat. Total Rp ${total}.${res.eventId ? " Auto-tagged ke event." : ""}`,
            );
            setShowGenCashflowModal(false);
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal generate cashflow"),
    });

    const handleDownloadXlsx = async () => {
        if (!rab) return;
        try {
            setDownloading(true);
            const blob = await downloadRabXlsx(id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${rab.code}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error("Gagal download XLSX");
        } finally {
            setDownloading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    if (!rab) {
        return (
            <div className="p-6 text-center text-muted-foreground">
                RAB tidak ditemukan.{" "}
                <Link href="/rab" className="text-primary underline">
                    Kembali
                </Link>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 max-w-[1400px] mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                    <Link href="/rab" className="p-1.5 hover:bg-muted rounded">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <div className="font-mono text-xs text-muted-foreground">{rab.code}</div>
                        <h1 className="text-xl font-bold">{title || "Untitled RAB"}</h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => saveMut.mutate()}
                        disabled={saveMut.isPending}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        {saveMut.isPending ? "Menyimpan…" : "Simpan"}
                    </button>
                    <button
                        onClick={handleDownloadXlsx}
                        disabled={downloading}
                        className="flex items-center gap-2 border px-3 py-2 rounded-md hover:bg-muted disabled:opacity-50"
                    >
                        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                        Export XLSX
                    </button>
                    <button
                        onClick={() => setShowGenModal(true)}
                        className="flex items-center gap-2 border px-3 py-2 rounded-md hover:bg-muted"
                    >
                        <FileSignature className="h-4 w-4" />
                        Generate Penawaran
                    </button>
                    <button
                        onClick={() => setShowSaveProductModal(true)}
                        className="flex items-center gap-2 border px-3 py-2 rounded-md hover:bg-muted"
                        title="Simpan RAB ini sebagai produk di katalog POS"
                    >
                        <PackagePlus className="h-4 w-4" />
                        Simpan sebagai Produk
                    </button>
                    {/* Cashflow status — auto-sync indicator + link */}
                    <Link
                        href={`/cashflow?rabPlanId=${id}`}
                        className="flex items-center gap-2 border-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300 px-3 py-2 rounded-md transition"
                        title="Cashflow auto-sync setiap kali Simpan RAB. Klik untuk lihat entries di Cashflow page."
                    >
                        💸 Cashflow Tersinkron
                    </Link>
                </div>
            </div>

            {/* Brand picker — pilih CV mana surat penawaran akan pakai */}
            <div className="border-2 rounded-lg p-3 bg-slate-50 flex items-center gap-3 flex-wrap">
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
                        ⚠ Belum di-tag — pilih agar surat penawaran pakai header benar
                    </span>
                )}
                <span className="text-[11px] text-muted-foreground ml-auto">
                    Brand menentukan header & nomor seri surat penawaran.
                </span>
            </div>

            {/* Meta */}
            <div className="border rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label="Judul">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full border rounded-md px-3 py-2 text-sm"
                    />
                </Field>
                <Field label="Nama Proyek">
                    <input
                        type="text"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        className="w-full border rounded-md px-3 py-2 text-sm"
                    />
                </Field>
                <Field label="Lokasi">
                    <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full border rounded-md px-3 py-2 text-sm"
                    />
                </Field>
                <Field label="Mulai">
                    <input
                        type="date"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        className="w-full border rounded-md px-3 py-2 text-sm"
                    />
                </Field>
                <Field label="Selesai">
                    <input
                        type="date"
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        className="w-full border rounded-md px-3 py-2 text-sm"
                    />
                </Field>
                <Field label="Klien">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowCustomerPicker(true)}
                            className="flex-1 text-left border rounded-md px-3 py-2 text-sm hover:bg-muted/50 flex items-center gap-2"
                        >
                            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">
                                {rab.customer
                                    ? rab.customer.companyName || rab.customer.name
                                    : customerId
                                        ? `Customer #${customerId}`
                                        : <span className="text-muted-foreground">Pilih klien…</span>}
                            </span>
                        </button>
                        {customerId && (
                            <button
                                type="button"
                                onClick={() => setCustomerId(null)}
                                className="p-2 text-muted-foreground hover:text-red-600"
                                title="Lepas"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </Field>
                <Field label="Catatan">
                    <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full border rounded-md px-3 py-2 text-sm"
                    />
                </Field>
            </div>

            {/* Tag — full width below header form */}
            <div className="border rounded-lg p-3 bg-blue-50/30">
                <label className="text-xs font-medium text-muted-foreground block mb-1.5 inline-flex items-center gap-1.5">
                    🏷️ Tag / Kategori RAB
                    <span className="text-[10px] font-normal italic">(memudahkan filter & pencarian — mis. "Stand Standar 3x3", "Pengadaan", "Indoor")</span>
                </label>
                <TagChipInput
                    value={tags}
                    onChange={setTags}
                    placeholder="Tambah tag (Enter / koma)…"
                />
            </div>

            {/* Kategori items */}
            <div className="space-y-3">
                {visibleCategories.map((cat) => {
                    const list = grouped.get(cat.id) || [];
                    const sub = categorySubtotals.get(cat.id) || { rab: 0, cost: 0, selisih: 0 };
                    const isCollapsed = collapsed.has(cat.id);
                    return (
                        <div key={cat.id} id={`rab-cat-${cat.id}`} className="border rounded-lg overflow-hidden">
                            <div className="bg-muted/50 px-3 py-2 flex items-center justify-between">
                                <button
                                    onClick={() => toggleCollapse(cat.id)}
                                    className="flex items-center gap-2 font-semibold text-sm"
                                >
                                    {isCollapsed ? (
                                        <ChevronRight className="h-4 w-4" />
                                    ) : (
                                        <ChevronDown className="h-4 w-4" />
                                    )}
                                    {cat.name}
                                    {!cat.isActive && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                            nonaktif
                                        </span>
                                    )}
                                    <span className="text-xs text-muted-foreground font-normal">
                                        ({list.length} item)
                                    </span>
                                </button>
                                <div className="flex items-center gap-4 text-xs">
                                    <span>
                                        RAB: <b className="font-mono">{fmtRp(sub.rab)}</b>
                                    </span>
                                    <span className="text-muted-foreground">
                                        COST: <b className="font-mono">{fmtRp(sub.cost)}</b>
                                    </span>
                                    <span className={sub.selisih >= 0 ? "text-green-600" : "text-red-600"}>
                                        Selisih: <b className="font-mono">{fmtRp(sub.selisih)}</b>
                                    </span>
                                    <button
                                        onClick={() => setShowPicker(cat.id)}
                                        className="flex items-center gap-1 text-xs border px-2 py-1 rounded hover:bg-muted"
                                        title="Pilih dari katalog produk"
                                    >
                                        <Package className="h-3 w-3" />
                                        Katalog
                                    </button>
                                    <button
                                        onClick={() => addItem(cat.id)}
                                        className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:opacity-90"
                                    >
                                        <Plus className="h-3 w-3" />
                                        Item
                                    </button>
                                </div>
                            </div>

                            {!isCollapsed && list.length > 0 && (
                                <div className="p-3 space-y-3 bg-slate-50/50">
                                    {list.map((it, idx) => {
                                        const { subRab, subCost, selisih } = calcRow(it);
                                        const hasDesc = !!it.description?.trim();
                                        const willSave = hasDesc && (it.saveAsLoose ?? true);
                                        const untung = selisih >= 0;
                                        return (
                                            <div
                                                key={it._key}
                                                className={
                                                    "border-2 rounded-xl overflow-hidden transition " +
                                                    (it.isInventory
                                                        ? "bg-violet-50/40 border-violet-300 hover:border-violet-400 ring-1 ring-violet-200"
                                                        : "bg-white border-slate-200 hover:border-slate-300")
                                                }
                                            >
                                                {/* Header: nomor + uraian + hapus */}
                                                <div className={"flex items-start gap-2 p-3 border-b " + (it.isInventory ? "bg-violet-50/60" : "bg-white")}>
                                                    <span className={"shrink-0 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center mt-1 " + (it.isInventory ? "bg-violet-200 text-violet-800" : "bg-slate-100 text-slate-600")}>
                                                        {idx + 1}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                                                Uraian Item
                                                            </label>
                                                            {/* Toggle Inventaris — prominent di header item */}
                                                            <label
                                                                className={
                                                                    "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold border cursor-pointer transition select-none " +
                                                                    (it.isInventory
                                                                        ? "border-violet-400 bg-violet-200 text-violet-900 hover:bg-violet-300"
                                                                        : "border-violet-200 bg-white text-violet-700 hover:bg-violet-50")
                                                                }
                                                                title={it.isInventory
                                                                    ? "Item ini ditandai sebagai BARANG INVENTARIS (aset perusahaan, tidak dihitung sebagai cost murni event). Klik untuk batal."
                                                                    : "Centang kalau item ini barang inventaris (aset perusahaan, mis. booth, alat, perabot)"
                                                                }
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!it.isInventory}
                                                                    onChange={(e) => updateItem(it._key, { isInventory: e.target.checked })}
                                                                    className="h-3.5 w-3.5 accent-violet-600"
                                                                />
                                                                📦 Barang Inventaris
                                                            </label>
                                                        </div>
                                                        <UraianAutocomplete
                                                            value={it.description}
                                                            onChange={(v) =>
                                                                updateItem(it._key, { description: v })
                                                            }
                                                            onPick={(v) => {
                                                                const price = Number(v.price) || 0;
                                                                const cost = Number(v.hpp) || 0;
                                                                const desc = `${v.product.name}${v.variantName ? ` — ${v.variantName}` : ""}`;
                                                                const unit = v.defaultRentalUnit || v.product.unit?.name || "unit";
                                                                updateItem(it._key, {
                                                                    description: desc,
                                                                    unit,
                                                                    priceRab: price,
                                                                    priceCost: cost,
                                                                    productVariantId: v.id,
                                                                });
                                                            }}
                                                            onPickLoose={(li) => {
                                                                updateItem(it._key, {
                                                                    description: li.description,
                                                                    unit: li.unit ?? it.unit,
                                                                    priceRab: parseFloat(li.lastPriceRab) || Number(it.priceRab) || 0,
                                                                    priceCost: parseFloat(li.lastPriceCost) || Number(it.priceCost) || 0,
                                                                    productVariantId: null,
                                                                    saveAsLoose: true,
                                                                });
                                                            }}
                                                        />
                                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[11px] text-slate-500">Satuan:</span>
                                                                <input
                                                                    type="text"
                                                                    value={it.unit || ""}
                                                                    onChange={(e) =>
                                                                        updateItem(it._key, { unit: e.target.value })
                                                                    }
                                                                    placeholder="pcs / m² / …"
                                                                    className="w-24 border rounded px-2 py-1 text-sm"
                                                                />
                                                            </div>
                                                            {!it.productVariantId && (
                                                                <button
                                                                    type="button"
                                                                    disabled={!hasDesc}
                                                                    onClick={() =>
                                                                        updateItem(it._key, { saveAsLoose: !willSave })
                                                                    }
                                                                    title={
                                                                        !hasDesc
                                                                            ? "Isi uraian dulu untuk bisa disimpan"
                                                                            : willSave
                                                                                ? "Klik untuk batal simpan"
                                                                                : "Klik untuk simpan ke Item Lepas"
                                                                    }
                                                                    className={
                                                                        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border transition " +
                                                                        (!hasDesc
                                                                            ? "border-dashed border-border text-muted-foreground/50 cursor-not-allowed"
                                                                            : willSave
                                                                                ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                                                                                : "border-border bg-muted/40 text-muted-foreground hover:bg-muted/70")
                                                                    }
                                                                >
                                                                    {willSave ? (
                                                                        <BookmarkCheck className="h-3.5 w-3.5" />
                                                                    ) : (
                                                                        <Bookmark className="h-3.5 w-3.5" />
                                                                    )}
                                                                    {willSave
                                                                        ? "Akan disimpan ke Item Lepas"
                                                                        : "Tidak disimpan"}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => removeItem(it._key)}
                                                        className="shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                                        title="Hapus item"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>

                                                {/* Dua panel: RAB & COST */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-200">
                                                    {/* Panel RAB (Klien) */}
                                                    <div className="bg-blue-50/40 p-3">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                                                <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                                                                    Total Perkiraan Biaya
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="block text-[11px] text-slate-600 mb-0.5">
                                                                    Jumlah
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    value={it.quantity as number}
                                                                    step="0.01"
                                                                    min="0"
                                                                    onChange={(e) =>
                                                                        updateItem(it._key, {
                                                                            quantity: parseFloat(e.target.value) || 0,
                                                                        })
                                                                    }
                                                                    className="w-full border-2 border-blue-200 focus:border-blue-500 outline-none rounded px-2 py-1.5 text-right text-sm bg-white"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[11px] text-slate-600 mb-0.5">
                                                                    Harga
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    value={it.priceRab as number}
                                                                    step="1"
                                                                    min="0"
                                                                    onChange={(e) =>
                                                                        updateItem(it._key, {
                                                                            priceRab: parseFloat(e.target.value) || 0,
                                                                        })
                                                                    }
                                                                    className="w-full border-2 border-blue-200 focus:border-blue-500 outline-none rounded px-2 py-1.5 text-right font-mono text-sm bg-white"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 flex items-baseline justify-between">
                                                            <span className="text-[11px] text-slate-600">
                                                                Subtotal
                                                            </span>
                                                            <span className="font-mono font-bold text-blue-800">
                                                                {fmtRp(subRab)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Panel COST (Internal) */}
                                                    <div className="bg-amber-50/40 p-3">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                                                <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                                                                    Biaya Internal (Cost)
                                                                </span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setCalcOpenKey(it._key)}
                                                                title="Kalkulator: hitung qty dari org × hari × jam × kali"
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-blue-300 bg-white text-blue-700 text-[11px] font-semibold hover:bg-blue-50"
                                                            >
                                                                <Calculator className="h-3 w-3" />
                                                                Hitung
                                                            </button>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="block text-[11px] text-slate-600 mb-0.5">
                                                                    Jumlah
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    value={(it.quantityCost ?? it.quantity) as number}
                                                                    step="0.01"
                                                                    min="0"
                                                                    onChange={(e) =>
                                                                        updateItem(it._key, {
                                                                            quantityCost: parseFloat(e.target.value) || 0,
                                                                        })
                                                                    }
                                                                    className="w-full border-2 border-amber-200 focus:border-amber-500 outline-none rounded px-2 py-1.5 text-right text-sm bg-white"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[11px] text-slate-600 mb-0.5">
                                                                    Harga
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    value={it.priceCost as number}
                                                                    step="1"
                                                                    min="0"
                                                                    onChange={(e) =>
                                                                        updateItem(it._key, {
                                                                            priceCost: parseFloat(e.target.value) || 0,
                                                                        })
                                                                    }
                                                                    placeholder={Number(it.priceRab) > 0 ? "Belum diisi" : "0"}
                                                                    className={`w-full border-2 outline-none rounded px-2 py-1.5 text-right font-mono text-sm bg-white ${Number(it.priceCost) === 0 && Number(it.priceRab) > 0
                                                                        ? "border-amber-400 focus:border-amber-600 ring-1 ring-amber-200"
                                                                        : "border-amber-200 focus:border-amber-500"
                                                                        }`}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 flex items-baseline justify-between">
                                                            <span className="text-[11px] text-slate-600">
                                                                Subtotal
                                                            </span>
                                                            <span className="font-mono font-bold text-amber-800">
                                                                {fmtRp(subCost)}
                                                            </span>
                                                        </div>
                                                        {Number(it.priceCost) === 0 && Number(it.priceRab) > 0 && (
                                                            <div className="mt-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-1 italic">
                                                                ⚠ Real Cost belum diisi — margin item ini terhitung 100%. Update saat sudah tahu modal aktualnya.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Footer: notes (kalau ada) + selisih */}
                                                {(it.notes || hasDesc) && (
                                                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white border-t">
                                                        {it.notes ? (
                                                            <div className="text-[11px] text-slate-500 italic flex-1 min-w-0 truncate">
                                                                📝 {it.notes}
                                                            </div>
                                                        ) : (
                                                            <span />
                                                        )}
                                                        <div
                                                            className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                                                                untung
                                                                    ? "bg-emerald-100 text-emerald-700"
                                                                    : "bg-red-100 text-red-700"
                                                            }`}
                                                        >
                                                            {untung ? "Untung" : "Rugi"}
                                                            <span className="font-mono">
                                                                {fmtRp(Math.abs(selisih))}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Tombol tambah item di bawah list — supaya tidak perlu scroll ke header kategori */}
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        <button
                                            onClick={() => addItem(cat.id)}
                                            className="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-blue-300 bg-blue-50/40 hover:bg-blue-100/60 text-blue-700 rounded-xl font-semibold text-sm transition"
                                        >
                                            <Plus className="h-5 w-5" />
                                            Tambah Item ke {cat.name}
                                        </button>
                                        <button
                                            onClick={() => setShowPicker(cat.id)}
                                            className="inline-flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-sm transition"
                                            title="Pilih dari katalog produk"
                                        >
                                            <Package className="h-5 w-5" />
                                            Dari Katalog
                                        </button>
                                    </div>

                                    {/* Render kalkulator sekali di luar loop biar tidak berkali-kali */}
                                    {calcOpenKey && (() => {
                                        const target = list.find((x) => x._key === calcOpenKey);
                                        if (!target) return null;
                                        return (
                                            <MultiplierCalculator
                                                initialDescription={target.description}
                                                initialUnitPrice={
                                                    Number(target.priceCost) ||
                                                    Number(target.priceRab) ||
                                                    0
                                                }
                                                onApply={(r) => applyCalc(target._key, r)}
                                                onCancel={() => setCalcOpenKey(null)}
                                            />
                                        );
                                    })()}
                                </div>
                            )}

                            {!isCollapsed && list.length === 0 && (
                                <div className="p-4 text-center text-xs text-muted-foreground">
                                    Belum ada item. Klik <b>+ Item</b> untuk menambahkan.
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Pendapatan & Saldo */}
            <div className="border rounded-lg p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <h3 className="font-semibold text-sm">Pendapatan</h3>
                    <Row label="Uang Muka (DP)">
                        <input
                            type="number"
                            value={dpAmount}
                            step="1"
                            min="0"
                            onChange={(e) => setDpAmount(parseFloat(e.target.value) || 0)}
                            className="w-full border rounded px-2 py-1 text-right font-mono text-sm"
                        />
                    </Row>
                    <Row label="Pelunasan">
                        <input
                            type="number"
                            value={pelunasan}
                            step="1"
                            min="0"
                            onChange={(e) => setPelunasan(parseFloat(e.target.value) || 0)}
                            className="w-full border rounded px-2 py-1 text-right font-mono text-sm"
                        />
                    </Row>
                    <Row label="Pendapatan Lain">
                        <input
                            type="number"
                            value={incomeOther}
                            step="1"
                            min="0"
                            onChange={(e) => setIncomeOther(parseFloat(e.target.value) || 0)}
                            className="w-full border rounded px-2 py-1 text-right font-mono text-sm"
                        />
                    </Row>
                    <div className="flex items-center justify-between pt-2 border-t font-semibold">
                        <span>Total Pendapatan</span>
                        <span className="font-mono">{fmtRp(totalIncome)}</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="font-semibold text-sm">Ringkasan</h3>

                    {/* Banner peringatan kalau real cost belum diisi */}
                    {(isMarginFake || missingCostCount > 0) && (
                        <div className={`rounded-md border-2 p-2.5 text-xs ${isMarginFake
                            ? "bg-amber-50 border-amber-300 text-amber-900"
                            : "bg-blue-50 border-blue-200 text-blue-900"
                            }`}>
                            {isMarginFake ? (
                                <>
                                    <div className="font-bold inline-flex items-center gap-1.5">
                                        ⚠️ Real Cost belum diisi sama sekali
                                    </div>
                                    <p className="text-[11px] mt-1">
                                        Margin tampil 100% karena <b>Total COST = Rp 0</b>. Ini bukan untung beneran — kamu belum input harga modal item-item. Isi kolom <b>"Harga COST"</b> di tiap item supaya margin akurat.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <div className="font-semibold inline-flex items-center gap-1.5">
                                        💡 {missingCostCount} dari {items.length} item belum ada Real Cost
                                    </div>
                                    <p className="text-[11px] mt-0.5">
                                        Margin sebagian item dihitung 100% karena cost belum diisi. Margin total <b>kemungkinan over-estimate</b> sampai cost lengkap.
                                    </p>
                                </>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                        <span>Total Perkiraan Biaya</span>
                        <span className="font-mono">{fmtRp(totalRab)}</span>
                    </div>
                    {inventoryItemCount > 0 ? (
                        <>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Cost Operasional</span>
                                <span className="font-mono text-muted-foreground">{fmtRp(costOperational)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-violet-700 inline-flex items-center gap-1">
                                    📦 Cost Inventaris
                                    <span className="text-[10px] text-muted-foreground">({inventoryItemCount} item)</span>
                                </span>
                                <span className="font-mono text-violet-700">{fmtRp(costInventory)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm border-t pt-2">
                                <span className="text-muted-foreground">Total COST</span>
                                <span className="font-mono text-muted-foreground">{fmtRp(totalCost)}</span>
                            </div>
                            <div
                                className={`flex items-center justify-between text-base font-bold border-t pt-2 ${
                                    operationalProfit >= 0 ? "text-green-700" : "text-red-700"
                                }`}
                            >
                                <span>💰 Untung Operasional</span>
                                <span className="font-mono">{fmtRp(operationalProfit)}</span>
                            </div>
                            <div
                                className={`flex items-center justify-between text-xs font-medium ${
                                    totalSelisih >= 0 ? "text-green-600" : "text-red-600"
                                }`}
                                title="Margin total termasuk cost inventaris"
                            >
                                <span>📊 Margin Bersih (incl inventaris)</span>
                                <span className="font-mono">{fmtRp(totalSelisih)}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground italic bg-violet-50 p-2 rounded border border-violet-100">
                                💡 Untung Operasional lebih representatif untuk evaluasi event ini, karena cost inventaris jadi aset perusahaan (bisa dipakai event berikutnya).
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Total COST (Biaya Riil)</span>
                                <span className="font-mono text-muted-foreground">{fmtRp(totalCost)}</span>
                            </div>
                            <div
                                className={`flex items-center justify-between text-sm font-semibold ${
                                    totalSelisih >= 0 ? "text-green-600" : "text-red-600"
                                }`}
                            >
                                <span>Selisih (Margin)</span>
                                <span className="font-mono">{fmtRp(totalSelisih)}</span>
                            </div>
                        </>
                    )}
                    <div
                        className={`flex items-center justify-between pt-2 border-t text-base font-bold ${
                            saldo >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                    >
                        <span>Saldo (Pendapatan − COST)</span>
                        <span className="font-mono">{fmtRp(saldo)}</span>
                    </div>
                </div>
            </div>

            {/* Server summary (opsional untuk verifikasi) */}
            {summary && (
                <div className="text-xs text-muted-foreground text-right">
                    Server summary: {summary.categories.length} kategori · Total RAB {fmtRp(summary.totals.totalRab)} ·
                    Saldo {fmtRp(summary.saldo)}
                </div>
            )}

            {/* Pengadaan Inventaris — track items tagged isInventory */}
            {!isNaN(id) && <InventoryAcquisitionsSection rabPlanId={id} />}

            {/* ─── Status Laporan Project — admin tandai laporan lengkap ─── */}
            <div className={`rounded-xl border-2 p-4 sm:p-5 ${reportCompletedAt
                ? "border-violet-300 bg-gradient-to-br from-violet-50 to-violet-100/60 dark:from-violet-950/30 dark:to-violet-950/10 dark:border-violet-700"
                : "border-slate-200 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800/40 dark:border-slate-700"
                }`}>
                <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className={`shrink-0 rounded-full p-2.5 ${reportCompletedAt
                            ? "bg-violet-200 text-violet-800 dark:bg-violet-800/40 dark:text-violet-200"
                            : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                            }`}>
                            {reportCompletedAt ? (
                                <span className="text-xl leading-none">📄</span>
                            ) : (
                                <span className="text-xl leading-none">📋</span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                Status Laporan Project
                            </div>
                            <h3 className="text-base sm:text-lg font-bold mt-0.5">
                                {reportCompletedAt ? (
                                    <span className="text-violet-700 dark:text-violet-300 inline-flex items-center gap-1.5">
                                        ✅ Laporan Lengkap
                                    </span>
                                ) : (
                                    <span className="text-slate-700 dark:text-slate-200">
                                        Laporan Belum Lengkap
                                    </span>
                                )}
                            </h3>
                            {reportCompletedAt ? (
                                <p className="text-[11px] sm:text-xs text-violet-700/80 dark:text-violet-300/80 mt-0.5">
                                    Ditandai lengkap pada <b>{new Date(reportCompletedAt).toLocaleString("id-ID", {
                                        day: "numeric", month: "long", year: "numeric",
                                        hour: "2-digit", minute: "2-digit",
                                    })}</b>
                                </p>
                            ) : (
                                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                                    Klik tombol di samping kalau semua data laporan RAB ini sudah selesai diinput
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="shrink-0 w-full sm:w-auto">
                        {reportCompletedAt ? (
                            <button
                                type="button"
                                onClick={() => {
                                    if (window.confirm("Batalkan tanda 'Laporan Lengkap'? Status RAB akan kembali sesuai tanggal event.")) {
                                        reportMut.mutate(false);
                                    }
                                }}
                                disabled={reportMut.isPending}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-violet-300 bg-white text-violet-700 hover:bg-violet-50 text-sm font-semibold disabled:opacity-50 transition"
                            >
                                {reportMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                ↩️ Batalkan Tanda Lengkap
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    if (window.confirm("Tandai laporan RAB ini sebagai LENGKAP?\n\nStatus akan berubah menjadi 'Laporan Lengkap'. Masih bisa dibatalkan kapan saja.")) {
                                        reportMut.mutate(true);
                                    }
                                }}
                                disabled={reportMut.isPending}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-br from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white text-sm font-bold disabled:opacity-50 shadow-md hover:shadow-lg transition"
                            >
                                {reportMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>✅</span>}
                                Tandai Laporan Lengkap
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal generate penawaran */}
            {showGenModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
                    <div className="bg-background rounded-t-lg sm:rounded-lg shadow-xl w-full max-w-lg p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
                        <h2 className="text-lg font-semibold">Generate Penawaran dari RAB</h2>
                        <p className="text-xs text-muted-foreground">
                            Hanya kolom <b>Harga Perkiraan</b> yang disalin ke penawaran. Harga COST tetap internal.
                        </p>

                        <div>
                            <label className="text-sm font-medium block mb-1">Jenis Penawaran</label>
                            <select
                                value={genForm.quotationVariant}
                                onChange={(e) =>
                                    setGenForm({
                                        ...genForm,
                                        quotationVariant: e.target.value as any,
                                    })
                                }
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            >
                                <option value="SEWA">Sewa Perlengkapan Event</option>
                                <option value="PENGADAAN_BOOTH">Pengadaan Booth Special Design</option>
                            </select>
                        </div>

                        {/* Pick dari database pelanggan — auto-fill semua field klien di bawah */}
                        <div className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-primary inline-flex items-center gap-1.5">
                                        <Users className="h-3.5 w-3.5" />
                                        Auto-isi dari Data Pelanggan
                                    </div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5">
                                        Klik untuk pilih klien terdaftar atau tambah baru — semua kolom di bawah akan terisi otomatis
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowCustomerPicker(true)}
                                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
                                >
                                    <Search className="h-3.5 w-3.5" />
                                    Pilih Klien
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium block mb-1">Nama Klien</label>
                                <input
                                    type="text"
                                    value={genForm.clientName}
                                    onChange={(e) => setGenForm({ ...genForm, clientName: e.target.value })}
                                    className="w-full border rounded-md px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium block mb-1">Perusahaan</label>
                                <input
                                    type="text"
                                    value={genForm.clientCompany}
                                    onChange={(e) => setGenForm({ ...genForm, clientCompany: e.target.value })}
                                    className="w-full border rounded-md px-3 py-2 text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium block mb-1">Alamat</label>
                            <input
                                type="text"
                                value={genForm.clientAddress}
                                onChange={(e) => setGenForm({ ...genForm, clientAddress: e.target.value })}
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-sm font-medium block mb-1">Telp</label>
                                <input
                                    type="text"
                                    value={genForm.clientPhone}
                                    onChange={(e) => setGenForm({ ...genForm, clientPhone: e.target.value })}
                                    className="w-full border rounded-md px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium block mb-1">Email</label>
                                <input
                                    type="email"
                                    value={genForm.clientEmail}
                                    onChange={(e) => setGenForm({ ...genForm, clientEmail: e.target.value })}
                                    className="w-full border rounded-md px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium block mb-1">DP %</label>
                                <input
                                    type="number"
                                    value={genForm.dpPercent}
                                    min="0"
                                    max="100"
                                    onChange={(e) =>
                                        setGenForm({
                                            ...genForm,
                                            dpPercent: parseFloat(e.target.value) || 0,
                                        })
                                    }
                                    className="w-full border rounded-md px-3 py-2 text-sm"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setShowGenModal(false)}
                                className="px-4 py-2 text-sm border rounded-md hover:bg-muted"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => genMut.mutate()}
                                disabled={genMut.isPending || !genForm.clientName.trim()}
                                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
                            >
                                {genMut.isPending ? "Generating…" : "Generate"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPicker !== null && (
                <ProductPickerModal
                    categoryName={categoryLabel(showPicker)}
                    onClose={() => setShowPicker(null)}
                    onPick={(v) => {
                        addFromVariant(showPicker, v);
                        setShowPicker(null);
                    }}
                />
            )}

            {showGenCashflowModal && rab && summary && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowGenCashflowModal(false)}>
                    <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-5 border border-border" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                            💸 Generate Cashflow dari RAB
                        </h2>
                        <p className="text-xs text-muted-foreground mb-4">
                            Bikin entry expense di Cashflow secara otomatis dari item-item RAB <strong>{rab.code}</strong>.
                        </p>

                        <div className="bg-muted/30 rounded p-3 text-sm mb-4 space-y-1">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Cost RAB:</span>
                                <strong className="text-red-600">Rp {summary.totals.totalCost.toLocaleString("id-ID")}</strong>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Jumlah Item:</span>
                                <span>{rab.items.length} item</span>
                            </div>
                        </div>

                        <div className="space-y-2 mb-4">
                            <label className="text-sm font-medium">Mode Generate</label>
                            <label className="flex items-start gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted/50">
                                <input
                                    type="radio"
                                    name="genmode"
                                    checked={genCashflowMode === 'detail'}
                                    onChange={() => setGenCashflowMode('detail')}
                                    className="mt-0.5"
                                />
                                <div>
                                    <div className="text-sm font-medium">Detail (1 entry per item RAB)</div>
                                    <div className="text-xs text-muted-foreground">Cashflow detail per item — bisa banyak entry. Cocok kalau mau audit per material.</div>
                                </div>
                            </label>
                            <label className="flex items-start gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted/50">
                                <input
                                    type="radio"
                                    name="genmode"
                                    checked={genCashflowMode === 'category'}
                                    onChange={() => setGenCashflowMode('category')}
                                    className="mt-0.5"
                                />
                                <div>
                                    <div className="text-sm font-medium">Kategori (1 entry per RabCategory)</div>
                                    <div className="text-xs text-muted-foreground">Total per kategori (Material / Jasa / Transport / dll). Cashflow lebih ringkas.</div>
                                </div>
                            </label>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800 mb-4">
                            ⚠️ Entry akan otomatis ter-tag ke RAB ini + event terkait (kalau ada). Mereka di-flag <code>excludeFromShift</code> supaya tidak masuk laporan kasir POS.
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t">
                            <button
                                onClick={() => setShowGenCashflowModal(false)}
                                className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => genCashflowMut.mutate()}
                                disabled={genCashflowMut.isPending}
                                className="px-3 py-1.5 text-sm rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                            >
                                {genCashflowMut.isPending ? "Generating..." : "Generate"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSaveProductModal && rab && summary && (
                <SaveAsProductModal
                    rabId={id}
                    defaultName={title || rab.title}
                    totalRab={summary.totals.totalRab}
                    totalCost={summary.totals.totalCost}
                    onClose={() => setShowSaveProductModal(false)}
                    onSaved={(res) => {
                        setShowSaveProductModal(false);
                        toast.success(`Produk "${res.product.name}" dibuat (variant ${res.variant.sku})`);
                        qc.invalidateQueries({ queryKey: ["products"] });
                    }}
                />
            )}

            {showCustomerPicker && (
                <CustomerPickerModal
                    onClose={() => setShowCustomerPicker(false)}
                    onPick={(c) => {
                        setCustomerId(c.id);
                        setGenForm((f) => ({
                            ...f,
                            clientName: c.companyPIC || c.name || f.clientName,
                            clientCompany: c.companyName || f.clientCompany,
                            clientAddress: c.address || f.clientAddress,
                            clientPhone: c.phone || f.clientPhone,
                            clientEmail: c.email || f.clientEmail,
                        }));
                        setShowCustomerPicker(false);
                    }}
                />
            )}

            {/* FAB tambah cepat + simpan — tetap di pojok layar saat scroll */}
            <FabAddItem
                categories={visibleCategories}
                lastUsedCatId={lastUsedCatId}
                onAdd={(catId) => {
                    addItem(catId);
                    // setelah tambah, scroll ke bawah area kategori-nya
                    requestAnimationFrame(() => {
                        const el = document.getElementById(`rab-cat-${catId}`);
                        el?.scrollIntoView({ behavior: "smooth", block: "end" });
                    });
                }}
                onSave={() => saveMut.mutate()}
                isSaving={saveMut.isPending}
            />
        </div>
    );
}

function FabAddItem({
    categories,
    lastUsedCatId,
    onAdd,
    onSave,
    isSaving,
}: {
    categories: { id: number; name: string }[];
    lastUsedCatId: number | null;
    onAdd: (catId: number) => void;
    onSave?: () => void;
    isSaving?: boolean;
}) {
    const [open, setOpen] = useState(false);
    if (categories.length === 0) return null;
    const lastCat = categories.find((c) => c.id === lastUsedCatId) ?? categories[0];

    return (
        <>
            {/* Backdrop saat menu kategori terbuka */}
            {open && (
                <div
                    className="fixed inset-0 z-[80] bg-black/30"
                    onClick={() => setOpen(false)}
                />
            )}
            <div className="fixed bottom-5 right-5 z-[90] flex flex-col items-end gap-2">
                {/* Daftar kategori (muncul saat menu open) */}
                {open && (
                    <div className="bg-white border-2 border-slate-200 rounded-xl shadow-2xl p-2 max-h-[60vh] overflow-y-auto w-[260px] animate-in fade-in slide-in-from-bottom-2">
                        <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            Pilih Kategori
                        </div>
                        {categories.map((c) => (
                            <button
                                key={c.id}
                                onClick={() => {
                                    onAdd(c.id);
                                    setOpen(false);
                                }}
                                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 text-sm font-medium text-slate-800 flex items-center gap-2"
                            >
                                <Plus className="h-4 w-4 text-blue-600" />
                                {c.name}
                            </button>
                        ))}
                    </div>
                )}
                {/* Row tombol: [Save] + [Add | ▾] */}
                <div className="flex items-center gap-2">
                    {/* Save FAB (icon-only) — di kiri tombol Tambah */}
                    {onSave && (
                        <button
                            onClick={onSave}
                            disabled={isSaving}
                            title="Simpan RAB (Ctrl+S)"
                            aria-label="Simpan RAB (Ctrl+S)"
                            className="w-12 h-12 rounded-full shadow-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        >
                            {isSaving ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Save className="h-5 w-5" />
                            )}
                        </button>
                    )}
                    {/* Tombol utama: split — klik kiri tambah ke last category, klik kanan buka menu */}
                    <div className="flex items-stretch shadow-2xl rounded-full overflow-hidden">
                        <button
                            onClick={() => onAdd(lastCat.id)}
                            title={`Tambah item ke ${lastCat.name}`}
                            aria-label={`Tambah item ke ${lastCat.name}`}
                            className="flex items-center justify-center w-12 h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white"
                        >
                            <Plus className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => setOpen((v) => !v)}
                            title="Pilih kategori lain"
                            aria-label="Pilih kategori lain"
                            className="px-2 h-12 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white border-l border-blue-500 flex items-center justify-center"
                        >
                            <ChevronDown
                                className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
                            />
                        </button>
                    </div>
                </div>
                {/* Hint kecil di atas tombol — kategori terakhir */}
                {!open && (
                    <div className="bg-slate-900/90 text-white text-[10px] px-2 py-0.5 rounded-md hidden md:block">
                        ke: <b>{lastCat.name}</b>
                    </div>
                )}
            </div>
        </>
    );
}

function UraianAutocomplete({
    value,
    onChange,
    onPick,
    onPickLoose,
}: {
    value: string;
    onChange: (v: string) => void;
    onPick: (v: BoothVariant) => void;
    onPickLoose?: (li: RabLooseItem) => void;
}) {
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
    const [debounced, setDebounced] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    const { data: variants } = useQuery({
        queryKey: ["booth-variants", "ALL"],
        queryFn: () => getBoothVariants(undefined),
    });

    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), 250);
        return () => clearTimeout(t);
    }, [value]);

    const { data: looseSuggestions = [] } = useQuery<RabLooseItem[]>({
        queryKey: ["rab-loose-item-suggestions", debounced],
        queryFn: () => getRabLooseItemSuggestions(debounced.trim()),
        enabled: open,
        staleTime: 30_000,
    });

    const q = value.trim().toLowerCase();
    const variantMatches = useMemo(() => {
        const list = variants ?? [];
        if (!q) return list.slice(0, 8);
        return list
            .filter((v) => {
                const hay = `${v.product.name} ${v.variantName} ${v.sku ?? ""} ${v.size ?? ""}`.toLowerCase();
                return hay.includes(q);
            })
            .slice(0, 8);
    }, [variants, q]);

    const looseMatches = useMemo(() => looseSuggestions.slice(0, 8), [looseSuggestions]);

    type Combined =
        | { kind: "variant"; data: BoothVariant }
        | { kind: "loose"; data: RabLooseItem };
    const matches: Combined[] = useMemo(() => {
        const v: Combined[] = variantMatches.map((d) => ({ kind: "variant", data: d }));
        const l: Combined[] = looseMatches.map((d) => ({ kind: "loose", data: d }));
        return [...l, ...v].slice(0, 12);
    }, [variantMatches, looseMatches]);

    const recalcRect = () => {
        const el = inputRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setRect({ left: r.left, top: r.bottom, width: r.width });
    };

    useEffect(() => {
        if (!open) return;
        recalcRect();
        const onScroll = () => recalcRect();
        window.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("resize", onScroll);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (inputRef.current?.contains(e.target as Node)) return;
            const target = e.target as HTMLElement;
            if (target.closest("[data-uraian-dropdown]")) return;
            setOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open]);

    useEffect(() => {
        setHighlight(0);
    }, [q]);

    const pick = (v: BoothVariant) => {
        onPick(v);
        setOpen(false);
    };
    const pickLoose = (li: RabLooseItem) => {
        onPickLoose?.(li);
        setOpen(false);
    };
    const pickAt = (i: number) => {
        const m = matches[i];
        if (!m) return;
        if (m.kind === "variant") pick(m.data);
        else pickLoose(m.data);
    };

    const showDropdown = open && matches.length > 0 && rect !== null;

    return (
        <>
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={(e) => {
                    if (!showDropdown) return;
                    if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setHighlight((h) => Math.min(h + 1, matches.length - 1));
                    } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setHighlight((h) => Math.max(h - 1, 0));
                    } else if (e.key === "Enter" || e.key === "Tab") {
                        // Tab juga commit pilihan supaya user bisa lanjut ke field berikutnya tanpa Shift
                        e.preventDefault();
                        pickAt(highlight);
                    } else if (e.key === "Escape") {
                        setOpen(false);
                    } else if (/^[1-9]$/.test(e.key) && (e.altKey || e.ctrlKey)) {
                        // Quick-pick: Alt+1..9 atau Ctrl+1..9 → langsung pilih item ke-N
                        const idx = parseInt(e.key, 10) - 1;
                        if (idx < matches.length) {
                            e.preventDefault();
                            pickAt(idx);
                        }
                    }
                }}
                placeholder="Uraian item…"
                className="w-full border rounded px-2 py-1"
                autoComplete="off"
            />
            {showDropdown && (
                <div
                    data-uraian-dropdown
                    style={{
                        position: "fixed",
                        left: rect!.left,
                        top: rect!.top + 2,
                        width: Math.max(rect!.width, 280),
                        zIndex: 60,
                    }}
                    className="bg-background border rounded-md shadow-lg max-h-72 overflow-y-auto"
                >
                    {matches.map((m, i) => {
                        const shortcutBadge = i < 9 ? (
                            <kbd
                                className="hidden sm:inline-flex items-center justify-center w-5 h-5 rounded border border-border bg-muted text-[10px] font-mono font-semibold text-muted-foreground shrink-0"
                                title={`Alt+${i + 1} untuk pilih cepat`}
                            >
                                {i + 1}
                            </kbd>
                        ) : null;
                        if (m.kind === "variant") {
                            const v = m.data;
                            return (
                                <button
                                    key={`v-${v.id}`}
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); pick(v); }}
                                    onMouseEnter={() => setHighlight(i)}
                                    className={`w-full text-left px-2 py-1.5 flex items-center justify-between gap-2 text-xs ${
                                        i === highlight ? "bg-muted" : "hover:bg-muted/50"
                                    }`}
                                >
                                    {shortcutBadge}
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium truncate">
                                            {v.product.name}
                                            {v.variantName ? ` — ${v.variantName}` : ""}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground flex gap-2">
                                            <span className="px-1 rounded bg-blue-100 text-blue-700">katalog</span>
                                            {v.sku && <span className="font-mono">{v.sku}</span>}
                                            {v.size && <span>· {v.size}</span>}
                                            {v.boothProductType && <span>· {v.boothProductType}</span>}
                                        </div>
                                    </div>
                                    <div className="font-mono shrink-0">
                                        Rp {Number(v.price).toLocaleString("id-ID")}
                                    </div>
                                </button>
                            );
                        }
                        const li = m.data;
                        return (
                            <button
                                key={`l-${li.id}`}
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); pickLoose(li); }}
                                onMouseEnter={() => setHighlight(i)}
                                className={`w-full text-left px-2 py-1.5 flex items-center justify-between gap-2 text-xs ${
                                    i === highlight ? "bg-muted" : "hover:bg-muted/50"
                                }`}
                            >
                                {shortcutBadge}
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium truncate">{li.description}</div>
                                    <div className="text-[10px] text-muted-foreground flex gap-2">
                                        <span className="px-1 rounded bg-amber-100 text-amber-700">item lepas</span>
                                        {li.unit && <span>{li.unit}</span>}
                                        <span>· {li.usageCount}× pakai</span>
                                    </div>
                                </div>
                                <div className="font-mono shrink-0">
                                    Rp {Math.round(parseFloat(li.lastPriceRab) || 0).toLocaleString("id-ID")}
                                </div>
                            </button>
                        );
                    })}
                    <div className="sticky bottom-0 px-2 py-1.5 border-t bg-muted/40 text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                            <kbd className="px-1 rounded border bg-background font-mono">↵</kbd>
                            <kbd className="px-1 rounded border bg-background font-mono">Tab</kbd>
                            pilih
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <kbd className="px-1 rounded border bg-background font-mono">↑↓</kbd>
                            navigasi
                        </span>
                        <span className="hidden sm:inline-flex items-center gap-1">
                            <kbd className="px-1 rounded border bg-background font-mono">Alt+1-9</kbd>
                            pilih cepat
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <kbd className="px-1 rounded border bg-background font-mono">Esc</kbd>
                            tutup
                        </span>
                    </div>
                </div>
            )}
        </>
    );
}

function ProductPickerModal({
    categoryName,
    onClose,
    onPick,
}: {
    categoryName: string;
    onClose: () => void;
    onPick: (v: BoothVariant) => void;
}) {
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<"ALL" | "SEWA" | "PENGADAAN">("ALL");

    const { data: variants, isLoading } = useQuery({
        queryKey: ["booth-variants", typeFilter],
        queryFn: () =>
            getBoothVariants(typeFilter === "ALL" ? undefined : typeFilter),
    });

    const filtered = useMemo(() => {
        const list = variants ?? [];
        const q = query.trim().toLowerCase();
        if (!q) return list;
        return list.filter((v) => {
            const hay = `${v.product.name} ${v.variantName} ${v.sku ?? ""} ${v.size ?? ""}`.toLowerCase();
            return hay.includes(q);
        });
    }, [variants, query]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex items-center justify-between">
                    <h2 className="text-base font-semibold">
                        Pilih dari Katalog — {categoryName}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-4 border-b flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Cari nama produk / SKU / ukuran…"
                            className="w-full border rounded-md pl-8 pr-3 py-2 text-sm"
                            autoFocus
                        />
                    </div>
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as any)}
                        className="border rounded-md px-2 py-2 text-sm"
                    >
                        <option value="ALL">Semua</option>
                        <option value="SEWA">Sewa</option>
                        <option value="PENGADAAN">Pengadaan</option>
                    </select>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-8 flex justify-center">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            {variants?.length === 0
                                ? "Belum ada variant booth/event di katalog. Jalankan seed atau tandai variant dengan Booth Product Type."
                                : "Tidak ada yang cocok dengan pencarian."}
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {filtered.map((v) => (
                                <li key={v.id}>
                                    <button
                                        onClick={() => onPick(v)}
                                        className="w-full text-left p-3 hover:bg-muted/50 flex items-start justify-between gap-3"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-sm truncate">
                                                {v.product.name}
                                                {v.variantName ? ` — ${v.variantName}` : ""}
                                            </div>
                                            <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                                                {v.sku && <span className="font-mono">{v.sku}</span>}
                                                {v.size && <span>· {v.size}</span>}
                                                {v.boothProductType && (
                                                    <span className="px-1.5 py-0.5 rounded bg-muted font-medium">
                                                        {v.boothProductType}
                                                    </span>
                                                )}
                                                {v.defaultRentalUnit && <span>· {v.defaultRentalUnit}</span>}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-mono text-sm font-medium">
                                                Rp {Number(v.price).toLocaleString("id-ID")}
                                            </div>
                                            {Number(v.hpp) > 0 && (
                                                <div className="font-mono text-[10px] text-muted-foreground">
                                                    HPP Rp {Number(v.hpp).toLocaleString("id-ID")}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
            {children}
        </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-sm flex-1">{label}</span>
            <div className="w-[180px]">{children}</div>
        </div>
    );
}

function SaveAsProductModal({
    rabId,
    defaultName,
    totalRab,
    totalCost,
    onClose,
    onSaved,
}: {
    rabId: number;
    defaultName: string;
    totalRab: number;
    totalCost: number;
    onClose: () => void;
    onSaved: (res: { product: { id: number; name: string; imageUrl: string | null }; variant: { id: number; sku: string; price: string; hpp: string } }) => void;
}) {
    const [name, setName] = useState(defaultName);
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [unitId, setUnitId] = useState<number | null>(null);
    const [boothType, setBoothType] = useState<"SEWA" | "PENGADAAN">("SEWA");
    const [rentalUnit, setRentalUnit] = useState("unit/hari");
    const [description, setDescription] = useState("");
    const [priceOverride, setPriceOverride] = useState<number | "">("");
    const [hppOverride, setHppOverride] = useState<number | "">("");
    const [image, setImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const { data: categories } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
    });
    const { data: units } = useQuery({
        queryKey: ["units"],
        queryFn: getUnits,
    });

    const mut = useMutation({
        mutationFn: () =>
            saveRabAsProduct(rabId, {
                name,
                categoryId: categoryId!,
                unitId: unitId!,
                boothProductType: boothType,
                defaultRentalUnit: rentalUnit || undefined,
                description: description || undefined,
                priceOverride: priceOverride === "" ? undefined : Number(priceOverride),
                hppOverride: hppOverride === "" ? undefined : Number(hppOverride),
                image,
            }),
        onSuccess: (res: any) => onSaved(res),
        onError: (err: any) =>
            alert(`Gagal simpan produk: ${err?.response?.data?.message || err?.message || "error"}`),
    });

    const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] || null;
        setImage(f);
        if (f) {
            const reader = new FileReader();
            reader.onload = (ev) => setImagePreview(ev.target?.result as string);
            reader.readAsDataURL(f);
        } else {
            setImagePreview(null);
        }
    };

    const canSubmit = name.trim() && categoryId && unitId && !mut.isPending;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b flex items-center justify-between">
                    <h2 className="text-base font-semibold">Simpan RAB sebagai Produk</h2>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto space-y-3">
                    <div className="bg-muted/30 border rounded p-2 text-xs grid grid-cols-2 gap-2">
                        <div>
                            Total Perkiraan Biaya:
                            <b className="font-mono ml-1">{fmtRp(totalRab)}</b>
                        </div>
                        <div>
                            Total COST (HPP):
                            <b className="font-mono ml-1">{fmtRp(totalCost)}</b>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium block mb-1">Nama Produk *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full border rounded-md px-3 py-2 text-sm"
                            placeholder="Contoh: Booth Custom 4x4 Event Trade Expo"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium block mb-1">Kategori *</label>
                            <select
                                value={categoryId ?? ""}
                                onChange={(e) =>
                                    setCategoryId(e.target.value ? parseInt(e.target.value) : null)
                                }
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            >
                                <option value="">— Pilih —</option>
                                {(categories ?? []).map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-1">Satuan *</label>
                            <select
                                value={unitId ?? ""}
                                onChange={(e) =>
                                    setUnitId(e.target.value ? parseInt(e.target.value) : null)
                                }
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            >
                                <option value="">— Pilih —</option>
                                {(units ?? []).map((u: any) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium block mb-1">Jenis Booth</label>
                            <select
                                value={boothType}
                                onChange={(e) => setBoothType(e.target.value as any)}
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            >
                                <option value="SEWA">Sewa</option>
                                <option value="PENGADAAN">Pengadaan</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-1">Unit Sewa</label>
                            <input
                                type="text"
                                value={rentalUnit}
                                onChange={(e) => setRentalUnit(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm"
                                placeholder="unit/hari, m²/hari, set, …"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium block mb-1">
                                Harga Jual (Rp)
                                <span className="text-xs text-muted-foreground ml-1 font-normal">
                                    default: Total RAB
                                </span>
                            </label>
                            <input
                                type="number"
                                value={priceOverride}
                                onChange={(e) =>
                                    setPriceOverride(e.target.value === "" ? "" : parseFloat(e.target.value))
                                }
                                className="w-full border rounded-md px-3 py-2 text-sm font-mono"
                                placeholder={String(totalRab)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-1">
                                HPP (Rp)
                                <span className="text-xs text-muted-foreground ml-1 font-normal">
                                    default: Total COST
                                </span>
                            </label>
                            <input
                                type="number"
                                value={hppOverride}
                                onChange={(e) =>
                                    setHppOverride(e.target.value === "" ? "" : parseFloat(e.target.value))
                                }
                                className="w-full border rounded-md px-3 py-2 text-sm font-mono"
                                placeholder={String(totalCost)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium block mb-1">Deskripsi</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="w-full border rounded-md px-3 py-2 text-sm"
                            placeholder="Spesifikasi singkat booth…"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium block mb-2">
                            Gambar Booth
                        </label>
                        <input
                            id="rab-product-image-input"
                            type="file"
                            accept="image/*"
                            onChange={handleImage}
                            className="hidden"
                        />
                        {!imagePreview ? (
                            <label
                                htmlFor="rab-product-image-input"
                                className="flex flex-col items-center justify-center gap-2 w-full py-8 border-2 border-dashed border-primary/40 rounded-lg bg-primary/5 hover:bg-primary/10 hover:border-primary cursor-pointer transition-colors text-center"
                            >
                                <ImagePlus className="h-8 w-8 text-primary" />
                                <div>
                                    <div className="text-sm font-medium text-foreground">
                                        Klik untuk upload gambar booth
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        JPG / PNG / WEBP · max 5 MB
                                    </div>
                                </div>
                            </label>
                        ) : (
                            <div className="relative group">
                                <img
                                    src={imagePreview}
                                    alt="preview"
                                    className="w-full max-h-56 object-contain border rounded-lg bg-muted/20"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                    <label
                                        htmlFor="rab-product-image-input"
                                        className="flex items-center gap-1 bg-white text-foreground px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer hover:bg-white/90"
                                    >
                                        <ImagePlus className="h-4 w-4" />
                                        Ganti
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setImage(null);
                                            setImagePreview(null);
                                        }}
                                        className="flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-red-700"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Hapus
                                    </button>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                                    <span className="truncate">{image?.name}</span>
                                    <span>{image ? `${(image.size / 1024).toFixed(0)} KB` : ""}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm border rounded-md hover:bg-muted"
                    >
                        Batal
                    </button>
                    <button
                        onClick={() => mut.mutate()}
                        disabled={!canSubmit}
                        className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
                    >
                        {mut.isPending ? "Menyimpan…" : "Simpan Produk"}
                    </button>
                </div>
            </div>
        </div>
    );
}
