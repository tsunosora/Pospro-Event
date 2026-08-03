"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { getSchedulePinStatus, setSchedulePin } from "@/lib/api/schedulePin";
import { Button } from "@/components/ui/button";

export default function SchedulePinSettingsPage() {
    const qc = useQueryClient();
    const [pin, setPin] = useState("");
    const [confirm, setConfirm] = useState("");
    const [err, setErr] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const { data: status, isLoading } = useQuery({
        queryKey: ["schedule-pin-status"],
        queryFn: getSchedulePinStatus,
    });

    const saveMut = useMutation({
        mutationFn: setSchedulePin,
        onSuccess: () => {
            setPin("");
            setConfirm("");
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            qc.invalidateQueries({ queryKey: ["schedule-pin-status"] });
        },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setErr(msg || "Gagal menyimpan PIN");
        },
    });

    function handleSave() {
        setErr(null);
        if (!/^\d{4,8}$/.test(pin)) {
            setErr("PIN harus angka 4–8 digit");
            return;
        }
        if (pin !== confirm) {
            setErr("Konfirmasi PIN tidak cocok");
            return;
        }
        saveMut.mutate(pin);
    }

    return (
        <div className="space-y-4 max-w-lg">
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" /> PIN Jadwal Event
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                    PIN ini dipakai untuk membuka halaman <b>Jadwal Event</b> publik (<code>/jadwal</code>) tanpa login.
                    Bagikan ke pihak yang berwenang. Ganti PIN kapan saja jika dirasa bocor.
                </p>
            </div>

            <div className="glass rounded-xl p-4">
                {isLoading ? (
                    <p className="text-sm flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Memeriksa status…
                    </p>
                ) : status?.isSet ? (
                    <p className="text-sm flex items-center gap-2 text-success">
                        <ShieldCheck className="h-4 w-4" /> PIN sudah diatur. Isi di bawah untuk mengganti.
                    </p>
                ) : (
                    <p className="text-sm flex items-center gap-2 text-warning">
                        <ShieldAlert className="h-4 w-4" /> PIN belum diatur. Halaman jadwal publik tidak bisa dibuka sampai PIN dibuat.
                    </p>
                )}
            </div>

            <div className="glass rounded-xl p-4 space-y-3">
                <div>
                    <label className="text-xs font-medium block mb-1">PIN Baru (4–8 digit angka)</label>
                    <input
                        type="password"
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={8}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono tracking-widest bg-background text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="••••"
                    />
                </div>
                <div>
                    <label className="text-xs font-medium block mb-1">Ulangi PIN</label>
                    <input
                        type="password"
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={8}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono tracking-widest bg-background text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="••••"
                    />
                </div>
                {err && <p className="text-xs text-destructive">{err}</p>}
                {saved && <p className="text-xs text-success">PIN tersimpan.</p>}
                <div className="flex justify-end">
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saveMut.isPending}
                    >
                        {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Simpan PIN
                    </Button>
                </div>
            </div>
        </div>
    );
}
