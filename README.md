# 🎪 Pospro Event

> Aplikasi gratis untuk **vendor booth & event** — bantu kelola lead WhatsApp, bikin penawaran, hitung anggaran, jadwal crew, sampai laporan untung-rugi project. Semua dalam satu aplikasi.

**By Muhammad Faishal Abdul Hakim**

---

## 🤔 Aplikasi Ini Untuk Siapa?

Pospro Event dirancang untuk Anda yang:

✅ **Vendor booth pameran** — bikin booth custom untuk klien (PT, brand, instansi)
✅ **Persewaan booth/equipment event** — sewakan booth jadi atau alat-alat event
✅ **Workshop digital printing** — sambil bantu cetak banner/poster/X-banner walk-in
✅ **Punya tim lapangan** — crew yang setting booth di lokasi event

**Tidak cocok kalau Anda**:
- ❌ Toko retail biasa (lebih cocok pakai POS murni)
- ❌ Restoran/F&B
- ❌ Online shop marketplace murni

---

## 💡 Apa Masalah yang Diselesaikan?

### Sebelum Pospro Event:
- 📱 Lead WA berserakan di chat — sering hilang/lupa di-follow up
- 📝 Penawaran dibuat manual di Word — nomor sering nggak konsisten
- 📊 Hitung modal di Excel — tidak ter-link ke penawaran
- 👷 Crew yang berangkat ke lokasi tidak ter-track jelas
- 💰 Untung-rugi per event baru ketahuan setelah event selesai (kadang udah rugi)
- 💾 Data tersebar di banyak tool — sulit di-backup

### Setelah Pospro Event:
- 🎯 Lead masuk dari META Ads / WA / Website **otomatis ter-track** di Kanban
- 📄 Penawaran dengan **format nomor Indonesia** (`42/Xp/Pnwr/IV/26`), 1 klik PDF
- 🧮 RAB ter-link ke penawaran — **margin terlihat real-time**
- 👷 Crew check-in via link WA + foto opsional — **tahu siapa di mana, kapan**
- 💰 **Laba per project** terhitung otomatis dari cashflow ter-tag event
- 💾 Backup ZIP semua data dengan **1 klik** + restore juga 1 klik

---

## ✨ Fitur Utama (Singkat)

### 🎯 Lead Pipeline (CRM)
Tampung semua lead dari META Ads / WA / Website. Kanban drag-drop antar tahap (Lead Masuk → Follow Up → Penawaran → Closed Deal). Tombol click-to-chat WA langsung dari card.

### 📄 Penawaran Booth/Event (SPH)
Bikin Surat Penawaran Harga profesional. 2 variant: **SEWA** (rental) atau **PENGADAAN_BOOTH** (custom build). Format nomor Indonesia auto. PDF & DOCX siap kirim klien.

### 🧮 RAB (Anggaran Proyek)
Breakdown biaya internal per project: Material, Jasa, Transport, Akomodasi, Sewa Alat. **Dual qty/price**: harga jual ke klien vs harga modal aktual. Margin auto-hitung. Bisa generate Penawaran dari RAB dengan 1 klik.

### 📅 Event Timeline (Gantt)
Lihat semua event paralel dalam 1 layar. Color-coded per phase (Setup merah / Event kuning / Dismantle biru). Drag-drop untuk geser tanggal. Conflict detection kalau crew bentrok. Filter by client/team/venue/RAB margin.

### 👷 Crew Tracking dengan Foto
Assign crew ke event → kirim link unik via WA → crew tap link saat tiba di lokasi (check-in) dan saat selesai (check-out). Foto **opsional**. Otomatis hitung durasi setup. **Team-based** (Team Kepuh, Team Sawah, dll) dengan leader masing-masing.

### 💰 Cashflow + Laba per Project
Catat semua pemasukan/pengeluaran. Tag setiap entry ke **Event** atau **RAB** → laba per project terhitung otomatis. Leaderboard laba per project untuk audit cepat. Export PDF/CSV/ZIP.

### 📤 Peminjaman Stok dengan Foto
Crew ambil barang dari gudang via link PIN publik. **Wajib upload foto** saat pinjam dan saat kembalikan. Auto-deteksi OVERDUE.

### 📝 Surat Order Designer
Untuk lini digital printing: order cetak banner/poster → kirim ke designer via WA → designer upload proof → approve → cetak. Convert ke transaksi POS saat klien bayar.

### 💾 Backup & Restore
Export ZIP semua data (CRM + RAB + Penawaran + Stok + Crew + dll) dalam 1 klik. Restore juga 1 klik. Versi backup saat ini **2.6**.

### 📚 Dokumentasi Lengkap
Wiki VitePress yang bisa diakses online untuk training tim.

---

## 🚀 Cara Mulai (Untuk Pemula)

### 1. Pasang Aplikasi
Lihat [Panduan Deployment](./docs/wiki/deployment.md) untuk install di:
- Laptop / PC pribadi (untuk test)
- Komputer kantor (akses LAN)
- VPS publik (akses internet)

### 2. Login Pertama Kali
Buka browser → `http://localhost:3000` (atau alamat server Anda).

```
Email default:    admin@pospro.id
Password default: admin123
```

⚠️ **Wajib ganti password** setelah login pertama kali!

### 3. Setup Awal (Sekali Saja)
Sebelum mulai pakai harian, setup ini dulu:

1. **Profil Toko** — Pengaturan → ubah nama, logo, alamat
2. **Worker / Crew** — daftarkan tim Anda
3. **Team Crew** — bikin "Team Kepuh", "Team Sawah" dengan leader masing-masing
4. **Supplier** — daftarkan vendor material
5. **Bank Account** — daftarkan rekening untuk terima pembayaran
6. **Backup pertama** — sekali setup selesai, langsung buat backup

### 4. Mulai Pakai!
- Sales: kelola lead di CRM
- Owner: bikin penawaran & RAB
- Crew lapangan: check-in via link WA
- Akhir bulan: lihat laba per project

📖 **Detail step-by-step** ada di [Panduan Pemula](./docs/wiki/panduan-pemula.md).

---

## 🧱 Stack Teknis (Untuk Developer)

```
Frontend  : Next.js 16 + React 19 + TanStack Query + Tailwind v4
Backend   : NestJS 11 + Prisma 6 + MySQL
Docs      : VitePress 1.6
Lib utama :
  - @dnd-kit    → Kanban drag-drop CRM & Event Timeline
  - Recharts    → Chart cashflow + project profit
  - Puppeteer   → Generate PDF Project Report
  - Handlebars  → Template engine PDF
  - ExcelJS     → Import/export XLSX
  - Archiver    → Backup ZIP + bulk PDF download
  - Multer      → Upload foto (produk, crew check-in, proof)
  - whatsapp-web.js → Bot WA untuk kirim link & laporan
```

### Quick Setup Dev

```bash
# Backend
cd app/backend
cp .env.example .env       # set DATABASE_URL, JWT_SECRET
npm install
npx prisma db push --accept-data-loss
npx ts-node prisma/seed.ts          # admin + master data
npx ts-node prisma/seed-crm.ts      # CRM stages + labels
npm run start:dev                    # → http://localhost:3001

# Frontend (terminal lain)
cd ../frontend
cp .env.example .env.local
npm install
npm run dev                          # → http://localhost:3000

# Docs (opsional, terminal lain)
cd ../                               # ke pospenawaran/app
npm install
npm run docs:dev                     # → http://localhost:5173
```

### Build Production

```bash
cd app/backend && npm run build && npm run start:prod
cd app/frontend && npm run build && npm run start
cd app && npm run docs:build         # static docs di .vitepress/dist/
```

---

## 📚 Daftar Dokumentasi

Semua dokumentasi ada di folder [`docs/wiki/`](./docs/wiki/):

### 🌟 Mulai dari Sini (Pemula)
- [Alur Bisnis Event](./docs/wiki/alur-bisnis.md) — gambaran besar end-to-end
- [Panduan Pemula](./docs/wiki/panduan-pemula.md) — step-by-step pertama kali pakai

### 🎯 CRM & Lead
- [CRM Overview](./docs/wiki/crm.md)
- [Pipeline Kanban](./docs/wiki/crm-kanban.md)
- [Import Lead XLSX](./docs/wiki/crm-import.md)
- [Convert Lead → Customer](./docs/wiki/crm-convert.md)
- [Data Pelanggan](./docs/wiki/customers.md)

### 📑 Penawaran & RAB
- [Penawaran Booth/Event](./docs/wiki/penawaran-event.md)
- [RAB Event](./docs/wiki/rab-event.md)
- [Save RAB as Product](./docs/wiki/rab-to-product.md)
- [Data Supplier](./docs/wiki/suppliers.md)

### 📅 Event & Crew
- [Event Timeline (Gantt)](./docs/wiki/event-timeline.md)
- [Crew Setup Time Tracking](./docs/wiki/crew-tracking.md)
- [Surat Order Designer](./docs/wiki/sales-order.md)

### 🏪 Operasional
- [Antrian Produksi](./docs/wiki/produksi.md)
- [Antrian Cetak Paper](./docs/wiki/mesin-cetak.md)
- [Stok Opname](./docs/wiki/stock-opname.md)
- [Peminjaman Stok (Foto)](./docs/wiki/peminjaman-stok.md)

### 💰 Keuangan
- [Cashflow Bisnis](./docs/wiki/cashflow.md)
- [Laporan Stok](./docs/wiki/laporan-stok.md)
- [Kalkulator HPP](./docs/wiki/hpp-calculator.md)
- [Peta Cuan Lokasi](./docs/wiki/peta-cuan.md)

### ⚙️ Teknis
- [Backup & Restore](./docs/wiki/backup.md) ⭐ versi 2.6
- [Panduan Deployment](./docs/wiki/deployment.md)
- [Lisensi & Hak Cipta](./docs/wiki/license.md) 📄

---

## 🆘 Butuh Bantuan?

- 📖 **Pertama kali pakai?** Buka [Panduan Pemula](./docs/wiki/panduan-pemula.md)
- 🔧 **Setup install?** Lihat [Panduan Deployment](./docs/wiki/deployment.md)
- 💾 **Mau backup?** Baca [Backup & Restore](./docs/wiki/backup.md)
- ❓ **Pertanyaan lain?** Email muhamadfaisal288@gmail.com

---

## 📄 Lisensi

**Copyright © 2026 Muhammad Faishal Abdul Hakim**
**All rights reserved.**

Aplikasi proprietary untuk operasional internal **CV. Exindo Pratama** dan **CV. Xposer Event**. Tidak didistribusikan untuk umum.

Lihat detail lengkap di:
- [`LICENSE`](./LICENSE) — versi resmi (legal text)
- [Lisensi Wiki](./docs/wiki/license.md) — versi user-friendly bahasa Indonesia

---

**© 2026 Muhammad Faishal Abdul Hakim · Pospro Event · All rights reserved.**
Contact: muhamadfaisal288@gmail.com
