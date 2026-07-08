"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Eye, LogOut, Loader2, FileSignature } from "lucide-react";
import { designerListSOs } from "@/lib/api/designers";
import { useDesignerSession, clearDesignerSession } from "../useDesignerSession";
import type { SalesOrder, SalesOrderStatus } from "@/lib/api/sales-orders";
import dayjs from "dayjs";
import "dayjs/locale/id";

dayjs.locale("id");

const STATUS_BADGE: Record<SalesOrderStatus, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    SENT: "bg-info/15 text-info",
    INVOICED: "bg-success/15 text-success",
    CANCELLED: "bg-destructive/12 text-destructive",
};
const STATUS_LABEL: Record<SalesOrderStatus, string> = {
    DRAFT: "Draft",
    SENT: "Terkirim WA",
    INVOICED: "Sudah Nota",
    CANCELLED: "Dibatalkan",
};

export default function DesignerDashboardPage() {
    const router = useRouter();
    const session = useDesignerSession();
    const [sos, setSos] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!session) return;
        designerListSOs(session.id, session.pin)
            .then(setSos)
            .catch(() => setError("Gagal memuat data SO"))
            .finally(() => setLoading(false));
    }, [session]);

    function logout() {
        clearDesignerSession();
        router.replace("/so-designer");
    }

    if (!session) return null;

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shadow">
                <div className="flex items-center gap-2">
                    <FileSignature className="h-5 w-5" />
                    <div>
                        <div className="font-semibold">Portal Desainer</div>
                        <div className="text-xs text-primary-foreground/70">Halo, {session.name} 👋</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/so-designer/new"
                        className="inline-flex items-center gap-1 bg-background text-primary px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-primary/5 transition-colors"
                    >
                        <Plus className="h-3.5 w-3.5" /> Buat SO
                    </Link>
                    <button onClick={logout} className="p-1.5 hover:bg-primary/80 rounded-lg cursor-pointer transition-colors">
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-4 space-y-4">
                <h2 className="font-semibold text-foreground">Sales Order Kamu</h2>

                {error && <div className="bg-destructive/12 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-sm">{error}</div>}

                {loading ? (
                    <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : sos.length === 0 ? (
                    <div className="glass rounded-xl p-10 text-center text-muted-foreground text-sm">
                        Belum ada SO. Klik &ldquo;Buat SO&rdquo; untuk mulai.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {sos.map(so => (
                            <div key={so.id} className="glass rounded-xl p-3 flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs font-bold text-foreground nums">{so.soNumber}</span>
                                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[so.status]}`}>
                                            {STATUS_LABEL[so.status]}
                                        </span>
                                    </div>
                                    <div className="text-sm font-medium text-foreground truncate mt-0.5">{so.customerName}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {so.items.length} item • {dayjs(so.createdAt).format("DD MMM YYYY")}
                                        {so.deadline && <> • Deadline: {dayjs(so.deadline).format("DD MMM")}</>}
                                    </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <Link
                                        href={`/so-designer/detail/${so.id}`}
                                        className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground transition-colors"
                                        title="Detail"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Link>
                                    {so.status === "INVOICED" && so.transaction && (
                                        <span className="p-2 rounded-lg bg-success/15 text-success text-xs font-mono nums">
                                            {so.transaction.invoiceNumber}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
