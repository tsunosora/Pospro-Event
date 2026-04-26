"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
    ArrowLeft, CalendarDays, Edit, Loader2, MapPin, Package,
    User as UserIcon, Boxes, Share2, FileDown, Send, Copy, RefreshCw,
} from "lucide-react";
import {
    getEvent, getEventSummary, createEventShare, regenerateEventShare,
    sendEventWhatsapp, exportEventPdfUrl,
    type EventBrand, type EventStatus,
} from "@/lib/api/events";
import PackingListTab from "./PackingListTab";
import CrewTab from "./CrewTab";
import ProfitTab from "./ProfitTab";

const STATUS_CFG: Record<EventStatus, { label: string; cls: string }> = {
    DRAFT: { label: "Draft", cls: "bg-gray-100 text-gray-700" },
    SCHEDULED: { label: "Terjadwal", cls: "bg-blue-50 text-blue-700" },
    IN_PROGRESS: { label: "Berlangsung", cls: "bg-amber-50 text-amber-700" },
    COMPLETED: { label: "Selesai", cls: "bg-green-50 text-green-700" },
    CANCELLED: { label: "Dibatalkan", cls: "bg-red-50 text-red-700" },
};
const BRAND_CFG: Record<EventBrand, { label: string; cls: string }> = {
    EXINDO: { label: "CV. Exindo", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    XPOSER: { label: "CV. Xposer", cls: "bg-pink-50 text-pink-700 border-pink-200" },
    OTHER: { label: "Lain", cls: "bg-gray-50 text-gray-700 border-gray-200" },
};

function fmtDateTime(d: string | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleString("id-ID", {
        dateStyle: "medium", timeStyle: "short",
    });
}

function fmtDate(d: string | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("id-ID", {
        day: "numeric", month: "short", year: "numeric",
    });
}

export default function EventDetailPage() {
    const params = useParams<{ id: string }>();
    const id = Number(params.id);
    const [tab, setTab] = useState<"info" | "packing" | "crew" | "profit" | "items" | "withdrawals">("info");
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [shareOpen, setShareOpen] = useState(false);
    const [waTarget, setWaTarget] = useState("");
    const [waStatus, setWaStatus] = useState<string | null>(null);

    const buildShareUrl = (token: string) =>
        (typeof window !== "undefined" ? window.location.origin : "") + `/share/events/${token}`;

    const shareMut = useMutation({
        mutationFn: () => createEventShare(id),
        onSuccess: (d) => setShareUrl(buildShareUrl(d.token)),
    });
    const regenMut = useMutation({
        mutationFn: () => regenerateEventShare(id),
        onSuccess: (d) => setShareUrl(buildShareUrl(d.token)),
    });
    const waMut = useMutation({
        mutationFn: (target: string) =>
            sendEventWhatsapp(id, {
                target,
                includeLink: true,
                shareBaseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
            }),
        onSuccess: () => setWaStatus("✅ Pesan WA terkirim"),
        onError: (e: any) => setWaStatus(e?.response?.data?.message || "Gagal kirim WA"),
    });

    const openShare = async () => {
        setShareOpen(true);
        if (!shareUrl) shareMut.mutate();
    };
    const copyShare = () => {
        if (shareUrl) navigator.clipboard.writeText(shareUrl);
    };

    const { data: ev, isLoading } = useQuery({
        queryKey: ["event", id],
        queryFn: () => getEvent(id),
        enabled: Number.isFinite(id),
    });

    const { data: summary } = useQuery({
        queryKey: ["event-summary", id],
        queryFn: () => getEventSummary(id),
        enabled: Number.isFinite(id),
    });

    if (isLoading || !ev) {
        return <div className="text-sm text-muted-foreground py-10 text-center"><Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Memuat…</div>;
    }

    const brand = BRAND_CFG[ev.brand];
    const status = STATUS_CFG[ev.status];

    return (
        <div className="space-y-4">
            <div className="flex items-center flex-wrap gap-2">
                <Link href="/events" className="p-1.5 hover:bg-muted rounded">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" /> {ev.name}
                </h1>
                <span className="font-mono text-xs text-muted-foreground">{ev.code}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${brand.cls}`}>{brand.label}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${status.cls}`}>{status.label}</span>
                <div className="ml-auto flex items-center gap-2 flex-wrap">
                    <button
                        onClick={openShare}
                        className="inline-flex items-center gap-1.5 border px-3 py-1.5 rounded text-sm hover:bg-muted"
                    >
                        <Share2 className="h-3.5 w-3.5" /> Share
                    </button>
                    <a
                        href={exportEventPdfUrl(id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 border px-3 py-1.5 rounded text-sm hover:bg-muted"
                    >
                        <FileDown className="h-3.5 w-3.5" /> PDF
                    </a>
                    <Link
                        href={`/events/${id}/edit`}
                        className="inline-flex items-center gap-1.5 border px-3 py-1.5 rounded text-sm hover:bg-muted"
                    >
                        <Edit className="h-3.5 w-3.5" /> Edit
                    </Link>
                </div>
            </div>

            {shareOpen && (
                <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Share2 className="h-4 w-4 text-primary" />
                        <div className="text-sm font-semibold">Bagikan jadwal</div>
                        <button
                            onClick={() => setShareOpen(false)}
                            className="ml-auto text-xs text-muted-foreground hover:underline"
                        >
                            Tutup
                        </button>
                    </div>

                    <div>
                        <div className="text-xs font-medium mb-1">Link publik (view-only)</div>
                        <div className="flex items-center gap-1.5">
                            <input
                                readOnly
                                value={shareUrl ?? (shareMut.isPending ? "Membuat link…" : "")}
                                className="flex-1 border rounded px-2 py-1 text-xs bg-white font-mono"
                                placeholder="Link akan muncul di sini"
                            />
                            <button
                                onClick={copyShare}
                                disabled={!shareUrl}
                                className="inline-flex items-center gap-1 border px-2 py-1 rounded text-xs hover:bg-muted disabled:opacity-50"
                            >
                                <Copy className="h-3 w-3" /> Salin
                            </button>
                            <button
                                onClick={() => {
                                    if (confirm("Regenerate akan membatalkan link lama. Lanjut?")) regenMut.mutate();
                                }}
                                disabled={regenMut.isPending || !shareUrl}
                                className="inline-flex items-center gap-1 border px-2 py-1 rounded text-xs hover:bg-muted disabled:opacity-50"
                            >
                                {regenMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                Regenerate
                            </button>
                        </div>
                    </div>

                    <div>
                        <div className="text-xs font-medium mb-1">Kirim via WhatsApp (ke PIC / grup)</div>
                        <div className="flex items-center gap-1.5">
                            <input
                                value={waTarget}
                                onChange={(e) => setWaTarget(e.target.value)}
                                placeholder="No HP (08xx / 628xx) atau ID grup (xxxx@g.us)"
                                className="flex-1 border rounded px-2 py-1 text-xs bg-white"
                            />
                            <button
                                onClick={() => {
                                    setWaStatus(null);
                                    if (waTarget.trim()) waMut.mutate(waTarget.trim());
                                }}
                                disabled={waMut.isPending || !waTarget.trim()}
                                className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1 rounded text-xs hover:opacity-90 disabled:opacity-50"
                            >
                                {waMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                                Kirim
                            </button>
                        </div>
                        {waStatus && <div className="text-xs mt-1">{waStatus}</div>}
                        <div className="text-[10px] text-muted-foreground mt-1">
                            Bot WhatsApp harus terhubung. Pesan berisi ringkasan jadwal + link share.
                        </div>
                    </div>
                </div>
            )}

            <div className="inline-flex border rounded overflow-hidden text-sm">
                {([
                    { k: "info", label: "Info" },
                    { k: "packing", label: "Packing List" },
                    { k: "crew", label: "Crew" },
                    { k: "profit", label: "💰 Profit" },
                    { k: "items", label: "Ringkasan Barang" },
                    { k: "withdrawals", label: `Pengeluaran (${ev.withdrawals.length})` },
                ] as const).map((t) => (
                    <button
                        key={t.k}
                        onClick={() => setTab(t.k)}
                        className={`px-3 py-1.5 ${tab === t.k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === "info" && (
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-3 space-y-2 text-sm">
                        <div className="font-semibold text-xs text-muted-foreground mb-2">Info Event</div>
                        {ev.venue && <div className="flex gap-2"><MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /><div>{ev.venue}</div></div>}
                        <div><b>Klien:</b> {ev.customer?.name ?? ev.customerName ?? "—"}{ev.customer?.companyName ? ` (${ev.customer.companyName})` : ""}</div>
                        <div className="flex gap-2">
                            <UserIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div>
                                <b>PIC:</b> {ev.picWorker?.name ?? ev.picName ?? "—"}
                                {ev.picWorker?.position && <span className="text-xs text-muted-foreground"> ({ev.picWorker.position})</span>}
                            </div>
                        </div>
                        {ev.notes && (
                            <div className="border-t pt-2 mt-2">
                                <div className="text-xs font-semibold text-muted-foreground mb-1">Catatan</div>
                                <div className="text-sm whitespace-pre-line">{ev.notes}</div>
                            </div>
                        )}
                    </div>

                    <div className="border rounded-lg p-3 space-y-2 text-sm">
                        <div className="font-semibold text-xs text-muted-foreground mb-2">Jadwal Fase</div>
                        <PhaseRow label="Berangkat" cls="bg-yellow-100 border-yellow-300" a={ev.departureStart} b={ev.departureEnd} />
                        <PhaseRow label="Pasang" cls="bg-orange-100 border-orange-300" a={ev.setupStart} b={ev.setupEnd} />
                        <PhaseRow label="Loading Peserta" cls="bg-sky-100 border-sky-300" a={ev.loadingStart} b={ev.loadingEnd} />
                        <PhaseRow label="Event" cls="bg-emerald-100 border-emerald-300" a={ev.eventStart} b={ev.eventEnd} />
                    </div>
                </div>
            )}

            {tab === "packing" && <PackingListTab eventId={id} />}

            {tab === "crew" && <CrewTab eventId={id} />}

            {tab === "profit" && <ProfitTab eventId={id} />}

            {tab === "items" && (
                <div className="border rounded-lg overflow-hidden">
                    {!summary || summary.items.length === 0 ? (
                        <div className="p-10 text-center text-sm text-muted-foreground">
                            Belum ada barang yang tercatat untuk event ini.
                        </div>
                    ) : (
                        <>
                            <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3 bg-muted/30 text-sm border-b">
                                <Stat label="Pengeluaran" value={String(summary.totalWithdrawals)} />
                                <Stat label="Jenis Barang" value={String(summary.totalUniqueItems)} />
                                <Stat label="Total Qty" value={String(summary.totalQty)} />
                                <Stat label="Belum Kembali" value={String(summary.totalOutstanding)} />
                            </div>
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-left text-xs">
                                    <tr>
                                        <th className="p-2">Produk / SKU</th>
                                        <th className="p-2 w-20 text-right">Qty</th>
                                        <th className="p-2 w-20 text-right">Kembali</th>
                                        <th className="p-2 w-24 text-right">Outstanding</th>
                                        <th className="p-2 w-16 text-right">Pengambilan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.items.map((it) => (
                                        <tr key={it.productVariantId} className="border-t">
                                            <td className="p-2">
                                                <div className="text-sm">{it.productName}</div>
                                                <div className="text-[10px] text-muted-foreground font-mono">{it.sku}{it.variantName ? ` • ${it.variantName}` : ""}</div>
                                            </td>
                                            <td className="p-2 text-right font-mono text-xs">{it.totalQuantity}</td>
                                            <td className="p-2 text-right font-mono text-xs">{it.totalReturned}</td>
                                            <td className={`p-2 text-right font-mono text-xs ${it.outstanding > 0 ? "text-amber-600" : ""}`}>{it.outstanding}</td>
                                            <td className="p-2 text-right font-mono text-xs">{it.withdrawalCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>
            )}

            {tab === "withdrawals" && (
                <div className="border rounded-lg overflow-hidden">
                    {ev.withdrawals.length === 0 ? (
                        <div className="p-10 text-center text-sm text-muted-foreground">
                            Belum ada pengeluaran barang untuk event ini.
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-left text-xs">
                                <tr>
                                    <th className="p-2">Kode</th>
                                    <th className="p-2">Pekerja</th>
                                    <th className="p-2">Gudang</th>
                                    <th className="p-2">Tipe</th>
                                    <th className="p-2">Keperluan</th>
                                    <th className="p-2 w-16 text-right">Item</th>
                                    <th className="p-2">Tgl</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ev.withdrawals.map((w) => (
                                    <tr key={w.id} className="border-t hover:bg-muted/10">
                                        <td className="p-2 font-mono text-xs">{w.code}</td>
                                        <td className="p-2">{w.worker.name}</td>
                                        <td className="p-2 text-xs">{w.warehouse.name}</td>
                                        <td className="p-2">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${w.type === "BORROW" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                                                {w.type === "BORROW" ? "PINJAM" : "PAKAI"}
                                            </span>
                                        </td>
                                        <td className="p-2 text-xs truncate max-w-[200px]">{w.purpose}</td>
                                        <td className="p-2 text-right font-mono text-xs">{w.items.length}</td>
                                        <td className="p-2 text-xs">{fmtDate(w.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}

function PhaseRow({ label, cls, a, b }: { label: string; cls: string; a: string | null; b: string | null }) {
    return (
        <div className={`border rounded p-2 ${cls}`}>
            <div className="text-xs font-semibold flex items-center gap-1">
                <Package className="h-3 w-3" /> {label}
            </div>
            <div className="text-xs mt-0.5">
                {fmtDateTime(a)}
                {(a || b) && " → "}
                {fmtDateTime(b)}
            </div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-lg font-bold flex items-center gap-1.5">
                <Boxes className="h-4 w-4 text-muted-foreground" />
                {value}
            </div>
        </div>
    );
}
