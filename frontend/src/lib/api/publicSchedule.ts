// Fetch jadwal event publik — TANPA Authorization, hanya PIN via header.
// Sengaja pakai fetch langsung (bukan axios `api` yang menyisipkan Bearer token).
import type { PublicTimelineEvent } from './publicTimeline';

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export class SchedulePinError extends Error {}
export class RateLimitError extends Error {}

async function readMessage(r: Response, fallback: string): Promise<string> {
    const j = await r.json().catch(() => null);
    return (j && typeof j.message === 'string' && j.message) || fallback;
}

/** Verifikasi PIN jadwal. Return true bila benar. Lempar RateLimitError bila 429. */
export async function verifyPublicSchedulePin(pin: string): Promise<boolean> {
    const r = await fetch(`${apiBase}/schedule-pin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
        cache: 'no-store',
    });
    if (r.status === 429) throw new RateLimitError(await readMessage(r, 'Terlalu banyak percobaan. Coba lagi nanti.'));
    if (!r.ok) return false;
    const j = await r.json().catch(() => ({ ok: false }));
    return !!j?.ok;
}

/**
 * Ambil semua event 1 bulan.
 * - 401 → SchedulePinError (PIN salah/dicabut)
 * - 429 → RateLimitError (terlalu sering)
 */
export async function getPublicSchedule(
    pin: string,
    year: number,
    month: number,
): Promise<PublicTimelineEvent[]> {
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    const r = await fetch(`${apiBase}/public/schedule?${params.toString()}`, {
        headers: { 'x-schedule-pin': pin },
        cache: 'no-store',
    });
    if (r.status === 401) throw new SchedulePinError('PIN jadwal salah atau belum diatur');
    if (r.status === 429) throw new RateLimitError(await readMessage(r, 'Terlalu banyak permintaan. Coba lagi sebentar.'));
    if (!r.ok) throw new Error('Gagal memuat jadwal');
    return r.json();
}
