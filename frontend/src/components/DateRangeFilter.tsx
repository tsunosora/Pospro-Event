"use client";

import { useState, useMemo } from "react";
import dayjs from "dayjs";
import { Calendar, CalendarCheck, CalendarDays, CalendarRange, Moon, BarChart2, TrendingUp, Target, CheckCircle2, Lightbulb, X } from "lucide-react";

export type DateRangePreset =
    | "ALL"
    | "TODAY"
    | "YESTERDAY"
    | "THIS_WEEK"
    | "THIS_MONTH"
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

const PRESET_LABELS: Record<DateRangePreset, { label: string }> = {
    ALL: { label: "Semua" },
    TODAY: { label: "Hari Ini" },
    YESTERDAY: { label: "Kemarin" },
    THIS_WEEK: { label: "Minggu Ini" },
    THIS_MONTH: { label: "Bulan Ini" },
    LAST_MONTH: { label: "Bulan Lalu" },
    LAST_3_MONTHS: { label: "3 Bulan" },
    LAST_YEAR: { label: "1 Tahun" },
    CUSTOM: { label: "Custom" },
};

const PRESET_ICONS = {
    ALL: CalendarDays,
    TODAY: CalendarCheck,
    YESTERDAY: Moon,
    THIS_WEEK: CalendarRange,
    THIS_MONTH: Calendar,
    LAST_MONTH: CalendarDays,
    LAST_3_MONTHS: BarChart2,
    LAST_YEAR: TrendingUp,
    CUSTOM: Target,
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
        case "THIS_MONTH":
            return { from: now.startOf("month").toDate(), to: now.endOf("month").toDate() };
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
        "ALL", "TODAY", "YESTERDAY", "THIS_WEEK", "THIS_MONTH", "LAST_MONTH", "LAST_3_MONTHS", "LAST_YEAR", "CUSTOM",
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
                    <span className="text-xs sm:text-sm font-semibold text-muted-foreground shrink-0 inline-flex items-center gap-1">
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
                            className={`shrink-0 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold rounded-full border-2 transition-colors cursor-pointer inline-flex items-center gap-1 ${active
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-card text-primary border-primary/30 hover:bg-primary/10"
                                }`}
                        >
                            {(() => { const Icon = PRESET_ICONS[p]; return <Icon className="w-3 h-3" />; })()}
                            <span>{meta.label}</span>
                        </button>
                    );
                })}
                {value.preset !== "ALL" && (
                    <button
                        type="button"
                        onClick={() => { onChange({ preset: "ALL" }); setShowCustom(false); }}
                        className="shrink-0 px-2 py-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                        <X className="h-3 w-3" /> Reset
                    </button>
                )}
            </div>

            {/* Active range text — visual feedback rentang yg aktif */}
            {activeRangeText && value.preset !== "CUSTOM" && (
                <div className="text-[11px] text-primary bg-primary/10 border border-primary/30 rounded-md px-2 py-1 inline-flex items-center gap-1 self-start">
                    <Calendar className="h-3 w-3" />
                    Aktif: <b>{activeRangeText}</b>
                </div>
            )}

            {/* Custom date range pickers */}
            {(value.preset === "CUSTOM" || showCustom) && (
                <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-2.5 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                        <Target className="h-3.5 w-3.5 text-primary" />
                        Pilih Rentang Tanggal Custom
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                        <label className="inline-flex items-center gap-1.5">
                            <span className="font-medium text-foreground w-12">Dari</span>
                            <input
                                type="date"
                                value={value.fromDate ?? ""}
                                onChange={(e) => onChange({ preset: "CUSTOM", fromDate: e.target.value || null, toDate: value.toDate })}
                                className="border-2 border-border rounded px-2 py-1.5 text-xs bg-card focus:border-primary outline-none transition-colors"
                                max={value.toDate ?? undefined}
                            />
                        </label>
                        <label className="inline-flex items-center gap-1.5">
                            <span className="font-medium text-foreground w-14">sampai</span>
                            <input
                                type="date"
                                value={value.toDate ?? ""}
                                onChange={(e) => onChange({ preset: "CUSTOM", fromDate: value.fromDate, toDate: e.target.value || null })}
                                className="border-2 border-border rounded px-2 py-1.5 text-xs bg-card focus:border-primary outline-none transition-colors"
                                min={value.fromDate ?? undefined}
                            />
                        </label>
                        {(value.fromDate || value.toDate) && (
                            <button
                                type="button"
                                onClick={() => onChange({ preset: "CUSTOM", fromDate: null, toDate: null })}
                                className="ml-1 text-[11px] text-destructive hover:underline inline-flex items-center gap-0.5 transition-colors cursor-pointer"
                            >
                                <X className="h-3 w-3" /> Bersihkan
                            </button>
                        )}
                    </div>
                    {value.fromDate && value.toDate ? (
                        <div className="text-[11px] text-success bg-success/15 rounded px-2 py-1 border border-success/30 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 shrink-0" /> Filter aktif: <b>{dayjs(value.fromDate).format("DD MMM YYYY")}</b> sampai <b>{dayjs(value.toDate).format("DD MMM YYYY")}</b>
                        </div>
                    ) : value.fromDate || value.toDate ? (
                        <div className="text-[11px] text-warning inline-flex items-start gap-1">
                            <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" /> <span>Isi <b>kedua tanggal</b> untuk filter rentang lengkap, atau biarkan salah satu kosong untuk filter open-ended.</span>
                        </div>
                    ) : (
                        <div className="text-[11px] text-muted-foreground italic inline-flex items-start gap-1">
                            <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" /> <span>Pilih tanggal mulai &amp; akhir. Bisa tanggal lalu, sekarang, maupun yang akan datang (mis. event tahun depan).</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
