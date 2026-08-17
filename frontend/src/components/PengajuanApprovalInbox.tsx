"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCheck, ShieldCheck, Loader2 } from "lucide-react";
import {
  getPengajuanPending,
  approvePengajuanItems,
  type PendingApprovalGroup,
} from "@/lib/api/pengajuan";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const rp = (v: string | number) =>
  "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

/** Inbox persetujuan pengajuan pra-RAB — dipakai di Panel Owner. Owner/admin only. */
export function PengajuanApprovalInbox() {
  const qc = useQueryClient();
  const { isManager } = useCurrentUser();
  const [error, setError] = useState<string | null>(null);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["pengajuan-pending"],
    queryFn: getPengajuanPending,
    enabled: isManager,
  });

  const approveMut = useMutation({
    mutationFn: (itemIds: number[]) => approvePengajuanItems(itemIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pengajuan-pending"] });
      qc.invalidateQueries({ queryKey: ["pengajuan-pending-count"] });
      qc.invalidateQueries({ queryKey: ["pengajuan-list"] });
      qc.invalidateQueries({ queryKey: ["pengajuan"] });
    },
    onError: (e: any) => setError(e?.response?.data?.message || "Gagal menyetujui"),
  });

  const allIds = groups.flatMap((g) => g.items.map((it) => it.id));

  if (!isManager) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Hanya owner/admin yang dapat mengakses persetujuan.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-sm text-muted-foreground">
          {allIds.length > 0
            ? `${allIds.length} item menunggu persetujuan.`
            : "Tidak ada item menunggu."}
        </p>
        {allIds.length > 0 && (
          <button
            onClick={() => approveMut.mutate(allIds)}
            disabled={approveMut.isPending}
            className="px-3 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:opacity-90 flex items-center gap-1.5 disabled:opacity-60"
          >
            {approveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
            Setujui semua
          </button>
        )}
      </div>

      {error && <div className="p-2.5 mb-3 bg-destructive/15 text-destructive rounded text-sm">{error}</div>}

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-10 text-center">Memuat…</div>
      ) : groups.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-14 text-center text-muted-foreground">
          <CheckCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Semua item sudah disetujui. Tidak ada yang menunggu.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g: PendingApprovalGroup) => {
            const groupIds = g.items.map((it) => it.id);
            return (
              <div key={g.pengajuanId} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30">
                  <Link href={`/pengajuan/${g.pengajuanId}`} className="min-w-0 hover:underline">
                    <span className="font-medium">{g.title || "Tanpa judul"}</span>
                    {g.event && (
                      <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                        {g.event.code}
                      </span>
                    )}
                    {g.event?.name && (
                      <span className="ml-1 text-xs text-muted-foreground">{g.event.name}</span>
                    )}
                  </Link>
                  <button
                    onClick={() => approveMut.mutate(groupIds)}
                    disabled={approveMut.isPending}
                    className="shrink-0 px-2 py-1 rounded text-xs border border-emerald-600 text-emerald-700 hover:bg-emerald-50 flex items-center gap-1 disabled:opacity-60"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Setujui grup
                  </button>
                </div>
                <div className="divide-y divide-border/60">
                  {g.items.map((it) => (
                    <div key={it.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{it.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {it.category?.name ? `${it.category.name} · ` : ""}
                          {Number(it.quantity)} {it.unit || ""} × {rp(it.price)}
                          {" = "}
                          <span className="font-medium text-foreground">
                            {rp(Number(it.quantity) * Number(it.price))}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => approveMut.mutate([it.id])}
                        disabled={approveMut.isPending}
                        className="shrink-0 px-2 py-1 rounded text-xs bg-emerald-600 text-white hover:opacity-90 flex items-center gap-1 disabled:opacity-60"
                      >
                        <Check className="h-3.5 w-3.5" /> Setujui
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
