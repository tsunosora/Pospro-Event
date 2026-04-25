"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Check, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { getWarehousePinStatus, setWarehousePin } from "@/lib/api/warehousePin";

export default function WarehousePinSettingsPage() {
    const qc = useQueryClient();
    const [pin, setPin] = useState("");
    const [confirm, setConfirm] = useState("");
    const [err, setErr] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const { data: status, isLoading } = useQuery({
        queryKey: ["warehouse-pin-status"],
        queryFn: getWarehousePinStatus,
    });

    const saveMut = useMutation({
        mutationFn: setWarehousePin,
        onSuccess: () => {
            setPin("");
            setConfirm("");
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            qc.invalidateQueries({ queryKey: ["warehouse-pin-status"] });
        },
        onError: (e: any) => setErr(e?.response?.data?.message || "Gagal menyimpan PIN"),
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
        <div className="p-6 space-y-4 max-w-lg">
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-primary" /> PIN Gudang Kiosk
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                    PIN ini dipakai pekerja untuk mengakses halaman <b>Ambil dari Gudang</b> tanpa login.
                    Bagikan ke pekerja yang berwenang. Ganti PIN kapan saja jika dirasa bocor.
                </p>
            </div>

            <div className="border rounded-lg p-4 bg-muted/30">
                {isLoading ? (
                    <p className="text-sm flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Memeriksa status…
                    </p>
                ) : status?.isSet ? (
                    <p className="text-sm flex items-center gap-2 text-green-700">
                        <ShieldCheck className="h-4 w-4" /> PIN sudah diatur. Isi di bawah untuk mengganti.
                    </p>
                ) : (
                    <p className="text-sm flex items-center gap-2 text-amber-700">
                        <ShieldAlert className="h-4 w-4" /> PIN belum diatur. Halaman kiosk tidak bisa dibuka sampai PIN dibuat.
                    </p>
                )}
            </div>

            <div className="border rounded-lg p-4 space-y-3">
                <div>
                    <label className="text-xs font-medium block mb-1">PIN Baru (4–8 digit angka)</label>
                    <input
                        type="password"
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={8}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                        className="w-full border rounded px-3 py-2 text-sm font-mono tracking-widest"
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
                        className="w-full border rounded px-3 py-2 text-sm font-mono tracking-widest"
                        placeholder="••••"
                    />
                </div>
                {err && <p className="text-xs text-red-600">{err}</p>}
                {saved && <p className="text-xs text-green-700">PIN tersimpan.</p>}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saveMut.isPending}
                        className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded text-sm hover:opacity-90 disabled:opacity-50"
                    >
                        {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Simpan PIN
                    </button>
                </div>
            </div>
        </div>
    );
}
