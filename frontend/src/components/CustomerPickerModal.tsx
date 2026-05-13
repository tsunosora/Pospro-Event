"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, UserPlus, X, ArrowLeft } from "lucide-react";
import { createCustomer, getCustomers, type Customer } from "@/lib/api/customers";
import { PhoneDuplicateBanner } from "./PhoneDuplicateBanner";

/**
 * Reusable customer picker:
 * - Default: search/select existing customer
 * - Klik "Tambah Klien Baru" → switch ke form create inline
 * - Submit form → POST customer baru, langsung onPick + close
 *
 * Pakai sama untuk create RAB & detail RAB (replace inline picker lama).
 */
export function CustomerPickerModal({
    onClose,
    onPick,
}: {
    onClose: () => void;
    onPick: (c: Customer) => void;
}) {
    const qc = useQueryClient();
    const [mode, setMode] = useState<"pick" | "create">("pick");
    const [query, setQuery] = useState("");
    const [form, setForm] = useState({
        name: "",
        phone: "",
        email: "",
        address: "",
        companyName: "",
        companyPIC: "",
    });
    const [error, setError] = useState<string | null>(null);

    const { data: customers, isLoading } = useQuery({
        queryKey: ["customers-all"],
        queryFn: getCustomers,
    });

    const filtered = useMemo<Customer[]>(() => {
        const list = customers ?? [];
        const q = query.trim().toLowerCase();
        if (!q) return list;
        return list.filter((c) => {
            const hay = `${c.name ?? ""} ${c.companyName ?? ""} ${c.companyPIC ?? ""} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase();
            return hay.includes(q);
        });
    }, [customers, query]);

    const createMut = useMutation({
        mutationFn: () => {
            if (!form.name.trim()) throw new Error("Nama klien wajib diisi");
            return createCustomer({
                name: form.name.trim(),
                phone: form.phone.trim() || null,
                email: form.email.trim() || null,
                address: form.address.trim() || null,
                companyName: form.companyName.trim() || null,
                companyPIC: form.companyPIC.trim() || null,
            });
        },
        onSuccess: (c) => {
            qc.invalidateQueries({ queryKey: ["customers-all"] });
            qc.invalidateQueries({ queryKey: ["customers"] });
            qc.invalidateQueries({ queryKey: ["customers-with-stats"] });
            onPick(c);
        },
        onError: (e: any) => {
            setError(e?.response?.data?.message ?? e?.message ?? "Gagal simpan klien");
        },
    });

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                className="bg-background rounded-lg shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        {mode === "create" && (
                            <button
                                onClick={() => { setMode("pick"); setError(null); }}
                                className="p-1 hover:bg-muted rounded"
                                title="Kembali ke daftar"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </button>
                        )}
                        <h2 className="text-base font-semibold truncate">
                            {mode === "pick" ? "Pilih Klien" : "Daftar Klien Baru"}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {mode === "pick" ? (
                    <>
                        {/* Search */}
                        <div className="p-4 border-b space-y-2">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Cari nama / perusahaan / telepon / email…"
                                    className="w-full border rounded-md pl-8 pr-3 py-2 text-sm"
                                    autoFocus
                                />
                            </div>
                            <button
                                onClick={() => { setMode("create"); setForm((f) => ({ ...f, name: query.trim() })); }}
                                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border-2 border-dashed border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 transition"
                            >
                                <UserPlus className="h-4 w-4" />
                                Tambah Klien Baru {query.trim() && <span className="opacity-70">— "{query.trim()}"</span>}
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto">
                            {isLoading ? (
                                <div className="p-8 flex justify-center">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="p-8 text-center text-sm text-muted-foreground">
                                    {(customers ?? []).length === 0
                                        ? "Belum ada klien. Klik tombol di atas untuk tambah klien baru."
                                        : "Tidak ada yang cocok. Klik 'Tambah Klien Baru' untuk daftarkan."}
                                </div>
                            ) : (
                                <ul className="divide-y">
                                    {filtered.map((c) => (
                                        <li key={c.id}>
                                            <button
                                                onClick={() => onPick(c)}
                                                className="w-full text-left p-3 hover:bg-muted/50 transition"
                                            >
                                                <div className="font-medium text-sm">{c.companyName || c.name}</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {c.companyName && c.name && <span>{c.name}</span>}
                                                    {c.companyPIC && <span> · PIC {c.companyPIC}</span>}
                                                    {c.phone && <span> · {c.phone}</span>}
                                                    {c.email && <span> · {c.email}</span>}
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Create form */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            <FormField label="Nama Klien / Person *" required>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Pak Budi / Bu Sari"
                                    className="w-full border rounded-md px-3 py-2 text-sm"
                                    autoFocus
                                />
                            </FormField>
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Nama Perusahaan">
                                    <input
                                        type="text"
                                        value={form.companyName}
                                        onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                                        placeholder="PT / CV"
                                        className="w-full border rounded-md px-3 py-2 text-sm"
                                    />
                                </FormField>
                                <FormField label="PIC Perusahaan">
                                    <input
                                        type="text"
                                        value={form.companyPIC}
                                        onChange={(e) => setForm({ ...form, companyPIC: e.target.value })}
                                        placeholder="Contact person"
                                        className="w-full border rounded-md px-3 py-2 text-sm"
                                    />
                                </FormField>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="No. Telepon / WA">
                                    <input
                                        type="tel"
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        placeholder="08xxxxxxxxxx"
                                        className="w-full border rounded-md px-3 py-2 text-sm"
                                    />
                                </FormField>
                                <FormField label="Email">
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        placeholder="email@domain.com"
                                        className="w-full border rounded-md px-3 py-2 text-sm"
                                    />
                                </FormField>
                            </div>
                            {/* Anti-duplicate: cek HP yang sedang di-input vs database existing */}
                            <PhoneDuplicateBanner
                                phone={form.phone}
                                onUseCustomer={(c) => {
                                    // Pilih customer existing langsung — tutup modal create, return ke pemanggil
                                    onPick(c as unknown as Customer);
                                }}
                                compact
                            />
                            <FormField label="Alamat">
                                <textarea
                                    value={form.address}
                                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                                    placeholder="Alamat lengkap"
                                    className="w-full border rounded-md px-3 py-2 text-sm"
                                    rows={2}
                                />
                            </FormField>
                            {error && (
                                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>
                            )}
                            <div className="text-[11px] text-muted-foreground italic">
                                💡 Klien yang baru didaftarkan otomatis tersimpan di database & bisa dipakai untuk RAB/penawaran berikutnya.
                            </div>
                        </div>
                        <div className="p-4 border-t flex items-center justify-end gap-2">
                            <button
                                onClick={() => { setMode("pick"); setError(null); }}
                                className="px-3 py-2 rounded-md text-sm border hover:bg-muted"
                                disabled={createMut.isPending}
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => createMut.mutate()}
                                disabled={!form.name.trim() || createMut.isPending}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                            >
                                {createMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                Simpan & Pilih
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function FormField({
    label,
    required,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {children}
        </div>
    );
}

export default CustomerPickerModal;
