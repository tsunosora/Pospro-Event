"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, ArrowDownCircle, Loader2, Users } from "lucide-react";
import { createPenerimaan } from "@/lib/api/belanja";
import { getUsers } from "@/lib/api/settings";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

type UserOpt = { id: number; name?: string | null };

/** Modal catat uang masuk (kas dari owner ke admin). Tanpa approval — langsung tercatat. */
export function UangMasukModal({ open, onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();
  const [amount, setAmount] = useState<number>(0);
  const [source, setSource] = useState<string>("Owner");
  const [note, setNote] = useState<string>("");
  const [receivedAt, setReceivedAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [attributeToUserId, setAttributeToUserId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  const { data: users = [] } = useQuery<UserOpt[]>({ queryKey: ["users"], queryFn: getUsers, staleTime: 5 * 60 * 1000 });

  const saveMut = useMutation({
    mutationFn: () =>
      createPenerimaan({
        amount,
        source: source.trim() || null,
        note: note.trim() || null,
        receivedAt,
        attributeToUserId: attributeToUserId === "" ? null : Number(attributeToUserId),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kas-summary"] });
      qc.invalidateQueries({ queryKey: ["kas-by-admin"] });
      qc.invalidateQueries({ queryKey: ["penerimaan"] });
      setAmount(0);
      setNote("");
      onSaved?.();
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.message || "Gagal menyimpan"),
  });

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!(amount > 0)) {
      setError("Nominal harus lebih dari 0");
      return;
    }
    saveMut.mutate();
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-bold flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5 text-emerald-600" /> Uang Masuk
          </h2>
          <button onClick={onClose} className="p-1 rounded cursor-pointer transition-colors hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-4 space-y-3">
          {error && <div className="p-2.5 bg-destructive/15 text-destructive rounded text-sm">{error}</div>}

          <div>
            <label className="text-xs font-medium">Nominal *</label>
            <input
              type="number"
              inputMode="numeric"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full border border-border bg-background rounded px-2 py-2 text-lg font-semibold mt-0.5"
              placeholder="0"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Dari</label>
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
                placeholder="Owner"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Tanggal</label>
              <input
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Catatan</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
              placeholder="opsional"
            />
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
              className="px-3 py-1.5 rounded text-sm bg-emerald-600 text-white hover:opacity-90 flex items-center gap-1.5 disabled:opacity-60"
            >
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
