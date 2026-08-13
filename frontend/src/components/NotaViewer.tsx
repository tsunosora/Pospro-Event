"use client";

import { useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw, Download } from "lucide-react";

/** Lightbox nota/bukti: preview di halaman (bukan tab baru), bisa di-zoom & digeser. PDF via embed. */
export function NotaViewer({ url, onClose }: { url: string; onClose: () => void }) {
  const isPdf = /\.pdf($|\?)/i.test(url);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const zoomIn = () => setScale((s) => Math.min(6, +(s + 0.25).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)));
  const reset = () => { setScale(1); setPos({ x: 0, y: 0 }); };

  function onWheel(e: React.WheelEvent) {
    setScale((s) => Math.min(6, Math.max(0.5, +(s + (e.deltaY < 0 ? 0.2 : -0.2)).toFixed(2))));
  }
  function onDown(e: React.MouseEvent) {
    if (scale <= 1) return;
    drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  }
  function onMove(e: React.MouseEvent) {
    if (drag.current) setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
  }
  function onUp() { drag.current = null; }

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 flex flex-col" onMouseUp={onUp} onMouseLeave={onUp}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 text-white text-sm bg-black/50">
        <span className="truncate">Bukti / Nota</span>
        <div className="flex items-center gap-1">
          {!isPdf && (
            <>
              <button onClick={zoomOut} className="p-1.5 rounded hover:bg-white/15" title="Perkecil"><ZoomOut className="h-4 w-4" /></button>
              <span className="w-12 text-center tabular-nums">{Math.round(scale * 100)}%</span>
              <button onClick={zoomIn} className="p-1.5 rounded hover:bg-white/15" title="Perbesar"><ZoomIn className="h-4 w-4" /></button>
              <button onClick={reset} className="p-1.5 rounded hover:bg-white/15" title="Reset"><RotateCcw className="h-4 w-4" /></button>
            </>
          )}
          <a href={url} download className="p-1.5 rounded hover:bg-white/15" title="Unduh"><Download className="h-4 w-4" /></a>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/15" title="Tutup"><X className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Isi */}
      <div
        className="flex-1 overflow-hidden flex items-center justify-center p-2"
        onWheel={!isPdf ? onWheel : undefined}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {isPdf ? (
          <iframe src={url} title="Nota PDF" className="w-full h-full bg-white rounded" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Bukti"
            draggable={false}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onDoubleClick={() => (scale > 1 ? reset() : setScale(2))}
            style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, cursor: scale > 1 ? "grab" : "zoom-in" }}
            className="max-h-full max-w-full object-contain select-none transition-transform duration-75"
          />
        )}
      </div>
    </div>
  );
}
