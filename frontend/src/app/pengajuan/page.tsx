"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, ChevronRight, ShieldCheck } from "lucide-react";
import { getPengajuanList, getPengajuanPendingCount } from "@/lib/api/pengajuan";
import { PengajuanFormModal } from "@/components/PengajuanFormModal";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function PengajuanListInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isManager } = useCurrentUser();
  const eventIdParam = searchParams.get("eventId");
  const eventId = eventIdParam ? Number(eventIdParam) : undefined;
  const [formOpen, setFormOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pengajuan-list", eventId ?? null],
    queryFn: () => getPengajuanList(eventId),
  });

  const { data: pending } = useQuery({
    queryKey: ["pengajuan-pending-count"],
    queryFn: getPengajuanPendingCount,
    enabled: isManager,
  });
  const pendingCount = pending?.count ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Pengajuan (Pra-RAB)
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Usulan item per event. Disetujui owner per item, lalu convert ke RAB.
          </p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> Buat Pengajuan
        </button>
      </div>

      {isManager && pendingCount > 0 && (
        <Link
          href="/owner"
          className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors"
        >
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">
            {pendingCount} item menunggu persetujuan
          </span>
          <span className="ml-auto text-xs underline">Buka Panel Owner</span>
        </Link>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-10 text-center">Memuat…</div>
      ) : rows.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-14 text-center text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Belum ada pengajuan. Buat pengajuan pertama untuk sebuah event.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/pengajuan/${p.id}`)}
              className="w-full text-left bg-card border border-border rounded-lg p-3 hover:border-primary/50 transition-colors flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{p.title || "Tanpa judul"}</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                      p.status === "DONE"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.status === "DONE" ? "Selesai" : "Terbuka"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                  {p.event && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                      {p.event.code}
                    </span>
                  )}
                  <span>{p.event?.name}</span>
                  <span>· {p._count?.items ?? 0} item</span>
                  {p.createdBy?.name && <span>· oleh {p.createdBy.name}</span>}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}

      <PengajuanFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        defaultEventId={eventId}
        onSaved={(id) => router.push(`/pengajuan/${id}`)}
      />
    </div>
  );
}

export default function PengajuanListPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Memuat…</div>}>
      <PengajuanListInner />
    </Suspense>
  );
}
