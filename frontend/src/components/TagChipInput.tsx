"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Tag as TagIcon, Trash2 } from "lucide-react";
import { getRabTags, deleteRabTag } from "@/lib/api/rab";

/**
 * Tag chip input dengan autocomplete dari tag yang sudah pernah dipakai
 * di RAB lain (frequency-sorted).
 *
 * Behavior:
 * - Ketik → tampil suggestion. Enter / Tab / koma → commit jadi chip
 * - Backspace di empty input → hapus chip terakhir
 * - Klik suggestion → langsung tambah
 */
export function TagChipInput({
    value,
    onChange,
    placeholder = "Tambah tag (Enter / koma)…",
    presets = DEFAULT_PRESETS,
}: {
    value: string[];
    onChange: (next: string[]) => void;
    placeholder?: string;
    presets?: string[];
}) {
    const [input, setInput] = useState("");
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLInputElement | null>(null);

    const qc = useQueryClient();
    const { data: suggestions } = useQuery({
        queryKey: ["rab-tags"],
        queryFn: getRabTags,
        staleTime: 60_000,
    });

    // Hidden presets — tag preset hardcoded yang user "hapus" dari sugestion.
    // Disimpan di localStorage karena preset gak bisa di-hapus dari kode.
    const HIDDEN_KEY = "rab-hidden-preset-tags";
    const [hiddenPresets, setHiddenPresets] = useState<string[]>([]);
    useEffect(() => {
        try {
            const raw = localStorage.getItem(HIDDEN_KEY);
            if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) setHiddenPresets(arr.filter((x: unknown): x is string => typeof x === "string"));
            }
        } catch { /* ignore */ }
    }, []);
    const persistHidden = (next: string[]) => {
        setHiddenPresets(next);
        try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    };
    const hideLocalPreset = (tag: string) => {
        const lower = tag.toLowerCase();
        if (hiddenPresets.some(h => h.toLowerCase() === lower)) return;
        persistHidden([...hiddenPresets, tag]);
        // Hapus juga dari value lokal kalau RAB ini punya tag itu
        onChange(value.filter((v) => v.toLowerCase() !== lower));
    };

    const deleteTagMut = useMutation({
        mutationFn: deleteRabTag,
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ["rab-tags"] });
            qc.invalidateQueries({ queryKey: ["rabs"] });
            // Hapus juga dari value lokal kalau RAB ini punya tag tsb
            onChange(value.filter((v) => v.toLowerCase() !== res.tag.toLowerCase()));
        },
        onError: (e: any) => {
            alert(`❌ Gagal hapus tag: ${e?.response?.data?.message || e?.message || "Unknown"}`);
        },
    });

    function handleDeleteSuggestion(tag: string, count: number) {
        const msg = count > 0
            ? `Hapus tag "${tag}" dari ${count} RAB yang memilikinya?\n\nTag akan hilang dari semua RAB tersebut. Operasi tidak bisa di-undo.`
            : `Hapus tag "${tag}"?`;
        if (!confirm(msg)) return;
        deleteTagMut.mutate(tag);
    }

    const allCandidates = useMemo(() => {
        const fromDb = (suggestions ?? []).map((s) => s.tag);
        const hiddenLower = new Set(hiddenPresets.map(h => h.toLowerCase()));
        const dbLower = new Set(fromDb.map(t => t.toLowerCase()));
        const merged: string[] = [];
        const seen = new Set<string>();
        for (const t of [...fromDb, ...presets]) {
            const k = t.trim();
            if (!k) continue;
            const lk = k.toLowerCase();
            if (seen.has(lk)) continue;
            // Skip preset yang user "hapus" — tapi kalau tag itu sudah dipakai di DB, tetap show
            if (hiddenLower.has(lk) && !dbLower.has(lk)) continue;
            seen.add(lk);
            merged.push(k);
        }
        return merged;
    }, [suggestions, presets, hiddenPresets]);

    const filtered = useMemo(() => {
        const q = input.trim().toLowerCase();
        const valueLower = new Set(value.map((v) => v.toLowerCase()));
        return allCandidates
            .filter((t) => !valueLower.has(t.toLowerCase()))
            .filter((t) => (q ? t.toLowerCase().includes(q) : true))
            .slice(0, 12);
    }, [allCandidates, input, value]);

    function commit(raw: string) {
        const t = raw.trim();
        if (!t) return;
        if (value.some((v) => v.toLowerCase() === t.toLowerCase())) {
            setInput("");
            return;
        }
        onChange([...value, t]);
        setInput("");
    }

    function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit(input);
        } else if (e.key === "Tab" && input.trim()) {
            e.preventDefault();
            commit(input);
        } else if (e.key === "Backspace" && !input && value.length > 0) {
            onChange(value.slice(0, -1));
        }
    }

    // Click outside → close suggestions
    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);

    return (
        <div className="relative">
            <div className="flex flex-wrap items-center gap-1.5 border-2 rounded-lg px-2 py-1.5 bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30 transition">
                {value.map((t, i) => (
                    <span
                        key={`${t}-${i}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
                    >
                        <TagIcon className="h-3 w-3" />
                        {t}
                        <button
                            type="button"
                            onClick={() => onChange(value.filter((_, j) => j !== i))}
                            className="hover:bg-blue-200 rounded p-0.5"
                            title="Hapus tag"
                        >
                            <X className="h-2.5 w-2.5" />
                        </button>
                    </span>
                ))}
                <input
                    ref={ref}
                    type="text"
                    value={input}
                    onChange={(e) => { setInput(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={handleKey}
                    placeholder={value.length === 0 ? placeholder : ""}
                    className="flex-1 min-w-[120px] outline-none border-none bg-transparent text-sm py-0.5"
                />
            </div>

            {/* Suggestion dropdown */}
            {open && (filtered.length > 0 || (input.trim() && !value.some((v) => v.toLowerCase() === input.trim().toLowerCase()))) && (
                <div className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-background border rounded-md shadow-lg text-sm">
                    {input.trim() && !filtered.some((t) => t.toLowerCase() === input.trim().toLowerCase()) && (
                        <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); commit(input); }}
                            className="w-full text-left px-3 py-2 hover:bg-muted text-primary border-b"
                        >
                            + Tambah tag baru: <b>"{input.trim()}"</b>
                        </button>
                    )}
                    {filtered.map((t) => {
                        const sug = (suggestions ?? []).find((s) => s.tag === t);
                        const fromDb = !!sug;
                        // Tag preset (belum dipakai RAB) → tombol hapus = hide dari sugestion (localStorage)
                        // Tag DB (dipakai 1+ RAB) → tombol hapus = hapus global dari semua RAB
                        return (
                            <div
                                key={t}
                                className="group flex items-center justify-between gap-2 hover:bg-muted"
                            >
                                <button
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); commit(t); }}
                                    className="flex-1 text-left px-3 py-1.5 inline-flex items-center gap-1.5"
                                >
                                    <TagIcon className="h-3 w-3 text-muted-foreground" />
                                    {t}
                                </button>
                                <div className="flex items-center gap-1 pr-2">
                                    {sug ? (
                                        <span className="text-[10px] text-muted-foreground">{sug.count}×</span>
                                    ) : (
                                        <span className="text-[10px] text-muted-foreground italic">preset</span>
                                    )}
                                    <button
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (fromDb) {
                                                handleDeleteSuggestion(t, sug?.count ?? 0);
                                            } else {
                                                // Preset: cuma hide dari sugestion (localStorage), gak ada DB op
                                                hideLocalPreset(t);
                                            }
                                        }}
                                        disabled={deleteTagMut.isPending}
                                        title={
                                            fromDb
                                                ? `Hapus tag "${t}" dari ${sug?.count ?? 0} RAB`
                                                : `Sembunyikan preset "${t}" dari sugestion`
                                        }
                                        className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {hiddenPresets.length > 0 && (
                        <div className="border-t mt-1 pt-1 px-3 py-1.5 flex items-center justify-between gap-2 bg-muted/30">
                            <span className="text-[10px] text-muted-foreground">
                                {hiddenPresets.length} preset disembunyikan
                            </span>
                            <button
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    persistHidden([]);
                                }}
                                className="text-[10px] font-medium text-blue-600 hover:text-blue-800 hover:underline"
                            >
                                Tampilkan kembali
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/** Preset tag suggestion (selalu muncul walau DB kosong) */
export const DEFAULT_PRESETS = [
    "Stand Standar 3x3",
    "Stand Standar 2x2",
    "Stand Special 4x5",
    "Stand Special 3x4",
    "Stand Partisi 2x3",
    "Stand Partisi 3x3",
    "Booth Maxima",
    "Booth Custom",
    "Pengadaan",
    "Sewa",
    "Indoor",
    "Outdoor",
    "Pameran",
    "Bazar",
    "Wedding",
    "Corporate Event",
];

export default TagChipInput;
