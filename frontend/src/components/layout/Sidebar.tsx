"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    ShoppingCart,
    BarChart3,
    Package,
    Wallet,
    FileText,
    MapPin,
    Calculator,
    Settings,
    Banknote,
    Users,
    X,
    Store,
    ClipboardList,
    Printer,
    Truck,
    ClipboardEdit,
    TrendingDown,
    FileSignature,
    FilePlus,
    Calculator as CalcIcon,
    Warehouse as WarehouseIcon,
    PackageOpen,
    CalendarDays,
    KanbanSquare,
    ListChecks,
    MessageCircle,
    Tags,
    Settings2,
} from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getTransactionEditRequests } from "@/lib/api/transactions";
import { getPendingInvoiceCount } from "@/lib/api/sales-orders";
import { getOverdueCount } from "@/lib/api/withdrawals";

type BadgeKey = "overdue" | "pendingInvoice" | "pendingEdit";

type NavEntry =
    | { kind: "section"; label: string }
    | {
          kind: "link";
          name: string;
          href: string;
          icon: typeof LayoutDashboard;
          badgeKey?: BadgeKey;
          managerOnly?: boolean;
      };

const navigation: NavEntry[] = [
    { kind: "link", name: "Dashboard", href: "/", icon: LayoutDashboard },

    // ── 🎯 Sales & Pipeline (lini utama 95%) ──
    { kind: "section", label: "Sales & Pipeline" },
    { kind: "link", name: "CRM — Pipeline", href: "/crm/board", icon: KanbanSquare },
    { kind: "link", name: "CRM — Dashboard", href: "/crm", icon: MessageCircle },
    { kind: "link", name: "CRM — Daftar Lead", href: "/crm/leads", icon: ListChecks },
    { kind: "link", name: "Data Pelanggan", href: "/customers", icon: Users },
    { kind: "link", name: "Penawaran Booth/Event", href: "/penawaran", icon: FilePlus },
    { kind: "link", name: "RAB (Anggaran Proyek)", href: "/rab", icon: CalcIcon },

    // ── 📅 Event & Produksi ──
    { kind: "section", label: "Event & Produksi" },
    { kind: "link", name: "Event Timeline (Gantt)", href: "/events/timeline", icon: CalendarDays },
    { kind: "link", name: "Jadwal Event", href: "/events", icon: CalendarDays },
    { kind: "link", name: "Laporan Crew Lapangan", href: "/reports/crew", icon: Users },
    { kind: "link", name: "Master Team Crew", href: "/settings/crew-teams", icon: Users },
    { kind: "link", name: "Antrian Produksi", href: "/produksi", icon: Printer },

    // ── 📦 Gudang & Stok ──
    { kind: "section", label: "Gudang & Stok" },
    { kind: "link", name: "Manajemen Stok", href: "/inventory", icon: Package },
    { kind: "link", name: "Laporan Stok", href: "/reports/stock", icon: TrendingDown },
    { kind: "link", name: "Data Supplier", href: "/inventory/suppliers", icon: Truck },
    { kind: "link", name: "Stok Opname", href: "/inventory/opname", icon: ClipboardList },
    { kind: "link", name: "Ambil dari Gudang", href: "/gudang/ambil", icon: PackageOpen },
    { kind: "link", name: "Peminjaman Gudang", href: "/gudang/peminjaman", icon: WarehouseIcon, badgeKey: "overdue" },

    // ── 💰 Keuangan ──
    { kind: "section", label: "Keuangan" },
    { kind: "link", name: "Cashflow Bisnis", href: "/cashflow", icon: Banknote },
    { kind: "link", name: "Laba per Project", href: "/reports/event-profit", icon: TrendingDown },
    { kind: "link", name: "Daftar DP / Piutang", href: "/transactions/dp", icon: Wallet },
    { kind: "link", name: "Invoice & Penawaran", href: "/invoices", icon: FileText },

    // ── 🖨️ Lini Printing & POS (5%) ──
    { kind: "section", label: "Lini Printing & POS" },
    { kind: "link", name: "Surat Order Designer", href: "/sales-orders", icon: FileSignature, badgeKey: "pendingInvoice" },
    { kind: "link", name: "Antrian Cetak Paper", href: "/print-queue", icon: Printer },
    { kind: "link", name: "Kasir POS", href: "/pos", icon: ShoppingCart },
    { kind: "link", name: "Rekap Penjualan", href: "/reports/sales", icon: BarChart3 },
    { kind: "link", name: "Laporan Laba Kotor", href: "/reports/profit", icon: BarChart3 },
    { kind: "link", name: "Riwayat Tutup Shift", href: "/reports/shift-history", icon: ClipboardList },

    // ── ⚙️ Tools & Pengaturan ──
    { kind: "section", label: "Tools" },
    { kind: "link", name: "Kalkulator HPP", href: "/reports/hpp", icon: Calculator },
    { kind: "link", name: "Peta Cuan Lokasi", href: "/maps", icon: MapPin },
    { kind: "link", name: "CRM — Stages", href: "/crm/stages", icon: Settings2 },
    { kind: "link", name: "CRM — Labels", href: "/crm/labels", icon: Tags },
    { kind: "link", name: "Permintaan Edit", href: "/transactions/edit-requests", icon: ClipboardEdit, badgeKey: "pendingEdit", managerOnly: true },
];

export function Sidebar() {
    const pathname = usePathname();
    const { isSidebarOpen, closeSidebar } = useUIStore();
    const { isManager } = useCurrentUser();

    // Ambil nama dan logo toko dari settings
    const { data: settings } = useQuery({
        queryKey: ['store-settings'],
        queryFn: getSettings,
        staleTime: 5 * 60 * 1000,
    });

    const { data: pendingEditRequests } = useQuery({
        queryKey: ['transaction-edit-requests', 'PENDING'],
        queryFn: () => getTransactionEditRequests('PENDING'),
        enabled: isManager,
        staleTime: 60_000,
        refetchInterval: 60_000,
    });
    const pendingEditCount = pendingEditRequests?.length ?? 0;

    const { data: pendingInvoiceData } = useQuery({
        queryKey: ['so-pending-invoice-count'],
        queryFn: getPendingInvoiceCount,
        staleTime: 30_000,
        refetchInterval: 30_000,
    });
    const pendingInvoiceCount = pendingInvoiceData?.count ?? 0;

    const { data: overdueData } = useQuery({
        queryKey: ['overdue-count'],
        queryFn: getOverdueCount,
        staleTime: 60_000,
        refetchInterval: 120_000,
    });
    const overdueCount = overdueData?.count ?? 0;

    const storeName = settings?.storeName || 'PosPro';
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const logoUrl = settings?.logoImageUrl ? `${API_URL}${settings.logoImageUrl}` : null;

    return (
        <>
            {/* Mobile backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar */}
            <div className={cn(
                "fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Header Sidebar — Logo & Nama Toko */}
                <div className="flex h-16 shrink-0 items-center justify-between px-4 bg-sidebar-accent/30 border-b border-sidebar-border/50">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {/* Logo Toko */}
                        <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0 overflow-hidden">
                            {logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={logoUrl} alt="Logo Toko" className="h-full w-full object-cover" />
                            ) : (
                                <Store className="h-5 w-5 text-sidebar-primary-foreground" />
                            )}
                        </div>
                        {/* Nama Toko */}
                        <span className="text-base font-bold text-sidebar-foreground tracking-tight truncate" title={storeName}>
                            {storeName}
                        </span>
                    </div>

                    {/* Close button untuk mobile */}
                    <button
                        className="lg:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground p-1 rounded-md shrink-0"
                        onClick={closeSidebar}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation links */}
                <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
                    <nav className="flex-1 space-y-1 px-3">
                        {navigation.map((entry, idx) => {
                            if (entry.kind === "section") {
                                return (
                                    <div
                                        key={`section-${idx}`}
                                        className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50"
                                    >
                                        {entry.label}
                                    </div>
                                );
                            }
                            if (entry.managerOnly && !isManager) return null;
                            const isActive = pathname === entry.href ||
                                (entry.href !== '/' && pathname.startsWith(entry.href + "/"));
                            const badgeCount =
                                entry.badgeKey === "overdue" ? overdueCount :
                                entry.badgeKey === "pendingInvoice" ? pendingInvoiceCount :
                                entry.badgeKey === "pendingEdit" ? pendingEditCount : 0;
                            return (
                                <Link
                                    key={entry.name}
                                    href={entry.href}
                                    onClick={() => {
                                        if (window.innerWidth < 1024) closeSidebar();
                                    }}
                                    className={cn(
                                        isActive
                                            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                                            : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                                        "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-all"
                                    )}
                                >
                                    <entry.icon
                                        className={cn(
                                            isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground",
                                            "mr-3 h-4 w-4 flex-shrink-0 transition-colors"
                                        )}
                                        aria-hidden="true"
                                    />
                                    <span className="flex-1">{entry.name}</span>
                                    {badgeCount > 0 && (
                                        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                            {badgeCount > 9 ? '9+' : badgeCount}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Footer Sidebar — Settings */}
                <div className="shrink-0 border-t border-sidebar-border p-4">
                    <Link
                        href="/settings"
                        onClick={() => { if (window.innerWidth < 1024) closeSidebar(); }}
                        className="group flex items-center rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all"
                    >
                        <Settings className="mr-3 h-5 w-5 text-sidebar-foreground/70 group-hover:text-sidebar-foreground transition-colors" />
                        Pengaturan
                    </Link>
                </div>
            </div>
        </>
    );
}
