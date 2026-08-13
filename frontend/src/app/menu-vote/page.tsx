"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Vote, Plus, X, Loader2, Copy, Check, Trophy, Lock, Clock, Share2, Trash2, ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MenuMultiSelect } from "@/components/menu/MenuMultiSelect";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  getVoteSessions, getVoteSession, createVoteSession, closeVoteSession, deleteVoteSession, voteShareUrl,
  type VoteSessionRow,
} from "@/lib/api/menuVote";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

function sisaWaktu(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "kedaluwarsa";
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return min > 0 ? `${min} mnt ${sec} dtk lagi` : `${sec} dtk lagi`;
}

export default function MenuVotePage() {
  const { isManager, currentUser } = useCurrentUser();
  const [newOpen, setNewOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["vote-sessions"],
    queryFn: getVoteSessions,
    enabled: isManager,
    refetchInterval: 8000,
  });

  // Gate: hanya owner/admin. currentUser undefined = masih loading.
  if (currentUser && !isManager) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Khusus owner/admin"
        description="Halaman kelola voting menu hanya dapat diakses oleh owner atau admin."
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Voting Menu Makan"
        description="Buat sesi voting, bagikan link publik (sementara), lalu tetapkan menu pemenang."
        icon={Vote}
        actions={
          <button
            onClick={() => setNewOpen(true)}
            className="px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Sesi Vote Baru
          </button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState icon={Vote} title="Belum ada sesi voting" description="Buat sesi voting pertama dengan beberapa kandidat menu." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setDetailId(s.id)}
              className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{s.title || `Vote ${fmtDate(s.planDate)}`}</h3>
                  <p className="text-xs text-muted-foreground">Makan: {fmtDate(s.planDate)} · {s.candidates.length} kandidat</p>
                </div>
                {s.status === "OPEN" ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success shrink-0">OPEN</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">CLOSED</span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{s._count?.ballots ?? 0} suara</span>
                {s.status === "OPEN" && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {sisaWaktu(s.expiresAt)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {newOpen && <NewSessionModal onClose={() => setNewOpen(false)} />}
      {detailId !== null && <SessionDetailDrawer id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

// ─── Modal sesi baru ───────────────────────────────────────────────────────

function NewSessionModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [planDate, setPlanDate] = useState(new Date().toISOString().slice(0, 10));
  const [menuIds, setMenuIds] = useState<number[]>([]);
  const [duration, setDuration] = useState(15);
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      createVoteSession({ title: title.trim() || null, planDate, menuIds, durationMinutes: duration }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vote-sessions"] });
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.message || "Gagal membuat sesi"),
  });

  function submit() {
    setError(null);
    if (menuIds.length < 2) return setError("Pilih minimal 2 kandidat menu");
    mut.mutate();
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-card rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-bold flex items-center gap-2">
            <Vote className="h-5 w-5 text-primary" /> Sesi Vote Baru
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {error && <div className="p-2.5 bg-destructive/15 text-destructive rounded text-sm">{error}</div>}

          <div>
            <label className="text-xs font-medium">Judul (opsional)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
              placeholder="mis. Makan Siang Jumat"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Tanggal Makan</label>
              <input
                type="date"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Durasi Link (menit)</label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={duration || ""}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full border border-border bg-background rounded px-2 py-1.5 text-sm mt-0.5"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Kandidat Menu (2–5)</label>
            <div className="mt-1">
              <MenuMultiSelect value={menuIds} onChange={setMenuIds} max={5} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-3 py-1.5 rounded text-sm border border-border hover:bg-muted">
              Batal
            </button>
            <button
              onClick={submit}
              disabled={mut.isPending}
              className="px-4 py-1.5 rounded text-sm bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5 disabled:opacity-60"
            >
              {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Buat & Bagikan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Drawer detail sesi ────────────────────────────────────────────────────

function SessionDetailDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const { data: s, isLoading } = useQuery<VoteSessionRow>({
    queryKey: ["vote-session", id],
    queryFn: () => getVoteSession(id),
    refetchInterval: (query) => (query.state.data?.status === "OPEN" ? 5000 : false),
  });

  const closeMut = useMutation({
    mutationFn: () => closeVoteSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vote-session", id] });
      qc.invalidateQueries({ queryKey: ["vote-sessions"] });
      qc.invalidateQueries({ queryKey: ["menu-plan-rekap"] });
    },
  });

  const delMut = useMutation({
    mutationFn: () => deleteVoteSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vote-sessions"] });
      onClose();
    },
  });

  const totalVotes = s?.tally?.totalVotes ?? 0;
  const winnerName = s?.candidates.find((c) => c.menuId === s?.winnerMenuId)?.menu.name;

  function copyLink() {
    if (!s) return;
    navigator.clipboard.writeText(voteShareUrl(s.publicToken)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-card rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-bold flex items-center gap-2">
            <Vote className="h-5 w-5 text-primary" /> {s?.title || "Detail Voting"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading || !s ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {s.status === "OPEN" ? (
              <>
                {/* Link publik */}
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <Share2 className="h-3.5 w-3.5" /> Link Voting (bagikan ke pemilih)
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={voteShareUrl(s.publicToken)}
                      className="flex-1 border border-border bg-background rounded px-2 py-1.5 text-xs"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <button onClick={copyLink} className="px-2.5 py-1.5 rounded text-xs bg-primary text-primary-foreground flex items-center gap-1">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Tersalin" : "Salin"}
                    </button>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" /> Berlaku {sisaWaktu(s.expiresAt)}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-2 text-sm">
                <Trophy className="h-5 w-5 text-primary" />
                {winnerName ? (
                  <span>
                    Pemenang: <b>{winnerName}</b>.{" "}
                    {s.plan && (
                      <Link href="/menu-plan" className="text-primary hover:underline">
                        Lihat di rencana →
                      </Link>
                    )}
                  </span>
                ) : (
                  <span>Sesi ditutup tanpa suara masuk.</span>
                )}
              </div>
            )}

            {/* Hasil tally */}
            <div>
              <h3 className="text-sm font-semibold mb-1">Perolehan Suara ({totalVotes} total)</h3>
              <div className="space-y-2">
                {s.candidates.map((c) => {
                  const count = s.tally?.counts[c.menuId] ?? 0;
                  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                  const isWinner = s.status === "CLOSED" && c.menuId === s.winnerMenuId;
                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className={isWinner ? "font-semibold text-primary flex items-center gap-1" : ""}>
                          {isWinner && <Trophy className="h-3.5 w-3.5" />}
                          {c.menu.name}
                        </span>
                        <span className="tabular-nums text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted mt-1 overflow-hidden">
                        <div className={`h-full ${isWinner ? "bg-primary" : "bg-primary/50"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Aksi */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  if (confirm("Hapus sesi voting ini?")) delMut.mutate();
                }}
                className="px-3 py-1.5 rounded text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" /> Hapus
              </button>
              {s.status === "OPEN" && (
                <button
                  onClick={() => closeMut.mutate()}
                  disabled={closeMut.isPending}
                  className="px-4 py-1.5 rounded text-sm bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5 disabled:opacity-60"
                >
                  {closeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Tutup & Tetapkan Pemenang
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
