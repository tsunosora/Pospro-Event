"use client";

import { useState } from "react";
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

    const { data, isLoading } = useQuery({
        queryKey: ["crm-performance", period],
        queryFn: () => getMarketerPerformance(periodPreset(period)),
    });

    const rows = data ?? [];
    const totalLeads = rows.reduce((a, r) => a + r.totalLeads, 0);
    const totalConverted = rows.reduce((a, r) => a + r.convertedLeads, 0);
    const totalValue = rows.reduce((a, r) => a + r.totalValueClosed, 0);
    const avgConvRate = totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 1000) / 10 : 0;

    const top = rows.length > 0 ? rows[0] : null;

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
                            <Trophy className="h-6 w-6 text-amber-500" />
                            Performa Marketing
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Leaderboard tim — diurutkan berdasarkan total nilai closing.
                        </p>
                    </div>
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                        {([
                            { k: "today", label: "Hari ini" },
                            { k: "week", label: "Minggu ini" },
                            { k: "month", label: "Bulan ini" },
                            { k: "all", label: "Semua" },
                        ] as const).map((p) => (
                            <button
                                key={p.k}
                                onClick={() => setPeriod(p.k)}
                                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition ${
                                    period === p.k
                                        ? "bg-white text-blue-700 shadow"
                                        : "text-slate-600 hover:text-slate-900"
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
            <div className="rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                            <tr>
                                <th className="px-3 py-3 text-left">Rank</th>
                                <th className="px-3 py-3 text-left">Marketing</th>
                                <th className="px-3 py-3 text-right">Lead Masuk</th>
                                <th className="px-3 py-3 text-right">Closing</th>
                                <th className="px-3 py-3 text-right">Conv. Rate</th>
                                <th className="px-3 py-3 text-right">Total Closing (Rp)</th>
                                <th className="px-3 py-3 text-right">⏱ Avg Respon</th>
                                <th className="px-3 py-3 text-right">⚠ Stuck &gt; 7 hari</th>
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
                                <PerformanceRow key={r.workerId} rank={i + 1} row={r} />
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
        </div>
    );
}

function PerformanceRow({ rank, row }: { rank: number; row: MarketerPerformance }) {
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
    const convCls =
        row.conversionRate >= 30
            ? "text-emerald-700 bg-emerald-100"
            : row.conversionRate >= 15
                ? "text-blue-700 bg-blue-100"
                : row.conversionRate > 0
                    ? "text-amber-700 bg-amber-100"
                    : "text-slate-500 bg-slate-100";

    return (
        <tr className="border-t border-slate-100 hover:bg-slate-50">
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
                        <div className="h-9 w-9 rounded-full bg-slate-200 text-slate-600 font-bold flex items-center justify-center">
                            {row.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <div className="font-semibold text-slate-900">{row.name}</div>
                        {row.position && (
                            <div className="text-[11px] text-muted-foreground">{row.position}</div>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-3 py-3 text-right font-mono">{row.totalLeads}</td>
            <td className="px-3 py-3 text-right font-mono font-semibold text-emerald-700">
                {row.convertedLeads}
            </td>
            <td className="px-3 py-3 text-right">
                <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold font-mono ${convCls}`}
                >
                    {row.conversionRate}%
                </span>
            </td>
            <td className="px-3 py-3 text-right font-mono font-bold text-violet-700">
                {fmtRp(row.totalValueClosed)}
            </td>
            <td className="px-3 py-3 text-right font-mono text-slate-700">
                {fmtHours(row.avgResponseHours)}
            </td>
            <td className="px-3 py-3 text-right">
                {row.stuckLeads > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-mono text-xs font-bold">
                        <AlertTriangle className="h-3 w-3" />
                        {row.stuckLeads}
                    </span>
                ) : (
                    <span className="text-slate-400 font-mono">0</span>
                )}
            </td>
        </tr>
    );
}

const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
    blue: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", iconBg: "bg-blue-100 text-blue-700" },
    emerald: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", iconBg: "bg-emerald-100 text-emerald-700" },
    violet: { bg: "bg-violet-50 border-violet-200", text: "text-violet-700", iconBg: "bg-violet-100 text-violet-700" },
    amber: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", iconBg: "bg-amber-100 text-amber-700" },
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
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {label}
                </span>
            </div>
            <div className={`text-xl font-bold ${c.text} truncate`}>{value}</div>
            {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
        </div>
    );
}
