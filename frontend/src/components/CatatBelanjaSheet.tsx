"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, ShoppingCart, Loader2, Camera, Users } from "lucide-react";
import { createBelanja, uploadBelanjaNota, getKasSummary, getRealisasiRab } from "@/lib/api/belanja";
import { getEvents, type EventRecord } from "@/lib/api/events";
import { getUsers } from "@/lib/api/settings";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  defaultEventId?: number;
}

type UserOpt = { id: number; name?: string | null };
const rp = (v: string | number) => "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

/** Input belanja cepat (mobile-first). Tag ke event (→ real cost RAB) atau keperluan lain. */
export function CatatBelanjaSheet({ open, onClose, onSaved, defaultEventId }: Props) {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState<string>("");
  const [tagMode, setTagMode] = useState<"event" | "lain">(defaultEventId ? "event" : "event");
  const [eventId, setEventId] = useState<number | "">(defaultEventId ?? "");
  const [rabCategoryId, setRabCategoryId] = useState<number | "">("");
  const [category, setCategory] = useState<string>("");
  const [spentAt, setSpentAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [attributeToUserId, setAttributeToUserId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  const { data: summary } = useQuery({ queryKey: ["kas-summary", null], queryFn: () => getKasSummary(), enabled: open });
  const { data: events = [] } = useQuery<EventRecord[]>({ queryKey: ["events"], queryFn: () => getEvents(), enabled: open });
  const { data: users = [] } = useQuery<UserOpt[]>({ queryKey: ["users"], queryFn: getUsers, staleTime: 5 * 60 * 1000 });

  const selectedEvent = useMemo(() => events.find((e) => e.id === eventId), [events, eventId]);
  const rabPlanId = selectedEvent?.rabPlanId ?? null;

  const { data: realisasi } = useQuery({
    queryKey: ["realisasi-rab", rabPlanId],
    queryFn: () => getRealisasiRab(rabPlanId as number),
    enabled: open && tagMode === "event" && !!rabPlanId,
  });
  const posOptions = realisasi?.pos ?? [];

  const saveMut = useMutation({
    mutationFn: async () => {
      const created = await createBelanja({
        amount,
        description,
        spentAt,
        eventId: tagMode === "event" ? Number(eventId) : null,
        rabCategoryId: tagMode === "event" && rabCategoryId !== "" ? Number(rabCategoryId) : null,
        category: tagMode === "lain" ? category : null,
        attributeToUserId: attributeToUserId === "" ? null : Number(attributeToUserId),
      });
      if (file && created?.id) {
        try {
          await uploadBelanjaNota(created.id, file);
        } catch {
          /* nota gagal upload — belanja tetap tersimpan */
        }
      }
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kas-summary"] });
      qc.invalidateQueries({ queryKey: ["kas-by-admin"] });
      qc.invalidateQueries({ queryKey: ["rekap-belanja"] });
      qc.invalidateQueries({ queryKey: ["belanja"] });
      if (rabPlanId) qc.invalidateQueries({ queryKey: ["realisasi-rab", rabPlanId] });
      // reset
      setAmount(0);
      setDescription("");
      setRabCategoryId("");
      setCategory("");
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
    if (!(amount > 0)) return setError("Nominal harus lebih dari 0");
    if (!description.trim()) return setError("Deskripsi belanja wajib diisi");
    if (tagMode === "event" && !eventId) return setError("Pilih event, atau ganti ke Keperluan Lain");
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
              <ShoppingCart className="h-5 w-5 text-primary" /> Catat Belanja
            </h2>
            {summary && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Saldo kas: <span className={summary.saldo < 0 ? "text-destructive font-semibold" : "font-semibold"}>{rp(summary.saldo)}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded cursor-pointer transition-colors hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-4 space-y-3">
          {error && <div className="p-2.5 bg-destructive/15 text-destructive rounded text-sm">{error}</div>}

          {/* Nominal besar */}
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

          <div>
            <label className="text-xs font-medium">Untuk apa? *</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
              placeholder="mis. Beli cat"
            />
          </div>

          {/* Tag: event vs keperluan lain */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTagMode("event")}
              className={`px-3 py-1.5 rounded text-sm border ${tagMode === "event" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border"}`}
            >
              Untuk Event
            </button>
            <button
              type="button"
              onClick={() => setTagMode("lain")}
              className={`px-3 py-1.5 rounded text-sm border ${tagMode === "lain" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border"}`}
            >
              Keperluan Lain
            </button>
          </div>

          {tagMode === "event" ? (
            <>
              <div>
                <label className="text-xs font-medium">Event (RAB) *</label>
                <select
                  value={eventId}
                  onChange={(e) => {
                    setEventId(e.target.value === "" ? "" : Number(e.target.value));
                    setRabCategoryId("");
                  }}
                  className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
                >
                  <option value="">— Pilih event —</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.code} — {ev.name}
                    </option>
                  ))}
                </select>
              </div>
              {rabPlanId && posOptions.length > 0 && (
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
              {selectedEvent && !rabPlanId && (
                <p className="text-xs text-muted-foreground">Event ini belum punya RAB — belanja tetap tercatat untuk event, tanpa pos anggaran.</p>
              )}
            </>
          ) : (
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
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
