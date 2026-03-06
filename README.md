# 🛒 PosPro — Aplikasi Kasir & Manajemen Toko Berbasis Web

<div align="center">

![PosPro Banner](https://img.shields.io/badge/PosPro-Point%20of%20Sale-blue?style=for-the-badge&logo=shopify)
![NestJS](https://img.shields.io/badge/Backend-NestJS-red?style=flat-square&logo=nestjs)
![Next.js](https://img.shields.io/badge/Frontend-Next.js-black?style=flat-square&logo=next.js)
![MySQL](https://img.shields.io/badge/Database-MySQL-orange?style=flat-square&logo=mysql)
![WhatsApp](https://img.shields.io/badge/WhatsApp-Bot%20Terintegrasi-green?style=flat-square&logo=whatsapp)

**Solusi kasir modern untuk toko kelontong, percetakan digital, café, dan usaha kecil menengah lainnya.**

</div>

---

## 📖 Apa itu PosPro?

**PosPro** adalah aplikasi kasir berbasis web yang dirancang untuk memudahkan operasional bisnis sehari-hari. Berbeda dengan aplikasi kasir tradisional yang hanya mencatat transaksi, PosPro hadir dengan ekosistem lengkap: mulai dari kasir real-time, manajemen stok, laporan keuangan, pelacakan piutang, invoice profesional, penawaran harga B2B, arus kas bisnis, peta lokasi kompetitor, hingga **Bot WhatsApp** yang otomatis melaporkan mutasi keuangan ke grup pemilik toko.

Cukup buka browser, tap, dan transaksi selesai — tanpa perlu instalasi aplikasi tambahan.

---

## ✨ Fitur-Fitur Utama

### 🏪 1. Kasir (POS) Real-Time
- Cari produk berdasarkan nama atau scan **barcode** menggunakan kamera / scanner
- Tambah item ke keranjang belanja dengan mudah
- Pilih metode pembayaran: **Tunai, Transfer Bank, QRIS**
- Cetak **struk thermal** langsung dari browser
- Kirim **tagihan (invoice)** ke WhatsApp pelanggan hanya dengan satu klik

### 💳 2. Pembayaran DP (Down Payment) & Pelunasan Piutang
- Kasir bisa memilih **Bayar Lunas** atau **Bayar DP (uang muka)**
- Semua transaksi DP tersimpan di daftar **Piutang**
- Ada tombol **Pelunasan** untuk mencatat pembayaran cicilan berikutnya
- Setiap pelunasan otomatis masuk ke laporan arus kas

### 📦 3. Manajemen Produk & Stok
- Tambah, edit, hapus produk dengan **foto produk**
- Dukung produk dengan **varian** (ukuran, warna, dll)
- Mode harga khusus untuk **Digital Printing** — harga dihitung per meter persegi (m²)
- Pantau stok real-time, dengan notifikasi ketika stok menipis

### 🏦 4. Multi-Rekening Bank
- Daftarkan beberapa rekening bank toko (BCA, Mandiri, BRI, dll)
- Setiap transaksi transfer dapat dilacak per rekening
- Saldo tiap rekening terupdate otomatis saat kasir menutup shift

### 💰 5. Cashflow Bisnis
- Catat semua **pemasukan dan pengeluaran** manual bisnis secara terstruktur
- Filter periode: **Bulan Ini / 3 Bulan Terakhir / Tahun Ini / Semua**
- **Chart tren 6 bulan** (Area Chart): Pemasukan vs. Pengeluaran
- **Chart breakdown kategori** (Bar Chart horizontal): distribusi per kategori
- Entri dari transaksi POS masuk **otomatis** (ditandai badge "Otomatis")
- Edit & hapus entri manual kapan saja
- **Export ke Excel** untuk laporan eksternal

### 📄 6. Invoice Generator & Penawaran Harga (SPH)
- Buat **Invoice profesional** dengan detail klien lengkap (nama, perusahaan, email, HP, alamat)
- Buat **Surat Penawaran Harga (SPH)** khusus untuk klien B2B, perusahaan, brand, dan event
- **Catalog Picker**: pilih langsung produk/jasa dari daftar inventori, harga terisi otomatis
- **Custom Item**: input deskripsi, satuan, dan harga bebas untuk jasa non-katalog
- **Area-Based Item**: input ukuran banner/spanduk dalam Lebar × Tinggi (m), total m² terhitung otomatis
- Diskon & PPN (Pajak) per dokumen
- Alur status:
  - Invoice: DRAFT → SENT → PAID / CANCELLED
  - SPH: DRAFT → SENT → ACCEPTED / REJECTED / EXPIRED
- SPH yang diterima (ACCEPTED) bisa **dikonversi ke Invoice** dengan satu klik
- **Cetak PDF** — tampilan profesional siap kirim ke klien

### 📊 7. Laporan Penjualan & Profit
- Lihat riwayat semua transaksi dengan filter tanggal
- Laporan **Profit** — kalkulasi margin per produk
- Laporan **HPP** (Harga Pokok Penjualan) untuk analisis biaya produksi
- Cetak ulang struk transaksi lama
- Export laporan ke Excel

### 🔄 8. Laporan Tutup Shift Kasir
- Sistem menghitung otomatis total kas, QRIS, dan transfer per shift
- Kasir wajib input **saldo fisik uang tunai** dan **saldo rekening aktual** dari mBanking
- Sistem membandingkan: **Sistem vs. Aktual** — langsung kelihatan selisihnya
- Data tersimpan rapi sebagai laporan shift harian

### 🗺️ 9. Peta Cuan Lokasi
- Visualisasi **cabang toko** di peta interaktif dengan warna berdasarkan margin profit
- Tambah, edit, hapus **pin cabang** langsung dengan klik di peta
- Tambah **pin kompetitor** manual — tandai lokasi pesaing di peta
- **Cari bisnis by keyword** (contoh: "Digital Printing") via OpenStreetMap Overpass API
- Tampilkan semua bisnis sejenis di radius peta yang sedang dilihat
- Toggle layer: tampilkan/sembunyikan Cabang, Kompetitor, Hasil Pencarian
- Geocoding alamat: ketik alamat, pin langsung ke koordinat yang tepat

### 📱 10. Bot WhatsApp Terintegrasi
- Bot WhatsApp berjalan langsung di dalam aplikasi — **tidak perlu aplikasi terpisah**
- Scan QR Code sekali dari halaman pengaturan, bot langsung aktif
- Bot otomatis mengirim **laporan mutasi keuangan** ke grup WhatsApp pemilik

| Perintah | Fungsi |
|---|---|
| `!getgroupid` | Lihat ID grup WhatsApp |
| `!botadmin status` | Cek status bot |
| `!botadmin addgroup [ID]` | Tambahkan grup ke whitelist |
| `!botadmin removegroup [ID]` | Hapus grup dari whitelist |
| `!botadmin listgroups` | Lihat semua grup terdaftar |
| `!botadmin setreportgroup [ID]` | Atur grup tujuan laporan shift |

### 🔐 11. Sistem Autentikasi & Role
- Login dengan email & password
- Sistem **token JWT** yang aman — sesi otomatis berakhir jika tidak aktif
- Multi-role: Admin, Kasir, Manager, Owner

### 👥 12. Data Pelanggan (CRM)
- Database pelanggan toko dengan riwayat transaksi
- Statistik per pelanggan: total belanja, frekuensi, rata-rata transaksi
- Export data pelanggan

---

## 🖥️ Peta Halaman Aplikasi

```
📱 Halaman-Halaman PosPro
├── /                       → Dashboard ringkasan bisnis
├── /pos                    → Kasir (tambah item, checkout, cetak struk)
├── /pos/close-shift        → Form tutup shift kasir
├── /transactions/dp        → Daftar piutang & pelunasan DP
├── /inventory              → Manajemen produk & stok
├── /customers              → Data pelanggan & CRM
├── /invoices               → Invoice Generator & Penawaran Harga (SPH)
├── /cashflow               → Arus kas bisnis dengan chart & filter
├── /maps                   → Peta Cuan Lokasi (cabang + kompetitor)
├── /reports/sales          → Laporan riwayat transaksi
├── /reports/profit         → Laporan profit & margin
├── /reports/hpp            → Kalkulator HPP (Harga Pokok Penjualan)
└── /settings               → Pengaturan toko, bot WhatsApp, rekening bank
```

---

## 🔧 Teknologi yang Digunakan

### Frontend (Tampilan)
| Teknologi | Fungsi |
|---|---|
| **Next.js 14** | Framework tampilan web (App Router) |
| **Tailwind CSS v4** | Sistem desain yang konsisten dan responsif |
| **TanStack Query** | Sinkronisasi data server-client secara otomatis |
| **Zustand** | State management keranjang belanja POS |
| **Axios** | HTTP client dengan JWT interceptor otomatis |
| **Recharts** | Grafik interaktif (Area Chart, Bar Chart) |
| **React Leaflet** | Peta interaktif OpenStreetMap |
| **xlsx** | Export laporan ke format Excel |

### Backend (Server)
| Teknologi | Fungsi |
|---|---|
| **NestJS** | Server API modular yang kuat dan terstruktur |
| **Prisma** | ORM — jembatan antara server dan database |
| **MySQL** | Database penyimpanan semua data toko |
| **JWT + Passport** | Sistem keamanan login modern |
| **Multer** | Upload foto produk, QRIS, dan bukti shift |
| **whatsapp-web.js** | Bot WhatsApp terintegrasi langsung di server |

---

## 🚀 Cara Menjalankan di Komputer Lokal

### Prasyarat
Pastikan sudah terinstall:
- [Node.js](https://nodejs.org) versi 18 ke atas
- [MySQL](https://www.mysql.com) — sudah berjalan di komputer
- Git

---

### Langkah 1 — Clone Proyek
```bash
git clone https://github.com/tsunosora/Pos-Web-Application.git
cd Pos-Web-Application
```

---

### Langkah 2 — Setup Backend

```bash
cd backend
```

Buat file konfigurasi `.env` dari template:
```bash
copy .env.example .env
```

Isi file `.env`:
```ini
DATABASE_URL="mysql://root:PASSWORD_KAMU@localhost:3306/pospro"
JWT_SECRET="isi_dengan_kalimat_rahasia_acak"
PORT=3001
```

Install dan jalankan:
```bash
npm install
npx prisma db push
npm run start:dev
```

> ✅ Backend berjalan di: **http://localhost:3001**

---

### Langkah 3 — Setup Frontend

```bash
cd frontend
```

Buat file `.env.local`:
```ini
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Install dan jalankan:
```bash
npm install
npm run dev
```

> ✅ Aplikasi dapat diakses di: **http://localhost:3000**

---

### Langkah 4 — Setup Bot WhatsApp (Opsional)

1. Buka `http://localhost:3000/settings/whatsapp`
2. Scan QR Code via WhatsApp → Perangkat Tertaut
3. Bot WhatsApp siap digunakan ✅

---

## 📂 Struktur Folder Proyek

```
Pos-Web-Application/
│
├── backend/                        # Server API (NestJS)
│   ├── prisma/
│   │   └── schema.prisma           # Skema database (gunakan db push)
│   ├── src/
│   │   ├── auth/                   # JWT login
│   │   ├── products/               # Produk, varian, bahan baku, foto
│   │   ├── transactions/           # POS checkout, DP, dashboard metrics
│   │   ├── invoices/               # Invoice & SPH (Penawaran Harga)
│   │   ├── cashflow/               # Arus kas manual + auto dari transaksi
│   │   ├── reports/                # Shift close, profit report
│   │   ├── branches/               # Data cabang toko (CRUD + koordinat)
│   │   ├── competitors/            # Data kompetitor peta (CRUD + koordinat)
│   │   ├── customers/              # Data pelanggan + analytics
│   │   ├── bank-accounts/          # Multi-rekening bank
│   │   ├── hpp/                    # Kalkulator HPP worksheet
│   │   ├── settings/               # Pengaturan toko, logo, QRIS
│   │   └── whatsapp/               # Bot WhatsApp engine
│   └── public/
│       └── uploads/                # Foto produk, QRIS, bukti shift
│
├── frontend/                       # Tampilan Web (Next.js)
│   └── src/
│       ├── app/
│       │   ├── pos/                # Kasir utama
│       │   ├── transactions/dp/    # Piutang & pelunasan
│       │   ├── inventory/          # Manajemen produk
│       │   ├── invoices/           # Invoice Generator & SPH
│       │   ├── cashflow/           # Arus kas bisnis
│       │   ├── maps/               # Peta Cuan Lokasi
│       │   ├── customers/          # Data pelanggan
│       │   └── reports/            # Laporan penjualan, profit, HPP
│       ├── lib/
│       │   ├── api.ts              # Semua fungsi API (satu file, satu axios instance)
│       │   ├── receipt.ts          # Generator struk kasir (HTML thermal)
│       │   └── export.ts           # Helper export Excel
│       └── store/
│           └── cart-store.ts       # Zustand store keranjang belanja POS
│
└── docs/
    └── wiki/                       # Panduan penggunaan fitur-fitur
```

---

## 📚 Dokumentasi & Wiki

Panduan lengkap penggunaan setiap fitur tersedia di folder [`docs/wiki/`](docs/wiki/):

| Dokumen | Isi |
|---|---|
| [Panduan Umum](docs/wiki/README.md) | Login, Dashboard, Kasir, Tutup Shift |
| [Cashflow Bisnis](docs/wiki/cashflow.md) | Cara kelola arus kas, filter, chart, export |
| [Invoice & Penawaran Harga](docs/wiki/invoice-sph.md) | Buat invoice, SPH, catalog picker, area-based |
| [Peta Cuan Lokasi](docs/wiki/peta-cuan.md) | Kelola cabang, tambah kompetitor, cari keyword |

---

## ❓ Pertanyaan Umum (FAQ)

**Q: Apakah bisa digunakan tanpa internet?**
> Fitur peta (Overpass/Nominatim) memerlukan internet. Kasir, laporan, dan cashflow berjalan di jaringan lokal.

**Q: Apakah bisa digunakan di HP?**
> Ya! Tampilan responsif untuk semua ukuran layar. Disarankan tablet untuk meja kasir.

**Q: Bagaimana jika Bot WhatsApp terputus?**
> Masuk ke **Pengaturan → Bot WhatsApp**, klik **Logout & Restart Bot**, lalu scan QR Code kembali.

**Q: Apakah bisa untuk lebih dari satu cabang?**
> Ya — fitur multi-cabang sudah tersedia. Setiap cabang bisa didaftarkan dengan koordinat GPS, data omset, dan margin yang muncul di Peta Cuan Lokasi.

**Q: Bagaimana cara buat penawaran harga untuk klien perusahaan?**
> Buka menu **Invoice & Penawaran** → tab **Penawaran Harga (SPH)** → klik **+ Buat SPH**. Isi detail klien, pilih produk dari katalog atau input manual, dan cetak PDF.

---

## 🗺️ Roadmap Pengembangan

- [x] Kasir POS dengan barcode scanner
- [x] Pembayaran DP & Pelunasan Piutang
- [x] Multi-rekening bank tracking
- [x] Tutup Shift Kasir (Actual vs Expected)
- [x] Bot WhatsApp terintegrasi
- [x] Upload & tampilkan foto produk
- [x] Laporan HPP (Harga Pokok Penjualan)
- [x] Export laporan ke Excel
- [x] Dashboard analitik pemilik toko
- [x] Cashflow Bisnis dengan chart tren & kategori
- [x] Invoice Generator profesional
- [x] Penawaran Harga / SPH untuk klien B2B
- [x] Catalog Picker di Invoice (pilih dari inventori)
- [x] Area-based pricing (banner/spanduk per m²)
- [x] Peta Cuan Lokasi (cabang + kompetitor + pencarian keyword)
- [ ] Mode offline (PWA)
- [ ] Notifikasi stok menipis otomatis
- [ ] Fitur loyalty point pelanggan

---

## 🤝 Kontribusi

Pull request sangat disambut! Untuk perubahan besar, harap buka issue terlebih dahulu.

---

## 📄 Lisensi

Proyek ini dikembangkan untuk kebutuhan bisnis internal VOLIKO.

---

<div align="center">
  Dibuat dengan ❤️ menggunakan <strong>NestJS</strong> + <strong>Next.js</strong>
</div>
