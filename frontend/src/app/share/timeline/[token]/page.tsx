"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, User as UserIcon, Package, Loader2, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { getPublicTimeline, type PublicTimelineEvent } from "@/lib/api/publicTimeline";

const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const DOW_ID = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const MON_SHORT = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

type Phase = "departure" | "setup" | "event" | "dismantle";
const PHASE_COLOR: Record<Phase, { solid: string; text: string; label: string }> = {
    departure: { solid: "bg-slate-500",  text: "text-slate-700",  label: "Berangkat" },
    setup:     { solid: "bg-red-600",    text: "text-red-700",    label: "Pasang / Setup" },
    event:     { solid: "bg-amber-500",  text: "text-amber-700",  label: "Hari Event" },
    dismantle: { solid: "bg-blue-600",   text: "text-blue-700",   label: "Bongkar" },
};
const BRAND_CFG: Record<string, { label: string; cls: string }> = {
    EXINDO: { label: "Exindo", cls: "bg-indigo-600 text-white" },
    XPOSER: { label: "Xposer", cls: "bg-pink-600 text-white" },
    OTHER:  { label: "Lainnya", cls: "bg-gray-600 text-white" },
};
const STATUS_CFG: Record<string, string> = {
    DRAFT: "Draft", SCHEDULED: "Terjadwal", IN_PROGRESS: "Berlangsung",
    COMPLETED: "Selesai", CANCELLED: "Dibatalkan",
};

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function daysBetween(a: Date, b: Date) {
    return Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}
function fmtDate(d: Date) {
    return `${DOW_ID[d.getDay()]}, ${d.getDate()} ${MON_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtRange(s: Date, e: Date) {
    if (startOfDay(s).getTime() === startOfDay(e).getTime()) return fmtDate(s);
    return `${d1(s)} → ${fmtDate(e)}`;
}
function d1(d: Date) { return `${d.getDate()} ${MON_SHORT[d.getMonth()]}`; }

function getPhaseRanges(ev: PublicTimelineEvent): Array<{ phase: Phase; start: Date; end: Date }> {
    const out: Array<{ phase: Phase; start: Date; end: Date }> = [];
    const push = (phase: Phase, s?: string | null, e?: string | null) => {
        if (!s) return; out.push({ phase, start: new Date(s), end: new Date(e ?? s) });
    };
    push("departure", ev.departureStart, ev.departureEnd);
    push("setup",     ev.setupStart,     ev.setupEnd);
    push("event",     ev.eventStart,     ev.eventEnd);
    push("dismantle", ev.loadingStart,   ev.loadingEnd);
    return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export default function PublicTimelinePage() {
    const params = useParams<{ token: string }>();
    const token = params.token;
    const today = new Date();
    const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;

    const { data: events = [], isLoading, error } = useQuery({
        queryKey: ["public-timeline", token, year, month],
        queryFn: () => getPublicTimeline(token, year, month),
        retry: false,
    });

    const monthStart = useMemo(() => new Date(year, month - 1, 1), [year, month]);
    const monthEnd = useMemo(() => new Date(year, month, 0), [year, month]);

    const filtered = useMemo(() => events.filter((e) =>
        getPhaseRanges(e).some((r) => r.end >= monthStart && r.start <= monthEnd)
    ), [events, monthStart, monthEnd]);

    const shift = (delta: number) => setCursor(new Date(year, month - 1 + delta, 1));

    // Link dicabut / token salah → halaman terkunci (huruf besar)
    if (error) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-6 bg-background">
                <div className="max-w-md text-center space-y-3">
                    <Lock className="h-12 w-12 text-muted-foreground mx-auto" />
                    <h1 className="text-2xl font-bold">Link tidak tersedia</h1>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Link timeline tidak valid atau sudah dicabut. Silakan minta link baru ke admin/kantor.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
            {/* ── Header sticky, full width, huruf besar ── */}
            <header className="sticky top-0 z-30 bg-card border-b-2 border-border">
                <div className="w-full px-4 md:px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                        <CalendarDays className="h-7 w-7 text-primary shrink-0" />
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold leading-tight">Jadwal Event</h1>
                            <p className="text-sm md:text-base text-muted-foreground">Rincian barang & jadwal yang dikerjakan</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => shift(-1)} aria-label="Bulan sebelumnya" className="h-11 w-11 inline-flex items-center justify-center rounded-lg border-2 border-border hover:bg-muted active:scale-95 transition">
                            <ChevronLeft className="h-6 w-6" />
                        </button>
                        <span className="text-lg md:text-xl font-bold min-w-[9.5rem] text-center">{MONTHS_ID[month - 1]} {year}</span>
                        <button onClick={() => shift(1)} aria-label="Bulan berikutnya" className="h-11 w-11 inline-flex items-center justify-center rounded-lg border-2 border-border hover:bg-muted active:scale-95 transition">
                            <ChevronRight className="h-6 w-6" />
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Konten ── */}
            <main className="flex-1 w-full px-4 md:px-6 py-5">
                {isLoading ? (
                    <div className="py-20 text-center text-lg text-muted-foreground">
                        <Loader2 className="h-7 w-7 animate-spin inline mr-2 align-middle" /> Memuat jadwal…
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-20 text-center text-lg text-muted-foreground">Tidak ada event di bulan ini.</div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 md:gap-5">
                        {filtered.map((ev) => (
                            <EventCard key={ev.id} ev={ev} today={today} />
                        ))}
                    </div>
                )}
            </main>

            {/* ── Legend fase, huruf besar ── */}
            <footer className="w-full px-4 md:px-6 py-4 border-t-2 border-border bg-muted/20">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-base">
                    <span className="font-semibold text-muted-foreground">Keterangan warna:</span>
                    {(Object.keys(PHASE_COLOR) as Phase[]).map((p) => (
                        <span key={p} className="flex items-center gap-2">
                            <span className={`inline-block w-4 h-4 rounded ${PHASE_COLOR[p].solid}`} />
                            {PHASE_COLOR[p].label}
                        </span>
                    ))}
                </div>
            </footer>
        </div>
    );
}

// ── Kartu per event — huruf besar, jelas, responsif ──
function EventCard({ ev, today }: { ev: PublicTimelineEvent; today: Date }) {
    const ranges = getPhaseRanges(ev);
    const brand = BRAND_CFG[ev.brand] ?? BRAND_CFG.OTHER;
    const pic = ev.picWorker?.name ?? ev.picName;

    // Apakah sedang berlangsung hari ini?
    const t = startOfDay(today).getTime();
    const isActiveToday = ranges.some((r) => startOfDay(r.start).getTime() <= t && t <= startOfDay(r.end).getTime());

    return (
        <article className={`rounded-2xl border-2 bg-card p-4 md:p-5 flex flex-col gap-3 ${isActiveToday ? "border-primary shadow-md" : "border-border"}`}>
            {/* Judul + brand/status */}
            <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl md:text-2xl font-bold leading-snug">{ev.name}</h2>
                <span className={`shrink-0 text-sm font-semibold px-2.5 py-1 rounded-full ${brand.cls}`}>{brand.label}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="px-2.5 py-1 rounded-full bg-muted font-medium">{STATUS_CFG[ev.status] ?? ev.status}</span>
                {isActiveToday && <span className="px-2.5 py-1 rounded-full bg-primary text-primary-foreground font-semibold">Berlangsung hari ini</span>}
            </div>

            {/* Info lokasi & PIC — huruf besar */}
            <div className="space-y-1.5 text-base md:text-lg">
                {ev.venue && (
                    <div className="flex items-start gap-2.5">
                        <MapPin className="h-6 w-6 text-muted-foreground shrink-0 mt-0.5" />
                        <span>{ev.venue}</span>
                    </div>
                )}
                {pic && (
                    <div className="flex items-center gap-2.5">
                        <UserIcon className="h-6 w-6 text-muted-foreground shrink-0" />
                        <span><span className="text-muted-foreground">PIC:</span> <span className="font-semibold">{pic}</span></span>
                    </div>
                )}
            </div>

            {/* Jadwal fase — daftar jelas, huruf besar */}
            <div className="rounded-xl border border-border overflow-hidden">
                {ranges.length === 0 ? (
                    <div className="p-3 text-base text-muted-foreground italic">Jadwal belum diisi</div>
                ) : (
                    <ul className="divide-y divide-border">
                        {ranges.map((r, i) => (
                            <li key={i} className="flex items-center gap-3 p-3">
                                <span className={`inline-block w-4 h-4 rounded shrink-0 ${PHASE_COLOR[r.phase].solid}`} />
                                <span className="w-32 md:w-36 shrink-0 font-semibold text-base md:text-lg">{PHASE_COLOR[r.phase].label}</span>
                                <span className="text-base md:text-lg">{fmtRange(r.start, r.end)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Order description — paling menonjol, huruf besar */}
            <div className="rounded-xl bg-primary/5 border-2 border-primary/20 p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                    <Package className="h-6 w-6 text-primary shrink-0" />
                    <span className="text-base font-bold uppercase tracking-wide text-primary">Yang dikerjakan / barang</span>
                </div>
                {ev.orderDescription ? (
                    <p className="text-base md:text-lg leading-relaxed whitespace-pre-line">{ev.orderDescription}</p>
                ) : (
                    <p className="text-base text-muted-foreground italic">Rincian order belum diisi.</p>
                )}
            </div>
        </article>
    );
}
