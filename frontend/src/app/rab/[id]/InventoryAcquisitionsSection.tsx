"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Package, CheckCircle, XCircle, Warehouse as WarehouseIcon, Loader2,
    Upload, X, Image as ImageIcon, Save,
} from "lucide-react";
import {
    listInventoryAcquisitions, storeAcquisition, cancelAcquisition,
    uploadAcquisitionPhoto,
    type InventoryAcquisition, type StoreAcquisitionInput,
} from "@/lib/api/inventory-acquisitions";
import { getProducts, getCategories, getUnits } from "@/lib/api/products";
import { getWarehouses } from "@/lib/api/warehouses";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

function fmtRp(v: number | string) {
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (!isFinite(n)) return "Rp 0";
    return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

interface Props {
    rabPlanId: number;
}

export default function InventoryAcquisitionsSection({ rabPlanId }: Props) {
    const qc = useQueryClient();
    const [storeOpenId, setStoreOpenId] = useState<number | null>(null);

    const { data: acquisitions = [], isLoading } = useQuery<InventoryAcquisition[]>({
        queryKey: ["inventory-acquisitions", rabPlanId],
        queryFn: () => listInventoryAcquisitions({ rabPlanId }),
    });

    const cancelMut = useMutation({
        mutationFn: (id: number) => cancelAcquisition(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory-acquisitions", rabPlanId] }),
    });

    if (isLoading) return null;
    if (acquisitions.length === 0) return null;

    const pending = acquisitions.filter((a) => a.status === "PENDING");
    const stored = acquisitions.filter((a) => a.status === "STORED");
    const cancelled = acquisitions.filter((a) => a.status === "CANCELLED");
    const totalPendingCost = pending.reduce((s, a) => s + Number(a.totalCost), 0);

    return (
        <section className="bg-white rounded-lg border-2 border-violet-200 p-4 mt-6">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-violet-700" />
                    <h3 className="font-bold text-violet-900">Pengadaan Inventaris</h3>
                    <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold">
                        {acquisitions.length} item
                    </span>
                </div>
                <div className="text-xs text-muted-foreground">
                    {pending.length > 0 && <span className="mr-2"><span className="text-amber-600 font-semibold">⏳ {pending.length} pending</span> ({fmtRp(totalPendingCost)})</span>}
                    {stored.length > 0 && <span className="mr-2"><span className="text-emerald-600 font-semibold">✅ {stored.length} sudah di-stok</span></span>}
                    {cancelled.length > 0 && <span><span className="text-slate-500">❌ {cancelled.length} cancelled</span></span>}
                </div>
            </div>

            <div className="space-y-2">
                {acquisitions.map((acq) => (
                    <AcquisitionRow
                        key={acq.id}
                        acq={acq}
                        onStore={() => setStoreOpenId(acq.id)}
                        onCancel={() => { if (confirm(`Cancel pengadaan "${acq.description}"?`)) cancelMut.mutate(acq.id); }}
                    />
                ))}
            </div>

            {storeOpenId !== null && (() => {
                const acq = acquisitions.find((a) => a.id === storeOpenId);
                if (!acq) return null;
                return (
                    <StoreModal
                        acquisition={acq}
                        onClose={() => setStoreOpenId(null)}
                        onSuccess={() => {
                            qc.invalidateQueries({ queryKey: ["inventory-acquisitions", rabPlanId] });
                            setStoreOpenId(null);
                        }}
                    />
                );
            })()}
        </section>
    );
}

function AcquisitionRow({
    acq, onStore, onCancel,
}: {
    acq: InventoryAcquisition;
    onStore: () => void;
    onCancel: () => void;
}) {
    const statusBadge = acq.status === "PENDING"
        ? <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">⏳ PENDING</span>
        : acq.status === "STORED"
            ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">✅ STORED</span>
            : <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">❌ CANCELLED</span>;

    return (
        <div className={`p-3 rounded-lg border ${acq.status === "PENDING" ? "border-amber-200 bg-amber-50/30" : acq.status === "STORED" ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-slate-50/30 opacity-70"}`}>
            <div className="flex items-start gap-3 flex-wrap">
                {acq.photoUrl && (
                    <img
                        src={`${apiBase}${acq.photoUrl}`}
                        alt={acq.description}
                        className="w-16 h-16 object-cover rounded border shrink-0"
                    />
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{acq.description}</span>
                        {statusBadge}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        {Number(acq.quantity)} {acq.unit ?? "unit"} × {fmtRp(acq.unitCost)} = <b>{fmtRp(acq.totalCost)}</b>
                    </div>
                    {acq.productVariant && (
                        <div className="text-[11px] text-emerald-700 mt-1 inline-flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Sudah masuk stok: <b>{acq.productVariant.product.name}</b>
                            {acq.productVariant.variantName && ` — ${acq.productVariant.variantName}`}
                            {acq.warehouse && <span className="text-muted-foreground"> · 🏬 {acq.warehouse.name}</span>}
                        </div>
                    )}
                </div>
                {acq.status === "PENDING" && (
                    <div className="flex gap-1.5 shrink-0">
                        <button
                            onClick={onStore}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded text-xs font-bold"
                        >
                            <Package className="h-3.5 w-3.5" /> Stok Sekarang
                        </button>
                        <button
                            onClick={onCancel}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-red-600 hover:bg-red-50 rounded text-xs"
                        >
                            <XCircle className="h-3.5 w-3.5" /> Skip
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function StoreModal({
    acquisition, onClose, onSuccess,
}: {
    acquisition: InventoryAcquisition;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [mode, setMode] = useState<'existing' | 'new'>('new');
    const [productVariantId, setProductVariantId] = useState<number | null>(null);
    const [variantSearch, setVariantSearch] = useState("");

    // For new variant
    const [productName, setProductName] = useState(acquisition.description);
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [unitId, setUnitId] = useState<number | null>(null);
    const [sku, setSku] = useState("");

    const [warehouseId, setWarehouseId] = useState<number | null>(null);
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [notes, setNotes] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    const { data: products = [] } = useQuery<any[]>({ queryKey: ["products"], queryFn: getProducts });
    const { data: categories = [] } = useQuery<any[]>({ queryKey: ["categories"], queryFn: getCategories });
    const { data: units = [] } = useQuery<any[]>({ queryKey: ["units"], queryFn: getUnits });
    const { data: warehouses = [] } = useQuery<any[]>({ queryKey: ["warehouses"], queryFn: () => getWarehouses(false) });

    // Default warehouse: yang pertama
    useEffect(() => {
        if (warehouseId === null && warehouses.length > 0) setWarehouseId(warehouses[0].id);
    }, [warehouses, warehouseId]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [onClose]);

    const variants: any[] = [];
    for (const p of products) {
        for (const v of p.variants ?? []) {
            variants.push({ ...v, productName: p.name });
        }
    }
    const filteredVariants = variants.filter((v) => {
        const q = variantSearch.toLowerCase();
        if (!q) return true;
        return [v.productName, v.sku, v.variantName].some((s) => (s ?? "").toLowerCase().includes(q));
    }).slice(0, 50);

    const submitMut = useMutation({
        mutationFn: async () => {
            if (!warehouseId) throw new Error("Pilih warehouse");

            // Upload photo dulu kalau ada
            let photoUrl: string | null = null;
            if (photo) {
                const result = await uploadAcquisitionPhoto(acquisition.id, photo);
                photoUrl = result.photoUrl;
            }

            const input: StoreAcquisitionInput = {
                warehouseId,
                photoUrl,
                notes: notes || null,
            };

            if (mode === "existing") {
                if (!productVariantId) throw new Error("Pilih variant existing");
                input.productVariantId = productVariantId;
            } else {
                if (!productName.trim()) throw new Error("Nama produk wajib");
                if (!categoryId) throw new Error("Kategori wajib");
                if (!unitId) throw new Error("Satuan wajib");
                input.newVariant = {
                    productName: productName.trim(),
                    categoryId,
                    unitId,
                    sku: sku.trim() || undefined,
                    variantName: acquisition.description,
                };
            }

            return storeAcquisition(acquisition.id, input);
        },
        onSuccess: () => onSuccess(),
        onError: (e: any) => alert("Gagal: " + (e?.response?.data?.message || e.message)),
    });

    function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        if (!f) return;
        setPhoto(f);
        setPhotoPreview(URL.createObjectURL(f));
    }

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-violet-600" />
                        <h2 className="text-lg font-bold">Stok ke Inventory</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Item info */}
                    <div className="bg-violet-50 border-2 border-violet-200 rounded-lg p-3">
                        <div className="text-[10px] uppercase font-bold text-violet-700">Item</div>
                        <div className="font-bold">{acquisition.description}</div>
                        <div className="text-xs text-violet-700 mt-0.5">
                            {Number(acquisition.quantity)} {acquisition.unit ?? "unit"} × {fmtRp(acquisition.unitCost)} = <b>{fmtRp(acquisition.totalCost)}</b>
                        </div>
                    </div>

                    {/* Mode toggle */}
                    <div>
                        <label className="block text-sm font-semibold mb-1.5">Variant Produk</label>
                        <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-md w-full">
                            <button
                                type="button"
                                onClick={() => setMode("new")}
                                className={`flex-1 px-3 py-1.5 rounded text-xs font-bold ${mode === "new" ? "bg-white text-violet-700 shadow-sm" : "text-slate-600"}`}
                            >
                                ✨ Buat Variant Baru
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode("existing")}
                                className={`flex-1 px-3 py-1.5 rounded text-xs font-bold ${mode === "existing" ? "bg-white text-violet-700 shadow-sm" : "text-slate-600"}`}
                            >
                                🔍 Pilih Existing (re-stock)
                            </button>
                        </div>
                    </div>

                    {/* Mode New */}
                    {mode === "new" && (
                        <div className="space-y-3 border-2 border-dashed border-slate-200 rounded-lg p-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-semibold mb-0.5">Nama Produk *</label>
                                    <input
                                        value={productName}
                                        onChange={(e) => setProductName(e.target.value)}
                                        className="w-full border-2 rounded px-2 py-1.5 text-sm focus:border-violet-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-0.5">SKU (auto kalau kosong)</label>
                                    <input
                                        value={sku}
                                        onChange={(e) => setSku(e.target.value)}
                                        placeholder={`INV-${acquisition.rabPlan?.code ?? "?"}-${acquisition.id}`}
                                        className="w-full border-2 rounded px-2 py-1.5 text-sm font-mono focus:border-violet-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-0.5">Kategori *</label>
                                    <select
                                        value={categoryId ?? ""}
                                        onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                                        className="w-full border-2 rounded px-2 py-1.5 text-sm bg-white focus:border-violet-500 outline-none"
                                    >
                                        <option value="">— pilih —</option>
                                        {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-0.5">Satuan *</label>
                                    <select
                                        value={unitId ?? ""}
                                        onChange={(e) => setUnitId(e.target.value ? Number(e.target.value) : null)}
                                        className="w-full border-2 rounded px-2 py-1.5 text-sm bg-white focus:border-violet-500 outline-none"
                                    >
                                        <option value="">— pilih —</option>
                                        {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mode Existing */}
                    {mode === "existing" && (
                        <div className="space-y-2 border-2 border-dashed border-slate-200 rounded-lg p-3">
                            <input
                                type="search"
                                placeholder="Cari nama produk / SKU..."
                                value={variantSearch}
                                onChange={(e) => setVariantSearch(e.target.value)}
                                className="w-full border-2 rounded px-3 py-2 text-sm focus:border-violet-500 outline-none"
                            />
                            <div className="max-h-60 overflow-y-auto border rounded space-y-0.5">
                                {filteredVariants.length === 0 && (
                                    <div className="text-xs text-muted-foreground p-3 text-center">
                                        {variantSearch ? `Tidak ada hasil "${variantSearch}"` : "Loading..."}
                                    </div>
                                )}
                                {filteredVariants.map((v: any) => (
                                    <button
                                        key={v.id}
                                        type="button"
                                        onClick={() => setProductVariantId(v.id)}
                                        className={`w-full text-left px-3 py-2 text-xs hover:bg-violet-50 ${productVariantId === v.id ? "bg-violet-100 border-l-4 border-violet-500" : ""}`}
                                    >
                                        <div className="font-semibold">{v.productName}{v.variantName ? ` — ${v.variantName}` : ""}</div>
                                        <div className="text-muted-foreground">SKU: <span className="font-mono">{v.sku}</span> · Stok: <b>{v.stock}</b></div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Warehouse */}
                    <div>
                        <label className="block text-sm font-semibold mb-1.5 flex items-center gap-1">
                            <WarehouseIcon className="h-4 w-4" /> Warehouse Destination *
                        </label>
                        <select
                            value={warehouseId ?? ""}
                            onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full border-2 rounded-md px-3 py-2 text-sm bg-white focus:border-violet-500 outline-none"
                        >
                            <option value="">— pilih warehouse —</option>
                            {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>

                    {/* Photo */}
                    <div>
                        <label className="block text-sm font-semibold mb-1.5 flex items-center gap-1">
                            <ImageIcon className="h-4 w-4" /> Foto Barang <span className="text-xs font-normal text-muted-foreground">(opsional, untuk audit)</span>
                        </label>
                        <div className="flex gap-2 items-center">
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 rounded text-sm hover:bg-slate-50"
                            >
                                <Upload className="h-3.5 w-3.5" /> {photo ? "Ganti foto" : "Upload foto"}
                            </button>
                            {photoPreview && (
                                <img src={photoPreview} alt="preview" className="h-16 w-16 object-cover rounded border" />
                            )}
                            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-semibold mb-1.5">Catatan</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            placeholder="Mis: kondisi barang, vendor, garansi"
                            className="w-full border-2 rounded-md px-3 py-2 text-sm focus:border-violet-500 outline-none"
                        />
                    </div>
                </div>

                <div className="sticky bottom-0 bg-white border-t px-5 py-3 flex gap-2">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border-2 rounded-md text-sm font-semibold hover:bg-slate-50">Batal</button>
                    <button
                        onClick={() => submitMut.mutate()}
                        disabled={submitMut.isPending || !warehouseId}
                        className="flex-[2] inline-flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md text-sm font-bold disabled:opacity-50"
                    >
                        {submitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Stok ke Warehouse
                    </button>
                </div>
            </div>
        </div>
    );
}
