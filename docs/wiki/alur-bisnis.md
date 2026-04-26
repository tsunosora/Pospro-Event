# 🔄 Alur Bisnis Pospro Event

> **Halaman ini ngobrol santai** menjelaskan alur kerja Pospro Event dari awal sampai akhir. Cocok untuk pemilik usaha, owner, atau staff baru yang baru pertama kali pegang aplikasi ini.

## Cerita Singkat — Sehari di Vendor Booth

Bayangkan Anda adalah owner vendor booth & event. Berikut **cerita normal sehari**:

> *Pagi-pagi buka HP, ada chat WA dari beberapa orang yang nanya soal booth pameran. Tim sales follow-up. Beberapa hari kemudian, ada yang minta penawaran. Anda hitung modal, kasih harga, kirim PDF. Klien ACC, transfer DP. Tim produksi mulai bikin booth di workshop. Crew berangkat ke lokasi, setting booth. Event jalan 3 hari. Bongkar. Klien lunasi. Akhir bulan, Anda ingin tahu: untung berapa per project?*

Itulah **alur bisnis Pospro Event**. Sekarang kita lihat aplikasinya bantu di setiap tahap.

## Diagram Besar

```
   ┌──────────────────────────────────────────────────────────────┐
   │                                                                │
   │  CHAT WA   META ADS   WEBSITE                                  │
   │     │         │          │                                     │
   │     └─────────┴──────────┘                                     │
   │                ↓                                                │
   │  ┌─────────────────────┐                                       │
   │  │  1. CRM Lead        │  Kanban drag-drop                     │
   │  │     /crm/board      │  (Lead Masuk → Follow Up → ...)       │
   │  └──────────┬──────────┘                                       │
   │             │                                                   │
   │             ↓ klien deal                                        │
   │  ┌─────────────────────┐                                       │
   │  │  2. Convert ke      │  → Customer dibuat                    │
   │  │     Customer        │  → Draft Penawaran (opsional)         │
   │  │                     │  → Draft RAB (opsional)               │
   │  └──────────┬──────────┘                                       │
   │             │                                                   │
   │  ┌──────────┴──────────┐                                       │
   │  ↓                     ↓                                       │
   │ Penawaran            RAB                                       │
   │ (kirim klien)        (internal)                                │
   │  ↓                     ↓                                       │
   │ Klien ACC + DP       Hitung modal & margin                     │
   │  ↓                     ↓                                       │
   │  └──────────┬──────────┘                                       │
   │             ↓                                                   │
   │  ┌─────────────────────┐                                       │
   │  │  3. Eksekusi Event  │                                       │
   │  │     - Produksi      │                                       │
   │  │     - Crew Setup    │  Check-in via link WA + foto          │
   │  │     - Event Day     │                                       │
   │  │     - Dismantle     │                                       │
   │  └──────────┬──────────┘                                       │
   │             │                                                   │
   │             ↓                                                   │
   │  ┌─────────────────────┐                                       │
   │  │  4. Cashflow & Laba │  Tag setiap entry ke Event            │
   │  │     /reports/event- │  Lihat laba per project               │
   │  │     profit          │                                       │
   │  └─────────────────────┘                                       │
   │                                                                │
   └──────────────────────────────────────────────────────────────┘
```

## Tahap 1 — Lead Masuk

### Apa yang Terjadi
Calon klien hubungi Anda lewat 3 channel utama:
- 📱 **META Ads** — biasanya ratusan/bulan, mayoritas tanya-tanya doang
- 💬 **WhatsApp** — lebih serius, sudah dapat info dari mana
- 🌐 **Website** — kalau Anda punya kontak form

### Aplikasi Bantu Apa?
Buka **CRM → Pipeline** (`/crm/board`). Setiap lead jadi card di kolom **"Lead Masuk"**.

### Aksi Sales/Owner:
1. **Tap card** → drawer detail buka
2. **Tombol WA hijau** → langsung buka chat WhatsApp dengan template greeting
3. Setelah chat → tombol **"Greeting Sent"** untuk catat aktivitas
4. Klien jawab → **drag card** ke kolom "Follow Up"
5. Beri **label warna**: Hot 🔴 (sangat tertarik) / Warm 🟡 / Cold 🔵

> **Tips**: Atur PIN sales yang menghandle setiap lead. Jadi kalau lead bentrok antar sales, kelihatan dari awal.

📖 [Detail CRM Pipeline](./crm-kanban.md)

## Tahap 2 — Klien Deal

### Apa yang Terjadi
Setelah follow-up beberapa kali, klien ngomong "OK saya mau order". Yes! 🎉

### Aplikasi Bantu Apa?
Drag card ke kolom **"Closed Deal"** → tombol **"Convert ke Customer"** muncul di drawer.

### Aksi Owner:
1. Klik **"Convert ke Customer"** → form muncul
2. Centang opsi:
   - ☑️ Buat draft Penawaran (variant SEWA / PENGADAAN_BOOTH)
   - ☑️ Buat draft RAB
3. Klik **Convert** → 3 hal dibuat sekaligus:
   - **Customer** baru di master
   - **Draft Penawaran** kosong siap di-edit
   - **Draft RAB** kosong siap diisi item

📖 [Detail Convert Lead](./crm-convert.md)

## Tahap 3a — Bikin Penawaran (untuk klien)

### Apa yang Terjadi
Klien mau lihat angka dulu sebelum bayar DP. Anda kirim Surat Penawaran Harga (SPH).

### Aplikasi Bantu Apa?
Buka **Penawaran Booth/Event → klik draft yang baru dibuat**.

### Aksi Owner:
1. Isi **Project Name**, lokasi event, tanggal event
2. Klik **"+ Tambah Item"** — pilih dari katalog produk atau ketik custom
3. Atur **PPN** (default 11%) dan **DP %** (default 50%)
4. Pilih **rekening bank** yang dicantumkan di footer
5. **Save**
6. Klik **"Assign Nomor"** → dapat nomor format Indonesia (mis. `42/Xp/Pnwr/IV/26`)
7. Klik **"Export PDF"** atau **"Export DOCX"**
8. Kirim ke klien via WhatsApp/Email

### Setelah Klien ACC:
- Update status SPH jadi **"ACCEPTED"**
- Klien transfer DP → **catat di Cashflow** dengan tag event ini
- Klik **"Convert to Invoice"** → bikin Invoice resmi (opsional)

📖 [Detail Penawaran](./penawaran-event.md)

## Tahap 3b — Bikin RAB (internal, hitung modal)

### Apa yang Terjadi
Sebelum jalankan project, Anda hitung modal sendiri. Berapa biaya material? Jasa crew? Transport? Akomodasi? Margin berapa? **Ini RAB**.

### Aplikasi Bantu Apa?
Buka **RAB (Anggaran Proyek) → klik draft yang baru dibuat**.

### Aksi Owner:
1. Pilih **Customer** dan **Period Start/End**
2. Klik **"+ Tambah Item"** per kategori:
   - Material (kayu, MDF, plywood, lighting)
   - Jasa (tukang, finishing, setter)
   - Transport (pickup, kirim)
   - Akomodasi (hotel crew)
   - Sewa Alat
3. Per item, isi:
   - **Quantity & priceRab** — apa yang Anda jual ke klien
   - **QuantityCost & priceCost** — apa yang Anda beli/eksekusi
4. **Save** → buka tab **"Summary"** lihat margin

```
Total Jual:    Rp 12.765.000
Total Cost:    Rp  8.420.000
─────────────────────────────
Margin:        Rp  4.345.000  (34% — Sehat ✅)
```

### Trik Powerful:
- Tombol **"Generate Penawaran"** di RAB → bikin SPH otomatis dari item RAB. Hemat input ulang.
- Tombol **"💸 Generate Cashflow"** di RAB CLOSED → bulk-create entries expense ter-tag event.
- Tombol **"Simpan sebagai Produk"** → kalau item ini sering reuse (mis. "Booth 3×3 Wood Standard"), simpan jadi katalog.

📖 [Detail RAB](./rab-event.md)

## Tahap 4 — Eksekusi Event

### Apa yang Terjadi
Tanggal event mendekat. Crew workshop produksi booth, lalu crew lapangan setting di venue.

### Aplikasi Bantu Apa?

**4a. Schedule di Event Timeline**
Buka **Event Timeline** (Gantt) — lihat semua event paralel:
- Bar **merah** = Setup (crew di lokasi pasang booth)
- Bar **kuning** = Event Day (acara berjalan)
- Bar **biru** = Dismantle (bongkar)

Conflict detection otomatis kalau crew yang sama dijadwalkan di 2 event yang phase-nya overlap.

**4b. Assign Crew Lapangan**
Buka detail event → tab **"Crew"** → klik **"+ Assign Crew"**:
1. Pilih Worker (mis. Sendy)
2. Pilih **Team** (Team Kepuh / Team Sawah / kosong) — leader otomatis ter-link
3. Set role (Setter / Finisher / Loader)
4. Set jadwal mulai-selesai
5. **Save**

Sistem generate **link unik** untuk crew ini (mis. `app.../public/crew/abc123`).

**4c. Crew Check-in di Lokasi**
1. Owner klik tombol **💬 WA** di card crew → buka WhatsApp dengan template otomatis
2. Crew terima link → tap link → halaman check-in muncul (mobile-friendly)
3. Crew tap **"Mulai Tugas (Check-in)"** + foto opsional
4. Selesai kerja → tap **"Selesai Tugas (Check-out)"**
5. Sistem hitung **durasi setup otomatis**

📖 [Detail Crew Tracking](./crew-tracking.md) · [Event Timeline](./event-timeline.md)

**4d. Pinjam Barang dari Gudang (kalau perlu)**
Crew ke gudang ambil booth/lighting/dll → buka link **PIN gudang public** → upload foto checkout barang yang dibawa. Saat kembali, upload foto lagi.

📖 [Detail Peminjaman Stok](./peminjaman-stok.md)

## Tahap 5 — Pembukuan & Laba

### Apa yang Terjadi
Event selesai. Klien lunasi. Owner ingin tahu: **untung berapa per project?**

### Aplikasi Bantu Apa?

**5a. Catat Pemasukan & Pengeluaran**
Buka **Cashflow Bisnis** → klik **"+ Tambah Entry"**:
- DP klien masuk → kategori "DP Booth/Event" → pilih **Tag Event**
- Pelunasan → kategori "Pelunasan Booth/Event" → tag event yang sama
- Beli material → kategori "Material Booth (Kayu/MDF)" → tag event
- Bayar transport, akomodasi, jasa crew → tag event semua

> **Trik**: Kalau RAB sudah final, klik **"💸 Generate Cashflow"** di RAB → semua expense bulk dibuat dengan tag otomatis.

**5b. Lihat Laba per Project**
Buka **Event Detail → tab "💰 Profit"**:

```
┌──────────┬──────────┬──────────┬──────────┐
│ Income   │ Expense  │ Profit   │ Margin   │
│ Rp 12.7jt│ Rp 8.4jt │ Rp 4.3jt │ 34.0%   │
│  hijau   │  merah   │  hijau   │ Sehat ✅ │
└──────────┴──────────┴──────────┴──────────┘

📊 Tren 6 Bulan Terakhir
[Bar chart bulanan + line profit]

📜 Detail Transaksi (12 entries)
```

**5c. Leaderboard Semua Project**
Buka **Laporan Laba per Project** (`/reports/event-profit`):
- Ranking event by profit (medal 🥇🥈🥉)
- Filter periode
- Export CSV semua / Download PDF per event / Bulk ZIP

📖 [Detail Cashflow](./cashflow.md) · [Project Reports PDF](./penawaran-event.md)

## Tahap Bonus — Lini Printing (Sekali-sekali)

Selain event, kadang ada klien walk-in minta cetak banner/X-banner/poster. Pakai modul **Surat Order Designer**:

1. Klien minta cetak → admin bikin **Sales Order** (`/sales-orders`)
2. Pilih designer → kirim link via WA
3. Designer kerjakan → upload **proof** (preview hasil desain)
4. Admin approve → kirim ke Antrian Cetak Paper
5. Klien datang ambil + bayar → **Convert ke POS** → struk cetak

📖 [Detail Surat Order Designer](./sales-order.md)

## Tips Operasional Harian

| Pagi | Aktivitas |
|---|---|
| 08:00 | Buka **CRM Pipeline** → follow-up lead Hot/Warm yang ada |
| 08:30 | Cek **Event Timeline** → event hari ini, ada yang setup? |
| 09:00 | Update activity card lead yang baru kontak |

| Siang/Sore | Aktivitas |
|---|---|
| 13:00 | Cek **Antrian Produksi** → progress booth on-going |
| 16:00 | Cek **Crew Tab** → siapa sudah check-in/out |
| 17:00 | Catat **Cashflow** transaksi hari ini (DP masuk, beli material) |

| Mingguan | Aktivitas |
|---|---|
| Senin pagi | **Backup ZIP** → simpan di flashdisk + Google Drive |
| Senin pagi | **Copy WA jadwal mingguan** dari Event Timeline → kirim grup crew |
| Sabtu sore | Review event yang minggu ini selesai → audit profit |

| Bulanan | Aktivitas |
|---|---|
| Awal bulan | Review **Leaderboard Laba per Project** bulan lalu |
| Awal bulan | Update harga material di **Suppliers** kalau ada perubahan |
| Awal bulan | Review **CRM** — lead lama yang belum closed → archive atau follow up lagi |

## Setup Awal (Sekali Saja)

Sebelum mulai pakai harian, ada hal yang perlu disetup sekali saja:

1. **Login admin** → `admin@pospro.id` / `admin123` (ganti password)
2. **Master Worker** — daftarkan PIC sales, operator produksi, crew lapangan, designer
3. **Master Team Crew** — bikin "Team Kepuh", "Team Sawah" dengan leader
4. **Master Supplier** — vendor kayu, lighting, transport
5. **Master Material** — plywood, MDF, dll dengan stok awal
6. **CRM Stages** — default sudah ada, sesuaikan kalau perlu (tambah "Booked")
7. **CRM Labels** — default Hot/Warm/Cold, tambah custom (mis. "Booth F&B", "Pameran 2026")
8. **Bank Account** — daftarkan rekening BCA/Mandiri/dll
9. **Backup pertama** — selesai setup → langsung backup

📖 Detail step-by-step: [Panduan Pemula](./panduan-pemula.md)

## Lihat Juga

- [Panduan Pemula](./panduan-pemula.md) — step-by-step pertama kali
- [Backup & Restore](./backup.md) — wajib rutin tiap minggu
- [CRM Overview](./crm.md) — masuk dalam ke kanban
- [Event Timeline](./event-timeline.md) — Gantt view semua event paralel
