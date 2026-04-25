"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
    Package, Clock, AlertTriangle, Check, Camera, Loader2, ArrowLeft,
    Plus, User as UserIcon, CheckCheck, RotateCcw, X, Eye, CalendarDays,
} from "lucide-react";
import {
    getWithdrawals, returnWithdrawal, cancelWithdrawal,
    type Withdrawal, type WithdrawalItem,
} from "@/lib/api/withdrawals";
import { getEvents } from "@/lib/api/events";
import { CameraCaptureModal } from "@/components/CameraCaptureModal";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    CHECKED_OUT: { label: "Dipinjam", cls: "bg-blue-50 text-blue-700" },
    PARTIAL_RETURNED: { label: "Sebagian Kembali", cls: "bg-amber-50 text-amber-700" },
    OVERDUE: { label: "Terlambat", cls: "bg-red-50 text-red-700" },
    RETURNED: { label: "Selesai", cls: "bg-green-50 text-green-700" },
    CANCELLED: { label: "Dibatalkan", cls: "bg-gray-100 text-gray-600" },
};

export default function GudangPeminjamanPage() {
    const [tab, setTab] = useState<"active" | "history">("active");
    const [typeFilter, setTypeFilter] = useState<"ALL" | "BORROW" | "USE">("ALL");
    const [eventFilter, setEventFilter] = useState<number | "ALL">("ALL");
    const [detail, setDetail] = useState<Withdrawal | null>(null);

    const { data: events = [] } = useQuery({
        queryKey: ["events", "filter"],
        queryFn: () => getEvents(),
        staleTime: 60_000,
    });

    const { data: activeList = [], isLoading: activeLoading } = useQuery<Withdrawal[]>({
        queryKey: ["withdrawals", "active"],
        queryFn: async () => {
            const [co, pr, od] = await Promise.all([
                getWithdrawals({ status: "CHECKED_OUT" }),
                getWithdrawals({ status: "PARTIAL_RETURNED" }),
                getWithdrawals({ status: "OVERDUE" }),
            ]);
            return [...co, ...pr, ...od];
        },
        enabled: tab === "active",
    });

    const { data: historyList = [], isLoading: historyLoading } = useQuery<Withdrawal[]>({
        queryKey: ["withdrawals", "history"],
        queryFn: async () => {
            const [rt, cc] = await Promise.all([
                getWithdrawals({ status: "RETURNED" }),
                getWithdrawals({ status: "CANCELLED" }),
            ]);
            return [...rt, ...cc];
        },
        enabled: tab === "history",
    });

    const list = useMemo(() => {
        let src = tab === "active" ? activeList : historyList;
        if (typeFilter !== "ALL") src = src.filter((w) => w.type === typeFilter);
        if (eventFilter !== "ALL") src = src.filter((w) => w.eventId === eventFilter);
        return src;
    }, [tab, activeList, historyList, typeFilter, eventFilter]);

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" /> Peminjaman & Pengambilan
                </h1>
                <Link href="/gudang/ambil" className="ml-auto flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90">
                    <Plus className="h-4 w-4" /> Ambil Baru
                </Link>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex border rounded-lg overflow-hidden">
                    <button onClick={() => setTab("active")} className={`px-3 py-1.5 text-sm ${tab === "active" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                        Aktif
                    </button>
                    <button onClick={() => setTab("history")} className={`px-3 py-1.5 text-sm ${tab === "history" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                        Riwayat
                    </button>
                </div>
                <div className="inline-flex border rounded-lg overflow-hidden text-xs">
                    {(["ALL", "BORROW", "USE"] as const).map((t) => (
                        <button key={t} onClick={() => setTypeFilter(t)} className={`px-2.5 py-1.5 ${typeFilter === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                            {t === "ALL" ? "Semua" : t === "BORROW" ? "Pinjam" : "Pakai"}
                        </button>
                    ))}
                </div>
                {events.length > 0 && (
                    <select
                        value={eventFilter === "ALL" ? "" : String(eventFilter)}
                        onChange={(e) => setEventFilter(e.target.value ? Number(e.target.value) : "ALL")}
                        className="text-xs border rounded px-2 py-1.5"
                    >
                        <option value="">Semua Event</option>
                        {events.map((ev) => (
                            <option key={ev.id} value={ev.id}>
                                {ev.code} · {ev.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                        <tr>
                            <th className="p-2">Kode</th>
                            <th className="p-2">Pekerja</th>
                            <th className="p-2">Gudang</th>
                            <th className="p-2 w-[80px]">Tipe</th>
                            <th className="p-2">Event</th>
                            <th className="p-2">Keperluan</th>
                            <th className="p-2 w-[60px] text-center">Item</th>
                            <th className="p-2">Jadwal Kembali</th>
                            <th className="p-2 w-[120px] text-center">Status</th>
                            <th className="p-2 w-[100px] text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {((tab === "active" && activeLoading) || (tab === "history" && historyLoading)) && (
                            <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
                            </td></tr>
                        )}
                        {!(activeLoading || historyLoading) && list.length === 0 && (
                            <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">
                                {tab === "active" ? "Tidak ada peminjaman aktif." : "Belum ada riwayat."}
                            </td></tr>
                        )}
                        {list.map((w) => {
                            const badge = STATUS_BADGE[w.status] ?? { label: w.status, cls: "bg-muted" };
                            const overdue = w.scheduledReturnAt && new Date(w.scheduledReturnAt) < new Date() && (w.status === "CHECKED_OUT" || w.status === "PARTIAL_RETURNED" || w.status === "OVERDUE");
                            return (
                                <tr key={w.id} className="border-t hover:bg-muted/20">
                                    <td className="p-2 font-mono text-xs">{w.code}</td>
                                    <td className="p-2">
                                        <div className="flex items-center gap-1.5">
                                            {w.worker?.photoUrl ? (
                                                <img src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}${w.worker.photoUrl}`} alt="" className="w-6 h-6 rounded-full object-cover" />
                                            ) : (
                                                <UserIcon className="h-5 w-5 text-muted-foreground" />
                                            )}
                                            <span>{w.worker?.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-2 text-xs">{w.warehouse?.name}</td>
                                    <td className="p-2">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${w.type === "BORROW" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                                            {w.type === "BORROW" ? "PINJAM" : "PAKAI"}
                                        </span>
                                    </td>
                                    <td className="p-2 text-xs">
                                        {w.event ? (
                                            <Link href={`/events/${w.event.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                                                <CalendarDays className="h-3 w-3" />
                                                <span className="truncate max-w-[140px]" title={w.event.name}>{w.event.name}</span>
                                            </Link>
                                        ) : <span className="text-muted-foreground">—</span>}
                                    </td>
                                    <td className="p-2 text-xs truncate max-w-[200px]">{w.purpose}</td>
                                    <td className="p-2 text-center font-mono text-xs">{w._count?.items ?? w.items.length}</td>
                                    <td className="p-2 text-xs">
                                        {w.scheduledReturnAt ? (
                                            <div className={overdue ? "text-red-600 font-semibold" : ""}>
                                                {new Date(w.scheduledReturnAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                                                {overdue && <AlertTriangle className="h-3 w-3 inline ml-1" />}
                                            </div>
                                        ) : "—"}
                                    </td>
                                    <td className="p-2 text-center">
                                        <span className={`text-[10px] px-2 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
                                    </td>
                                    <td className="p-2 text-center">
                                        <button onClick={() => setDetail(w)} className="p-1.5 hover:bg-muted rounded" title="Detail">
                                            <Eye className="h-3.5 w-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {detail && (
                <WithdrawalDetailModal
                    withdrawal={detail}
                    onClose={() => setDetail(null)}
                />
            )}
        </div>
    );
}

function WithdrawalDetailModal({
    withdrawal, onClose,
}: {
    withdrawal: Withdrawal;
    onClose: () => void;
}) {
    const qc = useQueryClient();
    const [returnMap, setReturnMap] = useState<Record<number, string>>({});
    const [returnNotes, setReturnNotes] = useState("");
    const [cameraOpen, setCameraOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

    const isActive = ["CHECKED_OUT", "PARTIAL_RETURNED", "OVERDUE"].includes(withdrawal.status);
    const canReturn = isActive && withdrawal.type === "BORROW";
    const canCancel = isActive;

    const returnMut = useMutation({
        mutationFn: (photo: Blob) => {
            const items = withdrawal.items
                .map((it) => {
                    const v = returnMap[it.id];
                    const qty = v ? Number(v) : 0;
                    return qty > 0 ? { withdrawalItemId: it.id, returnQuantity: qty } : null;
                })
                .filter((x): x is NonNullable<typeof x> => x !== null);
            return returnWithdrawal(withdrawal.id, { items, notes: returnNotes || undefined, photo });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["withdrawals"] });
            qc.invalidateQueries({ queryKey: ["warehouse-stock"] });
            qc.invalidateQueries({ queryKey: ["overdue-count"] });
            onClose();
        },
        onError: (e: any) => {
            setError(e?.response?.data?.message || "Gagal proses pengembalian");
            setCameraOpen(false);
        },
    });

    const cancelMut = useMutation({
        mutationFn: () => cancelWithdrawal(withdrawal.id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["withdrawals"] });
            qc.invalidateQueries({ queryKey: ["warehouse-stock"] });
            qc.invalidateQueries({ queryKey: ["overdue-count"] });
            onClose();
        },
    });

    function fillAllRemaining() {
        const map: Record<number, string> = {};
        for (const it of withdrawal.items) {
            const remaining = Number(it.quantity) - Number(it.returnedQty);
            if (remaining > 0) map[it.id] = String(remaining);
        }
        setReturnMap(map);
    }

    function startReturn() {
        setError(null);
        const hasQty = Object.values(returnMap).some((v) => Number(v) > 0);
        if (!hasQty) { setError("Isi jumlah kembali minimal 1 item"); return; }
        setCameraOpen(true);
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
            <div className="bg-background border rounded-lg shadow-lg max-w-3xl w-full max-h-[92vh] flex flex-col">
                <div className="p-4 border-b flex items-center justify-between">
                    <div>
                        <h3 className="font-bold flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary" /> {withdrawal.code}
                        </h3>
                        <div className="text-xs text-muted-foreground mt-0.5">
                            {new Date(withdrawal.createdAt).toLocaleString("id-ID")}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4" /></button>
                </div>

                <div className="overflow-y-auto">
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-b">
                        <div className="space-y-1 text-sm">
                            <div><b>Pekerja:</b> {withdrawal.worker?.name} {withdrawal.worker?.position && <span className="text-muted-foreground">({withdrawal.worker.position})</span>}</div>
                            <div><b>Gudang:</b> {withdrawal.warehouse?.name}</div>
                            <div><b>Tipe:</b> {withdrawal.type === "BORROW" ? "Peminjaman" : "Pengambilan"}</div>
                            <div><b>Keperluan:</b> {withdrawal.purpose}</div>
                            {withdrawal.scheduledReturnAt && (
                                <div><b>Rencana Kembali:</b> {new Date(withdrawal.scheduledReturnAt).toLocaleString("id-ID")}</div>
                            )}
                            {withdrawal.actualReturnAt && (
                                <div><b>Aktual Kembali:</b> {new Date(withdrawal.actualReturnAt).toLocaleString("id-ID")}</div>
                            )}
                            {withdrawal.notes && <div><b>Catatan:</b> {withdrawal.notes}</div>}
                        </div>
                        <div className="space-y-2">
                            <div className="text-xs font-semibold text-muted-foreground">Foto Checkout</div>
                            {withdrawal.checkoutPhotoUrl ? (
                                <img src={`${API}${withdrawal.checkoutPhotoUrl}`} alt="checkout" className="w-full max-w-[240px] rounded border" />
                            ) : <div className="text-xs text-muted-foreground">—</div>}
                            {withdrawal.returnPhotoUrl && (
                                <>
                                    <div className="text-xs font-semibold text-muted-foreground mt-2">Foto Kembali</div>
                                    <img src={`${API}${withdrawal.returnPhotoUrl}`} alt="return" className="w-full max-w-[240px] rounded border" />
                                </>
                            )}
                        </div>
                    </div>

                    <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-sm">Barang</h4>
                            {canReturn && (
                                <button onClick={fillAllRemaining} className="text-xs text-primary hover:underline flex items-center gap-1">
                                    <CheckCheck className="h-3 w-3" /> Kembalikan Semua
                                </button>
                            )}
                        </div>
                        <table className="w-full text-sm border rounded overflow-hidden">
                            <thead className="bg-muted/50 text-left text-xs">
                                <tr>
                                    <th className="p-2">Produk</th>
                                    <th className="p-2 w-[80px] text-right">Qty</th>
                                    <th className="p-2 w-[80px] text-right">Kembali</th>
                                    {canReturn && <th className="p-2 w-[100px]">Jml Kembali Baru</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {withdrawal.items.map((it) => {
                                    const remaining = Number(it.quantity) - Number(it.returnedQty);
                                    return (
                                        <tr key={it.id} className="border-t">
                                            <td className="p-2">
                                                <div className="text-sm">{it.productVariant?.product.name}</div>
                                                {it.productVariant?.variantName && <div className="text-xs text-muted-foreground">{it.productVariant.variantName}</div>}
                                            </td>
                                            <td className="p-2 text-right font-mono text-xs">{Number(it.quantity)}</td>
                                            <td className="p-2 text-right font-mono text-xs">{Number(it.returnedQty)}</td>
                                            {canReturn && (
                                                <td className="p-2">
                                                    <input
                                                        type="number" min={0} max={remaining}
                                                        value={returnMap[it.id] ?? ""}
                                                        onChange={(e) => setReturnMap((prev) => ({ ...prev, [it.id]: e.target.value }))}
                                                        placeholder={`max ${remaining}`}
                                                        disabled={remaining <= 0}
                                                        className="w-20 border rounded px-1 py-0.5 text-xs text-right disabled:bg-muted"
                                                    />
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {canReturn && (
                            <div className="mt-3">
                                <label className="text-xs font-medium">Catatan Pengembalian</label>
                                <textarea
                                    rows={2} value={returnNotes}
                                    onChange={(e) => setReturnNotes(e.target.value)}
                                    placeholder="Kondisi barang saat kembali… (opsional)"
                                    className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
                                />
                            </div>
                        )}
                        {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
                    </div>
                </div>

                <div className="p-4 border-t flex items-center gap-2 justify-end">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm border rounded hover:bg-muted">Tutup</button>
                    {canCancel && (
                        <button
                            onClick={() => {
                                if (confirm("Batalkan pengambilan ini? Stok akan dikembalikan ke gudang.")) cancelMut.mutate();
                            }}
                            disabled={cancelMut.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                        >
                            {cancelMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            <RotateCcw className="h-3.5 w-3.5" /> Batalkan
                        </button>
                    )}
                    {canReturn && (
                        <button
                            onClick={startReturn}
                            disabled={returnMut.isPending}
                            className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded text-sm hover:opacity-90 disabled:opacity-50"
                        >
                            <Camera className="h-3.5 w-3.5" /> Kembalikan (Foto)
                        </button>
                    )}
                </div>
            </div>

            {cameraOpen && (
                <CameraCaptureModal
                    title="Foto Saat Pengembalian"
                    onCancel={() => setCameraOpen(false)}
                    onConfirm={(blob) => returnMut.mutate(blob)}
                    submitting={returnMut.isPending}
                />
            )}
        </div>
    );
}
