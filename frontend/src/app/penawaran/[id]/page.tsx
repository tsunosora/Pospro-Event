"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft, Plus, Trash2, Save, Hash, GitBranch, FileDown, FileText, Loader2,
} from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/id";
import {
    getQuotation, updateQuotation, assignQuotationNumber, reviseQuotation,
    downloadQuotationExport, type Quotation, type QuotationItem,
} from "@/lib/api/quotations";

dayjs.locale("id");

function rp(v: string | number) {
    return "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

type ItemRow = QuotationItem & { _key: string };

function keyed(items: QuotationItem[]): ItemRow[] {
    return items.map((it, idx) => ({ ...it, _key: `${it.id ?? "new"}-${idx}-${Math.random()}` }));
}

export default function PenawaranDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = use(params);
    const id = parseInt(idStr, 10);
    const qc = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ["quotation", id],
        queryFn: () => getQuotation(id),
    });

    const [clientName, setClientName] = useState("");
    const [clientCompany, setClientCompany] = useState("");
    const [clientAddress, setClientAddress] = useState("");
    const [clientPhone, setClientPhone] = useState("");
    const [clientEmail, setClientEmail] = useState("");
    const [projectName, setProjectName] = useState("");
    const [eventLocation, setEventLocation] = useState("");
    const [eventDateStart, setEventDateStart] = useState("");
    const [eventDateEnd, setEventDateEnd] = useState("");
    const [validUntil, setValidUntil] = useState("");
    const [taxRate, setTaxRate] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [dpPercent, setDpPercent] = useState(50);
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<ItemRow[]>([]);

    useEffect(() => {
        if (!data) return;
        setClientName(data.clientName ?? "");
        setClientCompany(data.clientCompany ?? "");
        setClientAddress(data.clientAddress ?? "");
        setClientPhone(data.clientPhone ?? "");
        setClientEmail(data.clientEmail ?? "");
        setProjectName(data.projectName ?? "");
        setEventLocation(data.eventLocation ?? "");
        setEventDateStart(data.eventDateStart ? data.eventDateStart.slice(0, 10) : "");
        setEventDateEnd(data.eventDateEnd ? data.eventDateEnd.slice(0, 10) : "");
        setValidUntil(data.validUntil ? data.validUntil.slice(0, 10) : "");
        setTaxRate(Number(data.taxRate ?? 0));
        setDiscount(Number(data.discount ?? 0));
        setDpPercent(Number(data.dpPercent ?? 50));
        setNotes(data.notes ?? "");
        setItems(keyed(data.items ?? []));
    }, [data]);

    const showErr = (label: string) => (err: any) =>
        alert(`${label}: ${err?.response?.data?.message || err?.message || "gagal"}`);

    const saveMut = useMutation({
        mutationFn: (payload: any) => updateQuotation(id, payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["quotation", id] }),
        onError: showErr("Gagal simpan"),
    });
    const assignMut = useMutation({
        mutationFn: () => assignQuotationNumber(id),
        onSuccess: (q: Quotation) => {
            qc.invalidateQueries({ queryKey: ["quotation", id] });
            alert(`Nomor resmi: ${q.invoiceNumber}`);
        },
        onError: showErr("Gagal assign nomor"),
    });
    const reviseMut = useMutation({
        mutationFn: () => reviseQuotation(id),
        onSuccess: (q: Quotation) => {
            qc.invalidateQueries({ queryKey: ["quotations"] });
            window.location.href = `/penawaran/${q.id}`;
        },
        onError: showErr("Gagal buat revisi"),
    });

    const subtotal = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.price || 0), 0);
    const taxAmount = (subtotal * (taxRate || 0)) / 100;
    const total = subtotal + taxAmount - (discount || 0);
    const dpAmount = (total * dpPercent) / 100;

    const addItem = () =>
        setItems([
            ...items,
            { _key: `new-${Date.now()}`, description: "", unit: "", quantity: 1, price: 0 },
        ]);
    const updateItem = (k: string, patch: Partial<QuotationItem>) =>
        setItems(items.map((it) => (it._key === k ? { ...it, ...patch } : it)));
    const removeItem = (k: string) => setItems(items.filter((it) => it._key !== k));

    const handleSave = () => {
        saveMut.mutate({
            clientName,
            clientCompany,
            clientAddress,
            clientPhone,
            clientEmail,
            projectName,
            eventLocation,
            eventDateStart: eventDateStart || undefined,
            eventDateEnd: eventDateEnd || undefined,
            validUntil: validUntil || undefined,
            taxRate,
            discount,
            dpPercent,
            notes,
            items: items.map((it, idx) => ({
                description: it.description,
                unit: it.unit || undefined,
                quantity: it.quantity,
                price: it.price,
                orderIndex: idx,
                productVariantId: it.productVariantId ?? null,
            })),
        });
    };

    const handleExport = async (format: "pdf" | "docx") => {
        try {
            const blob = await downloadQuotationExport(id, format);
            const url = URL.createObjectURL(blob);
            if (format === "pdf") {
                window.open(url, "_blank");
            } else {
                const a = document.createElement("a");
                a.href = url;
                a.download = `Penawaran_${(data?.invoiceNumber ?? id).toString().replace(/[^a-zA-Z0-9._-]+/g, "_")}.${format}`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            }
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (err: any) {
            alert("Gagal export: " + (err?.response?.data?.message || err.message));
        }
    };

    if (isLoading || !data) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        );
    }

    const isDraft = data.invoiceNumber.startsWith("DRAFT-");

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-start justify-between mb-6">
                <div>
                    <Link href="/penawaran" className="text-sm text-blue-600 flex items-center gap-1 mb-2">
                        <ArrowLeft className="w-4 h-4" /> Kembali
                    </Link>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        Penawaran {data.invoiceNumber}
                        {data.revisionNumber > 0 && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Rev. {data.revisionNumber}</span>
                        )}
                    </h1>
                    <p className="text-sm text-gray-600">
                        {data.quotationVariant === "PENGADAAN_BOOTH" ? "Pengadaan Booth Special Design" : "Sewa Perlengkapan Event"}
                    </p>
                </div>
                <div className="flex gap-2">
                    {isDraft && (
                        <button
                            onClick={() => assignMut.mutate()}
                            disabled={assignMut.isPending}
                            className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm"
                        >
                            <Hash className="w-4 h-4" /> Assign Nomor
                        </button>
                    )}
                    {!isDraft && (
                        <button
                            onClick={() => reviseMut.mutate()}
                            disabled={reviseMut.isPending}
                            className="flex items-center gap-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm"
                        >
                            <GitBranch className="w-4 h-4" /> Buat Revisi
                        </button>
                    )}
                    <button
                        onClick={() => handleExport("pdf")}
                        className="flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm"
                    >
                        <FileDown className="w-4 h-4" /> PDF
                    </button>
                    <button
                        onClick={() => handleExport("docx")}
                        className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
                    >
                        <FileText className="w-4 h-4" /> DOCX
                    </button>
                </div>
            </div>

            {data.parent && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
                    Dokumen ini revisi dari{" "}
                    <Link href={`/penawaran/${data.parent.id}`} className="text-blue-600 hover:underline font-medium">
                        {data.parent.invoiceNumber}
                    </Link>
                </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
                <section className="bg-white rounded-lg border p-4 space-y-3">
                    <h3 className="font-semibold mb-2">Data Klien</h3>
                    <Field label="Nama PIC" value={clientName} onChange={setClientName} />
                    <Field label="Perusahaan" value={clientCompany} onChange={setClientCompany} />
                    <Field label="Alamat" value={clientAddress} onChange={setClientAddress} multiline />
                    <Field label="Telepon" value={clientPhone} onChange={setClientPhone} />
                    <Field label="Email" value={clientEmail} onChange={setClientEmail} />
                </section>

                <section className="bg-white rounded-lg border p-4 space-y-3">
                    <h3 className="font-semibold mb-2">Event / Proyek</h3>
                    <Field label="Nama Proyek" value={projectName} onChange={setProjectName} />
                    <Field label="Lokasi" value={eventLocation} onChange={setEventLocation} />
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Tanggal Mulai" value={eventDateStart} onChange={setEventDateStart} type="date" />
                        <Field label="Tanggal Selesai" value={eventDateEnd} onChange={setEventDateEnd} type="date" />
                    </div>
                    <Field label="Berlaku Sampai" value={validUntil} onChange={setValidUntil} type="date" />
                </section>
            </div>

            <section className="bg-white rounded-lg border p-4 mt-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Rincian Item</h3>
                    <button
                        onClick={addItem}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
                    >
                        <Plus className="w-4 h-4" /> Tambah Item
                    </button>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-700">
                        <tr>
                            <th className="px-2 py-1.5">Uraian</th>
                            <th className="px-2 py-1.5 w-24">Qty</th>
                            <th className="px-2 py-1.5 w-24">Satuan</th>
                            <th className="px-2 py-1.5 w-32">Harga Satuan</th>
                            <th className="px-2 py-1.5 w-32 text-right">Subtotal</th>
                            <th className="w-8"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => {
                            const sub = Number(it.quantity || 0) * Number(it.price || 0);
                            return (
                                <tr key={it._key} className="border-t">
                                    <td className="px-2 py-1">
                                        <input
                                            value={it.description}
                                            onChange={(e) => updateItem(it._key, { description: e.target.value })}
                                            className="w-full border rounded px-2 py-1"
                                        />
                                    </td>
                                    <td className="px-2 py-1">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={Number(it.quantity)}
                                            onChange={(e) => updateItem(it._key, { quantity: parseFloat(e.target.value) || 0 })}
                                            className="w-full border rounded px-2 py-1 text-right"
                                        />
                                    </td>
                                    <td className="px-2 py-1">
                                        <input
                                            value={it.unit ?? ""}
                                            onChange={(e) => updateItem(it._key, { unit: e.target.value })}
                                            placeholder="unit/hari"
                                            className="w-full border rounded px-2 py-1"
                                        />
                                    </td>
                                    <td className="px-2 py-1">
                                        <input
                                            type="number"
                                            value={Number(it.price)}
                                            onChange={(e) => updateItem(it._key, { price: parseFloat(e.target.value) || 0 })}
                                            className="w-full border rounded px-2 py-1 text-right"
                                        />
                                    </td>
                                    <td className="px-2 py-1 text-right font-mono">{rp(sub)}</td>
                                    <td className="px-2 py-1 text-center">
                                        <button
                                            onClick={() => removeItem(it._key)}
                                            className="text-red-600 hover:bg-red-50 p-1 rounded"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-center py-6 text-gray-400">
                                    Belum ada item. Klik "Tambah Item".
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
                <section className="bg-white rounded-lg border p-4 space-y-3">
                    <h3 className="font-semibold mb-2">Pajak &amp; Pembayaran</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="PPN (%)" value={String(taxRate)} onChange={(v) => setTaxRate(parseFloat(v) || 0)} type="number" />
                        <Field label="Diskon (Rp)" value={String(discount)} onChange={(v) => setDiscount(parseFloat(v) || 0)} type="number" />
                    </div>
                    <Field label="DP (%)" value={String(dpPercent)} onChange={(v) => setDpPercent(parseFloat(v) || 0)} type="number" />
                    <Field label="Catatan / Terms" value={notes} onChange={setNotes} multiline />
                </section>

                <section className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold mb-2">Ringkasan</h3>
                    <table className="w-full text-sm">
                        <tbody>
                            <Row label="Subtotal" value={rp(subtotal)} />
                            {discount > 0 && <Row label="Diskon" value={`- ${rp(discount)}`} />}
                            <Row label={`PPN ${taxRate}%`} value={rp(taxAmount)} />
                            <tr className="border-t font-bold text-lg">
                                <td className="py-2">Grand Total</td>
                                <td className="py-2 text-right">{rp(total)}</td>
                            </tr>
                            <Row label={`DP ${dpPercent}%`} value={rp(dpAmount)} />
                            <Row label="Pelunasan" value={rp(total - dpAmount)} />
                        </tbody>
                    </table>
                </section>
            </div>

            <div className="flex justify-end mt-6">
                <button
                    onClick={handleSave}
                    disabled={saveMut.isPending}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50"
                >
                    <Save className="w-4 h-4" /> {saveMut.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
            </div>
        </div>
    );
}

function Field({
    label, value, onChange, type = "text", multiline,
}: {
    label: string; value: string; onChange: (v: string) => void; type?: string; multiline?: boolean;
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            {multiline ? (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    rows={2}
                    className="w-full border rounded-md px-3 py-1.5 text-sm"
                />
            ) : (
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full border rounded-md px-3 py-1.5 text-sm"
                />
            )}
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <tr>
            <td className="py-1 text-gray-600">{label}</td>
            <td className="py-1 text-right">{value}</td>
        </tr>
    );
}
