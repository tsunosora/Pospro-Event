"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft, FileText, XCircle, Upload, Trash2, Loader2,
    User, Phone, MapPin, Calendar, Edit3, ExternalLink, CheckCircle2
} from "lucide-react";
import {
    getSalesOrder, cancelSO, uploadProofs, deleteProof,
    type SalesOrder, type SalesOrderStatus
} from "@/lib/api/sales-orders";
import dayjs from "dayjs";
import "dayjs/locale/id";

dayjs.locale("id");

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// proof.filename is stored as "public/uploads/so-proofs/xxx" — convert to URL
function proofUrl(filename: string): string {
    const rel = filename.replace(/^public[\\/]/i, '/').replace(/\\/g, '/');
    return `${API_URL}${rel.startsWith('/') ? rel : '/' + rel}`;
}

const STATUS_BADGE: Record<SalesOrderStatus, string> = {
    DRAFT: 'bg-muted text-muted-foreground border-border',
    SENT: 'bg-info/15 text-info border-info/30',
    INVOICED: 'bg-success/15 text-success border-success/30',
    CANCELLED: 'bg-destructive/12 text-destructive border-destructive/30',
};

const STATUS_LABEL: Record<SalesOrderStatus, string> = {
    DRAFT: 'Draft',
    SENT: 'Terkirim ke Discord',
    INVOICED: 'Sudah Dibuatkan Nota',
    CANCELLED: 'Dibatalkan',
};

export default function SalesOrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const id = Number(params?.id);

    const [showCancel, setShowCancel] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const { data: so, isLoading } = useQuery<SalesOrder>({
        queryKey: ['sales-order', id],
        queryFn: () => getSalesOrder(id),
        enabled: !!id,
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['sales-order', id] });
        queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
        queryClient.invalidateQueries({ queryKey: ['so-pending-invoice-count'] });
    };


    const cancelMut = useMutation({
        mutationFn: () => cancelSO(id, cancelReason.trim()),
        onSuccess: () => { invalidate(); setShowCancel(false); setCancelReason(''); },
        onError: (e: any) => setError(e?.response?.data?.message || 'Gagal batalkan SO'),
    });

    const deleteProofMut = useMutation({
        mutationFn: (proofId: number) => deleteProof(id, proofId),
        onSuccess: invalidate,
    });

    async function handleProofUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploading(true);
        try {
            await uploadProofs(id, Array.from(files));
            invalidate();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Gagal upload proof');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    }

    const totalItems = so?.items?.length ?? 0;

    if (isLoading || !so) {
        return (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
            </div>
        );
    }

    const canEdit = so.status === 'DRAFT' || so.status === 'SENT';
    const canInvoice = so.status === 'SENT';
    const canCancel = so.status === 'DRAFT' || so.status === 'SENT';

    return (
        <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex items-center gap-2">
                <Link href="/sales-orders" className="p-2 hover:bg-muted rounded-md transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl font-bold font-mono">{so.soNumber}</h1>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_BADGE[so.status]}`}>
                            {STATUS_LABEL[so.status]}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Dibuat {dayjs(so.createdAt).format('DD MMM YYYY HH:mm')}
                        {so.sentToWaAt && ` • Terakhir dikirim ${dayjs(so.sentToWaAt).format('DD MMM HH:mm')}`}
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-destructive/12 border border-destructive/30 text-destructive px-3 py-2 rounded-md text-sm">
                    {error}
                </div>
            )}

            {so.status === 'INVOICED' && so.transaction && (
                <div className="bg-success/15 border border-success/30 rounded-md p-3 text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <div className="flex-1">
                        SO ini sudah dibuatkan nota: <span className="font-mono font-semibold">{so.transaction.invoiceNumber}</span>
                        {so.transaction.status && ` — ${so.transaction.status}`}
                    </div>
                    <Link href={`/transactions/dp?search=${so.transaction.invoiceNumber}`} className="text-success hover:underline text-xs flex items-center gap-1">
                        Lihat <ExternalLink className="h-3 w-3" />
                    </Link>
                </div>
            )}

            {so.status === 'CANCELLED' && so.cancelReason && (
                <div className="bg-destructive/12 border border-destructive/30 rounded-md p-3 text-sm text-destructive">
                    <span className="font-semibold">Dibatalkan:</span> {so.cancelReason}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left column — customer + items */}
                <div className="lg:col-span-2 space-y-4">
                    <Section title="Customer">
                        <div className="space-y-1.5 text-sm">
                            <Row icon={<User className="h-4 w-4 text-muted-foreground" />}>{so.customerName}</Row>
                            {so.customerPhone && <Row icon={<Phone className="h-4 w-4 text-muted-foreground" />}>{so.customerPhone}</Row>}
                            {so.customerAddress && <Row icon={<MapPin className="h-4 w-4 text-muted-foreground" />}>{so.customerAddress}</Row>}
                            <Row icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                <span className="text-xs text-muted-foreground">Desainer:</span> {so.designerName}
                            </Row>
                            {so.deadline && (
                                <Row icon={<Calendar className="h-4 w-4 text-muted-foreground" />}>
                                    <span className="text-xs text-muted-foreground">Deadline:</span> {dayjs(so.deadline).format('DD MMM YYYY HH:mm')}
                                </Row>
                            )}
                        </div>
                    </Section>

                    <Section title={`Item (${totalItems})`}>
                        <div className="space-y-2">
                            {so.items.map((it, idx) => {
                                const p = it.productVariant?.product?.name ?? 'Produk';
                                const v = it.productVariant?.variantName ? ` — ${it.productVariant.variantName}` : '';
                                return (
                                    <div key={it.id} className="border border-border rounded-md p-2.5 text-sm bg-muted/20">
                                        <div className="flex justify-between gap-2">
                                            <div className="font-medium">{idx + 1}. {p}{v}</div>
                                            <div className="text-xs text-muted-foreground font-mono">SKU: {it.productVariant?.sku}</div>
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                                            <span>Qty: <b className="text-foreground nums">{it.quantity}</b></span>
                                            {it.widthCm && it.heightCm && (
                                                <span>Dim: <b className="text-foreground nums">{it.widthCm}×{it.heightCm} {it.unitType || 'cm'}</b></span>
                                            )}
                                            {it.pcs && it.pcs > 1 && <span>Pcs: <b className="text-foreground nums">{it.pcs}</b></span>}
                                            {it.customPrice && <span>Harga Override: <b className="text-foreground nums">Rp {Number(it.customPrice).toLocaleString('id-ID')}</b></span>}
                                        </div>
                                        {it.note && <div className="text-xs italic text-muted-foreground mt-1">&ldquo;{it.note}&rdquo;</div>}
                                    </div>
                                );
                            })}
                        </div>
                    </Section>

                    {so.notes && (
                        <Section title="Catatan Order">
                            <p className="text-sm whitespace-pre-wrap">{so.notes}</p>
                        </Section>
                    )}

                    <Section title={`Proof Gambar (${so.proofs?.length ?? 0})`}>
                        {canEdit && (
                            <label className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-md cursor-pointer hover:bg-muted text-sm mb-3 transition-colors">
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                Tambah Gambar
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={handleProofUpload}
                                    disabled={uploading}
                                    className="hidden"
                                />
                            </label>
                        )}
                        {(so.proofs?.length ?? 0) === 0 ? (
                            <p className="text-xs text-muted-foreground">Belum ada gambar proof.</p>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {so.proofs.map(p => (
                                    <div key={p.id} className="relative group border border-border rounded overflow-hidden">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={proofUrl(p.filename)}
                                            alt={p.caption ?? 'proof'}
                                            className="w-full h-32 object-cover"
                                        />
                                        {canEdit && (
                                            <button
                                                onClick={() => deleteProofMut.mutate(p.id)}
                                                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-colors cursor-pointer"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Section>
                </div>

                {/* Right column — actions */}
                <div className="space-y-4">
                    {canInvoice && (
                        <Section title="Buat Nota / Invoice">
                            <p className="text-xs text-muted-foreground mb-2">
                                Bawa ke halaman kasir dengan item SO ter-prefill. Setelah nota terbit, SO otomatis berstatus INVOICED.
                            </p>
                            <button
                                onClick={() => router.push(`/pos?fromSO=${so.id}`)}
                                className="w-full inline-flex items-center justify-center gap-2 bg-success text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-success/90 transition-colors cursor-pointer"
                            >
                                <FileText className="h-4 w-4" />
                                Buat Nota di POS
                            </button>
                        </Section>
                    )}

                    {canEdit && (
                        <Section title="Edit SO">
                            <Link
                                href={`/sales-orders/new?edit=${so.id}`}
                                className="w-full inline-flex items-center justify-center gap-2 border border-border px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
                            >
                                <Edit3 className="h-4 w-4" />
                                Edit (belum tersedia)
                            </Link>
                            <p className="text-[11px] text-muted-foreground mt-2">
                                Fitur edit detail akan ditambahkan pada update berikut.
                            </p>
                        </Section>
                    )}

                    {canCancel && (
                        <Section title="Batalkan SO">
                            {!showCancel ? (
                                <button
                                    onClick={() => setShowCancel(true)}
                                    className="w-full inline-flex items-center justify-center gap-2 border border-destructive/30 text-destructive px-3 py-2 rounded-md text-sm font-medium hover:bg-destructive/12 transition-colors cursor-pointer"
                                >
                                    <XCircle className="h-4 w-4" /> Batalkan SO
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <textarea
                                        value={cancelReason}
                                        onChange={e => setCancelReason(e.target.value)}
                                        placeholder="Alasan pembatalan..."
                                        className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                                        rows={3}
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setShowCancel(false); setCancelReason(''); }}
                                            className="flex-1 px-3 py-1.5 text-sm border border-border rounded hover:bg-muted transition-colors cursor-pointer"
                                        >
                                            Batal
                                        </button>
                                        <button
                                            onClick={() => cancelMut.mutate()}
                                            disabled={!cancelReason.trim() || cancelMut.isPending}
                                            className="flex-1 inline-flex items-center justify-center gap-1 bg-destructive text-destructive-foreground px-3 py-1.5 rounded text-sm hover:bg-destructive/90 disabled:opacity-50 transition-colors cursor-pointer"
                                        >
                                            {cancelMut.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                                            Konfirmasi
                                        </button>
                                    </div>
                                </div>
                            )}
                        </Section>
                    )}
                </div>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="glass rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3">{title}</h2>
            {children}
        </div>
    );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-2">
            <div className="mt-0.5">{icon}</div>
            <div className="flex-1">{children}</div>
        </div>
    );
}
