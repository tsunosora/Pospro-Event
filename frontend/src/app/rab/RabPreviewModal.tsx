"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
    X, Loader2, ExternalLink, Calendar, MapPin, Building2, FileSpreadsheet,
    TrendingUp, ArrowUpRight, ArrowDownRight, Image as ImageIcon,
} from "lucide-react";
import { getRab, getRabSummary, downloadRabXlsx } from "@/lib/api/rab";

function fmtRp(v: number | string) {
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (!isFinite(n)) return "Rp 0";
    return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}
function fmtDate(s: string | null) {
    if (!s) return "—";
    try {
        return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    } catch {
        return "—";
    }
}

export function RabPreviewModal({ rabId, onClose }: { rabId: number; onClose: () => void }) {
    const { data: rab, isLoading: loadingRab } = useQuery({
        queryKey: ["rab", rabId],
        queryFn: () => getRab(rabId),
    });
    const { data: summary, isLoading: loadingSummary } = useQuery({
        queryKey: ["rab-summary", rabId],
        queryFn: () => getRabSummary(rabId),
    });

    // Block body scroll while modal open
    useEffect(() => {
        const orig = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = orig; };
    }, []);

    // Esc key to close
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [onClose]);

    const totalIncome = summary
        ? summary.income.dpAmount + summary.income.pelunasan + summary.income.incomeOther
        : 0;
    const margin = summary && summary.totals.totalRab > 0
        ? (summary.totals.totalSelisih / summary.totals.totalRab) * 100
        : 0;
    const marginColor = margin >= 30 ? "text-green-600" : margin >= 15 ? "text-amber-600" : margin < 0 ? "text-red-600" : "text-amber-700";

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

    async function handleDownload() {
        if (!rab) return;
        try {
            const blob = await downloadRabXlsx(rab.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${rab.code}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            alert("Gagal download XLSX");
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
            <div
                className="bg-background rounded-xl shadow-2xl w-full max-w-5xl my-8 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Sticky Header */}
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-5 py-4 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                {rab?.code ?? "..."}
                            </span>
                            <h2 className="text-lg font-bold truncate">{rab?.title ?? "Memuat..."}</h2>
                        </div>
                        {rab?.projectName && (
                            <p className="text-sm text-muted-foreground mt-0.5">{rab.projectName}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleDownload}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted"
                            title="Download XLSX"
                        >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">XLSX</span>
                        </button>
                        {rab && (
                            <Link
                                href={`/rab/${rab.id}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Buka Detail</span>
                            </Link>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-muted rounded-md"
                            aria-label="Tutup"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                {loadingRab || loadingSummary ? (
                    <div className="p-12 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : !rab || !summary ? (
                    <div className="p-12 text-center text-muted-foreground">RAB tidak ditemukan</div>
                ) : (
                    <div className="p-5 space-y-5">
                        {/* Image */}
                        {rab.imageUrl && (
                            <div className="rounded-lg border border-border overflow-hidden bg-muted/30">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={`${apiBase}${rab.imageUrl}`}
                                    alt={rab.title}
                                    className="w-full max-h-72 object-contain bg-white"
                                />
                            </div>
                        )}

                        {/* Info Grid */}
                        <div className="grid sm:grid-cols-2 gap-3">
                            <InfoCard label="Klien">
                                {rab.customer ? (
                                    <div>
                                        <div className="font-medium">{rab.customer.name}</div>
                                        {rab.customer.companyName && (
                                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                <Building2 className="h-3 w-3" />
                                                {rab.customer.companyName}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground italic text-sm">— belum di-link customer —</span>
                                )}
                            </InfoCard>

                            <InfoCard label="Lokasi">
                                {rab.location ? (
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                        <span>{rab.location}</span>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground italic text-sm">—</span>
                                )}
                            </InfoCard>

                            <InfoCard label="Periode">
                                <div className="flex items-center gap-1.5 text-sm">
                                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span>{fmtDate(rab.periodStart)} → {fmtDate(rab.periodEnd)}</span>
                                </div>
                            </InfoCard>

                            <InfoCard label="Jumlah Item">
                                <span className="text-lg font-semibold">{rab.items.length} item</span>
                                <span className="text-sm text-muted-foreground"> ({summary.categories.filter(c => c.count > 0).length} kategori)</span>
                            </InfoCard>
                        </div>

                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                            <StatBox
                                label="Total RAB"
                                value={fmtRp(summary.totals.totalRab)}
                                icon={<ArrowUpRight className="h-4 w-4" />}
                                valueClass="text-foreground"
                                hint="Harga ke klien"
                            />
                            <StatBox
                                label="Total COST"
                                value={fmtRp(summary.totals.totalCost)}
                                icon={<ArrowDownRight className="h-4 w-4" />}
                                valueClass="text-muted-foreground"
                                hint="Biaya internal"
                            />
                            <StatBox
                                label="Selisih"
                                value={fmtRp(summary.totals.totalSelisih)}
                                icon={<TrendingUp className="h-4 w-4" />}
                                valueClass={summary.totals.totalSelisih >= 0 ? "text-green-600" : "text-red-600"}
                                hint={summary.totals.totalRab > 0 ? `Margin ${margin.toFixed(1)}%` : "—"}
                            />
                            <StatBox
                                label="Saldo"
                                value={fmtRp(summary.saldo)}
                                icon={<TrendingUp className="h-4 w-4" />}
                                valueClass={summary.saldo >= 0 ? "text-green-600" : "text-red-600"}
                                hint={`Income ${fmtRp(totalIncome)}`}
                            />
                        </div>

                        {/* Category Breakdown */}
                        <div className="rounded-lg border border-border overflow-hidden">
                            <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
                                <h3 className="text-sm font-semibold">Breakdown per Kategori</h3>
                                <span className={`text-xs font-semibold ${marginColor}`}>
                                    Margin {margin.toFixed(1)}%
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/20 text-xs">
                                        <tr>
                                            <th className="text-left px-3 py-2">Kategori</th>
                                            <th className="text-center px-3 py-2 text-muted-foreground">Items</th>
                                            <th className="text-right px-3 py-2">Subtotal RAB</th>
                                            <th className="text-right px-3 py-2 text-muted-foreground">Subtotal COST</th>
                                            <th className="text-right px-3 py-2">Selisih</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {summary.categories
                                            .filter(c => c.count > 0)
                                            .map((c) => (
                                                <tr key={c.categoryId}>
                                                    <td className="px-3 py-2 font-medium">{c.categoryName}</td>
                                                    <td className="px-3 py-2 text-center text-muted-foreground">{c.count}</td>
                                                    <td className="px-3 py-2 text-right font-mono">{fmtRp(c.subtotalRab)}</td>
                                                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtRp(c.subtotalCost)}</td>
                                                    <td className={`px-3 py-2 text-right font-mono font-semibold ${c.selisih >= 0 ? "text-green-600" : "text-red-600"}`}>
                                                        {fmtRp(c.selisih)}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                    <tfoot className="bg-muted/30 font-bold border-t-2 border-foreground/20">
                                        <tr>
                                            <td className="px-3 py-2">TOTAL</td>
                                            <td className="px-3 py-2 text-center text-muted-foreground">{rab.items.length}</td>
                                            <td className="px-3 py-2 text-right font-mono">{fmtRp(summary.totals.totalRab)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtRp(summary.totals.totalCost)}</td>
                                            <td className={`px-3 py-2 text-right font-mono ${summary.totals.totalSelisih >= 0 ? "text-green-600" : "text-red-600"}`}>
                                                {fmtRp(summary.totals.totalSelisih)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Pendapatan */}
                        <div className="rounded-lg border border-border p-4 bg-muted/20">
                            <h3 className="text-sm font-semibold mb-3">Pendapatan</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                <div>
                                    <div className="text-xs text-muted-foreground">DP</div>
                                    <div className="font-mono font-medium">{fmtRp(summary.income.dpAmount)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Pelunasan</div>
                                    <div className="font-mono font-medium">{fmtRp(summary.income.pelunasan)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Lain-lain</div>
                                    <div className="font-mono font-medium">{fmtRp(summary.income.incomeOther)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Total Income</div>
                                    <div className="font-mono font-bold text-primary">{fmtRp(totalIncome)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        {rab.notes && (
                            <div className="rounded-lg border border-border p-4">
                                <h3 className="text-sm font-semibold mb-2">Catatan</h3>
                                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{rab.notes}</p>
                            </div>
                        )}

                        {/* Items list */}
                        <div className="rounded-lg border border-border overflow-hidden">
                            <div className="px-4 py-2 border-b bg-muted/30">
                                <h3 className="text-sm font-semibold">Detail Item ({rab.items.length})</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/20 text-muted-foreground">
                                        <tr>
                                            <th className="text-left px-2 py-1.5">Kategori</th>
                                            <th className="text-left px-2 py-1.5">Item</th>
                                            <th className="text-right px-2 py-1.5">Qty</th>
                                            <th className="text-right px-2 py-1.5">QtyCost</th>
                                            <th className="text-right px-2 py-1.5">Harga RAB</th>
                                            <th className="text-right px-2 py-1.5">Harga COST</th>
                                            <th className="text-right px-2 py-1.5">Sub RAB</th>
                                            <th className="text-right px-2 py-1.5">Sub COST</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {rab.items.map((it, idx) => {
                                            const qRab = Number(it.quantity) || 0;
                                            const qSrc = it.quantityCost ?? it.quantity;
                                            const qCost = (typeof qSrc === "string" ? parseFloat(qSrc) : qSrc) || 0;
                                            const r = Number(it.priceRab) || 0;
                                            const c = Number(it.priceCost) || 0;
                                            const subRab = qRab * r;
                                            const subCost = qCost * c;
                                            return (
                                                <tr key={it.id ?? idx} className="hover:bg-muted/20">
                                                    <td className="px-2 py-1.5 text-muted-foreground">{it.category?.name ?? "—"}</td>
                                                    <td className="px-2 py-1.5">
                                                        <div className="font-medium">{it.description}</div>
                                                        {it.unit && <span className="text-muted-foreground">{it.unit}</span>}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right font-mono">{qRab}</td>
                                                    <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{qCost}</td>
                                                    <td className="px-2 py-1.5 text-right font-mono">{fmtRp(r)}</td>
                                                    <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{fmtRp(c)}</td>
                                                    <td className="px-2 py-1.5 text-right font-mono">{fmtRp(subRab)}</td>
                                                    <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{fmtRp(subCost)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="text-[10px] text-muted-foreground text-center pt-2">
                            Tekan <kbd className="px-1.5 py-0.5 border rounded">Esc</kbd> untuk tutup, atau klik area gelap di luar modal
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-border p-3 bg-background">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</div>
            <div className="text-sm">{children}</div>
        </div>
    );
}

function StatBox({ label, value, icon, valueClass, hint }: { label: string; value: string; icon?: React.ReactNode; valueClass?: string; hint?: string }) {
    return (
        <div className="rounded-lg border border-border p-3 bg-background">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{label}</span>
                {icon}
            </div>
            <div className={`text-lg font-bold font-mono ${valueClass ?? ""}`}>{value}</div>
            {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
        </div>
    );
}
