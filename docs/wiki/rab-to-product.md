# 📦 Save RAB Item as Product (Reuse Booth Standar)

Salah satu fitur unik Pospro Event: **item RAB bisa di-save sebagai produk** di katalog inventory. Sekali simpan, paket booth standar yang sering Anda jual (mis. Booth 3×3 Wood Standard) bisa langsung dijual lewat Kasir POS atau ditarik ulang ke RAB project lain — tidak perlu input ulang dari nol.

## Use Case

- Anda punya **3 booth desain standar** yang sering diorder klien (3×3 Wood, 3×3 Modular, 4×6 Premium).
- Sekali design + RAB sudah jadi → save sebagai product `Booth 3×3 Wood Standard` dengan harga jual fixed.
- Project berikutnya yang minta "booth 3×3 standar" → tinggal tarik dari katalog, tidak rebuild RAB.
- Untuk klien walk-in / order kecil → bisa dijual via Kasir POS sebagai produk biasa.

## Cara Pakai

### 1. Buka RAB yang sudah lengkap

`/rab/[id]` → pastikan items sudah final dengan harga modal & harga jual yang akurat.

### 2. Klik tombol "Save as Product" di item

Di setiap baris item RAB, ada menu **⋮ → Save as Product**.

### 3. Form Save as Product

```
┌─────────────────────────────────────┐
│ Save Item RAB as Product            │
├─────────────────────────────────────┤
│ Nama Produk:    [Booth 3x3 Wood   ] │
│ Kategori:       [Booth Custom    ▾] │
│ Harga Jual:     [ Rp 12.000.000  ]  │  ← dari unitPrice item RAB
│ Harga Modal:    [ Rp  8.500.000  ]  │  ← dari unitCost item RAB
│ Tanpa Lacak Stok: ☑                  │  ← biasanya ON untuk produk custom
│ Foto:           [ Upload... ]        │
│ Deskripsi:      [...]                │
│                                      │
│              [ Cancel ]  [ Save → ]  │
└─────────────────────────────────────┘
```

> **Tanpa Lacak Stok** disarankan ON untuk booth custom — supaya bisa dijual berkali-kali tanpa kehabisan stok (production-on-demand). Kalau punya stock fisik (mis. modular yang ready), uncheck dan input stok.

### 4. Save → Produk muncul di Inventory

Buka `/inventory` → produk baru tampil di list. Lengkap dengan:
- Harga jual (= unitPrice RAB)
- HPP (= unitCost RAB)
- Margin% otomatis
- Foto

## Alur Konsumsi

### A. Dari Kasir POS (untuk klien walk-in / order kecil)

1. Klien datang minta booth standar → buka `/pos`.
2. Cari produk "Booth 3×3 Wood" → tambah ke keranjang.
3. Bayar (Tunai / Transfer / DP) → struk cetak.
4. Buat Job Produksi manual untuk eksekusi (jadi produk → schedule produksi).

### B. Dari RAB Project Baru

1. Bikin RAB baru → tab Items → pilih dari katalog produk.
2. Masukkan `Booth 3×3 Wood` sebagai item — harga + cost otomatis ter-isi.
3. Save → tinggal sesuaikan kuantitas & adjust biaya khusus event itu.

### C. Dari Penawaran (SPH)

1. Bikin SPH → Catalog Picker → pilih `Booth 3×3 Wood`.
2. Item ter-isi otomatis → tinggal print PDF & kirim klien.

## Endpoint Backend

```
POST /rab/:id/save-as-product
Body multipart:
  - itemId (rabItem ID)
  - productName
  - categoryId
  - sellPrice
  - costPrice
  - trackStock: boolean
  - description
  - photo (file, optional)

Response: { product: Product, variant: ProductVariant }
```

## Update Harga / Spec Booth Standar

Saat harga material naik atau Anda mau revisi spec:

1. Buka `/inventory/[productId]` → edit harga jual / HPP / foto.
2. **Ini tidak otomatis update RAB lama** yang sudah dibuat (harga ter-snapshot saat input).
3. Hanya RAB / SPH / POS **baru** yang akan ambil harga baru.

Kalau mau update harga di RAB lama yang sudah running, edit langsung di RAB-nya.

## Best Practice

- 🏷️ **Naming convention konsisten**: `Booth 3x3 Wood Standard`, `Booth 4x6 Premium Modular`. Memudahkan search di Catalog Picker.
- 📁 **Bikin kategori "Booth Custom"** terpisah dari kategori material biasa (kayu/MDF) supaya catalog rapi.
- 📸 **Wajib upload foto** — saat klien lihat SPH PDF, ada visual referensi yang akurat.
- 🧮 **Re-evaluate cost tiap 3 bulan** — material harga naik, HPP harus di-update supaya margin tetap sehat.
- 📌 **Tag "Tanpa Lacak Stok"** untuk produk built-on-demand. Jangan untuk material lepasan yang punya stok fisik.

## Kapan Tidak Pakai Fitur Ini?

- ❌ Booth yang **fully unique** (sekali pakai, tidak akan diorder lagi) — buang waktu save as product.
- ❌ Material lepasan (plywood, cat) — itu sudah ada di master Product, tidak perlu re-save.
- ❌ Saat masih draft RAB — tunggu RAB final dulu baru save.

## Lihat Juga

- [RAB Event](./rab-event.md) — sumber item yang di-save
- [Penawaran Booth/Event](./penawaran-event.md) — konsumsi via Catalog Picker
- [Manajemen Stok](./laporan-stok.md) — produk hasil save tampil di inventory
