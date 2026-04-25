"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Save, Trash2, MapPin, X } from "lucide-react";
import { getWarehouses } from "@/lib/api/warehouses";
import {
    getStorageLocations, createStorageLocation, updateStorageLocation, deleteStorageLocation,
    type StorageLocation, type StorageLocationInput,
} from "@/lib/api/storageLocations";

export default function StorageLocationsPage() {
    const qc = useQueryClient();
    const [warehouseFilter, setWarehouseFilter] = useState<number | "ALL">("ALL");
    const [includeInactive, setIncludeInactive] = useState(false);
    const [editing, setEditing] = useState<StorageLocation | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const { data: warehouses = [] } = useQuery({ queryKey: ["warehouses"], queryFn: () => getWarehouses() });
    const { data: locations = [], isLoading } = useQuery({
        queryKey: ["storage-locations", warehouseFilter, includeInactive],
        queryFn: () => getStorageLocations(warehouseFilter === "ALL" ? undefined : warehouseFilter, includeInactive),
    });

    const closeForm = () => { setEditing(null); setIsCreating(false); };
    const invalidate = () => qc.invalidateQueries({ queryKey: ["storage-locations"] });

    const createMut = useMutation({
        mutationFn: createStorageLocation,
        onSuccess: () => { invalidate(); closeForm(); },
    });
    const updateMut = useMutation({
        mutationFn: ({ id, input }: { id: number; input: Partial<StorageLocationInput> }) => updateStorageLocation(id, input),
        onSuccess: () => { invalidate(); closeForm(); },
    });
    const deleteMut = useMutation({
        mutationFn: deleteStorageLocation,
        onSuccess: () => invalidate(),
    });

    const grouped = (warehouses as Array<{ id: number; name: string }>).map((w) => ({
        warehouse: w,
        items: locations.filter((l) => l.warehouseId === w.id),
    }));

    return (
        <div className="p-4 md:p-6 space-y-4">
            <div className="flex items-center flex-wrap gap-2">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" /> Lokasi Barang
                </h1>
                <button
                    onClick={() => { setIsCreating(true); setEditing(null); }}
                    className="ml-auto inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded text-sm hover:opacity-90"
                >
                    <Plus className="h-4 w-4" /> Tambah Lokasi
                </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-sm">
                <select
                    value={String(warehouseFilter)}
                    onChange={(e) => setWarehouseFilter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
                    className="border rounded px-2 py-1 text-sm"
                >
                    <option value="ALL">Semua Gudang</option>
                    {(warehouses as Array<{ id: number; name: string }>).map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                </select>
                <label className="inline-flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
                    Tampilkan non-aktif
                </label>
                <div className="ml-auto text-xs text-muted-foreground">
                    Total: {locations.length} lokasi
                </div>
            </div>

            {(isCreating || editing) && (
                <LocationForm
                    initial={editing}
                    warehouses={warehouses as Array<{ id: number; name: string }>}
                    onCancel={closeForm}
                    onSave={(input) => {
                        if (editing) updateMut.mutate({ id: editing.id, input });
                        else createMut.mutate(input);
                    }}
                    pending={createMut.isPending || updateMut.isPending}
                    error={(createMut.error as any)?.response?.data?.message || (updateMut.error as any)?.response?.data?.message || null}
                />
            )}

            {isLoading ? (
                <div className="py-10 text-center text-sm"><Loader2 className="h-4 w-4 inline animate-spin mr-2" /> Memuat…</div>
            ) : (
                <div className="space-y-4">
                    {grouped.filter((g) => warehouseFilter === "ALL" || g.warehouse.id === warehouseFilter).map((g) => (
                        <div key={g.warehouse.id} className="border rounded-lg overflow-hidden">
                            <div className="bg-muted/40 px-3 py-2 text-sm font-semibold">{g.warehouse.name} <span className="text-xs text-muted-foreground">({g.items.length})</span></div>
                            {g.items.length === 0 ? (
                                <div className="p-4 text-xs text-muted-foreground text-center">Belum ada lokasi di gudang ini.</div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/20 text-left text-xs">
                                        <tr>
                                            <th className="p-2 w-24">Kode</th>
                                            <th className="p-2">Nama</th>
                                            <th className="p-2">Catatan</th>
                                            <th className="p-2 w-20 text-center">Status</th>
                                            <th className="p-2 w-24"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {g.items.map((l) => (
                                            <tr key={l.id} className="border-t hover:bg-muted/10">
                                                <td className="p-2 font-mono text-xs">{l.code}</td>
                                                <td className="p-2">{l.name}</td>
                                                <td className="p-2 text-xs text-muted-foreground">{l.notes ?? "—"}</td>
                                                <td className="p-2 text-center">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${l.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                                                        {l.isActive ? "Aktif" : "Non-aktif"}
                                                    </span>
                                                </td>
                                                <td className="p-2 text-right">
                                                    <button
                                                        onClick={() => { setEditing(l); setIsCreating(false); }}
                                                        className="text-xs hover:underline mr-2"
                                                    >Edit</button>
                                                    <button
                                                        onClick={() => { if (confirm(`Hapus lokasi "${l.code} — ${l.name}"?`)) deleteMut.mutate(l.id); }}
                                                        className="text-xs text-red-600 hover:underline"
                                                    ><Trash2 className="h-3 w-3 inline" /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function LocationForm({ initial, warehouses, onCancel, onSave, pending, error }: {
    initial: StorageLocation | null;
    warehouses: Array<{ id: number; name: string }>;
    onCancel: () => void;
    onSave: (input: StorageLocationInput) => void;
    pending: boolean;
    error: string | null;
}) {
    const [form, setForm] = useState<StorageLocationInput>({
        warehouseId: initial?.warehouseId ?? warehouses[0]?.id ?? 0,
        code: initial?.code ?? "",
        name: initial?.name ?? "",
        notes: initial?.notes ?? "",
        isActive: initial?.isActive ?? true,
    });

    return (
        <form
            onSubmit={(e) => { e.preventDefault(); onSave(form); }}
            className="border rounded-lg p-3 bg-muted/20 space-y-2"
        >
            <div className="flex items-center gap-2">
                <div className="text-sm font-semibold">{initial ? "Edit Lokasi" : "Lokasi Baru"}</div>
                <button type="button" onClick={onCancel} className="ml-auto text-xs text-muted-foreground hover:underline inline-flex items-center gap-1">
                    <X className="h-3 w-3" /> Batal
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                    <label className="text-xs font-medium">Gudang *</label>
                    <select
                        required
                        value={form.warehouseId}
                        onChange={(e) => setForm((f) => ({ ...f, warehouseId: Number(e.target.value) }))}
                        className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                    >
                        {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium">Kode *</label>
                    <input
                        required
                        value={form.code}
                        onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono"
                        placeholder="A-3"
                    />
                </div>
                <div>
                    <label className="text-xs font-medium">Nama *</label>
                    <input
                        required
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                        placeholder="Rak 3 Area Stand"
                    />
                </div>
            </div>
            <div>
                <label className="text-xs font-medium">Catatan</label>
                <input
                    value={form.notes ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                    placeholder="Opsional — mis. barang besar, pintu belakang, dll"
                />
            </div>
            <label className="inline-flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                Aktif
            </label>
            {error && <div className="text-xs text-red-600">{error}</div>}
            <div>
                <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded text-sm hover:opacity-90 disabled:opacity-50"
                >
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Simpan
                </button>
            </div>
        </form>
    );
}
