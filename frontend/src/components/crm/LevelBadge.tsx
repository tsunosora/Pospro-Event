import type { LeadLevel } from "@/lib/api/crm";

const STYLES: Record<LeadLevel, string> = {
    HOT: "bg-destructive/12 text-destructive border-destructive/30",
    WARM: "bg-warning/15 text-warning border-warning/30",
    COLD: "bg-info/15 text-info border-info/30",
    UNQUALIFIED: "bg-muted text-muted-foreground border-border",
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
