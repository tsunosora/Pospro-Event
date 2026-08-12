"use client";

import { RefObject, useEffect } from "react";

/**
 * Auto-scroll untuk layar standby: bila konten meluber, scroll turun pelan;
 * sampai bawah → jeda → balik ke atas → ulangi. BERHENTI saat ada interaksi
 * (gerak kursor / wheel / sentuh / tombol), lanjut lagi setelah idle.
 *
 * @param enabled aktif/nonaktif (mis. dari toggle & saat tidak loading)
 * @param resetKey ubah nilai → scroll balik ke atas (mis. ganti view/bulan)
 */
export function useAutoScroll(
    ref: RefObject<HTMLElement | null>,
    enabled: boolean,
    resetKey?: unknown,
) {
    // Balik ke atas saat konten berganti (view/bulan).
    useEffect(() => {
        if (ref.current) ref.current.scrollTop = 0;
    }, [ref, resetKey]);

    useEffect(() => {
        const el = ref.current;
        if (!el || !enabled) return;

        const DOWN = 34;        // px/detik saat turun
        const UP_FACTOR = 1;    // kecepatan balik ke atas = sama dengan turun
        const IDLE_MS = 6000;   // lanjut setelah sekian ms tanpa interaksi
        const PAUSE_BOTTOM = 2600;
        const PAUSE_TOP = 1400;

        let raf = 0;
        let paused = false;
        let dir: 1 | -1 = 1;
        let waitUntil = 0;
        let last = performance.now();
        let idleTimer: ReturnType<typeof setTimeout> | undefined;
        // Akumulator posisi float — JANGAN baca el.scrollTop balik (dibulatkan ke
        // integer → pecahan hilang tiap frame → gerak tersendat). Simpan sendiri.
        let pos = el.scrollTop;

        const maxTop = () => el.scrollHeight - el.clientHeight;

        const step = (now: number) => {
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            const max = maxTop();
            if (!paused && max > 4 && now >= waitUntil) {
                if (dir === 1) {
                    pos += DOWN * dt;
                    if (pos >= max) { pos = max; dir = -1; waitUntil = now + PAUSE_BOTTOM; }
                } else {
                    pos -= DOWN * UP_FACTOR * dt;
                    if (pos <= 0) { pos = 0; dir = 1; waitUntil = now + PAUSE_TOP; }
                }
                el.scrollTop = pos;
            }
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);

        const onInteract = () => {
            paused = true;
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                paused = false;
                pos = el.scrollTop; // sinkron ke posisi terakhir user
                last = performance.now();
            }, IDLE_MS);
        };

        // Hanya interaksi DISENGAJA yang menjeda: scroll (wheel), sentuh, klik/tekan
        // pointer, atau keyboard. `mousemove` SENGAJA TIDAK dipakai — di layar
        // standby/TV kursor overlay atau remote bisa memicu mousemove terus-menerus
        // sehingga timer idle 6s tak pernah habis → auto-scroll "macet" selamanya.
        const passive = { passive: true } as const;
        el.addEventListener("wheel", onInteract, passive);
        el.addEventListener("touchstart", onInteract, passive);
        el.addEventListener("pointerdown", onInteract, passive);
        window.addEventListener("keydown", onInteract);

        return () => {
            cancelAnimationFrame(raf);
            if (idleTimer) clearTimeout(idleTimer);
            el.removeEventListener("wheel", onInteract);
            el.removeEventListener("touchstart", onInteract);
            el.removeEventListener("pointerdown", onInteract);
            window.removeEventListener("keydown", onInteract);
        };
    }, [ref, enabled, resetKey]);
}
