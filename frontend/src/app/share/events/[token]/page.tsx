"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
    CalendarDays, MapPin, User as UserIcon, Package, Loader2,
    HardHat, LogOut, CheckCircle2, Circle, X, Package2, Droplet,
} from "lucide-react";

type Phase = { label: string; cls: string; a: string | null; b: string | null };
type Disposition = "PINJAM" | "OPERASIONAL";

type PackingItemPublic = {
    id: number;
    quantity: string | number;
    isChecked: boolean;
    disposition: Disposition | null;
    locationNote: string | null;
    checkedBy: { id: number; name: string } | null;
    checkedAt: string | null;
    productVariant: { id: number; sku: string; variantName: string | null; product: { name: string } };
    storageLocation: { id: number; code: string; name: string; warehouse: { name: string } } | null;
};

type PublicEventResponse = {
    event: {
        id: number;
        code: string;
        name: string;
        brand: "EXINDO" | "XPOSER" | "OTHER";
        status: string;
        venue: string | null;
        customerName: string | null;
        picName: string | null;
        notes: string | null;
        departureStart: string | null; departureEnd: string | null;
        setupStart: string | null; setupEnd: string | null;
        loadingStart: string | null; loadingEnd: string | null;
        eventStart: string | null; eventEnd: string | null;
        customer: { id: number; name: string; companyName: string | null } | null;
        picWorker: { id: number; name: string; position: string | null } | null;
        packingItems: PackingItemPublic[];
    };
    summary: {
        totalWithdrawals: number;
        totalUniqueItems: number;
        totalQty: number;
        items: Array<{
            productVariantId: number;
            sku: string;
            variantName: string | null;
            productName: string;
            totalQuantity: number;
        }>;
    };
};

type WorkerLite = { id: number; name: string; position: string | null };

type PetugasSession = {
    pin: string;
    workerId: number;
    workerName: string;
    expiresAt: number;
};

const BRAND_CFG: Record<string, { label: string; cls: string }> = {
    EXINDO: { label: "CV. Exindo", cls: "bg-indigo-600 text-white" },
    XPOSER: { label: "CV. Xposer", cls: "bg-pink-600 text-white" },
    OTHER: { label: "Lain", cls: "bg-gray-600 text-white" },
};
const STATUS_CFG: Record<string, string> = {
    DRAFT: "Draft", SCHEDULED: "Terjadwal", IN_PROGRESS: "Berlangsung",
    COMPLETED: "Selesai", CANCELLED: "Dibatalkan",
};
function fmt(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" });
}

const SESSION_KEY_PREFIX = "petugas-session:";
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 jam

function loadSession(token: string): PetugasSession | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = localStorage.getItem(SESSION_KEY_PREFIX + token);
        if (!raw) return null;
        const s = JSON.parse(raw) as PetugasSession;
        if (s.expiresAt < Date.now()) {
            localStorage.removeItem(SESSION_KEY_PREFIX + token);
            return null;
        }
        return s;
    } catch { return null; }
}
function saveSession(token: string, s: PetugasSession) {
    localStorage.setItem(SESSION_KEY_PREFIX + token, JSON.stringify(s));
}
function clearSession(token: string) {
    localStorage.removeItem(SESSION_KEY_PREFIX + token);
}

export default function PublicEventSharePage() {
    const params = useParams<{ token: string }>();
    const token = params.token;
    const [data, setData] = useState<PublicEventResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [session, setSession] = useState<PetugasSession | null>(null);
    const [showLogin, setShowLogin] = useState(false);
    const [pickItem, setPickItem] = useState<PackingItemPublic | null>(null);

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    const refetch = useCallback(async () => {
        const r = await fetch(`${apiBase}/public/events/${token}`);
        if (!r.ok) throw new Error((await r.json())?.message || "Gagal memuat");
        setData(await r.json());
    }, [apiBase, token]);

    useEffect(() => {
        refetch().catch((e: any) => setError(e.message || "Gagal memuat"));
        setSession(loadSession(token));
    }, [refetch, token]);

    const logout = () => { clearSession(token); setSession(null); };

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
                <div className="max-w-sm text-center space-y-2">
                    <div className="text-4xl">🔒</div>
                    <h1 className="text-lg font-bold">Link tidak tersedia</h1>
                    <p className="text-sm text-muted-foreground">{error}</p>
                </div>
            </div>
        );
    }
    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const { event: ev, summary } = data;
    const brand = BRAND_CFG[ev.brand] ?? BRAND_CFG.OTHER;
    const phases: Phase[] = [
        { label: "Berangkat", cls: "bg-yellow-100 border-yellow-300", a: ev.departureStart, b: ev.departureEnd },
        { label: "Pasang", cls: "bg-orange-100 border-orange-300", a: ev.setupStart, b: ev.setupEnd },
        { label: "Loading Peserta", cls: "bg-sky-100 border-sky-300", a: ev.loadingStart, b: ev.loadingEnd },
        { label: "Event", cls: "bg-emerald-100 border-emerald-300", a: ev.eventStart, b: ev.eventEnd },
    ];

    const submitCheck = async (itemId: number, isChecked: boolean, disposition?: Disposition | null) => {
        if (!session) return;
        const r = await fetch(`${apiBase}/public/events/${token}/packing/${itemId}/check`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-warehouse-pin": session.pin },
            body: JSON.stringify({ isChecked, workerId: session.workerId, disposition: disposition ?? null }),
        });
        if (!r.ok) {
            const msg = (await r.json().catch(() => ({})))?.message || "Gagal ubah status";
            if (r.status === 401) {
                clearSession(token);
                setSession(null);
                alert("Sesi berakhir / PIN tidak valid. Silakan login ulang.");
                return;
            }
            alert(msg);
            return;
        }
        await refetch();
    };

    const handleItemTap = (p: PackingItemPublic) => {
        if (!session) return;
        if (p.isChecked) {
            if (confirm(`Batalkan centang "${p.productVariant.product.name}"? Item RAB terkait akan dihapus.`)) {
                submitCheck(p.id, false);
            }
        } else {
            setPickItem(p);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
                <div className={`rounded-lg p-4 ${brand.cls}`}>
                    <div className="text-xs opacity-80">{brand.label} • {STATUS_CFG[ev.status] ?? ev.status}</div>
                    <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 mt-1">
                        <CalendarDays className="h-5 w-5" /> {ev.name}
                    </h1>
                    <div className="text-xs font-mono opacity-75 mt-1">{ev.code}</div>
                </div>

                <div className="bg-white border rounded-lg p-4 space-y-2 text-sm">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Info Event</div>
                    {ev.venue && (
                        <div className="flex gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div>{ev.venue}</div>
                        </div>
                    )}
                    <div><b>Klien:</b> {ev.customer?.name ?? ev.customerName ?? "—"}{ev.customer?.companyName ? ` (${ev.customer.companyName})` : ""}</div>
                    <div className="flex gap-2">
                        <UserIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                            <b>PIC:</b> {ev.picWorker?.name ?? ev.picName ?? "—"}
                            {ev.picWorker?.position && <span className="text-xs text-muted-foreground"> ({ev.picWorker.position})</span>}
                        </div>
                    </div>
                </div>

                <div className="bg-white border rounded-lg p-4 space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Jadwal Fase</div>
                    {phases.map((p) => (
                        <div key={p.label} className={`border rounded p-2 ${p.cls}`}>
                            <div className="text-xs font-semibold">{p.label}</div>
                            <div className="text-xs mt-0.5">
                                {fmt(p.a)}{(p.a || p.b) && " → "}{fmt(p.b)}
                            </div>
                        </div>
                    ))}
                </div>

                {ev.notes && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="text-xs font-semibold text-amber-900 uppercase tracking-wide mb-1">Catatan</div>
                        <div className="text-sm whitespace-pre-line">{ev.notes}</div>
                    </div>
                )}

                {ev.packingItems && ev.packingItems.length > 0 && (
                    <div className="bg-white border rounded-lg overflow-hidden">
                        <div className="px-4 py-3 border-b flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <div className="text-sm font-semibold">Packing List ({ev.packingItems.length} barang)</div>
                            {session && <span className="ml-auto text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">Mode Petugas</span>}
                        </div>
                        <div className="divide-y">
                            {ev.packingItems.map((p) => {
                                const clickable = !!session;
                                return (
                                    <div
                                        key={p.id}
                                        onClick={() => clickable && handleItemTap(p)}
                                        className={`p-3 ${clickable ? "cursor-pointer active:bg-slate-100" : ""} ${p.isChecked ? "bg-emerald-50/40" : ""}`}
                                    >
                                        <div className="flex items-start gap-2">
                                            {p.isChecked ? (
                                                <CheckCircle2 className="h-6 w-6 mt-0.5 text-emerald-600 shrink-0" />
                                            ) : (
                                                <Circle className="h-6 w-6 mt-0.5 text-gray-400 shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <div className={`font-medium ${p.isChecked ? "line-through text-muted-foreground" : ""}`}>
                                                        {p.productVariant.product.name}
                                                    </div>
                                                    {p.isChecked && p.disposition && (
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${p.disposition === "PINJAM" ? "bg-blue-50 text-blue-700 border-blue-300" : "bg-orange-50 text-orange-700 border-orange-300"}`}>
                                                            {p.disposition}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground font-mono">
                                                    {p.productVariant.sku}{p.productVariant.variantName ? ` • ${p.productVariant.variantName}` : ""}
                                                </div>
                                                <div className="text-xs mt-1 flex items-center gap-1">
                                                    <b>Qty:</b> {Number(p.quantity)}
                                                </div>
                                                <div className="text-xs mt-1">
                                                    {p.storageLocation ? (
                                                        <div className="flex items-center gap-1">
                                                            <MapPin className="h-3 w-3 text-muted-foreground" />
                                                            <span>{p.storageLocation.warehouse.name} • <span className="font-mono">{p.storageLocation.code}</span> {p.storageLocation.name}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-muted-foreground italic">Lokasi belum diset</div>
                                                    )}
                                                    {p.locationNote && <div className="text-[10px] text-muted-foreground mt-0.5">“{p.locationNote}”</div>}
                                                </div>
                                                {p.checkedBy && (
                                                    <div className="text-[10px] text-emerald-700 mt-1">
                                                        ✓ {p.checkedBy.name}
                                                        {p.checkedAt ? ` • ${new Date(p.checkedAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}` : ""}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {summary.items.length > 0 && (
                    <div className="bg-white border rounded-lg overflow-hidden">
                        <div className="px-4 py-3 border-b flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <div className="text-sm font-semibold">Ringkasan Pengeluaran ({summary.totalUniqueItems} jenis, qty {summary.totalQty})</div>
                        </div>
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs text-left">
                                <tr>
                                    <th className="p-2">Produk / SKU</th>
                                    <th className="p-2 w-20 text-right">Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary.items.map((it) => (
                                    <tr key={it.productVariantId} className="border-t">
                                        <td className="p-2">
                                            <div>{it.productName}</div>
                                            <div className="text-[10px] text-muted-foreground font-mono">{it.sku}{it.variantName ? ` • ${it.variantName}` : ""}</div>
                                        </td>
                                        <td className="p-2 text-right font-mono text-xs">{it.totalQuantity}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="text-[10px] text-center text-muted-foreground pt-2">
                    Halaman ini dibagikan via link privat.
                </div>
            </div>

            {/* Floating bottom bar: login / logout */}
            <div className="fixed bottom-0 inset-x-0 p-3 bg-white border-t shadow-lg z-40">
                <div className="max-w-2xl mx-auto flex items-center gap-2">
                    {session ? (
                        <>
                            <div className="flex-1 text-sm">
                                <div className="flex items-center gap-1.5">
                                    <HardHat className="h-4 w-4 text-emerald-600" />
                                    <span className="font-semibold">{session.workerName}</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    Sesi sampai {new Date(session.expiresAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                            </div>
                            <button
                                onClick={logout}
                                className="inline-flex items-center gap-1.5 border px-3 py-2 rounded text-sm hover:bg-muted"
                            >
                                <LogOut className="h-4 w-4" /> Keluar
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="flex-1 text-xs text-muted-foreground">
                                Mau update status barang? Masuk mode petugas.
                            </div>
                            <button
                                onClick={() => setShowLogin(true)}
                                className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded text-sm hover:bg-emerald-700 font-semibold"
                            >
                                <HardHat className="h-4 w-4" /> Mode Petugas
                            </button>
                        </>
                    )}
                </div>
            </div>

            {showLogin && (
                <PetugasLoginModal
                    token={token}
                    apiBase={apiBase}
                    onClose={() => setShowLogin(false)}
                    onSuccess={(s) => { saveSession(token, s); setSession(s); setShowLogin(false); }}
                />
            )}

            {pickItem && (
                <DispositionPickModal
                    item={pickItem}
                    onClose={() => setPickItem(null)}
                    onPick={async (d) => {
                        const it = pickItem;
                        setPickItem(null);
                        await submitCheck(it.id, true, d);
                    }}
                />
            )}
        </div>
    );
}

function DispositionPickModal({ item, onClose, onPick }: {
    item: PackingItemPublic;
    onClose: () => void;
    onPick: (d: Disposition) => void;
}) {
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white w-full md:max-w-sm md:rounded-lg rounded-t-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <div className="font-semibold">Klasifikasi barang</div>
                    <button onClick={onClose} className="ml-auto p-1 hover:bg-muted rounded"><X className="h-4 w-4" /></button>
                </div>
                <div className="text-sm">
                    <div className="font-medium">{item.productVariant.product.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                        {item.productVariant.sku} • qty {Number(item.quantity)}
                    </div>
                </div>
                <p className="text-xs text-muted-foreground">
                    Barang ini akan dimasukkan otomatis ke RAB event sesuai klasifikasi.
                </p>

                <button
                    onClick={() => onPick("PINJAM")}
                    className="w-full flex items-start gap-3 border-2 border-blue-200 hover:bg-blue-50 rounded-lg p-3 text-left"
                >
                    <Package2 className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                        <div className="font-semibold text-blue-800">📦 Pinjam (balik lagi)</div>
                        <div className="text-[11px] text-muted-foreground">
                            Stand, tenda, meja, dll. Masuk ke kategori <b>Perlengkapan</b> di RAB.
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => onPick("OPERASIONAL")}
                    className="w-full flex items-start gap-3 border-2 border-orange-200 hover:bg-orange-50 rounded-lg p-3 text-left"
                >
                    <Droplet className="h-6 w-6 text-orange-600 shrink-0 mt-0.5" />
                    <div>
                        <div className="font-semibold text-orange-800">🧴 Habis Pakai / Operasional</div>
                        <div className="text-[11px] text-muted-foreground">
                            Lakban, konsumsi, bahan habis. Masuk ke kategori <b>Lain-lain</b> di RAB.
                        </div>
                    </div>
                </button>
            </div>
        </div>
    );
}

function PetugasLoginModal({ token, apiBase, onClose, onSuccess }: {
    token: string; apiBase: string; onClose: () => void;
    onSuccess: (s: PetugasSession) => void;
}) {
    const [workers, setWorkers] = useState<WorkerLite[]>([]);
    const [workerId, setWorkerId] = useState<number | "">("");
    const [pin, setPin] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        fetch(`${apiBase}/public/events/${token}/packing/workers`)
            .then(async (r) => {
                if (!r.ok) throw new Error("Gagal memuat daftar pekerja");
                return r.json();
            })
            .then(setWorkers)
            .catch((e) => setErr(e.message));
    }, [apiBase, token]);

    const submit = async () => {
        if (!workerId) { setErr("Pilih nama pekerja"); return; }
        if (!pin.trim()) { setErr("Masukkan PIN"); return; }
        setBusy(true); setErr(null);
        try {
            const r = await fetch(`${apiBase}/public/events/${token}/packing/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-warehouse-pin": pin.trim() },
            });
            if (!r.ok) {
                const msg = (await r.json().catch(() => ({})))?.message || "PIN salah";
                throw new Error(msg);
            }
            const w = workers.find((x) => x.id === workerId)!;
            onSuccess({
                pin: pin.trim(),
                workerId: Number(workerId),
                workerName: w.name,
                expiresAt: Date.now() + SESSION_TTL_MS,
            });
        } catch (e: any) {
            setErr(e.message || "Gagal verifikasi");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white w-full md:max-w-sm md:rounded-lg rounded-t-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <HardHat className="h-5 w-5 text-emerald-600" />
                    <div className="font-semibold">Mode Petugas</div>
                    <button onClick={onClose} className="ml-auto p-1 hover:bg-muted rounded"><X className="h-4 w-4" /></button>
                </div>
                <p className="text-xs text-muted-foreground">
                    Pilih nama pekerja lalu masukkan PIN gudang. Sesi berlaku 4 jam.
                </p>

                <div>
                    <label className="text-xs font-medium">Nama Pekerja</label>
                    <select
                        value={String(workerId)}
                        onChange={(e) => setWorkerId(e.target.value ? Number(e.target.value) : "")}
                        className="w-full border rounded px-2 py-2 text-sm mt-1"
                    >
                        <option value="">— Pilih —</option>
                        {workers.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}{w.position ? ` (${w.position})` : ""}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-xs font-medium">PIN Gudang</label>
                    <input
                        type="password"
                        inputMode="numeric"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        placeholder="****"
                        className="w-full border rounded px-2 py-2 text-sm mt-1 font-mono tracking-widest"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                    />
                </div>

                {err && <div className="text-xs text-red-600">{err}</div>}

                <button
                    onClick={submit}
                    disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-600 text-white px-3 py-2.5 rounded text-sm hover:bg-emerald-700 font-semibold disabled:opacity-50"
                >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardHat className="h-4 w-4" />}
                    Masuk
                </button>
            </div>
        </div>
    );
}
