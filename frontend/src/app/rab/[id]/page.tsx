"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getRab,
    getRabSummary,
    updateRab,
    generateQuotationFromRab,
    downloadRabXlsx,
    getBoothVariants,
    saveRabAsProduct,
    type RabItem,
    type BoothVariant,
} from "@/lib/api/rab";
import { getRabCategories, type RabCategory } from "@/lib/api/rab-categories";
import { getCustomers } from "@/lib/api/customers";
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
} from "lucide-react";

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

    const [showPicker, setShowPicker] = useState<number | null>(null);
    const [showCustomerPicker, setShowCustomerPicker] = useState(false);
    const [showGenModal, setShowGenModal] = useState(false);
    const [showSaveProductModal, setShowSaveProductModal] = useState(false);
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
        setPeriodStart(rab.periodStart ? rab.periodStart.slice(0, 10) : "");
        setPeriodEnd(rab.periodEnd ? rab.periodEnd.slice(0, 10) : "");
        setNotes(rab.notes || "");
        setDpAmount(parseFloat(rab.dpAmount as any) || 0);
        setPelunasan(parseFloat(rab.pelunasan as any) || 0);
        setIncomeOther(parseFloat(rab.incomeOther as any) || 0);
        setCustomerId(rab.customerId ?? null);
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

    const totalIncome = (dpAmount || 0) + (pelunasan || 0) + (incomeOther || 0);
    const saldo = totalIncome - totalCost;

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
    };

    const updateItem = (key: string, patch: Partial<LocalItem>) => {
        setItems((prev) => prev.map((it) => (it._key === key ? { ...it, ...patch } : it)));
    };

    const removeItem = (key: string) => {
        setItems((prev) => prev.filter((it) => it._key !== key));
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
    };

    // Save
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
                })),
            }),
        onSuccess: () => {
            toast.success("RAB tersimpan");
            qc.invalidateQueries({ queryKey: ["rab", id] });
            qc.invalidateQueries({ queryKey: ["rab-summary", id] });
            qc.invalidateQueries({ queryKey: ["rab-list"] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal simpan"),
    });

    const genMut = useMutation({
        mutationFn: () => generateQuotationFromRab(id, genForm),
        onSuccess: (quo: any) => {
            toast.success(`Penawaran ${quo.invoiceNumber} dibuat`);
            setShowGenModal(false);
            window.location.href = `/penawaran/${quo.id}`;
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal generate"),
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
                </div>
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

            {/* Kategori items */}
            <div className="space-y-3">
                {visibleCategories.map((cat) => {
                    const list = grouped.get(cat.id) || [];
                    const sub = categorySubtotals.get(cat.id) || { rab: 0, cost: 0, selisih: 0 };
                    const isCollapsed = collapsed.has(cat.id);
                    return (
                        <div key={cat.id} className="border rounded-lg overflow-hidden">
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
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-muted/30 text-left">
                                            <tr>
                                                <th className="p-2 font-medium" rowSpan={2}>Uraian</th>
                                                <th className="p-2 font-medium" rowSpan={2}>Satuan</th>
                                                <th
                                                    className="p-2 font-medium text-center border-l bg-blue-50/40"
                                                    colSpan={3}
                                                >
                                                    Sisi RAB (Klien)
                                                </th>
                                                <th
                                                    className="p-2 font-medium text-center border-l bg-amber-50/40"
                                                    colSpan={3}
                                                >
                                                    Sisi COST (Internal)
                                                </th>
                                                <th className="p-2 font-medium text-right border-l" rowSpan={2}>Selisih</th>
                                                <th className="p-2 w-[40px]" rowSpan={2}></th>
                                            </tr>
                                            <tr>
                                                <th className="p-2 font-medium w-[70px] text-right border-l bg-blue-50/40">Qty</th>
                                                <th className="p-2 font-medium w-[120px] text-right bg-blue-50/40">Harga</th>
                                                <th className="p-2 font-medium w-[120px] text-right bg-blue-50/40">Sub</th>
                                                <th className="p-2 font-medium w-[70px] text-right border-l bg-amber-50/40">Qty</th>
                                                <th className="p-2 font-medium w-[120px] text-right bg-amber-50/40">Harga</th>
                                                <th className="p-2 font-medium w-[120px] text-right bg-amber-50/40">Sub</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {list.map((it) => {
                                                const { subRab, subCost, selisih } = calcRow(it);
                                                return (
                                                    <tr key={it._key} className="border-t hover:bg-muted/20">
                                                        <td className="p-1 min-w-[260px]">
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
                                                            />
                                                        </td>
                                                        <td className="p-1">
                                                            <input
                                                                type="text"
                                                                value={it.unit || ""}
                                                                onChange={(e) =>
                                                                    updateItem(it._key, { unit: e.target.value })
                                                                }
                                                                placeholder="pcs / m² / …"
                                                                className="w-full border rounded px-2 py-1"
                                                            />
                                                        </td>
                                                        {/* Sisi RAB */}
                                                        <td className="p-1 border-l bg-blue-50/20">
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
                                                                className="w-full border rounded px-2 py-1 text-right"
                                                            />
                                                        </td>
                                                        <td className="p-1 bg-blue-50/20">
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
                                                                className="w-full border rounded px-2 py-1 text-right font-mono"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-right font-mono bg-blue-50/20">{fmtRp(subRab)}</td>
                                                        {/* Sisi COST */}
                                                        <td className="p-1 border-l bg-amber-50/20">
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
                                                                className="w-full border rounded px-2 py-1 text-right"
                                                            />
                                                        </td>
                                                        <td className="p-1 bg-amber-50/20">
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
                                                                className="w-full border rounded px-2 py-1 text-right font-mono"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-right font-mono bg-amber-50/20">{fmtRp(subCost)}</td>
                                                        <td
                                                            className={`p-2 text-right font-mono border-l ${
                                                                selisih >= 0 ? "text-green-600" : "text-red-600"
                                                            }`}
                                                        >
                                                            {fmtRp(selisih)}
                                                        </td>
                                                        <td className="p-1 text-center">
                                                            <button
                                                                onClick={() => removeItem(it._key)}
                                                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
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
                    <div className="flex items-center justify-between text-sm">
                        <span>Total RAB (Harga Klien)</span>
                        <span className="font-mono">{fmtRp(totalRab)}</span>
                    </div>
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

            {/* Modal generate penawaran */}
            {showGenModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-background rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
                        <h2 className="text-lg font-semibold">Generate Penawaran dari RAB</h2>
                        <p className="text-xs text-muted-foreground">
                            Hanya kolom <b>Harga RAB</b> yang disalin ke penawaran. Harga COST tetap internal.
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
        </div>
    );
}

function UraianAutocomplete({
    value,
    onChange,
    onPick,
}: {
    value: string;
    onChange: (v: string) => void;
    onPick: (v: BoothVariant) => void;
}) {
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const { data: variants } = useQuery({
        queryKey: ["booth-variants", "ALL"],
        queryFn: () => getBoothVariants(undefined),
    });

    const q = value.trim().toLowerCase();
    const matches = useMemo(() => {
        const list = variants ?? [];
        if (!q) return list.slice(0, 8);
        return list
            .filter((v) => {
                const hay = `${v.product.name} ${v.variantName} ${v.sku ?? ""} ${v.size ?? ""}`.toLowerCase();
                return hay.includes(q);
            })
            .slice(0, 8);
    }, [variants, q]);

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
                    } else if (e.key === "Enter") {
                        e.preventDefault();
                        pick(matches[highlight]);
                    } else if (e.key === "Escape") {
                        setOpen(false);
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
                    className="bg-background border rounded-md shadow-lg max-h-64 overflow-y-auto"
                >
                    {matches.map((v, i) => (
                        <button
                            key={v.id}
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                pick(v);
                            }}
                            onMouseEnter={() => setHighlight(i)}
                            className={`w-full text-left px-2 py-1.5 flex items-center justify-between gap-2 text-xs ${
                                i === highlight ? "bg-muted" : "hover:bg-muted/50"
                            }`}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="font-medium truncate">
                                    {v.product.name}
                                    {v.variantName ? ` — ${v.variantName}` : ""}
                                </div>
                                <div className="text-[10px] text-muted-foreground flex gap-2">
                                    {v.sku && <span className="font-mono">{v.sku}</span>}
                                    {v.size && <span>· {v.size}</span>}
                                    {v.boothProductType && <span>· {v.boothProductType}</span>}
                                </div>
                            </div>
                            <div className="font-mono shrink-0">
                                Rp {Number(v.price).toLocaleString("id-ID")}
                            </div>
                        </button>
                    ))}
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

type CustomerLite = {
    id: number;
    name: string;
    companyName?: string | null;
    companyPIC?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
};

function CustomerPickerModal({
    onClose,
    onPick,
}: {
    onClose: () => void;
    onPick: (c: CustomerLite) => void;
}) {
    const [query, setQuery] = useState("");

    const { data: customers, isLoading } = useQuery({
        queryKey: ["customers-all"],
        queryFn: getCustomers,
    });

    const filtered = useMemo<CustomerLite[]>(() => {
        const list = (customers as CustomerLite[] | undefined) ?? [];
        const q = query.trim().toLowerCase();
        if (!q) return list;
        return list.filter((c) => {
            const hay = `${c.name ?? ""} ${c.companyName ?? ""} ${c.companyPIC ?? ""} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase();
            return hay.includes(q);
        });
    }, [customers, query]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-background rounded-lg shadow-xl w-full max-w-xl max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex items-center justify-between">
                    <h2 className="text-base font-semibold">Pilih Klien</h2>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-4 border-b">
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Cari nama / perusahaan / telepon…"
                            className="w-full border rounded-md pl-8 pr-3 py-2 text-sm"
                            autoFocus
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-8 flex justify-center">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            {(customers as any[] | undefined)?.length === 0
                                ? "Belum ada customer. Tambah dulu di halaman Data Pelanggan."
                                : "Tidak ada yang cocok."}
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {filtered.map((c) => (
                                <li key={c.id}>
                                    <button
                                        onClick={() => onPick(c)}
                                        className="w-full text-left p-3 hover:bg-muted/50"
                                    >
                                        <div className="font-medium text-sm">
                                            {c.companyName || c.name}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            {c.companyName && c.name && <span>{c.name}</span>}
                                            {c.companyPIC && <span> · PIC {c.companyPIC}</span>}
                                            {c.phone && <span> · {c.phone}</span>}
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
                            Total RAB (harga jual):
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
