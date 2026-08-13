"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HardHat, CalendarDays, Wallet, CheckCircle2, Undo2, Loader2, RefreshCw } from "lucide-react";
import {
    getBoronganWeeks,
    getBoronganSlips,
    generateBoronganWeek,
    payBoronganSlip,
    unpayBoronganSlip,
    BORONGAN_CLASS_LABEL,
} from "@/lib/api/borongan";

const rupiah = (n: number | string | null | undefined) => "Rp " + Number(n || 0).toLocaleString("id-ID");

/** Senin (YYYY-MM-DD) dari minggu yang memuat `d`. */
function mondayStr(d: Date): string {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = x.getDay();
    x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, "0");
    const dd = String(x.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}

function fmtDate(s: string) {
    return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function BoronganPage() {
    const qc = useQueryClient();
    const [week, setWeek] = useState<string>(() => mondayStr(new Date()));
    const normalizedWeek = useMemo(() => mondayStr(new Date(week + "T00:00:00")), [week]);

    const weeksQ = useQuery({ queryKey: ["borongan-weeks"], queryFn: getBoronganWeeks });
    const slipsQ = useQuery({
        queryKey: ["borongan-slips", normalizedWeek],
        queryFn: () => getBoronganSlips({ weekStart: normalizedWeek }),
    });

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ["borongan-weeks"] });
        qc.invalidateQueries({ queryKey: ["borongan-slips", normalizedWeek] });
    };

    const genMut = useMutation({
        mutationFn: () => generateBoronganWeek(normalizedWeek),
        onSuccess: (r) => { invalidate(); alert(`Berhasil generate ${r.generated} slip untuk minggu ${fmtDate(r.weekStart)}.`); },
        onError: (e: any) => alert(e?.response?.data?.message || "Gagal generate slip"),
    });
    const payMut = useMutation({
        mutationFn: payBoronganSlip,
        onSuccess: invalidate,
        onError: (e: any) => alert(e?.response?.data?.message || "Gagal membayar slip"),
    });
    const unpayMut = useMutation({
        mutationFn: unpayBoronganSlip,
        onSuccess: invalidate,
        onError: (e: any) => alert(e?.response?.data?.message || "Gagal membatalkan pembayaran"),
    });

    const slips = slipsQ.data ?? [];
    const weekTotal = slips.reduce((a, s) => a + Number(s.totalAmount), 0);

    return (
        <div className="p-6 space-y-4">
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <HardHat className="h-5 w-5" /> Gaji Borongan Mingguan
                </h1>
                <p className="text-sm text-muted-foreground">
                    Rekap borongan tukang per minggu kalender (Senin–Minggu). Bayar slip → otomatis tercatat di Cashflow &amp; laba per event.
                </p>
            </div>

            {/* Pilih minggu + generate */}
            <div className="glass rounded-xl p-3 flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Minggu (pilih tanggal mana saja)</label>
                    <input
                        type="date"
                        value={week}
                        onChange={(e) => setWeek(e.target.value)}
                        className="border rounded px-3 py-2 text-sm bg-background"
                    />
                    <p className="text-[11px] text-muted-foreground">Senin minggu ini: <b>{fmtDate(normalizedWeek)}</b></p>
                </div>
                <button
                    onClick={() => genMut.mutate()}
                    disabled={genMut.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
                >
                    {genMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Generate Slip Minggu Ini
                </button>
            </div>

            {/* Ringkasan per minggu */}
            {weeksQ.data && weeksQ.data.length > 0 && (
                <div className="space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground">Ringkasan per Minggu</div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {weeksQ.data.map((w) => (
                            <button
                                key={w.weekStart}
                                onClick={() => setWeek(w.weekStart)}
                                className={`shrink-0 text-left border rounded-lg p-2.5 min-w-[170px] transition-colors cursor-pointer ${w.weekStart === normalizedWeek ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
                            >
                                <div className="text-xs font-semibold">{fmtDate(w.weekStart)}</div>
                                <div className="text-[11px] text-muted-foreground">{w.slips} slip · {rupiah(w.total)}</div>
                                <div className="text-[11px] mt-1 flex gap-2">
                                    <span className="text-success">Dibayar {rupiah(w.paid)}</span>
                                    {w.draft > 0 && <span className="text-warning">Draft {rupiah(w.draft)}</span>}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Daftar slip minggu terpilih */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Slip minggu {fmtDate(normalizedWeek)}</div>
                    <div className="text-xs text-muted-foreground">Total {rupiah(weekTotal)}</div>
                </div>

                {slipsQ.isLoading ? (
                    <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Memuat...</div>
                ) : slips.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground border rounded-lg">
                        Belum ada slip untuk minggu ini. Klik <b>Generate Slip Minggu Ini</b> setelah menandai borongan tukang di event.
                    </div>
                ) : (
                    slips.map((s) => (
                        <div key={s.id} className="border rounded-lg p-3 bg-background space-y-2">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm">{s.worker.name}</span>
                                        <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${s.status === "PAID" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                                            {s.status === "PAID" ? "Dibayar" : "Draft"}
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        {s.entries.length} event · total <b className="text-foreground">{rupiah(s.totalAmount)}</b>
                                        {s.paidAt && <> · dibayar {fmtDate(s.paidAt)}{s.paidBy ? ` oleh ${s.paidBy.name}` : ""}</>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {s.status === "DRAFT" ? (
                                        <button
                                            onClick={() => { if (confirm(`Bayar slip ${s.worker.name} sebesar ${rupiah(s.totalAmount)}? Akan tercatat di Cashflow.`)) payMut.mutate(s.id); }}
                                            disabled={payMut.isPending}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-success text-white hover:bg-success/90 disabled:opacity-50 transition-colors cursor-pointer"
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5" /> Bayar
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => { if (confirm(`Batalkan pembayaran slip ${s.worker.name}? Entri Cashflow terkait akan dihapus.`)) unpayMut.mutate(s.id); }}
                                            disabled={unpayMut.isPending}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted disabled:opacity-50 transition-colors cursor-pointer"
                                        >
                                            <Undo2 className="h-3.5 w-3.5" /> Batalkan
                                        </button>
                                    )}
                                </div>
                            </div>
                            {/* Rincian entri */}
                            <div className="border-t pt-2 space-y-1">
                                {s.entries.map((e) => (
                                    <div key={e.id} className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1.5">
                                            <Wallet className="h-3 w-3 text-muted-foreground" />
                                            {e.event.name}
                                            <span className={`px-1 py-0.5 rounded text-[9px] ${e.boronganClass === "KELAS_A" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                                                {BORONGAN_CLASS_LABEL[e.boronganClass]}
                                            </span>
                                        </span>
                                        <span className="font-mono">{rupiah(e.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
