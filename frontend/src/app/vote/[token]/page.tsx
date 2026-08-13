"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { UtensilsCrossed, CheckCircle2, Loader2, Clock, XCircle, PartyPopper } from "lucide-react";
import { getPublicVote, castPublicVote, type PublicVoteData } from "@/lib/api/publicMenuVote";

const rp = (v: string | number) => "Rp " + Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

export default function PublicVotePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const [menuId, setMenuId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState<number>(1);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, error: qErr } = useQuery<PublicVoteData>({
    queryKey: ["public-vote", token],
    queryFn: () => getPublicVote(token),
    retry: false,
  });

  const voteMut = useMutation({
    mutationFn: () => castPublicVote(token, menuId!, name.trim(), weight),
    onSuccess: () => setDone(true),
    onError: (e: any) => setError(e?.message || "Gagal mengirim suara"),
  });

  function submit() {
    setError(null);
    if (!menuId) return setError("Pilih salah satu menu dulu");
    if (!name.trim()) return setError("Isi nama kamu dulu");
    voteMut.mutate();
  }

  return (
    <div className="min-h-screen bg-background flex items-start sm:items-center justify-center p-4">
      <div className="w-full max-w-md">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-2">
            <XCircle className="h-10 w-10 text-destructive mx-auto" />
            <h1 className="font-bold text-lg">Link tidak berlaku</h1>
            <p className="text-sm text-muted-foreground">{(qErr as Error)?.message || "Link vote sudah kedaluwarsa atau ditutup."}</p>
          </div>
        ) : done ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
            <PartyPopper className="h-12 w-12 text-primary mx-auto" />
            <h1 className="font-bold text-lg">Terima kasih, {name.trim()}!</h1>
            <p className="text-sm text-muted-foreground">Suaramu sudah tercatat.</p>
            <button
              onClick={() => setDone(false)}
              className="text-sm text-primary hover:underline"
            >
              Ubah pilihan
            </button>
          </div>
        ) : data ? (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="text-center">
              <UtensilsCrossed className="h-8 w-8 text-primary mx-auto" />
              <h1 className="font-bold text-lg mt-1">{data.title || "Voting Menu Makan"}</h1>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Untuk makan: {fmtDate(data.planDate)}
              </p>
            </div>

            {error && <div className="p-2.5 bg-destructive/15 text-destructive rounded text-sm">{error}</div>}

            <div className="space-y-2">
              <p className="text-sm font-medium">Pilih menu favoritmu:</p>
              {data.candidates.map((c) => {
                const selected = menuId === c.menuId;
                return (
                  <button
                    key={c.menuId}
                    onClick={() => setMenuId(c.menuId)}
                    className={`w-full flex items-center justify-between rounded-xl border p-3 text-left transition-colors ${selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                  >
                    <span className="font-medium flex items-center gap-2">
                      {selected ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <span className="h-5 w-5 rounded-full border border-border" />}
                      {c.menu.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-xs font-medium">Nama kamu / perwakilan</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-border bg-background rounded-lg px-3 py-2 text-sm mt-0.5"
                  placeholder="Nama"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Jumlah suara</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={weight || ""}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full border border-border bg-background rounded-lg px-3 py-2 text-sm mt-0.5"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-2">Isi &gt;1 bila mewakili beberapa anak perusahaan.</p>

            <button
              onClick={submit}
              disabled={voteMut.isPending}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {voteMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Kirim Suara
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
