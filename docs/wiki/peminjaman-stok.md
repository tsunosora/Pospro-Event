# 📤 Peminjaman Stok dengan Konfirmasi Foto

Modul **Peminjaman Stok** (Withdrawal) memungkinkan crew lapangan **mengambil material/booth dari gudang** untuk event, dengan **wajib upload foto** sebagai bukti checkout & return. Dirancang khusus supaya tidak ada material hilang/lupa dikembalikan setelah event.

## Konsep

```
Crew datang ke gudang
    ↓
Buka link publik /public/gudang (PIN gudang)
    ↓
Pilih: BORROW (pinjam, harus kembali) / USE (pakai habis)
    ↓
Pilih warehouse, worker, event tujuan, item & qty
    ↓
📸 Upload foto checkout (barang yg dibawa)
    ↓
Status: CHECKED_OUT  → stok berkurang
    ↓
... event berjalan ...
    ↓
Crew kembali ke gudang
    ↓
📸 Upload foto return (kondisi barang)
    ↓
Status: RETURNED / PARTIAL_RETURNED  → stok kembali
```

## Tipe Withdrawal

| Type | Keterangan | Stok Kembali? |
|---|---|---|
| **BORROW** | Pinjam (alat, lighting, display) — wajib kembali | Ya, saat return |
| **USE** | Pakai habis (cat, lakban, paku, sticker) | Tidak |

## Status Lifecycle

```
CHECKED_OUT  ─►  RETURNED              (BORROW: dikembalikan utuh)
            ─►  PARTIAL_RETURNED      (BORROW: sebagian rusak/hilang)
            ─►  OVERDUE               (lewat scheduledReturnAt, belum kembali)
            ─►  CANCELLED             (batal, sebelum diambil)
```

## Akses Crew (Public, No-Login)

URL: `https://app.domain.com/public/gudang`

Crew **tidak perlu akun** — cukup **PIN gudang** (4-6 digit) yang dishare ke seluruh tim oleh admin.

```
┌──────────────────────────────────┐
│  Pospro Event — Akses Gudang     │
│                                  │
│  PIN Gudang: ●●●●                │
│            [ Masuk ]             │
└──────────────────────────────────┘
```

## Flow Checkout (Ambil Barang)

1. Login PIN → halaman utama gudang.
2. Klik **+ Pengambilan Baru**.
3. Form:
   - **Worker** — siapa yang ambil (pilih dari list crew)
   - **Warehouse** — gudang asal
   - **Event** — event tujuan (opsional, link ke RAB/Event)
   - **Type** — BORROW / USE
   - **Purpose** — keperluan (text bebas, mis. "Setup Booth PT JAPURA – Surabaya")
   - **Scheduled Return** — tanggal target kembali (BORROW only)
4. Tambah item:
   - Pilih ProductVariant (cari nama / scan barcode)
   - Input qty
5. **📸 Upload foto checkout** — wajib (foto barang yang akan dibawa).
6. Klik **Submit**.

Output:
- `Withdrawal` baru dengan `code` auto (mis. `WD/2026/04/0042`)
- Stok variant **berkurang** sesuai qty (StockMovement type `WITHDRAWAL_OUT`)
- Foto tersimpan di `public/uploads/withdrawal-<timestamp>.jpg`
- `checkoutPhotoUrl` ter-set di record

## Flow Return (Kembalikan Barang)

1. Login PIN → tab **Pinjaman Aktif**.
2. Cari withdrawal by code / worker / event.
3. Klik **Return**.
4. Per item: input `returnedQty` (boleh < qty awal jika rusak/hilang).
5. **📸 Upload foto return** — wajib (foto barang saat dikembalikan, untuk QC kondisi).
6. Notes opsional (mis. "Lighting Strip 1 mati, perlu service").
7. Submit.

Output:
- Status: `RETURNED` (semua kembali) / `PARTIAL_RETURNED` (sebagian)
- Stok ditambah kembali sesuai `returnedQty` (StockMovement type `WITHDRAWAL_IN`)
- Selisih qty awal vs returnedQty → masuk ke laporan **Kerugian Project** (link ke event)
- `returnPhotoUrl` ter-set

## Halaman Admin

| URL | Fungsi |
|---|---|
| `/withdrawals` | List semua withdrawal + filter status / event / worker |
| `/withdrawals/[id]` | Detail + foto checkout & return + log activity |
| `/withdrawals/overdue` | Pinjaman lewat tanggal kembali |
| `/warehouses` | Master gudang |
| `/warehouses/[id]/locations` | Master Storage Location (rak/shelf di dalam gudang) |
| `/warehouses/pin` | Atur PIN akses public/gudang |

## Foto sebagai Bukti

Setiap record withdrawal menyimpan **2 foto**:

```
checkout_photo_url  → /public/uploads/withdrawal-1714056789-123456789.jpg
return_photo_url    → /public/uploads/withdrawal-1714232100-987654321.jpg
```

Filter di-validate (jpg/jpeg/jfif/png/gif/webp). Maks size atur di multer config (default 5MB).

**Use case foto:**
- 🛡️ **Bukti tanggung jawab** — saat barang hilang, foto checkout = bukti barang ada saat keluar.
- 🔍 **QC kondisi** — bandingkan foto checkout vs return, deteksi kerusakan.
- 📋 **Audit gudang** — sample random withdrawal, cek konsistensi foto vs item list.

## Storage Location (Rak Gudang)

Setiap warehouse bisa punya banyak `StorageLocation` (rak A1, B2, dll). Saat checkout, item di-link ke lokasi rak supaya:
- Crew gampang cari (tampil "Plywood 18mm – Rak A1")
- Saat return, di-arahkan kembalikan ke rak yang sama

## Integrasi dengan Modul Lain

| Modul | Integrasi |
|---|---|
| **Event** | `Withdrawal.eventId` — semua pinjaman per event ter-track |
| **RabPlan** | Via Event — laporan realisasi cost include withdrawal |
| **Stok** | StockMovement type `WITHDRAWAL_OUT` & `WITHDRAWAL_IN` |
| **Packing List** | `EventPackingItem.disposition = PINJAM` link ke withdrawal nanti |
| **Worker** | Jejak siapa yang sering telat return / banyak rusak |

## Notifikasi Otomatis

- 🔔 **H-1 deadline return**: notifikasi ke admin + worker yang pinjam.
- 🚨 **Status OVERDUE**: muncul di dashboard admin + warning di list.
- ✅ **Return success**: konfirmasi ke worker via WhatsApp (opsional).

## Best Practice

- 📌 **Foto wajib jelas** — terlihat barang + jumlah. Tolak submit jika gambar blur (cek manual).
- 🗓️ **Set scheduledReturnAt** untuk semua BORROW — auto-overdue tracking.
- 👮 **Audit OVERDUE mingguan** — telpon worker, jangan biarkan menumpuk.
- 🏷️ **Pakai disposition `PINJAM` di Packing List** — jadi saat event selesai, system tahu mana yang harus di-return.
- 🔒 **Rotasi PIN gudang** per 3 bulan — mencegah PIN bocor ke ex-crew.

## Lihat Juga

- [Antrian Produksi](./produksi.md) — sumber kebutuhan material
- [Stok Opname](./stock-opname.md) — audit cocok dengan record withdrawal
- [Laporan Stok](./laporan-stok.md) — mutasi `WITHDRAWAL_OUT` / `WITHDRAWAL_IN`
