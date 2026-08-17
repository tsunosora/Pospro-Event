"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Crown,
  ShieldCheck,
  TrendingUp,
  Wallet,
  CalendarDays,
  ClipboardCheck,
  ChevronRight,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getPengajuanPendingCount } from "@/lib/api/pengajuan";
import { PengajuanApprovalInbox } from "@/components/PengajuanApprovalInbox";

/** Halaman khusus owner: pusat kendali. Untuk saat ini fokus persetujuan pra-RAB;
 *  modul lain (kinerja, laporan keuangan, dll) menyusul — layout sudah disiapkan. */
export default function OwnerPanelPage() {
  const { currentUser, isManager } = useCurrentUser();

  const { data: pending } = useQuery({
    queryKey: ["pengajuan-pending-count"],
    queryFn: getPengajuanPendingCount,
    enabled: isManager,
  });
  const pendingCount = pending?.count ?? 0;

  const today = useMemo(
    () =>
      new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [],
  );

  if (!isManager) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center text-muted-foreground">
        <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Halaman ini khusus owner/admin.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <Crown className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Panel Owner</h1>
            <p className="text-sm text-muted-foreground">
              {currentUser?.name ? `Halo, ${currentUser.name}. ` : ""}
              {today}
            </p>
          </div>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Menunggu Persetujuan"
          value={String(pendingCount)}
          tone={pendingCount > 0 ? "warn" : "ok"}
          hint={pendingCount > 0 ? "Perlu ditindak" : "Semua beres"}
        />
        <StatTile icon={<TrendingUp className="h-5 w-5" />} label="Kinerja Tim" value="—" hint="Segera hadir" muted />
        <StatTile icon={<Wallet className="h-5 w-5" />} label="Laporan Keuangan" value="—" hint="Segera hadir" muted />
        <StatTile icon={<CalendarDays className="h-5 w-5" />} label="Event Berjalan" value="—" hint="Segera hadir" muted />
      </div>

      {/* Modul aktif: Persetujuan Pengajuan */}
      <SectionCard
        icon={<ShieldCheck className="h-5 w-5 text-primary" />}
        title="Persetujuan Pengajuan (Pra-RAB)"
        subtitle="Setujui item pengajuan dari sini tanpa membuka tiap pengajuan."
      >
        <PengajuanApprovalInbox />
      </SectionCard>

      {/* Modul mendatang */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Modul mendatang</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ComingSoonCard
            icon={<TrendingUp className="h-5 w-5" />}
            title="Kinerja & Produktivitas"
            desc="Pantau performa tim, event, dan penjualan dalam satu tampilan."
          />
          <ComingSoonCard
            icon={<Wallet className="h-5 w-5" />}
            title="Laporan Keuangan"
            desc="Ringkasan arus kas, laba per event, dan piutang."
          />
          <ComingSoonCard
            icon={<CalendarDays className="h-5 w-5" />}
            title="Monitoring Event"
            desc="Status event berjalan, jadwal, dan progres lapangan."
          />
          <ComingSoonCard
            icon={<ClipboardCheck className="h-5 w-5" />}
            title="Persetujuan Lain"
            desc="Permintaan edit/hapus transaksi & persetujuan lintas modul."
          />
        </div>
      </section>
    </div>
  );
}

/* ── Komponen presentasional reusable (siap dipakai modul owner berikutnya) ── */

function StatTile({
  icon,
  label,
  value,
  hint,
  tone = "neutral",
  muted = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "ok" | "warn";
  muted?: boolean;
}) {
  const toneCls =
    tone === "warn"
      ? "text-amber-600"
      : tone === "ok"
        ? "text-emerald-600"
        : "text-foreground";
  return (
    <div className={`bg-card border border-border rounded-xl p-3 ${muted ? "opacity-70" : ""}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={muted ? "" : toneCls}>{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className={`mt-1.5 text-2xl font-bold ${muted ? "text-muted-foreground" : toneCls}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-border rounded-xl p-4 md:p-5">
      <div className="mb-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          {icon} {title}
        </h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function ComingSoonCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="border border-dashed border-border rounded-xl p-4 bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
          Segera hadir
        </span>
      </div>
      <h3 className="text-sm font-semibold mt-2.5 flex items-center gap-1">
        {title}
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </h3>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </div>
  );
}
