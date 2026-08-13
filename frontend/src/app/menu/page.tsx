"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UtensilsCrossed, Plus, Search, Pencil, Trash2, Loader2, ListTree, Utensils } from "lucide-react";
import { getMenus, deleteMenu, parseMenuPhotos, menuPhotoUrl, type MenuRow } from "@/lib/api/menu";
import { MenuFormSheet } from "@/components/menu/MenuFormSheet";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

const rp = (v: string | number) => "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

export default function MenuLibraryPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<MenuRow | null>(null);

  const { data: menus = [], isLoading } = useQuery({
    queryKey: ["menus", q],
    queryFn: () => getMenus({ q: q || undefined }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => deleteMenu(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menus"] }),
  });

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(m: MenuRow) {
    setEditing(m);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Library Menu Makan"
        description="Daftar menu beserta resep & bahan (komposisi) dan estimasi biayanya."
        icon={UtensilsCrossed}
        actions={
          <button
            onClick={openNew}
            className="px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Menu Baru
          </button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari menu…"
          className="w-full border border-border bg-background rounded-lg pl-9 pr-3 py-2 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : menus.length === 0 ? (
        <EmptyState
          icon={Utensils}
          title="Belum ada menu"
          description={q ? "Tidak ada menu yang cocok dengan pencarian." : "Tambahkan menu pertama beserta bahan-bahannya."}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {menus.map((m) => {
            const photos = parseMenuPhotos(m);
            return (
            <div
              key={m.id}
              className={`rounded-xl border bg-card p-4 flex flex-col gap-2 ${m.isActive ? "border-border" : "border-dashed border-border opacity-70"}`}
            >
              {photos.length > 0 && (
                <div className="relative -mx-4 -mt-4 mb-1 h-32 overflow-hidden rounded-t-xl bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={menuPhotoUrl(photos[0])} alt={m.name} className="h-full w-full object-cover" />
                  {photos.length > 1 && (
                    <span className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
                      +{photos.length - 1} foto
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate flex items-center gap-1.5">
                    <UtensilsCrossed className="h-4 w-4 text-primary shrink-0" />
                    {m.name}
                  </h3>
                  {m.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{m.description}</p>}
                </div>
                {!m.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">nonaktif</span>}
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ListTree className="h-3.5 w-3.5" /> {m.bahan?.length ?? 0} bahan
                </span>
                <span>· {m.servings} porsi</span>
              </div>

              <div className="mt-1 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-muted-foreground">Estimasi cost</div>
                  <div className="text-lg font-bold text-primary tabular-nums">{rp(m.estimatedCost)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(m)}
                    className="p-2 rounded text-muted-foreground hover:text-primary hover:bg-primary/10"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Hapus / nonaktifkan menu "${m.name}"?`)) delMut.mutate(m.id);
                    }}
                    disabled={delMut.isPending}
                    className="p-2 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    title="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      <MenuFormSheet
        key={editing?.id ?? "new"}
        open={sheetOpen}
        editing={editing}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
