"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCcw, Check, X, Loader2 } from "lucide-react";

export function CameraCaptureModal({
    title = "Ambil Foto",
    onCancel,
    onConfirm,
    submitting = false,
}: {
    title?: string;
    onCancel: () => void;
    onConfirm: (blob: Blob) => void;
    submitting?: boolean;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [captured, setCaptured] = useState<{ blob: Blob; url: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [facing, setFacing] = useState<"user" | "environment">("user");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const s = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: facing },
                    audio: false,
                });
                if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
                setStream(s);
                if (videoRef.current) {
                    videoRef.current.srcObject = s;
                    await videoRef.current.play().catch(() => { });
                }
            } catch (e: any) {
                setError(e?.message || "Gagal mengakses kamera. Pastikan izin diberikan.");
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facing]);

    useEffect(() => {
        return () => {
            stream?.getTracks().forEach((t) => t.stop());
            if (captured) URL.revokeObjectURL(captured.url);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stream]);

    async function capture() {
        const video = videoRef.current;
        if (!video) return;
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 480;
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob((blob) => {
            if (!blob) return;
            if (captured) URL.revokeObjectURL(captured.url);
            setCaptured({ blob, url: URL.createObjectURL(blob) });
        }, "image/jpeg", 0.85);
    }

    function retake() {
        if (captured) URL.revokeObjectURL(captured.url);
        setCaptured(null);
    }

    function confirm() {
        if (!captured) return;
        onConfirm(captured.blob);
    }

    function flipCamera() {
        stream?.getTracks().forEach((t) => t.stop());
        setStream(null);
        setFacing((f) => (f === "user" ? "environment" : "user"));
    }

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-lg shadow-xl max-w-xl w-full max-h-[92vh] flex flex-col">
                <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Camera className="h-5 w-5 text-primary" /> {title}
                    </h3>
                    <button onClick={onCancel} disabled={submitting} className="p-1 hover:bg-muted rounded disabled:opacity-50">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-hidden bg-black flex items-center justify-center relative">
                    {error ? (
                        <div className="text-white text-center p-6">
                            <p className="font-medium">Kamera tidak tersedia</p>
                            <p className="text-xs text-gray-300 mt-2">{error}</p>
                        </div>
                    ) : captured ? (
                        <img src={captured.url} alt="captured" className="max-w-full max-h-[60vh] object-contain" />
                    ) : (
                        <video ref={videoRef} playsInline muted className="max-w-full max-h-[60vh] object-contain" />
                    )}
                </div>
                <div className="p-4 border-t flex items-center gap-2 justify-between">
                    {captured ? (
                        <>
                            <button
                                onClick={retake} disabled={submitting}
                                className="flex items-center gap-1 px-3 py-2 border rounded text-sm hover:bg-muted disabled:opacity-50"
                            >
                                <RefreshCcw className="h-4 w-4" /> Ulang
                            </button>
                            <button
                                onClick={confirm} disabled={submitting}
                                className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                Konfirmasi & Submit
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={flipCamera}
                                className="flex items-center gap-1 px-3 py-2 border rounded text-sm hover:bg-muted"
                            >
                                <RefreshCcw className="h-4 w-4" /> Balik Kamera
                            </button>
                            <button
                                onClick={capture} disabled={!stream || !!error}
                                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded text-sm hover:opacity-90 disabled:opacity-50"
                            >
                                <Camera className="h-4 w-4" /> Ambil Foto
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
