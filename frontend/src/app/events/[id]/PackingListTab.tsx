"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Loader2, Plus, MapPin, CheckCircle2, Circle, Download, Package2, Droplet,
} from "lucide-react";
import { getProducts } from "@/lib/api/products";
import { getWorkers } from "@/lib/api/workers";
import { getStorageLocations } from "@/lib/api/storageLocations";
import {
    getEventPacking, createPackingItem, setPackingItemChecked,
    deletePackingItem, updatePackingItem, prefillWithdrawalFromPacking,
    type PackingItem, type PackingDisposition,
} from "@/lib/api/packing";

type ProductWithVariants = {
    id: number;
    name: string;
    variants: Array<{ id: number; sku: string; variantName: string | null; stock: number; price: number }>;
};

export default function PackingListTab({ eventId }: { eventId: number }) {
    const qc = useQueryClient();
    const [workerId, setWorkerId] = useState<number | null>(null);

    const { data: items = [], isLoading } = useQuery({
        queryKey: ["event-packing", eventId],
        queryFn: () => getEventPacking(eventId),
    });
    const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => getProducts() });
    const { data: workers = [] } = useQuery({ queryKey: ["workers"], queryFn: () => getWorkers() });
    const { data: locations = [] } = useQuery({
        queryKey: ["storage-locations", "ALL"],
        queryFn: () => getStorageLocations(),
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ["event-packing", eventId] });

    const createMut = useMutation({
        mutationFn: (input: Parameters<typeof createPackingItem>[1]) => createPackingItem(eventId, input),
        onSuccess: invalidate,
    });
    const checkMut = useMutation({
        mutationFn: ({ id, isChecked, disposition }: { id: number; isChecked: boolean; disposition?: PackingDisposition | null }) =>
            setPackingItemChecked(id, isChecked, workerId, disposition ?? null),
        onSuccess: invalidate,
    });
    const updateMut = useMutation({
        mutationFn: ({ id, input }: { id: number; input: Parameters<typeof updatePackingItem>[1] }) =>
            updatePackingItem(id, input),
        onSuccess: invalidate,
    });
    const deleteMut = useMutation({
        mutationFn: deletePackingItem,
        onSuccess: invalidate,
    });

    const stats = useMemo(() => ({
        total: items.length,
        checked: items.filter((i: PackingItem) => i.isChecked).length,
        pending: items.filter((i: PackingItem) => !i.isChecked).length,
    }), [items]);

    const handlePrefill = async () => {
        try {
            const d = await prefillWithdrawalFromPacking(eventId, true);
            if (!d.items.length) {
                alert('Belum ada item yang dicentang. Centang item yang akan dipinjam dulu.');
                return;
            }
            sessionStorage.setItem("packing-prefill", JSON.stringify(d));
            window.location.href = `/gudang/peminjaman/new?fromPacking=1`;
        } catch (e: any) {
            alert(e?.response?.data?.message || "Gagal prefill");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
                <div className="grid grid-cols-3 gap-2 flex-1 min-w-0">
                    <Stat label="Total" value={stats.total} cls="bg-slate-50" />
                    <Stat label="Belum" value={stats.pending} cls="bg-gray-50" />
                    <Stat label="Tercentang" value={stats.checked} cls="bg-emerald-50" />
                </div>
                <button
                    onClick={handlePrefill}
                    disabled={!stats.checked}
                    className="inline-flex items-center gap-1.5 border px-3 py-1.5 rounded text-sm hover:bg-muted disabled:opacity-50"
                    title="Buat draft pengeluaran dari item yang sudah dicentang (untuk barang pinjam)"
                >
                    <Download className="h-4 w-4" /> Pre-fill Pengeluaran
                </button>
            </div>

            <div className="flex items-center gap-2 text-sm">
                <label className="text-xs font-medium">Sebagai pekerja:</label>
                <select
                    value={workerId ?? ""}
                    onChange={(e) => setWorkerId(e.target.value ? Number(e.target.value) : null)}
                    className="border rounded px-2 py-1 text-xs"
                >
                    <option value="">— Tidak ada —</option>
                    {(workers as Array<{ id: number; name: string }>).map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                </select>
                <span className="text-[10px] text-muted-foreground">
                    Dicatat saat mencentang item.
                </span>
            </div>

            <div className="text-[11px] text-muted-foreground border-l-2 border-amber-300 bg-amber-50/50 px-3 py-2 rounded">
                Saat mencentang, pilih <b>Pinjam</b> (barang balik) atau <b>Operasional</b> (habis pakai). Otomatis masuk RAB event. Stok <b>tidak</b> berkurang di sini — untuk PINJAM lanjut ke Pengeluaran (foto+nama tukang).
            </div>

            <AddItemForm
                products={products as ProductWithVariants[]}
                locations={locations}
                onAdd={(input) => createMut.mutate(input)}
                pending={createMut.isPending}
            />

            {isLoading ? (
                <div className="py-10 text-center text-sm"><Loader2 className="h-4 w-4 inline animate-spin mr-2" /> Memuat…</div>
            ) : items.length === 0 ? (
                <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
                    Belum ada barang dalam packing list. Tambah dari form di atas.
                </div>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-xs text-left">
                            <tr>
                                <th className="p-2 w-10"></th>
                                <th className="p-2">Produk / SKU</th>
                                <th className="p-2 w-16 text-right">Qty</th>
                                <th className="p-2">Lokasi</th>
                                <th className="p-2 w-32">Dicentang oleh</th>
                                <th className="p-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((it: PackingItem) => (
                                <PackingRow
                                    key={it.id}
                                    item={it}
                                    locations={locations}
                                    onCheck={(disposition) => checkMut.mutate({ id: it.id, isChecked: true, disposition })}
                                    onUncheck={() => checkMut.mutate({ id: it.id, isChecked: false })}
                                    onUpdate={(input) => updateMut.mutate({ id: it.id, input })}
                                    onDelete={() => {
                                        if (confirm(`Hapus "${it.productVariant.product.name}" dari packing list?`)) {
                                            deleteMut.mutate(it.id);
                                        }
                                    }}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
    return (
        <div className={`rounded p-2 ${cls} border`}>
            <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
            <div className="text-lg font-bold">{value}</div>
        </div>
    );
}

function PackingRow({ item, locations, onCheck, onUncheck, onUpdate, onDelete }: {
    item: PackingItem;
    locations: Array<{ id: number; code: string; name: string; warehouse?: { name: string } }>;
    onCheck: (disposition: PackingDisposition) => void;
    onUncheck: () => void;
    onUpdate: (input: { storageLocationId?: number | null; locationNote?: string | null; quantity?: number }) => void;
    onDelete: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const [locId, setLocId] = useState<number | "">(item.storageLocationId ?? "");
    const [note, setNote] = useState(item.locationNote ?? "");
    const [qty, setQty] = useState(String(item.quantity));

    const save = () => {
        onUpdate({
            storageLocationId: locId === "" ? null : Number(locId),
            locationNote: note.trim() || null,
            quantity: Number(qty) || 1,
        });
        setEditing(false);
    };

    return (
        <tr className={`border-t align-top ${item.isChecked ? "bg-emerald-50/30" : ""}`}>
            <td className="p-2">
                {item.isChecked ? (
                    <button
                        onClick={onUncheck}
                        title="Batalkan centang (juga hapus dari RAB)"
                        className="hover:scale-110 transition"
                    >
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    </button>
                ) : (
                    <div className="flex flex-col gap-1">
                        <button
                            onClick={() => onCheck("PINJAM")}
                            title="Centang sebagai PINJAM (barang balik)"
                            className="inline-flex items-center gap-1 text-[10px] border px-1.5 py-0.5 rounded hover:bg-blue-50 text-blue-700 border-blue-300"
                        >
                            <Package2 className="h-3 w-3" /> Pinjam
                        </button>
                        <button
                            onClick={() => onCheck("OPERASIONAL")}
                            title="Centang sebagai OPERASIONAL (habis pakai)"
                            className="inline-flex items-center gap-1 text-[10px] border px-1.5 py-0.5 rounded hover:bg-orange-50 text-orange-700 border-orange-300"
                        >
                            <Droplet className="h-3 w-3" /> Ops
                        </button>
                    </div>
                )}
            </td>
            <td className="p-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <div className={`text-sm ${item.isChecked ? "line-through text-muted-foreground" : ""}`}>
                        {item.productVariant.product.name}
                    </div>
                    {item.isChecked && item.disposition && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${item.disposition === "PINJAM" ? "bg-blue-50 text-blue-700 border-blue-300" : "bg-orange-50 text-orange-700 border-orange-300"}`}>
                            {item.disposition === "PINJAM" ? "PINJAM" : "OPERASIONAL"}
                        </span>
                    )}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                    {item.productVariant.sku}{item.productVariant.variantName ? ` • ${item.productVariant.variantName}` : ""}
                    <span className="ml-2">stok: {item.productVariant.stock}</span>
                </div>
            </td>
            <td className="p-2 text-right font-mono text-xs">
                {editing ? (
                    <input
                        type="number" min={1} value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        className="w-14 border rounded px-1 py-0.5 text-xs text-right"
                    />
                ) : Number(item.quantity)}
            </td>
            <td className="p-2 text-xs">
                {editing ? (
                    <div className="space-y-1">
                        <select
                            value={String(locId)}
                            onChange={(e) => setLocId(e.target.value ? Number(e.target.value) : "")}
                            className="w-full border rounded px-1 py-0.5 text-xs"
                        >
                            <option value="">— Pilih lokasi —</option>
                            {locations.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.warehouse?.name ? `${l.warehouse.name} • ` : ""}{l.code} — {l.name}
                                </option>
                            ))}
                        </select>
                        <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Catatan lokasi (opsional)"
                            className="w-full border rounded px-1 py-0.5 text-xs"
                        />
                    </div>
                ) : (
                    <>
                        {item.storageLocation ? (
                            <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span>{item.storageLocation.warehouse.name} • {item.storageLocation.code} {item.storageLocation.name}</span>
                            </div>
                        ) : (
                            <div className="text-muted-foreground italic text-[11px]">— belum diset —</div>
                        )}
                        {item.locationNote && <div className="text-[10px] text-muted-foreground mt-0.5">“{item.locationNote}”</div>}
                    </>
                )}
            </td>
            <td className="p-2 text-[10px] text-muted-foreground">
                {item.checkedBy && (
                    <div>
                        ✓ {item.checkedBy.name}
                        <br />
                        {item.checkedAt ? new Date(item.checkedAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : ""}
                    </div>
                )}
            </td>
            <td className="p-2 text-right">
                {editing ? (
                    <div className="flex flex-col gap-1">
                        <button onClick={save} className="text-[10px] hover:underline text-emerald-700">Simpan</button>
                        <button onClick={() => setEditing(false)} className="text-[10px] hover:underline text-muted-foreground">Batal</button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        <button onClick={() => setEditing(true)} className="text-[10px] hover:underline">Edit</button>
                        <button onClick={onDelete} className="text-[10px] hover:underline text-red-600">Hapus</button>
                    </div>
                )}
            </td>
        </tr>
    );
}

function AddItemForm({ products, locations, onAdd, pending }: {
    products: ProductWithVariants[];
    locations: Array<{ id: number; code: string; name: string; warehouse?: { name: string } }>;
    onAdd: (input: { productVariantId: number; quantity: number; storageLocationId?: number | null; locationNote?: string | null }) => void;
    pending: boolean;
}) {
    const [variantId, setVariantId] = useState<number | "">("");
    const [qty, setQty] = useState("1");
    const [locId, setLocId] = useState<number | "">("");
    const [note, setNote] = useState("");
    const [search, setSearch] = useState("");

    const flatVariants = useMemo(() => {
        const list: Array<{ id: number; label: string; sku: string; productName: string; variantName: string | null }> = [];
        for (const p of products) {
            if (!p.variants) continue;
            for (const v of p.variants) {
                const label = `${p.name}${v.variantName ? ` — ${v.variantName}` : ""} (${v.sku})`;
                list.push({ id: v.id, label, sku: v.sku, productName: p.name, variantName: v.variantName });
            }
        }
        return list;
    }, [products]);

    const filtered = useMemo(() => {
        if (!search.trim()) return flatVariants.slice(0, 50);
        const q = search.toLowerCase();
        return flatVariants.filter((v) => v.label.toLowerCase().includes(q)).slice(0, 50);
    }, [flatVariants, search]);

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                if (!variantId) return;
                onAdd({
                    productVariantId: Number(variantId),
                    quantity: Number(qty) || 1,
                    storageLocationId: locId === "" ? null : Number(locId),
                    locationNote: note.trim() || null,
                });
                setVariantId(""); setQty("1"); setLocId(""); setNote(""); setSearch("");
            }}
            className="border rounded-lg p-3 bg-muted/20 space-y-2"
        >
            <div className="text-sm font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4" /> Tambah Barang ke Packing List
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="md:col-span-2">
                    <label className="text-xs font-medium">Produk *</label>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari produk…"
                        className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 mb-1"
                    />
                    <select
                        required
                        value={variantId}
                        onChange={(e) => setVariantId(e.target.value ? Number(e.target.value) : "")}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                        size={Math.min(6, Math.max(3, filtered.length))}
                    >
                        <option value="">— Pilih —</option>
                        {filtered.map((v) => (
                            <option key={v.id} value={v.id}>{v.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium">Qty *</label>
                    <input
                        required type="number" min={1}
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                    />
                </div>
                <div>
                    <label className="text-xs font-medium">Lokasi</label>
                    <select
                        value={String(locId)}
                        onChange={(e) => setLocId(e.target.value ? Number(e.target.value) : "")}
                        className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                    >
                        <option value="">— Pilih (opsional) —</option>
                        {locations.map((l) => (
                            <option key={l.id} value={l.id}>
                                {l.warehouse?.name ? `${l.warehouse.name} • ` : ""}{l.code} — {l.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <div>
                <label className="text-xs font-medium">Catatan lokasi (opsional)</label>
                <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="mis. sudut dekat pintu, tumpukan bawah"
                    className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                />
            </div>
            <button
                type="submit"
                disabled={pending || !variantId}
                className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded text-sm hover:opacity-90 disabled:opacity-50"
            >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Tambah
            </button>
        </form>
    );
}
