"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
    KanbanSquare,
    Upload,
    ListChecks,
    TrendingUp,
    TrendingDown,
    Users,
    Plus,
    BarChart3,
    Trophy,
    Flame,
    Snowflake,
    Target,
    Wallet,
    Activity,
    Calendar,
} from "lucide-react";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { getDashboardSummary, type DashboardSummary } from "@/lib/api/crm";
import dayjs from "dayjs";

const SOURCE_LABEL: Record<string, string> = {
    META_ADS: "META Ads",
    WHATSAPP: "WhatsApp",
    WEBSITE: "Website",
    REFERRAL: "Referral",
    WALK_IN: "Walk-in",
    OTHER: "Lainnya",
};

const LEVEL_META: Record<string, { label: string; emoji: string; color: string }> = {
    HOT: { label: "Hot", emoji: "🔥", color: "#ef4444" },
    WARM: { label: "Warm", emoji: "🟡", color: "#f59e0b" },
    COLD: { label: "Cold", emoji: "🔵", color: "#3b82f6" },
    UNQUALIFIED: { label: "Unqualified", emoji: "⚫", color: "#64748b" },
    UNSET: { label: "Belum di-set", emoji: "❓", color: "#cbd5e1" },
};

type PeriodKey = "today" | "week" | "month" | "quarter" | "year" | "all" | "custom";

function periodRange(key: PeriodKey, customFrom?: string, customTo?: string): { from?: string; to?: string } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fmt = (d: Date) => d.toISOString();
    if (key === "all") return {};
    if (key === "today") return { from: fmt(today) };
    if (key === "week") {
        const dow = (now.getDay() + 6) % 7;
        const start = new Date(today);
        start.setDate(today.getDate() - dow);
        return { from: fmt(start) };
    }
    if (key === "month") {
        return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)) };
    }
    if (key === "quarter") {
        const q = Math.floor(now.getMonth() / 3);
        return { from: fmt(new Date(now.getFullYear(), q * 3, 1)) };
    }
    if (key === "year") {
        return { from: fmt(new Date(now.getFullYear(), 0, 1)) };
    }
    if (key === "custom") {
        return {
            from: customFrom ? fmt(new Date(customFrom)) : undefined,
            to: customTo ? fmt(new Date(customTo + "T23:59:59")) : undefined,
        };
    }
    return {};
}

function fmtRp(v: number) {
    if (!isFinite(v) || v === 0) return "Rp 0";
    if (Math.abs(v) >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(1)}jt`;
    if (Math.abs(v) >= 1_000) return `Rp ${(v / 1_000).toFixed(0)}rb`;
    return `Rp ${Math.round(v).toLocaleString("id-ID")}`;
}

function fmtRpFull(v: number) {
    if (!isFinite(v)) return "Rp 0";
    return `Rp ${Math.round(v).toLocaleString("id-ID")}`;
}

export default function CrmDashboardPage() {
    const [period, setPeriod] = useState<PeriodKey>("month");
    const [customFrom, setCustomFrom] = useState<string>(dayjs().subtract(30, "day").format("YYYY-MM-DD"));
    const [customTo, setCustomTo] = useState<string>(dayjs().format("YYYY-MM-DD"));

    const range = useMemo(() => periodRange(period, customFrom, customTo), [period, customFrom, customTo]);

    const { data, isLoading } = useQuery({
        queryKey: ["crm-dashboard", range],
        queryFn: () => getDashboardSummary(range),
    });

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <BarChart3 className="h-6 w-6 text-blue-600" />
                        CRM Dashboard
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Ringkasan pipeline lead — kualitas, nilai, dan trend.
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Link
                        href="/crm/performance"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border-2 border-violet-300 bg-violet-50 text-violet-700 text-sm font-semibold hover:bg-violet-100"
                    >
                        <Trophy className="h-4 w-4" />
                        Performa Marketing
                    </Link>
                    <Link
                        href="/crm/board"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border-2 border-slate-200 bg-white text-sm font-semibold hover:bg-slate-50"
                    >
                        <KanbanSquare className="h-4 w-4" />
                        Pipeline
                    </Link>
                    <Link
                        href="/crm/leads/new"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-bold hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4" />
                        Tambah Lead
                    </Link>
                </div>
            </div>

            {/* Period filter */}
            <div className="rounded-xl border-2 border-slate-200 bg-white p-3 space-y-2">
                <div className="flex flex-wrap gap-1">
                    {([
                        { k: "today", label: "Hari ini" },
                        { k: "week", label: "Minggu ini" },
                        { k: "month", label: "Bulan ini" },
                        { k: "quarter", label: "Kuartal ini" },
                        { k: "year", label: "Tahun ini" },
                        { k: "all", label: "Semua" },
                        { k: "custom", label: "Custom" },
                    ] as const).map((p) => (
                        <button
                            key={p.k}
                            onClick={() => setPeriod(p.k)}
                            className={`px-3 py-2 rounded-md text-sm font-semibold transition border-2 ${
                                period === p.k
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-slate-700 border-slate-200 hover:border-blue-300"
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                {period === "custom" && (
                    <div className="flex gap-2 items-center pt-2 border-t flex-wrap">
                        <Calendar className="h-4 w-4 text-slate-500" />
                        <label className="text-xs font-semibold text-slate-600">
                            Dari
                            <input
                                type="date"
                                value={customFrom}
                                onChange={(e) => setCustomFrom(e.target.value)}
                                className="ml-1 border rounded px-2 py-1 text-sm"
                            />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                            Sampai
                            <input
                                type="date"
                                value={customTo}
                                onChange={(e) => setCustomTo(e.target.value)}
                                className="ml-1 border rounded px-2 py-1 text-sm"
                            />
                        </label>
                    </div>
                )}
                {data && (
                    <div className="text-xs text-muted-foreground pt-1">
                        Periode: <b>{data.period.days}</b> hari
                        {data.period.from && <> · sejak {dayjs(data.period.from).format("DD MMM YYYY")}</>}
                        {data.period.to && <> sampai {dayjs(data.period.to).format("DD MMM YYYY")}</>}
                    </div>
                )}
            </div>

            {/* Top stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <BigStat
                    icon={<Users className="h-5 w-5" />}
                    color="blue"
                    label="Total Lead Masuk"
                    value={isLoading ? "…" : String(data?.total ?? 0)}
                    sub={data ? `Rata-rata ${data.avgPerDay} lead/hari` : ""}
                />
                <BigStat
                    icon={<Target className="h-5 w-5" />}
                    color="emerald"
                    label="Win Rate"
                    value={data ? `${data.projectValue.winRate}%` : "—"}
                    sub={data ? `${data.projectValue.wonCount} win / ${data.projectValue.lostCount} lost` : ""}
                />
                <BigStat
                    icon={<TrendingUp className="h-5 w-5" />}
                    color="violet"
                    label="Nilai Win (Closing)"
                    value={data ? fmtRp(data.projectValue.won) : "—"}
                    sub={data ? `${data.projectValue.wonCount} project closed-deal` : ""}
                />
                <BigStat
                    icon={<TrendingDown className="h-5 w-5" />}
                    color="red"
                    label="Nilai Lost"
                    value={data ? fmtRp(data.projectValue.lost) : "—"}
                    sub={data ? `${data.projectValue.lostCount} project closed-lost` : ""}
                />
            </div>

            {/* Pipeline value bar */}
            {data && (
                <div className="rounded-xl border-2 border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Wallet className="h-5 w-5 text-slate-700" />
                        <h2 className="font-bold text-slate-900">Potensi Project Value</h2>
                        <span className="text-xs text-muted-foreground ml-auto">
                            Total: {fmtRpFull(data.projectValue.won + data.projectValue.lost + data.projectValue.pipeline)}
                        </span>
                    </div>
                    <PipelineValueBar pv={data.projectValue} />
                    <div className="grid grid-cols-3 gap-2 mt-3">
                        <ValueLegend color="emerald" label={`Win — ${data.projectValue.wonCount} project`} value={data.projectValue.won} />
                        <ValueLegend color="amber" label={`Pipeline — ${data.projectValue.pipelineCount} open`} value={data.projectValue.pipeline} />
                        <ValueLegend color="red" label={`Lost — ${data.projectValue.lostCount} project`} value={data.projectValue.lost} />
                    </div>
                </div>
            )}

            {/* Charts row 1: trend + level */}
            <div className="grid lg:grid-cols-3 gap-4">
                {/* Daily trend */}
                <div className="lg:col-span-2 rounded-xl border-2 border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-5 w-5 text-blue-600" />
                        <h2 className="font-bold text-slate-900">Tren Harian Lead Masuk</h2>
                    </div>
                    {data && data.dailySeries.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={data.dailySeries}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(d) => dayjs(d).format("DD/MM")}
                                    tick={{ fontSize: 11 }}
                                    stroke="#94a3b8"
                                />
                                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                                <Tooltip
                                    labelFormatter={(d) => dayjs(d as string).format("DD MMM YYYY")}
                                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                                />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    name="Lead masuk"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    fill="url(#colorCount)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="won"
                                    name="Win"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    fillOpacity={0}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="lost"
                                    name="Lost"
                                    stroke="#ef4444"
                                    strokeWidth={2}
                                    fillOpacity={0}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                            {isLoading ? "Memuat..." : "Tidak ada data pada periode ini"}
                        </div>
                    )}
                </div>

                {/* Lead Quality donut */}
                <div className="rounded-xl border-2 border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Flame className="h-5 w-5 text-red-500" />
                        <h2 className="font-bold text-slate-900">Kualitas Lead</h2>
                    </div>
                    {data && data.byLevel.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                    <Pie
                                        data={data.byLevel}
                                        dataKey="count"
                                        nameKey="level"
                                        innerRadius={45}
                                        outerRadius={70}
                                        paddingAngle={2}
                                    >
                                        {data.byLevel.map((b) => (
                                            <Cell key={b.level} fill={LEVEL_META[b.level]?.color ?? "#cbd5e1"} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: any, name: any) => [
                                            value,
                                            LEVEL_META[name as string]?.label ?? name,
                                        ]}
                                        contentStyle={{ borderRadius: 8, fontSize: 12 }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-1.5 mt-2">
                                {data.byLevel.map((b) => {
                                    const meta = LEVEL_META[b.level] ?? LEVEL_META.UNSET;
                                    const pct = data.total > 0 ? Math.round((b.count / data.total) * 100) : 0;
                                    return (
                                        <div key={b.level} className="flex items-center gap-2 text-xs">
                                            <span
                                                className="w-3 h-3 rounded"
                                                style={{ backgroundColor: meta.color }}
                                            />
                                            <span className="flex-1">
                                                {meta.emoji} {meta.label}
                                            </span>
                                            <span className="font-mono font-semibold">
                                                {b.count}{" "}
                                                <span className="text-muted-foreground">({pct}%)</span>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                            <Snowflake className="h-4 w-4 mr-1" />
                            {isLoading ? "Memuat..." : "Belum ada data level"}
                        </div>
                    )}
                </div>
            </div>

            {/* Charts row 2: source + stage */}
            <div className="grid lg:grid-cols-2 gap-4">
                <div className="rounded-xl border-2 border-slate-200 bg-white p-4">
                    <h2 className="font-bold text-slate-900 mb-2">Sumber Lead</h2>
                    {data && data.bySource.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart
                                data={data.bySource.map((s) => ({
                                    name: SOURCE_LABEL[s.source] ?? s.source,
                                    count: s.count,
                                }))}
                                layout="vertical"
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                                <Bar dataKey="count" fill="#6366f1" radius={[0, 6, 6, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                            Tidak ada data
                        </div>
                    )}
                </div>

                <div className="rounded-xl border-2 border-slate-200 bg-white p-4">
                    <h2 className="font-bold text-slate-900 mb-2">Distribusi Pipeline (Stage)</h2>
                    {data && data.byStage.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={data.byStage}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                    {data.byStage.map((s) => (
                                        <Cell key={s.stageId} fill={s.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                            Tidak ada data
                        </div>
                    )}
                </div>
            </div>

            {/* Quick links */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <QuickLink href="/crm/board" icon={<KanbanSquare className="h-4 w-4" />} label="Pipeline Kanban" />
                <QuickLink href="/crm/leads" icon={<ListChecks className="h-4 w-4" />} label="Daftar Lead" />
                <QuickLink href="/crm/performance" icon={<Trophy className="h-4 w-4" />} label="Performa Marketing" />
                <QuickLink href="/crm/import" icon={<Upload className="h-4 w-4" />} label="Import XLSX" />
            </div>
        </div>
    );
}

const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
    blue: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", iconBg: "bg-blue-100 text-blue-700" },
    emerald: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", iconBg: "bg-emerald-100 text-emerald-700" },
    violet: { bg: "bg-violet-50 border-violet-200", text: "text-violet-700", iconBg: "bg-violet-100 text-violet-700" },
    red: { bg: "bg-red-50 border-red-200", text: "text-red-700", iconBg: "bg-red-100 text-red-700" },
    amber: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", iconBg: "bg-amber-100 text-amber-700" },
};

function BigStat({
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
            <div className={`text-2xl font-bold ${c.text} truncate`}>{value}</div>
            {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
        </div>
    );
}

function PipelineValueBar({
    pv,
}: {
    pv: DashboardSummary["projectValue"];
}) {
    const total = pv.won + pv.lost + pv.pipeline;
    if (total === 0) {
        return (
            <div className="h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                Belum ada nilai project
            </div>
        );
    }
    const wonPct = (pv.won / total) * 100;
    const pipePct = (pv.pipeline / total) * 100;
    const lostPct = (pv.lost / total) * 100;
    return (
        <div className="h-6 rounded-full overflow-hidden flex bg-slate-100">
            {wonPct > 0 && (
                <div
                    className="bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ width: `${wonPct}%` }}
                    title={`Win: ${fmtRpFull(pv.won)}`}
                >
                    {wonPct >= 8 && `${wonPct.toFixed(0)}%`}
                </div>
            )}
            {pipePct > 0 && (
                <div
                    className="bg-amber-400 flex items-center justify-center text-amber-900 text-[10px] font-bold"
                    style={{ width: `${pipePct}%` }}
                    title={`Pipeline: ${fmtRpFull(pv.pipeline)}`}
                >
                    {pipePct >= 8 && `${pipePct.toFixed(0)}%`}
                </div>
            )}
            {lostPct > 0 && (
                <div
                    className="bg-red-500 flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ width: `${lostPct}%` }}
                    title={`Lost: ${fmtRpFull(pv.lost)}`}
                >
                    {lostPct >= 8 && `${lostPct.toFixed(0)}%`}
                </div>
            )}
        </div>
    );
}

function ValueLegend({
    color,
    label,
    value,
}: {
    color: "emerald" | "amber" | "red";
    label: string;
    value: number;
}) {
    const dotMap = { emerald: "bg-emerald-500", amber: "bg-amber-400", red: "bg-red-500" };
    return (
        <div className="rounded-lg border bg-slate-50 p-2">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <span className={`w-2.5 h-2.5 rounded-full ${dotMap[color]}`} />
                <span className="truncate">{label}</span>
            </div>
            <div className="font-mono font-bold text-sm text-slate-900 mt-0.5">{fmtRpFull(value)}</div>
        </div>
    );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
    return (
        <Link
            href={href}
            className="flex items-center gap-2 px-3 py-2.5 rounded-md border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-300 text-sm font-medium transition"
        >
            {icon}
            {label}
        </Link>
    );
}
