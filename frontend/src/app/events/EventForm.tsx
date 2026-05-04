"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2 } from "lucide-react";
import {
    createEvent, updateEvent, deleteEvent,
    type EventBrand, type EventFormInput, type EventRecord, type EventStatus,
} from "@/lib/api/events";
import { getCustomers } from "@/lib/api/customers";
import { getWorkers } from "@/lib/api/workers";

type Props = {
    mode: "create" | "edit";
    initial?: EventRecord;
};

const toLocalDate = (iso: string | null | undefined): string => {
    if (!iso) return "";
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60 * 1000);
    return local.toISOString().slice(0, 16);
};

const toIso = (local: string): string | null => {
    if (!local) return null;
    return new Date(local).toISOString();
};

export default function EventForm({ mode, initial }: Props) {
    const router = useRouter();
    const qc = useQueryClient();

    const [form, setForm] = useState<EventFormInput & { id?: number }>({
        name: initial?.name ?? "",
        brand: initial?.brand ?? "EXINDO",
        status: initial?.status ?? "SCHEDULED",
        venue: initial?.venue ?? "",
        customerId: initial?.customerId ?? null,
        customerName: initial?.customerName ?? "",
        picWorkerId: initial?.picWorkerId ?? null,
        picName: initial?.picName ?? "",
        departureStart: toLocalDate(initial?.departureStart),
        departureEnd: toLocalDate(initial?.departureEnd),
        setupStart: toLocalDate(initial?.setupStart),
        setupEnd: toLocalDate(initial?.setupEnd),
        loadingStart: toLocalDate(initial?.loadingStart),
        loadingEnd: toLocalDate(initial?.loadingEnd),
        eventStart: toLocalDate(initial?.eventStart),
        eventEnd: toLocalDate(initial?.eventEnd),
        notes: initial?.notes ?? "",
        dailyWageRate: initial?.dailyWageRate ?? "",
        overtimeRatePerHour: initial?.overtimeRatePerHour ?? "",
        dailyWageRatePic: initial?.dailyWageRatePic ?? "",
        overtimeRatePerHourPic: initial?.overtimeRatePerHourPic ?? "",
    });
    const [error, setError] = useState<string | null>(null);

    const { data: customers = [] } = useQuery({
        queryKey: ["customers"],
        queryFn: () => getCustomers(),
    });
    const { data: workers = [] } = useQuery({
        queryKey: ["workers"],
        queryFn: () => getWorkers(),
    });

    const saveMut = useMutation({
        mutationFn: async () => {
            const payload: EventFormInput = {
                name: form.name.trim(),
                brand: form.brand as EventBrand,
                status: form.status as EventStatus,
                venue: form.venue?.trim() || null,
                customerId: form.customerId || null,
                customerName: form.customerName?.trim() || null,
                picWorkerId: form.picWorkerId || null,
                picName: form.picName?.trim() || null,
                departureStart: toIso(form.departureStart as string),
                departureEnd: toIso(form.departureEnd as string),
                setupStart: toIso(form.setupStart as string),
                setupEnd: toIso(form.setupEnd as string),
                loadingStart: toIso(form.loadingStart as string),
                loadingEnd: toIso(form.loadingEnd as string),
                eventStart: toIso(form.eventStart as string),
                eventEnd: toIso(form.eventEnd as string),
                notes: form.notes?.toString().trim() || null,
                dailyWageRate: form.dailyWageRate ? String(form.dailyWageRate).trim() || null : null,
                overtimeRatePerHour: form.overtimeRatePerHour ? String(form.overtimeRatePerHour).trim() || null : null,
                dailyWageRatePic: form.dailyWageRatePic ? String(form.dailyWageRatePic).trim() || null : null,
                overtimeRatePerHourPic: form.overtimeRatePerHourPic ? String(form.overtimeRatePerHourPic).trim() || null : null,
            };
            if (mode === "create") return createEvent(payload);
            return updateEvent(initial!.id, payload);
        },
        onSuccess: (ev) => {
            qc.invalidateQueries({ queryKey: ["events"] });
            qc.invalidateQueries({ queryKey: ["event", ev.id] });
            router.push(`/events/${ev.id}`);
        },
        onError: (e: any) => {
            setError(e?.response?.data?.message || "Gagal menyimpan event");
        },
    });

    const deleteMut = useMutation({
        mutationFn: () => deleteEvent(initial!.id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["events"] });
            router.push("/events");
        },
        onError: (e: any) => {
            setError(e?.response?.data?.message || "Gagal menghapus event");
        },
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (!form.name?.trim()) {
            setError("Nama event wajib diisi");
            return;
        }
        saveMut.mutate();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-medium">Nama Event *</label>
                    <input
                        required
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                        placeholder="mis. UniMA / system 6x2,5"
                    />
                </div>
                <div>
                    <label className="text-xs font-medium">Brand *</label>
                    <select
                        value={form.brand}
                        onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value as EventBrand }))}
                        className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                    >
                        <option value="EXINDO">CV. Exindo</option>
                        <option value="XPOSER">CV. Xposer</option>
                        <option value="OTHER">Lain</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium">Venue</label>
                    <input
                        value={form.venue ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                        placeholder="mis. Universitas Muhammadiyah Magelang"
                    />
                </div>
                <div>
                    <label className="text-xs font-medium">Status</label>
                    <select
                        value={form.status}
                        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as EventStatus }))}
                        className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                    >
                        <option value="DRAFT">Draft</option>
                        <option value="SCHEDULED">Terjadwal</option>
                        <option value="IN_PROGRESS">Berlangsung</option>
                        <option value="COMPLETED">Selesai</option>
                        <option value="CANCELLED">Dibatalkan</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium">Klien (dari database)</label>
                    <select
                        value={form.customerId ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                    >
                        <option value="">— Pilih —</option>
                        {(customers as Array<{ id: number; name: string; companyName: string | null }>).map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}{c.companyName ? ` (${c.companyName})` : ""}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium">Nama Klien (teks bebas)</label>
                    <input
                        value={form.customerName ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                        placeholder="mis. UniMA / Indohose"
                    />
                </div>
                <div>
                    <label className="text-xs font-medium">PIC (dari pekerja)</label>
                    <select
                        value={form.picWorkerId ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, picWorkerId: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                    >
                        <option value="">— Pilih —</option>
                        {workers.map((w) => (
                            <option key={w.id} value={w.id}>
                                {w.name}{w.position ? ` (${w.position})` : ""}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium">Nama PIC (teks bebas)</label>
                    <input
                        value={form.picName ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, picName: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                        placeholder="mis. Pak Kuat / Mas Yoan"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border rounded-lg p-3 bg-muted/20">
                <PhaseRow
                    label="Berangkat"
                    colorClass="bg-yellow-200 border-yellow-300"
                    start={form.departureStart as string}
                    end={form.departureEnd as string}
                    onChange={(a, b) => setForm((f) => ({ ...f, departureStart: a, departureEnd: b }))}
                />
                <PhaseRow
                    label="Pasang"
                    colorClass="bg-orange-200 border-orange-300"
                    start={form.setupStart as string}
                    end={form.setupEnd as string}
                    onChange={(a, b) => setForm((f) => ({ ...f, setupStart: a, setupEnd: b }))}
                />
                <PhaseRow
                    label="Loading Peserta"
                    colorClass="bg-sky-200 border-sky-300"
                    start={form.loadingStart as string}
                    end={form.loadingEnd as string}
                    onChange={(a, b) => setForm((f) => ({ ...f, loadingStart: a, loadingEnd: b }))}
                />
                <PhaseRow
                    label="Event"
                    colorClass="bg-emerald-200 border-emerald-300"
                    start={form.eventStart as string}
                    end={form.eventEnd as string}
                    onChange={(a, b) => setForm((f) => ({ ...f, eventStart: a, eventEnd: b }))}
                />
            </div>

            <div>
                <label className="text-xs font-medium">Catatan</label>
                <textarea
                    rows={3}
                    value={form.notes ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                    placeholder="Detail teknis, PIC lapangan, dll."
                />
            </div>

            {/* Wage override per event/project */}
            <div className="pt-3 border-t border-dashed border-border">
                <div className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1">
                    💰 Override Gaji untuk Event Ini (Opsional)
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">
                    Override matrix kota+divisi & default worker. Kosongkan kalau pakai default.
                </p>
                {/* Member rate */}
                <div className="bg-emerald-50/40 border border-emerald-200 rounded-lg p-2 mb-2">
                    <div className="text-[11px] font-bold text-emerald-800 mb-1.5">👥 Member / Crew (worker biasa)</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium">Gaji Harian (Rp)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={form.dailyWageRate ?? ""}
                                onChange={(e) => setForm((f) => ({ ...f, dailyWageRate: e.target.value.replace(/[^\d.]/g, "") }))}
                                placeholder="200000"
                                className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium">Lembur per Jam (Rp)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={form.overtimeRatePerHour ?? ""}
                                onChange={(e) => setForm((f) => ({ ...f, overtimeRatePerHour: e.target.value.replace(/[^\d.]/g, "") }))}
                                placeholder="25000"
                                className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono"
                            />
                        </div>
                    </div>
                </div>
                {/* PIC rate */}
                <div className="bg-blue-50/40 border border-blue-200 rounded-lg p-2">
                    <div className="text-[11px] font-bold text-blue-800 mb-1.5">
                        👤 PIC Khusus (worker yang dipilih sebagai PIC event di atas)
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-1.5">
                        Kosongkan kalau PIC ikut rate Member. Isi kalau PIC dapat fee lebih tinggi (mandor/koordinator).
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium">Gaji Harian PIC (Rp)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={form.dailyWageRatePic ?? ""}
                                onChange={(e) => setForm((f) => ({ ...f, dailyWageRatePic: e.target.value.replace(/[^\d.]/g, "") }))}
                                placeholder="350000"
                                className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium">Lembur PIC per Jam (Rp)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={form.overtimeRatePerHourPic ?? ""}
                                onChange={(e) => setForm((f) => ({ ...f, overtimeRatePerHourPic: e.target.value.replace(/[^\d.]/g, "") }))}
                                placeholder="40000"
                                className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {error && <div className="text-xs text-red-600">{error}</div>}

            <div className="flex items-center gap-2">
                <button
                    type="submit"
                    disabled={saveMut.isPending}
                    className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded text-sm hover:opacity-90 disabled:opacity-50"
                >
                    {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Simpan
                </button>
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-3 py-1.5 border rounded text-sm hover:bg-muted"
                >
                    Batal
                </button>
                {mode === "edit" && (
                    <button
                        type="button"
                        onClick={() => {
                            if (confirm("Hapus event ini? Ini tidak bisa dihapus bila sudah ada pengeluaran barang.")) {
                                deleteMut.mutate();
                            }
                        }}
                        disabled={deleteMut.isPending}
                        className="ml-auto inline-flex items-center gap-1.5 border border-red-300 text-red-600 px-3 py-1.5 rounded text-sm hover:bg-red-50 disabled:opacity-50"
                    >
                        <Trash2 className="h-4 w-4" /> Hapus
                    </button>
                )}
            </div>
        </form>
    );
}

function PhaseRow({ label, colorClass, start, end, onChange }: {
    label: string;
    colorClass: string;
    start: string;
    end: string;
    onChange: (start: string, end: string) => void;
}) {
    return (
        <div className={`border rounded p-2 ${colorClass}`}>
            <div className="text-xs font-semibold mb-1">{label}</div>
            <div className="grid grid-cols-2 gap-1.5">
                <label className="text-[11px]">
                    Mulai
                    <input
                        type="datetime-local"
                        value={start}
                        onChange={(e) => onChange(e.target.value, end)}
                        className="w-full border rounded px-1 py-1 text-xs mt-0.5 bg-white"
                    />
                </label>
                <label className="text-[11px]">
                    Selesai
                    <input
                        type="datetime-local"
                        value={end}
                        onChange={(e) => onChange(start, e.target.value)}
                        className="w-full border rounded px-1 py-1 text-xs mt-0.5 bg-white"
                    />
                </label>
            </div>
        </div>
    );
}
