"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getRabList,
    createRab,
    deleteRab,
    duplicateRab,
    downloadRabXlsx,
    uploadRabImage,
    removeRabImage,
    type RabPlan,
} from "@/lib/api/rab";
import {
    Plus, FileSpreadsheet, Copy, Trash2, Eye, Loader2, Search, X,
    Image as ImageIcon, Pencil, ImageOff, MapPin, Calendar, User as UserIcon,
    TrendingUp, TrendingDown, Building2, Clock, CheckCircle2, PlayCircle, CalendarOff,
    LayoutGrid, List as ListIcon, Table as TableIcon,
    ClipboardList, Wallet, AlertTriangle, Info, ChevronDown, ChevronUp,
} from "lucide-react";
import { ACTIVE_BRANDS, BRAND_META, type Brand } from "@/lib/api/brands";
import { BrandBadge } from "@/components/BrandBadge";
import { CustomerPickerModal } from "@/components/CustomerPickerModal";
import { getCustomer, type Customer } from "@/lib/api/customers";
import { Users as UsersIcon, Tag as TagIcon } from "lucide-react";
import { TagChipInput } from "@/components/TagChipInput";
import { parseRabTags } from "@/lib/api/rab";
import { DateRangeFilter, presetToRange, type DateRange } from "@/components/DateRangeFilter";

type ViewMode = "card" | "list" | "details";
const VIEW_MODE_KEY = "pospro:rab-list:viewMode";

type EventStatus = "UPCOMING" | "ONGOING" | "FINISHED" | "REPORT_DONE" | "NO_DATE";

const STATUS_META: Record<EventStatus, {
    label: string;
    short: string;
    emoji: string;
    bg: string;
    text: string;
    border: string;
    bar: string;
    icon: React.ComponentType<{ className?: string }>;
}> = {
    UPCOMING: {
        label: "Akan Datang",
        short: "Akan Datang",
        emoji: "📅",
        bg: "bg-info/15",
        text: "text-info",
        border: "border-info/30",
        bar: "bg-info",
        icon: Clock,
    },
    ONGOING: {
        label: "Sedang Berjalan",
        short: "Berjalan",
        emoji: "🟢",
        bg: "bg-success/15",
        text: "text-success",
        border: "border-success/30",
        bar: "bg-success",
        icon: PlayCircle,
    },
    FINISHED: {
        label: "Selesai Event",
        short: "Selesai Event",
        emoji: "✅",
        bg: "bg-muted",
        text: "text-muted-foreground",
        border: "border-border",
        bar: "bg-muted-foreground",
        icon: CheckCircle2,
    },
    REPORT_DONE: {
        label: "Laporan Lengkap",
        short: "Laporan Lengkap",
        emoji: "📄",
        bg: "bg-violet-50",
        text: "text-violet-700",
        border: "border-violet-400",
        bar: "bg-violet-500",
        icon: CheckCircle2,
    },
    NO_DATE: {
        label: "Tanpa Tanggal",
        short: "—",
        emoji: "❔",
        bg: "bg-warning/15",
        text: "text-warning",
        border: "border-warning/30",
        bar: "bg-warning",
        icon: CalendarOff,
    },
};

/**
 * Tentukan status RAB berdasarkan:
 * 1. reportCompletedAt — kalau sudah, status = REPORT_DONE (laporan tuntas, project closed)
 * 2. periodStart/periodEnd vs sekarang — UPCOMING / ONGOING / FINISHED
 * 3. NO_DATE kalau belum ada tanggal
 */
function getRabEventStatus(rab: RabPlan): EventStatus {
    // Prioritas tertinggi: laporan lengkap (admin sudah finalize)
    if (rab.reportCompletedAt) return "REPORT_DONE";

    const now = new Date();
    const start = rab.periodStart ? new Date(rab.periodStart) : null;
    const end = rab.periodEnd ? new Date(rab.periodEnd) : null;

    if (!start && !end) return "NO_DATE";
    const s = start ?? end!;
    const e = end ?? start!;
    const eEnd = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59);
    const sStart = new Date(s.getFullYear(), s.getMonth(), s.getDate());

    if (now < sStart) return "UPCOMING";
    if (now > eEnd) return "FINISHED";
    return "ONGOING";
}

/** Hari yang relevan dari sekarang: untuk UPCOMING = sisa hari, FINISHED = sudah berapa hari lalu */
function daysFrom(rab: RabPlan, status: EventStatus): string | null {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (status === "UPCOMING" && rab.periodStart) {
        const s = new Date(rab.periodStart);
        const diff = Math.ceil((s.getTime() - today.getTime()) / 86400000);
        if (diff <= 0) return null;
        if (diff === 1) return "Mulai besok";
        return `Mulai ${diff} hari lagi`;
    }
    if (status === "FINISHED" && (rab.periodEnd || rab.periodStart)) {
        const e = new Date(rab.periodEnd ?? rab.periodStart!);
        const eEnd = new Date(e.getFullYear(), e.getMonth(), e.getDate());
        const diff = Math.floor((today.getTime() - eEnd.getTime()) / 86400000);
        if (diff <= 0) return "Selesai hari ini";
        if (diff === 1) return "Selesai kemarin";
        if (diff < 30) return `Selesai ${diff} hari lalu`;
        if (diff < 365) return `Selesai ${Math.floor(diff / 30)} bulan lalu`;
        return `Selesai ${Math.floor(diff / 365)} tahun lalu`;
    }
    if (status === "ONGOING" && rab.periodEnd) {
        const e = new Date(rab.periodEnd);
        const eEnd = new Date(e.getFullYear(), e.getMonth(), e.getDate());
        const diff = Math.ceil((eEnd.getTime() - today.getTime()) / 86400000);
        if (diff <= 0) return "Berakhir hari ini";
        if (diff === 1) return "Berakhir besok";
        return `Berakhir ${diff} hari lagi`;
    }
    return null;
}
import { RabPreviewModal } from "./RabPreviewModal";

const toast = {
    success: (msg: string) => alert(msg),
    error: (msg: string) => alert(msg),
};

function fmtRp(v: number | string) {
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (!isFinite(n)) return "Rp 0";
    return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

function ViewModeBtn({
    active,
    onClick,
    icon,
    label,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={`Tampilkan sebagai ${label}`}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition ${active
                ? "bg-card text-primary shadow-sm border border-primary/30"
                : "text-muted-foreground hover:text-foreground"
                }`}
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
}

function StatusTab({
    active,
    onClick,
    label,
    count,
    color,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    count: number;
    color: "slate" | "emerald" | "blue" | "amber";
}) {
    const activeMap: Record<string, string> = {
        slate: "bg-foreground text-background border-foreground",
        emerald: "bg-success text-white border-success",
        blue: "bg-info text-white border-info",
        amber: "bg-warning text-warning-foreground border-warning",
    };
    const idleMap: Record<string, string> = {
        slate: "bg-card text-muted-foreground border-border hover:border-foreground/40",
        emerald: "bg-card text-success border-success/30 hover:border-success/50",
        blue: "bg-card text-info border-info/30 hover:border-info/50",
        amber: "bg-card text-warning border-warning/30 hover:border-warning/50",
    };
    return (
        <button
            type="button"
            onClick={onClick}
            className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full border-2 text-xs sm:text-sm font-semibold transition ${active ? activeMap[color] : idleMap[color]
                }`}
        >
            <span>{label}</span>
            <span
                className={`text-[10px] sm:text-[11px] font-mono font-bold px-1 sm:px-1.5 rounded-full ${active ? "bg-white/20" : "bg-muted text-foreground"
                    }`}
            >
                {count}
            </span>
        </button>
    );
}

function fmtDate(s: string | null) {
    if (!s) return "—";
    try {
        return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    } catch {
        return "—";
    }
}

function RabTagFilterStrip({
    rabs,
    active,
    onChange,
}: {
    rabs: RabPlan[];
    active: string;
    onChange: (t: string) => void;
}) {
    // Hitung freq dari semua tag di RAB
    const tagCounts = useMemo(() => {
        const counter = new Map<string, number>();
        for (const r of rabs) {
            for (const t of parseRabTags(r.tags)) {
                counter.set(t, (counter.get(t) ?? 0) + 1);
            }
        }
        return Array.from(counter.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    }, [rabs]);

    // Default: tampil top 6 tag terbanyak. Sisanya disembunyikan + dapat di-expand atau dicari.
    const TOP_N = 6;
    const [showAll, setShowAll] = useState(false);
    const [search, setSearch] = useState("");

    if (tagCounts.length === 0) return null;

    // Pastikan tag aktif selalu kelihatan, walau bukan top-N.
    const topTags = tagCounts.slice(0, TOP_N);
    const activeNotInTop = active && !topTags.some((t) => t.tag === active)
        ? tagCounts.find((t) => t.tag === active)
        : null;

    const filteredHidden = search.trim()
        ? tagCounts.filter((t) =>
            t.tag.toLowerCase().includes(search.toLowerCase().trim()),
        )
        : tagCounts.slice(TOP_N);
    const hiddenCount = tagCounts.length - TOP_N;

    const renderChip = (tag: string, count: number) => {
        const isActive = active === tag;
        return (
            <button
                key={tag}
                type="button"
                onClick={() => {
                    onChange(isActive ? "" : tag);
                    if (showAll) setShowAll(false);
                    setSearch("");
                }}
                className={`shrink-0 px-2.5 py-1 text-xs font-semibold rounded-full border-2 transition inline-flex items-center gap-1.5 ${isActive
                    ? "bg-info text-white border-info"
                    : "bg-card text-info border-info/30 hover:border-info/50"
                    }`}
            >
                {tag}
                <span className={`text-[10px] font-mono px-1 rounded-full ${isActive ? "bg-white/30" : "bg-info/15 text-info"}`}>
                    {count}
                </span>
            </button>
        );
    };

    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-muted-foreground shrink-0 w-[56px] uppercase tracking-wider inline-flex items-center gap-1"><TagIcon className="h-3.5 w-3.5" /> Tag</span>
                <button
                    type="button"
                    onClick={() => onChange("")}
                    className={`shrink-0 px-2.5 py-1 text-xs font-semibold rounded-full border-2 transition ${active === ""
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card text-foreground border-border hover:border-foreground/40"
                        }`}
                >
                    Semua
                </button>
                {topTags.map(({ tag, count }) => renderChip(tag, count))}
                {activeNotInTop && renderChip(activeNotInTop.tag, activeNotInTop.count)}
                {hiddenCount > 0 && (
                    <button
                        type="button"
                        onClick={() => setShowAll((v) => !v)}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border-2 border-dashed border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:border-border transition"
                    >
                        {showAll ? <><ChevronUp className="h-3 w-3" /> Sembunyikan</> : <><ChevronDown className="h-3 w-3" /> +{hiddenCount} lainnya</>}
                    </button>
                )}
            </div>

            {/* Drawer expandable — search + list semua tag */}
            {showAll && (
                <div className="ml-[64px] border-2 border-dashed border-border rounded-lg p-2.5 bg-muted/40">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cari tag:</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Ketik untuk filter..."
                            autoFocus
                            className="flex-1 max-w-xs border border-border rounded px-2 py-1 text-xs bg-background"
                        />
                        <span className="text-[10px] text-muted-foreground">
                            {filteredHidden.length} tag
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto [scrollbar-width:thin]">
                        {filteredHidden.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground italic">Tidak ada tag cocok.</p>
                        ) : (
                            filteredHidden.map(({ tag, count }) => renderChip(tag, count))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function RabListPage() {
    return (
        <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Memuat…</div>}>
            <RabListPageInner />
        </Suspense>
    );
}

function RabListPageInner() {
    const searchParams = useSearchParams();
    const customerIdParam = searchParams.get("customerId");
    const presetCustomerId = customerIdParam ? Number(customerIdParam) : null;

    // Fetch customer dari URL param (untuk auto-buka create modal)
    const { data: prefillCustomer } = useQuery({
        queryKey: ["customer", presetCustomerId],
        queryFn: () => getCustomer(presetCustomerId!),
        enabled: !!presetCustomerId,
    });
    const qc = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState<{
        title: string;
        projectName: string;
        location: string;
        periodStart: string;
        periodEnd: string;
        brand: Brand;
        customer: Customer | null;
        tags: string[];
    }>({
        title: "",
        projectName: "",
        location: "",
        periodStart: "",
        periodEnd: "",
        brand: "EXINDO",
        customer: null,
        tags: [],
    });
    const [showCustomerPicker, setShowCustomerPicker] = useState(false);

    // Saat ada ?customerId=X di URL → auto-buka create modal dengan customer prefilled
    useEffect(() => {
        if (prefillCustomer) {
            setForm((f) => ({ ...f, customer: prefillCustomer }));
            setShowCreate(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prefillCustomer]);

    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<EventStatus | "ALL">("ALL");
    const [brandFilter, setBrandFilter] = useState<Brand | "">("");
    const [tagFilter, setTagFilter] = useState<string>("");
    const [dateRange, setDateRange] = useState<DateRange>({ preset: "ALL" });
    const [viewMode, setViewMode] = useState<ViewMode>("card");

    // Persist viewMode di localStorage
    useEffect(() => {
        try {
            const v = localStorage.getItem(VIEW_MODE_KEY);
            if (v === "card" || v === "list" || v === "details") setViewMode(v);
        } catch { /* ignore */ }
    }, []);
    useEffect(() => {
        try { localStorage.setItem(VIEW_MODE_KEY, viewMode); } catch { /* ignore */ }
    }, [viewMode]);
    const [previewId, setPreviewId] = useState<number | null>(null);
    const [uploadingId, setUploadingId] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [pendingUploadId, setPendingUploadId] = useState<number | null>(null);

    const { data: rabs, isLoading } = useQuery({
        queryKey: ["rab-list"],
        queryFn: getRabList,
    });

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

    const createMut = useMutation({
        mutationFn: createRab,
        onSuccess: (rab) => {
            toast.success(`RAB ${rab.code} berhasil dibuat`);
            qc.invalidateQueries({ queryKey: ["rab-list"] });
            setShowCreate(false);
            setForm({ title: "", projectName: "", location: "", periodStart: "", periodEnd: "", brand: form.brand, customer: null, tags: [] });
            window.location.href = `/rab/${rab.id}`;
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal buat RAB"),
    });

    const duplicateMut = useMutation({
        mutationFn: (id: number) => duplicateRab(id, {}),
        onSuccess: (rab) => {
            toast.success(`Berhasil disalin: ${rab.code}`);
            qc.invalidateQueries({ queryKey: ["rab-list"] });
        },
    });

    const deleteMut = useMutation({
        mutationFn: deleteRab,
        onSuccess: () => {
            toast.success("RAB berhasil dihapus");
            qc.invalidateQueries({ queryKey: ["rab-list"] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal hapus"),
    });

    const uploadImageMut = useMutation({
        mutationFn: ({ id, file }: { id: number; file: File }) => uploadRabImage(id, file),
        onSuccess: (res) => {
            toast.success(`Foto ${res.code} berhasil di-upload`);
            qc.invalidateQueries({ queryKey: ["rab-list"] });
            qc.invalidateQueries({ queryKey: ["rab", res.id] });
            setUploadingId(null);
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || "Gagal upload foto");
            setUploadingId(null);
        },
    });

    const removeImageMut = useMutation({
        mutationFn: (id: number) => removeRabImage(id),
        onSuccess: (res) => {
            toast.success(`Foto ${res.code} dihapus`);
            qc.invalidateQueries({ queryKey: ["rab-list"] });
            qc.invalidateQueries({ queryKey: ["rab", res.id] });
        },
    });

    function handleSelectImageFor(id: number) {
        setPendingUploadId(id);
        fileInputRef.current?.click();
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        const id = pendingUploadId;
        e.target.value = "";
        if (!file || !id) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Ukuran foto maksimal 5 MB");
            return;
        }
        setUploadingId(id);
        uploadImageMut.mutate({ id, file });
    }

    const handleConfirmDelete = (rab: RabPlan) => {
        if (confirm(`Hapus RAB ${rab.code} (${rab.title})?\nAksi ini tidak bisa di-undo.`)) {
            deleteMut.mutate(rab.id);
        }
    };

    const handleRemoveImage = (rab: RabPlan) => {
        if (confirm(`Hapus foto RAB ${rab.code}?`)) removeImageMut.mutate(rab.id);
    };

    const handleDownloadXlsx = async (rab: RabPlan) => {
        try {
            setDownloadingId(rab.id);
            const blob = await downloadRabXlsx(rab.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${rab.code}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error("Gagal download Excel");
        } finally {
            setDownloadingId(null);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim()) return toast.error("Judul wajib diisi");
        createMut.mutate({
            title: form.title.trim(),
            projectName: form.projectName.trim() || undefined,
            location: form.location.trim() || undefined,
            periodStart: form.periodStart || undefined,
            periodEnd: form.periodEnd || undefined,
            brand: form.brand,
            customerId: form.customer?.id ?? null,
            tags: form.tags,
        });
    };

    // Hitung jumlah RAB per status (untuk badge di tab)
    const statusCounts = useMemo(() => {
        const acc: Record<EventStatus | "ALL", number> = {
            ALL: 0, UPCOMING: 0, ONGOING: 0, FINISHED: 0, REPORT_DONE: 0, NO_DATE: 0,
        };
        if (!rabs) return acc;
        acc.ALL = rabs.length;
        for (const r of rabs) acc[getRabEventStatus(r)] += 1;
        return acc;
    }, [rabs]);

    const filteredRabs = useMemo(() => {
        if (!rabs) return [] as RabPlan[];
        const q = search.trim().toLowerCase();
        let list = rabs;
        if (statusFilter !== "ALL") {
            list = list.filter((r) => getRabEventStatus(r) === statusFilter);
        }
        if (brandFilter !== "") {
            list = list.filter((r) => r.brand === brandFilter);
        }
        if (tagFilter) {
            const tf = tagFilter.toLowerCase();
            list = list.filter((r) => parseRabTags(r.tags).some((t) => t.toLowerCase() === tf));
        }
        // Date range filter — pakai periodStart RAB (kapan event berlangsung)
        // Bisa filter past (event tahun lalu) maupun future (event yang akan datang)
        const { from: dateFrom, to: dateTo } = presetToRange(dateRange.preset, {
            from: dateRange.fromDate, to: dateRange.toDate,
        });
        if (dateFrom || dateTo) {
            list = list.filter((r) => {
                const sourceDate = r.periodStart ?? r.periodEnd ?? null;
                const d = sourceDate ? new Date(sourceDate) : null;
                if (!d) return false; // RAB tanpa tanggal event di-exclude saat filter aktif
                if (dateFrom && d < dateFrom) return false;
                if (dateTo && d > dateTo) return false;
                return true;
            });
        }
        if (!q) return list;
        return list.filter((r) => {
            const tagText = parseRabTags(r.tags).join(" ");
            const haystack = [
                r.code,
                r.title,
                r.projectName ?? "",
                r.location ?? "",
                r.customer?.name ?? "",
                r.customer?.companyName ?? "",
                tagText,
            ].join(" ").toLowerCase();
            return haystack.includes(q);
        });
    }, [rabs, search, statusFilter, brandFilter, tagFilter, dateRange]);

    // Backend list (GET /rab) sekarang return aggregate fields — pakai langsung, hemat compute & RAM.
    // Fallback ke perhitungan manual kalau aggregate undefined (mis. dari getRab single detail).
    const computeTotalRab = (rab: RabPlan) => {
        if (typeof rab.totalRab === "number") return rab.totalRab;
        return (rab.items ?? []).reduce((acc, it) => {
            const q = typeof it.quantity === "string" ? parseFloat(it.quantity) : it.quantity;
            const p = typeof it.priceRab === "string" ? parseFloat(it.priceRab) : it.priceRab;
            return acc + (q || 0) * (p || 0);
        }, 0);
    };

    const computeTotalCost = (rab: RabPlan) => {
        if (typeof rab.totalCost === "number") return rab.totalCost;
        return (rab.items ?? []).reduce((acc, it) => {
            const qSrc = it.quantityCost ?? it.quantity;
            const q = typeof qSrc === "string" ? parseFloat(qSrc) : qSrc;
            const p = typeof it.priceCost === "string" ? parseFloat(it.priceCost) : it.priceCost;
            return acc + (q || 0) * (p || 0);
        }, 0);
    };

    /**
     * Hitung jumlah item yang priceRab > 0 tapi priceCost = 0 → real cost belum diisi.
     * Margin item-item ini terhitung 100% (palsu) — perlu indikator buat user.
     */
    const countMissingCostItems = (rab: RabPlan): number => {
        if (typeof rab.missingCostItemCount === "number") return rab.missingCostItemCount;
        return (rab.items ?? []).filter((it) => {
            const pRab = typeof it.priceRab === "string" ? parseFloat(it.priceRab) : (it.priceRab ?? 0);
            const pCost = typeof it.priceCost === "string" ? parseFloat(it.priceCost) : (it.priceCost ?? 0);
            return (pRab || 0) > 0 && (pCost || 0) === 0;
        }).length;
    };

    return (
        <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
            {/* ─── Header — Mobile-first responsive ─── */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 sm:mb-6">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center gap-2"><ClipboardList className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" /> RAB — Anggaran Proyek</h1>
                    <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-0.5 sm:mt-1">
                        Daftar perhitungan biaya tiap proyek booth/event.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg hover:opacity-90 shadow-sm w-full sm:w-auto shrink-0 text-sm sm:text-base font-semibold"
                >
                    <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                    Buat RAB Baru
                </button>
            </div>

            {/* ═════════════════════════════════════════════════════════════
              ║ Panel Filter — restructure jadi 1 card terpadu, 3 section:
              ║   Top    : Search + counter + view mode toggle
              ║   Middle : Klasifikasi (Brand + Tag) — apa jenis project
              ║   Bottom : Temporal (Tanggal + Status) — kapan project
              ╚════════════════════════════════════════════════════════════*/}
            <div className="mb-4 sm:mb-6 rounded-xl border border-border bg-muted/40 overflow-hidden">

                {/* ── TOP BAR: Search + View Mode ── */}
                <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-border bg-card/60">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari RAB — kode, judul, klien, lokasi…"
                            className="w-full pl-10 pr-10 py-2 sm:py-2.5 text-sm rounded-lg border-2 border-border bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-muted"
                                aria-label="Bersihkan pencarian"
                            >
                                <X className="h-4 w-4 text-muted-foreground" />
                            </button>
                        )}
                    </div>
                    {/* Counter chip — show always when filter aktif */}
                    {(search || brandFilter !== "" || tagFilter || dateRange.preset !== "ALL" || statusFilter !== "ALL") && (
                        <span className="hidden sm:inline-flex shrink-0 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
                            <strong className="text-foreground">{filteredRabs.length}</strong>
                            <span className="opacity-60">/{rabs?.length ?? 0}</span>
                        </span>
                    )}
                    {/* View mode toggle */}
                    <div className="inline-flex items-center gap-0.5 bg-card p-0.5 rounded-lg border border-border shrink-0">
                        <ViewModeBtn
                            active={viewMode === "card"}
                            onClick={() => setViewMode("card")}
                            icon={<LayoutGrid className="h-4 w-4" />}
                            label="Card"
                        />
                        <ViewModeBtn
                            active={viewMode === "list"}
                            onClick={() => setViewMode("list")}
                            icon={<ListIcon className="h-4 w-4" />}
                            label="List"
                        />
                        <ViewModeBtn
                            active={viewMode === "details"}
                            onClick={() => setViewMode("details")}
                            icon={<TableIcon className="h-4 w-4" />}
                            label="Detail"
                        />
                    </div>
                </div>

                {/* Counter chip — mobile only (di bawah search bar) */}
                {(search || brandFilter !== "" || tagFilter || dateRange.preset !== "ALL" || statusFilter !== "ALL") && (
                    <div className="sm:hidden px-3 pt-2 pb-0 -mb-1 flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                            <strong className="text-foreground">{filteredRabs.length}</strong>
                            <span className="opacity-60">/{rabs?.length ?? 0} RAB cocok</span>
                        </span>
                        <button
                            onClick={() => {
                                setSearch("");
                                setBrandFilter("");
                                setTagFilter("");
                                setDateRange({ preset: "ALL" });
                                setStatusFilter("ALL");
                            }}
                            className="text-[11px] text-destructive hover:underline"
                        >
                            Reset semua
                        </button>
                    </div>
                )}

                {/* ── KLASIFIKASI: Brand + Tag ── */}
                <div className="px-3 sm:px-4 py-2.5 sm:py-3 space-y-2 border-b border-border">
                    {/* Brand row */}
                    <div className="flex items-center gap-2 overflow-x-auto sm:flex-wrap whitespace-nowrap pb-1 sm:pb-0 -mx-2 px-2 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
                        <span className="text-xs font-bold text-muted-foreground shrink-0 w-[56px] uppercase tracking-wider">Brand</span>
                        <button
                            type="button"
                            onClick={() => setBrandFilter("")}
                            className={`shrink-0 px-2.5 py-1 text-xs font-semibold rounded-full border-2 transition ${brandFilter === ""
                                ? "bg-foreground text-background border-foreground"
                                : "bg-card text-foreground border-border hover:border-foreground/40"
                                }`}
                        >
                            Semua
                        </button>
                        {ACTIVE_BRANDS.map((b) => {
                            const meta = BRAND_META[b];
                            const active = brandFilter === b;
                            const count = (rabs ?? []).filter((r) => r.brand === b).length;
                            return (
                                <button
                                    key={b}
                                    type="button"
                                    onClick={() => setBrandFilter(b)}
                                    className={`shrink-0 px-2.5 py-1 text-xs font-semibold rounded-full border-2 transition inline-flex items-center gap-1.5 ${active
                                        ? `${meta.bg} ${meta.text} ${meta.border}`
                                        : "bg-card text-foreground border-border hover:border-foreground/40"
                                        }`}
                                >
                                    <span>{meta.emoji}</span>
                                    {meta.short}
                                    <span className={`text-[10px] font-mono px-1 rounded-full ${active ? "bg-white/30" : "bg-muted"}`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                        {(rabs ?? []).some((r) => !r.brand) && (
                            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] text-warning bg-warning/15 border border-warning/30 rounded-full px-2 py-0.5">
                                <AlertTriangle className="h-3 w-3" /> {(rabs ?? []).filter((r) => !r.brand).length} belum tag
                            </span>
                        )}
                    </div>

                    {/* Tag row */}
                    <RabTagFilterStrip rabs={rabs ?? []} active={tagFilter} onChange={setTagFilter} />
                </div>

                {/* ── TEMPORAL: Tanggal + Status ── */}
                <div className="px-3 sm:px-4 py-2.5 sm:py-3 space-y-2 bg-muted/20">
                    {/* Tanggal row — filter by tanggal event (periodStart) */}
                    <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-muted-foreground shrink-0 w-[56px] uppercase tracking-wider mt-1.5">Tanggal</span>
                        <div className="flex-1 min-w-0">
                            <DateRangeFilter value={dateRange} onChange={setDateRange} label="" />
                        </div>
                    </div>

                    {/* Status row */}
                    <div className="flex items-center gap-2 overflow-x-auto sm:flex-wrap whitespace-nowrap pb-1 sm:pb-0 -mx-2 px-2 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
                        <span className="text-xs font-bold text-muted-foreground shrink-0 w-[56px] uppercase tracking-wider">Status</span>
                        <StatusTab
                            active={statusFilter === "ALL"}
                            onClick={() => setStatusFilter("ALL")}
                            label="Semua"
                            count={statusCounts.ALL}
                            color="slate"
                        />
                        <StatusTab
                            active={statusFilter === "ONGOING"}
                            onClick={() => setStatusFilter("ONGOING")}
                            label="Berjalan"
                            count={statusCounts.ONGOING}
                            color="emerald"
                        />
                        <StatusTab
                            active={statusFilter === "UPCOMING"}
                            onClick={() => setStatusFilter("UPCOMING")}
                            label="Akan Datang"
                            count={statusCounts.UPCOMING}
                            color="blue"
                        />
                        <StatusTab
                            active={statusFilter === "FINISHED"}
                            onClick={() => setStatusFilter("FINISHED")}
                            label="Selesai Event"
                            count={statusCounts.FINISHED}
                            color="slate"
                        />
                        <StatusTab
                            active={statusFilter === "REPORT_DONE"}
                            onClick={() => setStatusFilter("REPORT_DONE")}
                            label="Laporan Lengkap"
                            count={statusCounts.REPORT_DONE}
                            color="blue"
                        />
                        {statusCounts.NO_DATE > 0 && (
                            <StatusTab
                                active={statusFilter === "NO_DATE"}
                                onClick={() => setStatusFilter("NO_DATE")}
                                label="Tanpa Tanggal"
                                count={statusCounts.NO_DATE}
                                color="amber"
                            />
                        )}
                    </div>
                </div>

            </div>{/* /Panel Filter */}

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
            />

            {/* ─── List Content ─── */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <span className="text-sm">Memuat daftar RAB...</span>
                </div>
            ) : !rabs || rabs.length === 0 ? (
                <div className="border-2 border-dashed rounded-xl p-6 sm:p-12 text-center">
                    <ClipboardList className="h-16 w-16 mx-auto mb-3 sm:mb-4 text-muted-foreground/40" />
                    <h3 className="text-lg sm:text-xl font-semibold mb-2">Belum Ada RAB</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Klik tombol di atas untuk membuat RAB pertama Anda.
                    </p>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm"
                    >
                        <Plus className="h-4 w-4" /> Buat RAB Pertama
                    </button>
                </div>
            ) : filteredRabs.length === 0 ? (
                <div className="border-2 border-dashed rounded-xl p-6 sm:p-12 text-center">
                    <Search className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                    <h3 className="text-xl font-semibold mb-1">Tidak Ditemukan</h3>
                    <p className="text-muted-foreground">
                        Tidak ada RAB yang cocok dengan <strong>&quot;{search}&quot;</strong>
                    </p>
                    <button
                        onClick={() => setSearch("")}
                        className="mt-4 text-sm text-primary hover:underline"
                    >
                        Bersihkan pencarian
                    </button>
                </div>
            ) : viewMode === "list" ? (
                <RabListView
                    rabs={filteredRabs}
                    apiBase={apiBase}
                    onPreview={(id) => setPreviewId(id)}
                    onUpload={(id) => handleSelectImageFor(id)}
                    onRemoveImage={handleRemoveImage}
                    onDuplicate={(id) => duplicateMut.mutate(id)}
                    onDelete={handleConfirmDelete}
                    onDownload={(rab) => handleDownloadXlsx(rab)}
                    uploadingId={uploadingId}
                    downloadingId={downloadingId}
                    computeTotalRab={computeTotalRab}
                    computeTotalCost={computeTotalCost}
                />
            ) : viewMode === "details" ? (
                <RabDetailsView
                    rabs={filteredRabs}
                    onPreview={(id) => setPreviewId(id)}
                    onRemoveImage={handleRemoveImage}
                    onDelete={handleConfirmDelete}
                    onDownload={(rab) => handleDownloadXlsx(rab)}
                    downloadingId={downloadingId}
                    computeTotalRab={computeTotalRab}
                    computeTotalCost={computeTotalCost}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredRabs.map((rab) => {
                        const totalRab = computeTotalRab(rab);
                        const totalCost = computeTotalCost(rab);
                        const selisih = totalRab - totalCost;
                        const margin = totalRab > 0 ? (selisih / totalRab) * 100 : 0;
                        const isUntung = selisih >= 0;
                        const missingCostCount = countMissingCostItems(rab);
                        const totalItemCount = rab.itemCount ?? rab.items?.length ?? 0;
                        // Margin "palsu" kalau totalCost = 0 (semua item belum ada real cost)
                        const isMarginFake = totalCost === 0 && totalRab > 0;
                        const hasMissingCost = missingCostCount > 0;
                        // Pendapatan riil (DP + Pelunasan + Other) vs Cost = Saldo bersih
                        const totalIncome =
                            (parseFloat(rab.dpAmount as any) || 0) +
                            (parseFloat(rab.pelunasan as any) || 0) +
                            (parseFloat(rab.incomeOther as any) || 0);
                        const saldoBersih = totalIncome - totalCost;
                        const isSaldoUntung = saldoBersih >= 0;
                        const saldoMargin = totalIncome > 0 ? (saldoBersih / totalIncome) * 100 : 0;
                        // Status pembayaran (untuk konteks saldo bersih supaya minus gak salah dibaca)
                        const dpVal = parseFloat(rab.dpAmount as any) || 0;
                        const pelVal = parseFloat(rab.pelunasan as any) || 0;
                        const otherVal = parseFloat(rab.incomeOther as any) || 0;
                        const paymentStatus: { label: string; emoji: string; cls: string; hint: string } =
                            totalIncome === 0
                                ? { label: "Belum ada pembayaran", emoji: "⏳", cls: "bg-muted text-foreground border-border", hint: "Belum ada DP/pelunasan masuk" }
                                : pelVal > 0 && dpVal > 0
                                    ? { label: "Lunas (DP + Pelunasan)", emoji: "✅", cls: "bg-success/15 text-success border-success/30", hint: "Sudah DP & pelunasan — saldo bersih = untung riil" }
                                    : pelVal > 0
                                        ? { label: "Lunas", emoji: "✅", cls: "bg-success/15 text-success border-success/30", hint: "Pelunasan sudah masuk" }
                                        : dpVal > 0
                                            ? { label: "Baru DP — belum pelunasan", emoji: "🟡", cls: "bg-warning/15 text-warning border-warning/30", hint: "Baru bayar DP. Saldo minus wajar — pelunasan belum masuk." }
                                            : otherVal > 0
                                                ? { label: "Income Lain saja", emoji: "ℹ️", cls: "bg-info/15 text-info border-info/30", hint: "Hanya ada income lain (bukan DP/pelunasan)" }
                                                : { label: "Belum ada pembayaran", emoji: "⏳", cls: "bg-muted text-foreground border-border", hint: "Belum ada DP/pelunasan masuk" };
                        const eventStatus = getRabEventStatus(rab);
                        const statusMeta = STATUS_META[eventStatus];
                        const StatusIcon = statusMeta.icon;
                        const daysHint = daysFrom(rab, eventStatus);

                        return (
                            <div
                                key={rab.id}
                                className={`bg-card border-2 ${statusMeta.border} rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col relative`}
                            >
                                {/* Strip warna status di kiri card */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusMeta.bar}`} />
                                {/* Foto / Placeholder Foto */}
                                {rab.imageUrl ? (
                                    <div
                                        onClick={() => setPreviewId(rab.id)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                setPreviewId(rab.id);
                                            }
                                        }}
                                        className="relative aspect-[16/9] w-full bg-muted overflow-hidden hover:opacity-95 transition-opacity cursor-pointer group"
                                        title="Klik untuk lihat detail"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={`${apiBase}${rab.imageUrl}`}
                                            alt={rab.title}
                                            className="w-full h-full object-cover"
                                        />
                                        <span className="absolute top-2 left-2 bg-black/60 text-white text-xs font-mono px-2 py-1 rounded pointer-events-none">
                                            {rab.code}
                                        </span>
                                        <span
                                            className={`absolute top-2 right-2 inline-flex items-center gap-1 ${statusMeta.bg} ${statusMeta.text} text-xs font-bold px-2.5 py-1 rounded-full border ${statusMeta.border} shadow-sm pointer-events-none`}
                                        >
                                            <StatusIcon className="h-3.5 w-3.5" />
                                            {statusMeta.short}
                                        </span>
                                        {/* Tombol Hapus Foto — overlay yang muncul saat hover */}
                                        <div className="absolute inset-x-0 bottom-0 p-2 flex justify-end gap-2 bg-gradient-to-t from-black/60 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelectImageFor(rab.id);
                                                }}
                                                disabled={uploadingId === rab.id}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-card/90 text-foreground text-xs font-semibold hover:bg-card shadow-sm disabled:opacity-50"
                                                title="Ganti foto"
                                            >
                                                {uploadingId === rab.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <ImageIcon className="h-3 w-3" />
                                                )}
                                                Ganti
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveImage(rab);
                                                }}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-destructive/90 text-white text-xs font-semibold hover:bg-destructive shadow-sm"
                                                title="Hapus foto"
                                            >
                                                <ImageOff className="h-3 w-3" />
                                                Hapus Foto
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleSelectImageFor(rab.id)}
                                        disabled={uploadingId === rab.id}
                                        className="relative aspect-[16/9] w-full bg-gradient-to-br from-muted/40 to-muted/20 border-b flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/40 hover:text-primary transition-colors disabled:opacity-50"
                                        title="Upload foto sketsa atau referensi"
                                    >
                                        {uploadingId === rab.id ? (
                                            <Loader2 className="h-8 w-8 animate-spin" />
                                        ) : (
                                            <>
                                                <ImageIcon className="h-10 w-10 mb-2" />
                                                <span className="text-sm font-medium">+ Upload Foto</span>
                                            </>
                                        )}
                                        <span className="absolute top-2 left-2 bg-foreground/10 text-foreground text-xs font-mono px-2 py-1 rounded">
                                            {rab.code}
                                        </span>
                                        <span
                                            className={`absolute top-2 right-2 inline-flex items-center gap-1 ${statusMeta.bg} ${statusMeta.text} text-xs font-bold px-2.5 py-1 rounded-full border ${statusMeta.border} shadow-sm`}
                                        >
                                            <StatusIcon className="h-3.5 w-3.5" />
                                            {statusMeta.short}
                                        </span>
                                    </button>
                                )}

                                {/* Body */}
                                <div className="p-3 sm:p-4 flex-1 flex flex-col">
                                    {/* Judul + Untung/Rugi badge */}
                                    <div className="mb-3">
                                        <div className="mb-1">
                                            <BrandBadge brand={rab.brand} size="xs" />
                                        </div>
                                        <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight break-words">
                                            {rab.title}
                                        </h2>
                                        {rab.projectName && (
                                            <p className="text-sm text-muted-foreground mt-0.5">{rab.projectName}</p>
                                        )}
                                        {daysHint && (
                                            <p className={`text-xs mt-1 font-semibold inline-flex items-center gap-1 ${statusMeta.text}`}>
                                                <StatusIcon className="h-3 w-3" />
                                                {daysHint}
                                            </p>
                                        )}
                                    </div>

                                    {/* Dua banner berdampingan: Selisih RAB (proyeksi) vs Saldo Bersih (riil dari pendapatan masuk) */}
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        {/* Banner 1 — Margin proyeksi (RAB − Cost) */}
                                        <div
                                            className={`rounded-lg p-2.5 border-2 ${
                                                isMarginFake
                                                    ? "bg-warning/15 border-warning/30"
                                                    : isUntung
                                                        ? "bg-success/15 border-success/30"
                                                        : "bg-destructive/12 border-destructive/20"
                                            }`}
                                            title={isMarginFake
                                                ? "⚠ Margin 100% karena Real Cost belum diisi sama sekali. Update cost di detail RAB supaya margin akurat."
                                                : "Margin proyeksi: Total Perkiraan Biaya (RAB) − Total COST"
                                            }
                                        >
                                            <div className="flex items-center gap-1 mb-1">
                                                {isMarginFake ? (
                                                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                                                ) : isUntung ? (
                                                    <TrendingUp className="h-3.5 w-3.5 text-success" />
                                                ) : (
                                                    <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                                                )}
                                                <span className={`text-[11px] font-semibold uppercase tracking-wide ${
                                                    isMarginFake
                                                        ? "text-warning"
                                                        : isUntung ? "text-success" : "text-destructive"
                                                }`}>
                                                    Selisih RAB
                                                </span>
                                            </div>
                                            <div className={`text-sm sm:text-base font-bold nums font-mono leading-tight break-all ${
                                                isMarginFake
                                                    ? "text-warning"
                                                    : isUntung ? "text-success" : "text-destructive"
                                            }`}>
                                                {isUntung ? "+" : "−"}{fmtRp(Math.abs(selisih))}
                                            </div>
                                            <div className={`text-[10px] mt-0.5 ${
                                                isMarginFake
                                                    ? "text-warning italic"
                                                    : isUntung ? "text-success" : "text-destructive"
                                            }`}>
                                                {isMarginFake
                                                    ? "⚠ Real Cost belum diisi"
                                                    : hasMissingCost
                                                        ? `${margin.toFixed(0)}% margin · ${missingCostCount}/${totalItemCount} item belum ada cost`
                                                        : totalRab > 0 ? `${margin.toFixed(0)}% margin proyeksi` : "—"
                                                }
                                            </div>
                                        </div>

                                        {/* Banner 2 — Saldo Bersih (Pendapatan riil − Cost) */}
                                        <div
                                            className={`rounded-lg p-2.5 border-2 ${
                                                totalIncome === 0
                                                    ? "bg-muted border-border"
                                                    : isSaldoUntung
                                                        ? "bg-success/15 border-success/30"
                                                        : "bg-warning/15 border-warning/30"
                                            }`}
                                            title="Saldo bersih riil: Pendapatan masuk (DP + Pelunasan + Lain) − Total COST. Jika baru DP, bisa minus karena cost belum tertutup."
                                        >
                                            <div className="flex items-center gap-1 mb-1">
                                                <Wallet className={`h-3.5 w-3.5 ${totalIncome === 0 ? "text-muted-foreground" : isSaldoUntung ? "text-success" : "text-warning"}`} />
                                                <span className={`text-[11px] font-semibold uppercase tracking-wide ${
                                                    totalIncome === 0
                                                        ? "text-muted-foreground"
                                                        : isSaldoUntung
                                                            ? "text-success"
                                                            : "text-warning"
                                                }`}>
                                                    Saldo Bersih
                                                </span>
                                            </div>
                                            {totalIncome === 0 ? (
                                                <>
                                                    <div className="text-base font-bold font-mono nums leading-tight text-muted-foreground">
                                                        —
                                                    </div>
                                                    <div className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${paymentStatus.cls}`} title={paymentStatus.hint}>
                                                        {paymentStatus.emoji} {paymentStatus.label}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className={`text-sm sm:text-base font-bold font-mono nums leading-tight break-all ${
                                                        isSaldoUntung
                                                            ? "text-success"
                                                            : "text-warning"
                                                    }`}>
                                                        {isSaldoUntung ? "+" : "−"}{fmtRp(Math.abs(saldoBersih))}
                                                    </div>
                                                    <div className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${paymentStatus.cls}`} title={paymentStatus.hint}>
                                                        {paymentStatus.emoji} {paymentStatus.label}
                                                    </div>
                                                    <div className={`text-[10px] mt-1 nums ${
                                                        isSaldoUntung
                                                            ? "text-success"
                                                            : "text-warning"
                                                    }`}>
                                                        Income {fmtRp(totalIncome)}
                                                        {pelVal === 0 && dpVal > 0 && (
                                                            <span className="block italic mt-0.5 text-warning">
                                                                ⚠ Minus karena pelunasan belum diterima
                                                            </span>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Info dasar dengan icon — text lebih besar untuk readability */}
                                    <div className="space-y-2 mb-4 text-sm">
                                        {rab.customer && (
                                            <div className="flex items-start gap-2">
                                                <UserIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium truncate">{rab.customer.name}</div>
                                                    {rab.customer.companyName && (
                                                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                                                            <Building2 className="h-3 w-3" />
                                                            {rab.customer.companyName}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {rab.location && (
                                            <div className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span className="truncate">{rab.location}</span>
                                            </div>
                                        )}
                                        {/* Tags — di atas Waktu Event */}
                                        {parseRabTags(rab.tags).length > 0 && (
                                            <div className="flex flex-wrap items-center gap-1">
                                                {parseRabTags(rab.tags).map((t, i) => (
                                                    <button
                                                        key={`${t}-${i}`}
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setTagFilter(t); }}
                                                        title={`Filter RAB dengan tag "${t}"`}
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-info/15 text-info border border-info/30 hover:bg-info/25 transition"
                                                    >
                                                        <TagIcon className="h-2.5 w-2.5" /> {t}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {(rab.periodStart || rab.periodEnd) && (
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span className="text-muted-foreground">
                                                    {fmtDate(rab.periodStart)}
                                                    {rab.periodEnd && (
                                                        <span> → {fmtDate(rab.periodEnd)}</span>
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Rincian harga — vertical list, mudah dibaca */}
                                    <div className="bg-muted/30 rounded-lg p-3 mb-4 space-y-1.5 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Harga Perkiraan</span>
                                            <span className="font-mono nums font-semibold">{fmtRp(totalRab)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Biaya Modal</span>
                                            <span className="font-mono nums text-muted-foreground">{fmtRp(totalCost)}</span>
                                        </div>
                                    </div>

                                    {/* Spacer agar action bar selalu di bawah */}
                                    <div className="flex-1" />

                                    {/* Action Buttons — dengan label text, lebih jelas */}
                                    <div className="grid grid-cols-3 gap-2 mb-2">
                                        <button
                                            onClick={() => setPreviewId(rab.id)}
                                            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-info/10 hover:bg-info/20 text-info border border-info/30 text-sm font-medium transition-colors"
                                            title="Lihat detail RAB tanpa membuka editor"
                                        >
                                            <Eye className="h-4 w-4" />
                                            <span>Lihat</span>
                                        </button>
                                        <Link
                                            href={`/rab/${rab.id}`}
                                            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-warning/10 hover:bg-warning/20 text-warning border border-warning/30 text-sm font-medium transition-colors"
                                            title="Edit isi RAB ini"
                                        >
                                            <Pencil className="h-4 w-4" />
                                            <span>Edit</span>
                                        </Link>
                                        <button
                                            onClick={() => handleDownloadXlsx(rab)}
                                            disabled={downloadingId === rab.id}
                                            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-success/10 hover:bg-success/20 text-success border border-success/30 text-sm font-medium transition-colors disabled:opacity-50"
                                            title="Download dalam format Excel"
                                        >
                                            {downloadingId === rab.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <FileSpreadsheet className="h-4 w-4" />
                                            )}
                                            <span>Excel</span>
                                        </button>
                                    </div>

                                    {/* Aksi tambahan — label hidden di mobile sangat kecil, tampil di sm+ */}
                                    <div className="flex items-center justify-between gap-1 pt-2 border-t border-border/50 flex-wrap">
                                        <div className="flex items-center gap-0.5 sm:gap-1">
                                            <button
                                                onClick={() => handleSelectImageFor(rab.id)}
                                                disabled={uploadingId === rab.id}
                                                className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                                                title={rab.imageUrl ? "Ganti foto" : "Upload foto"}
                                            >
                                                {uploadingId === rab.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <ImageIcon className="h-3 w-3" />
                                                )}
                                                <span className="hidden xs:inline sm:inline">{rab.imageUrl ? "Ganti" : "Foto"}</span>
                                            </button>
                                            {rab.imageUrl && (
                                                <button
                                                    onClick={() => handleRemoveImage(rab)}
                                                    disabled={removeImageMut.isPending}
                                                    className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded text-xs text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                                                    title="Hapus foto"
                                                >
                                                    <ImageOff className="h-3 w-3" />
                                                    <span className="hidden sm:inline">Hapus Foto</span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-0.5 sm:gap-1">
                                            <button
                                                onClick={() => duplicateMut.mutate(rab.id)}
                                                className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                                title="Salin RAB ini sebagai RAB baru"
                                            >
                                                <Copy className="h-3 w-3" />
                                                <span className="hidden xs:inline sm:inline">Salin</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Hapus RAB ${rab.code} (${rab.title})?\nAksi ini tidak bisa di-undo.`)) {
                                                        deleteMut.mutate(rab.id);
                                                    }
                                                }}
                                                className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded text-xs text-destructive hover:bg-destructive/10 transition-colors"
                                                title="Hapus RAB"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                                <span className="hidden xs:inline sm:inline">Hapus</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ─── Modal Buat RAB Baru — input lebih besar, label lebih jelas ─── */}
            {showCreate && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
                    onClick={() => setShowCreate(false)}
                >
                    <form
                        onSubmit={handleSubmit}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-background rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-md p-4 sm:p-6 space-y-3 sm:space-y-4 max-h-[90vh] sm:max-h-[85vh] overflow-y-auto"
                    >
                        <div>
                            <h2 className="text-xl font-bold">Buat RAB Baru</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Isi info dasar dulu — detail item bisa diisi nanti.
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-semibold block mb-1.5">
                                Brand / Perusahaan <span className="text-destructive">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {ACTIVE_BRANDS.map((b) => {
                                    const meta = BRAND_META[b];
                                    const active = form.brand === b;
                                    return (
                                        <button
                                            key={b}
                                            type="button"
                                            onClick={() => setForm({ ...form, brand: b })}
                                            className={`p-3 rounded-lg border-2 transition flex items-center gap-2 ${active
                                                ? `${meta.bg} ${meta.border}`
                                                : "bg-card border-border hover:border-border/80"
                                                }`}
                                        >
                                            <span className="text-2xl">{meta.emoji}</span>
                                            <span className={`text-sm font-bold ${active ? meta.text : "text-foreground"}`}>
                                                {meta.short}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-semibold block mb-1.5">
                                Judul Proyek <span className="text-destructive">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                className="w-full border-2 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                                placeholder="Contoh: Booth Pameran Inacraft 2026"
                                required
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold block mb-1.5">
                                Nama Project
                                <span className="text-xs font-normal text-muted-foreground ml-1">(opsional)</span>
                            </label>
                            <input
                                type="text"
                                value={form.projectName}
                                onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                                className="w-full border-2 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                                placeholder="Pameran Inacraft, dll"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold block mb-1.5">
                                Klien / Pelanggan
                                <span className="text-xs font-normal text-muted-foreground ml-1">(opsional, bisa diisi nanti)</span>
                            </label>
                            {form.customer ? (
                                <div className="border-2 border-primary/40 bg-primary/5 rounded-lg p-3 flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 text-sm font-semibold">
                                            <UsersIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                                            <span className="truncate">{form.customer.companyName || form.customer.name}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                            {form.customer.companyName && form.customer.name && <span>{form.customer.name}</span>}
                                            {form.customer.companyPIC && <span> · PIC {form.customer.companyPIC}</span>}
                                            {form.customer.phone && <span> · {form.customer.phone}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setShowCustomerPicker(true)}
                                            className="text-xs px-2 py-1 rounded border hover:bg-muted"
                                        >
                                            Ganti
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setForm({ ...form, customer: null })}
                                            className="p-1 hover:bg-destructive/10 text-destructive rounded"
                                            title="Hapus pilihan"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setShowCustomerPicker(true)}
                                    className="w-full border-2 border-dashed rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary inline-flex items-center justify-center gap-2 transition"
                                >
                                    <UsersIcon className="h-4 w-4" />
                                    Pilih dari database / Tambah klien baru
                                </button>
                            )}
                        </div>

                        <div>
                            <label className="text-sm font-semibold block mb-1.5">
                                Lokasi Event
                                <span className="text-xs font-normal text-muted-foreground ml-1">(opsional)</span>
                            </label>
                            <input
                                type="text"
                                value={form.location}
                                onChange={(e) => setForm({ ...form, location: e.target.value })}
                                className="w-full border-2 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                                placeholder="JIExpo Kemayoran, ICE BSD, dll"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold block mb-1.5 inline-flex items-center gap-1.5">
                                <TagIcon className="h-3.5 w-3.5" />
                                Tag / Kategori
                                <span className="text-xs font-normal text-muted-foreground">(memudahkan pencarian)</span>
                            </label>
                            <TagChipInput
                                value={form.tags}
                                onChange={(tags) => setForm({ ...form, tags })}
                                placeholder="Mis. Stand Standar 3x3, Pengadaan, Indoor…"
                            />
                            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                                <Info className="h-3 w-3 shrink-0" /> Bisa pilih dari preset atau ketik baru. Tag dipakai untuk filter di daftar RAB.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-semibold block mb-1.5">Tanggal Mulai</label>
                                <input
                                    type="date"
                                    value={form.periodStart}
                                    onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                                    className="w-full border-2 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold block mb-1.5">Tanggal Selesai</label>
                                <input
                                    type="date"
                                    value={form.periodEnd}
                                    onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                                    className="w-full border-2 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t">
                            <button
                                type="button"
                                onClick={() => setShowCreate(false)}
                                className="px-4 py-2.5 text-base border-2 rounded-lg hover:bg-muted font-medium"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={createMut.isPending}
                                className="px-5 py-2.5 text-base bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 font-semibold"
                            >
                                {createMut.isPending ? "Membuat…" : "Buat RAB"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Customer picker overlay (di atas modal create RAB) */}
            {showCustomerPicker && (
                <CustomerPickerModal
                    onClose={() => setShowCustomerPicker(false)}
                    onPick={(c) => {
                        setForm((f) => ({ ...f, customer: c }));
                        setShowCustomerPicker(false);
                    }}
                />
            )}

            {/* Preview Modal */}
            {previewId !== null && (
                <RabPreviewModal rabId={previewId} onClose={() => setPreviewId(null)} />
            )}
        </div>
    );
}

/* ════════════════════════════════════════════════════════════════════════
 * VIEW MODE: LIST — Baris compact horizontal dengan thumbnail kecil.
 * Cocok untuk skim cepat banyak RAB sekaligus tanpa kehilangan info.
 * ══════════════════════════════════════════════════════════════════════ */

interface ListViewProps {
    rabs: RabPlan[];
    apiBase: string;
    onPreview: (id: number) => void;
    onUpload: (id: number) => void;
    onRemoveImage: (rab: RabPlan) => void;
    onDuplicate: (id: number) => void;
    onDelete: (rab: RabPlan) => void;
    onDownload: (rab: RabPlan) => void;
    uploadingId: number | null;
    downloadingId: number | null;
    computeTotalRab: (rab: RabPlan) => number;
    computeTotalCost: (rab: RabPlan) => number;
}

function RabListView({
    rabs,
    apiBase,
    onPreview,
    onUpload,
    onRemoveImage,
    onDuplicate,
    onDelete,
    onDownload,
    uploadingId,
    downloadingId,
    computeTotalRab,
    computeTotalCost,
}: ListViewProps) {
    return (
        <div className="space-y-2">
            {rabs.map((rab) => {
                const totalRab = computeTotalRab(rab);
                const totalCost = computeTotalCost(rab);
                const selisih = totalRab - totalCost;
                const isUntung = selisih >= 0;
                const status = getRabEventStatus(rab);
                const meta = STATUS_META[status];
                const StatusIcon = meta.icon;
                const days = daysFrom(rab, status);
                const tags = parseRabTags(rab.tags);
                // Saldo bersih (income riil - cost)
                const totalIncome =
                    (parseFloat(rab.dpAmount as any) || 0) +
                    (parseFloat(rab.pelunasan as any) || 0) +
                    (parseFloat(rab.incomeOther as any) || 0);
                const saldoBersih = totalIncome - totalCost;
                const dpV = parseFloat(rab.dpAmount as any) || 0;
                const pelV = parseFloat(rab.pelunasan as any) || 0;
                const payStatus =
                    totalIncome === 0 ? { label: "Belum bayar", cls: "bg-muted text-muted-foreground border-border" }
                        : pelV > 0 ? { label: "Lunas", cls: "bg-success/15 text-success border-success/30" }
                        : dpV > 0 ? { label: "Baru DP", cls: "bg-warning/15 text-warning border-warning/30" }
                        : { label: "Income lain", cls: "bg-info/15 text-info border-info/30" };

                return (
                    <div
                        key={rab.id}
                        className={`flex items-stretch gap-3 bg-card border-l-4 ${meta.border} border-y border-r rounded-lg overflow-hidden hover:shadow-md transition-shadow`}
                    >
                        {/* Thumbnail kecil */}
                        <button
                            onClick={() => onPreview(rab.id)}
                            className="shrink-0 w-20 sm:w-28 bg-muted overflow-hidden hover:opacity-90"
                            title="Lihat detail"
                        >
                            {rab.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={`${apiBase}${rab.imageUrl}`}
                                    alt={rab.title}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/40 to-muted/20">
                                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                </div>
                            )}
                        </button>

                        {/* Info utama */}
                        <div className="flex-1 min-w-0 py-2.5 px-1 flex flex-col justify-center">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className="font-mono text-xs text-muted-foreground">{rab.code}</span>
                                <BrandBadge brand={rab.brand} size="xs" />
                                <span
                                    className={`inline-flex items-center gap-1 ${meta.bg} ${meta.text} text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.border}`}
                                >
                                    <StatusIcon className="h-3 w-3" />
                                    {meta.short}
                                </span>
                                {days && (
                                    <span className={`text-[10px] font-semibold ${meta.text}`}>· {days}</span>
                                )}
                            </div>
                            <h3 className="font-semibold text-base truncate">{rab.title}</h3>
                            {tags.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                    {tags.slice(0, 4).map((t) => (
                                        <span
                                            key={t}
                                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-info/15 text-info border border-info/30"
                                        >
                                            <TagIcon className="h-2.5 w-2.5" /> {t}
                                        </span>
                                    ))}
                                    {tags.length > 4 && (
                                        <span className="text-[10px] text-muted-foreground">+{tags.length - 4}</span>
                                    )}
                                </div>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                {rab.customer && (
                                    <span className="inline-flex items-center gap-1 truncate">
                                        <UserIcon className="h-3 w-3" />
                                        {rab.customer.name}
                                    </span>
                                )}
                                {rab.location && (
                                    <span className="inline-flex items-center gap-1 truncate">
                                        <MapPin className="h-3 w-3" />
                                        {rab.location}
                                    </span>
                                )}
                                {(rab.periodStart || rab.periodEnd) && (
                                    <span className="inline-flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {fmtDate(rab.periodStart)}
                                        {rab.periodEnd && <> → {fmtDate(rab.periodEnd)}</>}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Angka — disembunyikan di mobile */}
                        <div className="hidden md:flex flex-col justify-center items-end px-3 text-xs min-w-[140px]">
                            <div className="text-muted-foreground">RAB</div>
                            <div className="font-mono nums font-semibold">{fmtRp(totalRab)}</div>
                            <div className="text-muted-foreground mt-1">Cost</div>
                            <div className="font-mono nums">{fmtRp(totalCost)}</div>
                        </div>

                        {/* Selisih + Saldo Bersih + Payment Status */}
                        <div className="hidden sm:flex flex-col justify-center items-end px-3 min-w-[160px] gap-1">
                            <div className="flex items-center gap-1.5">
                                <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${isUntung ? "bg-success/15 text-success" : "bg-destructive/12 text-destructive"}`}>
                                    {isUntung ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                    Selisih
                                </span>
                                <span className={`font-mono nums font-semibold text-xs ${isUntung ? "text-success" : "text-destructive"}`}>
                                    {isUntung ? "+" : "−"}{fmtRp(Math.abs(selisih))}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5" title="Saldo Bersih: pendapatan riil masuk − total cost">
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-foreground inline-flex items-center gap-0.5">
                                    <Wallet className="h-2.5 w-2.5" /> Saldo
                                </span>
                                <span className={`font-mono nums text-xs ${
                                    totalIncome === 0 ? "text-muted-foreground"
                                        : saldoBersih >= 0 ? "text-success" : "text-warning"
                                }`}>
                                    {totalIncome === 0 ? "—" : `${saldoBersih >= 0 ? "+" : "−"}${fmtRp(Math.abs(saldoBersih))}`}
                                </span>
                            </div>
                            <span className={`inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded border ${payStatus.cls}`}>
                                {payStatus.label}
                            </span>
                        </div>

                        {/* Action icons */}
                        <div className="flex items-center gap-0.5 px-2">
                            <Link
                                href={`/rab/${rab.id}`}
                                className="p-2 rounded-md hover:bg-info/10 text-info"
                                title="Buka detail"
                            >
                                <Eye className="h-4 w-4" />
                            </Link>
                            <Link
                                href={`/rab/${rab.id}`}
                                className="p-2 rounded-md hover:bg-warning/10 text-warning hidden sm:inline-flex"
                                title="Edit"
                            >
                                <Pencil className="h-4 w-4" />
                            </Link>
                            <button
                                onClick={() => onDownload(rab)}
                                disabled={downloadingId === rab.id}
                                className="p-2 rounded-md hover:bg-success/10 text-success disabled:opacity-50 hidden sm:inline-flex"
                                title="Download Excel"
                            >
                                {downloadingId === rab.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <FileSpreadsheet className="h-4 w-4" />
                                )}
                            </button>
                            <button
                                onClick={() => onUpload(rab.id)}
                                disabled={uploadingId === rab.id}
                                className="p-2 rounded-md hover:bg-muted text-muted-foreground disabled:opacity-50 hidden md:inline-flex"
                                title={rab.imageUrl ? "Ganti foto" : "Upload foto"}
                            >
                                {uploadingId === rab.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <ImageIcon className="h-4 w-4" />
                                )}
                            </button>
                            {rab.imageUrl && (
                                <button
                                    onClick={() => onRemoveImage(rab)}
                                    className="p-2 rounded-md hover:bg-destructive/10 text-destructive hidden md:inline-flex"
                                    title="Hapus foto"
                                >
                                    <ImageOff className="h-4 w-4" />
                                </button>
                            )}
                            <button
                                onClick={() => onDuplicate(rab.id)}
                                className="p-2 rounded-md hover:bg-muted text-muted-foreground hidden md:inline-flex"
                                title="Salin"
                            >
                                <Copy className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => onDelete(rab)}
                                className="p-2 rounded-md hover:bg-destructive/10 text-destructive"
                                title="Hapus"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ════════════════════════════════════════════════════════════════════════
 * VIEW MODE: DETAILS — Tabel padat dengan kolom sortable.
 * Cocok untuk audit cepat & bandingkan banyak RAB.
 * ══════════════════════════════════════════════════════════════════════ */

type SortKey = "code" | "title" | "customer" | "period" | "status" | "totalRab" | "totalCost" | "selisih" | "saldo";
type SortDir = "asc" | "desc";

interface DetailsViewProps {
    rabs: RabPlan[];
    onPreview: (id: number) => void;
    onRemoveImage: (rab: RabPlan) => void;
    onDelete: (rab: RabPlan) => void;
    onDownload: (rab: RabPlan) => void;
    downloadingId: number | null;
    computeTotalRab: (rab: RabPlan) => number;
    computeTotalCost: (rab: RabPlan) => number;
}

function RabDetailsView({
    rabs,
    onPreview,
    onRemoveImage,
    onDelete,
    onDownload,
    downloadingId,
    computeTotalRab,
    computeTotalCost,
}: DetailsViewProps) {
    const [sortKey, setSortKey] = useState<SortKey>("code");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    const sorted = useMemo(() => {
        const copy = [...rabs];
        const STATUS_ORDER: Record<EventStatus, number> = {
            ONGOING: 1, UPCOMING: 2, FINISHED: 3, REPORT_DONE: 4, NO_DATE: 5,
        };
        copy.sort((a, b) => {
            const dir = sortDir === "asc" ? 1 : -1;
            switch (sortKey) {
                case "code":
                    return a.code.localeCompare(b.code) * dir;
                case "title":
                    return a.title.localeCompare(b.title) * dir;
                case "customer":
                    return ((a.customer?.name ?? "") || "").localeCompare(b.customer?.name ?? "") * dir;
                case "period": {
                    const av = a.periodStart ? new Date(a.periodStart).getTime() : 0;
                    const bv = b.periodStart ? new Date(b.periodStart).getTime() : 0;
                    return (av - bv) * dir;
                }
                case "status":
                    return (STATUS_ORDER[getRabEventStatus(a)] - STATUS_ORDER[getRabEventStatus(b)]) * dir;
                case "totalRab":
                    return (computeTotalRab(a) - computeTotalRab(b)) * dir;
                case "totalCost":
                    return (computeTotalCost(a) - computeTotalCost(b)) * dir;
                case "selisih": {
                    const sa = computeTotalRab(a) - computeTotalCost(a);
                    const sb = computeTotalRab(b) - computeTotalCost(b);
                    return (sa - sb) * dir;
                }
                case "saldo": {
                    const incA = (parseFloat(a.dpAmount as any) || 0) + (parseFloat(a.pelunasan as any) || 0) + (parseFloat(a.incomeOther as any) || 0);
                    const incB = (parseFloat(b.dpAmount as any) || 0) + (parseFloat(b.pelunasan as any) || 0) + (parseFloat(b.incomeOther as any) || 0);
                    const sa = incA - computeTotalCost(a);
                    const sb = incB - computeTotalCost(b);
                    return (sa - sb) * dir;
                }
            }
        });
        return copy;
    }, [rabs, sortKey, sortDir, computeTotalRab, computeTotalCost]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir(key === "code" || key === "totalRab" || key === "selisih" ? "desc" : "asc");
        }
    };

    const SortIndicator = ({ k }: { k: SortKey }) =>
        sortKey === k ? <span className="ml-1 text-xs">{sortDir === "asc" ? "▲" : "▼"}</span> : null;

    return (
        <div className="rounded-xl border-2 border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                            <Th onClick={() => toggleSort("code")}>
                                Kode<SortIndicator k="code" />
                            </Th>
                            <th className="px-3 py-2.5 text-left font-semibold">Brand</th>
                            <Th onClick={() => toggleSort("title")}>
                                Judul<SortIndicator k="title" />
                            </Th>
                            <th className="px-3 py-2.5 text-left font-semibold">Tag</th>
                            <Th onClick={() => toggleSort("customer")}>
                                Klien<SortIndicator k="customer" />
                            </Th>
                            <Th onClick={() => toggleSort("status")}>
                                Status<SortIndicator k="status" />
                            </Th>
                            <Th onClick={() => toggleSort("period")}>
                                Periode<SortIndicator k="period" />
                            </Th>
                            <Th onClick={() => toggleSort("totalRab")} align="right">
                                Total RAB<SortIndicator k="totalRab" />
                            </Th>
                            <Th onClick={() => toggleSort("totalCost")} align="right">
                                Total Cost<SortIndicator k="totalCost" />
                            </Th>
                            <Th onClick={() => toggleSort("selisih")} align="right">
                                Selisih<SortIndicator k="selisih" />
                            </Th>
                            <Th onClick={() => toggleSort("saldo")} align="right">
                                Saldo Bersih<SortIndicator k="saldo" />
                            </Th>
                            <th className="px-3 py-2.5 text-center w-[120px]">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((rab) => {
                            const totalRab = computeTotalRab(rab);
                            const totalCost = computeTotalCost(rab);
                            const selisih = totalRab - totalCost;
                            const isUntung = selisih >= 0;
                            const status = getRabEventStatus(rab);
                            const meta = STATUS_META[status];
                            const StatusIcon = meta.icon;
                            const rowTags = parseRabTags(rab.tags);
                            const rowIncome = (parseFloat(rab.dpAmount as any) || 0) + (parseFloat(rab.pelunasan as any) || 0) + (parseFloat(rab.incomeOther as any) || 0);
                            const rowSaldo = rowIncome - totalCost;
                            const rowDp = parseFloat(rab.dpAmount as any) || 0;
                            const rowPel = parseFloat(rab.pelunasan as any) || 0;
                            const payLabel =
                                rowIncome === 0 ? null
                                    : rowPel > 0 ? "Lunas"
                                    : rowDp > 0 ? "Baru DP"
                                    : "Lain";
                            return (
                                <tr
                                    key={rab.id}
                                    className="border-t border-border hover:bg-info/5"
                                >
                                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{rab.code}</td>
                                    <td className="px-3 py-2.5"><BrandBadge brand={rab.brand} size="xs" /></td>
                                    <td className="px-3 py-2.5 max-w-[280px]">
                                        <Link
                                            href={`/rab/${rab.id}`}
                                            className="font-semibold text-foreground hover:text-info hover:underline truncate block"
                                        >
                                            {rab.title}
                                        </Link>
                                        {rab.location && (
                                            <span className="text-xs text-muted-foreground truncate block">
                                                <MapPin className="h-3 w-3 inline mr-0.5" />
                                                {rab.location}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 max-w-[180px]">
                                        {rowTags.length === 0 ? (
                                            <span className="text-muted-foreground italic text-xs">—</span>
                                        ) : (
                                            <div className="flex flex-wrap gap-0.5">
                                                {rowTags.slice(0, 3).map((t) => (
                                                    <span key={t} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-info/15 text-info border border-info/30">
                                                        {t}
                                                    </span>
                                                ))}
                                                {rowTags.length > 3 && (
                                                    <span className="text-[10px] text-muted-foreground self-center">+{rowTags.length - 3}</span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-xs">
                                        {rab.customer ? (
                                            <>
                                                <div className="font-medium text-foreground truncate">{rab.customer.name}</div>
                                                {rab.customer.companyName && (
                                                    <div className="text-muted-foreground truncate">
                                                        {rab.customer.companyName}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-muted-foreground italic">—</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <span
                                            className={`inline-flex items-center gap-1 ${meta.bg} ${meta.text} text-[11px] font-bold px-2 py-0.5 rounded-full border ${meta.border}`}
                                        >
                                            <StatusIcon className="h-3 w-3" />
                                            {meta.short}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                                        {rab.periodStart ? (
                                            <>
                                                {fmtDate(rab.periodStart)}
                                                {rab.periodEnd && (
                                                    <>
                                                        <br />
                                                        <span>→ {fmtDate(rab.periodEnd)}</span>
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-mono nums text-xs">{fmtRp(totalRab)}</td>
                                    <td className="px-3 py-2.5 text-right font-mono nums text-xs text-muted-foreground">
                                        {fmtRp(totalCost)}
                                    </td>
                                    <td
                                        className={`px-3 py-2.5 text-right font-mono nums text-xs font-bold ${isUntung ? "text-success" : "text-destructive"
                                            }`}
                                    >
                                        {isUntung ? "+" : "−"}
                                        {fmtRp(Math.abs(selisih))}
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        {rowIncome === 0 ? (
                                            <div className="text-xs text-muted-foreground italic">Belum bayar</div>
                                        ) : (
                                            <>
                                                <div className={`font-mono nums text-xs font-bold ${rowSaldo >= 0 ? "text-success" : "text-warning"}`}>
                                                    {rowSaldo >= 0 ? "+" : "−"}{fmtRp(Math.abs(rowSaldo))}
                                                </div>
                                                {payLabel && (
                                                    <div className={`inline-flex items-center gap-0.5 text-[9px] font-semibold mt-0.5 ${
                                                        payLabel === "Lunas" ? "text-success"
                                                            : payLabel === "Baru DP" ? "text-warning"
                                                            : "text-info"
                                                    }`}>
                                                        {payLabel === "Lunas" ? <CheckCircle2 className="h-2.5 w-2.5" /> : payLabel === "Baru DP" ? <AlertTriangle className="h-2.5 w-2.5" /> : <Info className="h-2.5 w-2.5" />} {payLabel}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center justify-center gap-0.5">
                                            <button
                                                onClick={() => onPreview(rab.id)}
                                                className="p-1.5 rounded hover:bg-info/10 text-info"
                                                title="Preview"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                            </button>
                                            <Link
                                                href={`/rab/${rab.id}`}
                                                className="p-1.5 rounded hover:bg-warning/10 text-warning"
                                                title="Edit"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Link>
                                            <button
                                                onClick={() => onDownload(rab)}
                                                disabled={downloadingId === rab.id}
                                                className="p-1.5 rounded hover:bg-success/10 text-success disabled:opacity-50"
                                                title="Download Excel"
                                            >
                                                {downloadingId === rab.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <FileSpreadsheet className="h-3.5 w-3.5" />
                                                )}
                                            </button>
                                            {rab.imageUrl && (
                                                <button
                                                    onClick={() => onRemoveImage(rab)}
                                                    className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                                                    title="Hapus foto"
                                                >
                                                    <ImageOff className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => onDelete(rab)}
                                                className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                                                title="Hapus RAB"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Th({
    children,
    onClick,
    align = "left",
}: {
    children: React.ReactNode;
    onClick?: () => void;
    align?: "left" | "right";
}) {
    return (
        <th
            onClick={onClick}
            className={`px-3 py-2.5 ${align === "right" ? "text-right" : "text-left"} font-semibold ${onClick ? "cursor-pointer select-none hover:bg-muted" : ""
                }`}
        >
            {children}
        </th>
    );
}
