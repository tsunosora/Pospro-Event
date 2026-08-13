// Utility minggu kalender (Senin sebagai awal minggu, zona waktu server/local).

/** Senin 00:00:00 dari minggu yang memuat `date`. */
export function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Min, 1=Sen, ... 6=Sab
  const diff = day === 0 ? -6 : 1 - day; // mundur ke Senin
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Minggu 00:00:00 (akhir minggu) dari minggu yang memuat `date`. */
export function sundayOf(date: Date): Date {
  const mon = mondayOf(date);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return sun;
}

/** Tanggal acuan minggu untuk sebuah event (fallback berjenjang). */
export function eventRefDate(ev: {
  eventStart?: Date | null;
  setupStart?: Date | null;
  loadingStart?: Date | null;
  departureStart?: Date | null;
  createdAt?: Date | null;
}): Date {
  return (
    ev.eventStart ?? ev.setupStart ?? ev.loadingStart ?? ev.departureStart ?? ev.createdAt ?? new Date()
  );
}
