"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Plus,
  Trash2,
  Loader2,
  ExternalLink,
  Wallet,
} from "lucide-react";
import {
  getPengajuan,
  addPengajuanItem,
  deletePengajuanItem,
  approvePengajuanItem,
  unapprovePengajuanItem,
  convertPengajuanToRab,
  type PengajuanItem,
} from "@/lib/api/pengajuan";
import { getRabCategories } from "@/lib/api/rab-categories";
import { getRabLooseItemSuggestions, type RabLooseItem } from "@/lib/api/rab-loose-items";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { CatatBelanjaSheet } from "@/components/CatatBelanjaSheet";

const rp = (v: string | number) =>
  "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

const canConvert = (items: PengajuanItem[]) =>
  items.some((it) => it.status === "APPROVED" && it.convertedRabItemId == null);

export default function PengajuanDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const qc = useQueryClient();
  const { isManager } = useCurrentUser();
  const [belanjaOpen, setBelanjaOpen] = useState(false);

  const { data: pengajuan, isLoading } = useQuery({
    queryKey: ["pengajuan", id],
    queryFn: () => getPengajuan(id),
    enabled: !!id,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["rab-categories"],
    queryFn: () => getRabCategories(),
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pengajuan", id] });
    qc.invalidateQueries({ queryKey: ["pengajuan-list"] });
  };

  // ── add item state ──
  const [newDesc, setNewDesc] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newCat, setNewCat] = useState<number | "">("");
  const [newQty, setNewQty] = useState<number>(1);
  const [newPrice, setNewPrice] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // ── autotext item lepas (RabLooseItem) ──
  const [debouncedDesc, setDebouncedDesc] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedDesc(newDesc.trim()), 250);
    return () => clearTimeout(t);
  }, [newDesc]);
  const { data: looseSuggestions = [] } = useQuery({
    queryKey: ["rab-loose-item-suggestions", debouncedDesc],
    queryFn: () => getRabLooseItemSuggestions(debouncedDesc),
    enabled: debouncedDesc.length >= 1,
    staleTime: 30_000,
  });

  /** Isi item lepas terpilih ke form: unit, harga (cost), pos (dari defaultCategory). */
  const applyLoose = (li: RabLooseItem) => {
    setNewDesc(li.description);
    if (li.unit) setNewUnit(li.unit);
    const cost = Number(li.lastPriceCost) || Number(li.lastPriceRab) || 0;
    if (cost > 0) setNewPrice(cost);
    if (li.defaultCategory) {
      const match = categories.find(
        (c) => c.name.toLowerCase() === li.defaultCategory!.toLowerCase(),
      );
      if (match) setNewCat(match.id);
    }
  };

  /** Saat teks item cocok persis dengan salah satu item lepas → auto-prefill. */
  const onDescChange = (v: string) => {
    setNewDesc(v);
    const hit = looseSuggestions.find(
      (li) => li.description.toLowerCase() === v.trim().toLowerCase(),
    );
    if (hit) applyLoose(hit);
  };

  const addMut = useMutation({
    mutationFn: () =>
      addPengajuanItem(id, {
        categoryId: Number(newCat),
        description: newDesc.trim(),
        unit: newUnit.trim() || null,
        quantity: newQty,
        price: newPrice,
      }),
    onSuccess: () => {
      setNewDesc("");
      setNewUnit("");
      setNewQty(1);
      setNewPrice(0);
      invalidate();
    },
    onError: (e: any) => setError(e?.response?.data?.message || "Gagal menambah item"),
  });

  const delMut = useMutation({
    mutationFn: (itemId: number) => deletePengajuanItem(itemId),
    onSuccess: invalidate,
    onError: (e: any) => setError(e?.response?.data?.message || "Gagal menghapus"),
  });
  const approveMut = useMutation({
    mutationFn: (itemId: number) => approvePengajuanItem(itemId),
    onSuccess: invalidate,
    onError: (e: any) => setError(e?.response?.data?.message || "Gagal approve"),
  });
  const unapproveMut = useMutation({
    mutationFn: (itemId: number) => unapprovePengajuanItem(itemId),
    onSuccess: invalidate,
    onError: (e: any) => setError(e?.response?.data?.message || "Gagal batalkan approval"),
  });
  const convertMut = useMutation({
    mutationFn: () => convertPengajuanToRab(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["rab-list"] });
      if (res.rabPlanId) qc.invalidateQueries({ queryKey: ["rab", res.rabPlanId] });
      invalidate();
    },
    onError: (e: any) => setError(e?.response?.data?.message || "Gagal convert ke RAB"),
  });

  if (isLoading || !pengajuan) {
    return <div className="p-6 text-sm text-muted-foreground">Memuat…</div>;
  }

  const items = pengajuan.items;
  const subtotal = items.reduce((a, it) => a + Number(it.quantity) * Number(it.price), 0);
  const rabPlanId = pengajuan.rabPlanId ?? pengajuan.event?.rabPlanId ?? null;
  const convertReady = canConvert(items) && isManager;

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!newCat) return setError("Pos anggaran wajib dipilih");
    if (!newDesc.trim()) return setError("Deskripsi item wajib diisi");
    if (!(newQty > 0)) return setError("Jumlah harus > 0");
    addMut.mutate();
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <Link href="/pengajuan" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Kembali ke daftar
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold">{pengajuan.title || "Tanpa judul"}</h1>
          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            {pengajuan.event && (
              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">
                {pengajuan.event.code}
              </span>
            )}
            <span>{pengajuan.event?.name}</span>
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                pengajuan.status === "DONE"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {pengajuan.status === "DONE" ? "Selesai" : "Terbuka"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rabPlanId && (
            <>
              <Link
                href={`/rab/${rabPlanId}`}
                className="px-3 py-1.5 rounded-lg text-sm border border-border hover:bg-muted flex items-center gap-1.5"
              >
                <ExternalLink className="h-4 w-4" /> Lihat RAB
              </Link>
              <button
                onClick={() => setBelanjaOpen(true)}
                className="px-3 py-1.5 rounded-lg text-sm border border-border hover:bg-muted flex items-center gap-1.5"
              >
                <Wallet className="h-4 w-4" /> Catat Realcost
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="p-2.5 mb-3 bg-destructive/15 text-destructive rounded text-sm">{error}</div>}

      {/* Tabel item */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Pos</th>
                <th className="px-3 py-2 font-medium">Unit</th>
                <th className="px-3 py-2 font-medium text-right">Modal</th>
                <th className="px-3 py-2 font-medium text-right">Jumlah</th>
                <th className="px-3 py-2 font-medium text-right">Total Modal</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    Belum ada item. Tambah item di bawah.
                  </td>
                </tr>
              ) : (
                items.map((it) => {
                  const converted = it.convertedRabItemId != null;
                  const approved = it.status === "APPROVED";
                  return (
                    <tr key={it.id} className={`border-b border-border/60 ${converted ? "opacity-60" : ""}`}>
                      <td className="px-3 py-2">{it.description}</td>
                      <td className="px-3 py-2 text-muted-foreground">{it.category?.name || "-"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{it.unit || "-"}</td>
                      <td className="px-3 py-2 text-right">{rp(it.price)}</td>
                      <td className="px-3 py-2 text-right">{Number(it.quantity)}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {rp(Number(it.quantity) * Number(it.price))}
                      </td>
                      <td className="px-3 py-2">
                        {approved ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            <Check className="h-3 w-3" /> Disetujui{converted ? " · masuk RAB" : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            <Clock className="h-3 w-3" /> Menunggu
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          {isManager && !converted && !approved && (
                            <button
                              onClick={() => approveMut.mutate(it.id)}
                              disabled={approveMut.isPending}
                              className="px-2 py-1 rounded text-xs bg-emerald-600 text-white hover:opacity-90 flex items-center gap-1 disabled:opacity-60"
                            >
                              <Check className="h-3.5 w-3.5" /> Approval
                            </button>
                          )}
                          {isManager && !converted && approved && (
                            <button
                              onClick={() => unapproveMut.mutate(it.id)}
                              disabled={unapproveMut.isPending}
                              className="px-2 py-1 rounded text-xs border border-border hover:bg-muted"
                            >
                              Batalkan
                            </button>
                          )}
                          {!converted && (
                            <button
                              onClick={() => delMut.mutate(it.id)}
                              disabled={delMut.isPending}
                              className="p-1 rounded hover:bg-destructive/15 text-destructive"
                              title="Hapus item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Baris tambah item */}
        <form onSubmit={submitAdd} className="border-t border-border bg-muted/30 p-3">
          <div className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end">
            <div className="col-span-2 md:col-span-4">
              <label className="text-[11px] text-muted-foreground">Item</label>
              <input
                value={newDesc}
                onChange={(e) => onDescChange(e.target.value)}
                list="pengajuan-loose-items"
                autoComplete="off"
                className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm"
                placeholder="ketik / pilih item lepas"
              />
              <datalist id="pengajuan-loose-items">
                {looseSuggestions.map((li) => (
                  <option key={li.id} value={li.description}>
                    {li.unit ? `${li.unit} · ` : ""}
                    {"Rp " +
                      (Number(li.lastPriceCost) || Number(li.lastPriceRab) || 0).toLocaleString(
                        "id-ID",
                        { maximumFractionDigits: 0 },
                      )}
                    {li.defaultCategory ? ` · ${li.defaultCategory}` : ""}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="md:col-span-3">
              <label className="text-[11px] text-muted-foreground">Pos</label>
              <select
                value={newCat}
                onChange={(e) => setNewCat(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm"
              >
                <option value="">— pos —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="text-[11px] text-muted-foreground">Unit</label>
              <input
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm"
                placeholder="pcs"
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-[11px] text-muted-foreground">Jumlah</label>
              <input
                type="number"
                inputMode="numeric"
                value={newQty || ""}
                onChange={(e) => setNewQty(Number(e.target.value))}
                className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] text-muted-foreground">Modal</label>
              <input
                type="number"
                inputMode="numeric"
                value={newPrice || ""}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm"
                placeholder="0"
              />
            </div>
            <div className="md:col-span-1">
              <button
                type="submit"
                disabled={addMut.isPending}
                className="w-full px-2 py-1.5 rounded text-sm bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center gap-1 disabled:opacity-60"
              >
                {addMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Footer: subtotal + convert */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <div className="text-sm">
          <span className="text-muted-foreground">Total Modal Diajukan: </span>
          <span className="font-bold text-lg">{rp(subtotal)}</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={() => convertMut.mutate()}
            disabled={!convertReady || convertMut.isPending}
            title={
              !isManager
                ? "Hanya owner yang bisa convert"
                : !canConvert(items)
                  ? "Setujui minimal satu item untuk convert"
                  : "Convert item disetujui ke RAB"
            }
            className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {convertMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Convert ke RAB
          </button>
          {isManager && !canConvert(items) && (
            <span className="text-[11px] text-muted-foreground">
              Setujui minimal satu item untuk convert.
            </span>
          )}
        </div>
      </div>

      {rabPlanId && (
        <CatatBelanjaSheet
          open={belanjaOpen}
          onClose={() => setBelanjaOpen(false)}
          defaultRabPlanId={rabPlanId}
        />
      )}
    </div>
  );
}
