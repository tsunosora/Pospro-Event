"use client";

import { useMemo, useRef, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

interface WheelMenu {
  id: number;
  name: string;
}

interface Props {
  menus: WheelMenu[];
  onResult: (menuId: number) => void;
}

// Palet segmen (diputar berulang bila menu > jumlah warna)
const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export function SpinWheel({ menus, onResult }: Props) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<WheelMenu | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const n = menus.length;
  const seg = n > 0 ? 360 / n : 360;

  const gradient = useMemo(() => {
    if (n === 0) return "conic-gradient(#e5e7eb 0deg 360deg)";
    const stops = menus
      .map((_, i) => `${COLORS[i % COLORS.length]} ${i * seg}deg ${(i + 1) * seg}deg`)
      .join(", ");
    return `conic-gradient(${stops})`;
  }, [menus, n, seg]);

  function spin() {
    if (spinning || n < 2) return;
    setWinner(null);
    const idx = Math.floor(Math.random() * n);
    // Sudut agar tengah segmen idx berhenti di penunjuk atas (0deg).
    const target = 360 * 6 + (360 - (idx * seg + seg / 2));
    setSpinning(true);
    setRotation((prev) => prev - (prev % 360) + target);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSpinning(false);
      setWinner(menus[idx]);
      onResult(menus[idx].id);
    }, 4200);
  }

  if (n < 2) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6">
        Butuh minimal 2 menu aktif untuk memutar roda.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: 240, height: 240 }}>
        {/* Penunjuk atas */}
        <div className="absolute left-1/2 -top-1 -translate-x-1/2 z-10" style={{ width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "16px solid #111827" }} />
        <div
          className="rounded-full border-4 border-border shadow-inner"
          style={{
            width: 240,
            height: 240,
            background: gradient,
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.16, 0.99)" : "none",
          }}
        />
        {/* Hub tengah */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-card border border-border w-10 h-10 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5 max-w-xs">
        {menus.map((m, i) => (
          <span key={m.id} className="text-[11px] px-2 py-0.5 rounded-full text-white" style={{ background: COLORS[i % COLORS.length] }}>
            {m.name}
          </span>
        ))}
      </div>

      <button
        onClick={spin}
        disabled={spinning}
        className="px-5 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-2 disabled:opacity-60"
      >
        {spinning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {spinning ? "Memutar…" : "Putar Roda"}
      </button>

      {winner && !spinning && (
        <div className="text-sm text-center">
          Menu terpilih: <span className="font-bold text-primary">{winner.name}</span>
        </div>
      )}
    </div>
  );
}
