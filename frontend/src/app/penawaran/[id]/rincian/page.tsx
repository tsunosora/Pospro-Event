"use client";

import { use, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft, Plus, Trash2, Save, Eye, Download, Loader2, List, RotateCcw, GripVertical,
} from "lucide-react";
import {
    DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getQuotation, updateQuotation, downloadQuotationExport } from "@/lib/api/quotations";

type RincianRow = {
    _key: string;
    description: string;
    volume: string;
    unit: string;
    note: string;
};

let keyCounter = 0;
const newKey = () => `r-${keyCounter++}-${Date.now()}`;

export default function RincianPekerjaanPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = use(params);
    const id = parseInt(idStr, 10);
    const qc = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ["quotation", id],
        queryFn: () => getQuotation(id),
    });

    const [rows, setRows] = useState<RincianRow[]>([]);
    const [installDate, setInstallDate] = useState("");
    const [dismantleDate, setDismantleDate] = useState("");
    const [loaded, setLoaded] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);

    // Seed rows dari data — snapshot tersimpan kalau ada, kalau belum ada seed dari item penawaran.
    const seedFromPenawaran = (d: NonNullable<typeof data>): RincianRow[] =>
        (d.items ?? []).map((it) => ({
            _key: newKey(),
            description: String(it.description ?? ""),
            volume: it.quantity != null ? String(it.quantity) : "",
            unit: String(it.unit ?? ""),
            note: "",
        }));

    useEffect(() => {
        if (!data || loaded) return;
        const stored = Array.isArray(data.rincianPekerjaanItems) ? data.rincianPekerjaanItems : null;
        setRows(
            stored && stored.length > 0
                ? stored.map((r) => ({
                      _key: newKey(),
                      description: String(r?.description ?? ""),
                      volume: String(r?.volume ?? ""),
                      unit: String(r?.unit ?? ""),
                      note: String(r?.note ?? ""),
                  }))
                : seedFromPenawaran(data),
        );
        setInstallDate(data.rincianInstallDate ? String(data.rincianInstallDate).slice(0, 10) : "");
        setDismantleDate(data.rincianDismantleDate ? String(data.rincianDismantleDate).slice(0, 10) : "");
        setLoaded(true);
    }, [data, loaded]);

    const saveMut = useMutation({
        mutationFn: () =>
            updateQuotation(id, {
                rincianPekerjaanItems: rows
                    .map((r) => ({
                        description: r.description.trim(),
                        volume: r.volume.trim() || null,
                        unit: r.unit.trim() || null,
                        note: r.note.trim() || null,
                    }))
                    .filter((r) => r.description.length > 0),
                rincianInstallDate: installDate || null,
                rincianDismantleDate: dismantleDate || null,
            } as any),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["quotation", id] });
        },
        onError: (err: any) => alert("Gagal simpan: " + (err?.response?.data?.message || err.message)),
    });

    // --- Row ops ---
    const patchRow = (key: string, patch: Partial<RincianRow>) =>
        setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));
    const addRow = () =>
        setRows((prev) => [...prev, { _key: newKey(), description: "", volume: "", unit: "", note: "" }]);
    const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r._key !== key));
    const resetFromPenawaran = () => {
        if (!data) return;
        if (rows.length > 0 && !confirm("Ganti seluruh daftar dengan item penawaran? Perubahan yang belum disimpan akan hilang.")) return;
        setRows(seedFromPenawaran(data));
    };

    // --- Drag & drop (dnd-kit) — drag setelah geser 6px supaya tidak konflik dengan klik input. ---
    const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
    const handleDragEnd = (e: DragEndEvent) => {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        setRows((prev) => {
            const oldIdx = prev.findIndex((r) => r._key === String(active.id));
            const newIdx = prev.findIndex((r) => r._key === String(over.id));
            if (oldIdx < 0 || newIdx < 0) return prev;
            return arrayMove(prev, oldIdx, newIdx);
        });
    };

    // --- PDF ---
    const openPdf = async (mode: "preview" | "download") => {
        setPreviewLoading(true);
        try {
            const { blob, filename } = await downloadQuotationExport(id, "rincian-pekerjaan-pdf");
            const url = URL.createObjectURL(blob);
            if (mode === "preview") {
                window.open(url, "_blank");
            } else {
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                a.click();
            }
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (err: any) {
            alert("Gagal buka PDF: " + (err?.response?.data?.message || err.message));
        } finally {
            setPreviewLoading(false);
        }
    };

    if (isLoading || !data) {
        return (
            <div className="p-6 flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Memuat…
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <Link
                        href={`/penawaran/${id}`}
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="w-4 h-4" /> Penawaran
                    </Link>
                    <div>
                        <h1 className="font-bold text-lg flex items-center gap-2">
                            <List className="w-5 h-5 text-warning" /> Rincian Pekerjaan
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            {data.invoiceNumber}
                            {data.projectName && <span> · {data.projectName}</span>}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => openPdf("preview")}
                        disabled={previewLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-warning/10 hover:bg-warning/20 text-warning border border-warning/30 rounded-md text-sm font-medium disabled:opacity-50"
                    >
                        {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} Preview
                    </button>
                    <button
                        onClick={() => openPdf("download")}
                        disabled={previewLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-warning hover:bg-warning/90 text-white rounded-md text-sm font-medium disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" /> PDF
                    </button>
                </div>
            </div>

            {/* Info: dokumen terpisah dari penawaran */}
            <p className="text-[12px] text-muted-foreground bg-muted/50 rounded px-3 py-2 border border-border">
                ℹ️ Daftar ini di-<b>seed</b> dari item penawaran saat pertama dibuka, lalu jadi dokumen tersendiri yang bisa kamu edit bebas
                (tambah / edit / seret untuk urutkan / hapus). Mengeditnya <b>tidak mengubah item penawaran</b>.
            </p>

            {/* Jadwal pasang/bongkar */}
            <div className="grid grid-cols-2 gap-3 max-w-md">
                <label className="text-xs">
                    <span className="block font-semibold text-warning mb-1">Tanggal Pasang</span>
                    <input
                        type="date"
                        value={installDate}
                        onChange={(e) => setInstallDate(e.target.value)}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                    />
                </label>
                <label className="text-xs">
                    <span className="block font-semibold text-warning mb-1">Tanggal Bongkar</span>
                    <input
                        type="date"
                        value={dismantleDate}
                        onChange={(e) => setDismantleDate(e.target.value)}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                    />
                </label>
            </div>

            {/* Tabel item */}
            <div className="bg-card rounded-xl border overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
                    <h2 className="font-semibold text-sm flex items-center gap-1.5">
                        Item Pekerjaan
                        <span className="px-1.5 py-0.5 bg-warning/20 rounded text-[10px] font-bold">{rows.length}</span>
                    </h2>
                    <button
                        onClick={resetFromPenawaran}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        title="Ganti seluruh daftar dengan item penawaran terkini"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset dari penawaran
                    </button>
                </div>

                {/* Kolom header */}
                <div className="hidden md:flex gap-2 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground border-b bg-muted/20">
                    <span className="w-5" />
                    <span className="w-8 text-center">No</span>
                    <span className="flex-1">Uraian Pekerjaan</span>
                    <span className="w-20">Volume</span>
                    <span className="w-24">Satuan</span>
                    <span className="flex-1">Keterangan</span>
                    <span className="w-8 text-center">Aksi</span>
                </div>

                {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic px-3 py-6 text-center">
                        Belum ada item. Klik "Tambah Baris" atau "Reset dari penawaran".
                    </p>
                ) : (
                    <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={rows.map((r) => r._key)} strategy={verticalListSortingStrategy}>
                            <div className="divide-y">
                                {rows.map((r, idx) => (
                                    <SortableRow
                                        key={r._key}
                                        row={r}
                                        index={idx}
                                        onPatch={patchRow}
                                        onRemove={removeRow}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}

                <div className="px-3 py-2 border-t">
                    <button
                        onClick={addRow}
                        className="w-full px-2 py-1.5 text-sm bg-warning/10 hover:bg-warning/20 text-warning rounded font-medium border border-warning/30"
                    >
                        <Plus className="w-4 h-4 inline" /> Tambah Baris
                    </button>
                </div>
            </div>

            {/* Save bar */}
            <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-background/80 backdrop-blur py-2">
                <button
                    onClick={() => saveMut.mutate()}
                    disabled={saveMut.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-semibold disabled:opacity-50"
                >
                    {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saveMut.isSuccess && !saveMut.isPending ? "Tersimpan ✓" : "Simpan Rincian"}
                </button>
            </div>
        </div>
    );
}

/** Satu baris item yang bisa di-drag (dnd-kit). Grip di kiri = handle drag; input tetap bisa diklik. */
function SortableRow({
    row,
    index,
    onPatch,
    onRemove,
}: {
    row: RincianRow;
    index: number;
    onPatch: (key: string, patch: Partial<RincianRow>) => void;
    onRemove: (key: string) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row._key });
    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 10 : undefined,
        position: "relative",
    };

    return (
        <div ref={setNodeRef} style={style} className="flex flex-col md:flex-row gap-2 px-3 py-2 items-start bg-card">
            <button
                type="button"
                {...attributes}
                {...listeners}
                className="w-5 pt-1.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none hidden md:block"
                title="Seret untuk urutkan"
                aria-label="Seret untuk urutkan"
            >
                <GripVertical className="w-4 h-4" />
            </button>
            <span className="w-8 text-center text-sm text-muted-foreground pt-1.5 hidden md:block">{index + 1}</span>
            <input
                type="text"
                value={row.description}
                onChange={(e) => onPatch(row._key, { description: e.target.value })}
                placeholder="Uraian pekerjaan"
                className="flex-1 w-full border rounded px-2 py-1.5 text-sm"
            />
            <input
                type="text"
                value={row.volume}
                onChange={(e) => onPatch(row._key, { volume: e.target.value })}
                placeholder="Vol"
                className="w-full md:w-20 border rounded px-2 py-1.5 text-sm"
            />
            <input
                type="text"
                value={row.unit}
                onChange={(e) => onPatch(row._key, { unit: e.target.value })}
                placeholder="Satuan"
                className="w-full md:w-24 border rounded px-2 py-1.5 text-sm"
            />
            <input
                type="text"
                value={row.note}
                onChange={(e) => onPatch(row._key, { note: e.target.value })}
                placeholder="Keterangan"
                className="flex-1 w-full border rounded px-2 py-1.5 text-sm"
            />
            <button
                onClick={() => onRemove(row._key)}
                className="w-8 flex justify-center p-1 rounded text-destructive hover:bg-destructive/12"
                title="Hapus"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}
