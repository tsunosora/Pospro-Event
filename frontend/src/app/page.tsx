"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Loader2,
  MapPin,
  Package,
  PackageOpen,
  PlayCircle,
  Plus,
  UserCog,
  Users,
  Calculator,
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import "dayjs/locale/id";
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  getEventDashboard,
  type EventDashboardSnapshot,
  type EventRecord,
  type EventStatus,
} from "@/lib/api/events";
import { getRabList, type RabPlan } from "@/lib/api/rab";
import { BRAND_META, type Brand } from "@/lib/api/brands";

dayjs.locale("id");

const STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Terjadwal",
  IN_PROGRESS: "Berjalan",
  COMPLETED: "Selesai",
  CANCELLED: "Batal",
};

const STATUS_STYLE: Record<EventStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SCHEDULED: "bg-chart-2/15 text-chart-2",
  IN_PROGRESS: "bg-primary/15 text-primary",
  COMPLETED: "bg-chart-3/15 text-chart-3",
  CANCELLED: "bg-destructive/10 text-destructive",
};

function fmtDate(v?: string | null) {
  if (!v) return "—";
  return dayjs(v).format("DD MMM YYYY");
}

function fmtDateTime(v?: string | null) {
  if (!v) return "—";
  return dayjs(v).format("DD MMM, HH:mm");
}

function fmtRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "—";
  if (start && end) {
    const s = dayjs(start);
    const e = dayjs(end);
    if (s.isSame(e, "day")) return s.format("DD MMM YYYY");
    if (s.isSame(e, "month")) return `${s.format("DD")}–${e.format("DD MMM YYYY")}`;
    return `${s.format("DD MMM")} – ${e.format("DD MMM YYYY")}`;
  }
  return fmtDate(start ?? end);
}

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["events-dashboard"],
    queryFn: getEventDashboard,
    refetchInterval: 60_000,
  });

  const { data: rabs } = useQuery({
    queryKey: ["dashboard-rab-list"],
    queryFn: getRabList,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Gagal memuat data dashboard.{" "}
          <button onClick={() => refetch()} className="text-primary hover:underline">
            Coba lagi
          </button>
        </p>
      </div>
    );
  }

  const monthLabel = dayjs().format("MMMM YYYY");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Event</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ringkasan event berjalan, PIC lapangan, dan barang yang sedang keluar.
          </p>
        </div>
        <Link
          href="/events/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          Event Baru
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={`Event ${monthLabel}`}
          value={data.stats.monthEvents}
          icon={CalendarDays}
        />
        <StatCard
          label="Sedang Berjalan"
          value={data.stats.inProgress}
          icon={PlayCircle}
          accent
        />
        <StatCard label="PIC Aktif" value={data.stats.activePics} icon={UserCog} />
        <StatCard
          label="Barang Keluar (pcs)"
          value={data.stats.itemsOut}
          icon={PackageOpen}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <InProgressList events={data.inProgress} />
          <MonthEventsList events={data.monthEvents} monthLabel={monthLabel} />
        </div>
        <div className="space-y-6">
          <ActivePicsCard pics={data.activePics} />
        </div>
      </div>

      <WithdrawalsCard withdrawals={data.recentWithdrawals} />

      {/* ─── Diagram RAB & Pipeline Project ─────────────────────────────── */}
      <RabDashboardSection rabs={rabs ?? []} />
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className="glass rounded-xl p-4 sm:p-5">
      <div
        className={cn(
          "inline-flex p-2 rounded-lg border",
          accent
            ? "bg-primary/15 text-primary border-primary/30"
            : "bg-muted text-muted-foreground border-border",
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <p className="mt-3 text-xs sm:text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 tabular-nums">
        {value}
      </p>
    </div>
  );
}

// ─── Event Sedang Berjalan ─────────────────────────────────────────────────

function InProgressList({ events }: { events: EventRecord[] }) {
  return (
    <div className="glass rounded-xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-primary" />
          Event Sedang Berjalan
        </h2>
        <span className="text-xs text-muted-foreground">{events.length} event</span>
      </div>
      {events.length === 0 ? (
        <EmptyHint
          icon={PlayCircle}
          text="Belum ada event yang berstatus berjalan."
        />
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <EventRow key={ev.id} ev={ev} highlight />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Event Bulan Ini ───────────────────────────────────────────────────────

function MonthEventsList({
  events,
  monthLabel,
}: {
  events: EventRecord[];
  monthLabel: string;
}) {
  return (
    <div className="glass rounded-xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          Event {monthLabel}
        </h2>
        <Link
          href="/events"
          className="text-xs text-primary hover:underline"
        >
          Lihat semua →
        </Link>
      </div>
      {events.length === 0 ? (
        <EmptyHint icon={CalendarDays} text="Tidak ada event terjadwal bulan ini." />
      ) : (
        <div className="space-y-2">
          {events.slice(0, 8).map((ev) => (
            <EventRow key={ev.id} ev={ev} />
          ))}
          {events.length > 8 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              +{events.length - 8} event lainnya
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function EventRow({ ev, highlight }: { ev: EventRecord; highlight?: boolean }) {
  return (
    <Link
      href={`/events/${ev.id}`}
      className={cn(
        "block rounded-lg border p-3 transition hover:border-primary/40 hover:bg-primary/5",
        highlight ? "border-primary/30 bg-primary/5" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] text-muted-foreground">
              {ev.code}
            </span>
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium",
                STATUS_STYLE[ev.status],
              )}
            >
              {STATUS_LABEL[ev.status]}
            </span>
          </div>
          <p className="mt-1 font-medium text-foreground truncate">{ev.name}</p>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {ev.venue && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {ev.venue}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {fmtRange(ev.eventStart, ev.eventEnd)}
            </span>
            {(ev.picWorker?.name || ev.picName) && (
              <span className="inline-flex items-center gap-1">
                <UserCog className="w-3 h-3" />
                PIC: {ev.picWorker?.name ?? ev.picName}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── PIC Aktif ─────────────────────────────────────────────────────────────

function ActivePicsCard({
  pics,
}: {
  pics: EventDashboardSnapshot["activePics"];
}) {
  return (
    <div className="glass rounded-xl p-5 sm:p-6">
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-primary" />
        PIC di Lapangan
      </h2>
      {pics.length === 0 ? (
        <EmptyHint icon={Users} text="Tidak ada PIC yang sedang bertugas." />
      ) : (
        <div className="space-y-4">
          {pics.map((pic) => (
            <div
              key={pic.workerId}
              className="border border-border/60 rounded-lg p-3"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {pic.name
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-foreground truncate">
                    {pic.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {pic.position ?? "Petugas"}
                    {pic.phone ? ` · ${pic.phone}` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-2 space-y-1.5">
                {pic.events.map((ev) => (
                  <Link
                    key={ev.id}
                    href={`/events/${ev.id}`}
                    className="block text-xs rounded bg-muted/40 hover:bg-muted px-2 py-1.5 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground truncate">
                        {ev.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-medium",
                          STATUS_STYLE[ev.status],
                        )}
                      >
                        {STATUS_LABEL[ev.status]}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                      {ev.venue && (
                        <span className="inline-flex items-center gap-0.5 truncate">
                          <MapPin className="w-2.5 h-2.5" />
                          {ev.venue}
                        </span>
                      )}
                      <span>{fmtRange(ev.eventStart, ev.eventEnd)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Barang Keluar ─────────────────────────────────────────────────────────

function WithdrawalsCard({
  withdrawals,
}: {
  withdrawals: EventDashboardSnapshot["recentWithdrawals"];
}) {
  const borrows = withdrawals.filter((w) => w.type === "BORROW");
  const uses = withdrawals.filter((w) => w.type === "USE");

  return (
    <div className="glass rounded-xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Barang Keluar & Tracking Kembali
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pinjam = wajib balik (TV, sofa, meja, dll). Pakai = habis pakai / operasional.
          </p>
        </div>
        <Link
          href="/gudang/peminjaman"
          className="text-xs text-primary hover:underline shrink-0"
        >
          Semua →
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <WithdrawalSection
          title="Barang Pinjam (Wajib Kembali)"
          icon={PackageOpen}
          accent
          withdrawals={borrows}
          emptyText="Tidak ada barang pinjaman aktif."
          showReturnTracking
        />
        <WithdrawalSection
          title="Barang Pakai (Operasional)"
          icon={Package}
          withdrawals={uses}
          emptyText="Belum ada pengeluaran operasional."
        />
      </div>
    </div>
  );
}

function WithdrawalSection({
  title,
  icon: Icon,
  accent,
  withdrawals,
  emptyText,
  showReturnTracking,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
  withdrawals: EventDashboardSnapshot["recentWithdrawals"];
  emptyText: string;
  showReturnTracking?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        accent ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20",
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn("w-4 h-4", accent ? "text-primary" : "text-muted-foreground")} />
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {withdrawals.length} keluar
        </span>
      </div>

      {withdrawals.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {withdrawals.slice(0, 6).map((w) => (
            <WithdrawalEntry
              key={w.id}
              w={w}
              showReturnTracking={showReturnTracking}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WithdrawalEntry({
  w,
  showReturnTracking,
}: {
  w: EventDashboardSnapshot["recentWithdrawals"][number];
  showReturnTracking?: boolean;
}) {
  const totalOut = w.items.reduce(
    (s, it) => s + (Number(it.quantity) - Number(it.returnedQty)),
    0,
  );
  const overdue =
    showReturnTracking &&
    w.scheduledReturnAt &&
    dayjs(w.scheduledReturnAt).isBefore(dayjs(), "day") &&
    totalOut > 0;

  return (
    <div className="rounded-md border border-border/60 bg-card/60 p-2.5 text-xs space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">{w.code}</span>
        <span className="text-[10px] text-muted-foreground">
          {fmtDateTime(w.createdAt)}
        </span>
      </div>

      <div className="flex items-center gap-2 text-[11px] flex-wrap">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <UserCog className="w-3 h-3" />
          {w.worker.name}
        </span>
        {w.event ? (
          <Link
            href={`/events/${w.event.id}`}
            className="inline-flex items-center gap-1 text-primary hover:underline truncate"
          >
            <CalendarDays className="w-3 h-3 shrink-0" />
            {w.event.name}
            {w.event.venue && (
              <span className="text-muted-foreground/80">· {w.event.venue}</span>
            )}
          </Link>
        ) : (
          <span className="text-muted-foreground italic truncate">
            Keperluan: {w.purpose}
          </span>
        )}
      </div>

      <div className="border-t border-border/50 pt-1.5 space-y-1">
        {w.items.map((it) => {
          const qty = Number(it.quantity);
          const ret = Number(it.returnedQty);
          const out = qty - ret;
          const fullyReturned = showReturnTracking && out === 0;
          return (
            <div
              key={it.id}
              className="flex items-center justify-between gap-2"
            >
              <span
                className={cn(
                  "truncate",
                  fullyReturned && "text-muted-foreground line-through",
                )}
              >
                {it.productVariant.product.name}
                {it.productVariant.variantName
                  ? ` ${it.productVariant.variantName}`
                  : ""}
              </span>
              {showReturnTracking ? (
                <span className="shrink-0 tabular-nums text-[10px] flex items-center gap-1">
                  <span className="text-muted-foreground">{ret}/{qty}</span>
                  {out > 0 ? (
                    <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold">
                      {out} belum balik
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-chart-3/15 text-chart-3 font-semibold">
                      kembali
                    </span>
                  )}
                </span>
              ) : (
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  ×{qty}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {showReturnTracking && (
        <div className="flex items-center justify-between gap-2 pt-1 text-[10px]">
          {w.scheduledReturnAt ? (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                overdue ? "text-destructive font-semibold" : "text-muted-foreground",
              )}
            >
              <CalendarDays className="w-3 h-3" />
              Jadwal balik: {fmtDate(w.scheduledReturnAt)}
              {overdue && " · TELAT"}
            </span>
          ) : (
            <span className="text-muted-foreground italic">
              Tanpa jadwal kembali
            </span>
          )}
          <span className="font-semibold text-primary">
            {totalOut} pcs outstanding
          </span>
        </div>
      )}
    </div>
  );
}

function EmptyHint({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 border border-dashed border-border rounded-lg text-muted-foreground">
      <Icon className="w-7 h-7 mb-2 opacity-40" />
      <p className="text-xs text-center">{text}</p>
    </div>
  );
}

// ─── RAB DASHBOARD SECTION ────────────────────────────────────────────────
// Diagram & KPI dari RAB list — owner-focused metrics

type EventStatusGroup = "ONGOING" | "UPCOMING" | "FINISHED" | "NO_DATE";

function getRabEventStatus(rab: RabPlan): EventStatusGroup {
  const start = rab.periodStart ? new Date(rab.periodStart) : null;
  const end = rab.periodEnd ? new Date(rab.periodEnd) : null;
  const now = new Date();
  if (!start && !end) return "NO_DATE";
  if (start && start > now) return "UPCOMING";
  if (end && end < now) return "FINISHED";
  if (start && (!end || end >= now)) return "ONGOING";
  return "NO_DATE";
}

function fmtRp(v: number) {
  if (!Number.isFinite(v)) return "Rp 0";
  return `Rp ${Math.round(v).toLocaleString("id-ID")}`;
}

function fmtShortRp(v: number) {
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `${sign}Rp ${(abs / 1_000).toFixed(0)}rb`;
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`;
}

function RabDashboardSection({ rabs }: { rabs: RabPlan[] }) {
  // ── Compute aggregates ─────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (rabs.length === 0) return null;

    let totalRabValue = 0;
    let totalCost = 0;
    let totalIncome = 0;
    let activeRabCount = 0;            // RAB yang status ONGOING/UPCOMING (pipeline aktif)
    const statusCounts: Record<EventStatusGroup, number> = {
      ONGOING: 0, UPCOMING: 0, FINISHED: 0, NO_DATE: 0,
    };
    const brandValue: Record<string, { count: number; value: number; cost: number }> = {};
    const rabsWithMetrics: Array<{
      id: number;
      code: string;
      title: string;
      customer: string | null;
      brand: Brand | null;
      totalRab: number;
      totalCost: number;
      selisih: number;
      saldoBersih: number;
      income: number;
      status: EventStatusGroup;
      missingCostCount: number;
      totalItemCount: number;
      isMarginFake: boolean;
    }> = [];

    for (const r of rabs) {
      // Backend GET /rab sekarang return aggregate fields — pakai langsung, hemat compute & RAM.
      // Fallback ke perhitungan manual via items[] (untuk backward compat kalau response model lama).
      let rabSum = typeof r.totalRab === "number" ? r.totalRab : 0;
      let costSum = typeof r.totalCost === "number" ? r.totalCost : 0;
      let missingCostCount = typeof r.missingCostItemCount === "number" ? r.missingCostItemCount : 0;
      let itemCount = typeof r.itemCount === "number" ? r.itemCount : 0;
      const hasAggregates = typeof r.totalRab === "number";
      if (!hasAggregates) {
        for (const it of (r.items ?? [])) {
          const q = typeof it.quantity === "string" ? parseFloat(it.quantity) : it.quantity;
          const qCost = it.quantityCost !== undefined && it.quantityCost !== null
            ? (typeof it.quantityCost === "string" ? parseFloat(it.quantityCost) : it.quantityCost)
            : q;
          const pRab = typeof it.priceRab === "string" ? parseFloat(it.priceRab) : it.priceRab;
          const pCost = typeof it.priceCost === "string" ? parseFloat(it.priceCost) : it.priceCost;
          rabSum += (q || 0) * (pRab || 0);
          costSum += (qCost || 0) * (pCost || 0);
          if ((pRab || 0) > 0 && (pCost || 0) === 0) missingCostCount += 1;
        }
        itemCount = (r.items ?? []).length;
      }
      const dp = parseFloat(r.dpAmount as any) || 0;
      const pel = parseFloat(r.pelunasan as any) || 0;
      const other = parseFloat(r.incomeOther as any) || 0;
      const incomeSum = dp + pel + other;
      const status = getRabEventStatus(r);

      totalRabValue += rabSum;
      totalCost += costSum;
      totalIncome += incomeSum;
      statusCounts[status] += 1;
      if (status === "ONGOING" || status === "UPCOMING") activeRabCount += 1;

      const brandKey = r.brand ?? "OTHER";
      if (!brandValue[brandKey]) brandValue[brandKey] = { count: 0, value: 0, cost: 0 };
      brandValue[brandKey].count += 1;
      brandValue[brandKey].value += rabSum;
      brandValue[brandKey].cost += costSum;

      rabsWithMetrics.push({
        id: r.id,
        code: r.code,
        title: r.title,
        customer: r.customer?.companyName ?? r.customer?.name ?? null,
        brand: r.brand,
        totalRab: rabSum,
        totalCost: costSum,
        selisih: rabSum - costSum,
        saldoBersih: incomeSum - costSum,
        income: incomeSum,
        status,
        missingCostCount,
        totalItemCount: itemCount,
        isMarginFake: costSum === 0 && rabSum > 0,
      });
    }

    const totalSelisih = totalRabValue - totalCost;
    const totalSaldoBersih = totalIncome - totalCost;
    const avgMargin = totalRabValue > 0 ? (totalSelisih / totalRabValue) * 100 : 0;

    // Top 5 by margin selisih — hanya RAB yang real cost-nya sudah lengkap
    // (kalau ada item belum cost, margin-nya over-estimate jadi unfair compare)
    const topByMargin = [...rabsWithMetrics]
      .filter((r) => !r.isMarginFake) // exclude RAB yang totalCost=0 (margin palsu)
      .sort((a, b) => b.selisih - a.selisih)
      .slice(0, 5);

    // Hitung RAB yang punya item missing cost — buat warning di section header
    const rabWithMissingCost = rabsWithMetrics.filter((r) => r.missingCostCount > 0).length;

    return {
      totalCount: rabs.length,
      activeRabCount,
      totalRabValue,
      totalCost,
      totalIncome,
      totalSelisih,
      totalSaldoBersih,
      avgMargin,
      statusCounts,
      brandValue,
      topByMargin,
      rabWithMissingCost,
    };
  }, [rabs]);

  if (rabs.length === 0) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <Calculator className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
        <h3 className="text-base font-semibold mb-1">Belum Ada RAB</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Diagram pipeline project akan muncul di sini setelah ada RAB pertama.
        </p>
        <Link
          href="/rab"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Buat RAB
        </Link>
      </div>
    );
  }

  if (!stats) return null;

  // Pie data for status distribution
  const statusData = [
    { name: "Berjalan", value: stats.statusCounts.ONGOING, color: "#10b981" },
    { name: "Akan Datang", value: stats.statusCounts.UPCOMING, color: "#3b82f6" },
    { name: "Selesai", value: stats.statusCounts.FINISHED, color: "#64748b" },
    { name: "Tanpa Tanggal", value: stats.statusCounts.NO_DATE, color: "#f59e0b" },
  ].filter((d) => d.value > 0);

  // Brand bar data
  const brandData = Object.entries(stats.brandValue).map(([brand, v]) => ({
    name: brand === "OTHER" ? "Tanpa Brand" : (BRAND_META[brand as Brand]?.short ?? brand),
    value: v.value,
    cost: v.cost,
    selisih: v.value - v.cost,
    count: v.count,
  })).sort((a, b) => b.value - a.value);

  const isHealthy = stats.totalSaldoBersih >= 0;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          Diagram RAB & Pipeline Project
        </h2>
        <Link
          href="/rab"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          Lihat semua RAB →
        </Link>
      </div>

      {/* KPI Cards — 4 angka utama yang harus dilihat owner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <RabKpiCard
          label="Pipeline Aktif"
          value={`${stats.activeRabCount} RAB`}
          subtext={`dari total ${stats.totalCount}`}
          icon={Calculator}
          color="primary"
        />
        <RabKpiCard
          label="Total Nilai Pipeline"
          value={fmtShortRp(stats.totalRabValue)}
          subtext={`Cost ${fmtShortRp(stats.totalCost)}`}
          icon={Wallet}
          color="blue"
        />
        <RabKpiCard
          label="Margin Proyeksi"
          value={`${stats.avgMargin.toFixed(1)}%`}
          subtext={fmtShortRp(stats.totalSelisih)}
          icon={stats.totalSelisih >= 0 ? TrendingUp : TrendingDown}
          color={stats.totalSelisih >= 0 ? "emerald" : "red"}
        />
        <RabKpiCard
          label="Saldo Bersih (Riil)"
          value={fmtShortRp(stats.totalSaldoBersih)}
          subtext={isHealthy ? "✅ Income menutupi cost" : "⚠ Pelunasan belum masuk"}
          icon={Wallet}
          color={isHealthy ? "emerald" : "amber"}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie chart: status distribution */}
        <div className="glass rounded-xl p-4 sm:p-5">
          <h3 className="text-sm font-bold mb-1 flex items-center gap-1.5">
            🎯 Distribusi RAB by Status Event
          </h3>
          <p className="text-[11px] text-muted-foreground mb-2">
            Pipeline health — berapa banyak project di tiap fase
          </p>
          {statusData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
              Belum ada data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={40}
                  paddingAngle={2}
                  label={(entry: any) => `${entry.name}: ${entry.value}`}
                  labelLine={false}
                  fontSize={10}
                >
                  {statusData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(v: any) => [`${v} RAB`, "Jumlah"]}
                  contentStyle={{ borderRadius: "8px", fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar chart: brand comparison */}
        <div className="glass rounded-xl p-4 sm:p-5">
          <h3 className="text-sm font-bold mb-1 flex items-center gap-1.5">
            🏢 Perbandingan Nilai per Brand
          </h3>
          <p className="text-[11px] text-muted-foreground mb-2">
            Total nilai RAB & cost per brand (Exindo / Xposer)
          </p>
          {brandData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
              Belum ada data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={brandData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => fmtShortRp(v)}
                />
                <RechartsTooltip
                  formatter={(v: any, n: any) => [fmtRp(Number(v)), n === "value" ? "Total RAB" : n === "cost" ? "Cost" : "Selisih"]}
                  contentStyle={{ borderRadius: "8px", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
                <Bar dataKey="value" name="Total RAB" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" name="Cost" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="selisih" name="Selisih" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top 5 RAB by margin */}
      <div className="glass rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              🏆 Top 5 Project — Margin Terbesar
            </h3>
            <p className="text-[11px] text-muted-foreground">
              RAB dengan profit proyeksi tertinggi
              <span className="text-amber-600"> · RAB tanpa real cost di-exclude</span>
            </p>
          </div>
        </div>

        {/* Warning kalau ada RAB dengan missing cost */}
        {stats.rabWithMissingCost > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800 mb-2">
            ⚠️ <b>{stats.rabWithMissingCost} RAB</b> punya item dengan Real Cost belum diisi — margin angkanya kemungkinan over-estimate. Update di detail RAB supaya akurat.
          </div>
        )}

        {stats.topByMargin.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            Belum ada RAB dengan Real Cost lengkap.
            <br />
            <span className="text-[10px] italic">Isi kolom &quot;Harga COST&quot; di tiap item RAB supaya muncul di leaderboard ini.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {stats.topByMargin.map((r, i) => {
              const isUntung = r.selisih >= 0;
              const margin = r.totalRab > 0 ? (r.selisih / r.totalRab) * 100 : 0;
              const widthPct = stats.topByMargin[0].selisih > 0
                ? Math.max(8, (r.selisih / stats.topByMargin[0].selisih) * 100)
                : 8;
              return (
                <Link
                  key={r.id}
                  href={`/rab/${r.id}`}
                  className="block rounded-lg border bg-card hover:bg-muted/30 hover:border-primary/40 transition p-2.5"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center">
                        #{i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-semibold truncate inline-flex items-center gap-1">
                          {r.title}
                          {r.missingCostCount > 0 && (
                            <span
                              title={`${r.missingCostCount} item belum ada Real Cost — margin partial estimate`}
                              className="shrink-0 text-[9px] px-1 py-0 rounded bg-amber-100 text-amber-700 border border-amber-300 font-medium"
                            >
                              ⚠ {r.missingCostCount}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {r.code}
                          {r.customer ? ` · ${r.customer}` : ""}
                          {r.brand ? ` · ${BRAND_META[r.brand]?.short ?? r.brand}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-xs sm:text-sm font-bold font-mono ${isUntung ? "text-emerald-600" : "text-red-600"}`}>
                        {isUntung ? "+" : "−"}{fmtShortRp(Math.abs(r.selisih))}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {margin.toFixed(0)}% margin
                      </div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${isUntung ? "bg-emerald-500" : "bg-red-500"} transition-all`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Hint footer */}
      <div className="text-[10px] text-muted-foreground italic text-center">
        💡 Diagram update otomatis tiap 60 detik. Klik RAB di top 5 untuk buka detail.
      </div>
    </div>
  );
}

function RabKpiCard({
  label, value, subtext, icon: Icon, color,
}: {
  label: string;
  value: string;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
  color: "primary" | "blue" | "emerald" | "amber" | "red";
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/15 text-primary border-primary/30",
    blue: "bg-blue-500/15 text-blue-600 border-blue-300/40",
    emerald: "bg-emerald-500/15 text-emerald-600 border-emerald-300/40",
    amber: "bg-amber-500/15 text-amber-600 border-amber-300/40",
    red: "bg-red-500/15 text-red-600 border-red-300/40",
  };
  return (
    <div className="glass rounded-xl p-3 sm:p-4">
      <div className={cn("inline-flex p-1.5 rounded-lg border", colorMap[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="mt-2 text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">
        {label}
      </p>
      <p className="text-base sm:text-xl font-bold text-foreground mt-0.5 tabular-nums break-words">
        {value}
      </p>
      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{subtext}</p>
    </div>
  );
}


