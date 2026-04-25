"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, Upload, Search, MessageCircle } from "lucide-react";
import { listLeads, listStages, waLink, type LeadLevel } from "@/lib/api/crm";
import { LevelBadge } from "@/components/crm/LevelBadge";
import { LeadDrawer } from "@/components/crm/LeadDrawer";

const LEVELS: LeadLevel[] = ["HOT", "WARM", "COLD", "UNQUALIFIED"];

export default function CrmLeadsListPage() {
    const [search, setSearch] = useState("");
    const [stageId, setStageId] = useState<number | "">("");
    const [level, setLevel] = useState<LeadLevel | "">("");
    const [drawerId, setDrawerId] = useState<number | null>(null);

    const { data: stages } = useQuery({ queryKey: ["crm-stages"], queryFn: listStages });
    const { data, isLoading } = useQuery({
        queryKey: ["crm-leads", { search, stageId, level }],
        queryFn: () =>
            listLeads({
                search: search || undefined,
                stageId: typeof stageId === "number" ? stageId : undefined,
                level: level || undefined,
                limit: 200,
            }),
    });

    return (
        <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">Daftar Lead</h1>
                    <p className="text-xs text-muted-foreground">Tampilan tabel — klik baris untuk detail.</p>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/crm/import"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-background text-sm hover:bg-muted"
                    >
                        <Upload className="h-4 w-4" />
                        Import
                    </Link>
                    <Link
                        href="/crm/leads/new"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" />
                        Add Lead
                    </Link>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari nama / HP / organisasi..."
                        className="w-full pl-7 pr-2 py-1.5 text-sm rounded-md border border-border bg-background"
                    />
                </div>
                <select
                    value={stageId}
                    onChange={(e) => setStageId(e.target.value ? Number(e.target.value) : "")}
                    className="text-sm rounded-md border border-border bg-background py-1.5 px-2"
                >
                    <option value="">Semua stage</option>
                    {stages?.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </select>
                <select
                    value={level}
                    onChange={(e) => setLevel((e.target.value as LeadLevel) || "")}
                    className="text-sm rounded-md border border-border bg-background py-1.5 px-2"
                >
                    <option value="">Semua level</option>
                    {LEVELS.map((l) => (
                        <option key={l} value={l}>
                            {l}
                        </option>
                    ))}
                </select>
                <span className="text-xs text-muted-foreground ml-auto">
                    {data ? `${data.items.length} / ${data.total}` : ""}
                </span>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-xs uppercase tracking-wide">
                            <tr>
                                <th className="px-3 py-2 text-left">Nama</th>
                                <th className="px-3 py-2 text-left">Phone</th>
                                <th className="px-3 py-2 text-left">Organisasi</th>
                                <th className="px-3 py-2 text-left">Kategori</th>
                                <th className="px-3 py-2 text-left">Stage</th>
                                <th className="px-3 py-2 text-left">Level</th>
                                <th className="px-3 py-2 text-left">PIC</th>
                                <th className="px-3 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (
                                <tr>
                                    <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground text-xs">
                                        Memuat...
                                    </td>
                                </tr>
                            )}
                            {!isLoading && data?.items.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground text-xs">
                                        Tidak ada lead. <Link href="/crm/import" className="underline">Import dari XLSX</Link> atau <Link href="/crm/leads/new" className="underline">tambah manual</Link>.
                                    </td>
                                </tr>
                            )}
                            {data?.items.map((l) => (
                                <tr
                                    key={l.id}
                                    onClick={() => setDrawerId(l.id)}
                                    className="border-t border-border hover:bg-muted/30 cursor-pointer"
                                >
                                    <td className="px-3 py-2 font-medium">
                                        {l.name?.trim() || (
                                            <span className="text-muted-foreground italic">— anonim —</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">{l.phone}</td>
                                    <td className="px-3 py-2 text-xs">{l.organization || "—"}</td>
                                    <td className="px-3 py-2 text-xs">{l.productCategory || "—"}</td>
                                    <td className="px-3 py-2">
                                        {l.stage && (
                                            <span
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium"
                                                style={{
                                                    backgroundColor: `${l.stage.color}20`,
                                                    color: l.stage.color,
                                                }}
                                            >
                                                {l.stage.name}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        <LevelBadge level={l.level} />
                                    </td>
                                    <td className="px-3 py-2 text-xs">{l.assignedWorker?.name || "—"}</td>
                                    <td className="px-3 py-2">
                                        <a
                                            href={waLink(l.phone, l.greetingTemplate || undefined)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                        >
                                            <MessageCircle className="h-3 w-3" />
                                            WA
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <LeadDrawer
                leadId={drawerId}
                open={drawerId !== null}
                onClose={() => setDrawerId(null)}
            />
        </div>
    );
}
