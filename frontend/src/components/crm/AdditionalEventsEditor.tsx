"use client";

import { Plus, Trash2, Calendar, MapPin } from "lucide-react";

export interface AdditionalEvent {
    name: string;
    location: string;
    dateStart: string;
    dateEnd: string;
}

interface Props {
    value: AdditionalEvent[];
    onChange: (next: AdditionalEvent[]) => void;
    /** Compact mode untuk dipakai di drawer (font lebih kecil). */
    compact?: boolean;
}

const empty = (): AdditionalEvent => ({ name: "", location: "", dateStart: "", dateEnd: "" });

/**
 * Editor untuk daftar event tambahan (multi-kota / multi-tanggal).
 * Event utama tetap di field eventLocation + eventDateStart/End — komponen ini untuk event ke-2, ke-3, dst.
 */
export function AdditionalEventsEditor({ value, onChange, compact = false }: Props) {
    const txt = compact ? "text-[11px]" : "text-xs";
    const pad = compact ? "p-2" : "p-2.5";

    const update = (idx: number, patch: Partial<AdditionalEvent>) => {
        onChange(value.map((ev, i) => (i === idx ? { ...ev, ...patch } : ev)));
    };
    const add = () => onChange([...value, empty()]);
    const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

    return (
        <div className="space-y-1.5">
            {value.length === 0 ? (
                <div className={`${txt} text-slate-500 italic bg-slate-50 border border-dashed border-slate-300 rounded px-3 py-2.5 text-center`}>
                    Belum ada event tambahan. Klik tombol di bawah kalau ada event di kota/tanggal lain.
                </div>
            ) : (
                value.map((ev, idx) => (
                    <div key={idx} className={`bg-slate-50 border border-slate-200 rounded ${pad} space-y-1.5`}>
                        <div className="flex items-center justify-between">
                            <span className={`${txt} font-semibold text-slate-700`}>
                                🎪 Event #{idx + 2} <span className="text-slate-400 font-normal">(tambahan)</span>
                            </span>
                            <button
                                type="button"
                                onClick={() => remove(idx)}
                                className="p-0.5 text-red-600 hover:bg-red-100 rounded"
                                title="Hapus event ini"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        <input
                            type="text"
                            value={ev.name}
                            onChange={(e) => update(idx, { name: e.target.value })}
                            placeholder="Nama event (mis. 'Pameran Surabaya')"
                            className={`w-full px-2 py-1.5 ${txt} border border-input rounded bg-background`}
                        />
                        <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-400 flex-shrink-0" />
                            <input
                                type="text"
                                value={ev.location}
                                onChange={(e) => update(idx, { location: e.target.value })}
                                placeholder="Lokasi / venue / kota"
                                className={`flex-1 px-2 py-1.5 ${txt} border border-input rounded bg-background`}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                <input
                                    type="date"
                                    value={ev.dateStart}
                                    onChange={(e) => update(idx, { dateStart: e.target.value })}
                                    className={`flex-1 px-2 py-1.5 ${txt} border border-input rounded bg-background`}
                                />
                            </div>
                            <input
                                type="date"
                                value={ev.dateEnd}
                                onChange={(e) => update(idx, { dateEnd: e.target.value })}
                                min={ev.dateStart || undefined}
                                disabled={!ev.dateStart}
                                className={`px-2 py-1.5 ${txt} border border-input rounded bg-background disabled:opacity-50`}
                                placeholder="Tgl selesai"
                            />
                        </div>
                    </div>
                ))
            )}
            <button
                type="button"
                onClick={add}
                className={`w-full ${txt} px-3 py-2 border-2 border-dashed border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 rounded text-emerald-700 font-semibold flex items-center justify-center gap-1 transition`}
            >
                <Plus className="h-3.5 w-3.5" />
                Tambah Event Lain {value.length > 0 && `(${value.length + 1} event total)`}
            </button>
        </div>
    );
}

/** Konversi dari Lead's additionalEvents (nullable) ke array editor (selalu array). */
export function additionalEventsToEditor(
    src: Array<{ name: string | null; location: string | null; dateStart: string | null; dateEnd: string | null }> | null | undefined,
): AdditionalEvent[] {
    if (!src) return [];
    return src.map((ev) => ({
        name: ev.name ?? "",
        location: ev.location ?? "",
        dateStart: ev.dateStart ? ev.dateStart.slice(0, 10) : "",
        dateEnd: ev.dateEnd ? ev.dateEnd.slice(0, 10) : "",
    }));
}

/** Konversi dari editor ke format API (kosong → null). */
export function editorToAdditionalEvents(arr: AdditionalEvent[]) {
    const cleaned = arr
        .map((ev) => ({
            name: ev.name.trim() || null,
            location: ev.location.trim() || null,
            dateStart: ev.dateStart ? new Date(ev.dateStart).toISOString() : null,
            dateEnd: ev.dateEnd ? new Date(ev.dateEnd).toISOString() : null,
        }))
        .filter((ev) => ev.name || ev.location || ev.dateStart || ev.dateEnd);
    return cleaned.length > 0 ? cleaned : null;
}
