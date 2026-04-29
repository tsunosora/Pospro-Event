# Pospro Event — Frontend

Frontend Next.js 16 + React 19 + Tailwind v4 untuk aplikasi **Pospro Event** (manajemen vendor booth & event).

**By Muhammad Faishal Abdul Hakim**

---

## 🧱 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19 + Tailwind CSS v4
- **State**: Zustand (cart, UI), TanStack Query (server state)
- **Drag-Drop**: @dnd-kit (Kanban CRM, Event Timeline)
- **Charts**: Recharts (cashflow, dashboard)
- **Forms**: React Hook Form
- **Icons**: lucide-react
- **Date**: dayjs (locale ID)

---

## 🚀 Quick Setup

```bash
# 1. Install deps
npm install

# 2. Setup .env.local
cp .env.example .env.local
# Edit NEXT_PUBLIC_API_URL=http://localhost:3001

# 3. Run dev server
npm run dev
# → http://localhost:3000
```

## 📦 Build Production

```bash
npm run build
npm run start
```

## 📂 Struktur Routes

```
src/app/
├── page.tsx              Dashboard utama (Event + RAB diagram)
├── login/                Login
├── crm/                  CRM module
│   ├── board/           Pipeline Kanban
│   ├── leads/           Lead detail & list
│   └── performance/     Performance metrics
├── customers/[id]/       Customer detail (Penawaran tab, dll)
├── rab/                  RAB module
│   └── [id]/            RAB detail (multi-tag, dual qty, inventaris)
├── penawaran/            Quotation list & detail
├── invoices/             Invoice management
├── pos/                  Order Booth/Event (Sewa/Operasional/Pinjam/RAB/Penawaran)
├── inventory/            Manajemen Stok (lokasi gudang per varian)
├── gudang/
│   ├── ambil/           Kiosk pinjam (PIN-gated)
│   ├── stok/            Kiosk stok lapangan tukang ⭐ NEW
│   └── peminjaman/      Riwayat peminjaman
├── events/               Event timeline (Gantt) + detail
├── cashflow/             Arus kas
├── reports/              Laporan (sales, profit, stock, dll)
├── settings/             Konfigurasi (brand, gudang, worker, PIN, dll)
└── opname/[token]/       Stock opname (token-based public)
```

## 🎨 Komponen Reusable

```
src/components/
├── CustomerPickerModal.tsx     Pilih/tambah customer (RAB + Penawaran + POS)
├── TagChipInput.tsx            Multi-tag dengan autocomplete (RAB)
├── BrandBadge.tsx              Badge brand mini
├── CameraCaptureModal.tsx      Photo capture (mobile-friendly)
├── crm/                        CRM components (LeadCard, StageColumn, dll)
└── layout/                     Sidebar, Header, MainLayout
```

---

## 📄 Lisensi

**Copyright © 2026 Muhammad Faishal Abdul Hakim**
**All rights reserved.**

Proprietary software untuk operasional internal **CV. Exindo Pratama** & **CV. Xposer Event**. Lihat [`../LICENSE`](../LICENSE) untuk detail.

---

**© 2026 Muhammad Faishal Abdul Hakim · Pospro Event · All rights reserved.**
