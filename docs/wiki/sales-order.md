# 📝 Surat Order Designer (Sales Order)

**Sales Order** di Pospro Event adalah **surat order ke designer untuk digital printing** — bukan Sales Order B2B/distributor klasik. Dipakai saat klien datang minta cetak (banner, poster, X-banner, sticker, dll), admin bikin SO, designer kerjakan, lalu klien bayar dan SO ter-link ke transaksi kasir.

## Akses

Menu sidebar: **Sales Order** (`/sales-orders`)

> Sidebar punya badge **🔴 angka** = jumlah SO yang belum di-invoice (klien belum bayar).

## Flow Lengkap

```
1. Klien datang counter / WA: "Mau cetak banner 3x1m, deadline besok"
                ↓
2. Admin bikin Sales Order
   - Customer (existing / new)
   - Designer (pilih dari master Designer)
   - Item: produk + Lebar × Tinggi (cm) + qty + custom price
   - Deadline
   - Notes (revisi, warna khusus, dll)
                ↓
3. Status: DRAFT → klik "Kirim ke WA Designer"
                ↓ sentToWaAt = now()
4. Status: SENT
   Designer terima link → kerjakan desain
                ↓
5. Designer upload proof (foto/file hasil desain) di public link
                ↓
6. Admin / klien approve proof → cetak via Antrian Cetak Paper
                ↓
7. Klien datang ambil + bayar → buka SO → klik "Buat Transaksi POS"
                ↓ transactionId di-link
8. Status: INVOICED  → muncul di Rekap Penjualan + Cashflow
```

## Halaman

| URL | Fungsi |
|---|---|
| `/sales-orders` | List SO + filter status (DRAFT/SENT/INVOICED/CANCELLED) + search |
| `/sales-orders/new` | Bikin SO baru |
| `/sales-orders/[id]` | Detail SO + items + upload proof + tombol kirim WA |
| `/sales-orders/public/[token]` | **Public link** untuk designer (no-login) |

## Form Sales Order

### Kepala SO

| Field | Catatan |
|---|---|
| `soNumber` | Auto (`SO/IV/2026/0042`) — format Indonesia |
| Customer | Pilih existing customer / input nama+phone manual |
| Designer | Pilih dari master Designer (lookup by PIN/name) |
| Deadline | Tanggal & jam target selesai |
| Notes | Catatan revisi / spec khusus |

### Item (Multi-Row)

| Field | Catatan |
|---|---|
| Product Variant | Pilih dari katalog (banner vinyl, photopaper, sticker, dll) |
| Quantity | Jumlah cetak |
| Width × Height (cm) | Untuk produk area-based — auto-hitung m² |
| Unit Type | m² / cm² / pcs / menit (sesuai produk) |
| Custom Price | Override harga katalog (opsional) |
| Note per item | Detail spec (mis. "laminasi doff", "cutting")

> Total area & subtotal otomatis terhitung saat input Lebar × Tinggi.

## Public Link untuk Designer

Setiap SO bisa di-share ke designer **tanpa akun**. Tombol **"Kirim ke WA"** di detail SO akan:

1. Generate token unik `/sales-orders/public/<token>`.
2. Buka WhatsApp Web/App dengan template:
   ```
   Halo [Nama Designer],
   Order baru: SO/IV/2026/0042
   Customer: PT Sukses
   Deadline: 27 Apr 2026
   Detail: <link>
   ```
3. Set `sentToWaAt = now()` dan status → SENT.

Designer buka link → lihat:
- Detail order lengkap
- Form **upload proof** (gambar PNG/JPG/PDF preview hasil desain)
- Bisa upload multiple proof (revisi)

## Proof / Approval

Saat designer upload proof:

```
SalesOrderProof:
  - filename:  proof-1714056789.png
  - caption:   "Revisi 1 - background biru"
  - createdAt: 2026-04-26 14:30
```

Admin lihat di detail SO → tab **Proofs** → preview gambar. Approve → kirim ke Antrian Cetak Paper. Reject → catat alasan, designer kerjakan revisi.

## Konversi ke Transaksi POS

Klien datang ambil + bayar → tombol **"Buat Transaksi POS"** di detail SO:

1. Sistem buka kasir POS dengan keranjang **pre-filled** dari item SO.
2. Admin pilih metode bayar (Tunai/Transfer/QRIS/DP).
3. Selesai → `Transaction` baru ter-link, `transactionId` set di SO.
4. Status SO → INVOICED, `invoicedAt = now()`.
5. Stock variant otomatis terpotong (sama seperti transaksi kasir biasa).

## Status Lifecycle

```
DRAFT  ──► SENT  ──► INVOICED   (klien bayar — masuk Cashflow)
       └─► CANCELLED               (cancel — catat reason)
```

| Status | Aksi yang Boleh |
|---|---|
| DRAFT | Edit semua field, hapus, kirim ke WA |
| SENT | Edit notes/deadline, tambah proof, batalkan, convert ke POS |
| INVOICED | Read-only (sudah jadi transaksi POS) |
| CANCELLED | Read-only + catatan reason |

## Master Designer (PIN Login)

Designer **tidak perlu akun email/password**. Sama seperti operator produksi, login pakai **PIN 4-digit**.

URL untuk designer: `/sales-orders/public/[token]` — tidak perlu PIN, hanya butuh token (yang dikirim via WA).

Master designer di `/settings/designers`:
- Nama
- PIN (untuk akses dashboard sendiri jika nanti ditambah)
- Active/Inactive

## Integrasi dengan Modul Lain

| Modul | Integrasi |
|---|---|
| **Customer** | `customerId` link ke master customer (atau input manual) |
| **Antrian Cetak Paper** | Setelah proof di-approve, generate job cetak |
| **Stok Material** | Saat INVOICED → stok ter-potong via Transaction |
| **Cashflow** | Income otomatis saat status INVOICED |
| **Rekap Penjualan** | Transaction terikat muncul di rekap |

## Use Case

### 1. Order Walk-In Counter

Klien datang: "Mau cetak X-banner 60×160 cm, 1 pcs, deadline siang ini"

1. Admin: `/sales-orders/new` → pilih customer (atau input nama)
2. Pilih designer → set deadline jam 13:00
3. Tambah item: X-banner stand 60×160, qty 1
4. Save → tombol **Kirim ke WA**
5. Designer upload proof → admin approve → cetak
6. Klien datang ambil → klik **Buat Transaksi POS** → bayar tunai → selesai

### 2. Order via WhatsApp

Klien chat WA: "Mau cetak banner 3×1 m, 2 lembar, file desain saya kasih"

1. Admin terima file → bikin SO dengan designer = "Self" (atau skip designer kalau klien kasih file siap cetak)
2. Status langsung SENT
3. Upload file klien sebagai proof → cetak
4. Klien datang / kirim → terima pelunasan → invoice

### 3. Order Repeat dari Customer Lama

1. Buka detail customer → tab **Sales Orders** → klik **Duplicate** dari SO sebelumnya
2. Adjust qty/ukuran → save
3. Kirim ke designer same as before

## Best Practice

- 📅 **Set deadline realistis** — designer butuh minimal 2 jam untuk desain banner standar.
- 📸 **Wajibkan minimal 1 proof** sebelum cetak — meminimalkan reprint karena salah.
- 🏷️ **Pakai template item** untuk produk yang sering — kurangi typo.
- 📞 **Kirim WA** segera setelah save SO — designer langsung mulai, deadline aman.
- 💬 **Tulis caption proof** detail revisi — komunikasi designer ⇄ admin lebih jelas.
- ❌ **Cancel beralasan** — selalu isi `cancelReason` supaya bisa di-audit.

## Lihat Juga

- [Mesin Cetak Paper](./mesin-cetak.md) — antrian cetak setelah proof di-approve
- [Cashflow](./cashflow.md) — income otomatis saat INVOICED
- [Customers](./crm-convert.md) — link customer ke order
