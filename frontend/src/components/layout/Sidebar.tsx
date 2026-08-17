"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, ChevronLeft, Search } from "lucide-react";
import {
    LayoutDashboard,
    ShoppingCart,
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
    FilePlus,
    Calculator as CalcIcon,
    Warehouse as WarehouseIcon,
    PackageOpen,
    PackagePlus,
    CalendarDays,
    KanbanSquare,
    ListChecks,
    MessageCircle,
    Tags,
    Settings2,
    UtensilsCrossed,
    BookOpen,
    Vote,
    HardHat,
    Crown,
} from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getTransactionEditRequests } from "@/lib/api/transactions";
import { getOverdueCount } from "@/lib/api/withdrawals";
import { getPengajuanPendingCount } from "@/lib/api/pengajuan";

type BadgeKey = "overdue" | "pendingEdit" | "pendingPengajuan";

type LinkEntry = {
    kind: "link";
    name: string;
    href: string;
    icon: typeof LayoutDashboard;
    badgeKey?: BadgeKey;
    managerOnly?: boolean;
};

type NavEntry =
    | { kind: "section"; label: string }
    | LinkEntry
    | {
          kind: "group";
          name: string;
          icon: typeof LayoutDashboard;
          children: LinkEntry[];
      };

// Item yang selalu tampil di atas (tanpa grup)
const pinnedLinks: LinkEntry[] = [
    { kind: "link", name: "Dashboard", href: "/", icon: LayoutDashboard },
    { kind: "link", name: "Panel Owner", href: "/owner", icon: Crown, badgeKey: "pendingPengajuan", managerOnly: true },
];

// Semua menu fungsional dikelompokkan ke grup collapsible (accordion) — hanya 1 terbuka.
const groups: Extract<NavEntry, { kind: "group" }>[] = [
    {
        kind: "group", name: "Sales & CRM", icon: KanbanSquare, children: [
            { kind: "link", name: "CRM — Pipeline", href: "/crm/board", icon: KanbanSquare },
            { kind: "link", name: "CRM — Dashboard", href: "/crm", icon: MessageCircle },
            { kind: "link", name: "CRM — Daftar Lead", href: "/crm/leads", icon: ListChecks },
            { kind: "link", name: "Data Pelanggan", href: "/customers", icon: Users },
            { kind: "link", name: "Penawaran Booth/Event", href: "/penawaran", icon: FilePlus },
            { kind: "link", name: "RAB (Anggaran Proyek)", href: "/rab", icon: CalcIcon },
            { kind: "link", name: "Pengajuan (Pra-RAB)", href: "/pengajuan", icon: FileText },
        ],
    },
    {
        kind: "group", name: "Event & Produksi", icon: CalendarDays, children: [
            { kind: "link", name: "Event Timeline (Gantt)", href: "/events/timeline", icon: CalendarDays },
            { kind: "link", name: "Jadwal Event", href: "/events", icon: CalendarDays },
            { kind: "link", name: "Laporan Crew Lapangan", href: "/reports/crew", icon: Users },
            { kind: "link", name: "Antrian Produksi", href: "/produksi", icon: Printer },
        ],
    },
    {
        kind: "group", name: "Gudang & Stok", icon: Package, children: [
            { kind: "link", name: "Manajemen Stok", href: "/inventory", icon: Package },
            { kind: "link", name: "Laporan Stok", href: "/reports/stock", icon: TrendingDown },
            { kind: "link", name: "Data Supplier", href: "/inventory/suppliers", icon: Truck },
            { kind: "link", name: "Stok Opname", href: "/inventory/opname", icon: ClipboardList },
            { kind: "link", name: "Ambil dari Gudang", href: "/gudang/ambil", icon: PackageOpen },
            { kind: "link", name: "Stok Lapangan (Tukang)", href: "/gudang/stok", icon: PackagePlus },
            { kind: "link", name: "Peminjaman Gudang", href: "/gudang/peminjaman", icon: WarehouseIcon, badgeKey: "overdue" },
        ],
    },
    {
        kind: "group", name: "Keuangan", icon: Banknote, children: [
            { kind: "link", name: "Cashflow Bisnis", href: "/cashflow", icon: Banknote },
            { kind: "link", name: "Belanja Harian", href: "/belanja", icon: ShoppingCart },
            { kind: "link", name: "Payroll & Absensi", href: "/payroll", icon: Wallet },
            { kind: "link", name: "Gaji Borongan", href: "/borongan", icon: HardHat },
            { kind: "link", name: "Laba per Project", href: "/reports/event-profit", icon: TrendingDown },
            { kind: "link", name: "Daftar DP / Piutang", href: "/transactions/dp", icon: Wallet },
            { kind: "link", name: "Dashboard Piutang", href: "/invoices", icon: FileText },
        ],
    },
    {
        kind: "group", name: "Menu Makan", icon: UtensilsCrossed, children: [
            { kind: "link", name: "Library Menu", href: "/menu", icon: BookOpen },
            { kind: "link", name: "Rencana & Monitoring", href: "/menu-plan", icon: CalendarDays },
            { kind: "link", name: "Voting Menu", href: "/menu-vote", icon: Vote, managerOnly: true },
        ],
    },
    {
        kind: "group", name: "POS", icon: ShoppingCart, children: [
            { kind: "link", name: "Order Booth/Event", href: "/pos", icon: ShoppingCart },
        ],
    },
    {
        kind: "group", name: "Setelan & Lainnya", icon: Settings2, children: [
            { kind: "link", name: "Master Team Crew", href: "/settings/crew-teams", icon: Users },
            { kind: "link", name: "Tarif Gaji (Kota+Divisi)", href: "/settings/wage-rates", icon: Wallet },
            { kind: "link", name: "CRM — Stages", href: "/crm/stages", icon: Settings2 },
            { kind: "link", name: "CRM — Labels", href: "/crm/labels", icon: Tags },
            { kind: "link", name: "Kalkulator HPP", href: "/reports/hpp", icon: Calculator },
            { kind: "link", name: "Peta Cuan Lokasi", href: "/maps", icon: MapPin },
            { kind: "link", name: "Permintaan Edit", href: "/transactions/edit-requests", icon: ClipboardEdit, badgeKey: "pendingEdit", managerOnly: true },
        ],
    },
];

// Daftar rata (untuk pencarian menu)
const allLinks: (LinkEntry & { group?: string })[] = [
    ...pinnedLinks,
    ...groups.flatMap((g) => g.children.map((c) => ({ ...c, group: g.name }))),
];


export function Sidebar() {
    const pathname = usePathname();
    const { isSidebarOpen, closeSidebar } = useUIStore();
    const { isManager } = useCurrentUser();

    // Pencarian menu cepat
    const [query, setQuery] = useState("");

    // Sidebar ciut (icon rail) — desktop only, persisted
    const [collapsed, setCollapsed] = useState(false);
    useEffect(() => {
        try { setCollapsed(localStorage.getItem("pospro:sidebar:collapsed") === "1"); } catch { /* ignore */ }
    }, []);
    const toggleCollapsed = () =>
        setCollapsed((c) => {
            const n = !c;
            try { localStorage.setItem("pospro:sidebar:collapsed", n ? "1" : "0"); } catch { /* ignore */ }
            return n;
        });

    const isActiveHref = (href: string) =>
        pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

    // Grup yang memuat halaman aktif (untuk auto-buka)
    const activeGroupName = groups.find((g) => g.children.some((c) => isActiveHref(c.href)))?.name ?? null;

    // Accordion: hanya satu grup terbuka. Default = grup aktif; ikut pindah saat navigasi.
    const [openGroup, setOpenGroup] = useState<string | null>(activeGroupName);
    useEffect(() => {
        setOpenGroup(activeGroupName);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);
    const toggleGroup = (name: string) => setOpenGroup((cur) => (cur === name ? null : name));

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

    const { data: overdueData } = useQuery({
        queryKey: ['overdue-count'],
        queryFn: getOverdueCount,
        staleTime: 60_000,
        refetchInterval: 120_000,
    });
    const overdueCount = overdueData?.count ?? 0;

    const { data: pendingPengajuanData } = useQuery({
        queryKey: ['pengajuan-pending-count'],
        queryFn: getPengajuanPendingCount,
        enabled: isManager,
        staleTime: 30_000,
        refetchInterval: 60_000,
    });
    const pendingPengajuanCount = isManager ? (pendingPengajuanData?.count ?? 0) : 0;

    const badgeFor = (key?: BadgeKey): number =>
        key === "overdue" ? overdueCount :
        key === "pendingEdit" ? pendingEditCount :
        key === "pendingPengajuan" ? pendingPengajuanCount : 0;

    // Hasil pencarian menu (rata, hormati managerOnly)
    const q = query.trim().toLowerCase();
    const searchResults = q
        ? allLinks.filter((l) => (!l.managerOnly || isManager) && (l.name.toLowerCase().includes(q) || (l.group ?? "").toLowerCase().includes(q)))
        : [];

    const renderLink = (link: LinkEntry & { group?: string }, child = false) => {
        const active = isActiveHref(link.href);
        const badge = badgeFor(link.badgeKey);
        const rail = collapsed && !child; // gaya rail hanya untuk item top-level saat ciut
        return (
            <Link
                key={link.name}
                href={link.href}
                title={link.name}
                onClick={() => { setQuery(""); if (window.innerWidth < 1024) closeSidebar(); }}
                className={cn(
                    active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                    "group relative flex items-center rounded-md font-medium transition-all",
                    child ? "px-2.5 py-1.5 text-[13px]" : "px-3 py-2 text-sm",
                    rail && "lg:justify-center lg:px-2"
                )}
            >
                <link.icon
                    className={cn(
                        active ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground",
                        "flex-shrink-0 transition-colors",
                        child ? "mr-2.5 h-3.5 w-3.5" : "mr-3 h-4 w-4",
                        rail && "lg:mr-0"
                    )}
                    aria-hidden="true"
                />
                <span className={cn("flex-1", rail && "lg:hidden")}>{link.name}</span>
                {badge > 0 && (
                    <span className={cn(
                        "ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 nums",
                        rail && "lg:hidden"
                    )}>
                        {badge > 9 ? "9+" : badge}
                    </span>
                )}
                {badge > 0 && rail && (
                    <span className="hidden lg:block absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
                )}
            </Link>
        );
    };

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
                "fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-[transform,width] duration-300 ease-in-out lg:static lg:translate-x-0",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full",
                collapsed ? "lg:w-16" : "lg:w-64"
            )}>
                {/* Header Sidebar — Logo & Nama Toko */}
                <div className={cn("flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border/50 bg-sidebar-accent/30", collapsed ? "px-2 lg:justify-center" : "px-4")}>
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
                        <span className={cn("text-base font-bold text-sidebar-foreground tracking-tight truncate", collapsed && "lg:hidden")} title={storeName}>
                            {storeName}
                        </span>
                    </div>

                    {/* Toggle ciut/lebar (desktop) */}
                    <button
                        type="button"
                        onClick={toggleCollapsed}
                        title={collapsed ? "Perlebar menu" : "Ciutkan menu"}
                        aria-label={collapsed ? "Perlebar menu" : "Ciutkan menu"}
                        className={cn("hidden lg:flex items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground p-1 rounded-md shrink-0", collapsed && "lg:hidden")}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>

                    {/* Close button untuk mobile */}
                    <button
                        className="lg:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground p-1 rounded-md shrink-0"
                        onClick={closeSidebar}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation links */}
                <div className="flex flex-1 flex-col overflow-y-auto pt-3 pb-4">
                    {/* Cari menu (mode lebar) */}
                    <div className={cn("px-3 pb-2", collapsed && "lg:hidden")}>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-foreground/40" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Cari menu…"
                                aria-label="Cari menu"
                                className="w-full rounded-md bg-sidebar-accent/30 border border-sidebar-border/50 pl-8 pr-7 py-1.5 text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => setQuery("")}
                                    aria-label="Hapus pencarian"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-sidebar-foreground/40 hover:text-sidebar-foreground"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tombol perlebar (mode ciut) */}
                    {collapsed && (
                        <div className="hidden lg:flex justify-center px-2 pb-2">
                            <button
                                type="button"
                                onClick={toggleCollapsed}
                                title="Perlebar menu"
                                aria-label="Perlebar menu"
                                className="flex items-center justify-center h-9 w-9 rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    )}

                    <nav className="flex-1 space-y-1 px-3">
                        {q ? (
                            // ── Mode pencarian: daftar rata hasil filter ──
                            searchResults.length === 0 ? (
                                <p className="px-3 py-6 text-center text-xs text-sidebar-foreground/50">Tidak ada menu cocok.</p>
                            ) : (
                                searchResults.map((l) => renderLink(l))
                            )
                        ) : (
                            <>
                                {/* Pinned */}
                                {pinnedLinks.filter((l) => !l.managerOnly || isManager).map((l) => renderLink(l))}

                                <div className="pt-1.5" />

                                {/* Grup accordion — hanya satu terbuka */}
                                {groups.map((g) => {
                                    const visibleChildren = g.children.filter((c) => !c.managerOnly || isManager);
                                    if (visibleChildren.length === 0) return null;
                                    const hasActiveChild = visibleChildren.some((c) => isActiveHref(c.href));
                                    const isOpen = openGroup === g.name;
                                    const totalBadge = visibleChildren.reduce((s, c) => s + badgeFor(c.badgeKey), 0);
                                    return (
                                        <div key={g.name}>
                                            <button
                                                type="button"
                                                onClick={() => { if (collapsed) { toggleCollapsed(); setOpenGroup(g.name); } else { toggleGroup(g.name); } }}
                                                aria-expanded={isOpen}
                                                title={collapsed ? g.name : undefined}
                                                className={cn(
                                                    hasActiveChild
                                                        ? "bg-sidebar-accent/20 text-sidebar-accent-foreground"
                                                        : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                                                    "group relative w-full flex items-center rounded-md px-3 py-2 text-sm font-semibold transition-all",
                                                    collapsed && "lg:justify-center lg:px-2"
                                                )}
                                            >
                                                <g.icon
                                                    className={cn(
                                                        hasActiveChild ? "text-sidebar-primary" : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground",
                                                        "mr-3 h-4 w-4 flex-shrink-0 transition-colors",
                                                        collapsed && "lg:mr-0"
                                                    )}
                                                    aria-hidden="true"
                                                />
                                                <span className={cn("flex-1 text-left", collapsed && "lg:hidden")}>{g.name}</span>
                                                {totalBadge > 0 && (
                                                    <span className={cn(
                                                        "mr-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 nums",
                                                        collapsed && "lg:hidden"
                                                    )}>
                                                        {totalBadge > 9 ? "9+" : totalBadge}
                                                    </span>
                                                )}
                                                {totalBadge > 0 && collapsed && (
                                                    <span className="hidden lg:block absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
                                                )}
                                                <span className={cn(collapsed && "lg:hidden")}>
                                                    {isOpen ? (
                                                        <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/50" />
                                                    ) : (
                                                        <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/50" />
                                                    )}
                                                </span>
                                            </button>
                                            {isOpen && (
                                                <div className={cn("mt-0.5 ml-3 pl-3 border-l border-sidebar-border/40 space-y-0.5", collapsed && "lg:hidden")}>
                                                    {visibleChildren.map((child) => renderLink(child, true))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </nav>
                </div>

                {/* Footer Sidebar — Settings */}
                <div className={cn("shrink-0 border-t border-sidebar-border", collapsed ? "p-2" : "p-4")}>
                    <Link
                        href="/settings"
                        title="Pengaturan"
                        onClick={() => { if (window.innerWidth < 1024) closeSidebar(); }}
                        className={cn(
                            "group flex items-center rounded-md py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all",
                            collapsed ? "px-2 lg:justify-center" : "px-3"
                        )}
                    >
                        <Settings className={cn("h-5 w-5 text-sidebar-foreground/70 group-hover:text-sidebar-foreground transition-colors", collapsed ? "lg:mr-0 mr-3" : "mr-3")} />
                        <span className={cn(collapsed && "lg:hidden")}>Pengaturan</span>
                    </Link>
                </div>
            </div>
        </>
    );
}
