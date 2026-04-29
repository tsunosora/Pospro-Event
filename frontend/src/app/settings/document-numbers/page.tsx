"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hash, Pencil, Save, X, Loader2, AlertTriangle } from "lucide-react";
import { listDocCounters, setDocCounter, type DocumentNumberCounter } from "@/lib/api/document-numbers";

const toast = {
    success: (m: string) => alert(m),
    error: (m: string) => alert(m),
};

const DOC_TYPE_LABEL: Record<string, string> = {
    Pnwr: "Penawaran",
    INV: "Invoice",
    RAB: "RAB",
};

export default function DocumentNumbersSettingsPage() {
    const qc = useQueryClient();
    const [yearFilter, setYearFilter] = useState<number | "">(new Date().getFullYear());
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<number>(0);

    const { data: counters = [], isLoading } = useQuery({
        queryKey: ["doc-counters", yearFilter],
        queryFn: () => listDocCounters(yearFilter ? { year: yearFilter } : {}),
    });

    const setMut = useMutation({
        mutationFn: setDocCounter,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["doc-counters"] });
            setEditingKey(null);
            toast.success("Counter di-update");
        },
        onError: (e: any) => toast.error(e?.response?.data?.message || "Gagal update"),
    });

    const startEdit = (c: DocumentNumberCounter) => {
        setEditingKey(`${c.docType}|${c.kode}|${c.year}`);
        setEditValue(c.lastSeq);
    };

    const handleSave = (c: DocumentNumberCounter) => {
        if (editValue < 0) {
            toast.error("Nilai tidak boleh negatif");
            return;
        }
        setMut.mutate({
            docType: c.docType,
            kode: c.kode,
            year: c.year,
            lastSeq: editValue,
        });
    };

    // Group by year for cleaner display
    const grouped = counters.reduce<Record<number, DocumentNumberCounter[]>>((acc, c) => {
        (acc[c.year] ??= []).push(c);
        return acc;
    }, {});
    const years = Object.keys(grouped).map(Number).sort((a, b) => b - a);

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Hash className="h-6 w-6 text-blue-600" />
                    Nomor Urut Dokumen
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Kelola counter nomor urut surat penawaran, invoice, RAB, dll. Bisa reset / set manual.
                </p>
            </div>

            {/* Warning section */}
            <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                    <strong>Hati-hati saat edit counter.</strong> Angka di-set sebagai <b>nilai terakhir yang sudah dipakai</b>.
                    Quotation berikutnya akan dapat <code className="bg-white px-1 rounded">lastSeq + 1</code>.
                    Misal set ke <code className="bg-white px-1 rounded">99</code> → quotation berikutnya nomor <code className="bg-white px-1 rounded">100</code>.
                    Untuk skip ke nomor 100, set lastSeq = <b>99</b>.
                </div>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Tahun:</span>
                {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2, ""].map((y) => (
                    <button
                        key={String(y)}
                        onClick={() => setYearFilter(y as any)}
                        className={`px-3 py-1.5 rounded-md text-sm font-semibold ${yearFilter === y
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 hover:bg-gray-200"
                            }`}
                    >
                        {y === "" ? "Semua" : y}
                    </button>
                ))}
            </div>

            {/* List */}
            {isLoading && (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
                </div>
            )}

            {!isLoading && counters.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-slate-200 p-12 text-center text-muted-foreground">
                    Belum ada counter. Counter otomatis dibuat saat assign nomor pertama kali.
                </div>
            )}

            {years.map((year) => (
                <div key={year} className="rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b font-bold text-slate-900">
                        Tahun {year}
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50/50 text-xs uppercase tracking-wide text-slate-600">
                            <tr>
                                <th className="px-3 py-2 text-left">Tipe Dokumen</th>
                                <th className="px-3 py-2 text-left">Kode (Brand)</th>
                                <th className="px-3 py-2 text-right">Last Seq (sudah dipakai)</th>
                                <th className="px-3 py-2 text-right">Next Number</th>
                                <th className="px-3 py-2 text-center w-[120px]">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grouped[year].map((c) => {
                                const key = `${c.docType}|${c.kode}|${c.year}`;
                                const isEditing = editingKey === key;
                                return (
                                    <tr key={c.id} className="border-t border-slate-100">
                                        <td className="px-3 py-2.5">
                                            <div className="font-medium">{DOC_TYPE_LABEL[c.docType] ?? c.docType}</div>
                                            <div className="text-[11px] text-muted-foreground font-mono">{c.docType}</div>
                                        </td>
                                        <td className="px-3 py-2.5 font-mono font-bold">{c.kode}</td>
                                        <td className="px-3 py-2.5 text-right">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                                                    className="w-24 border-2 rounded px-2 py-1 text-right font-mono text-sm focus:border-blue-500 outline-none"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className="font-mono font-semibold">{c.lastSeq}</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-sm text-blue-700 font-bold">
                                            {(isEditing ? editValue : c.lastSeq) + 1}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center justify-center gap-1">
                                                {isEditing ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleSave(c)}
                                                            disabled={setMut.isPending}
                                                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                                                        >
                                                            {setMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingKey(null)}
                                                            className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => startEdit(c)}
                                                        className="inline-flex items-center gap-1 px-2 py-1 text-amber-700 hover:bg-amber-50 rounded text-xs"
                                                    >
                                                        <Pencil className="h-3 w-3" /> Edit
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ))}

            {/* Info */}
            <div className="rounded-lg border bg-slate-50 p-4 text-xs text-slate-700 space-y-2">
                <h3 className="font-bold text-slate-900">📚 Penjelasan Counter</h3>
                <ul className="space-y-1.5 list-disc pl-5">
                    <li><b>Pnwr</b> — Penawaran (surat penawaran). Counter terpisah per brand-code (Ep / Xp / dll) dan per tahun.</li>
                    <li><b>RAB</b> — Counter RAB global (tidak per brand).</li>
                    <li><b>INV</b> — Invoice (kalau ada).</li>
                    <li>Counter <b>otomatis dibuat</b> saat pertama kali assign nomor untuk kombinasi (docType, kode, year).</li>
                    <li>Awal tahun baru: counter <b>otomatis reset ke 0</b> karena tahun masuk ke unique key.</li>
                    <li>Manual edit dipakai untuk: skip ke nomor tertentu, koreksi error, atau migrasi data.</li>
                </ul>
            </div>
        </div>
    );
}
