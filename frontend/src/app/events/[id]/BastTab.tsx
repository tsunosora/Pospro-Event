"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, Eye, Loader2, Save, FileText, Info, Plus, Trash2, Download } from "lucide-react";
import {
    getEvent, updateEvent, downloadBastPdf, getBastPdfObjectUrl,
    getBastItems, getBastItemSuggestions, replaceBastItems,
    type BastItemInput,
} from "@/lib/api/events";
import { getWorkers } from "@/lib/api/workers";
import BastSourcePicker from "./BastSourcePicker";

type BastForm = {
    bastNumber: string;
    bastDate: string;
    bastReceiverName: string;
    bastReceiverPosition: string;
    bastNotes: string;
    bastSignedByWorkerId: string; // "" = default PIC
};

const EMPTY: BastForm = {
    bastNumber: "",
    bastDate: "",
    bastReceiverName: "",
    bastReceiverPosition: "",
    bastNotes: "",
    bastSignedByWorkerId: "",
};

type Row = { description: string; quantity: string; condition: string };

/** ISO datetime → "YYYY-MM-DD" untuk <input type="date">. */
const toDateInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

export default function BastTab({ eventId }: { eventId: number }) {
    const qc = useQueryClient();
    const { data: event, isLoading } = useQuery({
        queryKey: ["event", eventId],
        queryFn: () => getEvent(eventId),
    });
    const { data: items } = useQuery({
        queryKey: ["bast-items", eventId],
        queryFn: () => getBastItems(eventId),
    });
    const { data: workers } = useQuery({
        queryKey: ["workers", "all"],
        queryFn: () => getWorkers(true),
    });

    const [form, setForm] = useState<BastForm>(EMPTY);
    const [rows, setRows] = useState<Row[]>([]);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [importing, setImporting] = useState<"rab" | "quotation" | null>(null);
    const [picker, setPicker] = useState<"rab" | "quotation" | null>(null);

    // Sinkronkan form dari data event.
    useEffect(() => {
        if (!event) return;
        setForm({
            bastNumber: event.bastNumber ?? "",
            bastDate: toDateInput(event.bastDate),
            bastReceiverName: event.bastReceiverName ?? "",
            bastReceiverPosition: event.bastReceiverPosition ?? "",
            bastNotes: event.bastNotes ?? "",
            bastSignedByWorkerId: event.bastSignedByWorkerId != null ? String(event.bastSignedByWorkerId) : "",
        });
    }, [event]);

    // Sinkronkan rows dari item tersimpan.
    useEffect(() => {
        if (!items) return;
        setRows(items.map((it) => ({
            description: it.description,
            quantity: it.quantity ?? "",
            condition: it.condition ?? "",
        })));
    }, [items]);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const save = useMutation({
        mutationFn: async () => {
            await updateEvent(eventId, {
                bastNumber: form.bastNumber.trim() || null,
                bastDate: form.bastDate || null,
                bastReceiverName: form.bastReceiverName.trim() || null,
                bastReceiverPosition: form.bastReceiverPosition.trim() || null,
                bastNotes: form.bastNotes.trim() || null,
                bastSignedByWorkerId: form.bastSignedByWorkerId ? Number(form.bastSignedByWorkerId) : null,
            });
            const payload: BastItemInput[] = rows
                .filter((r) => r.description.trim())
                .map((r) => ({
                    description: r.description.trim(),
                    quantity: r.quantity.trim() || null,
                    condition: r.condition.trim() || null,
                }));
            await replaceBastItems(eventId, payload);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["event", eventId] });
            qc.invalidateQueries({ queryKey: ["bast-items", eventId] });
        },
    });

    const handlePicked = async (source: "rab" | "quotation", refId: number) => {
        const label = source === "quotation" ? "penawaran" : "RAB";
        if (rows.some((r) => r.description.trim()) &&
            !confirm(`Ganti daftar item saat ini dengan item dari ${label} ini?`)) return;
        setPicker(null);
        setImporting(source);
        try {
            const sug = await getBastItemSuggestions(eventId, source, refId);
            if (!sug.length) {
                alert(`${label === "penawaran" ? "Penawaran" : "RAB"} ini tidak punya item.`);
                return;
            }
            setRows(sug.map((s) => ({
                description: s.description,
                quantity: s.quantity ?? "",
                condition: s.condition ?? "",
            })));
        } catch {
            alert(`Gagal mengambil item dari ${label}.`);
        } finally {
            setImporting(null);
        }
    };

    const handlePreview = async () => {
        setPreviewing(true);
        try {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            const url = await getBastPdfObjectUrl(eventId);
            setPreviewUrl(url);
        } catch {
            alert("Gagal memuat preview BAST.");
        } finally {
            setPreviewing(false);
        }
    };

    const handleDownload = async () => {
        setDownloading(true);
        try {
            await downloadBastPdf(eventId);
        } catch {
            alert("Gagal mengunduh BAST.");
        } finally {
            setDownloading(false);
        }
    };

    const setRow = (i: number, patch: Partial<Row>) =>
        setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    const addRow = () => setRows((rs) => [...rs, { description: "", quantity: "", condition: "" }]);
    const delRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 p-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
            </div>
        );
    }

    const inputCls =
        "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
    const cellCls =
        "w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

    return (
        <>
        <div className="grid gap-6 xl:grid-cols-2">
            {/* Form + item editor */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4" /> Berita Acara Serah Terima (BAST)
                </div>

                <div className="flex items-start gap-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                        Isi daftar item yang diserahterimakan di tabel bawah. Kosongkan field opsional untuk memakai
                        nilai default (mis. nomor <code>BAST-{event?.code}</code>). Gunakan <b>Isi dari RAB</b> atau
                        <b> Isi dari Penawaran</b> untuk menyalin item lalu edit sesukanya.
                    </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm">
                        <span className="mb-1 block font-medium">Nomor BAST</span>
                        <input className={inputCls} placeholder={`BAST-${event?.code ?? ""}`}
                            value={form.bastNumber}
                            onChange={(e) => setForm((f) => ({ ...f, bastNumber: e.target.value }))} />
                    </label>
                    <label className="text-sm">
                        <span className="mb-1 block font-medium">Tanggal Serah Terima</span>
                        <input type="date" className={inputCls} value={form.bastDate}
                            onChange={(e) => setForm((f) => ({ ...f, bastDate: e.target.value }))} />
                    </label>
                    <label className="text-sm">
                        <span className="mb-1 block font-medium">Nama Penerima (Klien)</span>
                        <input className={inputCls} placeholder={event?.customer?.name ?? "Nama penerima"}
                            value={form.bastReceiverName}
                            onChange={(e) => setForm((f) => ({ ...f, bastReceiverName: e.target.value }))} />
                    </label>
                    <label className="text-sm">
                        <span className="mb-1 block font-medium">Jabatan Penerima</span>
                        <input className={inputCls} placeholder="mis. Manajer Proyek"
                            value={form.bastReceiverPosition}
                            onChange={(e) => setForm((f) => ({ ...f, bastReceiverPosition: e.target.value }))} />
                    </label>
                    <label className="text-sm sm:col-span-2">
                        <span className="mb-1 block font-medium">Penanda Tangan Vendor (Pihak Pertama)</span>
                        <select className={inputCls} value={form.bastSignedByWorkerId}
                            onChange={(e) => setForm((f) => ({ ...f, bastSignedByWorkerId: e.target.value }))}>
                            <option value="">Default (PIC event)</option>
                            {(workers ?? []).map((w) => (
                                <option key={w.id} value={w.id}>
                                    {w.name}{w.position ? ` — ${w.position}` : ""}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <label className="block text-sm">
                    <span className="mb-1 block font-medium">Catatan</span>
                    <textarea className={inputCls} rows={2}
                        placeholder="Catatan / keterangan tambahan (opsional)"
                        value={form.bastNotes}
                        onChange={(e) => setForm((f) => ({ ...f, bastNotes: e.target.value }))} />
                </label>

                {/* Tabel item editable */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Daftar Item Serah Terima</span>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => setPicker("rab")} disabled={importing !== null}
                                className="inline-flex items-center gap-1 rounded border border-input px-2 py-1 text-xs hover:bg-muted disabled:opacity-60">
                                {importing === "rab" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                Isi dari RAB
                            </button>
                            <button onClick={() => setPicker("quotation")} disabled={importing !== null}
                                className="inline-flex items-center gap-1 rounded border border-input px-2 py-1 text-xs hover:bg-muted disabled:opacity-60">
                                {importing === "quotation" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                Isi dari Penawaran
                            </button>
                            <button onClick={addRow}
                                className="inline-flex items-center gap-1 rounded border border-input px-2 py-1 text-xs hover:bg-muted">
                                <Plus className="h-3.5 w-3.5" /> Tambah
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto rounded-md border border-input">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/60 text-xs text-muted-foreground">
                                <tr>
                                    <th className="w-8 px-2 py-1.5 text-center">#</th>
                                    <th className="px-2 py-1.5 text-left">Uraian</th>
                                    <th className="w-24 px-2 py-1.5 text-left">Qty</th>
                                    <th className="px-2 py-1.5 text-left">Kondisi/Keterangan</th>
                                    <th className="w-8 px-2 py-1.5"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-4 text-center text-xs text-muted-foreground">
                                            Belum ada item. Klik <b>Tambah</b> atau <b>Isi dari RAB</b>.
                                        </td>
                                    </tr>
                                )}
                                {rows.map((r, i) => (
                                    <tr key={i} className="border-t border-input/60">
                                        <td className="px-2 py-1 text-center text-xs text-muted-foreground">{i + 1}</td>
                                        <td className="px-2 py-1">
                                            <input className={cellCls} value={r.description}
                                                onChange={(e) => setRow(i, { description: e.target.value })} />
                                        </td>
                                        <td className="px-2 py-1">
                                            <input className={cellCls} value={r.quantity} placeholder="2 unit"
                                                onChange={(e) => setRow(i, { quantity: e.target.value })} />
                                        </td>
                                        <td className="px-2 py-1">
                                            <input className={cellCls} value={r.condition} placeholder="Baik / lengkap"
                                                onChange={(e) => setRow(i, { condition: e.target.value })} />
                                        </td>
                                        <td className="px-2 py-1 text-center">
                                            <button onClick={() => delRow(i)}
                                                className="text-muted-foreground hover:text-destructive" title="Hapus baris">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button onClick={() => save.mutate()} disabled={save.isPending}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Simpan
                    </button>
                    <button onClick={handlePreview} disabled={previewing}
                        className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60">
                        {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                        Preview
                    </button>
                    <button onClick={handleDownload} disabled={downloading}
                        className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60">
                        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                        Download PDF
                    </button>
                </div>
                {save.isSuccess && !save.isPending && (
                    <p className="text-xs text-green-600">Tersimpan. Klik Preview untuk melihat hasil terbaru.</p>
                )}
                {save.isError && (
                    <p className="text-xs text-destructive">Gagal menyimpan. Coba lagi.</p>
                )}
            </div>

            {/* Preview */}
            <div className="min-h-[400px] rounded-md border border-input bg-muted/30">
                {previewUrl ? (
                    <iframe title="Preview BAST" src={previewUrl} className="h-[640px] w-full rounded-md" />
                ) : (
                    <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
                        <FileText className="h-8 w-8 opacity-40" />
                        <span>Simpan dulu, lalu klik <b>Preview</b> untuk menampilkan dokumen BAST.</span>
                    </div>
                )}
            </div>
        </div>

        {picker && (
            <BastSourcePicker
                source={picker}
                onPick={(refId) => handlePicked(picker, refId)}
                onClose={() => setPicker(null)}
            />
        )}
        </>
    );
}
