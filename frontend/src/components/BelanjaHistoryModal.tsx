"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Loader2, ReceiptText, ImageIcon, Calendar, User } from "lucide-react";
import { getBelanja } from "@/lib/api/belanja";

const rp = (v: string | number) => "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}
const isImage = (url: string) => /\.(jpg|jpeg|jfif|png|webp|gif)$/i.test(url);

/** Riwayat belanja untuk satu item RAB — nominal, tanggal, admin, dan bukti nota/transfer. */
export function BelanjaHistoryModal({ rabItemId, itemName, onClose }: { rabItemId: number; itemName: string; onClose: () => void }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["belanja-item", rabItemId],
    // Filter server-side; filter ulang di klien sebagai pengaman (mis. server belum di-restart)
    queryFn: async () => {
      const rows = await getBelanja({ rabItemId });
      return rows.filter((r) => r.rabItemId === rabItemId);
    },
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const total = data.reduce((a, b) => a + Number(b.amount), 0);

  return (
    <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-primary" /> Riwayat Belanja
            </h2>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{itemName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin inline" />
          </div>
        ) : data.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Belum ada belanja untuk item ini.</div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{data.length} transaksi</span>
              <span className="font-semibold">Total {rp(total)}</span>
            </div>
            {data.map((b) => (
              <div key={b.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{b.description}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {fmtDate(b.spentAt)}</span>
                      {b.createdBy?.name && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {b.createdBy.name}</span>}
                    </div>
                  </div>
                  <span className="font-semibold text-sm whitespace-nowrap">{rp(b.amount)}</span>
                </div>

                {b.notaUrl ? (
                  isImage(b.notaUrl) ? (
                    <a href={`${apiBase}${b.notaUrl}`} target="_blank" rel="noreferrer" className="block mt-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${apiBase}${b.notaUrl}`} alt="Bukti" className="max-h-40 rounded border border-border object-contain bg-muted/30" />
                    </a>
                  ) : (
                    <a
                      href={`${apiBase}${b.notaUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ImageIcon className="h-3.5 w-3.5" /> Lihat bukti / nota
                    </a>
                  )
                ) : (
                  <div className="mt-2 text-[11px] text-muted-foreground/60 italic">Tanpa bukti nota</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
