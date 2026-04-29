"use client";

import { useState, useMemo } from "react";
import dayjs from "dayjs";
import { Calendar, X } from "lucide-react";

export type DateRangePreset =
    | "ALL"
    | "TODAY"
    | "YESTERDAY"
    | "THIS_WEEK"
    | "LAST_MONTH"
    | "LAST_3_MONTHS"
    | "LAST_YEAR"
    | "CUSTOM";

export interface DateRange {
    preset: DateRangePreset;
    /** ISO date strings (yyyy-mm-dd), inclusive */
    fromDate?: string | null;
    toDate?: string | null;
}

const PRESET_LABELS: Record<DateRangePreset, { label: string; emoji: string }> = {
    ALL: { label: "Semua", emoji: "📅" },
    TODAY: { label: "Hari Ini", emoji: "📍" },
    YESTERDAY: { label: "Kemarin", emoji: "🌙" },
    THIS_WEEK: { label: "Minggu Ini", emoji: "📆" },
    LAST_MONTH: { label: "Bulan Lalu", emoji: "🗓️" },
    LAST_3_MONTHS: { label: "3 Bulan", emoji: "📊" },
    LAST_YEAR: { label: "1 Tahun", emoji: "📈" },
    CUSTOM: { label: "Custom", emoji: "🎯" },
};

/**
 * Compute start/end Date dari preset (untuk filter logic)
 * @returns null,null kalau preset = ALL (no filter)
 */
export function presetToRange(preset: DateRangePreset, custom?: { from?: string | null; to?: string | null }): { from: Date | null; to: Date | null } {
    const now = dayjs();
    switch (preset) {
        case "TODAY":
            return { from: now.startOf("day").toDate(), to: now.endOf("day").toDate() };
        case "YESTERDAY":
            return {
                from: now.subtract(1, "day").startOf("day").toDate(),
                to: now.subtract(1, "day").endOf("day").toDate(),
            };
        case "THIS_WEEK":
            return { from: now.startOf("week").toDate(), to: now.endOf("week").toDate() };
        case "LAST_MONTH":
            return {
                from: now.subtract(1, "month").startOf("month").toDate(),
                to: now.subtract(1, "month").endOf("month").toDate(),
            };
        case "LAST_3_MONTHS":
            return { from: now.subtract(3, "month").startOf("day").toDate(), to: now.endOf("day").toDate() };
        case "LAST_YEAR":
            return { from: now.subtract(1, "year").startOf("day").toDate(), to: now.endOf("day").toDate() };
        case "CUSTOM":
            return {
                from: custom?.from ? dayjs(custom.from).startOf("day").toDate() : null,
                to: custom?.to ? dayjs(custom.to).endOf("day").toDate() : null,
            };
        case "ALL":
        default:
            return { from: null, to: null };
    }
}

/**
 * Hook untuk filter data array by date field.
 */
export function useDateFilter<T>(
    items: T[],
    range: DateRange,
    getDate: (item: T) => string | Date | null | undefined,
): T[] {
    return useMemo(() => {
        const { from, to } = presetToRange(range.preset, { from: range.fromDate, to: range.toDate });
        if (!from && !to) return items;
        return items.filter((it) => {
            const d = getDate(it);
            if (!d) return false;
            const dt = new Date(d);
            if (Number.isNaN(dt.getTime())) return false;
            if (from && dt < from) return false;
            if (to && dt > to) return false;
            return true;
        });
    }, [items, range, getDate]);
}

/**
 * UI component: chip-style preset buttons + custom date pickers.
 */
export function DateRangeFilter({
    value,
    onChange,
    label = "Periode",
    className = "",
}: {
    value: DateRange;
    onChange: (next: DateRange) => void;
    label?: string;
    className?: string;
}) {
    const [showCustom, setShowCustom] = useState(value.preset === "CUSTOM");

    const presets: DateRangePreset[] = [
        "ALL", "TODAY", "YESTERDAY", "THIS_WEEK", "LAST_MONTH", "LAST_3_MONTHS", "LAST_YEAR", "CUSTOM",
    ];

    function handlePresetClick(p: DateRangePreset) {
        if (p === "CUSTOM") {
            setShowCustom(true);
            // Pertahankan dates yang sudah ada (kalau ada). Jangan auto-fill ke past
            // supaya user bebas pilih tanggal masa lalu maupun masa depan.
            onChange({ preset: "CUSTOM", fromDate: value.fromDate ?? null, toDate: value.toDate ?? null });
        } else {
            setShowCustom(false);
            onChange({ preset: p });
        }
    }

    // Active range text — untuk display saat preset aktif
    const activeRangeText = useMemo(() => {
        if (value.preset === "ALL") return null;
        const { from, to } = presetToRange(value.preset, { from: value.fromDate, to: value.toDate });
        if (!from && !to) return null;
        const fromStr = from ? dayjs(from).format("DD MMM YYYY") : "—";
        const toStr = to ? dayjs(to).format("DD MMM YYYY") : "sekarang";
        if (fromStr === toStr) return fromStr;
        return `${fromStr} → ${toStr}`;
    }, [value]);

    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex items-center gap-2 overflow-x-auto sm:flex-wrap whitespace-nowrap pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
                {label && (
                    <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 shrink-0 inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> {label}:
                    </span>
                )}
                {presets.map((p) => {
                    const meta = PRESET_LABELS[p];
                    const active = value.preset === p;
                    return (
                        <button
                            key={p}
                            type="button"
                            onClick={() => handlePresetClick(p)}
                            className={`shrink-0 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold rounded-full border-2 transition inline-flex items-center gap-1 ${active
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 dark:bg-slate-800 dark:text-indigo-300 dark:border-indigo-800"
                                }`}
                        >
                            <span>{meta.emoji}</span>
                            <span>{meta.label}</span>
                        </button>
                    );
                })}
                {value.preset !== "ALL" && (
                    <button
                        type="button"
                        onClick={() => { onChange({ preset: "ALL" }); setShowCustom(false); }}
                        className="shrink-0 px-2 py-1 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-full inline-flex items-center gap-1"
                    >
                        <X className="h-3 w-3" /> Reset
                    </button>
                )}
            </div>

            {/* Active range text — visual feedback rentang yg aktif */}
            {activeRangeText && value.preset !== "CUSTOM" && (
                <div className="text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-md px-2 py-1 inline-flex items-center gap-1 self-start">
                    <Calendar className="h-3 w-3" />
                    Aktif: <b>{activeRangeText}</b>
                </div>
            )}

            {/* Custom date range pickers */}
            {(value.preset === "CUSTOM" || showCustom) && (
                <div className="bg-indigo-50/60 dark:bg-indigo-950/20 border-2 border-indigo-200 dark:border-indigo-800 rounded-lg p-2.5 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-900 dark:text-indigo-200">
                        <Calendar className="h-3.5 w-3.5" />
                        🎯 Pilih Rentang Tanggal Custom
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                        <label className="inline-flex items-center gap-1.5">
                            <span className="font-medium text-indigo-800 dark:text-indigo-300 w-12">Dari</span>
                            <input
                                type="date"
                                value={value.fromDate ?? ""}
                                onChange={(e) => onChange({ preset: "CUSTOM", fromDate: e.target.value || null, toDate: value.toDate })}
                                className="border-2 border-indigo-200 rounded px-2 py-1.5 text-xs bg-white dark:bg-slate-800 focus:border-indigo-500 outline-none"
                                max={value.toDate ?? undefined}
                            />
                        </label>
                        <label className="inline-flex items-center gap-1.5">
                            <span className="font-medium text-indigo-800 dark:text-indigo-300 w-14">sampai</span>
                            <input
                                type="date"
                                value={value.toDate ?? ""}
                                onChange={(e) => onChange({ preset: "CUSTOM", fromDate: value.fromDate, toDate: e.target.value || null })}
                                className="border-2 border-indigo-200 rounded px-2 py-1.5 text-xs bg-white dark:bg-slate-800 focus:border-indigo-500 outline-none"
                                min={value.fromDate ?? undefined}
                            />
                        </label>
                        {(value.fromDate || value.toDate) && (
                            <button
                                type="button"
                                onClick={() => onChange({ preset: "CUSTOM", fromDate: null, toDate: null })}
                                className="ml-1 text-[11px] text-red-600 hover:underline inline-flex items-center gap-0.5"
                            >
                                <X className="h-3 w-3" /> Bersihkan
                            </button>
                        )}
                    </div>
                    {value.fromDate && value.toDate ? (
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 rounded px-2 py-1 border border-emerald-200">
                            ✅ Filter aktif: <b>{dayjs(value.fromDate).format("DD MMM YYYY")}</b> sampai <b>{dayjs(value.toDate).format("DD MMM YYYY")}</b>
                        </div>
                    ) : value.fromDate || value.toDate ? (
                        <div className="text-[11px] text-amber-700 dark:text-amber-400">
                            💡 Isi <b>kedua tanggal</b> untuk filter rentang lengkap, atau biarkan salah satu kosong untuk filter open-ended.
                        </div>
                    ) : (
                        <div className="text-[11px] text-muted-foreground italic">
                            💡 Pilih tanggal mulai &amp; akhir. Bisa tanggal lalu, sekarang, maupun yang akan datang (mis. event tahun depan).
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
