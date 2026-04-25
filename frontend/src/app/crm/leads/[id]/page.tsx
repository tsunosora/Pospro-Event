"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { getLead } from "@/lib/api/crm";
import { LeadDrawer } from "@/components/crm/LeadDrawer";

export default function LeadDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const leadId = Number(id);
    const router = useRouter();

    const { data: lead, isLoading } = useQuery({
        queryKey: ["crm-lead", leadId],
        queryFn: () => getLead(leadId),
        enabled: Number.isFinite(leadId),
    });

    return (
        <div className="p-4 space-y-3">
            <Link
                href="/crm/board"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Pipeline
            </Link>

            <div className="rounded-lg border border-border bg-card p-6 max-w-2xl">
                {isLoading && (
                    <div className="text-sm text-muted-foreground">Memuat lead #{leadId}...</div>
                )}
                {!isLoading && !lead && (
                    <div className="text-sm text-destructive">Lead tidak ditemukan.</div>
                )}
                {lead && (
                    <div>
                        <h1 className="text-xl font-bold">
                            {lead.name?.trim() || `Lead #${lead.id}`}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Detail lead dibuka di panel samping. Tutup panel untuk kembali ke board.
                        </p>
                    </div>
                )}
            </div>

            <LeadDrawer
                leadId={Number.isFinite(leadId) ? leadId : null}
                open={Number.isFinite(leadId)}
                onClose={() => router.push("/crm/board")}
            />
        </div>
    );
}
