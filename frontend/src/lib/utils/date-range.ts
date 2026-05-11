import dayjs from "dayjs";
import "dayjs/locale/id";

const MONTH_ID_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/**
 * Format smart range tanggal id-ID:
 * - Single (end null/sama): "18 Mei 2026"
 * - Bulan & tahun sama: "18-21 Mei 2026"
 * - Bulan beda, tahun sama: "29 Mei - 3 Jun 2026"
 * - Beda tahun: "28 Des 2026 - 2 Jan 2027"
 *
 * Mirroring pattern dari backend `formatDateRange` di `quotation-context.builder.ts`.
 */
export function formatDateRangeId(
    start: string | Date | null,
    end: string | Date | null,
    short = false,
): string {
    if (!start) return "";
    const s = dayjs(start);
    const e = end ? dayjs(end) : null;
    const months = short ? MONTH_ID_SHORT : MONTH_ID;

    if (!e || s.isSame(e, "day")) {
        return `${s.date()} ${months[s.month()]} ${s.year()}`;
    }
    if (s.month() === e.month() && s.year() === e.year()) {
        return `${s.date()}-${e.date()} ${months[s.month()]} ${s.year()}`;
    }
    if (s.year() === e.year()) {
        return `${s.date()} ${months[s.month()]} - ${e.date()} ${months[e.month()]} ${s.year()}`;
    }
    return `${s.date()} ${months[s.month()]} ${s.year()} - ${e.date()} ${months[e.month()]} ${e.year()}`;
}

/** Helper khusus Lead — pakai field eventDateStart/End. Return null kalau start kosong. */
export function formatLeadEventDateRange(lead: {
    eventDateStart: string | null;
    eventDateEnd: string | null;
}): string | null {
    if (!lead.eventDateStart) return null;
    return formatDateRangeId(lead.eventDateStart, lead.eventDateEnd, false);
}

/** Versi short untuk display compact (kanban card, dll). */
export function formatLeadEventDateRangeShort(lead: {
    eventDateStart: string | null;
    eventDateEnd: string | null;
}): string | null {
    if (!lead.eventDateStart) return null;
    return formatDateRangeId(lead.eventDateStart, lead.eventDateEnd, true);
}
