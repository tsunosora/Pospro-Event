"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, ShoppingCart, Plus, ArrowDownCircle, Trash2, Pencil, ReceiptText, Users, AlertTriangle, Loader2, FileDown } from "lucide-react";
import { getKasSummary, getKasByAdmin, getRekapHarian, deleteBelanja, downloadBelanjaPdf, type BelanjaRow } from "@/lib/api/belanja";
import { getUsers } from "@/lib/api/settings";
import { DateRangeFilter, presetToRange, type DateRange } from "@/components/DateRangeFilter";
import { CatatBelanjaSheet } from "@/components/CatatBelanjaSheet";
import { UangMasukModal } from "@/components/UangMasukModal";

const rp = (v: string | number) => "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
type UserOpt = { id: number; name?: string | null };

function tanggalLabel(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function BelanjaPage() {
  const qc = useQueryClient();
  const [adminFilter, setAdminFilter] = useState<number | "">("");
  const [dateRange, setDateRange] = useState<DateRange>({ preset: "THIS_MONTH" });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<BelanjaRow | null>(null);
  const [uangMasukOpen, setUangMasukOpen] = useState(false);

  const userId = adminFilter === "" ? undefined : Number(adminFilter);
  const { from, to } = useMemo(() => {
    const r = presetToRange(dateRange.preset, { from: dateRange.fromDate, to: dateRange.toDate });
    return { from: r.from?.toISOString(), to: r.to?.toISOString() };
  }, [dateRange]);

  const { data: users = [] } = useQuery<UserOpt[]>({ queryKey: ["users"], queryFn: getUsers, staleTime: 5 * 60 * 1000 });
  const { data: summary } = useQuery({ queryKey: ["kas-summary", userId ?? null], queryFn: () => getKasSummary(userId) });
  const { data: byAdmin = [] } = useQuery({ queryKey: ["kas-by-admin"], queryFn: getKasByAdmin, enabled: adminFilter === "" });
  const { data: rekap = [], isLoading } = useQuery({ queryKey: ["rekap-belanja", from, to], queryFn: () => getRekapHarian({ from, to }) });

  const rekapFiltered = useMemo(() => {
    if (!userId) return rekap;
    return rekap
      .map((h) => ({ ...h, items: h.items.filter((i) => i.createdBy?.id === userId) }))
      .map((h) => ({ ...h, total: h.items.reduce((a, i) => a + Number(i.amount), 0) }))
      .filter((h) => h.items.length > 0);
  }, [rekap, userId]);

  const delMut = useMutation({
    mutationFn: (id: number) => deleteBelanja(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kas-summary"] });
      qc.invalidateQueries({ queryKey: ["kas-by-admin"] });
      qc.invalidateQueries({ queryKey: ["rekap-belanja"] });
      qc.invalidateQueries({ queryKey: ["belanja"] });
    },
  });

  function tagBadge(b: BelanjaRow) {
    if (b.event) {
      return <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{b.event.code}</span>;
    }
    if (b.rabPlan) {
      return <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{b.rabPlan.code}</span>;
    }
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">{b.category || "Lainnya"}</span>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" /> Buku Belanja Harian
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => downloadBelanjaPdf({ from, to })}
            className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 rounded-md text-sm hover:bg-muted"
            title="Export laporan belanja periode ini ke PDF"
          >
            <FileDown className="h-4 w-4" /> Export PDF
          </button>
          <button
            onClick={() => setUangMasukOpen(true)}
            className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 rounded-md text-sm hover:bg-muted"
          >
            <ArrowDownCircle className="h-4 w-4 text-emerald-600" /> Uang Masuk
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Catat Belanja
          </button>
        </div>
      </div>

      {/* Selektor admin */}
      {users.length > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <select
            value={adminFilter}
            onChange={(e) => setAdminFilter(e.target.value === "" ? "" : Number(e.target.value))}
            className="border border-border bg-card rounded px-2 py-1.5 text-sm"
          >
            <option value="">Semua admin</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || `User #${u.id}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Ringkasan saldo (gaya BudgetBakers) */}
      <div className="rounded-xl border border-border p-5 bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="h-4 w-4" /> Saldo Kas {userId ? "(admin terpilih)" : ""}
        </div>
        <div className={`text-3xl font-bold mt-1 ${summary && summary.saldo < 0 ? "text-destructive" : ""}`}>
          {rp(summary?.saldo ?? 0)}
        </div>
        <div className="flex gap-4 mt-2 text-sm">
          <span className="text-emerald-600">Masuk {rp(summary?.masuk ?? 0)}</span>
          <span className="text-destructive">Belanja {rp(summary?.keluar ?? 0)}</span>
        </div>
        {!!summary?.untaggedCount && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-amber-500/15 text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" /> {summary.untaggedCount} belanja belum di-tag
          </div>
        )}
      </div>

      {/* Saldo per admin */}
      {adminFilter === "" && byAdmin.length > 1 && (
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs font-medium text-muted-foreground mb-2">Saldo per admin</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {byAdmin.map((a) => (
              <div key={a.userId} className="text-sm flex items-center justify-between border border-border rounded px-2 py-1.5">
                <span className="truncate">{a.name}</span>
                <span className={`font-semibold ${a.saldo < 0 ? "text-destructive" : ""}`}>{rp(a.saldo)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter periode */}
      <DateRangeFilter value={dateRange} onChange={setDateRange} label="Periode" />

      {/* Rekap harian */}
      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Memuat…
        </div>
      ) : rekapFiltered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Belum ada belanja pada periode ini.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rekapFiltered.map((hari) => (
            <div key={hari.tanggal} className="space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-1">
                <span className="text-sm font-semibold">{tanggalLabel(hari.tanggal)}</span>
                <span className="text-sm font-semibold text-destructive">{rp(hari.total)}</span>
              </div>
              {hari.items.map((b) => (
                <div key={b.id} className="flex items-center gap-3 py-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{b.description}</span>
                      {tagBadge(b)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {b.rabItem?.description ? `${b.rabItem.description} · ` : b.rabCategory?.name ? `${b.rabCategory.name} · ` : ""}
                      {b.createdBy?.name ?? ""}
                    </div>
                  </div>
                  {b.notaUrl && (
                    <a
                      href={`${apiBase}${b.notaUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-primary"
                      title="Lihat nota"
                    >
                      <ReceiptText className="h-4 w-4" />
                    </a>
                  )}
                  <span className="text-sm font-semibold whitespace-nowrap">{rp(b.amount)}</span>
                  <button
                    onClick={() => {
                      setEditing(b);
                      setSheetOpen(true);
                    }}
                    className="text-muted-foreground hover:text-primary"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Hapus belanja "${b.description}"? Entri Cashflow-nya juga terhapus.`)) delMut.mutate(b.id);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                    title="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <CatatBelanjaSheet
        key={editing ? `edit-${editing.id}` : "new"}
        open={sheetOpen}
        editing={editing}
        onClose={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
      />
      <UangMasukModal open={uangMasukOpen} onClose={() => setUangMasukOpen(false)} />
    </div>
  );
}
