"use client";

import { BRAND_META, type Brand } from "@/lib/api/brands";

interface Props {
    brand: Brand | null | undefined;
    /** Tampilkan label panjang ("CV. Exindo Pratama") atau pendek ("Exindo") */
    variant?: "short" | "long";
    /** Ukuran badge */
    size?: "xs" | "sm" | "md";
    /** Tampilkan icon emoji di kiri */
    showEmoji?: boolean;
    /** Klik handler — kalau ada, badge jadi clickable */
    onClick?: () => void;
    className?: string;
}

/**
 * Badge brand reusable. Kalau `brand` null → tampil "⚠ Belum di-tag" warna kuning.
 */
export function BrandBadge({
    brand,
    variant = "short",
    size = "sm",
    showEmoji = true,
    onClick,
    className = "",
}: Props) {
    const sizeCls =
        size === "xs"
            ? "text-[10px] px-1.5 py-0.5"
            : size === "md"
                ? "text-sm px-3 py-1"
                : "text-xs px-2 py-0.5";

    if (!brand) {
        return (
            <span
                onClick={onClick}
                className={`inline-flex items-center gap-1 rounded-full border bg-amber-50 text-amber-700 border-amber-300 font-semibold ${sizeCls} ${onClick ? "cursor-pointer hover:bg-amber-100" : ""} ${className}`}
                title={onClick ? "Klik untuk pilih brand" : "Brand belum di-set"}
            >
                {showEmoji && <span>⚠</span>}
                <span>Belum di-tag</span>
            </span>
        );
    }

    const meta = BRAND_META[brand];
    return (
        <span
            onClick={onClick}
            className={`inline-flex items-center gap-1 rounded-full border font-semibold ${meta.bg} ${meta.text} ${meta.border} ${sizeCls} ${onClick ? "cursor-pointer hover:opacity-80" : ""} ${className}`}
            title={meta.label}
        >
            {showEmoji && <span>{meta.emoji}</span>}
            <span>{variant === "long" ? meta.label : meta.short}</span>
        </span>
    );
}
