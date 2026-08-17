"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, ShoppingCart, Loader2, Camera, Users, Plus, Trash2 } from "lucide-react";
import { createBelanja, updateBelanja, uploadBelanjaNota, createBelanjaBatch, uploadBelanjaGroupNota, getKasSummary, getRealisasiRab, type BelanjaRow } from "@/lib/api/belanja";
import { getRab, getRabList } from "@/lib/api/rab";
import { getUsers } from "@/lib/api/settings";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  defaultRabPlanId?: number;
  /** Bila diisi → belanja di-tag ke rencana menu makan (real cost). */
  defaultMenuPlanId?: number;
  /** Bila diisi → mode edit. Gunakan `key` berbeda saat buka agar state ter-inisialisasi ulang. */
  editing?: BelanjaRow | null;
}

type UserOpt = { id: number; name?: string | null };
const rp = (v: string | number) => "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

/** Input belanja cepat (mobile-first). Tag ke Proyek (RAB → real cost) atau keperluan lain.
 *  "Untuk apa?" bisa pilih item terdaftar di RAB, atau ketik custom. */
export function CatatBelanjaSheet({ open, onClose, onSaved, defaultRabPlanId, defaultMenuPlanId, editing }: Props) {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();
  const isEdit = !!editing;
  const forMenu = !!defaultMenuPlanId; // belanja khusus untuk rencana menu makan
  const [amount, setAmount] = useState<number>(editing ? Number(editing.amount) : 0);
  const [description, setDescription] = useState<string>(editing?.description ?? "");
  const [tagMode, setTagMode] = useState<"rab" | "lain">(
    forMenu ? "lain" : editing ? (editing.rabPlanId ? "rab" : "lain") : "rab",
  );
  const [rabPlanId, setRabPlanId] = useState<number | "">(editing?.rabPlanId ?? defaultRabPlanId ?? "");
  const [rabCategoryId, setRabCategoryId] = useState<number | "">(editing?.rabCategoryId ?? "");
  const [rabItemId, setRabItemId] = useState<number | "">(editing?.rabItemId ?? "");
  const [customItem, setCustomItem] = useState<boolean>(!!editing && !!editing.rabPlanId && !editing.rabItemId);
  const [category, setCategory] = useState<string>(editing?.category ?? "");
  const [spentAt, setSpentAt] = useState<string>(editing?.spentAt ? editing.spentAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [attributeToUserId, setAttributeToUserId] = useState<number | "">(editing?.createdBy?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  // Mode "satu nota banyak item" (hanya saat create, non-menu)
  type MultiRow = { description: string; quantity: number; unit: string; unitPrice: number; rabItemId: number | ""; rabCategoryId: number | ""; category: string };
  const emptyRow = (): MultiRow => ({ description: "", quantity: 1, unit: "", unitPrice: 0, rabItemId: "", rabCategoryId: "", category: "" });
  const rowSubtotal = (r: MultiRow) => (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0);
  const [multi, setMulti] = useState(false);
  const [rows, setRows] = useState<MultiRow[]>([emptyRow(), emptyRow()]);
  const updateRow = (i: number, patch: Partial<MultiRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (i: number) => setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  const rowsTotal = rows.reduce((a, r) => a + rowSubtotal(r), 0);

  const { data: summary } = useQuery({ queryKey: ["kas-summary", null], queryFn: () => getKasSummary(), enabled: open });
  const { data: users = [] } = useQuery<UserOpt[]>({ queryKey: ["users"], queryFn: getUsers, staleTime: 5 * 60 * 1000 });
  const { data: rabs = [] } = useQuery({ queryKey: ["rab-list"], queryFn: getRabList, enabled: open && tagMode === "rab" });

  // Item + pos untuk RAB terpilih
  const { data: rab } = useQuery({
    queryKey: ["rab", rabPlanId],
    queryFn: () => getRab(rabPlanId as number),
    enabled: open && tagMode === "rab" && !!rabPlanId,
  });
  const rabItems = rab?.items ?? [];
  const { data: realisasi } = useQuery({
    queryKey: ["realisasi-rab", rabPlanId],
    queryFn: () => getRealisasiRab(rabPlanId as number),
    enabled: open && tagMode === "rab" && !!rabPlanId,
  });
  const posOptions = realisasi?.pos ?? [];

  const showItemPicker = tagMode === "rab" && !!rabPlanId && rabItems.length > 0 && !customItem;

  function resetItemFields() {
    setRabItemId("");
    setRabCategoryId("");
    setCustomItem(false);
    setDescription("");
  }

  function onPickItem(val: string) {
    if (val === "__custom__") {
      setCustomItem(true);
      setRabItemId("");
      setDescription("");
      return;
    }
    if (val === "") {
      setRabItemId("");
      return;
    }
    const item = rabItems.find((i) => i.id === Number(val));
    if (item) {
      setRabItemId(item.id ?? "");
      setDescription(item.description);
      setRabCategoryId(item.categoryId ?? "");
    }
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      // Mode multi-item: satu nota banyak baris
      if (multi && !isEdit) {
        const rabPid = tagMode === "rab" && rabPlanId !== "" ? Number(rabPlanId) : null;
        const items = rows
          .filter((r) => rowSubtotal(r) > 0 && r.description.trim())
          .map((r) => ({
            amount: rowSubtotal(r),
            quantity: Number(r.quantity) || null,
            unit: r.unit.trim() || null,
            description: r.description.trim(),
            rabPlanId: rabPid,
            rabItemId: tagMode === "rab" && r.rabItemId !== "" ? Number(r.rabItemId) : null,
            rabCategoryId: tagMode === "rab" && r.rabCategoryId !== "" ? Number(r.rabCategoryId) : null,
            category: tagMode === "lain" ? r.category || null : null,
            menuPlanId: defaultMenuPlanId ?? null,
          }));
        const res = await createBelanjaBatch({
          spentAt,
          attributeToUserId: attributeToUserId === "" ? null : Number(attributeToUserId),
          items,
        });
        if (file && res?.notaGroupId) {
          try {
            await uploadBelanjaGroupNota(res.notaGroupId, file);
          } catch {
            /* nota gagal upload — belanja tetap tersimpan */
          }
        }
        return res;
      }

      const payload = {
        amount,
        description,
        spentAt,
        rabPlanId: tagMode === "rab" && rabPlanId !== "" ? Number(rabPlanId) : null,
        rabCategoryId: tagMode === "rab" && rabCategoryId !== "" ? Number(rabCategoryId) : null,
        rabItemId: tagMode === "rab" && rabItemId !== "" ? Number(rabItemId) : null,
        category: tagMode === "lain" ? category : null,
        menuPlanId: defaultMenuPlanId ?? null,
        attributeToUserId: attributeToUserId === "" ? null : Number(attributeToUserId),
      };
      const saved = isEdit ? await updateBelanja(editing!.id, payload) : await createBelanja(payload);
      if (file && saved?.id) {
        try {
          await uploadBelanjaNota(saved.id, file);
        } catch {
          /* nota gagal upload — belanja tetap tersimpan */
        }
      }
      return saved;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kas-summary"] });
      qc.invalidateQueries({ queryKey: ["kas-by-admin"] });
      qc.invalidateQueries({ queryKey: ["rekap-belanja"] });
      qc.invalidateQueries({ queryKey: ["belanja"] });
      qc.invalidateQueries({ queryKey: ["belanja-item"] });
      qc.invalidateQueries({ queryKey: ["realisasi-rab"] });
      qc.invalidateQueries({ queryKey: ["menu-plan"] });
      qc.invalidateQueries({ queryKey: ["menu-plan-rekap"] });
      setAmount(0);
      setDescription("");
      setRabCategoryId("");
      setRabItemId("");
      setCustomItem(false);
      setCategory("");
      setRows([emptyRow(), emptyRow()]);
      setFile(null);
      onSaved?.();
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.message || "Gagal menyimpan belanja"),
  });

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (multi && !isEdit) {
      if (tagMode === "rab" && !rabPlanId) return setError("Pilih RAB proyek, atau ganti ke Keperluan Lain");
      const valid = rows.filter((r) => rowSubtotal(r) > 0 && r.description.trim());
      if (!valid.length) return setError("Isi minimal satu baris (item, jumlah, harga)");
      saveMut.mutate();
      return;
    }
    if (!(amount > 0)) return setError("Nominal harus lebih dari 0");
    if (tagMode === "rab" && !rabPlanId) return setError("Pilih RAB proyek, atau ganti ke Keperluan Lain");
    if (!description.trim()) return setError("Pilih item RAB atau isi deskripsi belanja");
    saveMut.mutate();
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <div>
            <h2 className="font-bold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" /> {isEdit ? "Edit Belanja" : "Catat Belanja"}
            </h2>
            {summary && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Saldo kas:{" "}
                <span className={summary.saldo < 0 ? "text-destructive font-semibold" : "font-semibold"}>{rp(summary.saldo)}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded cursor-pointer transition-colors hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-4 space-y-3">
          {error && <div className="p-2.5 bg-destructive/15 text-destructive rounded text-sm">{error}</div>}

          {/* Toggle: satu nota banyak item */}
          {!isEdit && !forMenu && (
            <label className="flex items-center gap-2 text-sm p-2 rounded border border-border bg-muted/30 cursor-pointer">
              <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} />
              <span>Satu nota banyak item (rincian per item)</span>
            </label>
          )}

          {/* Nominal besar (mode tunggal) */}
          {!multi && (
            <div>
              <label className="text-xs font-medium">Nominal *</label>
              <input
                type="number"
                inputMode="numeric"
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full border border-border bg-background rounded-lg px-3 py-2.5 text-3xl font-bold mt-0.5"
                placeholder="0"
                autoFocus
              />
            </div>
          )}

          {forMenu && (
            <div className="p-2.5 rounded bg-primary/10 border border-primary/30 text-xs text-primary flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5" /> Belanja ini dicatat sebagai <b>real cost</b> untuk menu makan terpilih.
            </div>
          )}

          {/* Tag: proyek (RAB) vs keperluan lain */}
          <div className={`grid grid-cols-2 gap-2 ${forMenu ? "hidden" : ""}`}>
            <button
              type="button"
              onClick={() => {
                setTagMode("rab");
                resetItemFields();
              }}
              className={`px-3 py-1.5 rounded text-sm border ${tagMode === "rab" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border"}`}
            >
              Untuk Proyek (RAB)
            </button>
            <button
              type="button"
              onClick={() => {
                setTagMode("lain");
                resetItemFields();
                setRabPlanId("");
              }}
              className={`px-3 py-1.5 rounded text-sm border ${tagMode === "lain" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border"}`}
            >
              Keperluan Lain
            </button>
          </div>

          {tagMode === "rab" && (
            <div>
              <label className="text-xs font-medium">RAB Proyek *</label>
              <select
                value={rabPlanId}
                onChange={(e) => {
                  setRabPlanId(e.target.value === "" ? "" : Number(e.target.value));
                  resetItemFields();
                }}
                className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
              >
                <option value="">— Pilih RAB —</option>
                {rabs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Untuk apa? — dropdown item RAB atau custom (mode tunggal) */}
          {!multi && (
          <div>
            <label className="text-xs font-medium">Untuk apa? *</label>
            {showItemPicker ? (
              <select
                value={rabItemId}
                onChange={(e) => onPickItem(e.target.value)}
                className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
              >
                <option value="">— Pilih item dari RAB —</option>
                {rabItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.description}
                  </option>
                ))}
                <option value="__custom__">✏️ Item lain (ketik manual)…</option>
              </select>
            ) : (
              <div className="space-y-1">
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
                  placeholder="mis. Beli cat"
                />
                {tagMode === "rab" && !!rabPlanId && rabItems.length > 0 && customItem && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomItem(false);
                      setDescription("");
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    ← Pilih dari item RAB
                  </button>
                )}
              </div>
            )}
          </div>
          )}

          {/* Rincian item (mode satu nota banyak item) */}
          {multi && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">Rincian item nota</label>
                <span className="text-xs text-muted-foreground">Total: <b>{rp(rowsTotal)}</b></span>
              </div>
              {rows.map((r, i) => (
                <div key={i} className="rounded border border-border p-2 space-y-1.5 bg-muted/20">
                  <div className="flex gap-1.5">
                    {tagMode === "rab" && rabItems.length > 0 && (
                      <select
                        value={r.rabItemId}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") return updateRow(i, { rabItemId: "", rabCategoryId: "" });
                          if (val === "__custom__") return updateRow(i, { rabItemId: "", description: "" });
                          const item = rabItems.find((x) => x.id === Number(val));
                          if (item) updateRow(i, { rabItemId: item.id ?? "", description: item.description, unit: item.unit ?? "", rabCategoryId: item.categoryId ?? "" });
                        }}
                        className="flex-1 min-w-0 border border-border bg-background rounded px-2 py-1.5 text-sm"
                      >
                        <option value="">— pilih item / ketik —</option>
                        {rabItems.map((it) => (
                          <option key={it.id} value={it.id}>{it.description}</option>
                        ))}
                        <option value="__custom__">✏️ ketik manual…</option>
                      </select>
                    )}
                    <input
                      value={r.description}
                      onChange={(e) => updateRow(i, { description: e.target.value })}
                      className="flex-1 min-w-0 border border-border bg-background rounded px-2 py-1.5 text-sm"
                      placeholder="nama item"
                    />
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={r.quantity || ""}
                      onChange={(e) => updateRow(i, { quantity: Number(e.target.value) })}
                      className="w-14 shrink-0 border border-border bg-background rounded px-2 py-1.5 text-sm text-right"
                      placeholder="qty"
                      title="Jumlah"
                    />
                    <input
                      value={r.unit}
                      onChange={(e) => updateRow(i, { unit: e.target.value })}
                      className="w-16 shrink-0 border border-border bg-background rounded px-2 py-1.5 text-sm"
                      placeholder="unit"
                      title="Satuan (mengikuti item RAB)"
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      value={r.unitPrice || ""}
                      onChange={(e) => updateRow(i, { unitPrice: Number(e.target.value) })}
                      className="flex-1 min-w-0 border border-border bg-background rounded px-2 py-1.5 text-sm font-semibold"
                      placeholder="harga satuan"
                      title="Harga per unit"
                    />
                    {tagMode === "rab" && posOptions.length > 0 && (
                      <select
                        value={r.rabCategoryId}
                        onChange={(e) => updateRow(i, { rabCategoryId: e.target.value === "" ? "" : Number(e.target.value) })}
                        className="border border-border bg-background rounded px-2 py-1.5 text-sm max-w-[8rem]"
                      >
                        <option value="">pos…</option>
                        {posOptions.map((p) => (
                          <option key={p.categoryId} value={p.categoryId}>{p.name}</option>
                        ))}
                      </select>
                    )}
                    {tagMode === "lain" && (
                      <input
                        value={r.category}
                        onChange={(e) => updateRow(i, { category: e.target.value })}
                        className="border border-border bg-background rounded px-2 py-1.5 text-sm w-28"
                        placeholder="kategori"
                      />
                    )}
                    <button type="button" onClick={() => removeRow(i)} className="p-1.5 rounded hover:bg-destructive/15 text-destructive shrink-0" title="Hapus baris">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground">
                    Subtotal: <b className="text-foreground">{rp(rowSubtotal(r))}</b>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addRow} className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                <Plus className="h-4 w-4" /> Tambah baris
              </button>
            </div>
          )}

          {!multi && tagMode === "rab" && !!rabPlanId && posOptions.length > 0 && (
            <div>
              <label className="text-xs font-medium">Pos Anggaran (opsional)</label>
              <select
                value={rabCategoryId}
                onChange={(e) => setRabCategoryId(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
              >
                <option value="">— Tanpa pos —</option>
                {posOptions.map((p) => (
                  <option key={p.categoryId} value={p.categoryId}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!multi && tagMode === "lain" && (
            <div>
              <label className="text-xs font-medium">Kategori</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
                placeholder="mis. Operasional, Transport"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Tanggal</label>
              <input
                type="date"
                value={spentAt}
                onChange={(e) => setSpentAt(e.target.value)}
                className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
              />
            </div>
            <div>
              <label className="text-xs font-medium flex items-center gap-1">
                <Camera className="h-3.5 w-3.5" /> Nota
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs mt-1.5"
              />
              {isEdit && editing?.notaUrl && !file && (
                <span className="block text-[10px] text-muted-foreground mt-0.5">Nota sudah ada — pilih file untuk mengganti.</span>
              )}
            </div>
          </div>

          {users.length > 1 && (
            <div>
              <label className="text-xs font-medium flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> Atas nama admin
              </label>
              <select
                value={attributeToUserId}
                onChange={(e) => setAttributeToUserId(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
              >
                <option value="">{currentUser?.name ? `${currentUser.name} (saya)` : "Saya"}</option>
                {users
                  .filter((u) => u.id !== currentUser?.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || `User #${u.id}`}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded text-sm border border-border hover:bg-muted">
              Batal
            </button>
            <button
              type="submit"
              disabled={saveMut.isPending}
              className="px-4 py-1.5 rounded text-sm bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5 disabled:opacity-60"
            >
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {multi && !isEdit ? "Simpan semua" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
