"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
} from "lucide-react";

type ViewMode = "card" | "list" | "details";
const VIEW_MODE_KEY = "pospro:rab-list:viewMode";

type EventStatus = "UPCOMING" | "ONGOING" | "FINISHED" | "NO_DATE";

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
        bg: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-300",
        bar: "bg-blue-500",
        icon: Clock,
    },
    ONGOING: {
        label: "Sedang Berjalan",
        short: "Berjalan",
        emoji: "🟢",
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-400",
        bar: "bg-emerald-500",
        icon: PlayCircle,
    },
    FINISHED: {
        label: "Selesai",
        short: "Selesai",
        emoji: "✅",
        bg: "bg-slate-50",
        text: "text-slate-600",
        border: "border-slate-300",
        bar: "bg-slate-400",
        icon: CheckCircle2,
    },
    NO_DATE: {
        label: "Tanpa Tanggal",
        short: "—",
        emoji: "❔",
        bg: "bg-amber-50",
        text: "text-amber-700",
        border: "border-amber-300",
        bar: "bg-amber-400",
        icon: CalendarOff,
    },
};

/** Tentukan status event berdasarkan periodStart/periodEnd vs sekarang. */
function getRabEventStatus(rab: RabPlan): EventStatus {
    const now = new Date();
    const start = rab.periodStart ? new Date(rab.periodStart) : null;
    const end = rab.periodEnd ? new Date(rab.periodEnd) : null;

    if (!start && !end) return "NO_DATE";
    // Jika hanya ada salah satu, anggap sama (event 1 hari)
    const s = start ?? end!;
    const e = end ?? start!;
    // Set ke akhir hari supaya event hari ini = ONGOING
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
                ? "bg-white text-blue-700 shadow-sm border border-blue-200"
                : "text-slate-600 hover:text-slate-900"
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
        slate: "bg-slate-700 text-white border-slate-700",
        emerald: "bg-emerald-600 text-white border-emerald-600",
        blue: "bg-blue-600 text-white border-blue-600",
        amber: "bg-amber-500 text-white border-amber-500",
    };
    const idleMap: Record<string, string> = {
        slate: "bg-white text-slate-700 border-slate-200 hover:border-slate-400",
        emerald: "bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400",
        blue: "bg-white text-blue-700 border-blue-200 hover:border-blue-400",
        amber: "bg-white text-amber-700 border-amber-200 hover:border-amber-400",
    };
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 text-sm font-semibold transition ${active ? activeMap[color] : idleMap[color]
                }`}
        >
            <span>{label}</span>
            <span
                className={`text-[11px] font-mono font-bold px-1.5 rounded-full ${active ? "bg-white/20" : "bg-slate-100 text-slate-700"
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

export default function RabListPage() {
    const qc = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({
        title: "",
        projectName: "",
        location: "",
        periodStart: "",
        periodEnd: "",
    });
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<EventStatus | "ALL">("ALL");
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
            setForm({ title: "", projectName: "", location: "", periodStart: "", periodEnd: "" });
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
        });
    };

    // Hitung jumlah RAB per status (untuk badge di tab)
    const statusCounts = useMemo(() => {
        const acc: Record<EventStatus | "ALL", number> = {
            ALL: 0, UPCOMING: 0, ONGOING: 0, FINISHED: 0, NO_DATE: 0,
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
        if (!q) return list;
        return list.filter((r) => {
            const haystack = [
                r.code,
                r.title,
                r.projectName ?? "",
                r.location ?? "",
                r.customer?.name ?? "",
                r.customer?.companyName ?? "",
            ].join(" ").toLowerCase();
            return haystack.includes(q);
        });
    }, [rabs, search, statusFilter]);

    const computeTotalRab = (rab: RabPlan) =>
        (rab.items ?? []).reduce((acc, it) => {
            const q = typeof it.quantity === "string" ? parseFloat(it.quantity) : it.quantity;
            const p = typeof it.priceRab === "string" ? parseFloat(it.priceRab) : it.priceRab;
            return acc + (q || 0) * (p || 0);
        }, 0);

    const computeTotalCost = (rab: RabPlan) =>
        (rab.items ?? []).reduce((acc, it) => {
            const qSrc = it.quantityCost ?? it.quantity;
            const q = typeof qSrc === "string" ? parseFloat(qSrc) : qSrc;
            const p = typeof it.priceCost === "string" ? parseFloat(it.priceCost) : it.priceCost;
            return acc + (q || 0) * (p || 0);
        }, 0);

    return (
        <div className="p-4 lg:p-6 max-w-7xl mx-auto">
            {/* ─── Header — Lebih lega, bahasa sederhana ─── */}
            <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold">📋 RAB — Anggaran Proyek</h1>
                    <p className="text-base text-muted-foreground mt-1">
                        Daftar perhitungan biaya untuk setiap proyek booth atau event.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-lg hover:opacity-90 shadow-sm shrink-0 text-base font-semibold"
                >
                    <Plus className="h-5 w-5" />
                    Buat RAB Baru
                </button>
            </div>

            {/* ─── Search bar — input lebih besar ─── */}
            <div className="mb-6 flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[280px] max-w-xl">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari RAB... (kode, judul, klien, atau lokasi)"
                        className="w-full pl-12 pr-12 py-3 text-base rounded-lg border-2 border-border bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-muted"
                            aria-label="Bersihkan pencarian"
                        >
                            <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                    )}
                </div>
                {search && (
                    <span className="text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                        Ditemukan <strong>{filteredRabs.length}</strong> dari {rabs?.length ?? 0} RAB
                    </span>
                )}
            </div>

            {/* ─── Filter Tab Status Event + View Mode Toggle ─── */}
            <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-600 mr-1">Status:</span>
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
                    label="🟢 Berjalan"
                    count={statusCounts.ONGOING}
                    color="emerald"
                />
                <StatusTab
                    active={statusFilter === "UPCOMING"}
                    onClick={() => setStatusFilter("UPCOMING")}
                    label="📅 Akan Datang"
                    count={statusCounts.UPCOMING}
                    color="blue"
                />
                <StatusTab
                    active={statusFilter === "FINISHED"}
                    onClick={() => setStatusFilter("FINISHED")}
                    label="✅ Selesai"
                    count={statusCounts.FINISHED}
                    color="slate"
                />
                {statusCounts.NO_DATE > 0 && (
                    <StatusTab
                        active={statusFilter === "NO_DATE"}
                        onClick={() => setStatusFilter("NO_DATE")}
                        label="❔ Tanpa Tanggal"
                        count={statusCounts.NO_DATE}
                        color="amber"
                    />
                )}
                </div>

                {/* View mode toggle (Card / List / Details) */}
                <div className="inline-flex items-center gap-0.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
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
                <div className="border-2 border-dashed rounded-xl p-12 text-center">
                    <div className="text-5xl mb-4">📋</div>
                    <h3 className="text-xl font-semibold mb-2">Belum Ada RAB</h3>
                    <p className="text-muted-foreground mb-4">
                        Klik tombol di atas untuk membuat RAB pertama Anda.
                    </p>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg"
                    >
                        <Plus className="h-4 w-4" /> Buat RAB Pertama
                    </button>
                </div>
            ) : filteredRabs.length === 0 ? (
                <div className="border-2 border-dashed rounded-xl p-12 text-center">
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
                                    <button
                                        onClick={() => setPreviewId(rab.id)}
                                        className="relative aspect-[16/9] w-full bg-muted overflow-hidden hover:opacity-95 transition-opacity"
                                        title="Klik untuk lihat detail"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={`${apiBase}${rab.imageUrl}`}
                                            alt={rab.title}
                                            className="w-full h-full object-cover"
                                        />
                                        <span className="absolute top-2 left-2 bg-black/60 text-white text-xs font-mono px-2 py-1 rounded">
                                            {rab.code}
                                        </span>
                                        <span
                                            className={`absolute top-2 right-2 inline-flex items-center gap-1 ${statusMeta.bg} ${statusMeta.text} text-xs font-bold px-2.5 py-1 rounded-full border ${statusMeta.border} shadow-sm`}
                                        >
                                            <StatusIcon className="h-3.5 w-3.5" />
                                            {statusMeta.short}
                                        </span>
                                    </button>
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
                                <div className="p-4 flex-1 flex flex-col">
                                    {/* Judul + Untung/Rugi badge */}
                                    <div className="mb-3">
                                        <h2 className="text-lg font-bold text-foreground leading-tight">
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

                                    {/* Untung/Rugi banner — paling visible */}
                                    <div
                                        className={`rounded-lg p-3 mb-3 border-2 ${
                                            isUntung
                                                ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                                                : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                {isUntung ? (
                                                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                ) : (
                                                    <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                                                )}
                                                <span
                                                    className={`text-sm font-semibold ${
                                                        isUntung ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"
                                                    }`}
                                                >
                                                    {isUntung ? "Untung" : "Rugi"}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <div
                                                    className={`text-lg font-bold font-mono ${
                                                        isUntung ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
                                                    }`}
                                                >
                                                    {fmtRp(Math.abs(selisih))}
                                                </div>
                                                <div
                                                    className={`text-xs ${
                                                        isUntung ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                                    }`}
                                                >
                                                    {totalRab > 0 ? `${margin.toFixed(0)}% margin` : ""}
                                                </div>
                                            </div>
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
                                            <span className="text-muted-foreground">Harga ke Klien</span>
                                            <span className="font-mono font-semibold">{fmtRp(totalRab)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Biaya Modal</span>
                                            <span className="font-mono text-muted-foreground">{fmtRp(totalCost)}</span>
                                        </div>
                                    </div>

                                    {/* Spacer agar action bar selalu di bawah */}
                                    <div className="flex-1" />

                                    {/* Action Buttons — dengan label text, lebih jelas */}
                                    <div className="grid grid-cols-3 gap-2 mb-2">
                                        <button
                                            onClick={() => setPreviewId(rab.id)}
                                            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-sm font-medium transition-colors dark:bg-blue-950/30 dark:hover:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800"
                                            title="Lihat detail RAB tanpa membuka editor"
                                        >
                                            <Eye className="h-4 w-4" />
                                            <span>Lihat</span>
                                        </button>
                                        <Link
                                            href={`/rab/${rab.id}`}
                                            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-sm font-medium transition-colors dark:bg-amber-950/30 dark:hover:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                                            title="Edit isi RAB ini"
                                        >
                                            <Pencil className="h-4 w-4" />
                                            <span>Edit</span>
                                        </Link>
                                        <button
                                            onClick={() => handleDownloadXlsx(rab)}
                                            disabled={downloadingId === rab.id}
                                            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-sm font-medium transition-colors disabled:opacity-50 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
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

                                    {/* Aksi tambahan — lebih kecil, di-grup */}
                                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleSelectImageFor(rab.id)}
                                                disabled={uploadingId === rab.id}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                                                title={rab.imageUrl ? "Ganti foto" : "Upload foto"}
                                            >
                                                {uploadingId === rab.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <ImageIcon className="h-3 w-3" />
                                                )}
                                                <span>{rab.imageUrl ? "Ganti Foto" : "Upload Foto"}</span>
                                            </button>
                                            {rab.imageUrl && (
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Hapus foto RAB ${rab.code}?`)) removeImageMut.mutate(rab.id);
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                                    title="Hapus foto"
                                                >
                                                    <ImageOff className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => duplicateMut.mutate(rab.id)}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                                title="Salin RAB ini sebagai RAB baru"
                                            >
                                                <Copy className="h-3 w-3" />
                                                <span>Salin</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Hapus RAB ${rab.code} (${rab.title})?\nAksi ini tidak bisa di-undo.`)) {
                                                        deleteMut.mutate(rab.id);
                                                    }
                                                }}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                                title="Hapus RAB"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                                <span>Hapus</span>
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
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setShowCreate(false)}
                >
                    <form
                        onSubmit={handleSubmit}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-background rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
                    >
                        <div>
                            <h2 className="text-xl font-bold">Buat RAB Baru</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Isi info dasar dulu — detail item bisa diisi nanti.
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-semibold block mb-1.5">
                                Judul Proyek <span className="text-red-500">*</span>
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
                                Nama Klien / Project
                                <span className="text-xs font-normal text-muted-foreground ml-1">(opsional)</span>
                            </label>
                            <input
                                type="text"
                                value={form.projectName}
                                onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                                className="w-full border-2 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                                placeholder="PT JAPURA, dll"
                            />
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
                            <div className="font-mono font-semibold">{fmtRp(totalRab)}</div>
                            <div className="text-muted-foreground mt-1">Cost</div>
                            <div className="font-mono">{fmtRp(totalCost)}</div>
                        </div>

                        {/* Untung/Rugi badge */}
                        <div className="hidden sm:flex flex-col justify-center items-end px-3 min-w-[120px]">
                            <div
                                className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${isUntung
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-red-100 text-red-700"
                                    }`}
                            >
                                {isUntung ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {isUntung ? "Untung" : "Rugi"}
                            </div>
                            <div className="font-mono font-semibold text-sm mt-0.5">
                                {fmtRp(Math.abs(selisih))}
                            </div>
                        </div>

                        {/* Action icons */}
                        <div className="flex items-center gap-0.5 px-2">
                            <Link
                                href={`/rab/${rab.id}`}
                                className="p-2 rounded-md hover:bg-blue-50 text-blue-600"
                                title="Buka detail"
                            >
                                <Eye className="h-4 w-4" />
                            </Link>
                            <Link
                                href={`/rab/${rab.id}`}
                                className="p-2 rounded-md hover:bg-amber-50 text-amber-600 hidden sm:inline-flex"
                                title="Edit"
                            >
                                <Pencil className="h-4 w-4" />
                            </Link>
                            <button
                                onClick={() => onDownload(rab)}
                                disabled={downloadingId === rab.id}
                                className="p-2 rounded-md hover:bg-emerald-50 text-emerald-600 disabled:opacity-50 hidden sm:inline-flex"
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
                                title="Upload foto"
                            >
                                {uploadingId === rab.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <ImageIcon className="h-4 w-4" />
                                )}
                            </button>
                            <button
                                onClick={() => onDuplicate(rab.id)}
                                className="p-2 rounded-md hover:bg-muted text-muted-foreground hidden md:inline-flex"
                                title="Salin"
                            >
                                <Copy className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => onDelete(rab)}
                                className="p-2 rounded-md hover:bg-red-50 text-red-600"
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

type SortKey = "code" | "title" | "customer" | "period" | "status" | "totalRab" | "totalCost" | "selisih";
type SortDir = "asc" | "desc";

interface DetailsViewProps {
    rabs: RabPlan[];
    onPreview: (id: number) => void;
    onDelete: (rab: RabPlan) => void;
    onDownload: (rab: RabPlan) => void;
    downloadingId: number | null;
    computeTotalRab: (rab: RabPlan) => number;
    computeTotalCost: (rab: RabPlan) => number;
}

function RabDetailsView({
    rabs,
    onPreview,
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
            ONGOING: 1, UPCOMING: 2, FINISHED: 3, NO_DATE: 4,
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
        <div className="rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                        <tr>
                            <Th onClick={() => toggleSort("code")}>
                                Kode<SortIndicator k="code" />
                            </Th>
                            <Th onClick={() => toggleSort("title")}>
                                Judul<SortIndicator k="title" />
                            </Th>
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
                                Margin<SortIndicator k="selisih" />
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
                            return (
                                <tr
                                    key={rab.id}
                                    className="border-t border-slate-100 hover:bg-blue-50/30"
                                >
                                    <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{rab.code}</td>
                                    <td className="px-3 py-2.5 max-w-[280px]">
                                        <Link
                                            href={`/rab/${rab.id}`}
                                            className="font-semibold text-slate-900 hover:text-blue-700 hover:underline truncate block"
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
                                    <td className="px-3 py-2.5 text-xs">
                                        {rab.customer ? (
                                            <>
                                                <div className="font-medium text-slate-800 truncate">{rab.customer.name}</div>
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
                                    <td className="px-3 py-2.5 text-right font-mono text-xs">{fmtRp(totalRab)}</td>
                                    <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">
                                        {fmtRp(totalCost)}
                                    </td>
                                    <td
                                        className={`px-3 py-2.5 text-right font-mono text-xs font-bold ${isUntung ? "text-emerald-700" : "text-red-700"
                                            }`}
                                    >
                                        {isUntung ? "+" : "−"}
                                        {fmtRp(Math.abs(selisih))}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center justify-center gap-0.5">
                                            <button
                                                onClick={() => onPreview(rab.id)}
                                                className="p-1.5 rounded hover:bg-blue-50 text-blue-600"
                                                title="Preview"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                            </button>
                                            <Link
                                                href={`/rab/${rab.id}`}
                                                className="p-1.5 rounded hover:bg-amber-50 text-amber-600"
                                                title="Edit"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Link>
                                            <button
                                                onClick={() => onDownload(rab)}
                                                disabled={downloadingId === rab.id}
                                                className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600 disabled:opacity-50"
                                                title="Download Excel"
                                            >
                                                {downloadingId === rab.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <FileSpreadsheet className="h-3.5 w-3.5" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => onDelete(rab)}
                                                className="p-1.5 rounded hover:bg-red-50 text-red-600"
                                                title="Hapus"
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
            className={`px-3 py-2.5 ${align === "right" ? "text-right" : "text-left"} font-semibold ${onClick ? "cursor-pointer select-none hover:bg-slate-100" : ""
                }`}
        >
            {children}
        </th>
    );
}
