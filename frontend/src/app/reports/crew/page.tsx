"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Trophy, Clock, Loader2, Users, Calendar, Download, Camera } from "lucide-react";
import { getCrewReport } from "@/lib/api/event-crew";

function fmtDateTime(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

function fmtDuration(min: number) {
    if (min < 60) return `${min} mnt`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}j ${m}m`;
}

function medal(idx: number) {
    if (idx === 0) return "🥇";
    if (idx === 1) return "🥈";
    if (idx === 2) return "🥉";
    return `#${idx + 1}`;
}

export default function CrewReportPage() {
    const [eventFilter, setEventFilter] = useState<string>("");
    const [teamFilter, setTeamFilter] = useState<string>("");
    const { data: rawData, isLoading } = useQuery({
        queryKey: ["crew-report", eventFilter],
        queryFn: () => getCrewReport(eventFilter ? Number(eventFilter) : undefined),
    });

    // Apply team filter client-side (so we don't lose byTeam aggregate)
    const data = useMemo(() => {
        if (!rawData) return rawData;
        if (!teamFilter) return rawData;
        const teamId = Number(teamFilter);
        const filteredRows = rawData.rows.filter((r) => r.teamId === teamId);
        const byWorkerMap = new Map<number, { workerId: number; workerName: string; totalMinutes: number; jobs: number }>();
        filteredRows.forEach((r) => {
            const cur = byWorkerMap.get(r.workerId) ?? { workerId: r.workerId, workerName: r.workerName, totalMinutes: 0, jobs: 0 };
            cur.totalMinutes += r.durationMinutes;
            cur.jobs += 1;
            byWorkerMap.set(r.workerId, cur);
        });
        return {
            rows: filteredRows,
            byWorker: Array.from(byWorkerMap.values()).sort((a, b) => b.totalMinutes - a.totalMinutes),
            byTeam: rawData.byTeam.filter((t) => t.teamId === teamId),
        };
    }, [rawData, teamFilter]);

    const stats = useMemo(() => {
        if (!data) return { totalJobs: 0, totalMinutes: 0, uniqueCrew: 0, avgMinutes: 0 };
        const totalJobs = data.rows.length;
        const totalMinutes = data.rows.reduce((s, r) => s + r.durationMinutes, 0);
        const uniqueCrew = new Set(data.rows.map((r) => r.workerId)).size;
        return {
            totalJobs,
            totalMinutes,
            uniqueCrew,
            avgMinutes: totalJobs ? Math.round(totalMinutes / totalJobs) : 0,
        };
    }, [data]);

    const eventOptions = useMemo(() => {
        if (!rawData) return [] as Array<{ id: number; label: string }>;
        const seen = new Map<number, string>();
        rawData.rows.forEach((r) => seen.set(r.eventId, `${r.eventCode} — ${r.eventName}`));
        return Array.from(seen, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
    }, [rawData]);

    const teamOptionsList = useMemo(() => {
        if (!rawData) return [] as Array<{ id: number; name: string; color: string | null }>;
        const seen = new Map<number, { id: number; name: string; color: string | null }>();
        rawData.rows.forEach((r) => {
            if (r.teamId && r.teamName) seen.set(r.teamId, { id: r.teamId, name: r.teamName, color: r.teamColor });
        });
        return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [rawData]);

    function exportCsv() {
        if (!data) return;
        const lines = [
            "Event Code,Event Name,Team,Worker,Role,Started At,Finished At,Duration (min)",
            ...data.rows.map((r) =>
                [r.eventCode, r.eventName, r.teamName ?? "", r.workerName, r.role ?? "", r.startedAt, r.finishedAt, r.durationMinutes]
                    .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                    .join(","),
            ),
        ];
        const blob = new Blob([lines.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `crew-report-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-2xl font-bold">Laporan Crew Lapangan</h1>
                    <p className="text-sm text-muted-foreground">Rekap durasi setup & ranking performa per crew</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={eventFilter}
                        onChange={(e) => setEventFilter(e.target.value)}
                        className="text-sm rounded-md border border-border bg-background py-1.5 px-2"
                    >
                        <option value="">Semua Event</option>
                        {eventOptions.map((o) => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                    </select>
                    <select
                        value={teamFilter}
                        onChange={(e) => setTeamFilter(e.target.value)}
                        className="text-sm rounded-md border border-border bg-background py-1.5 px-2"
                    >
                        <option value="">Semua Team</option>
                        {teamOptionsList.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={exportCsv}
                        disabled={!data || data.rows.length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-sm hover:bg-muted disabled:opacity-50"
                    >
                        <Download className="h-3.5 w-3.5" /> Export CSV
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total Tugas Selesai" value={String(stats.totalJobs)} icon={<Calendar className="h-4 w-4" />} />
                <StatCard label="Total Jam Crew" value={fmtDuration(stats.totalMinutes)} icon={<Clock className="h-4 w-4" />} valueClass="text-primary" />
                <StatCard label="Crew Aktif" value={String(stats.uniqueCrew)} icon={<Users className="h-4 w-4" />} />
                <StatCard label="Rata-rata Durasi" value={fmtDuration(stats.avgMinutes)} icon={<Trophy className="h-4 w-4" />} valueClass="text-amber-600" />
            </div>

            {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Memuat...
                </div>
            ) : !data || data.rows.length === 0 ? (
                <div className="p-12 text-center border rounded-lg text-sm text-muted-foreground">
                    Belum ada crew yang menyelesaikan tugas. Assign crew di event detail.
                </div>
            ) : (
                <>
                {/* Team leaderboard (if any) */}
                {data.byTeam.length > 0 && (
                    <div className="border rounded-lg overflow-hidden bg-background">
                        <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <h2 className="font-semibold">Leaderboard Team</h2>
                        </div>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x">
                            {data.byTeam.map((t, i) => {
                                const max = data.byTeam[0]?.totalMinutes || 1;
                                const pct = (t.totalMinutes / max) * 100;
                                return (
                                    <div key={t.teamId} className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold">{medal(i)}</span>
                                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.teamColor ?? "#6366f1" }} />
                                            <span className="font-semibold flex-1">{t.teamName}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                                            <div>
                                                <div className="text-lg font-bold text-primary">{fmtDuration(t.totalMinutes)}</div>
                                                <div className="text-[10px] text-muted-foreground">Total Jam</div>
                                            </div>
                                            <div>
                                                <div className="text-lg font-bold">{t.jobs}</div>
                                                <div className="text-[10px] text-muted-foreground">Tugas</div>
                                            </div>
                                            <div>
                                                <div className="text-lg font-bold">{t.uniqueWorkers}</div>
                                                <div className="text-[10px] text-muted-foreground">Crew</div>
                                            </div>
                                        </div>
                                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full" style={{ width: `${pct}%`, backgroundColor: t.teamColor ?? "#6366f1" }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="grid lg:grid-cols-5 gap-4">
                    {/* Leaderboard */}
                    <div className="lg:col-span-2 border rounded-lg overflow-hidden bg-background">
                        <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-amber-500" />
                            <h2 className="font-semibold">Leaderboard Crew Individual</h2>
                        </div>
                        <div className="divide-y">
                            {data.byWorker.map((w, i) => {
                                const maxMin = data.byWorker[0]?.totalMinutes || 1;
                                const pct = (w.totalMinutes / maxMin) * 100;
                                return (
                                    <div key={w.workerId} className="px-4 py-3 hover:bg-muted/30">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold w-8">{medal(i)}</span>
                                                <span className="font-semibold text-sm">{w.workerName}</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-sm">{fmtDuration(w.totalMinutes)}</div>
                                                <div className="text-[10px] text-muted-foreground">{w.jobs} tugas</div>
                                            </div>
                                        </div>
                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${i === 0 ? "bg-amber-500" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-orange-400" : "bg-primary/60"}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Detail per assignment */}
                    <div className="lg:col-span-3 border rounded-lg overflow-hidden bg-background">
                        <div className="px-4 py-3 border-b bg-muted/30">
                            <h2 className="font-semibold">Detail Tugas Selesai</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Total {data.rows.length} entri, urutan: terbaru di atas</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/20 text-xs">
                                    <tr>
                                        <th className="text-left px-3 py-2">Event</th>
                                        <th className="text-left px-3 py-2">Team</th>
                                        <th className="text-left px-3 py-2">Crew</th>
                                        <th className="text-left px-3 py-2">Role</th>
                                        <th className="text-left px-3 py-2">Mulai</th>
                                        <th className="text-left px-3 py-2">Selesai</th>
                                        <th className="text-right px-3 py-2">Durasi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {data.rows.map((r) => (
                                        <tr key={r.id} className="hover:bg-muted/20">
                                            <td className="px-3 py-2">
                                                <Link href={`/events/${r.eventId}`} className="hover:text-primary">
                                                    <div className="font-medium">{r.eventName}</div>
                                                    <div className="text-[10px] text-muted-foreground">{r.eventCode}</div>
                                                </Link>
                                            </td>
                                            <td className="px-3 py-2">
                                                {r.teamName ? (
                                                    <span className="inline-flex items-center gap-1 text-xs">
                                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.teamColor ?? "#6366f1" }} />
                                                        {r.teamName}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground italic">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">{r.workerName}</td>
                                            <td className="px-3 py-2 text-muted-foreground">{r.role ?? "—"}</td>
                                            <td className="px-3 py-2 text-xs">{fmtDateTime(r.startedAt)}</td>
                                            <td className="px-3 py-2 text-xs">{fmtDateTime(r.finishedAt)}</td>
                                            <td className="px-3 py-2 text-right font-semibold">{fmtDuration(r.durationMinutes)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                </>
            )}

            <div className="text-xs text-muted-foreground italic flex items-center gap-1.5 pt-2">
                <Camera className="h-3 w-3" />
                Foto check-in/out tersimpan di detail event masing-masing — buka tab Crew untuk lihat.
            </div>
        </div>
    );
}

function StatCard({ label, value, icon, valueClass }: { label: string; value: string; icon?: React.ReactNode; valueClass?: string }) {
    return (
        <div className="border rounded-lg bg-background p-3">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                <span>{label}</span>
                {icon}
            </div>
            <div className={`text-2xl font-bold ${valueClass ?? ""}`}>{value}</div>
        </div>
    );
}
