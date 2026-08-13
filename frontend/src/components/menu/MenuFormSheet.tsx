"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, UtensilsCrossed, Loader2, Plus, Trash2, ImagePlus } from "lucide-react";
import { createMenu, updateMenu, uploadMenuPhotos, menuPhotoUrl, parseMenuPhotos, type MenuBahan, type MenuRow } from "@/lib/api/menu";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  /** Bila diisi → mode edit. Gunakan `key` berbeda saat buka agar state ter-inisialisasi ulang. */
  editing?: MenuRow | null;
}

const rp = (v: string | number) => "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

type BahanRow = MenuBahan;
const emptyBahan = (): BahanRow => ({ name: "", quantity: 1, unit: "", unitPrice: 0, note: "" });

export function MenuFormSheet({ open, onClose, onSaved, editing }: Props) {
  const qc = useQueryClient();
  const isEdit = !!editing;
  const [name, setName] = useState<string>(editing?.name ?? "");
  const [servings, setServings] = useState<number>(editing?.servings ?? 1);
  const [description, setDescription] = useState<string>(editing?.description ?? "");
  const [recipe, setRecipe] = useState<string>(editing?.recipe ?? "");
  const [isActive, setIsActive] = useState<boolean>(editing?.isActive ?? true);
  const [photos, setPhotos] = useState<string[]>(editing ? parseMenuPhotos(editing) : []);
  const [uploading, setUploading] = useState(false);
  const [bahan, setBahan] = useState<BahanRow[]>(
    editing?.bahan?.length
      ? editing.bahan.map((b) => ({ name: b.name, quantity: Number(b.quantity), unit: b.unit ?? "", unitPrice: Number(b.unitPrice), note: b.note ?? "" }))
      : [emptyBahan()],
  );
  const [error, setError] = useState<string | null>(null);

  const totalCost = bahan.reduce((s, b) => s + (Number(b.quantity) || 0) * (Number(b.unitPrice) || 0), 0);

  function updateBahan(i: number, patch: Partial<BahanRow>) {
    setBahan((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addBahan() {
    setBahan((rows) => [...rows, emptyBahan()]);
  }
  function removeBahan(i: number) {
    setBahan((rows) => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows));
  }

  async function onPhotoFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const urls = await uploadMenuPhotos(Array.from(files));
      setPhotos((p) => [...p, ...urls]);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Gagal mengunggah foto");
    } finally {
      setUploading(false);
    }
  }
  function removePhoto(i: number) {
    setPhotos((p) => p.filter((_, idx) => idx !== i));
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        servings: servings > 0 ? servings : 1,
        recipe: recipe.trim() || null,
        isActive,
        imageUrls: photos,
        bahan: bahan
          .filter((b) => b.name.trim())
          .map((b) => ({
            name: b.name.trim(),
            quantity: Number(b.quantity) || 0,
            unit: b.unit?.trim() || null,
            unitPrice: Number(b.unitPrice) || 0,
            note: b.note?.trim() || null,
          })),
      };
      return isEdit ? updateMenu(editing!.id, payload) : createMenu(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menus"] });
      onSaved?.();
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.message || "Gagal menyimpan menu"),
  });

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Nama menu wajib diisi");
    saveMut.mutate();
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-card rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-bold flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-primary" /> {isEdit ? "Edit Menu" : "Menu Baru"}
          </h2>
          <button onClick={onClose} className="p-1 rounded cursor-pointer transition-colors hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-4 space-y-3">
          {error && <div className="p-2.5 bg-destructive/15 text-destructive rounded text-sm">{error}</div>}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium">Nama Menu *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
                placeholder="mis. Nasi Ayam Geprek"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium">Porsi</label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={servings || ""}
                onChange={(e) => setServings(Number(e.target.value))}
                className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
                placeholder="1"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Deskripsi (opsional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
              placeholder="Keterangan singkat menu"
            />
          </div>

          {/* Foto menu (bisa lebih dari satu) */}
          <div>
            <label className="text-xs font-medium">Foto Menu (bisa lebih dari satu)</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={p + i} className="relative h-20 w-20 rounded-lg overflow-hidden border border-border group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={menuPhotoUrl(p)} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-destructive"
                    title="Hapus foto"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {i === 0 && (
                    <span className="absolute bottom-0 inset-x-0 bg-primary/80 text-primary-foreground text-[9px] text-center">Utama</span>
                  )}
                </div>
              ))}
              <label className="h-20 w-20 rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-muted/40 text-muted-foreground">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                <span className="text-[10px]">{uploading ? "Unggah…" : "Tambah"}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    onPhotoFiles(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {/* Bahan / komposisi */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium">Bahan / Komposisi</label>
              <button type="button" onClick={addBahan} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> Tambah Bahan
              </button>
            </div>
            <div className="space-y-2">
              {bahan.map((b, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5 items-start">
                  <input
                    value={b.name}
                    onChange={(e) => updateBahan(i, { name: e.target.value })}
                    className="col-span-4 border border-border bg-background rounded px-2 py-1.5 text-sm"
                    placeholder="Nama bahan"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    value={b.quantity || ""}
                    onChange={(e) => updateBahan(i, { quantity: Number(e.target.value) })}
                    className="col-span-2 border border-border bg-background rounded px-1.5 py-1.5 text-sm text-right"
                    placeholder="Qty"
                  />
                  <input
                    value={b.unit ?? ""}
                    onChange={(e) => updateBahan(i, { unit: e.target.value })}
                    className="col-span-2 border border-border bg-background rounded px-1.5 py-1.5 text-sm"
                    placeholder="kg"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={b.unitPrice || ""}
                    onChange={(e) => updateBahan(i, { unitPrice: Number(e.target.value) })}
                    className="col-span-3 border border-border bg-background rounded px-1.5 py-1.5 text-sm text-right"
                    placeholder="Harga/satuan"
                  />
                  <button
                    type="button"
                    onClick={() => removeBahan(i)}
                    className="col-span-1 flex items-center justify-center h-8 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Hapus bahan"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="col-span-12 text-[11px] text-muted-foreground text-right -mt-1">
                    Subtotal: {rp((Number(b.quantity) || 0) * (Number(b.unitPrice) || 0))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 p-2 rounded bg-primary/10 border border-primary/30">
              <span className="text-xs font-medium text-primary">Estimasi Cost Menu</span>
              <span className="text-base font-bold text-primary tabular-nums">{rp(totalCost)}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Resep / Cara Masak (opsional)</label>
            <textarea
              value={recipe}
              onChange={(e) => setRecipe(e.target.value)}
              rows={3}
              className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
              placeholder="Langkah-langkah memasak…"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Menu aktif (bisa dipilih untuk rencana & voting)
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded text-sm border border-border hover:bg-muted">
              Batal
            </button>
            <button
              type="submit"
              disabled={saveMut.isPending}
              className="px-4 py-1.5 rounded text-sm bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5 disabled:opacity-60"
            >
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
