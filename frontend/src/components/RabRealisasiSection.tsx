"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TrendingUp, Loader2, FileDown, Plus } from "lucide-react";
import { getRealisasiRab, downloadBelanjaPdf, type RealisasiItemStatus } from "@/lib/api/belanja";
import { CatatBelanjaSheet } from "@/components/CatatBelanjaSheet";

const rp = (v: string | number) => "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

interface Props {
  rabPlanId: number;
}

const STATUS_BADGE: Record<RealisasiItemStatus, { label: string; cls: string }> = {
  belum: { label: "Belum dibeli", cls: "bg-muted text-muted-foreground" },
  hemat: { label: "Hemat", cls: "bg-emerald-100 text-emerald-700" },
  boros: { label: "Boros", cls: "bg-destructive/15 text-destructive" },
  pas: { label: "Pas", cls: "bg-blue-100 text-blue-700" },
};

/**
 * Modal (Rencana, dari pengajuan) vs Real (Belanja Harian) per item RAB.
 * priceCost = MODAL/RENCANA; real cost berasal dari Buku Belanja Harian yang di-tag ke RAB ini.
 */
export function RabRealisasiSection({ rabPlanId }: Props) {
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["realisasi-rab", rabPlanId],
    queryFn: () => getRealisasiRab(rabPlanId),
    enabled: Number.isFinite(rabPlanId) && rabPlanId > 0,
  });

  const selisihTone = (v: number) => (v < 0 ? "text-destructive" : v > 0 ? "text-emerald-600" : "text-muted-foreground");

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Modal vs Real Cost
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            <b>Modal</b> = rencana (dari pengajuan). <b>Real</b> = belanja harian aktual. Selisih menunjukkan hemat/boros.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={() => setSheetOpen(true)}
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-2.5 py-1.5 rounded-md text-xs hover:opacity-90"
            title="Catat belanja untuk RAB ini"
          >
            <Plus className="h-3.5 w-3.5" /> Catat Belanja
          </button>
          <button
            onClick={() => downloadBelanjaPdf({ rabPlanId }, `laporan-belanja-rab-${rabPlanId}.pdf`)}
            className="inline-flex items-center gap-1.5 border border-border px-2.5 py-1.5 rounded-md text-xs hover:bg-muted"
            title="Export laporan belanja RAB ini ke PDF"
          >
            <FileDown className="h-3.5 w-3.5" /> Export PDF
          </button>
        </div>
      </div>

      <CatatBelanjaSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        defaultRabPlanId={rabPlanId}
        onSaved={() => qc.invalidateQueries({ queryKey: ["realisasi-rab", rabPlanId] })}
      />

      {isLoading ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Memuat…
        </div>
      ) : !data ? null : (
        <>
          {/* Ringkasan */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/50 p-2">
              <div className="text-[11px] text-muted-foreground">Total Modal</div>
              <div className="font-semibold text-sm">{rp(data.totalModal)}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-2">
              <div className="text-[11px] text-muted-foreground">Total Real (Belanja)</div>
              <div className="font-semibold text-sm">{rp(data.totalReal)}</div>
              {data.totalExtra > 0 && (
                <div className="text-[10px] text-muted-foreground">termasuk {rp(data.totalExtra)} di luar modal</div>
              )}
            </div>
            <div className="rounded-lg bg-muted/50 p-2">
              <div className="text-[11px] text-muted-foreground">Selisih</div>
              <div className={`font-semibold text-sm ${selisihTone(data.selisih)}`}>
                {rp(data.selisih)}
              </div>
              <div className="text-[10px] text-muted-foreground">{data.selisih < 0 ? "boros" : data.selisih > 0 ? "hemat" : "pas"}</div>
            </div>
          </div>

          {/* Tabel per item modal */}
          {data.perItem.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Belum ada item modal di RAB ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-muted-foreground border-b border-border">
                    <th className="py-1.5 pr-2 font-medium">Item</th>
                    <th className="py-1.5 px-2 font-medium text-right">Modal</th>
                    <th className="py-1.5 px-2 font-medium text-right">Real</th>
                    <th className="py-1.5 px-2 font-medium text-right">Selisih</th>
                    <th className="py-1.5 pl-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.perItem.map((it) => {
                    const badge = STATUS_BADGE[it.status];
                    return (
                      <tr key={it.rabItemId} className="border-b border-border/50">
                        <td className="py-1.5 pr-2">
                          <div className="truncate max-w-[180px]">{it.description}</div>
                          {it.categoryName && (
                            <div className="text-[10px] text-muted-foreground">{it.categoryName}</div>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-right whitespace-nowrap">{rp(it.modal)}</td>
                        <td className="py-1.5 px-2 text-right whitespace-nowrap font-medium">{rp(it.real)}</td>
                        <td className={`py-1.5 px-2 text-right whitespace-nowrap ${selisihTone(it.selisih)}`}>
                          {rp(it.selisih)}
                        </td>
                        <td className="py-1.5 pl-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Item di luar modal (tambahan saat belanja) */}
          {data.extra.length > 0 && (
            <div className="pt-2 border-t border-border">
              <div className="text-xs font-medium text-amber-700 mb-1.5">
                Di luar modal (item tambahan saat belanja)
              </div>
              <div className="space-y-1">
                {data.extra.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-sm gap-2">
                    <span className="truncate">
                      {e.description}
                      {e.categoryName && <span className="text-[10px] text-muted-foreground ml-1.5">{e.categoryName}</span>}
                      {e.count > 1 && <span className="text-[10px] text-muted-foreground ml-1">×{e.count}</span>}
                    </span>
                    <span className="font-medium text-amber-700 whitespace-nowrap">{rp(e.real)}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Pengeluaran ini tidak ada di modal pengajuan — tetap tercatat sebagai real cost.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
