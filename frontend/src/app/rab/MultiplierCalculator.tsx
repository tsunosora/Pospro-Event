"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Calculator,
    X,
    Users,
    Calendar,
    Clock,
    Repeat,
    Tag,
    Wallet,
    Check,
} from "lucide-react";

export type CalcTarget = "COST" | "RAB" | "BOTH";

export interface CalcResult {
    qty: number;
    unitPrice: number;
    total: number;
    target: CalcTarget;
    descriptionText: string;
    notesText: string;
    factors: { org?: number; hari?: number; jam?: number; kali?: number };
}

interface Props {
    initialDescription?: string;
    initialUnitPrice?: number;
    onApply: (r: CalcResult) => void;
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

function buildFactorText(f: CalcResult["factors"]): string {
    const parts: string[] = [];
    if (f.org !== undefined && f.org > 0) parts.push(`${f.org} org`);
    if (f.hari !== undefined && f.hari > 0) parts.push(`${f.hari} hari`);
    if (f.jam !== undefined && f.jam > 0) parts.push(`${f.jam} jam`);
    if (f.kali !== undefined && f.kali > 0) parts.push(`${f.kali} kali`);
    return parts.join(" × ");
}

export function buildResult(state: {
    label: string;
    org?: number;
    hari?: number;
    jam?: number;
    kali?: number;
    unitPrice: number;
    target: CalcTarget;
    existingDescription?: string;
}): CalcResult {
    const factors = {
        org: state.org,
        hari: state.hari,
        jam: state.jam,
        kali: state.kali,
    };
    const qty =
        (state.org && state.org > 0 ? state.org : 1) *
        (state.hari && state.hari > 0 ? state.hari : 1) *
        (state.jam && state.jam > 0 ? state.jam : 1) *
        (state.kali && state.kali > 0 ? state.kali : 1);
    const total = qty * (state.unitPrice || 0);
    const factorText = buildFactorText(factors);
    const label = state.label.trim();

    let descriptionText = "";
    if (state.existingDescription && state.existingDescription.trim()) {
        descriptionText = factorText
            ? `${state.existingDescription.trim()} (${factorText})`
            : state.existingDescription.trim();
    } else if (label && factorText) {
        descriptionText = `${label} ${factorText}`;
    } else if (label) {
        descriptionText = label;
    } else {
        descriptionText = factorText;
    }

    const notesText = factorText
        ? `${factorText} × ${fmtRp(state.unitPrice)} = ${fmtRp(total)}`
        : `${fmtRp(state.unitPrice)} = ${fmtRp(total)}`;

    return {
        qty,
        unitPrice: state.unitPrice,
        total,
        target: state.target,
        descriptionText,
        notesText,
        factors,
    };
}

export default function MultiplierCalculator({
    initialDescription,
    initialUnitPrice,
    onApply,
    onCancel,
}: Props) {
    const [label, setLabel] = useState(initialDescription?.trim() ?? "");
    const [org, setOrg] = useState<string>("");
    const [hari, setHari] = useState<string>("");
    const [jam, setJam] = useState<string>("");
    const [kali, setKali] = useState<string>("");
    const [unitPrice, setUnitPrice] = useState<string>(
        initialUnitPrice && initialUnitPrice > 0 ? String(initialUnitPrice) : ""
    );
    const [target, setTarget] = useState<CalcTarget>("COST");

    // Esc to cancel + lock body scroll
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [onCancel]);

    const result = useMemo(
        () =>
            buildResult({
                label,
                org: parseNum(org),
                hari: parseNum(hari),
                jam: parseNum(jam),
                kali: parseNum(kali),
                unitPrice: parseNum(unitPrice) ?? 0,
                target,
                existingDescription: initialDescription,
            }),
        [label, org, hari, jam, kali, unitPrice, target, initialDescription]
    );

    const canApply = result.qty > 0 && result.unitPrice > 0;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onCancel();
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="calc-title"
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
                            <h2 id="calc-title" className="text-lg font-bold text-slate-900 leading-tight">
                                Kalkulator Rincian
                            </h2>
                            <p className="text-xs text-slate-500 leading-tight">
                                Hitung otomatis: org × hari × jam × kali
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200"
                        aria-label="Tutup"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-5">
                    {/* Label item */}
                    <div>
                        <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1.5">
                            <Tag className="h-4 w-4 text-slate-500" />
                            Nama / Label item
                        </label>
                        <input
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="contoh: Makan, Gaji bongkar, Lembur"
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
                                icon={<Users className="h-5 w-5" />}
                                color="emerald"
                                label="Orang"
                                hint="org"
                                value={org}
                                onChange={setOrg}
                                placeholder="5"
                            />
                            <BigNumField
                                icon={<Calendar className="h-5 w-5" />}
                                color="blue"
                                label="Hari"
                                hint="hr"
                                value={hari}
                                onChange={setHari}
                                placeholder="1"
                            />
                            <BigNumField
                                icon={<Clock className="h-5 w-5" />}
                                color="violet"
                                label="Jam"
                                hint="jm"
                                value={jam}
                                onChange={setJam}
                                placeholder="—"
                            />
                            <BigNumField
                                icon={<Repeat className="h-5 w-5" />}
                                color="amber"
                                label="Kali / Sesi"
                                hint="x"
                                value={kali}
                                onChange={setKali}
                                placeholder="3"
                            />
                        </div>
                    </div>

                    {/* Harga satuan */}
                    <div>
                        <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1.5">
                            <Wallet className="h-4 w-4 text-slate-500" />
                            Harga Satuan
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold pointer-events-none">
                                Rp
                            </span>
                            <input
                                type="number"
                                value={unitPrice}
                                onChange={(e) => setUnitPrice(e.target.value)}
                                placeholder="25000"
                                min="0"
                                inputMode="numeric"
                                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg pl-11 pr-3 py-3 text-base font-mono text-right"
                            />
                        </div>
                    </div>

                    {/* Target */}
                    <div>
                        <div className="text-sm font-semibold text-slate-700 mb-2">
                            Isi ke kolom harga yang mana?
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <TargetBtn
                                active={target === "COST"}
                                onClick={() => setTarget("COST")}
                                label="Biaya"
                                sub="Cost"
                                color="amber"
                            />
                            <TargetBtn
                                active={target === "RAB"}
                                onClick={() => setTarget("RAB")}
                                label="Klien"
                                sub="RAB"
                                color="blue"
                            />
                            <TargetBtn
                                active={target === "BOTH"}
                                onClick={() => setTarget("BOTH")}
                                label="Keduanya"
                                sub="Cost + RAB"
                                color="violet"
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
                                <div className="text-xs text-slate-500">Jumlah (Qty)</div>
                                <div className="text-2xl font-bold font-mono text-slate-900">
                                    {result.qty || 0}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500">Total</div>
                                <div className="text-2xl font-bold font-mono text-blue-700 leading-tight">
                                    {fmtRp(result.total)}
                                </div>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-dashed border-blue-200">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                Uraian otomatis
                            </div>
                            <div className="italic text-slate-800 text-sm break-words">
                                {result.descriptionText || (
                                    <span className="text-slate-400 not-italic">
                                        (isi label & faktor di atas)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer actions — sticky bawah biar selalu kelihatan */}
                <div className="sticky bottom-0 bg-white border-t px-5 py-4 flex gap-3 rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-lg text-base font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        disabled={!canApply}
                        onClick={() => onApply(result)}
                        className="flex-[2] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-base font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm"
                    >
                        <Check className="h-5 w-5" />
                        Terapkan
                    </button>
                </div>
            </div>
        </div>
    );
}

const colorMap: Record<
    string,
    { ring: string; iconBg: string; iconText: string; focusBorder: string }
> = {
    emerald: {
        ring: "border-emerald-200",
        iconBg: "bg-emerald-100",
        iconText: "text-emerald-700",
        focusBorder: "focus-within:border-emerald-500",
    },
    blue: {
        ring: "border-blue-200",
        iconBg: "bg-blue-100",
        iconText: "text-blue-700",
        focusBorder: "focus-within:border-blue-500",
    },
    violet: {
        ring: "border-violet-200",
        iconBg: "bg-violet-100",
        iconText: "text-violet-700",
        focusBorder: "focus-within:border-violet-500",
    },
    amber: {
        ring: "border-amber-200",
        iconBg: "bg-amber-100",
        iconText: "text-amber-700",
        focusBorder: "focus-within:border-amber-500",
    },
};

function BigNumField({
    icon,
    color,
    label,
    hint,
    value,
    onChange,
    placeholder,
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
        <div
            className={`rounded-lg border-2 ${c.ring} ${c.focusBorder} bg-white p-2.5 transition`}
        >
            <div className="flex items-center gap-2 mb-1.5">
                <span className={`p-1.5 rounded-md ${c.iconBg} ${c.iconText}`}>{icon}</span>
                <div className="leading-tight">
                    <div className="text-sm font-semibold text-slate-800">{label}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                        ({hint})
                    </div>
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

function TargetBtn({
    active,
    onClick,
    label,
    sub,
    color,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    sub: string;
    color: "amber" | "blue" | "violet";
}) {
    const map: Record<string, string> = {
        amber: active
            ? "bg-amber-500 text-white border-amber-500 shadow-md"
            : "bg-white text-amber-700 border-amber-300 hover:bg-amber-50",
        blue: active
            ? "bg-blue-600 text-white border-blue-600 shadow-md"
            : "bg-white text-blue-700 border-blue-300 hover:bg-blue-50",
        violet: active
            ? "bg-violet-600 text-white border-violet-600 shadow-md"
            : "bg-white text-violet-700 border-violet-300 hover:bg-violet-50",
    };
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex flex-col items-center justify-center px-2 py-2.5 border-2 rounded-lg transition ${map[color]}`}
        >
            <span className="text-sm font-bold leading-tight">{label}</span>
            <span className="text-[10px] opacity-80 leading-tight">{sub}</span>
        </button>
    );
}
