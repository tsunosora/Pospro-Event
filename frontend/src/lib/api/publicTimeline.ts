// Fetch timeline event publik — TANPA Authorization (halaman /share/timeline).
// Sengaja pakai fetch langsung, bukan axios `api` (yang menyisipkan Bearer token).

export type PublicTimelineEvent = {
    id: number;
    code: string;
    name: string;
    brand: "EXINDO" | "XPOSER" | "OTHER";
    /** Warna brand (themeColor dari setting brand). Null bila belum diatur → pakai fallback. */
    brandColor?: string | null;
    status: "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    venue: string | null;
    customerId: number | null;
    customerName: string | null;
    picName: string | null;
    departureStart: string | null; departureEnd: string | null;
    setupStart: string | null; setupEnd: string | null;
    loadingStart: string | null; loadingEnd: string | null;
    eventStart: string | null; eventEnd: string | null;
    customer: { id: number; name: string; companyName: string | null } | null;
    picWorker: { id: number; name: string; position: string | null } | null;
    teams: Array<{ id: number; name: string; color: string }>;
    crew: Array<{
        id: number;
        name: string;
        position: string | null;
        role: string | null;
        team: { id: number; name: string; color: string } | null;
    }>;
    marketing: { id: number; name: string; position: string | null } | null;
    orderDescription: string | null;
    productCategory: string | null;
};

/**
 * Label + warna fallback per brand — dipakai HANYA kalau themeColor belum diatur di
 * setting brand. Nilai disamakan dengan default "Warna PDF" di /settings/brands.
 */
const BRAND_FALLBACK: Record<string, { label: string; color: string }> = {
    EXINDO: { label: "Exindo", color: "#1e40af" },
    XPOSER: { label: "Xposer", color: "#0d9488" },
    OTHER: { label: "Lainnya", color: "#c8203a" },
};

/** Warna brand efektif untuk sebuah event: pakai themeColor dari setting brand, fallback ke default. */
export function brandColorOf(ev: Pick<PublicTimelineEvent, "brand" | "brandColor">): string {
    return ev.brandColor || BRAND_FALLBACK[ev.brand]?.color || BRAND_FALLBACK.OTHER.color;
}

/** Label brand ringkas untuk badge. */
export function brandLabelOf(ev: Pick<PublicTimelineEvent, "brand">): string {
    return BRAND_FALLBACK[ev.brand]?.label ?? ev.brand;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function getPublicTimeline(
    token: string,
    year: number,
    month: number,
    opts: { teamIds?: number[]; picIds?: number[] } = {},
): Promise<PublicTimelineEvent[]> {
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (opts.teamIds?.length) params.set("team", opts.teamIds.join(","));
    if (opts.picIds?.length) params.set("pic", opts.picIds.join(","));
    const r = await fetch(`${apiBase}/public/events/timeline/${encodeURIComponent(token)}?${params.toString()}`, {
        cache: "no-store",
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.message || "Link timeline tidak valid atau sudah dicabut");
    return r.json();
}
