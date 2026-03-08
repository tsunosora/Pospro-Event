'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { verifyOpnameToken, getOpnameProducts, submitOpnameItems } from '@/lib/api';
import { CheckCircle2, Minus, Plus, Send, AlertCircle, Loader2, ClipboardList } from 'lucide-react';

const STORAGE_KEY = (token: string) => `opname_draft_${token}`;

type VerifyResult = {
    sessionId: string;
    notes: string | null;
    categoryName: string | null;
    expiresAt: string;
    valid: boolean;
};

type Variant = {
    id: number;
    variantName: string | null;
    sku: string;
    size: string | null;
    color: string | null;
    variantImageUrl: string | null;
};

type Product = {
    id: number;
    name: string;
    imageUrl: string | null;
    category: { name: string };
    unit: { name: string };
    variants: Variant[];
};

// ─── Name Entry Screen ────────────────────────────────────────────────────────
function NameEntry({ session, onConfirm }: { session: VerifyResult; onConfirm: (name: string) => void }) {
    const [name, setName] = useState('');

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
            <div className="w-full max-w-sm space-y-6 text-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <ClipboardList className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Stok Opname</h1>
                        {session.notes && <p className="text-sm text-muted-foreground mt-1">{session.notes}</p>}
                        {session.categoryName && (
                            <p className="text-xs text-primary mt-1 font-medium">Kategori: {session.categoryName}</p>
                        )}
                    </div>
                </div>

                <div className="space-y-3 text-left">
                    <label className="block text-sm font-medium">Masukkan nama Anda</label>
                    <input
                        autoFocus
                        type="text"
                        placeholder="Contoh: Budi Gudang"
                        className="w-full px-4 py-3 text-base border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && name.trim() && onConfirm(name.trim())}
                    />
                    <p className="text-xs text-muted-foreground">
                        Nama ini akan dicatat di laporan opname untuk admin.
                    </p>
                </div>

                <button
                    onClick={() => name.trim() && onConfirm(name.trim())}
                    disabled={!name.trim()}
                    className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-base font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
                >
                    Mulai Menghitung
                </button>

                <p className="text-xs text-muted-foreground">
                    Link berlaku sampai {new Date(session.expiresAt).toLocaleString('id-ID')}
                </p>
            </div>
        </div>
    );
}

// ─── Counter per Variant ──────────────────────────────────────────────────────
function VariantCounter({
    variant, productName, imageUrl, unit, count, onChange,
}: {
    variant: Variant;
    productName: string;
    imageUrl: string | null;
    unit: string;
    count: number;
    onChange: (val: number) => void;
}) {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const img = variant.variantImageUrl || imageUrl;
    const label = [variant.variantName, variant.size, variant.color].filter(Boolean).join(' · ');

    return (
        <div className="flex items-center gap-3 p-3.5 bg-card rounded-xl border border-border">
            {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${base}${img}`} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
            ) : (
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <ClipboardList className="h-5 w-5 text-muted-foreground/40" />
                </div>
            )}

            <div className="flex-1 min-w-0">
                <p className="font-medium text-sm leading-tight">{productName}</p>
                {label && <p className="text-xs text-muted-foreground mt-0.5">{label}</p>}
                <p className="text-xs text-muted-foreground">{unit}</p>
            </div>

            {/* Counter */}
            <div className="flex items-center gap-2 shrink-0">
                <button
                    onClick={() => onChange(Math.max(0, count - 1))}
                    className="h-9 w-9 rounded-full border border-border flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
                >
                    <Minus className="h-4 w-4" />
                </button>
                <input
                    type="number"
                    min={0}
                    value={count}
                    onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-14 text-center text-lg font-bold border border-border rounded-lg py-1 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                    onClick={() => onChange(count + 1)}
                    className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
                >
                    <Plus className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

// ─── Counting Screen ──────────────────────────────────────────────────────────
function CountingScreen({
    token, operatorName, products,
}: {
    token: string;
    operatorName: string;
    products: Product[];
}) {
    const [counts, setCounts] = useState<Record<number, number>>({});
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load from localStorage draft
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY(token));
            if (saved) setCounts(JSON.parse(saved));
        } catch { /* ignore */ }
    }, [token]);

    // Auto-save to localStorage
    const save = useCallback((c: Record<number, number>) => {
        try { localStorage.setItem(STORAGE_KEY(token), JSON.stringify(c)); } catch { /* ignore */ }
    }, [token]);

    const handleChange = (variantId: number, val: number) => {
        setCounts(prev => {
            const next = { ...prev, [variantId]: val };
            save(next);
            return next;
        });
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const items = products.flatMap(p =>
                p.variants.map(v => ({
                    productVariantId: v.id,
                    actualStock: counts[v.id] ?? 0,
                }))
            );
            await submitOpnameItems(token, { operatorName, items });
            localStorage.removeItem(STORAGE_KEY(token));
            setSubmitted(true);
        } catch (e: any) {
            setError(e.message || 'Gagal menyimpan, coba lagi.');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
                <CheckCircle2 className="h-20 w-20 text-emerald-500 mb-4" />
                <h2 className="text-2xl font-bold">Data Tersimpan!</h2>
                <p className="text-muted-foreground mt-2 text-sm">
                    Hasil hitungan Anda sudah diterima admin.<br />Terima kasih, {operatorName}!
                </p>
            </div>
        );
    }

    // Group by category
    const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
        const cat = p.category.name;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(p);
        return acc;
    }, {});

    const totalVariants = products.reduce((s, p) => s + p.variants.length, 0);
    const filled = Object.keys(counts).filter(k => counts[Number(k)] > 0).length;

    return (
        <div className="min-h-screen bg-background pb-32">
            {/* Top Bar */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold">Hitung Fisik Stok</p>
                        <p className="text-xs text-muted-foreground">Operator: <strong>{operatorName}</strong></p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold text-primary">{filled} / {totalVariants}</p>
                        <p className="text-xs text-muted-foreground">sudah diisi</p>
                    </div>
                </div>
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${totalVariants ? (filled / totalVariants) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* Product List */}
            <div className="px-4 pt-4 space-y-6">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs">
                    Hitung fisik produk di gudang. Stok komputer sengaja disembunyikan agar hasil hitungan akurat.
                    Data tersimpan otomatis — Anda bisa kembali melanjutkan jika sinyal terputus.
                </div>

                {Object.entries(grouped).map(([cat, prods]) => (
                    <div key={cat}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</p>
                        <div className="space-y-2">
                            {prods.map(p =>
                                p.variants.map(v => (
                                    <VariantCounter
                                        key={v.id}
                                        variant={v}
                                        productName={p.name}
                                        imageUrl={p.imageUrl}
                                        unit={p.unit.name}
                                        count={counts[v.id] ?? 0}
                                        onChange={val => handleChange(v.id, val)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Fixed Submit Button */}
            <div className="fixed bottom-0 inset-x-0 p-4 bg-background/95 backdrop-blur border-t border-border">
                {error && (
                    <p className="text-sm text-destructive text-center mb-2">{error}</p>
                )}
                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full py-4 bg-primary text-primary-foreground rounded-2xl text-base font-bold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 transition-colors active:scale-[0.98]"
                >
                    {submitting
                        ? <><Loader2 className="h-5 w-5 animate-spin" /> Mengirim...</>
                        : <><Send className="h-5 w-5" /> Kirim Hasil Hitungan</>
                    }
                </button>
                <p className="text-xs text-center text-muted-foreground mt-2">
                    Data tersimpan otomatis di perangkat ini
                </p>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OperatorOpnamePage() {
    const params = useParams();
    const token = params.token as string;

    const [phase, setPhase] = useState<'loading' | 'error' | 'name' | 'counting'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [session, setSession] = useState<VerifyResult | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [operatorName, setOperatorName] = useState('');

    useEffect(() => {
        if (!token) return;
        verifyOpnameToken(token)
            .then(s => {
                setSession(s);
                return getOpnameProducts(token);
            })
            .then(prods => {
                setProducts(prods);
                setPhase('name');
            })
            .catch(e => {
                setErrorMsg(e.message || 'Link tidak valid atau sudah kedaluwarsa.');
                setPhase('error');
            });
    }, [token]);

    if (phase === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (phase === 'error') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
                <AlertCircle className="h-16 w-16 text-destructive mb-4" />
                <h2 className="text-xl font-bold">Link Tidak Valid</h2>
                <p className="text-muted-foreground mt-2 text-sm">{errorMsg}</p>
            </div>
        );
    }

    if (phase === 'name') {
        return (
            <NameEntry
                session={session!}
                onConfirm={(name) => { setOperatorName(name); setPhase('counting'); }}
            />
        );
    }

    return (
        <CountingScreen token={token} operatorName={operatorName} products={products} />
    );
}
