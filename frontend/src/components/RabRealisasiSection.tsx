"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Loader2 } from "lucide-react";
import { getRealisasiRab } from "@/lib/api/belanja";

const rp = (v: string | number) => "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

interface Props {
  rabPlanId: number;
}

/** Realisasi belanja (real cost) vs rencana per pos — bersumber dari Buku Belanja Harian yang di-tag ke RAB ini. */
export function RabRealisasiSection({ rabPlanId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["realisasi-rab", rabPlanId],
    queryFn: () => getRealisasiRab(rabPlanId),
    enabled: Number.isFinite(rabPlanId) && rabPlanId > 0,
  });

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Realisasi Belanja (Real Cost)
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Bersumber dari Buku Belanja Harian yang di-tag ke RAB ini.</p>
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Memuat…
        </div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/50 p-2">
              <div className="text-[11px] text-muted-foreground">Rencana</div>
              <div className="font-semibold text-sm">{rp(data.totalRencana)}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-2">
              <div className="text-[11px] text-muted-foreground">Real (Belanja)</div>
              <div className="font-semibold text-sm">{rp(data.totalReal)}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-2">
              <div className="text-[11px] text-muted-foreground">Selisih</div>
              <div className={`font-semibold text-sm ${data.selisih < 0 ? "text-destructive" : "text-emerald-600"}`}>{rp(data.selisih)}</div>
            </div>
          </div>

          {data.pos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Belum ada pos anggaran di RAB ini.</p>
          ) : (
            <div className="space-y-2">
              {data.pos.map((p) => {
                const pct = p.rencana > 0 ? Math.min(100, (p.real / p.rencana) * 100) : p.real > 0 ? 100 : 0;
                return (
                  <div key={p.categoryId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground">
                        {rp(p.real)} <span className="text-[11px]">/ {rp(p.rencana)}</span>
                        {p.overspend && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-semibold">Over</span>}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded bg-muted overflow-hidden">
                      <div className={`h-full ${p.overspend ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {data.tanpaPos > 0 && (
            <p className="text-xs text-muted-foreground">
              Belanja tanpa pos: <span className="font-medium">{rp(data.tanpaPos)}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
