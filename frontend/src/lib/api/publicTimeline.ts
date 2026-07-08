// Fetch timeline event publik — TANPA Authorization (halaman /share/timeline).
// Sengaja pakai fetch langsung, bukan axios `api` (yang menyisipkan Bearer token).

export type PublicTimelineEvent = {
    id: number;
    code: string;
    name: string;
    brand: "EXINDO" | "XPOSER" | "OTHER";
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
    orderDescription: string | null;
    productCategory: string | null;
};

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
