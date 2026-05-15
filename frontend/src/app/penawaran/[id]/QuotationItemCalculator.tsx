"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Calculator, X, Package, Calendar, Clock, Square, Tag, Wallet, Check,
} from "lucide-react";

export interface QuotationCalcResult {
    quantity: number;          // PRIMARY factor value (mis. 2 unit)
    unitMultiplier: number;    // SECONDARY multipliers gabungan (mis. 3 hari × 4 jam = 12). 1 = tidak ada secondary.
    unit: string;              // string satuan, mis. "unit - 3 hari", "m²"
    pricePerUnit: number;      // ORIGINAL harga satuan dasar (per primary factor, NOT scaled)
    subtotal: number;          // quantity × unitMultiplier × pricePerUnit
    descriptionText: string;   // "Stand tenda sarnafil (3 unit × 3 hari)"
    factors: { unit?: number; hari?: number; jam?: number; m2?: number };
}

interface Props {
    initialDescription?: string;
    initialUnit?: string;
    initialQuantity?: number;
    initialPrice?: number;
    onApply: (r: QuotationCalcResult) => void;
    onCancel: () => void;
}

function fmtRp(v: number) {
    if (!isFinite(v)) return "Rp 0";
    return `Rp ${Math.round(v).toLocaleString("id-ID")}`;
}

function parseNum(v: string): number | undefined {
    if (v.trim() === "") return undefined;
    const n = parseFloat(v.replace(",", "."));
    return isFinite(n) ? n : undefined;
}

/** Bangun string "3 unit × 3 hari" dari faktor terisi (untuk description suffix). */
function buildFactorText(f: QuotationCalcResult["factors"]): string {
    const parts: string[] = [];
    if (f.unit !== undefined && f.unit > 0) parts.push(`${f.unit} unit`);
    if (f.hari !== undefined && f.hari > 0) parts.push(`${f.hari} hari`);
    if (f.jam !== undefined && f.jam > 0) parts.push(`${f.jam} jam`);
    if (f.m2 !== undefined && f.m2 > 0) parts.push(`${f.m2} m²`);
    return parts.join(" × ");
}

/**
 * Buat string unit yang menampilkan SEMUA faktor secara terpisah dengan nilai-nilainya.
 * Marketing minta format ini supaya kolom Qty tampil "2 unit - 3 hari" bukan "6 unit-hari".
 * Contoh output: "2 unit - 3 hari", "3 unit - 4 jam", "10 m² - 2 hari".
 * Kalau cuma 1 faktor → return label saja (mis. "unit", "hari").
 */
function buildUnitText(f: QuotationCalcResult["factors"], primaryLabel: 'unit' | 'm²'): string {
    // Kumpulkan SECONDARY factors (selain primary) — hari/jam/m² atau unit
    const secondary: string[] = [];
    if (primaryLabel !== 'unit' && f.unit !== undefined && f.unit > 0) secondary.push(`${f.unit} unit`);
    if (primaryLabel !== 'm²' && f.m2 !== undefined && f.m2 > 0) secondary.push(`${f.m2} m²`);
    if (f.hari !== undefined && f.hari > 0) secondary.push(`${f.hari} hari`);
    if (f.jam !== undefined && f.jam > 0) secondary.push(`${f.jam} jam`);
    if (secondary.length === 0) return primaryLabel;
    // Format: "unit - 3 hari" atau "unit - 3 hari - 2 jam"
    return `${primaryLabel} - ${secondary.join(" - ")}`;
}

export function buildResult(state: {
    label: string;
    unit?: number;
    hari?: number;
    jam?: number;
    m2?: number;
    pricePerUnit: number;
    existingDescription?: string;
}): QuotationCalcResult {
    const factors = { unit: state.unit, hari: state.hari, jam: state.jam, m2: state.m2 };
    const factorText = buildFactorText(factors);
    const label = state.label.trim();

    // Tentukan PRIMARY factor — yang jadi nilai di kolom qty.
    // Priority: unit > m² (kalau keduanya kosong → 1 sebagai fallback "set")
    const hasUnit = state.unit !== undefined && state.unit > 0;
    const hasM2 = state.m2 !== undefined && state.m2 > 0;
    const primaryLabel: 'unit' | 'm²' = hasM2 && !hasUnit ? 'm²' : 'unit';
    const primaryValue = primaryLabel === 'unit'
        ? (hasUnit ? state.unit! : 1)
        : (hasM2 ? state.m2! : 1);

    // SECONDARY multiplier: gabungan semua factor selain primary
    const secondaryMultiplier =
        (primaryLabel !== 'unit' && hasUnit ? state.unit! : 1) *
        (primaryLabel !== 'm²' && hasM2 ? state.m2! : 1) *
        (state.hari && state.hari > 0 ? state.hari : 1) *
        (state.jam && state.jam > 0 ? state.jam : 1);

    // Subtotal = primary × secondary × harga
    const subtotal = primaryValue * secondaryMultiplier * (state.pricePerUnit || 0);
    // pricePerUnit TIDAK di-scale — marketing ingin tampil harga aslinya (mis. 350).
    // unitMultiplier di-store terpisah supaya PDF render: qty × unitMultiplier × price = subtotal yang benar.
    const effectivePricePerUnit = state.pricePerUnit || 0;

    // Build unit text — "unit - 3 hari" supaya kolom Qty tampil "2 unit - 3 hari"
    const unitText = factorText ? buildUnitText(factors, primaryLabel) : 'set';

    let descriptionText = "";
    if (state.existingDescription && state.existingDescription.trim()) {
        // Append faktor di belakang description user existing
        descriptionText = factorText
            ? `${state.existingDescription.trim()} (${factorText})`
            : state.existingDescription.trim();
    } else if (label && factorText) {
        descriptionText = `${label} (${factorText})`;
    } else if (label) {
        descriptionText = label;
    } else {
        descriptionText = factorText;
    }

    return {
        quantity: primaryValue,
        unitMultiplier: secondaryMultiplier,
        unit: unitText,
        pricePerUnit: effectivePricePerUnit,
        subtotal,
        descriptionText,
        factors,
    };
}

export default function QuotationItemCalculator({
    initialDescription,
    initialUnit,
    initialQuantity,
    initialPrice,
    onApply,
    onCancel,
}: Props) {
    const [label, setLabel] = useState(initialDescription?.trim() ?? "");
    const [unitCount, setUnitCount] = useState<string>(
        initialQuantity && initialQuantity > 0 ? String(initialQuantity) : ""
    );
    const [hari, setHari] = useState("");
    const [jam, setJam] = useState("");
    const [m2, setM2] = useState("");
    const [pricePerUnit, setPricePerUnit] = useState<string>(
        initialPrice && initialPrice > 0 ? String(initialPrice) : ""
    );

    // Esc untuk close + lock body scroll
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
        window.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [onCancel]);

    const result = useMemo(
        () =>
            buildResult({
                label,
                unit: parseNum(unitCount),
                hari: parseNum(hari),
                jam: parseNum(jam),
                m2: parseNum(m2),
                pricePerUnit: parseNum(pricePerUnit) ?? 0,
                existingDescription: initialDescription,
            }),
        [label, unitCount, hari, jam, m2, pricePerUnit, initialDescription]
    );

    const canApply = result.quantity > 0 && result.pricePerUnit > 0;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="bg-white w-full sm:max-w-lg sm:w-full rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto"
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                            <Calculator className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 leading-tight">
                                Kalkulator Item Penawaran
                            </h2>
                            <p className="text-xs text-slate-500 leading-tight">
                                Hitung qty otomatis: Unit × Hari × Jam × m²
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="p-2 rounded-lg hover:bg-slate-100"
                        aria-label="Tutup"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Label item */}
                    <div>
                        <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1.5">
                            <Tag className="h-4 w-4 text-slate-500" />
                            Nama Item
                        </label>
                        <input
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="contoh: Stand tenda sarnafil, Sound system, Backwall"
                            className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-3 text-base"
                            autoFocus
                        />
                    </div>

                    {/* Multiplier grid */}
                    <div>
                        <div className="text-sm font-semibold text-slate-700 mb-2">
                            Faktor pengali{" "}
                            <span className="text-xs font-normal text-slate-500">
                                (kosongkan kalau tidak dipakai)
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <BigNumField
                                icon={<Package className="h-5 w-5" />}
                                color="blue"
                                label="Unit"
                                hint="jumlah"
                                value={unitCount}
                                onChange={setUnitCount}
                                placeholder="3"
                            />
                            <BigNumField
                                icon={<Calendar className="h-5 w-5" />}
                                color="emerald"
                                label="Hari"
                                hint="durasi"
                                value={hari}
                                onChange={setHari}
                                placeholder="3"
                            />
                            <BigNumField
                                icon={<Clock className="h-5 w-5" />}
                                color="violet"
                                label="Jam"
                                hint="opsi"
                                value={jam}
                                onChange={setJam}
                                placeholder="—"
                            />
                            <BigNumField
                                icon={<Square className="h-5 w-5" />}
                                color="amber"
                                label="m² / Luas"
                                hint="opsi"
                                value={m2}
                                onChange={setM2}
                                placeholder="—"
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2">
                            💡 Contoh: isi <b>2 unit</b> + <b>3 hari</b> → tampil di Qty sebagai <b>&quot;2 unit - 3 hari&quot;</b> (terpisah, bukan digabung 6 unit-hari). Harga satuan di-scale otomatis.
                        </p>
                    </div>

                    {/* Harga satuan */}
                    <div>
                        <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1.5">
                            <Wallet className="h-4 w-4 text-slate-500" />
                            Harga Satuan{" "}
                            <span className="text-xs font-normal text-muted-foreground">(per unit per hari, dst)</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold pointer-events-none">
                                Rp
                            </span>
                            <input
                                type="number"
                                value={pricePerUnit}
                                onChange={(e) => setPricePerUnit(e.target.value)}
                                placeholder="500000"
                                min="0"
                                inputMode="numeric"
                                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg pl-11 pr-3 py-3 text-base font-mono text-right"
                            />
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="rounded-xl border-2 border-blue-100 bg-gradient-to-br from-blue-50 to-slate-50 p-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-2">
                            Hasil Hitungan
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                                <div className="text-xs text-slate-500">Qty (tampil di tabel)</div>
                                <div className="text-xl font-bold font-mono text-slate-900 leading-tight">
                                    {result.quantity || 0}{" "}
                                    <span className="text-sm font-normal text-slate-600">{result.unit}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                    Harga satuan: <b>{fmtRp(result.pricePerUnit)}</b>
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500">Subtotal</div>
                                <div className="text-2xl font-bold font-mono text-blue-700 leading-tight">
                                    {fmtRp(result.subtotal)}
                                </div>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-dashed border-blue-200">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                Uraian
                            </div>
                            <div className="italic text-slate-800 text-sm break-words">
                                {result.descriptionText || (
                                    <span className="text-slate-400 not-italic">(isi nama item & faktor)</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer actions */}
                <div className="sticky bottom-0 bg-white border-t px-5 py-4 flex gap-3 rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-lg text-base font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        disabled={!canApply}
                        onClick={() => onApply(result)}
                        className="flex-[2] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-base font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm"
                    >
                        <Check className="h-5 w-5" />
                        Terapkan
                    </button>
                </div>
            </div>
        </div>
    );
}

const colorMap: Record<string, { ring: string; iconBg: string; iconText: string; focusBorder: string }> = {
    blue: { ring: "border-blue-200", iconBg: "bg-blue-100", iconText: "text-blue-700", focusBorder: "focus-within:border-blue-500" },
    emerald: { ring: "border-emerald-200", iconBg: "bg-emerald-100", iconText: "text-emerald-700", focusBorder: "focus-within:border-emerald-500" },
    violet: { ring: "border-violet-200", iconBg: "bg-violet-100", iconText: "text-violet-700", focusBorder: "focus-within:border-violet-500" },
    amber: { ring: "border-amber-200", iconBg: "bg-amber-100", iconText: "text-amber-700", focusBorder: "focus-within:border-amber-500" },
};

function BigNumField({
    icon, color, label, hint, value, onChange, placeholder,
}: {
    icon: React.ReactNode;
    color: keyof typeof colorMap;
    label: string;
    hint: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    const c = colorMap[color];
    return (
        <div className={`rounded-lg border-2 ${c.ring} ${c.focusBorder} bg-white p-2.5 transition`}>
            <div className="flex items-center gap-2 mb-1.5">
                <span className={`p-1.5 rounded-md ${c.iconBg} ${c.iconText}`}>{icon}</span>
                <div className="leading-tight">
                    <div className="text-sm font-semibold text-slate-800">{label}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">({hint})</div>
                </div>
            </div>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                min="0"
                inputMode="numeric"
                className="w-full bg-transparent outline-none text-2xl font-bold font-mono text-right text-slate-900 placeholder:text-slate-300"
            />
        </div>
    );
}
