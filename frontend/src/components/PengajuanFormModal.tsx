"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, FileText, Loader2 } from "lucide-react";
import { createPengajuan } from "@/lib/api/pengajuan";
import { getEvents } from "@/lib/api/events";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: (id: number) => void;
  defaultEventId?: number;
}

/** Modal buat header pengajuan (pilih event + judul opsional). */
export function PengajuanFormModal({ open, onClose, onSaved, defaultEventId }: Props) {
  const qc = useQueryClient();
  const [eventId, setEventId] = useState<number | "">(defaultEventId ?? "");
  const [title, setTitle] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const { data: events = [] } = useQuery({
    queryKey: ["events-all"],
    queryFn: () => getEvents(),
    staleTime: 5 * 60 * 1000,
  });

  const saveMut = useMutation({
    mutationFn: () =>
      createPengajuan({
        eventId: eventId === "" ? null : Number(eventId),
        title: title.trim() || null,
      }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["pengajuan-list"] });
      setTitle("");
      onSaved?.(created.id);
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.message || "Gagal menyimpan"),
  });

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!eventId && !title.trim()) {
      setError("Pilih event atau isi judul pengajuan");
      return;
    }
    saveMut.mutate();
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Buat Pengajuan
          </h2>
          <button onClick={onClose} className="p-1 rounded cursor-pointer transition-colors hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-4 space-y-3">
          {error && <div className="p-2.5 bg-destructive/15 text-destructive rounded text-sm">{error}</div>}

          <div>
            <label className="text-xs font-medium">Event</label>
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full border border-border bg-background rounded px-2 py-2 text-sm mt-0.5"
              autoFocus
            >
              <option value="">— tanpa event (RAB baru) —</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.code} — {ev.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Kosongkan jika belum ada event — RAB baru dibuat otomatis saat convert (judul jadi nama RAB).
            </p>
          </div>

          <div>
            <label className="text-xs font-medium">Judul{!eventId ? " *" : ""}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
              placeholder={eventId ? "opsional, mis. Pengajuan awal" : "wajib bila tanpa event, mis. Booth Pameran A"}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded text-sm border border-border hover:bg-muted">
              Batal
            </button>
            <button
              type="submit"
              disabled={saveMut.isPending}
              className="px-3 py-1.5 rounded text-sm bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5 disabled:opacity-60"
            >
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
