"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus, FileText, FileDown, Pencil, Trash2, Loader2, GitBranch, Hash,
} from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/id";
import {
    getQuotations, createQuotation, deleteQuotation,
    assignQuotationNumber, reviseQuotation, downloadQuotationExport,
    type Quotation, type QuotationVariant,
} from "@/lib/api/quotations";

dayjs.locale("id");

const VARIANT_LABEL: Record<QuotationVariant, string> = {
    SEWA: "Sewa Perlengkapan Event",
    PENGADAAN_BOOTH: "Pengadaan Booth Special Design",
};

const STATUS_COLOR: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    SENT: "bg-blue-100 text-blue-700",
    ACCEPTED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    EXPIRED: "bg-yellow-100 text-yellow-700",
};

function rp(v: string | number) {
    return "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

export default function PenawaranListPage() {
    const qc = useQueryClient();
    const [variantFilter, setVariantFilter] = useState<QuotationVariant | "">("");
    const [showCreate, setShowCreate] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ["quotations", variantFilter],
        queryFn: () => getQuotations(variantFilter ? { variant: variantFilter } : {}),
    });

    const createMut = useMutation({
        mutationFn: createQuotation,
        onSuccess: (q: Quotation) => {
            qc.invalidateQueries({ queryKey: ["quotations"] });
            setShowCreate(false);
            window.location.href = `/penawaran/${q.id}`;
        },
    });

    const deleteMut = useMutation({
        mutationFn: deleteQuotation,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["quotations"] }),
    });

    const assignMut = useMutation({
        mutationFn: assignQuotationNumber,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["quotations"] }),
    });

    const reviseMut = useMutation({
        mutationFn: reviseQuotation,
        onSuccess: (q: Quotation) => {
            qc.invalidateQueries({ queryKey: ["quotations"] });
            window.location.href = `/penawaran/${q.id}`;
        },
    });

    const handleExport = async (id: number, format: "pdf" | "docx", invoiceNumber: string) => {
        try {
            const blob = await downloadQuotationExport(id, format);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Penawaran_${invoiceNumber.replace(/[^a-zA-Z0-9._-]+/g, "_")}.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            alert("Gagal export: " + (err?.response?.data?.message || err.message));
        }
    };

    const quotations: Quotation[] = data ?? [];

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileText className="w-6 h-6" /> Penawaran Booth &amp; Event
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Kelola dokumen Penawaran Sewa Perlengkapan Event &amp; Pengadaan Booth Special Design
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                    <Plus className="w-4 h-4" /> Buat Penawaran
                </button>
            </div>

            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setVariantFilter("")}
                    className={`px-3 py-1.5 rounded-md text-sm ${variantFilter === "" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
                >
                    Semua
                </button>
                <button
                    onClick={() => setVariantFilter("SEWA")}
                    className={`px-3 py-1.5 rounded-md text-sm ${variantFilter === "SEWA" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
                >
                    Sewa Perlengkapan
                </button>
                <button
                    onClick={() => setVariantFilter("PENGADAAN_BOOTH")}
                    className={`px-3 py-1.5 rounded-md text-sm ${variantFilter === "PENGADAAN_BOOTH" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
                >
                    Pengadaan Booth
                </button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16 text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...
                </div>
            ) : quotations.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
                    Belum ada penawaran. Klik "Buat Penawaran" untuk mulai.
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-700 text-left">
                            <tr>
                                <th className="px-3 py-2">No. Penawaran</th>
                                <th className="px-3 py-2">Varian</th>
                                <th className="px-3 py-2">Klien / Proyek</th>
                                <th className="px-3 py-2">Tanggal</th>
                                <th className="px-3 py-2 text-right">Total</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quotations.map((q) => (
                                <tr key={q.id} className="border-t hover:bg-gray-50">
                                    <td className="px-3 py-2 font-mono">
                                        <Link href={`/penawaran/${q.id}`} className="text-blue-600 hover:underline">
                                            {q.invoiceNumber}
                                        </Link>
                                        {q.revisionNumber > 0 && (
                                            <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 rounded">Rev. {q.revisionNumber}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                                            {q.quotationVariant ? VARIANT_LABEL[q.quotationVariant] : "-"}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="font-medium">{q.clientCompany || q.clientName}</div>
                                        {q.projectName && <div className="text-xs text-gray-500">{q.projectName}</div>}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600">{dayjs(q.date).format("DD MMM YYYY")}</td>
                                    <td className="px-3 py-2 text-right font-medium">{rp(q.total)}</td>
                                    <td className="px-3 py-2">
                                        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLOR[q.status] || "bg-gray-100"}`}>
                                            {q.status}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center justify-end gap-1">
                                            {q.invoiceNumber.startsWith("DRAFT-") && (
                                                <button
                                                    onClick={() => assignMut.mutate(q.id)}
                                                    disabled={assignMut.isPending}
                                                    title="Assign Nomor"
                                                    className="p-1.5 text-green-700 hover:bg-green-50 rounded"
                                                >
                                                    <Hash className="w-4 h-4" />
                                                </button>
                                            )}
                                            {!q.invoiceNumber.startsWith("DRAFT-") && (
                                                <button
                                                    onClick={() => reviseMut.mutate(q.id)}
                                                    disabled={reviseMut.isPending}
                                                    title="Buat Revisi"
                                                    className="p-1.5 text-amber-700 hover:bg-amber-50 rounded"
                                                >
                                                    <GitBranch className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleExport(q.id, "pdf", q.invoiceNumber)}
                                                title="Export PDF"
                                                className="p-1.5 text-red-700 hover:bg-red-50 rounded"
                                            >
                                                <FileDown className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleExport(q.id, "docx", q.invoiceNumber)}
                                                title="Export DOCX"
                                                className="p-1.5 text-blue-700 hover:bg-blue-50 rounded"
                                            >
                                                <FileText className="w-4 h-4" />
                                            </button>
                                            <Link
                                                href={`/penawaran/${q.id}`}
                                                className="p-1.5 text-gray-700 hover:bg-gray-100 rounded"
                                                title="Detail / Edit"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Link>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Hapus penawaran ${q.invoiceNumber}?`)) deleteMut.mutate(q.id);
                                                }}
                                                disabled={deleteMut.isPending}
                                                title="Hapus"
                                                className="p-1.5 text-red-700 hover:bg-red-50 rounded"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showCreate && (
                <CreateQuotationModal
                    onClose={() => setShowCreate(false)}
                    onSubmit={(data) => createMut.mutate(data)}
                    isPending={createMut.isPending}
                />
            )}
        </div>
    );
}

function CreateQuotationModal(props: {
    onClose: () => void;
    onSubmit: (data: any) => void;
    isPending: boolean;
}) {
    const [variant, setVariant] = useState<QuotationVariant>("SEWA");
    const [clientName, setClientName] = useState("");
    const [clientCompany, setClientCompany] = useState("");
    const [projectName, setProjectName] = useState("");
    const [eventLocation, setEventLocation] = useState("");

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-lg w-full p-6">
                <h2 className="text-lg font-bold mb-4">Buat Penawaran Baru</h2>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">Varian</label>
                        <select
                            value={variant}
                            onChange={(e) => setVariant(e.target.value as QuotationVariant)}
                            className="w-full border rounded-md px-3 py-2"
                        >
                            <option value="SEWA">Sewa Perlengkapan Event</option>
                            <option value="PENGADAAN_BOOTH">Pengadaan Booth Special Design</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Nama PIC Klien</label>
                        <input
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            className="w-full border rounded-md px-3 py-2"
                            placeholder="Contoh: Bpk. Marco"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Nama Perusahaan / Instansi</label>
                        <input
                            value={clientCompany}
                            onChange={(e) => setClientCompany(e.target.value)}
                            className="w-full border rounded-md px-3 py-2"
                            placeholder="PT / CV / event organizer"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Nama Proyek/Event</label>
                        <input
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            className="w-full border rounded-md px-3 py-2"
                            placeholder="Summer Musik Festival, PETFEST, dll."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Lokasi Event</label>
                        <input
                            value={eventLocation}
                            onChange={(e) => setEventLocation(e.target.value)}
                            className="w-full border rounded-md px-3 py-2"
                            placeholder="JEC, ICE BSD, dll."
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={props.onClose}
                        className="px-4 py-2 border rounded-md hover:bg-gray-50"
                    >
                        Batal
                    </button>
                    <button
                        disabled={!clientName || props.isPending}
                        onClick={() =>
                            props.onSubmit({
                                quotationVariant: variant,
                                clientName,
                                clientCompany: clientCompany || undefined,
                                projectName: projectName || undefined,
                                eventLocation: eventLocation || undefined,
                            })
                        }
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
                    >
                        {props.isPending ? "Menyimpan..." : "Simpan &amp; Lanjut"}
                    </button>
                </div>
            </div>
        </div>
    );
}
