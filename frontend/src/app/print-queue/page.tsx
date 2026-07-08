"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    listPrintJobs, getPrintQueueStats,
    PrintJob, PrintJobStatus,
} from '@/lib/api/print-queue';

const STATUSES: { key: PrintJobStatus | 'ALL'; label: string }[] = [
    { key: 'ALL', label: 'Semua' },
    { key: 'ANTRIAN', label: 'Antrian' },
    { key: 'PROSES', label: 'Proses' },
    { key: 'SELESAI', label: 'Siap Diambil' },
    { key: 'DIAMBIL', label: 'Diambil' },
];

function fmt(s: string | null) {
    if (!s) return '—';
    return new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StatusChip({ s }: { s: PrintJobStatus }) {
    const map: Record<PrintJobStatus, string> = {
        ANTRIAN: 'bg-muted text-muted-foreground border-border',
        PROSES: 'bg-info/15 text-info border-info/30',
        SELESAI: 'bg-success/15 text-success border-success/30',
        DIAMBIL: 'bg-info/15 text-info border-info/30',
    };
    return <span className={`text-xs font-bold px-2 py-0.5 rounded border ${map[s]}`}>{s}</span>;
}

function PayBadge({ s }: { s: 'PENDING' | 'PARTIAL' | 'PAID' | 'FAILED' }) {
    const map: Record<string, string> = {
        PAID: 'bg-success/15 text-success border-success/30',
        PARTIAL: 'bg-warning/15 text-warning border-warning/30',
        PENDING: 'bg-destructive/12 text-destructive border-destructive/30',
        FAILED: 'bg-muted text-muted-foreground border-border',
    };
    const label = s === 'PAID' ? 'LUNAS' : s === 'PARTIAL' ? 'DP' : s === 'PENDING' ? 'BELUM LUNAS' : s;
    return <span className={`text-xs font-bold px-2 py-0.5 rounded border ${map[s]}`}>{label}</span>;
}

export default function PrintQueueAdminPage() {
    const [jobs, setJobs] = useState<PrintJob[]>([]);
    const [stats, setStats] = useState({ antrian: 0, proses: 0, selesai: 0, diambil: 0 });
    const [filter, setFilter] = useState<PrintJobStatus | 'ALL'>('ALL');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [j, s] = await Promise.all([
                listPrintJobs(filter === 'ALL' ? undefined : filter, search || undefined),
                getPrintQueueStats(),
            ]);
            setJobs(j);
            setStats(s);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [filter, search]);

    useEffect(() => { load(); }, [load]);

    return (
        <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><Printer className="w-6 h-6" /> Antrian Cetak Paper</h1>
                    <p className="text-sm text-muted-foreground">Pantau status cetakan paper dari setiap transaksi.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" className="gap-1.5">
                        <Link href="/cetak" target="_blank">
                            <ExternalLink className="w-3.5 h-3.5" /> Buka Halaman Operator
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {([
                    { label: 'Antrian', val: stats.antrian, color: 'text-foreground' },
                    { label: 'Proses', val: stats.proses, color: 'text-info' },
                    { label: 'Siap Diambil', val: stats.selesai, color: 'text-success' },
                    { label: 'Diambil', val: stats.diambil, color: 'text-info' },
                ]).map(c => (
                    <div key={c.label} className="glass rounded-xl p-4">
                        <p className="text-xs text-muted-foreground">{c.label}</p>
                        <p className={`text-2xl font-bold nums ${c.color}`}>{c.val}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="flex gap-1 overflow-x-auto">
                    {STATUSES.map(s => (
                        <button
                            key={s.key}
                            onClick={() => setFilter(s.key)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                                filter === s.key
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-card border-border hover:bg-muted'
                            }`}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
                <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Cari no. job / invoice / pelanggan..."
                    className="border border-border rounded-lg px-3 py-1.5 text-sm bg-card ml-auto w-full sm:w-72"
                />
            </div>

            <div className="glass rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-muted text-xs uppercase text-muted-foreground">
                            <tr>
                                <th className="px-3 py-2 text-left">No. Job</th>
                                <th className="px-3 py-2 text-left">Invoice / SC</th>
                                <th className="px-3 py-2 text-left">Pelanggan</th>
                                <th className="px-3 py-2 text-left">Produk</th>
                                <th className="px-3 py-2 text-right">Qty</th>
                                <th className="px-3 py-2 text-left">Status Cetak</th>
                                <th className="px-3 py-2 text-left">Bayar</th>
                                <th className="px-3 py-2 text-left">Mulai</th>
                                <th className="px-3 py-2 text-left">Selesai</th>
                                <th className="px-3 py-2 text-left">Diambil</th>
                                <th className="px-3 py-2 text-left">Operator</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.length === 0 ? (
                                <tr><td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">Tidak ada job.</td></tr>
                            ) : jobs.map(j => (
                                <tr key={j.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                                    <td className="px-3 py-2 font-mono text-xs text-primary font-bold">{j.jobNumber}</td>
                                    <td className="px-3 py-2">
                                        <Link href={`/transactions/${j.transaction.id}`} className="font-mono text-xs text-primary hover:underline">{j.transaction.invoiceNumber}</Link>
                                        {j.transaction.checkoutNumber && (
                                            <div className="font-mono text-[10px] text-muted-foreground">{j.transaction.checkoutNumber}</div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">{j.transaction.customerName || '—'}</td>
                                    <td className="px-3 py-2">
                                        <div className="font-medium">{j.transactionItem.productVariant.product.name}</div>
                                        {j.transactionItem.productVariant.variantName && (
                                            <div className="text-xs text-muted-foreground">{j.transactionItem.productVariant.variantName}</div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold nums">{j.quantity}</td>
                                    <td className="px-3 py-2"><StatusChip s={j.status} /></td>
                                    <td className="px-3 py-2"><PayBadge s={j.transaction.status} /></td>
                                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(j.startedAt)}</td>
                                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(j.finishedAt)}</td>
                                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(j.pickedUpAt)}</td>
                                    <td className="px-3 py-2 text-xs text-muted-foreground">{j.operatorName || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
