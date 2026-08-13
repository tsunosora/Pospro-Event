"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, Plus, Sparkles, Wallet, TrendingUp, TrendingDown, Loader2, Trash2, X, Pencil, ShoppingCart, UtensilsCrossed, Vote,
} from "lucide-react";
import Link from "next/link";
import { DateRangeFilter, presetToRange, type DateRange } from "@/components/DateRangeFilter";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { getMenus } from "@/lib/api/menu";
import {
  getPlans, getPlanRekap, getPlan, createPlan, deletePlan, getMenuSetting, updateMenuSetting,
  type PlanRow, type PlanDetail,
} from "@/lib/api/menuPlan";
import { SpinWheel } from "@/components/menu/SpinWheel";
import { MenuMultiSelect } from "@/components/menu/MenuMultiSelect";
import { CatatBelanjaSheet } from "@/components/CatatBelanjaSheet";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const rp = (v: string | number) => "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });

const METHOD_BADGE: Record<PlanRow["selectionMethod"], { label: string; cls: string }> = {
  MANUAL: { label: "Manual", cls: "bg-muted text-muted-foreground" },
  SPIN: { label: "Spin", cls: "bg-info/15 text-info" },
  VOTE: { label: "Vote", cls: "bg-primary/15 text-primary" },
};

export default function MenuPlanPage() {
  const qc = useQueryClient();
  const { isManager } = useCurrentUser();
  const [dateRange, setDateRange] = useState<DateRange>({ preset: "THIS_MONTH" });
  const [newOpen, setNewOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const range = useMemo(() => {
    const r = presetToRange(dateRange.preset, { from: dateRange.fromDate, to: dateRange.toDate });
    return { from: r.from?.toISOString(), to: r.to?.toISOString() };
  }, [dateRange]);

  const { data: rekap, isLoading } = useQuery({
    queryKey: ["menu-plan-rekap", range.from, range.to],
    queryFn: () => getPlanRekap(range),
  });
  const plans = rekap?.plans ?? [];

  const delMut = useMutation({
    mutationFn: (id: number) => deletePlan(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu-plan-rekap"] }),
  });

  const selisihTone = (rekap?.selisih ?? 0) > 0 ? "destructive" : "success";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rencana & Monitoring Makan"
        description="Tentukan menu harian (manual / spin / vote) dan pantau biaya aktual vs estimasi."
        icon={CalendarDays}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/menu-vote"
              className="px-3 py-2 rounded-lg text-sm border border-border hover:bg-muted flex items-center gap-1.5"
            >
              <Vote className="h-4 w-4" /> Voting
            </Link>
            <button
              onClick={() => setNewOpen(true)}
              className="px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Rencana Baru
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <DateRangeFilter value={dateRange} onChange={setDateRange} label="Periode" />
        <BudgetCard canEdit={isManager} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total Estimasi" value={rp(rekap?.totalEstimasi ?? 0)} icon={UtensilsCrossed} tone="neutral" />
        <StatCard label="Total Belanja (Real)" value={rp(rekap?.totalReal ?? 0)} icon={ShoppingCart} tone="primary" />
        <StatCard
          label={(rekap?.selisih ?? 0) > 0 ? "Lebih dari Estimasi" : "Hemat dari Estimasi"}
          value={rp(Math.abs(rekap?.selisih ?? 0))}
          icon={(rekap?.selisih ?? 0) > 0 ? TrendingUp : TrendingDown}
          tone={selisihTone}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : plans.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Belum ada rencana menu" description="Buat rencana menu untuk periode ini." />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Tanggal</th>
                  <th className="px-3 py-2 font-medium">Menu</th>
                  <th className="px-3 py-2 font-medium">Metode</th>
                  <th className="px-3 py-2 font-medium text-right">Estimasi</th>
                  <th className="px-3 py-2 font-medium text-right">Real</th>
                  <th className="px-3 py-2 font-medium text-right">Selisih</th>
                  <th className="px-3 py-2 font-medium text-right">Sisa Budget</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const b = METHOD_BADGE[p.selectionMethod];
                  return (
                    <tr
                      key={p.id}
                      className="border-t border-border hover:bg-muted/30 cursor-pointer"
                      onClick={() => setDetailId(p.id)}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(p.planDate)}</td>
                      <td className="px-3 py-2 font-medium">{p.menu?.name ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded ${b.cls}`}>{b.label}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{rp(p.estimatedCost)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{rp(p.realCost)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${p.variance.over ? "text-destructive" : "text-success"}`}>
                        {p.variance.selisih > 0 ? "+" : ""}
                        {rp(p.variance.selisih)}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${p.variance.overBudget ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {p.variance.sisaBudget === null ? "—" : rp(p.variance.sisaBudget)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Hapus rencana ini? Belanja yang ter-tag tidak ikut terhapus.")) delMut.mutate(p.id);
                          }}
                          className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {newOpen && <NewPlanModal onClose={() => setNewOpen(false)} />}
      {detailId !== null && <PlanDetailDrawer id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

// ─── Budget harian ───────────────────────────────────────────────────────

function BudgetCard({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["menu-setting"], queryFn: getMenuSetting });
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState<number>(0);

  const mut = useMutation({
    mutationFn: (v: number) => updateMenuSetting(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-setting"] });
      setEditing(false);
    },
  });

  const budget = Number(data?.dailyBudget) || 0;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <Wallet className="h-4 w-4 text-primary" />
      <span className="text-xs text-muted-foreground">Budget makan/hari:</span>
      {editing ? (
        <>
          <input
            type="number"
            inputMode="numeric"
            defaultValue={budget || ""}
            onChange={(e) => setVal(Number(e.target.value))}
            className="w-28 border border-border bg-background rounded px-2 py-1 text-sm"
            autoFocus
          />
          <button onClick={() => mut.mutate(val)} disabled={mut.isPending} className="text-primary text-sm hover:underline">
            {mut.isPending ? "…" : "Simpan"}
          </button>
          <button onClick={() => setEditing(false)} className="text-muted-foreground text-sm hover:underline">
            Batal
          </button>
        </>
      ) : (
        <>
          <span className="text-sm font-semibold tabular-nums">{budget > 0 ? rp(budget) : "belum diatur"}</span>
          {canEdit && (
            <button
              onClick={() => {
                setVal(budget);
                setEditing(true);
              }}
              className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10"
              title="Ubah budget"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Modal rencana baru (manual / spin) ────────────────────────────────────

function NewPlanModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"manual" | "spin">("manual");
  const [planDate, setPlanDate] = useState(new Date().toISOString().slice(0, 10));
  const [menuId, setMenuId] = useState<number | "">("");
  const [spinMenuIds, setSpinMenuIds] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: menus = [] } = useQuery({ queryKey: ["menus", "active"], queryFn: () => getMenus({ active: true }) });

  // Nama menu untuk roda (resolusi dari daftar menu aktif berdasar id terpilih)
  const spinWheelMenus = spinMenuIds
    .map((id) => menus.find((m) => m.id === id))
    .filter((m): m is (typeof menus)[number] => !!m)
    .map((m) => ({ id: m.id, name: m.name }));

  const createMut = useMutation({
    mutationFn: (method: "MANUAL" | "SPIN") =>
      createPlan({ planDate, menuId: Number(menuId), selectionMethod: method, note: note.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-plan-rekap"] });
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.message || "Gagal membuat rencana"),
  });

  function saveManual() {
    setError(null);
    if (!menuId) return setError("Pilih menu dulu");
    createMut.mutate("MANUAL");
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-card rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-bold flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> Rencana Menu Baru
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {error && <div className="p-2.5 bg-destructive/15 text-destructive rounded text-sm">{error}</div>}

          <div>
            <label className="text-xs font-medium">Tanggal Makan</label>
            <input
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
              className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTab("manual")}
              className={`px-3 py-1.5 rounded text-sm border ${tab === "manual" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border"}`}
            >
              Pilih Manual
            </button>
            <button
              onClick={() => setTab("spin")}
              className={`px-3 py-1.5 rounded text-sm border flex items-center justify-center gap-1 ${tab === "spin" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border"}`}
            >
              <Sparkles className="h-3.5 w-3.5" /> Spin Random
            </button>
          </div>

          {tab === "manual" ? (
            <>
              <div>
                <label className="text-xs font-medium">Menu</label>
                <select
                  value={menuId}
                  onChange={(e) => setMenuId(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
                >
                  <option value="">— Pilih menu —</option>
                  {menus.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {rp(m.estimatedCost)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Catatan (opsional)</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
                  placeholder="mis. makan siang tim produksi"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={onClose} className="px-3 py-1.5 rounded text-sm border border-border hover:bg-muted">
                  Batal
                </button>
                <button
                  onClick={saveManual}
                  disabled={createMut.isPending}
                  className="px-4 py-1.5 rounded text-sm bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5 disabled:opacity-60"
                >
                  {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
                </button>
              </div>
            </>
          ) : (
            <div className="pt-1 space-y-3">
              <div>
                <label className="text-xs font-medium">Pilih menu yang ikut diputar (2–10)</label>
                <div className="mt-1">
                  <MenuMultiSelect value={spinMenuIds} onChange={setSpinMenuIds} max={10} />
                </div>
              </div>

              {menus.length < 2 ? (
                <div className="text-sm text-muted-foreground text-center py-4 space-y-1">
                  <p>Butuh minimal 2 menu aktif di library untuk memutar roda.</p>
                  <Link href="/menu" className="text-primary hover:underline inline-flex items-center gap-1">
                    <UtensilsCrossed className="h-3.5 w-3.5" /> Tambah menu di Library Menu
                  </Link>
                </div>
              ) : spinWheelMenus.length < 2 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Pilih minimal 2 menu di atas untuk mulai memutar roda.
                </p>
              ) : (
                <>
                  <SpinWheel
                    menus={spinWheelMenus}
                    onResult={(id) => {
                      setMenuId(id);
                      // otomatis simpan sebagai SPIN
                      createPlan({ planDate, menuId: id, selectionMethod: "SPIN", note: note.trim() || null })
                        .then(() => {
                          qc.invalidateQueries({ queryKey: ["menu-plan-rekap"] });
                          onClose();
                        })
                        .catch((e) => setError(e?.response?.data?.message || "Gagal menyimpan hasil spin"));
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground text-center">Hasil putaran otomatis tersimpan sebagai rencana.</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Drawer detail rencana ─────────────────────────────────────────────────

function PlanDetailDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const { data: plan, isLoading } = useQuery<PlanDetail>({ queryKey: ["menu-plan", id], queryFn: () => getPlan(id) });
  const [belanjaOpen, setBelanjaOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-card rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-bold flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-primary" /> {plan?.menu?.name ?? "Detail Rencana"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading || !plan ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/40 p-2">
                <div className="text-[11px] text-muted-foreground">Estimasi</div>
                <div className="font-bold tabular-nums text-sm">{rp(plan.estimatedCost)}</div>
              </div>
              <div className="rounded-lg bg-primary/10 p-2">
                <div className="text-[11px] text-muted-foreground">Real</div>
                <div className="font-bold tabular-nums text-sm text-primary">{rp(plan.realCost)}</div>
              </div>
              <div className={`rounded-lg p-2 ${plan.variance.over ? "bg-destructive/10" : "bg-success/10"}`}>
                <div className="text-[11px] text-muted-foreground">Selisih</div>
                <div className={`font-bold tabular-nums text-sm ${plan.variance.over ? "text-destructive" : "text-success"}`}>
                  {plan.variance.selisih > 0 ? "+" : ""}
                  {rp(plan.variance.selisih)}
                </div>
              </div>
            </div>

            {/* Bahan */}
            {plan.menu?.bahan && plan.menu.bahan.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Bahan / Belanja yang perlu disiapkan</h3>
                <div className="rounded-lg border border-border divide-y divide-border">
                  {plan.menu.bahan.map((b, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 text-sm">
                      <span>
                        {b.name}
                        <span className="text-muted-foreground text-xs"> · {Number(b.quantity)} {b.unit}</span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">{rp((Number(b.quantity) || 0) * (Number(b.unitPrice) || 0))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Belanja aktual */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold">Belanja Aktual ({plan.belanja.length})</h3>
                <button
                  onClick={() => setBelanjaOpen(true)}
                  className="text-xs px-2.5 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1"
                >
                  <ShoppingCart className="h-3.5 w-3.5" /> Catat Belanja
                </button>
              </div>
              {plan.belanja.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Belum ada belanja untuk menu ini.</p>
              ) : (
                <div className="rounded-lg border border-border divide-y divide-border">
                  {plan.belanja.map((b) => (
                    <div key={b.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                      <span className="truncate">
                        {b.description}
                        {b.createdBy?.name && <span className="text-muted-foreground text-xs"> · {b.createdBy.name}</span>}
                      </span>
                      <span className="tabular-nums font-medium">{rp(b.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <CatatBelanjaSheet
          key={`belanja-${id}`}
          open={belanjaOpen}
          defaultMenuPlanId={id}
          onClose={() => setBelanjaOpen(false)}
        />
      </div>
    </div>
  );
}
