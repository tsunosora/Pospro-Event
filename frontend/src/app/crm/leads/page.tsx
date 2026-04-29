"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
    Plus,
    Upload,
    Search,
    MessageCircle,
    BarChart3,
    Repeat,
    MapPin,
    Tag,
    Users as UsersIcon,
    X,
} from "lucide-react";
import {
    listLeads,
    listStages,
    waLink,
    getDistinctValues,
    type LeadLevel,
} from "@/lib/api/crm";
import { ACTIVE_BRANDS, BRAND_META, type Brand } from "@/lib/api/brands";
import { BrandBadge } from "@/components/BrandBadge";
import { getWorkers, MARKETER_POSITIONS } from "@/lib/api/workers";
import { LevelBadge } from "@/components/crm/LevelBadge";
import { LeadDrawer } from "@/components/crm/LeadDrawer";

const LEVELS: LeadLevel[] = ["HOT", "WARM", "COLD", "UNQUALIFIED"];

export default function CrmLeadsListPage() {
    const [search, setSearch] = useState("");
    const [stageId, setStageId] = useState<number | "">("");
    const [level, setLevel] = useState<LeadLevel | "">("");
    const [city, setCity] = useState<string>("");
    const [productCategory, setProductCategory] = useState<string>("");
    const [assignedWorkerId, setAssignedWorkerId] = useState<number | "">("");
    const [brandFilter, setBrandFilter] = useState<Brand | "">("");
    const [drawerId, setDrawerId] = useState<number | null>(null);

    const { data: stages } = useQuery({ queryKey: ["crm-stages"], queryFn: listStages });
    const { data: workers } = useQuery({
        queryKey: ["workers", "marketers"],
        queryFn: () => getWorkers(false, { positions: [...MARKETER_POSITIONS] }),
    });
    const { data: cityOptions } = useQuery({
        queryKey: ["crm-distinct", "city"],
        queryFn: () => getDistinctValues("city"),
    });
    const { data: productOptions } = useQuery({
        queryKey: ["crm-distinct", "productCategory"],
        queryFn: () => getDistinctValues("productCategory"),
    });
    const { data, isLoading } = useQuery({
        queryKey: ["crm-leads", { search, stageId, level, city, productCategory, assignedWorkerId, brandFilter }],
        queryFn: () =>
            listLeads({
                search: search || undefined,
                stageId: typeof stageId === "number" ? stageId : undefined,
                level: level || undefined,
                city: city || undefined,
                productCategory: productCategory || undefined,
                assignedWorkerId: typeof assignedWorkerId === "number" ? assignedWorkerId : undefined,
                brand: brandFilter || undefined,
                limit: 200,
            }),
    });

    const hasFilter = !!(search || stageId || level || city || productCategory || assignedWorkerId || brandFilter);
    const clearFilters = () => {
        setSearch("");
        setStageId("");
        setLevel("");
        setCity("");
        setProductCategory("");
        setAssignedWorkerId("");
        setBrandFilter("");
    };

    return (
        <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold">📋 Daftar Lead</h1>
                    <p className="text-sm text-muted-foreground">
                        Filter berdasarkan kota, produk, atau marketing yang handle. Klik baris untuk detail.
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Link
                        href="/crm/performance"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border-2 border-violet-300 bg-violet-50 text-violet-700 text-sm font-semibold hover:bg-violet-100"
                    >
                        <BarChart3 className="h-4 w-4" />
                        Performa Marketing
                    </Link>
                    <Link
                        href="/crm/import"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border-2 border-slate-200 bg-white text-sm font-semibold hover:bg-slate-50"
                    >
                        <Upload className="h-4 w-4" />
                        Import
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

            {/* Filter bar */}
            <div className="rounded-xl border-2 border-slate-200 bg-white p-3 space-y-2">
                <div className="flex flex-wrap gap-2 items-center">
                    <div className="relative flex-1 min-w-[220px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari nama / HP / organisasi / kota..."
                            className="w-full pl-10 pr-2 py-2 text-sm rounded-md border-2 border-slate-200 bg-white focus:border-blue-500 outline-none"
                        />
                    </div>
                    {hasFilter && (
                        <button
                            onClick={clearFilters}
                            className="inline-flex items-center gap-1 px-2.5 py-2 text-xs rounded-md bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                        >
                            <X className="h-3.5 w-3.5" />
                            Reset
                        </button>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                        {data ? `${data.items.length} dari ${data.total} lead` : ""}
                    </span>
                </div>
                {/* Brand pills */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-600 mr-1">Brand:</span>
                    <button
                        type="button"
                        onClick={() => setBrandFilter("")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-full border-2 transition ${brandFilter === ""
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
                                className={`px-3 py-1.5 text-xs font-semibold rounded-full border-2 transition inline-flex items-center gap-1 ${active
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    <FilterSelect
                        icon={<Tag className="h-3.5 w-3.5" />}
                        label="Stage"
                        value={stageId === "" ? "" : String(stageId)}
                        onChange={(v) => setStageId(v ? Number(v) : "")}
                        options={[
                            { value: "", label: "Semua stage" },
                            ...(stages?.map((s) => ({ value: String(s.id), label: s.name })) ?? []),
                        ]}
                    />
                    <FilterSelect
                        label="Level"
                        value={level}
                        onChange={(v) => setLevel((v as LeadLevel) || "")}
                        options={[
                            { value: "", label: "Semua level" },
                            ...LEVELS.map((l) => ({ value: l, label: l })),
                        ]}
                    />
                    <FilterSelect
                        icon={<MapPin className="h-3.5 w-3.5" />}
                        label="Kota"
                        value={city}
                        onChange={setCity}
                        options={[
                            { value: "", label: "Semua kota" },
                            ...((cityOptions ?? []).map((c) => ({ value: c, label: c }))),
                        ]}
                    />
                    <FilterSelect
                        icon={<Tag className="h-3.5 w-3.5" />}
                        label="Produk"
                        value={productCategory}
                        onChange={setProductCategory}
                        options={[
                            { value: "", label: "Semua produk" },
                            ...((productOptions ?? []).map((p) => ({ value: p, label: p }))),
                        ]}
                    />
                    <FilterSelect
                        icon={<UsersIcon className="h-3.5 w-3.5" />}
                        label="Marketing"
                        value={assignedWorkerId === "" ? "" : String(assignedWorkerId)}
                        onChange={(v) => setAssignedWorkerId(v ? Number(v) : "")}
                        options={[
                            { value: "", label: "Semua marketing" },
                            ...((workers ?? []).map((w) => ({ value: String(w.id), label: w.name }))),
                        ]}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                            <tr>
                                <th className="px-3 py-2.5 text-left">Brand</th>
                                <th className="px-3 py-2.5 text-left">Nama</th>
                                <th className="px-3 py-2.5 text-left">Phone</th>
                                <th className="px-3 py-2.5 text-left">Organisasi</th>
                                <th className="px-3 py-2.5 text-left">Kota</th>
                                <th className="px-3 py-2.5 text-left">Produk</th>
                                <th className="px-3 py-2.5 text-left">Stage</th>
                                <th className="px-3 py-2.5 text-left">Level</th>
                                <th className="px-3 py-2.5 text-left">Marketing</th>
                                <th className="px-3 py-2.5"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (
                                <tr>
                                    <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground text-xs">
                                        Memuat...
                                    </td>
                                </tr>
                            )}
                            {!isLoading && data?.items.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground text-sm">
                                        Tidak ada lead. <Link href="/crm/import" className="underline">Import dari XLSX</Link> atau <Link href="/crm/leads/new" className="underline">tambah manual</Link>.
                                    </td>
                                </tr>
                            )}
                            {data?.items.map((l) => (
                                <tr
                                    key={l.id}
                                    onClick={() => setDrawerId(l.id)}
                                    className="border-t border-slate-100 hover:bg-blue-50/40 cursor-pointer"
                                >
                                    <td className="px-3 py-2.5">
                                        <BrandBadge brand={l.brand} size="xs" />
                                    </td>
                                    <td className="px-3 py-2.5 font-medium">
                                        {l.name?.trim() || (
                                            <span className="text-muted-foreground italic">— anonim —</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 font-mono text-xs">{l.phone}</td>
                                    <td className="px-3 py-2.5 text-xs">{l.organization || "—"}</td>
                                    <td className="px-3 py-2.5 text-xs">
                                        {l.city ? (
                                            <span className="inline-flex items-center gap-1">
                                                <MapPin className="h-3 w-3 text-slate-400" />
                                                {l.city}
                                            </span>
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-xs">{l.productCategory || "—"}</td>
                                    <td className="px-3 py-2.5">
                                        {l.stage && (
                                            <span
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                                                style={{
                                                    backgroundColor: `${l.stage.color}20`,
                                                    color: l.stage.color,
                                                }}
                                            >
                                                {l.stage.name}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <LevelBadge level={l.level} />
                                    </td>
                                    <td className="px-3 py-2.5 text-xs">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-medium text-slate-800">
                                                {l.assignedWorker?.name || (
                                                    <span className="text-slate-400 italic">belum di-assign</span>
                                                )}
                                            </span>
                                            {l.previousAssignedWorker && (
                                                <span
                                                    className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full w-fit"
                                                    title={`Sebelumnya dipegang ${l.previousAssignedWorker.name}`}
                                                >
                                                    <Repeat className="h-2.5 w-2.5" />
                                                    dari {l.previousAssignedWorker.name}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <a
                                            href={waLink(l.phone, l.greetingTemplate || undefined)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
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

function FilterSelect({
    icon,
    label,
    value,
    onChange,
    options,
}: {
    icon?: React.ReactNode;
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1">
                {icon}
                {label}
            </span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="text-sm rounded-md border-2 border-slate-200 bg-white py-1.5 px-2 focus:border-blue-500 outline-none"
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
