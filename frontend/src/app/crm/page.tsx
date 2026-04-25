"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
    KanbanSquare,
    Upload,
    ListChecks,
    TrendingUp,
    Calendar,
    CalendarDays,
    Users,
    Plus,
} from "lucide-react";
import { getStats } from "@/lib/api/crm";

const SOURCE_LABEL: Record<string, string> = {
    META_ADS: "META Ads",
    WHATSAPP: "WhatsApp",
    WEBSITE: "Website",
    REFERRAL: "Referral",
    WALK_IN: "Walk-in",
    OTHER: "Lainnya",
};

export default function CrmDashboardPage() {
    const { data, isLoading } = useQuery({ queryKey: ["crm-stats"], queryFn: getStats });

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">CRM Dashboard</h1>
                    <p className="text-sm text-muted-foreground">
                        Ringkasan pipeline lead WhatsApp & META.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/crm/import"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-sm hover:bg-muted"
                    >
                        <Upload className="h-4 w-4" />
                        Import XLSX
                    </Link>
                    <Link
                        href="/crm/leads/new"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" />
                        Add Lead
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                    icon={Calendar}
                    label="Hari Ini"
                    value={data?.today ?? 0}
                    loading={isLoading}
                />
                <StatCard
                    icon={CalendarDays}
                    label="Minggu Ini"
                    value={data?.week ?? 0}
                    loading={isLoading}
                />
                <StatCard
                    icon={Users}
                    label="Bulan Ini"
                    value={data?.month ?? 0}
                    loading={isLoading}
                />
                <StatCard
                    icon={TrendingUp}
                    label="Conversion"
                    value={data ? `${(data.conversionRate * 100).toFixed(1)}%` : "—"}
                    sub={data ? `${data.converted} / ${data.total}` : ""}
                    loading={isLoading}
                />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-card p-4">
                    <h2 className="font-semibold text-sm mb-2">Sumber Lead</h2>
                    {isLoading && (
                        <div className="text-xs text-muted-foreground">Memuat...</div>
                    )}
                    {data && data.bySource.length === 0 && (
                        <div className="text-xs text-muted-foreground">Belum ada lead.</div>
                    )}
                    {data && data.bySource.length > 0 && (
                        <ul className="space-y-1.5">
                            {data.bySource.map((s) => {
                                const total = data.total || 1;
                                const pct = (s._count._all / total) * 100;
                                return (
                                    <li key={s.source} className="text-sm">
                                        <div className="flex justify-between">
                                            <span>{SOURCE_LABEL[s.source] || s.source}</span>
                                            <span className="text-muted-foreground">
                                                {s._count._all}{" "}
                                                <span className="text-[11px]">({pct.toFixed(0)}%)</span>
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-muted rounded mt-0.5 overflow-hidden">
                                            <div
                                                className="h-full bg-primary"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                    <h2 className="font-semibold text-sm">Akses Cepat</h2>
                    <Link
                        href="/crm/board"
                        className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-muted text-sm"
                    >
                        <KanbanSquare className="h-4 w-4" />
                        Pipeline Kanban
                    </Link>
                    <Link
                        href="/crm/leads"
                        className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-muted text-sm"
                    >
                        <ListChecks className="h-4 w-4" />
                        Daftar Lead (Tabel)
                    </Link>
                    <Link
                        href="/crm/import"
                        className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-muted text-sm"
                    >
                        <Upload className="h-4 w-4" />
                        Import XLSX
                    </Link>
                </div>
            </div>
        </div>
    );
}

function StatCard({
    icon: Icon,
    label,
    value,
    sub,
    loading,
}: {
    icon: any;
    label: string;
    value: number | string;
    sub?: string;
    loading?: boolean;
}) {
    return (
        <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">{label}</span>
            </div>
            <div className="text-2xl font-bold mt-1">{loading ? "…" : value}</div>
            {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
        </div>
    );
}
