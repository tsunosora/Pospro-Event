"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, User, Loader2, Camera, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { getPublicCrewByToken, publicCheckIn, publicCheckOut } from "@/lib/api/event-crew";

function fmt(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function durationMin(start: string | null, end: string | null): string {
    if (!start || !end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const min = Math.round(ms / 60000);
    if (min < 60) return `${min} menit`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h} jam ${m} menit`;
}

export default function PublicCrewPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const qc = useQueryClient();
    const { data, isLoading, error } = useQuery({
        queryKey: ["public-crew", token],
        queryFn: () => getPublicCrewByToken(token),
        retry: false,
    });

    const [photo, setPhoto] = useState<File | null>(null);
    const [note, setNote] = useState("");

    const checkInMut = useMutation({
        mutationFn: () => publicCheckIn(token, photo, note),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["public-crew", token] });
            setPhoto(null);
            setNote("");
        },
    });
    const checkOutMut = useMutation({
        mutationFn: () => publicCheckOut(token, photo, note),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["public-crew", token] });
            setPhoto(null);
            setNote("");
        },
    });

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }
    if (error || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/20 px-4">
                <div className="bg-background rounded-lg shadow border border-border p-6 max-w-md text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                    <h1 className="text-lg font-bold text-foreground">Link Tidak Valid</h1>
                    <p className="text-sm text-muted-foreground mt-2">
                        Link ini sudah kadaluarsa atau telah di-regenerate. Hubungi admin untuk minta link baru.
                    </p>
                </div>
            </div>
        );
    }

    const status =
        data.finishedAt ? "DONE" :
        data.startedAt ? "ON_SITE" : "ASSIGNED";

    return (
        <div className="min-h-screen bg-muted/20 py-6 px-4">
            <div className="max-w-md mx-auto space-y-4">
                {/* Header */}
                <div className="bg-primary text-primary-foreground rounded-lg p-4 shadow">
                    <div className="text-xs opacity-80">Pospro Event — Crew Check-in</div>
                    <h1 className="text-xl font-bold mt-1">{data.event.name}</h1>
                    <div className="flex items-center gap-1 text-xs mt-1 opacity-90">
                        <CalendarDays className="h-3 w-3" />
                        {data.event.code}
                    </div>
                </div>

                {/* Worker info */}
                <div className="bg-background border border-border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                            <div className="font-semibold">{data.worker.name}</div>
                            {data.role && <div className="text-xs text-muted-foreground">Tugas: {data.role}</div>}
                        </div>
                    </div>
                    {data.team && (
                        <div className="mt-2 pt-2 border-t flex items-center gap-2 text-xs">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.team.color }} />
                            <strong>{data.team.name}</strong>
                            {data.team.leader && (
                                <span className="text-muted-foreground">
                                    · 👑 {data.team.leader.name}
                                    {data.team.leader.phone && (
                                        <a href={`tel:${data.team.leader.phone}`} className="text-primary ml-1">{data.team.leader.phone}</a>
                                    )}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Event info */}
                <div className="bg-background border border-border rounded-lg p-4 shadow-sm space-y-2 text-sm">
                    {data.event.venue && (
                        <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>{data.event.venue}</div>
                        </div>
                    )}
                    {data.event.customerName && (
                        <div><strong>Klien:</strong> {data.event.customerName}</div>
                    )}
                    {(data.scheduledStart || data.scheduledEnd) && (
                        <div className="text-xs text-muted-foreground border-t pt-2">
                            <strong>Jadwal:</strong> {fmt(data.scheduledStart)} → {fmt(data.scheduledEnd)}
                        </div>
                    )}
                </div>

                {/* Check-in */}
                <div className={`bg-background border rounded-lg p-4 shadow-sm ${data.startedAt ? "border-green-300" : "border-amber-300"}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className={`h-5 w-5 ${data.startedAt ? "text-green-600" : "text-amber-600"}`} />
                        <h2 className="font-semibold">Check-in (Mulai Tugas)</h2>
                        {data.startedAt && <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto" />}
                    </div>

                    {data.startedAt ? (
                        <div className="text-sm space-y-1">
                            <div className="text-muted-foreground">Mulai: <strong className="text-foreground">{fmt(data.startedAt)}</strong></div>
                            {data.startNote && <div className="italic text-muted-foreground">"{data.startNote}"</div>}
                            {data.startPhotoUrl && (
                                <a href={`${process.env.NEXT_PUBLIC_API_URL}${data.startPhotoUrl}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                                    <Camera className="h-3.5 w-3.5" /> Lihat foto
                                </a>
                            )}
                        </div>
                    ) : (
                        <CheckForm
                            onSubmit={() => checkInMut.mutate()}
                            isPending={checkInMut.isPending}
                            error={checkInMut.error}
                            label="Mulai Tugas (Check-in)"
                            photo={photo}
                            setPhoto={setPhoto}
                            note={note}
                            setNote={setNote}
                            color="bg-amber-500 hover:bg-amber-600"
                        />
                    )}
                </div>

                {/* Check-out */}
                {status !== "ASSIGNED" && (
                    <div className={`bg-background border rounded-lg p-4 shadow-sm ${data.finishedAt ? "border-green-500" : "border-blue-300"}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className={`h-5 w-5 ${data.finishedAt ? "text-green-600" : "text-blue-600"}`} />
                            <h2 className="font-semibold">Check-out (Selesai)</h2>
                            {data.finishedAt && <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto" />}
                        </div>

                        {data.finishedAt ? (
                            <div className="text-sm space-y-1">
                                <div className="text-muted-foreground">Selesai: <strong className="text-foreground">{fmt(data.finishedAt)}</strong></div>
                                <div className="text-muted-foreground">Total durasi: <strong className="text-foreground">{durationMin(data.startedAt, data.finishedAt)}</strong></div>
                                {data.endNote && <div className="italic text-muted-foreground">"{data.endNote}"</div>}
                                {data.endPhotoUrl && (
                                    <a href={`${process.env.NEXT_PUBLIC_API_URL}${data.endPhotoUrl}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                                        <Camera className="h-3.5 w-3.5" /> Lihat foto
                                    </a>
                                )}
                                <div className="bg-green-50 text-green-800 rounded p-2 text-xs mt-2 text-center font-medium">
                                    ✅ Tugas selesai. Terima kasih!
                                </div>
                            </div>
                        ) : (
                            <CheckForm
                                onSubmit={() => checkOutMut.mutate()}
                                isPending={checkOutMut.isPending}
                                error={checkOutMut.error}
                                label="Selesai Tugas (Check-out)"
                                photo={photo}
                                setPhoto={setPhoto}
                                note={note}
                                setNote={setNote}
                                color="bg-green-600 hover:bg-green-700"
                            />
                        )}
                    </div>
                )}

                <div className="text-center text-[10px] text-muted-foreground pt-2">
                    Pospro Event © by Muhammad Faishal Abdul Hakim
                </div>
            </div>
        </div>
    );
}

function CheckForm({
    onSubmit, isPending, error, label, photo, setPhoto, note, setNote, color,
}: {
    onSubmit: () => void;
    isPending: boolean;
    error: unknown;
    label: string;
    photo: File | null;
    setPhoto: (f: File | null) => void;
    note: string;
    setNote: (s: string) => void;
    color: string;
}) {
    return (
        <div className="space-y-3">
            <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Foto (opsional)</label>
                <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                    className="block w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-border file:bg-muted file:text-foreground"
                />
                {photo && <div className="text-[10px] text-muted-foreground mt-1">📎 {photo.name}</div>}
            </div>
            <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Catatan (opsional)</label>
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Mis: kondisi lokasi, kendala, dll"
                    rows={2}
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
                />
            </div>
            {error != null && (
                <div className="bg-red-50 text-red-700 text-xs rounded p-2">
                    {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Gagal submit"}
                </div>
            )}
            <button
                onClick={onSubmit}
                disabled={isPending}
                className={`w-full py-3 rounded-md text-white font-semibold ${color} disabled:opacity-50 transition-colors`}
            >
                {isPending ? "Menyimpan..." : label}
            </button>
        </div>
    );
}
