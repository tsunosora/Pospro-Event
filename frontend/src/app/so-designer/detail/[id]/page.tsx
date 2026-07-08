"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, XCircle, Upload, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { designerGetSO, designerCancelSO, designerUploadProofs, designerDeleteProof } from "@/lib/api/designers";
import { useDesignerSession } from "../../useDesignerSession";
import type { SalesOrder, SalesOrderStatus } from "@/lib/api/sales-orders";
import dayjs from "dayjs";
import "dayjs/locale/id";

dayjs.locale("id");

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function proofUrl(filename: string) {
    const rel = filename.replace(/^public[\\/]/i, "/").replace(/\\/g, "/");
    return `${API_URL}${rel.startsWith("/") ? rel : "/" + rel}`;
}

const STATUS_BADGE: Record<SalesOrderStatus, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    SENT: "bg-info/15 text-info",
    INVOICED: "bg-success/15 text-success",
    CANCELLED: "bg-destructive/12 text-destructive",
};
const STATUS_LABEL: Record<SalesOrderStatus, string> = {
    DRAFT: "Draft",
    SENT: "Terkirim ke Group WA",
    INVOICED: "Sudah Dibuatkan Nota",
    CANCELLED: "Dibatalkan",
};

export default function DesignerSODetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const session = useDesignerSession();

    const [so, setSo] = useState<SalesOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCancel, setShowCancel] = useState(false);
    const [cancelReason, setCancelReason] = useState("");
    const [uploading, setUploading] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    async function reload() {
        setLoading(true);
        try {
            setSo(await designerGetSO(Number(id)));
        } catch {
            setError("Gagal memuat SO");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { if (id) reload(); }, [id]);


    async function cancel() {
        if (!session || !so) return;
        setCancelling(true); setError(null);
        try {
            await designerCancelSO(so.id, session.id, session.pin, cancelReason.trim());
            await reload();
            setShowCancel(false); setCancelReason("");
        } catch (e: any) {
            setError(e?.response?.data?.message || "Gagal batalkan SO");
        } finally {
            setCancelling(false);
        }
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!session || !so) return;
        const files = e.target.files;
        if (!files?.length) return;
        setUploading(true);
        try {
            await designerUploadProofs(so.id, session.id, session.pin, Array.from(files));
            await reload();
        } catch (e: any) {
            setError(e?.response?.data?.message || "Gagal upload");
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    }

    async function removeProof(proofId: number) {
        if (!session || !so) return;
        try {
            await designerDeleteProof(so.id, proofId, session.id, session.pin);
            await reload();
        } catch (e: any) {
            setError(e?.response?.data?.message || "Gagal hapus proof");
        }
    }

    if (!session) return null;

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
        </div>
    );

    if (!so) return (
        <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">SO tidak ditemukan</div>
    );

    const canEdit = so.status === "DRAFT" || so.status === "SENT";
    const canCancel = so.status === "DRAFT" || so.status === "SENT";

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3 shadow sticky top-0 z-10">
                <Link href="/so-designer/dashboard" className="p-1.5 hover:bg-primary/80 rounded-lg transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm">{so.soNumber}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[so.status]}`}>
                            {STATUS_LABEL[so.status]}
                        </span>
                    </div>
                    <div className="text-xs text-primary-foreground/70 truncate">{so.customerName}</div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-4 space-y-4">
                {error && <div className="bg-destructive/12 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-sm">{error}</div>}

                {so.status === "INVOICED" && so.transaction && (
                    <div className="bg-success/15 border border-success/30 rounded-xl p-3 flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                        <div className="text-foreground">Nota sudah dibuat: <span className="font-mono font-semibold">{so.transaction.invoiceNumber}</span></div>
                    </div>
                )}

                {/* Customer & info */}
                <Card title="Detail Order">
                    <dl className="text-sm space-y-1">
                        <Row label="Customer">{so.customerName}</Row>
                        {so.customerPhone && <Row label="HP">{so.customerPhone}</Row>}
                        {so.customerAddress && <Row label="Alamat">{so.customerAddress}</Row>}
                        <Row label="Desainer">{so.designerName}</Row>
                        {so.deadline && <Row label="Deadline">{dayjs(so.deadline).format("DD MMM YYYY HH:mm")}</Row>}
                        {so.notes && <Row label="Catatan">{so.notes}</Row>}
                    </dl>
                </Card>

                {/* Items */}
                <Card title={`Item (${so.items.length})`}>
                    <div className="space-y-2">
                        {so.items.map((it, idx) => (
                            <div key={it.id} className="border border-border rounded-lg p-2.5 text-sm bg-muted">
                                <div className="font-medium text-foreground">{idx + 1}. {it.productVariant?.product?.name}{it.productVariant?.variantName ? ` — ${it.productVariant.variantName}` : ""}</div>
                                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                                    <span>Qty: <b className="text-foreground">{it.quantity}</b></span>
                                    {it.widthCm && it.heightCm && <span>Dim: <b className="text-foreground">{it.widthCm}×{it.heightCm}{it.unitType || "cm"}</b></span>}
                                    {it.pcs && it.pcs > 1 && <span>Pcs: <b className="text-foreground">{it.pcs}</b></span>}
                                </div>
                                {it.note && <div className="text-xs italic text-muted-foreground mt-0.5">&ldquo;{it.note}&rdquo;</div>}
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Proofs */}
                <Card title={`Gambar Proof (${so.proofs?.length ?? 0})`}>
                    {canEdit && (
                        <label className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted text-sm text-muted-foreground mb-3 transition-colors">
                            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            Tambah Gambar
                            <input type="file" multiple accept="image/*" onChange={handleUpload} disabled={uploading} className="hidden" />
                        </label>
                    )}
                    {(so.proofs?.length ?? 0) === 0 ? (
                        <p className="text-xs text-muted-foreground">Belum ada gambar proof.</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {so.proofs.map(p => (
                                <div key={p.id} className="relative group rounded-lg overflow-hidden border border-border">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={proofUrl(p.filename)} alt="proof" className="w-full h-32 object-cover" />
                                    {canEdit && (
                                        <button onClick={() => removeProof(p.id)}
                                            className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Batalkan */}
                {canCancel && (
                    <Card title="Batalkan SO">
                        {!showCancel ? (
                            <button onClick={() => setShowCancel(true)}
                                className="w-full inline-flex items-center justify-center gap-2 border border-destructive/30 text-destructive py-2.5 rounded-xl text-sm font-medium hover:bg-destructive/12 cursor-pointer transition-colors">
                                <XCircle className="h-4 w-4" /> Batalkan SO
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                                    placeholder="Alasan pembatalan..."
                                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground" rows={3} />
                                <div className="flex gap-2">
                                    <button onClick={() => { setShowCancel(false); setCancelReason(""); }}
                                        className="flex-1 py-2 text-sm border border-border rounded-xl hover:bg-muted cursor-pointer transition-colors">Batal</button>
                                    <button onClick={cancel} disabled={!cancelReason.trim() || cancelling}
                                        className="flex-1 inline-flex items-center justify-center gap-1 bg-destructive text-destructive-foreground py-2 rounded-xl text-sm hover:bg-destructive/90 disabled:opacity-50 cursor-pointer transition-colors">
                                        {cancelling && <Loader2 className="h-3 w-3 animate-spin" />} Konfirmasi
                                    </button>
                                </div>
                            </div>
                        )}
                    </Card>
                )}
            </div>
        </div>
    );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
            {children}
        </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex gap-2">
            <span className="text-muted-foreground w-20 shrink-0">{label}:</span>
            <span className="text-foreground">{children}</span>
        </div>
    );
}
