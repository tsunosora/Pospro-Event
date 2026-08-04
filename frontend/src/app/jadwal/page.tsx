"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, KeyRound, Loader2, Lock, LayoutList, CalendarRange, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { getPublicSchedule, verifyPublicSchedulePin, SchedulePinError, RateLimitError } from "@/lib/api/publicSchedule";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { ScheduleList } from "./ScheduleList";
import { LiveClock } from "./LiveClock";
import { AmbientBg } from "./AmbientBg";

const SS_KEY = "schedule-pin";
const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default function JadwalPage() {
    // pin: null = belum unlock; ready: false sampai sessionStorage terbaca (hindari hydration mismatch).
    const [state, setState] = useState<{ ready: boolean; pin: string | null }>({ ready: false, pin: null });

    useEffect(() => {
        // Baca sesi PIN sekali saat mount. setState di sini disengaja (data hanya ada di client).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState({ ready: true, pin: sessionStorage.getItem(SS_KEY) });
    }, []);

    const savePin = useCallback((p: string) => { sessionStorage.setItem(SS_KEY, p); setState({ ready: true, pin: p }); }, []);
    const clearPin = useCallback(() => { sessionStorage.removeItem(SS_KEY); setState({ ready: true, pin: null }); }, []);

    if (!state.ready) {
        return <div className="jadwal-motion min-h-screen flex items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
    }
    if (!state.pin) return <PinGate onOk={savePin} />;
    return <ScheduleView pin={state.pin} onLocked={clearPin} />;
}

function PinGate({ onOk }: { onOk: (pin: string) => void }) {
    const [pin, setPin] = useState("");
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);
        if (!/^\d{4,8}$/.test(pin)) { setErr("PIN harus angka 4–8 digit"); return; }
        setLoading(true);
        try {
            const ok = await verifyPublicSchedulePin(pin);
            if (ok) onOk(pin); else setErr("PIN salah");
        } catch (e) {
            setErr(e instanceof RateLimitError ? e.message : "Gagal memverifikasi PIN");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="jadwal-motion relative min-h-screen w-full flex items-center justify-center p-6 bg-background overflow-hidden">
            <AmbientBg />
            <form onSubmit={submit} className="relative w-full max-w-sm space-y-5 text-center animate-in">
                <div className="flex flex-col items-center gap-3">
                    {/* Ikon melayang + cincin denyut → menarik perhatian */}
                    <div className="relative h-16 w-16 flex items-center justify-center">
                        <span className="absolute inset-0 rounded-2xl bg-primary/30 animate-pulse-ring" aria-hidden />
                        <div className="animate-float relative h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shadow-sm">
                            <Lock className="h-8 w-8 text-primary" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Jadwal Event</h1>
                        <p className="text-sm text-muted-foreground mt-1">Masukkan PIN untuk melihat jadwal.</p>
                    </div>
                    <LiveClock variant="hero" />
                </div>
                <input
                    autoFocus
                    type="password"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={8}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    className="w-full border-2 border-border rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-[0.4em] bg-background transition-all focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary"
                    placeholder="••••"
                />
                {err && <p className="text-sm text-destructive animate-fade">{err}</p>}
                <button
                    type="submit"
                    disabled={loading}
                    className="relative w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 shadow-sm overflow-hidden transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
                >
                    {/* Kilau menyapu terus-menerus */}
                    <span aria-hidden className="animate-shimmer absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-white/25 blur-md" />
                    <span className="relative inline-flex items-center gap-2">
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />} Buka Jadwal
                    </span>
                </button>
            </form>
        </div>
    );
}

function ScheduleView({ pin, onLocked }: { pin: string; onLocked: () => void }) {
    const today = new Date();
    const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [view, setView] = useState<"calendar" | "list">("calendar");
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;

    const { data: events = [], isLoading, error } = useQuery({
        queryKey: ["public-schedule", year, month],
        queryFn: () => getPublicSchedule(pin, year, month),
        retry: false,
    });

    // PIN dicabut/berubah di server → kembali ke gate.
    useEffect(() => { if (error instanceof SchedulePinError) onLocked(); }, [error, onLocked]);

    const shift = (d: number) => setCursor(new Date(year, month - 1 + d, 1));

    return (
        <div className="jadwal-motion relative h-screen w-full bg-background text-foreground flex flex-col overflow-hidden">
            <AmbientBg />
            <header className="relative z-10 shrink-0 bg-card/90 backdrop-blur-sm border-b-2 border-border animate-fade">
                <div className="w-full px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                        <CalendarDays className="h-7 w-7 text-primary shrink-0 animate-float" />
                        <h1 className="text-xl md:text-2xl font-bold">Jadwal Event</h1>
                    </div>
                    <LiveClock variant="bar" />
                    <div className="flex items-center gap-2">
                        <div className="inline-flex rounded-lg border-2 border-border overflow-hidden">
                            <button
                                onClick={() => setView("calendar")}
                                className={`h-10 px-3 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors ${view === "calendar" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                            >
                                <CalendarRange className="h-4 w-4" /> Kalender
                            </button>
                            <button
                                onClick={() => setView("list")}
                                className={`h-10 px-3 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                            >
                                <LayoutList className="h-4 w-4" /> Daftar
                            </button>
                        </div>
                        <button onClick={() => shift(-1)} aria-label="Bulan sebelumnya" className="h-10 w-10 inline-flex items-center justify-center rounded-lg border-2 border-border hover:bg-muted active:scale-95 transition"><ChevronLeft className="h-5 w-5" /></button>
                        <span key={`${month}-${year}`} className="text-base md:text-lg font-bold min-w-[9rem] text-center animate-pop">{MONTHS_ID[month - 1]} {year}</span>
                        <button onClick={() => shift(1)} aria-label="Bulan berikutnya" className="h-10 w-10 inline-flex items-center justify-center rounded-lg border-2 border-border hover:bg-muted active:scale-95 transition"><ChevronRight className="h-5 w-5" /></button>
                        <button onClick={onLocked} aria-label="Kunci" title="Kunci halaman" className="h-10 w-10 inline-flex items-center justify-center rounded-lg border-2 border-border hover:bg-muted active:scale-95 transition"><LogOut className="h-5 w-5" /></button>
                    </div>
                </div>
            </header>
            {/* Garis aksen bergerak (streak) */}
            <div className="relative z-10 h-1 w-full bg-gradient-to-r from-primary/0 via-primary to-primary/0 animate-slide-bg" />

            <div className="relative z-10 flex-1 overflow-auto">
                {isLoading ? (
                    <div className="py-20 text-center text-lg text-muted-foreground"><Loader2 className="h-7 w-7 animate-spin inline mr-2 align-middle" /> Memuat jadwal…</div>
                ) : error instanceof RateLimitError ? (
                    <div className="py-20 px-6 text-center text-lg text-muted-foreground animate-fade">{error.message}</div>
                ) : (
                    <div key={`${view}-${year}-${month}`} className="animate-fade">
                        {view === "calendar"
                            ? <ScheduleCalendar events={events} year={year} month={month} />
                            : <ScheduleList events={events} />}
                    </div>
                )}
            </div>
        </div>
    );
}
