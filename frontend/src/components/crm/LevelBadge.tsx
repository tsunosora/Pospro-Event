import type { LeadLevel } from "@/lib/api/crm";

const STYLES: Record<LeadLevel, string> = {
    HOT: "bg-red-100 text-red-700 border-red-200",
    WARM: "bg-orange-100 text-orange-700 border-orange-200",
    COLD: "bg-sky-100 text-sky-700 border-sky-200",
    UNQUALIFIED: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

const LABEL: Record<LeadLevel, string> = {
    HOT: "Hot",
    WARM: "Warm",
    COLD: "Cold",
    UNQUALIFIED: "Unqualified",
};

export function LevelBadge({ level }: { level: LeadLevel | null | undefined }) {
    if (!level) return null;
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${STYLES[level]}`}>
            {LABEL[level]}
        </span>
    );
}
