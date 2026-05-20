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
    MapPin,
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
import { getDashboardSummary, getDistinctValues, type DashboardSummary } from "@/lib/api/crm";
import { ACTIVE_BRANDS, BRAND_META, type Brand } from "@/lib/api/brands";
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
    const [brandFilter, setBrandFilter] = useState<Brand | "">("");
    const [cityFilter, setCityFilter] = useState<string>("");
    const [venueFilter, setVenueFilter] = useState<string>("");

    const range = useMemo(() => periodRange(period, customFrom, customTo), [period, customFrom, customTo]);

    const { data: cityOptions } = useQuery({
        queryKey: ["crm-distinct", "city"],
        queryFn: () => getDistinctValues("city"),
    });
    const { data: venueOptions } = useQuery({
        queryKey: ["crm-distinct", "eventLocation"],
        queryFn: () => getDistinctValues("eventLocation"),
    });

    const { data, isLoading } = useQuery({
        queryKey: ["crm-dashboard", range, brandFilter, cityFilter, venueFilter],
        queryFn: () => getDashboardSummary({
            ...range,
            brand: brandFilter || undefined,
            city: cityFilter || undefined,
            eventLocation: venueFilter || undefined,
        }),
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

                {/* Brand filter — sub-toggle */}
                <div className="flex items-center gap-2 flex-wrap pt-2 border-t">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-600">Brand:</span>
                    <button
                        type="button"
                        onClick={() => setBrandFilter("")}
                        className={`px-3 py-1 text-xs font-semibold rounded-full border-2 transition ${brandFilter === ""
                            ? "bg-slate-700 text-white border-slate-700"
                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                            }`}
                    >
                        Semua
                    </button>
                    {ACTIVE_BRANDS.map((b) => {
                        const meta = BRAND_META[b];
                        const active = brandFilter === b;
                        return (
                            <button
                                key={b}
                                type="button"
                                onClick={() => setBrandFilter(b)}
                                className={`px-3 py-1 text-xs font-semibold rounded-full border-2 transition inline-flex items-center gap-1 ${active
                                    ? `${meta.bg} ${meta.text} ${meta.border}`
                                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                                    }`}
                            >
                                <span>{meta.emoji}</span>
                                {meta.short}
                            </button>
                        );
                    })}
                </div>

                {/* Filter lokasi & venue */}
                <div className="flex items-center gap-3 flex-wrap pt-2 border-t">
                    <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                        Lokasi:
                        <select
                            value={cityFilter}
                            onChange={(e) => setCityFilter(e.target.value)}
                            className="text-xs font-normal normal-case rounded-md border-2 border-slate-200 bg-white py-1 px-2"
                        >
                            <option value="">Semua lokasi</option>
                            {(cityOptions ?? []).map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                        Venue:
                        <select
                            value={venueFilter}
                            onChange={(e) => setVenueFilter(e.target.value)}
                            className="text-xs font-normal normal-case rounded-md border-2 border-slate-200 bg-white py-1 px-2"
                        >
                            <option value="">Semua venue</option>
                            {(venueOptions ?? []).map((v) => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>
                    </label>
                    {(cityFilter || venueFilter) && (
                        <button
                            type="button"
                            onClick={() => { setCityFilter(""); setVenueFilter(""); }}
                            className="text-xs text-red-600 hover:underline"
                        >
                            Reset lokasi/venue
                        </button>
                    )}
                </div>
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

            {/* Frekuensi Lokasi / Venue Event */}
            <div className="rounded-xl border-2 border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-5 w-5 text-rose-600" />
                    <h2 className="font-bold text-slate-900">Frekuensi Lokasi / Venue Event</h2>
                    <span className="text-xs text-muted-foreground ml-auto">
                        Seberapa sering event terjadi di tiap lokasi
                    </span>
                </div>
                {data && data.byVenue.length > 0 ? (
                    <VenueFrequency byVenue={data.byVenue} />
                ) : (
                    <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                        {isLoading ? "Memuat..." : "Belum ada lead dengan lokasi/venue event"}
                    </div>
                )}
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

/** Format tanggal event — range kalau dateEnd beda hari, single kalau sama. */
function fmtEventDate(dateStart: string | null, dateEnd: string | null): string {
    if (!dateStart) return "tanggal belum di-set";
    const s = dayjs(dateStart);
    if (dateEnd && !dayjs(dateEnd).isSame(s, "day")) {
        return `${s.format("DD MMM")} – ${dayjs(dateEnd).format("DD MMM YYYY")}`;
    }
    return s.format("DD MMM YYYY");
}

type VenueTier = "high" | "mid" | "low";

/** Maksimal kartu venue yang dirender di daftar (sisanya "+N lainnya"). */
const VENUE_LIST_RENDER_CAP = 60;

function VenueFrequency({ byVenue }: { byVenue: DashboardSummary["byVenue"] }) {
    const [tier, setTier] = useState<"all" | VenueTier>("all");
    const [search, setSearch] = useState("");

    // Klasifikasi tier berdasarkan count relatif ke venue tersering.
    const { tierOf, hiThreshold, midThreshold } = useMemo(() => {
        const maxCount = byVenue.length > 0 ? byVenue[0].count : 0;
        const hi = Math.max(2, Math.ceil((maxCount * 2) / 3));
        const mid = Math.max(2, Math.ceil(maxCount / 3));
        const fn = (count: number): VenueTier => {
            if (count <= 1) return "low";        // dipakai 1× = sedikit
            if (count >= hi) return "high";
            if (count >= mid) return "mid";
            return "low";
        };
        return { tierOf: fn, hiThreshold: hi, midThreshold: mid };
    }, [byVenue]);

    const tierCounts = useMemo(() => {
        const c = { high: 0, mid: 0, low: 0 };
        for (const v of byVenue) c[tierOf(v.count)]++;
        return c;
    }, [byVenue, tierOf]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return byVenue.filter((v) => {
            if (tier !== "all" && tierOf(v.count) !== tier) return false;
            if (q && !v.venue.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [byVenue, tier, search, tierOf]);

    const shown = filtered.slice(0, VENUE_LIST_RENDER_CAP);
    const chartData = filtered.slice(0, 12).map((v) => ({ name: v.venue, count: v.count }));

    const TIERS: { key: "all" | VenueTier; label: string; cls: string }[] = [
        { key: "all", label: `Semua (${byVenue.length})`, cls: "bg-slate-700 text-white border-slate-700" },
        { key: "high", label: `🔥 Banyak (${tierCounts.high})`, cls: "bg-rose-100 text-rose-700 border-rose-300" },
        { key: "mid", label: `🔸 Medium (${tierCounts.mid})`, cls: "bg-amber-100 text-amber-700 border-amber-300" },
        { key: "low", label: `🔹 Sedikit (${tierCounts.low})`, cls: "bg-sky-100 text-sky-700 border-sky-300" },
    ];

    return (
        <div className="space-y-3">
            {/* Filter tier + search */}
            <div className="flex items-center gap-2 flex-wrap">
                {TIERS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setTier(t.key)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full border-2 transition ${
                            tier === t.key ? t.cls : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari venue..."
                    className="ml-auto text-xs rounded-md border-2 border-slate-200 bg-white py-1 px-2 w-40 focus:border-blue-500 outline-none"
                />
            </div>
            <p className="text-[10px] text-muted-foreground">
                Tier dihitung dari jumlah event: <b>Banyak</b> ≥ {hiThreshold}×, <b>Medium</b> ≥ {midThreshold}×, <b>Sedikit</b> sisanya.
            </p>

            {filtered.length === 0 ? (
                <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
                    Tidak ada venue pada filter ini.
                </div>
            ) : (
                <div className="grid lg:grid-cols-2 gap-4">
                    {/* Bar chart — top 12 dari hasil filter */}
                    <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 34)}>
                        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={130} />
                            <Tooltip
                                formatter={(value: any) => [`${value} event`, "Jumlah"]}
                                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                            />
                            <Bar dataKey="count" name="Jumlah event" fill="#e11d48" radius={[0, 6, 6, 0]} />
                        </BarChart>
                    </ResponsiveContainer>

                    {/* Daftar venue + tanggal event */}
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                        {shown.map((v) => {
                            const hiddenEvents = v.count - v.events.length;
                            return (
                                <div key={v.venue} className="rounded-lg border border-slate-200 p-2.5">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                                        <span className="font-semibold text-sm text-slate-900 flex-1 truncate">
                                            {v.venue}
                                        </span>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold whitespace-nowrap">
                                            {v.count}× event
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {v.events.map((e, i) => (
                                            <span
                                                key={i}
                                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
                                                title={e.name ?? undefined}
                                            >
                                                <Calendar className="h-2.5 w-2.5" />
                                                {fmtEventDate(e.dateStart, e.dateEnd)}
                                            </span>
                                        ))}
                                        {hiddenEvents > 0 && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">
                                                +{hiddenEvents} tanggal lagi
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {filtered.length > VENUE_LIST_RENDER_CAP && (
                            <div className="text-center text-[11px] text-muted-foreground py-1.5">
                                +{filtered.length - VENUE_LIST_RENDER_CAP} venue lainnya — pakai kotak cari atau filter tier untuk mempersempit.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
