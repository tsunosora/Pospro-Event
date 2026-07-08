"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
    Trophy,
    TrendingUp,
    Users,
    Clock,
    AlertTriangle,
    DollarSign,
    Target,
} from "lucide-react";
import { getMarketerPerformance, type MarketerPerformance } from "@/lib/api/crm";
import { StuckLeadsModal } from "@/components/crm/StuckLeadsModal";

function fmtRp(v: number) {
    if (!isFinite(v) || v === 0) return "Rp 0";
    return `Rp ${Math.round(v).toLocaleString("id-ID")}`;
}

function fmtHours(h: number | null): string {
    if (h === null) return "—";
    if (h < 1) return `${Math.round(h * 60)} mnt`;
    if (h < 24) return `${h.toFixed(1)} jam`;
    return `${Math.round(h / 24)} hari`;
}

function periodPreset(key: string): { from?: string; to?: string } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fmt = (d: Date) => d.toISOString();
    if (key === "all") return {};
    if (key === "month") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from: fmt(start) };
    }
    if (key === "week") {
        const dow = (now.getDay() + 6) % 7;
        const start = new Date(today);
        start.setDate(today.getDate() - dow);
        return { from: fmt(start) };
    }
    if (key === "today") return { from: fmt(today) };
    return {};
}

export default function CrmPerformancePage() {
    const [period, setPeriod] = useState<"today" | "week" | "month" | "all">("month");
    /** Modal stuck leads — null = tertutup. workerId null = tampilkan semua marketing. */
    const [stuckModal, setStuckModal] = useState<{ workerId: number | null; workerName: string | null } | null>(null);
    /** Auto-popup peringatan hanya muncul sekali per buka halaman. */
    const [autoShown, setAutoShown] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ["crm-performance", period],
        queryFn: () => getMarketerPerformance(periodPreset(period)),
    });

    const rows = data ?? [];
    const totalLeads = rows.reduce((a, r) => a + r.totalLeads, 0);
    const totalConverted = rows.reduce((a, r) => a + r.convertedLeads, 0);
    const totalValue = rows.reduce((a, r) => a + r.totalValueClosed, 0);
    const totalStuck = rows.reduce((a, r) => a + r.stuckLeads, 0);
    const avgConvRate = totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 1000) / 10 : 0;

    const top = rows.length > 0 ? rows[0] : null;

    // Auto-popup peringatan: kalau ada lead stuck, tampilkan modal semua marketing saat halaman dibuka.
    useEffect(() => {
        if (!isLoading && !autoShown && totalStuck > 0) {
            setStuckModal({ workerId: null, workerName: null });
            setAutoShown(true);
        }
    }, [isLoading, autoShown, totalStuck]);

    return (
        <div className="p-4 space-y-5 max-w-6xl mx-auto">
            {/* Header */}
            <div>
                <Link
                    href="/crm/leads"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Kembali ke Daftar Lead
                </Link>
                <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Trophy className="h-6 w-6 text-warning" />
                            Performa Marketing
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Leaderboard tim — diurutkan berdasarkan total nilai closing.
                        </p>
                    </div>
                    <div className="flex gap-1 bg-muted p-1 rounded-lg">
                        {([
                            { k: "today", label: "Hari ini" },
                            { k: "week", label: "Minggu ini" },
                            { k: "month", label: "Bulan ini" },
                            { k: "all", label: "Semua" },
                        ] as const).map((p) => (
                            <button
                                key={p.k}
                                onClick={() => setPeriod(p.k)}
                                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
                                    period === p.k
                                        ? "bg-card text-primary shadow"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Ringkasan */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard
                    icon={<Users className="h-5 w-5" />}
                    color="blue"
                    label="Total Lead"
                    value={String(totalLeads)}
                />
                <SummaryCard
                    icon={<Target className="h-5 w-5" />}
                    color="emerald"
                    label="Closing"
                    value={String(totalConverted)}
                    sub={`${avgConvRate}% conversion`}
                />
                <SummaryCard
                    icon={<DollarSign className="h-5 w-5" />}
                    color="violet"
                    label="Nilai Closing"
                    value={fmtRp(totalValue)}
                />
                <SummaryCard
                    icon={<Trophy className="h-5 w-5" />}
                    color="amber"
                    label="Top Marketer"
                    value={top?.name ?? "—"}
                    sub={top ? fmtRp(top.totalValueClosed) : undefined}
                />
            </div>

            {/* Tabel leaderboard */}
            <div className="glass rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                            <tr>
                                <th className="px-3 py-3 text-left">Rank</th>
                                <th className="px-3 py-3 text-left">Marketing</th>
                                <th className="px-3 py-3 text-right">Lead Masuk</th>
                                <th className="px-3 py-3 text-right">Closing</th>
                                <th className="px-3 py-3 text-right">Conv. Rate</th>
                                <th className="px-3 py-3 text-right">Total Closing (Rp)</th>
                                <th className="px-3 py-3 text-right">
                                    <span className="inline-flex items-center justify-end gap-1"><Clock className="h-3.5 w-3.5" />Avg Respon</span>
                                </th>
                                <th className="px-3 py-3 text-right">
                                    <span className="inline-flex items-center justify-end gap-1"><AlertTriangle className="h-3.5 w-3.5" />Stuck &gt; 7 hari</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (
                                <tr>
                                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                                        Memuat data...
                                    </td>
                                </tr>
                            )}
                            {!isLoading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                                        Belum ada data marketing aktif.
                                    </td>
                                </tr>
                            )}
                            {rows.map((r, i) => (
                                <PerformanceRow
                                    key={r.workerId}
                                    rank={i + 1}
                                    row={r}
                                    onStuckClick={() => setStuckModal({ workerId: r.workerId, workerName: r.name })}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Legend */}
            <div className="text-xs text-muted-foreground space-y-1">
                <p className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <b>Avg Respon</b>: rata-rata selisih waktu antara lead masuk dan kontak pertama.
                </p>
                <p className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <b>Stuck</b>: lead yang masih open & belum di-follow up dalam 7 hari terakhir.
                </p>
                <p className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Conversion rate = closing dibagi total lead masuk pada periode terpilih.
                </p>
            </div>

            <StuckLeadsModal
                open={stuckModal !== null}
                onClose={() => setStuckModal(null)}
                workerId={stuckModal?.workerId ?? null}
                workerName={stuckModal?.workerName ?? null}
                period={periodPreset(period)}
            />
        </div>
    );
}

function PerformanceRow({ rank, row, onStuckClick }: { rank: number; row: MarketerPerformance; onStuckClick: () => void }) {
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
    const convCls =
        row.conversionRate >= 30
            ? "text-success bg-success/15"
            : row.conversionRate >= 15
                ? "text-info bg-info/15"
                : row.conversionRate > 0
                    ? "text-warning bg-warning/15"
                    : "text-muted-foreground bg-muted";

    return (
        <tr className="border-t border-border hover:bg-muted/50 transition-colors">
            <td className="px-3 py-3 font-bold text-lg">{medal}</td>
            <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                    {row.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={row.photoUrl}
                            alt={row.name}
                            className="h-9 w-9 rounded-full object-cover border"
                        />
                    ) : (
                        <div className="h-9 w-9 rounded-full bg-muted text-muted-foreground font-bold flex items-center justify-center">
                            {row.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <div className="font-semibold text-foreground">{row.name}</div>
                        {row.position && (
                            <div className="text-[11px] text-muted-foreground">{row.position}</div>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-3 py-3 text-right nums">{row.totalLeads}</td>
            <td className="px-3 py-3 text-right nums font-semibold text-success">
                {row.convertedLeads}
            </td>
            <td className="px-3 py-3 text-right">
                <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold nums ${convCls}`}
                >
                    {row.conversionRate}%
                </span>
            </td>
            <td className="px-3 py-3 text-right nums font-bold text-primary">
                {fmtRp(row.totalValueClosed)}
            </td>
            <td className="px-3 py-3 text-right nums text-foreground">
                {fmtHours(row.avgResponseHours)}
            </td>
            <td className="px-3 py-3 text-right">
                {row.stuckLeads > 0 ? (
                    <button
                        onClick={onStuckClick}
                        title="Klik untuk lihat daftar lead stuck"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/12 text-destructive nums text-xs font-bold hover:bg-destructive/20 transition-colors cursor-pointer"
                    >
                        <AlertTriangle className="h-3 w-3" />
                        {row.stuckLeads}
                    </button>
                ) : (
                    <span className="text-muted-foreground nums">0</span>
                )}
            </td>
        </tr>
    );
}

const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
    blue: { bg: "bg-info/10 border-info/30", text: "text-info", iconBg: "bg-info/15 text-info" },
    emerald: { bg: "bg-success/10 border-success/30", text: "text-success", iconBg: "bg-success/15 text-success" },
    violet: { bg: "bg-primary/10 border-primary/30", text: "text-primary", iconBg: "bg-primary/15 text-primary" },
    amber: { bg: "bg-warning/10 border-warning/30", text: "text-warning", iconBg: "bg-warning/15 text-warning" },
};

function SummaryCard({
    icon,
    color,
    label,
    value,
    sub,
}: {
    icon: React.ReactNode;
    color: keyof typeof colorMap;
    label: string;
    value: string;
    sub?: string;
}) {
    const c = colorMap[color];
    return (
        <div className={`rounded-xl border-2 ${c.bg} p-4`}>
            <div className="flex items-center gap-2 mb-1">
                <span className={`p-1.5 rounded-lg ${c.iconBg}`}>{icon}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                </span>
            </div>
            <div className={`text-xl font-bold nums ${c.text} truncate`}>{value}</div>
            {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
        </div>
    );
}
