# 🎪 Pospro Event — Aplikasi Manajemen CRM, Penawaran & RAB Booth/Event

[![NestJS](https://img.shields.io/badge/Backend-NestJS%2011-red?style=flat-square&logo=nestjs)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%206-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io)
[![MySQL](https://img.shields.io/badge/Database-MySQL-orange?style=flat-square&logo=mysql)](https://mysql.com)
[![VitePress](https://img.shields.io/badge/Docs-VitePress-646CFF?style=flat-square&logo=vite)](https://vitepress.dev)

> **Pospro Event by Muhammad Faishal Abdul Hakim**
> Aplikasi web all-in-one untuk vendor booth & event: dari **Lead** WhatsApp/META Ads, ke **Penawaran** (SPH), **RAB** internal, **Produksi** booth, sampai **Cashflow** & laporan profitabilitas per project.

---

## 📖 Apa itu Pospro Event?

Pospro Event adalah evolusi dari aplikasi **PosPro** (Point of Sale) yang dirombak khusus untuk industri **vendor booth, exhibition builder, dan event organizer**. Daripada hanya kasir, Pospro Event memodelkan **alur lengkap** dari kontak pertama klien sampai event selesai dan dilaporkan profitnya.

**Masalah yang diselesaikan:**

- 🔻 Lead dari META Ads / WhatsApp / Website tersebar di tool eksternal — sulit di-track.
- 🔻 Penawaran (SPH) dibuat manual di Word, nomor dokumen tidak konsisten.
- 🔻 RAB internal dipisah di Excel — tidak ter-link ke penawaran/customer.
- 🔻 Tidak tahu margin per project sampai event selesai.
- 🔻 Backup data tersebar di banyak tool berbeda.

**Solusi Pospro Event:** satu aplikasi self-hosted, satu database, satu backup ZIP. Modul **CRM** self-contained — siap di-extract jadi app terpisah di kemudian hari.

---

## ✨ Fitur Utama

### 🎯 1. CRM / Lead Pipeline
- **Kanban drag-drop** antar stage (Lead Masuk → Follow Up → Penawaran → Negosiasi → Closed Deal / Lost) pakai `@dnd-kit`.
- **Import XLSX** dari tool WhatsApp CRM lama dengan dedupe by phone (dry-run + commit).
- **Click-to-Chat WhatsApp** — tombol WA di setiap card dengan template greeting otomatis.
- **Activity timeline** per lead (greeting sent, ComPro sent, response, stage change).
- **Label multi-color** (Hot/Warm/Cold/custom) + assign PIC (Worker).
- **Convert ke Customer** (sekali klik bikin Customer + opsional draft Penawaran + draft RAB).
- Filter board: search, PIC, label.

→ [Dokumentasi CRM lengkap](./docs/wiki/crm.md)

### 📄 2. Penawaran Booth & Event (SPH)
- 2 variant: **SEWA** (rental booth) & **PENGADAAN_BOOTH** (custom build).
- Format nomor Indonesia: `SPH/IV/2026/0042` (auto-sequence per tahun).
- Catalog picker (produk/material) + Custom item bebas.
- Cetak PDF profesional siap kirim WhatsApp/Email.
- Konversi: SPH → RAB (copy item) atau SPH → Invoice final.

→ [Dokumentasi Penawaran](./docs/wiki/penawaran-event.md)

### 🧮 3. RAB Event (Rencana Anggaran Biaya)
- Kategori biaya: Material, Jasa, Transport, Akomodasi, Sewa Alat, Loose Items.
- Per item: qty, unit, unitCost (modal), unitPrice (jual) — auto kalkulasi margin.
- Lifecycle: DRAFT → APPROVED → EXECUTED → CLOSED.
- Tab realisasi untuk catat actual cost saat event berjalan.
- Export PDF & XLSX.

→ [Dokumentasi RAB](./docs/wiki/rab-event.md)

### 🖨️ 4. Antrian Produksi Booth
Job queue produksi dengan PIN operator, batch cetak, tracking status real-time per tahap (cutting → finishing → packing → kirim).

### 📦 5. Manajemen Stok Material
Inventori material booth (kayu, plywood, lighting, dll), varian, BOM (bahan baku otomatis terpotong saat produksi), stok opname berkala, manajemen supplier.

### 💰 6. Cashflow & Laporan
- Arus kas masuk/keluar manual + otomatis dari transaksi.
- Laporan laba kotor per project (sinkron dengan RAB CLOSED).
- Kalkulator HPP material (Lebar × Tinggi → m² otomatis).
- Peta cuan lokasi event/pameran (Leaflet).

### 💾 7. Backup & Restore
- Export semua data (CRM + Penawaran + RAB + Produksi + Stok) ke **ZIP** dengan archiver.
- Restore dengan satu klik (FK_CHECKS=0 saat restore).
- Group: `crm`, `rab`, `produksi`, `keuangan`, `master` — pilih yang mau di-backup.
- Auto-backup terjadwal via Rclone ke cloud.

→ [Dokumentasi Backup](./docs/wiki/backup.md)

### 🚀 8. Self-Hosted & Modular
Pasang di home server (XAMPP/Laragon di Windows) atau VPS. Panduan deployment lengkap. Modul `crm/` di backend & `/crm/*` di frontend self-contained — siap di-extract jadi app terpisah.

---

## 🧱 Arsitektur

```
pospenawaran/app/
├── backend/         → NestJS 11 + Prisma 6 + MySQL (port 3001)
│   └── src/
│       ├── crm/         (Lead pipeline — self-contained module)
│       │   ├── leads/   stages/   labels/   activities/
│       │   ├── import/  convert/  utils/
│       ├── penawaran/   (SPH / Quotation)
│       ├── rab/         (Rencana Anggaran Biaya)
│       ├── customers/   workers/   products/   suppliers/
│       ├── produksi/    cashflow/  backup/     exporters/
│       └── ...
├── frontend/        → Next.js 16 App Router + React 19 (port 3000)
│   └── src/
│       ├── app/crm/         (board, leads, import, stages, labels)
│       ├── app/penawaran/   app/rab/   app/customers/
│       ├── components/crm/  components/layout/  components/ui/
│       └── lib/api/         (TanStack Query clients)
├── .vitepress/      → Konfigurasi situs dokumentasi
└── docs/wiki/       → Markdown dokumentasi (sumber VitePress)
```

---

## 🔄 Alur Bisnis End-to-End

```
  ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
  │  META Ads    │       │  WhatsApp    │       │   Website    │
  └──────┬───────┘       └──────┬───────┘       └──────┬───────┘
         │                      │                      │
         └──────────────────────┴──────────────────────┘
                                ↓
                  ┌─────────────────────────┐
                  │  CRM /crm/board         │  ← Import XLSX, manual,
                  │  (Kanban drag-drop)     │     atau API webhook
                  └────────────┬────────────┘
                               ↓ stage berubah → Closed Deal
                  ┌─────────────────────────┐
                  │  Convert Lead           │
                  │  → Customer             │
                  │  → Draft Penawaran      │  ← variant SEWA / PENGADAAN
                  │  → Draft RAB            │
                  └────────────┬────────────┘
                               ↓
              ┌────────────────┴────────────────┐
              ↓                                 ↓
     ┌────────────────┐              ┌──────────────────┐
     │  Penawaran     │ kirim klien  │  RAB Event       │
     │  (SPH PDF)     │ ───────────► │  (internal)      │
     │  ACCEPTED      │              │  APPROVED        │
     └────────┬───────┘              └────────┬─────────┘
              ↓ convert                       ↓ event jalan
     ┌────────────────┐              ┌──────────────────┐
     │  Invoice       │              │  Produksi Booth  │
     │  (final)       │              │  (job queue)     │
     └────────┬───────┘              └────────┬─────────┘
              └────────────────┬──────────────┘
                               ↓
                  ┌─────────────────────────┐
                  │  Cashflow & Laporan     │
                  │  Laba per Project       │
                  └─────────────────────────┘
```

---

## 📦 Dependencies

### Backend (`app/backend/package.json`)

| Package | Versi | Fungsi |
|---|---|---|
| `@nestjs/core`, `@nestjs/common` | ^11 | Framework |
| `@prisma/client`, `prisma` | ^6 | ORM MySQL |
| `class-validator`, `class-transformer` | latest | DTO validation |
| `bcryptjs`, `jsonwebtoken` | latest | Auth |
| `multer` | ^1 | Upload file (XLSX, foto produk) |
| `exceljs` | ^4 | Parse & generate XLSX |
| `archiver`, `adm-zip` | latest | Backup ZIP & restore |
| `pdfkit` / `puppeteer` | latest | Generate PDF SPH/RAB |

### Frontend (`app/frontend/package.json`)

| Package | Versi | Fungsi |
|---|---|---|
| `next`, `react`, `react-dom` | 16 / 19 | Framework |
| `@tanstack/react-query` | ^5 | Data fetching + cache |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | latest | **CRM Kanban drag-drop** |
| `tailwindcss` | ^4 | Styling |
| `lucide-react` | latest | Icon set |
| `recharts` | ^2 | Chart cashflow |
| `leaflet`, `react-leaflet` | latest | Peta cuan |
| `zustand` | ^4 | Client state |
| `radix-ui/*` | latest | Dialog, Dropdown, Popover |

### Docs

| Package | Versi | Fungsi |
|---|---|---|
| `vitepress` | ^1.6 | Static site generator dokumentasi |

---

## 🚀 Quick Start

### Prasyarat

- **Node.js** 20+ (testing di Node 22 / Node 24)
- **MySQL** 8 (via XAMPP/Laragon di Windows, atau native di Linux)
- **Git**

### Setup

```bash
# 1. Clone & install
git clone <repo-url> pospenawaran
cd pospenawaran/app

# 2. Backend
cd backend
cp .env.example .env       # edit DATABASE_URL, JWT_SECRET, dll
npm install
npx prisma db push --accept-data-loss
npx ts-node prisma/seed.ts          # admin default + master data
npx ts-node prisma/seed-crm.ts      # stages + labels CRM
npm run start:dev                    # → http://localhost:3001

# 3. Frontend (terminal lain)
cd ../frontend
cp .env.example .env.local
npm install
npm run dev                          # → http://localhost:3000

# 4. Dokumentasi (opsional, terminal lain)
cd ../                               # ke pospenawaran/app
npm install
npm run docs:dev                     # → http://localhost:5173
```

Login default: `admin@pospro.id` / `admin123` (ganti setelah login pertama).

### Build Production

```bash
# Backend
cd app/backend && npm run build && npm run start:prod

# Frontend
cd app/frontend && npm run build && npm run start

# Docs (static export)
cd app && npm run docs:build         # output di .vitepress/dist/
```

---

## 📚 Dokumentasi Lengkap

Dokumentasi VitePress berisi semua panduan fitur, alur, dan cara penggunaan. **Akses via:**

```bash
cd app && npm run docs:dev
# Buka http://localhost:5173
```

Atau build static & host di mana saja:

```bash
npm run docs:build
# Upload .vitepress/dist/ ke Netlify/Vercel/GitHub Pages/server
```

### Daftar Halaman Dokumentasi

| Halaman | File |
|---|---|
| Beranda | [`docs/wiki/index.md`](./docs/wiki/index.md) |
| Daftar Isi Lengkap | [`docs/wiki/README.md`](./docs/wiki/README.md) |
| Alur Bisnis Event | [`docs/wiki/alur-bisnis.md`](./docs/wiki/alur-bisnis.md) |
| **CRM Overview** | [`docs/wiki/crm.md`](./docs/wiki/crm.md) |
| **Pipeline Kanban** | [`docs/wiki/crm-kanban.md`](./docs/wiki/crm-kanban.md) |
| **Import Lead XLSX** | [`docs/wiki/crm-import.md`](./docs/wiki/crm-import.md) |
| **Convert Lead → Customer** | [`docs/wiki/crm-convert.md`](./docs/wiki/crm-convert.md) |
| **Penawaran Booth/Event** | [`docs/wiki/penawaran-event.md`](./docs/wiki/penawaran-event.md) |
| **RAB Event** | [`docs/wiki/rab-event.md`](./docs/wiki/rab-event.md) |
| Antrian Produksi | [`docs/wiki/produksi.md`](./docs/wiki/produksi.md) |
| Mesin Cetak | [`docs/wiki/mesin-cetak.md`](./docs/wiki/mesin-cetak.md) |
| Stok Opname | [`docs/wiki/stock-opname.md`](./docs/wiki/stock-opname.md) |
| Data Supplier | [`docs/wiki/suppliers.md`](./docs/wiki/suppliers.md) |
| Cashflow Bisnis | [`docs/wiki/cashflow.md`](./docs/wiki/cashflow.md) |
| Laporan Stok | [`docs/wiki/laporan-stok.md`](./docs/wiki/laporan-stok.md) |
| Kalkulator HPP | [`docs/wiki/hpp-calculator.md`](./docs/wiki/hpp-calculator.md) |
| Peta Cuan | [`docs/wiki/peta-cuan.md`](./docs/wiki/peta-cuan.md) |
| Backup & Restore | [`docs/wiki/backup.md`](./docs/wiki/backup.md) |
| Panduan Deployment | [`docs/wiki/deployment.md`](./docs/wiki/deployment.md) |

---

## 🔐 Default Credentials

```
Email:    admin@pospro.id
Password: admin123
```

**Wajib ganti** setelah login pertama via menu Profile.

---

## 🤝 Lisensi & Kontak

**© 2026 Muhammad Faishal Abdul Hakim**

Aplikasi internal untuk operasional vendor booth & event. Tidak didistribusikan untuk umum.

Email: muhamadfaisal288@gmail.com
