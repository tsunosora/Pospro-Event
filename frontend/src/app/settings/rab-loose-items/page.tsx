"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Boxes,
    Loader2,
    Trash2,
    PackagePlus,
    Search,
    Check,
    X,
    BadgeCheck,
} from "lucide-react";
import {
    deleteRabLooseItem,
    getRabLooseItems,
    promoteRabLooseItem,
    type RabLooseItem,
} from "@/lib/api/rab-loose-items";
import { getCategories, getUnits } from "@/lib/api/products";

function fmtRp(v: number | string) {
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (!isFinite(n)) return "Rp 0";
    return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

function suggestSku(desc: string) {
    return (desc || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 32);
}

export default function RabLooseItemsSettingsPage() {
    const qc = useQueryClient();
    const [search, setSearch] = useState("");
    const [promoteTarget, setPromoteTarget] = useState<RabLooseItem | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<RabLooseItem | null>(null);

    const { data: items = [], isLoading } = useQuery<RabLooseItem[]>({
        queryKey: ["rab-loose-items", search],
        queryFn: () => getRabLooseItems(search || undefined, 100),
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ["rab-loose-items"] });

    const deleteMut = useMutation({
        mutationFn: (id: number) => deleteRabLooseItem(id),
        onSuccess: () => {
            invalidate();
            setDeleteTarget(null);
        },
        onError: (e: any) => alert(e?.response?.data?.message || "Gagal hapus"),
    });

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Boxes className="h-5 w-5 text-primary" /> Item Lepas RAB
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Kamus deskripsi item RAB yang sering dipakai (lakban, paku, fee tukang, dll). Bisa di-Promote ke katalog kalau sudah pantas dilacak sebagai inventory.
                    </p>
                </div>
                <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari deskripsi…"
                        className="border rounded pl-7 pr-3 py-1.5 text-sm w-64"
                    />
                </div>
            </div>

            <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-left">
                        <tr>
                            <th className="p-2 font-medium">Deskripsi</th>
                            <th className="p-2 font-medium">Satuan</th>
                            <th className="p-2 font-medium text-right">Harga RAB</th>
                            <th className="p-2 font-medium text-right">Harga Cost</th>
                            <th className="p-2 font-medium text-right">Pakai</th>
                            <th className="p-2 font-medium">Terakhir</th>
                            <th className="p-2 font-medium">Status</th>
                            <th className="p-2 w-[180px]"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && (
                            <tr>
                                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
                                </td>
                            </tr>
                        )}
                        {!isLoading && items.length === 0 && (
                            <tr>
                                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                                    Belum ada item lepas. Tambah otomatis saat simpan RAB dengan opsi "Simpan untuk dipakai lagi".
                                </td>
                            </tr>
                        )}
                        {items.map((it) => {
                            const promoted = !!it.promotedVariantId;
                            return (
                                <tr key={it.id} className="border-t hover:bg-muted/20">
                                    <td className="p-2">
                                        <div className="font-medium">{it.description}</div>
                                        {it.notes && (
                                            <div className="text-[10px] text-muted-foreground">{it.notes}</div>
                                        )}
                                    </td>
                                    <td className="p-2">{it.unit || "—"}</td>
                                    <td className="p-2 text-right font-mono">{fmtRp(it.lastPriceRab)}</td>
                                    <td className="p-2 text-right font-mono">{fmtRp(it.lastPriceCost)}</td>
                                    <td className="p-2 text-right">{it.usageCount}</td>
                                    <td className="p-2 text-[11px] text-muted-foreground">
                                        {it.lastUsedAt ? new Date(it.lastUsedAt).toLocaleDateString("id-ID") : "—"}
                                    </td>
                                    <td className="p-2">
                                        {promoted ? (
                                            <span
                                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800"
                                                title={it.promotedVariant?.product?.name || ""}
                                            >
                                                <BadgeCheck className="h-3 w-3" /> Dipromote
                                            </span>
                                        ) : (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                                Item lepas
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-2 text-right">
                                        <div className="flex items-center gap-1 justify-end">
                                            <button
                                                onClick={() => setPromoteTarget(it)}
                                                disabled={promoted}
                                                title={promoted ? "Sudah dipromote" : "Promote ke Katalog"}
                                                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <PackagePlus className="h-3 w-3" /> Promote
                                            </button>
                                            <button
                                                onClick={() => setDeleteTarget(it)}
                                                disabled={promoted}
                                                title={promoted ? "Tidak bisa dihapus (sudah dipromote)" : "Hapus"}
                                                className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {promoteTarget && (
                <PromoteModal
                    target={promoteTarget}
                    onClose={() => setPromoteTarget(null)}
                    onDone={() => {
                        invalidate();
                        setPromoteTarget(null);
                    }}
                />
            )}

            {deleteTarget && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-background border rounded-lg shadow-lg max-w-md w-full p-5 space-y-3">
                        <h3 className="font-semibold">Hapus item lepas?</h3>
                        <p className="text-sm text-muted-foreground">
                            <b>{deleteTarget.description}</b> akan dihapus permanen dari kamus.
                        </p>
                        <div className="flex items-center gap-2 justify-end">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
                            >
                                <X className="h-4 w-4 inline -mt-0.5" /> Batal
                            </button>
                            <button
                                onClick={() => deleteMut.mutate(deleteTarget.id)}
                                disabled={deleteMut.isPending}
                                className="flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 disabled:opacity-50"
                            >
                                {deleteMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                <Trash2 className="h-3.5 w-3.5" /> Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function PromoteModal({
    target,
    onClose,
    onDone,
}: {
    target: RabLooseItem;
    onClose: () => void;
    onDone: () => void;
}) {
    const [productName, setProductName] = useState(target.description);
    const [sku, setSku] = useState(suggestSku(target.description));
    const [categoryId, setCategoryId] = useState<number | "">("");
    const [unitId, setUnitId] = useState<number | "">("");
    const [price, setPrice] = useState<number>(parseFloat(target.lastPriceRab) || 0);
    const [error, setError] = useState<string | null>(null);

    const { data: categories = [] } = useQuery<{ id: number; name: string }[]>({
        queryKey: ["categories"],
        queryFn: getCategories,
    });
    const { data: units = [] } = useQuery<{ id: number; name: string }[]>({
        queryKey: ["units"],
        queryFn: getUnits,
    });

    const guessedUnitId = useMemo(() => {
        if (!target.unit) return "";
        const found = units.find((u) => u.name.toLowerCase() === target.unit!.toLowerCase());
        return found?.id ?? "";
    }, [units, target.unit]);

    useMemo(() => {
        if (unitId === "" && guessedUnitId !== "") setUnitId(guessedUnitId);
    }, [guessedUnitId]); // eslint-disable-line react-hooks/exhaustive-deps

    const promoteMut = useMutation({
        mutationFn: () =>
            promoteRabLooseItem(target.id, {
                productName: productName.trim(),
                sku: sku.trim(),
                categoryId: Number(categoryId),
                unitId: Number(unitId),
                price,
            }),
        onSuccess: () => {
            alert("Item dipromote ke katalog");
            onDone();
        },
        onError: (e: any) => setError(e?.response?.data?.message || "Gagal promote"),
    });

    function submit() {
        setError(null);
        if (!productName.trim()) return setError("Nama produk wajib");
        if (!sku.trim()) return setError("SKU wajib");
        if (!categoryId) return setError("Kategori wajib");
        if (!unitId) return setError("Satuan wajib");
        promoteMut.mutate();
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-background border rounded-lg shadow-lg max-w-lg w-full p-5 space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                    <PackagePlus className="h-4 w-4" /> Promote ke Katalog
                </h3>
                <p className="text-xs text-muted-foreground">
                    Membuat Product + ProductVariant baru. Loose item akan ditandai "dipromote" dan tidak bisa dihapus.
                </p>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-medium block mb-1">Nama Produk *</label>
                        <input
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                            className="w-full border rounded px-3 py-2 text-sm"
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium block mb-1">SKU *</label>
                            <input
                                value={sku}
                                onChange={(e) => setSku(e.target.value)}
                                className="w-full border rounded px-3 py-2 text-sm font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium block mb-1">Harga Default</label>
                            <input
                                type="number"
                                value={price}
                                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                                className="w-full border rounded px-3 py-2 text-sm font-mono text-right"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium block mb-1">Kategori *</label>
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
                                className="w-full border rounded px-3 py-2 text-sm bg-background"
                            >
                                <option value="">— pilih —</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium block mb-1">Satuan *</label>
                            <select
                                value={unitId}
                                onChange={(e) => setUnitId(e.target.value ? Number(e.target.value) : "")}
                                className="w-full border rounded px-3 py-2 text-sm bg-background"
                            >
                                <option value="">— pilih —</option>
                                {units.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {error && <p className="text-xs text-red-600">{error}</p>}

                <div className="flex items-center gap-2 justify-end pt-2">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
                    >
                        Batal
                    </button>
                    <button
                        onClick={submit}
                        disabled={promoteMut.isPending}
                        className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded text-sm hover:opacity-90 disabled:opacity-50"
                    >
                        {promoteMut.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Check className="h-3.5 w-3.5" />
                        )}
                        Promote
                    </button>
                </div>
            </div>
        </div>
    );
}
