"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Plus, Pencil, Trash2, Loader2, Save, X, Eye, EyeOff,
    FileText, Hash, Palette, AlignLeft, Percent,
} from "lucide-react";
import {
    listQuotationVariants, createQuotationVariant, updateQuotationVariant, deleteQuotationVariant,
    type QuotationVariantConfig, type TemplateKey, type UpsertVariantInput,
} from "@/lib/api/quotation-variants";

const toast = {
    success: (m: string) => alert(m),
    error: (m: string) => alert(m),
};

const TEMPLATE_OPTIONS: { value: TemplateKey; label: string; hint: string }[] = [
    { value: "pengadaan-booth", label: "Pengadaan / Special Design", hint: "Template merah, item per kategori, untuk produksi booth/proyek" },
    { value: "sewa", label: "Sewa Perlengkapan", hint: "Template untuk penyewaan perlengkapan event (sound, lighting, panggung)" },
];

export default function QuotationVariantsSettingsPage() {
    const qc = useQueryClient();
    const [showInactive, setShowInactive] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const { data: variants = [], isLoading } = useQuery({
        queryKey: ["quotation-variants", showInactive],
        queryFn: () => listQuotationVariants(showInactive),
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ["quotation-variants"] });

    const createMut = useMutation({
        mutationFn: createQuotationVariant,
        onSuccess: () => { invalidate(); resetForm(); toast.success("Varian dibuat"); },
        onError: (e: any) => toast.error(e?.response?.data?.message || "Gagal simpan"),
    });
    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<UpsertVariantInput> }) => updateQuotationVariant(id, data),
        onSuccess: () => { invalidate(); resetForm(); toast.success("Varian diupdate"); },
        onError: (e: any) => toast.error(e?.response?.data?.message || "Gagal simpan"),
    });
    const deleteMut = useMutation({
        mutationFn: deleteQuotationVariant,
        onSuccess: (res: any) => {
            invalidate();
            toast.success(res?.mode === "hard-delete" ? "Varian dihapus" : "Varian dinonaktifkan (sudah dipakai quotation)");
        },
    });
    const toggleActiveMut = useMutation({
        mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => updateQuotationVariant(id, { isActive }),
        onSuccess: invalidate,
    });

    const [code, setCode] = useState("");
    const [label, setLabel] = useState("");
    const [subject, setSubject] = useState("");
    const [templateKey, setTemplateKey] = useState<TemplateKey>("pengadaan-booth");
    const [defaultDpPercent, setDefaultDpPercent] = useState<number>(50);
    const [color, setColor] = useState("");
    const [description, setDescription] = useState("");
    const [orderIndex, setOrderIndex] = useState(0);

    function resetForm() {
        setShowForm(false);
        setEditingId(null);
        setCode(""); setLabel(""); setSubject("");
        setTemplateKey("pengadaan-booth"); setDefaultDpPercent(50);
        setColor(""); setDescription(""); setOrderIndex(0);
    }

    function startEdit(v: QuotationVariantConfig) {
        setEditingId(v.id);
        setCode(v.code);
        setLabel(v.label);
        setSubject(v.subject ?? "");
        setTemplateKey(v.templateKey);
        setDefaultDpPercent(Number(v.defaultDpPercent));
        setColor(v.color ?? "");
        setDescription(v.description ?? "");
        setOrderIndex(v.orderIndex);
        setShowForm(true);
    }

    function handleSave() {
        if (!code.trim()) { toast.error("Kode wajib diisi"); return; }
        if (!label.trim()) { toast.error("Label wajib diisi"); return; }
        const payload: UpsertVariantInput = {
            code: code.trim(),
            label: label.trim(),
            subject: subject.trim() || null,
            templateKey,
            defaultDpPercent,
            color: color.trim() || null,
            description: description.trim() || null,
            orderIndex,
        };
        if (editingId) updateMut.mutate({ id: editingId, data: payload });
        else createMut.mutate(payload);
    }

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileText className="h-6 w-6 text-violet-600" />
                        Varian Penawaran
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Atur kategori varian penawaran (mis. SEWA, Pengadaan Booth, Interior, Jasa Desain).
                        Tiap varian punya template & default DP sendiri.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                        Tampilkan nonaktif
                    </label>
                    <button
                        onClick={() => { resetForm(); setShowForm(true); }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md text-sm font-semibold"
                    >
                        <Plus className="h-4 w-4" /> Tambah Varian
                    </button>
                </div>
            </div>

            {/* Form */}
            {showForm && (
                <div className="rounded-xl border-2 border-violet-200 bg-violet-50/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="font-bold text-violet-900">
                            {editingId ? "Edit Varian" : "Tambah Varian Baru"}
                        </h2>
                        <button onClick={resetForm} className="p-1.5 hover:bg-white rounded-md">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Kode *" hint="Huruf besar, _, angka. Mis: SEWA, INTERIOR, JASA_DESAIN. Tidak bisa diubah setelah dipakai quotation.">
                            <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <input
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                                    className="w-full border-2 rounded-md pl-10 pr-3 py-2 text-sm font-mono uppercase focus:border-violet-500 outline-none"
                                    placeholder="INTERIOR"
                                    maxLength={50}
                                />
                            </div>
                        </Field>
                        <Field label="Label / Nama Lengkap *" hint='Nama yang muncul di dropdown & surat. Mis: "Jasa Interior Building"'>
                            <input
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                className="w-full border-2 rounded-md px-3 py-2 text-sm focus:border-violet-500 outline-none"
                                placeholder="Jasa Interior Building"
                            />
                        </Field>
                    </div>

                    <Field label="Subject Surat (opsional)" hint='Override "Penawaran [Subject]" di header surat. Kalau kosong, otomatis pakai label.'>
                        <input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full border-2 rounded-md px-3 py-2 text-sm focus:border-violet-500 outline-none"
                            placeholder='Penawaran Jasa Interior — Custom Office Fitout'
                        />
                    </Field>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Template Surat *" hint="Pilih layout PDF/DOCX yang dipakai">
                            <select
                                value={templateKey}
                                onChange={(e) => setTemplateKey(e.target.value as TemplateKey)}
                                className="w-full border-2 rounded-md px-3 py-2 text-sm bg-white focus:border-violet-500 outline-none"
                            >
                                {TEMPLATE_OPTIONS.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                            <span className="text-[11px] text-muted-foreground mt-1 block">
                                {TEMPLATE_OPTIONS.find((t) => t.value === templateKey)?.hint}
                            </span>
                        </Field>
                        <Field label="Default DP (%)" hint="Persentase DP default saat varian ini dipilih">
                            <div className="relative">
                                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <input
                                    type="number"
                                    min="0" max="100" step="0.5"
                                    value={defaultDpPercent}
                                    onChange={(e) => setDefaultDpPercent(parseFloat(e.target.value) || 0)}
                                    className="w-full border-2 rounded-md pl-10 pr-3 py-2 text-sm focus:border-violet-500 outline-none"
                                />
                            </div>
                        </Field>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Warna Badge (hex)" hint='Mis. "#c8203a" untuk merah, "#3b82f6" untuk biru'>
                            <div className="relative flex items-center gap-2">
                                <Palette className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <input
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="flex-1 border-2 rounded-md pl-10 pr-3 py-2 text-sm font-mono focus:border-violet-500 outline-none"
                                    placeholder="#c8203a"
                                />
                                {color && (
                                    <span className="w-8 h-8 rounded border-2" style={{ backgroundColor: color }} />
                                )}
                            </div>
                        </Field>
                        <Field label="Urutan (sort)" hint="Angka kecil = tampil di atas dropdown">
                            <input
                                type="number"
                                value={orderIndex}
                                onChange={(e) => setOrderIndex(parseInt(e.target.value) || 0)}
                                className="w-full border-2 rounded-md px-3 py-2 text-sm focus:border-violet-500 outline-none"
                            />
                        </Field>
                    </div>

                    <Field label="Deskripsi (hint untuk user)" hint="Muncul sebagai sub-text di dropdown saat user pilih varian">
                        <div className="relative">
                            <AlignLeft className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                                className="w-full border-2 rounded-md pl-10 pr-3 py-2 text-sm focus:border-violet-500 outline-none"
                                placeholder="Jasa custom interior untuk office, retail, restaurant, dll"
                            />
                        </div>
                    </Field>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                        <button onClick={resetForm} className="px-4 py-2 border-2 rounded-md text-sm font-semibold hover:bg-white">
                            Batal
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={createMut.isPending || updateMut.isPending}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md text-sm font-bold disabled:opacity-50"
                        >
                            {(createMut.isPending || updateMut.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {editingId ? "Update" : "Simpan"}
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                        <tr>
                            <th className="px-3 py-2.5 text-left">Kode</th>
                            <th className="px-3 py-2.5 text-left">Label</th>
                            <th className="px-3 py-2.5 text-left">Template</th>
                            <th className="px-3 py-2.5 text-right">DP %</th>
                            <th className="px-3 py-2.5 text-left">Warna</th>
                            <th className="px-3 py-2.5 text-center w-[140px]">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && (
                            <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Memuat...</td></tr>
                        )}
                        {!isLoading && variants.length === 0 && (
                            <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground text-sm">Belum ada varian. Klik <b>Tambah Varian</b> untuk membuat.</td></tr>
                        )}
                        {variants.map((v) => (
                            <tr key={v.id} className={`border-t border-slate-100 ${!v.isActive ? "opacity-50" : ""}`}>
                                <td className="px-3 py-2.5 font-mono text-xs font-bold">{v.code}</td>
                                <td className="px-3 py-2.5">
                                    <div className="font-medium">{v.label}</div>
                                    {v.description && <div className="text-[11px] text-muted-foreground truncate max-w-xs">{v.description}</div>}
                                </td>
                                <td className="px-3 py-2.5 text-xs">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded font-mono">{v.templateKey}</span>
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono text-xs">{Number(v.defaultDpPercent)}%</td>
                                <td className="px-3 py-2.5">
                                    {v.color ? (
                                        <div className="inline-flex items-center gap-1.5">
                                            <span className="w-5 h-5 rounded border" style={{ backgroundColor: v.color }} />
                                            <span className="text-[11px] font-mono">{v.color}</span>
                                        </div>
                                    ) : <span className="text-slate-400">—</span>}
                                </td>
                                <td className="px-3 py-2.5">
                                    <div className="flex items-center justify-center gap-0.5">
                                        <button onClick={() => startEdit(v)} title="Edit" className="p-1.5 text-amber-700 hover:bg-amber-50 rounded">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        {v.isActive ? (
                                            <button onClick={() => toggleActiveMut.mutate({ id: v.id, isActive: false })} title="Nonaktifkan" className="p-1.5 text-slate-600 hover:bg-slate-100 rounded">
                                                <EyeOff className="h-3.5 w-3.5" />
                                            </button>
                                        ) : (
                                            <button onClick={() => toggleActiveMut.mutate({ id: v.id, isActive: true })} title="Aktifkan" className="p-1.5 text-slate-600 hover:bg-slate-100 rounded">
                                                <Eye className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { if (confirm(`Hapus varian "${v.label}"?\nKalau sudah dipakai quotation, akan otomatis dinonaktifkan saja.`)) deleteMut.mutate(v.id); }}
                                            title="Hapus"
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Field({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="text-sm font-semibold text-slate-700 mb-1 block">{label}</span>
            {children}
            {hint && <span className="text-[11px] text-muted-foreground mt-1 block">{hint}</span>}
        </label>
    );
}
