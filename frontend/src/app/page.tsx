"use client";

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
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import "dayjs/locale/id";
import { cn } from "@/lib/utils";
import {
  getEventDashboard,
  type EventDashboardSnapshot,
  type EventRecord,
  type EventStatus,
} from "@/lib/api/events";

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
