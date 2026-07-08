"use client";

import { AlertTriangle } from "lucide-react";

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
                className={`inline-flex items-center gap-1 rounded-full border bg-warning/15 text-warning border-warning/30 font-semibold transition-colors ${sizeCls} ${onClick ? "cursor-pointer hover:bg-warning/20" : ""} ${className}`}
                title={onClick ? "Klik untuk pilih brand" : "Brand belum di-set"}
            >
                {showEmoji && <AlertTriangle className="w-3 h-3" />}
                <span>Belum di-tag</span>
            </span>
        );
    }

    const meta = BRAND_META[brand];
    return (
        <span
            onClick={onClick}
            className={`inline-flex items-center gap-1 rounded-full border font-semibold transition-colors ${meta.bg} ${meta.text} ${meta.border} ${sizeCls} ${onClick ? "cursor-pointer hover:opacity-80" : ""} ${className}`}
            title={meta.label}
        >
            {showEmoji && <span>{meta.emoji}</span>}
            <span>{variant === "long" ? meta.label : meta.short}</span>
        </span>
    );
}
