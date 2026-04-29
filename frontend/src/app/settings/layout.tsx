"use client";

import { useState, useMemo } from "react";
import {
    Store, CreditCard, Users, Settings, MessageCircle, Building2, Paintbrush,
    HardDrive, Bell, Palette, Tags, Warehouse, HardHat, KeyRound, MapPin,
    Boxes, Building, FileText, Hash, Search, ChevronRight, ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// ─── Group nav links per kategori untuk readability ──────────────────────────
const NAV_GROUPS: Array<{
    label: string;
    emoji: string;
    items: Array<{
        href: string;
        icon: typeof Store;
        label: string;
        desc?: string;
    }>;
}> = [
        {
            label: "Brand & Profil",
            emoji: "🏢",
            items: [
                { href: "/settings/general", icon: Store, label: "Profil Toko", desc: "Nama, logo, alamat utama" },
                { href: "/settings/brands", icon: Building, label: "Brand (Multi-Perusahaan)", desc: "Exindo, Xposer, dll" },
                { href: "/settings/login", icon: Paintbrush, label: "Tampilan Login", desc: "Branding halaman login" },
            ],
        },
        {
            label: "Dokumen & Penawaran",
            emoji: "📄",
            items: [
                { href: "/settings/quotation-variants", icon: FileText, label: "Varian Penawaran", desc: "SEWA, Pengadaan, dll" },
                { href: "/settings/document-numbers", icon: Hash, label: "Nomor Urut Dokumen", desc: "Counter penomoran" },
            ],
        },
        {
            label: "Tim & Pekerja",
            emoji: "👥",
            items: [
                { href: "/settings/users", icon: Users, label: "Manajemen Staf", desc: "Akun login admin" },
                { href: "/settings/workers", icon: HardHat, label: "Pekerja/Tukang", desc: "Marketing, Tukang, Crew" },
                { href: "/settings/designers", icon: Palette, label: "Kelola Desainer", desc: "Designer untuk SO" },
            ],
        },
        {
            label: "Keuangan",
            emoji: "💰",
            items: [
                { href: "/settings/payments", icon: CreditCard, label: "Pembayaran", desc: "Metode pembayaran" },
                { href: "/settings/bank-accounts", icon: Building2, label: "Rekening Bank", desc: "Akun bank untuk transfer" },
            ],
        },
        {
            label: "Inventory & Gudang",
            emoji: "📦",
            items: [
                { href: "/settings/rab-categories", icon: Tags, label: "Kategori RAB" },
                { href: "/settings/rab-loose-items", icon: Boxes, label: "Item Lepas RAB" },
                { href: "/settings/warehouses", icon: Warehouse, label: "Gudang", desc: "Daftar gudang fisik" },
                { href: "/settings/storage-locations", icon: MapPin, label: "Lokasi Barang", desc: "Rak/shelf di gudang" },
                { href: "/settings/warehouse-pin", icon: KeyRound, label: "PIN Gudang Kiosk", desc: "PIN untuk akses tukang" },
            ],
        },
        {
            label: "Sistem",
            emoji: "⚙️",
            items: [
                { href: "/settings/whatsapp", icon: MessageCircle, label: "Bot WhatsApp" },
                { href: "/settings/notifications", icon: Bell, label: "Notifikasi" },
                { href: "/settings/backup", icon: HardDrive, label: "Backup & Recovery", desc: "Versi 2.6" },
            ],
        },
    ];

const ALL_LINKS = NAV_GROUPS.flatMap((g) => g.items);

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [search, setSearch] = useState("");
    // Mobile: tampilkan list pilihan saat di /settings root, content saat user pilih
    const isAtRoot = pathname === "/settings" || pathname === "/settings/";

    const activeLink = ALL_LINKS.find((l) => pathname === l.href || pathname.startsWith(l.href + "/"));

    const filteredGroups = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return NAV_GROUPS;
        return NAV_GROUPS
            .map((g) => ({
                ...g,
                items: g.items.filter((it) =>
                    `${it.label} ${it.desc ?? ""} ${g.label}`.toLowerCase().includes(q)
                ),
            }))
            .filter((g) => g.items.length > 0);
    }, [search]);

    return (
        <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-8rem)] gap-4 lg:gap-6">
            {/* ════════════════════════════════════════════════════════════ */}
            {/* MOBILE — full screen toggle: list vs detail                   */}
            {/* ════════════════════════════════════════════════════════════ */}

            {/* Mobile: Header + Search (selalu di atas) */}
            <div className="lg:hidden bg-background rounded-xl border-2 overflow-hidden">
                <div className="p-3 border-b bg-primary/5 flex items-center gap-2">
                    {!isAtRoot && activeLink && (
                        <Link
                            href="/settings"
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Link>
                    )}
                    <Settings className="h-4 w-4 text-primary" />
                    <h2 className="font-bold text-sm flex-1 truncate">
                        {isAtRoot ? "Pengaturan" : activeLink?.label ?? "Pengaturan"}
                    </h2>
                </div>

                {/* List mode (root atau search filter) */}
                {(isAtRoot || search) && (
                    <>
                        <div className="p-3 border-b">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari pengaturan…"
                                    className="w-full pl-8 pr-3 py-2 text-sm border rounded-md"
                                />
                            </div>
                        </div>
                        <div className="max-h-[calc(100vh-14rem)] overflow-y-auto">
                            {filteredGroups.length === 0 ? (
                                <div className="p-6 text-center text-xs text-muted-foreground">
                                    Tidak ada pengaturan yang cocok &quot;{search}&quot;
                                </div>
                            ) : (
                                filteredGroups.map((g) => (
                                    <div key={g.label} className="border-b last:border-b-0">
                                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30">
                                            {g.emoji} {g.label}
                                        </div>
                                        {g.items.map(({ href, icon: Icon, label, desc }) => {
                                            const isActive =
                                                pathname === href || pathname.startsWith(href + "/");
                                            return (
                                                <Link
                                                    key={href}
                                                    href={href}
                                                    className={`flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition border-l-4 ${isActive
                                                        ? "border-primary bg-primary/5"
                                                        : "border-transparent"
                                                        }`}
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                        <Icon className="h-4 w-4 text-primary" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-semibold truncate">{label}</div>
                                                        {desc && (
                                                            <div className="text-[10px] text-muted-foreground truncate">{desc}</div>
                                                        )}
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                                </Link>
                                            );
                                        })}
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Mobile: Content area — tampil hanya kalau bukan root */}
            {!isAtRoot && !search && (
                <div className="lg:hidden glass rounded-xl overflow-y-auto min-h-0 flex-1">
                    {children}
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════ */}
            {/* DESKTOP — sidebar + content split                             */}
            {/* ════════════════════════════════════════════════════════════ */}

            <div className="hidden lg:flex w-72 glass rounded-xl overflow-hidden flex-col shrink-0">
                {/* Header */}
                <div className="p-4 border-b border-border bg-card/50">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" />
                        Pengaturan
                    </h2>
                </div>

                {/* Search */}
                <div className="p-3 border-b border-border">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari pengaturan…"
                            className="w-full pl-8 pr-3 py-2 text-sm border rounded-md bg-background"
                        />
                    </div>
                </div>

                {/* Grouped nav */}
                <nav className="flex-1 overflow-y-auto p-2 [scrollbar-width:thin]">
                    {filteredGroups.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                            Tidak ada pengaturan yang cocok
                        </div>
                    ) : (
                        filteredGroups.map((g) => (
                            <div key={g.label} className="mb-3">
                                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                                    {g.emoji} {g.label}
                                </div>
                                <div className="space-y-0.5">
                                    {g.items.map(({ href, icon: Icon, label, desc }) => {
                                        const isActive =
                                            pathname === href || pathname.startsWith(href + "/");
                                        return (
                                            <Link
                                                key={href}
                                                href={href}
                                                title={desc ? `${label} — ${desc}` : label}
                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${isActive
                                                    ? "bg-primary/10 text-primary font-semibold border border-primary/30"
                                                    : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                                                    }`}
                                            >
                                                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                                                <span className="text-sm truncate">{label}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </nav>
            </div>

            {/* Desktop: Content area */}
            <div className="hidden lg:block flex-1 glass rounded-xl overflow-y-auto min-h-0">
                {children}
            </div>
        </div>
    );
}
