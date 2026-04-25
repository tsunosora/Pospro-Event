# 💸 Cashflow Bisnis — Pospro Event

Modul **Cashflow** mencatat semua arus kas masuk & keluar bisnis vendor booth/event. Sumbernya dua: **otomatis** (dari Invoice & RAB CLOSED) dan **manual** (input bebas oleh admin).

## Akses

Menu: **Keuangan → Cashflow** (`/cashflow`).

## Sumber Data

### Otomatis

| Trigger | Tipe | Kategori |
|---|---|---|
| Invoice di-mark **PAID** | INCOME | Sales Booth/Event |
| RAB di-mark **CLOSED** + realisasi cost | EXPENSE | Project Cost (per kategori RAB) |
| Refund Invoice | EXPENSE | Refund |

Entri otomatis ditandai **🤖 badge** — tidak bisa di-edit, harus dari source-nya.

### Manual

Admin input bebas via tombol **+ Tambah Entry**:

| Field | Catatan |
|---|---|
| `date` | Tanggal transaksi |
| `type` | INCOME / EXPENSE |
| `category` | Pilih dari master kategori |
| `amount` | Nominal Rp |
| `bankAccountId` | Rekening source/destination |
| `description` | Detail transaksi |
| `attachment` | Upload bukti (foto/PDF) |

## Kategori Default

**Income**: Sales Penawaran · Sales RAB · DP Booth · Pelunasan · Lain-lain

**Expense**: Material Booth · Jasa Tukang · Transport · Akomodasi · Sewa Alat · Gaji Crew · Operasional Kantor · Marketing · Lain-lain

Tambah custom via `/cashflow/categories`.

## Multi-Bank Account

Daftarkan rekening bisnis (BCA, Mandiri, BRI, dll) di `/cashflow/banks`. Setiap entri cashflow ter-link ke bank account → saldo per rekening ter-update.

## Halaman

| URL | Fungsi |
|---|---|
| `/cashflow` | Dashboard — chart tren + list entry |
| `/cashflow/new` | Tambah entry manual |
| `/cashflow/categories` | CRUD kategori |
| `/cashflow/banks` | CRUD rekening |
| `/cashflow/report` | Export Excel + filter periode |

## Filter Periode

- Hari Ini / Minggu Ini / Bulan Ini
- 3 Bulan Terakhir / Tahun Ini / Tahun Lalu / All-Time
- Custom range (date picker)

## Visualisasi

### Chart 1: Tren 6 Bulan (Area Chart)

X-axis: Bulan · Y-axis: Rp · 2 series: Pemasukan (hijau) vs Pengeluaran (merah).

### Chart 2: Breakdown Kategori (Bar Horizontal)

Sort by total Rp descending. Per kategori income & expense terpisah.

### Stat Cards

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│  Pemasukan   │  Pengeluaran │   Net Cash   │  Saldo Bank  │
│  Bulan Ini   │  Bulan Ini   │   Bulan Ini  │   (Total)    │
│  Rp 245jt    │  Rp 168jt    │  + Rp 77jt   │   Rp 320jt   │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

## Laba per Project

Selain cashflow umum, ada laporan **Laba per Project** di tab terpisah:

```
Project: Booth PT. JAPURA — Juni 2026 Surabaya
  Total Invoice (jual)  : Rp 12.765.000
  Total RAB CLOSED      : Rp  8.420.000
  ──────────────────────────────────────
  Laba Kotor            : Rp  4.345.000  (34%)
```

Sinkron real-time saat RAB di-mark CLOSED.

## Export Excel

Tombol **Export** di header → download `.xlsx` dengan kolom: Tanggal, Tipe, Kategori, Bank, Deskripsi, Income, Expense, Net.

## Best Practice

- 💳 **Pisah rekening bisnis & pribadi** — mulai dari awal.
- 📎 **Upload bukti** untuk semua expense > Rp 500rb — audit trail.
- 📅 **Reconcile mingguan** — cocokkan saldo sistem vs mutasi rekening.
- 📊 **Review laba project** setelah event selesai — input ke RAB project berikut (margin baseline).

## Lihat Juga

- [RAB Event](./rab-event.md) — sumber expense otomatis
- [Penawaran](./penawaran-event.md) → Invoice — sumber income otomatis
