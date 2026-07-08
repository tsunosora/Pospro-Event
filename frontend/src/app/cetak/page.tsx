"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Printer } from 'lucide-react';
import {
    listPrintJobs, getPrintQueueStats, verifyPrintPin,
    startPrintJob, finishPrintJob, pickupPrintJob,
    PrintJob,
} from '@/lib/api/print-queue';

const PIN_KEY = 'cetak_pin_session';
const PIN_TTL = 24 * 60 * 60 * 1000;
const OP_KEY = 'cetak_operator_name';

function hasSession(): boolean {
    try {
        const raw = localStorage.getItem(PIN_KEY);
        if (!raw) return false;
        return Date.now() < JSON.parse(raw).expires;
    } catch { return false; }
}

type Tab = 'ANTRIAN' | 'PROSES' | 'SELESAI' | 'DIAMBIL';
const TABS: { key: Tab; label: string }[] = [
    { key: 'ANTRIAN', label: 'Antrian' },
    { key: 'PROSES', label: 'Proses' },
    { key: 'SELESAI', label: 'Siap Diambil' },
    { key: 'DIAMBIL', label: 'Diambil' },
];

function formatDate(s: string | null) {
    if (!s) return '—';
    return new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ s }: { s: 'PENDING' | 'PARTIAL' | 'PAID' | 'FAILED' }) {
    const map: Record<string, string> = {
        PAID: 'bg-success/15 text-success border-success/30',
        PARTIAL: 'bg-warning/15 text-warning border-warning/30',
        PENDING: 'bg-destructive/12 text-destructive border-destructive/30',
        FAILED: 'bg-muted text-muted-foreground border-border',
    };
    const label = s === 'PAID' ? 'LUNAS' : s === 'PARTIAL' ? 'DP' : s === 'PENDING' ? 'BELUM LUNAS' : s;
    return <span className={`text-xs font-bold px-2 py-0.5 rounded border ${map[s]}`}>{label}</span>;
}

export default function CetakPage() {
    const [authed, setAuthed] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [pinLoading, setPinLoading] = useState(false);

    const [operatorName, setOperatorName] = useState('');
    const [tab, setTab] = useState<Tab>('ANTRIAN');
    const [jobs, setJobs] = useState<PrintJob[]>([]);
    const [stats, setStats] = useState({ antrian: 0, proses: 0, selesai: 0, diambil: 0 });
    const [search, setSearch] = useState('');
    const [busyId, setBusyId] = useState<number | null>(null);
    const refreshRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (hasSession()) setAuthed(true);
        const storedOp = localStorage.getItem(OP_KEY);
        if (storedOp) setOperatorName(storedOp);
    }, []);

    const loadData = useCallback(async () => {
        try {
            const [j, s] = await Promise.all([listPrintJobs(), getPrintQueueStats()]);
            setJobs(j);
            setStats(s);
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => {
        if (!authed) return;
        loadData();
        refreshRef.current = setInterval(loadData, 30000);
        return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
    }, [authed, loadData]);

    const handlePin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pinInput) return;
        setPinLoading(true); setPinError('');
        try {
            const res = await verifyPrintPin(pinInput);
            if (res.valid) {
                localStorage.setItem(PIN_KEY, JSON.stringify({ expires: Date.now() + PIN_TTL }));
                setAuthed(true);
            } else {
                setPinError(res.message || 'PIN salah.');
                setPinInput('');
            }
        } catch { setPinError('Gagal menghubungi server.'); }
        finally { setPinLoading(false); }
    };

    const ensureOperator = (): string | null => {
        let name = operatorName.trim();
        if (!name) {
            const input = window.prompt('Nama operator cetak:');
            if (!input?.trim()) return null;
            name = input.trim();
            setOperatorName(name);
            localStorage.setItem(OP_KEY, name);
        }
        return name;
    };

    const handleStart = async (job: PrintJob) => {
        const name = ensureOperator();
        if (!name) return;
        setBusyId(job.id);
        try { await startPrintJob(job.id, name); await loadData(); }
        finally { setBusyId(null); }
    };
    const handleFinish = async (job: PrintJob) => {
        const name = ensureOperator();
        if (!name) return;
        setBusyId(job.id);
        try { await finishPrintJob(job.id, name); await loadData(); }
        finally { setBusyId(null); }
    };
    const handlePickup = async (job: PrintJob) => {
        if (!window.confirm(`Konfirmasi cetakan ${job.jobNumber} sudah diambil?`)) return;
        setBusyId(job.id);
        try { await pickupPrintJob(job.id); await loadData(); }
        finally { setBusyId(null); }
    };

    const filtered = jobs.filter(j => {
        if (j.status !== tab) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            j.jobNumber.toLowerCase().includes(q) ||
            (j.transaction.invoiceNumber || '').toLowerCase().includes(q) ||
            (j.transaction.checkoutNumber || '').toLowerCase().includes(q) ||
            (j.transaction.customerName || '').toLowerCase().includes(q)
        );
    });

    if (!authed) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
                <form onSubmit={handlePin} className="glass rounded-2xl p-8 w-full max-w-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Printer className="w-5 h-5 text-primary" />
                        <h1 className="text-2xl font-bold">Antrian Cetak Paper</h1>
                    </div>
                    <p className="text-sm text-muted-foreground mb-5">Masukkan PIN operator</p>
                    <input
                        type="password"
                        inputMode="numeric"
                        value={pinInput}
                        onChange={e => setPinInput(e.target.value)}
                        className="w-full border border-border rounded-lg px-4 py-3 text-lg tracking-widest text-center focus:ring-2 focus:ring-primary/40 outline-none bg-card"
                        placeholder="••••"
                        autoFocus
                    />
                    {pinError && <p className="text-destructive text-sm mt-2">{pinError}</p>}
                    <button
                        type="submit"
                        disabled={pinLoading}
                        className="w-full mt-4 bg-primary text-white font-semibold py-3 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                        {pinLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Memeriksa...</> : 'Masuk'}
                    </button>
                </form>
                <div className="mt-6 text-center">
                    <p className="text-sm font-semibold text-muted-foreground tracking-wide">Voliko Print</p>
                    <p className="text-xs text-muted-foreground mt-0.5">&copy; 2026 Muhammad Faisal Abdul Hakim</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Printer className="w-5 h-5 text-primary" />
                            <h1 className="text-2xl font-bold">Antrian Cetak Paper</h1>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Operator: <span className="font-semibold text-foreground">{operatorName || '—'}</span>
                            {operatorName && (
                                <button
                                    onClick={() => { setOperatorName(''); localStorage.removeItem(OP_KEY); }}
                                    className="ml-2 text-xs text-primary underline cursor-pointer transition-colors hover:text-primary/70"
                                >ganti</button>
                            )}
                        </p>
                    </div>
                    <input
                        type="search"
                        placeholder="Cari no. job / invoice / pelanggan..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="border border-border rounded-lg px-3 py-2 text-sm w-72 bg-card"
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto mb-4 pb-1">
                    {TABS.map(t => {
                        const count = (stats as any)[t.key.toLowerCase()] ?? 0;
                        const active = tab === t.key;
                        return (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border transition-colors cursor-pointer ${active ? 'bg-primary text-white border-primary' : 'bg-card text-foreground border-border hover:bg-muted'}`}
                            >{t.label} <span className={`ml-1 px-1.5 rounded nums ${active ? 'bg-primary/70' : 'bg-muted'}`}>{count}</span></button>
                        );
                    })}
                </div>

                {filtered.length === 0 ? (
                    <div className="glass border-dashed rounded-xl p-10 text-center text-muted-foreground">Tidak ada job di tab ini.</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filtered.map(job => {
                            const item = job.transactionItem;
                            const variant = item.productVariant;
                            return (
                                <div key={job.id} className="glass rounded-xl p-4 flex flex-col animate-in">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div>
                                            <p className="font-mono text-xs text-primary font-bold">{job.jobNumber}</p>
                                            <p className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</p>
                                        </div>
                                        <StatusBadge s={job.transaction.status} />
                                    </div>
                                    <div className="mb-2">
                                        <p className="font-semibold text-sm">{variant.product.name}</p>
                                        {variant.variantName && <p className="text-xs text-muted-foreground">{variant.variantName}</p>}
                                        <p className="text-xs text-muted-foreground mt-1">Qty: <span className="font-bold text-foreground nums">{job.quantity}</span>{item.clickType && ` • ${item.clickType}`}</p>
                                    </div>
                                    <div className="text-xs text-foreground mb-2 border-t border-border pt-2 space-y-0.5">
                                        <p>Invoice: <span className="font-mono">{job.transaction.invoiceNumber}</span></p>
                                        {job.transaction.checkoutNumber && (
                                            <p>SC: <span className="font-mono">{job.transaction.checkoutNumber}</span></p>
                                        )}
                                        <p>Pelanggan: {job.transaction.customerName || '—'}</p>
                                    </div>
                                    {job.notes && <p className="text-xs bg-warning/15 text-warning border border-warning/30 rounded p-1.5 mb-2">{job.notes}</p>}
                                    {(job.startedAt || job.finishedAt || job.pickedUpAt) && (
                                        <div className="text-xs text-muted-foreground mb-2 space-y-0.5">
                                            {job.startedAt && <p>Mulai: {formatDate(job.startedAt)} oleh {job.operatorName || '—'}</p>}
                                            {job.finishedAt && <p>Selesai: {formatDate(job.finishedAt)}</p>}
                                            {job.pickedUpAt && <p>Diambil: {formatDate(job.pickedUpAt)}</p>}
                                        </div>
                                    )}

                                    <div className="mt-auto pt-2">
                                        {job.status === 'ANTRIAN' && (
                                            <button disabled={busyId === job.id} onClick={() => handleStart(job)} className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                                {busyId === job.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Mulai Cetak
                                            </button>
                                        )}
                                        {job.status === 'PROSES' && (
                                            <button disabled={busyId === job.id} onClick={() => handleFinish(job)} className="w-full bg-success hover:bg-success/90 text-white font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                                {busyId === job.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Tandai Selesai
                                            </button>
                                        )}
                                        {job.status === 'SELESAI' && (
                                            <button disabled={busyId === job.id} onClick={() => handlePickup(job)} className="w-full bg-info hover:bg-info/90 text-white font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                                {busyId === job.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Konfirmasi Diambil
                                            </button>
                                        )}
                                        {job.status === 'DIAMBIL' && (
                                            <div className="text-center text-xs text-muted-foreground py-2 flex items-center justify-center gap-1">
                                                <CheckCircle2 className="w-4 h-4 text-success" /> Selesai & Diambil
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <footer className="mt-8 py-4 text-center">
                <p className="text-sm font-semibold text-muted-foreground tracking-wide">Voliko Print</p>
                <p className="text-xs text-muted-foreground mt-0.5">&copy; 2026 Muhammad Faisal Abdul Hakim</p>
            </footer>
        </div>
    );
}
