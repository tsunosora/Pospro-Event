# 💸 Cashflow Bisnis — Pospro Event

Modul **Cashflow** mencatat semua arus kas masuk & keluar bisnis. Sumbernya dua: **otomatis** (dari transaksi POS / tutup shift kasir) dan **manual** (input bebas oleh admin/owner).

> ⚠️ **Catatan**: Saat ini cashflow **tidak otomatis ter-generate** dari Penawaran (SPH) atau RAB Event. Untuk income event (DP/pelunasan klien) dan expense event (material/jasa/transport), Anda **input manual** ke Cashflow — tapi sekarang bisa **tag ke Event** langsung pakai dropdown saat input, supaya laba per project terhitung otomatis.

## Akses

Menu sidebar: **Keuangan → Cashflow Bisnis** (`/cashflow`).

## Sumber Data

### 1. Otomatis (dari POS / Shift)

Dibuat oleh sistem secara otomatis (tidak bisa di-edit langsung — harus dari sumbernya):

| Trigger | Tipe | Kategori | Catatan |
|---|---|---|---|
| Transaksi POS lunas | INCOME | "Penjualan Lunas" | Auto-tag rekening kalau metode bayar = transfer |
| Pembayaran DP transaksi POS | INCOME | "Pembayaran DP" | |
| Pelunasan piutang DP | INCOME | "Pelunasan DP" | |
| Tutup shift kasir | (campuran) | sesuai item shift | Bisa flagged `excludeFromShift = true` retroaktif |

**Dipakai untuk lini Digital Printing** (5% bisnis Anda — walk-in / kasir POS).

### 2. Manual (untuk lini Booth/Event 95%)

Klik **+ Tambah Entry** di header `/cashflow` untuk input transaksi keuangan event:

| Field | Catatan |
|---|---|
| `date` | Tanggal transaksi (default: hari ini) |
| `type` | INCOME / EXPENSE |
| `category` | Pilih dari list default + tombol "Lainnya" untuk custom |
| `amount` | Nominal Rp |
| `bankAccountId` | Pilih rekening source/destination |
| `paymentMethod` | CASH / QRIS / BANK_TRANSFER |
| `platformSource` | Sumber dana (POS / Tokopedia / Shopee / Lainnya) |
| `note` | Detail transaksi (mis. "DP 50% PT JAPURA — Booth Juni") |
| `excludeFromShift` | Centang kalau entri retroaktif yang tidak boleh masuk ke laporan shift kasir |
| `eventId` ⭐ | Tag ke Event tertentu — dropdown isi semua Event aktif. Membuat entry ini dihitung sebagai income/expense dari project itu |
| `rabPlanId` ⭐ | Tag ke RabPlan tertentu (dari API; UI dropdown akan ditambah nanti) |

> 💡 **Tip vendor booth/event**: untuk DP/pelunasan dari klien event, pilih kategori "DP Booth/Event" / "Pelunasan Booth/Event" + pilih Event di dropdown "Tag Event". Total income & expense per event bisa dilihat lewat endpoint `/cashflow/event-profit/:eventId`.

## Kategori Default

Kategori-kategori berikut hard-coded di `cashflow/page.tsx` (frontend). Sudah di-context-kan untuk vendor booth/event 95% + lini printing 5%. Kalau ada kategori spesifik yang belum ada, pakai opsi "Lainnya" — value yang Anda input akan tersimpan di `category` (free text) dan muncul di filter selanjutnya.

### Income

**Lini utama — Booth & Event:**
- Sewa Booth
- Pengadaan Booth
- Jasa Setup Event
- DP Booth/Event
- Pelunasan Booth/Event

**Lini Printing:**
- Pendapatan Printing
- Pembayaran DP (untuk printing)
- Pelunasan DP (untuk printing)
- Penjualan Lunas (auto dari POS)

**Non-operasional:**
- Modal Usaha · Investasi · Pinjaman · Lainnya

### Expense

**Direct cost project / event:**
- Material Booth (Kayu/MDF)
- Material Booth (Lighting/Hardware)
- Jasa Crew Lapangan
- Jasa Tukang Workshop
- Transport Event
- Akomodasi Crew
- Sewa Alat Event
- Konsumsi Crew

**Lini Printing:**
- Bahan Baku Printing
- Designer Fee

**Operasional rutin:**
- Operasional Kantor
- Gaji Karyawan
- Sewa Workshop/Kantor
- Listrik & Air
- Internet & Telepon
- Pemeliharaan
- Marketing META Ads
- Marketing Lainnya
- Pajak
- Lainnya

### Platform Source

**Konteks vendor booth/event:**
- Direct B2B (Event)
- Walk-in Counter (Printing)
- META Ads Lead
- WhatsApp Lead
- Website

**POS / Marketplace** (jaga compatibility data lama):
- POS (Offline)
- Tokopedia · Shopee · TikTok Shop · Lainnya

## Multi-Bank Account

Daftarkan rekening bisnis (BCA, Mandiri, BRI, dll) di setting Bank Account. Setiap entri cashflow opsional ter-link ke `bankAccountId` → laporan saldo per rekening tersedia.

## Halaman

| URL | Fungsi |
|---|---|
| `/cashflow` | Dashboard utama — stat cards, charts, list entry |

> Halaman terpisah untuk CRUD kategori / bank account / report belum ada — semua dilakukan di dashboard `/cashflow` plus modal-modal di dalamnya.

## Filter Periode

Tab pilihan di header:

- **Hari Ini · Kemarin · Bulan Ini**
- **3 Bulan Terakhir · Tahun Ini · Semua**
- **Kustom** — date range picker

## Visualisasi

### Chart 1: Tren Bulanan (Area Chart)
6 bulan terakhir, 2 series: Pemasukan (hijau) vs Pengeluaran (merah). Sumber: endpoint `GET /cashflow/monthly-trend`.

### Chart 2: Breakdown Kategori (Bar Horizontal)
Per kategori, sortir by Rp descending. Income dan expense terpisah. Sumber: `GET /cashflow/category-breakdown?startDate=&endDate=`.

### Chart 3: Breakdown Platform Source
Distribusi income per platform (POS / Tokopedia / dll). Sumber: `GET /cashflow/platform-breakdown`.

### Stat Cards Atas

```
┌──────────────┬──────────────┬──────────────┐
│  Pemasukan   │  Pengeluaran │   Net Cash   │
│  Periode     │  Periode     │   Periode    │
└──────────────┴──────────────┴──────────────┘
```

## Approval Workflow (Edit / Delete)

Pospro Event punya safeguard anti-curang via model **`CashflowChangeRequest`**:

- **User biasa** (bukan owner/admin) tidak bisa langsung edit/delete entry yang **bukan miliknya**.
- Mereka harus **submit request** (EDIT atau DELETE) dengan note alasan.
- **Owner/admin** review di halaman pending requests → APPROVE / REJECT.
- Saat APPROVE: payload diapply ke entry; saat REJECT: ditolak dengan reviewer note.

Status: `PENDING / APPROVED / REJECTED`.

## Endpoint Backend

| Method | Path | Fungsi |
|---|---|---|
| GET | `/cashflow?startDate=&endDate=&eventId=&rabPlanId=` | List entries (filter periode + event + RAB) |
| GET | `/cashflow/event-profit/:eventId` | Ringkasan income/expense/profit per event |
| GET | `/cashflow/monthly-trend` | 6-bulan trend chart data |
| GET | `/cashflow/category-breakdown?startDate=&endDate=` | Bar chart data per kategori |
| GET | `/cashflow/platform-breakdown?startDate=&endDate=` | Bar chart data per platform |
| POST | `/cashflow` | Buat entry manual (boleh sertakan eventId / rabPlanId) |
| PATCH | `/cashflow/:id` | Update entry (kalau owner) — boleh ubah eventId / rabPlanId |
| DELETE | `/cashflow/:id` | Hapus entry (kalau owner) |

Untuk request approval (non-owner), endpoint terpisah di route `cashflow-requests/*` — handled in same module.

## Best Practice (Konteks Vendor Booth/Event)

- 💳 **Pisah rekening bisnis & pribadi** — mulai dari awal.
- 📝 **Tag event di `note`** — sampai field `eventId` formal ditambahkan, pakai konvensi: `EVT-XXXX — Tipe transaksi`. Contoh: `EVT-2026-042 — DP 50% Booth PT JAPURA`.
- 📅 **Reconcile mingguan** — cocokkan saldo sistem vs mutasi rekening.
- 📊 **Review tiap akhir event** — total income (DP+pelunasan) − total expense (tag note event) = laba kotor project.
- ⚠️ **Untuk lini Digital Printing**: cashflow auto-generated dari kasir POS — jangan duplikasi manual. Cek tag platform "POS (Offline)" untuk identify.

## Limitasi Saat Ini (Backlog)

Hal-hal yang **belum ada** tapi rencananya akan ditambah:

- ✅ ~~Cashflow tidak otomatis dari RAB~~ — **Sudah ada** tombol "💸 Generate Cashflow" di RAB detail (manual trigger by owner, bukan auto-on-CLOSED)
- ❌ Cashflow **tidak otomatis** ter-generate dari Invoice PAID
- ✅ ~~Tidak ada link Cashflow ↔ `Event`~~ — **Sudah ada** field `eventId` di schema + dropdown di form
- ⚠️ Field `rabPlanId` sudah ada di schema, tapi UI dropdown picker belum ditambah ke form
- ❌ Halaman terpisah untuk Bank Account CRUD / Category management belum ada
- ⚠️ Master `CashflowCategory` belum ada — kategori masih hard-coded di frontend (sudah di-context-kan ke vendor booth/event)

## Lihat Juga

- [RAB Event](./rab-event.md) — sumber data ekspense project (manual entry ke cashflow)
- [Penawaran Booth/Event](./penawaran-event.md) — sumber DP/pelunasan klien
- [Surat Order Designer](./sales-order.md) — alur lini Digital Printing yang auto-cashflow
