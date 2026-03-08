# 🖨️ Antrian Produksi

> Modul **Antrian Produksi** dirancang khusus untuk toko percetakan digital. Setiap order cetak yang masuk dari kasir otomatis tercatat sebagai *job* yang bisa dikelola oleh operator mesin secara real-time — tanpa perlu login ke akun utama.

---

## Konsep Dasar

```
[Kasir checkout item cetak]
         ↓
[ProductionJob ANTRIAN dibuat otomatis]
         ↓
[Operator buka /produksi (PIN)]
         ↓
[Pilih job → Start → pilih bahan roll → potong stok]
         ↓
  PROSES → SELESAI → DIAMBIL
```

Poin penting:
- **Produk dengan flag "Perlu Produksi"**: stok bahan roll **tidak dipotong** saat kasir checkout — pemotongan terjadi saat operator klik **Mulai Cetak**
- **Produk tanpa flag** (AREA_BASED biasa): stok langsung terpotong saat transaksi, tidak membuat job produksi
- Halaman `/produksi` bersifat **publik** — tidak perlu login JWT, cukup PIN operator

---

## Setup Awal

### 1. Atur PIN Operator

Sebelum operator bisa mengakses halaman produksi, admin perlu mengatur PIN:

1. Buka **Pengaturan → Umum (General)**
2. Isi kolom **PIN Operator**
3. Klik **Simpan**

PIN ini digunakan di halaman `/produksi` sebagai ganti login. Session PIN bertahan **24 jam** di perangkat yang sama.

---

### 2. Tandai Produk Sebagai "Perlu Produksi"

Saat menambah atau mengedit produk:

1. Pastikan **Mode Harga** = **Area Based (per m²)**
2. Centang opsi **"Perlu Proses Produksi"**
3. Simpan produk

Produk yang dicentang akan membuat **antrian job** setiap kali terjadi penjualan di kasir.

---

### 3. Daftarkan Bahan Roll (Opsional)

Bahan roll adalah stok kain/vinyl/laminasi yang dipakai saat mencetak. Daftarkan sebagai produk varian biasa:

1. Buat produk baru (contoh: "Vinyl Glossy"), tipe **RAW_MATERIAL**, mode harga **UNIT** (stok dalam m²)
2. Di varian: aktifkan **"Bahan Roll"**, isi lebar fisik dan lebar efektif cetak
3. Stok bahan ini akan terpotong otomatis saat operator memulai job

---

## Cara Menggunakan — Operator

### Buka Halaman Produksi

1. Buka browser, akses `[URL_APLIKASI]/produksi`
2. Masukkan **PIN Operator**
3. Klik **Masuk** — session aktif selama 24 jam

### Tampilan Utama

Di bagian atas terdapat **stats ringkasan**:

| Badge | Artinya |
|---|---|
| 🟡 Antrian | Job yang belum dikerjakan |
| 🔵 Proses | Job sedang dikerjakan |
| 🟢 Selesai | Job selesai, menunggu diambil pelanggan |

Di bawahnya terdapat **tab filter**: ANTRIAN · PROSES · SELESAI · DIAMBIL

---

### Mode 1: Cetak Satuan (per Job)

Untuk mengerjakan satu job cetak secara terpisah.

**Mulai Job:**
1. Klik tombol **▶ Mulai** pada job yang ingin dikerjakan
2. Dialog muncul, isi:
   - **Bahan Roll**: pilih bahan yang dipakai (opsional jika pakai waste)
   - **Pakai Waste/Sisa**: centang jika memakai sisa bahan (stok tidak dipotong)
   - **Luas Bahan (m²)**: otomatis terhitung dari ukuran job, bisa diubah manual
   - **Catatan Operator**: keterangan finishing, warna, dll
3. Klik **Mulai Cetak** → status berubah ke **PROSES** + stok roll terpotong

**Selesaikan Job:**
1. Di tab PROSES, klik **✓ Selesai**
2. Tambahkan catatan akhir jika perlu
3. Status berubah ke **SELESAI**

**Tandai Diambil:**
1. Di tab SELESAI, klik **📦 Diambil** saat pelanggan mengambil pesanan
2. Status berubah ke **DIAMBIL**

---

### Mode 2: Gabung Cetak (Batch)

Untuk mencetak beberapa job sekaligus dalam satu lembaran bahan (lebih hemat bahan).

1. Klik tombol **Gabung Cetak** di pojok kanan atas
2. Centang job-job yang ingin digabung (hanya job berstatus ANTRIAN)
3. Total luas gabungan (m²) tampil otomatis
4. Pilih bahan roll atau centang **Pakai Waste**
5. Klik **Buat Batch** → semua job yang dipilih masuk ke **PROSES** bersamaan dengan nomor batch (contoh: `BATCH-0001`)
6. Setelah selesai, klik **✓ Selesai Batch** → semua job dalam batch berubah ke **SELESAI**

---

## Informasi pada Kartu Job

Setiap kartu job di antrian menampilkan:

| Informasi | Keterangan |
|---|---|
| **Nomor Job** | Format `JOB-YYYYMMDD-XXXX` |
| **Nomor Invoice** | Referensi ke transaksi kasir |
| **Nama Pelanggan** | Dari data transaksi |
| **Produk & Ukuran** | Nama produk + dimensi cetak (lebar × tinggi cm) |
| **Prioritas** | Badge **EXPRESS** (merah) atau Normal |
| **Deadline** | Waktu tersisa — merah jika < 2 jam, **"TERLAMBAT"** jika sudah lewat |
| **Catatan Kasir** | Instruksi finishing dari kasir/pelanggan |

---

## Prioritas Job

Saat kasir membuat transaksi dengan item cetak, kasir bisa memilih:

- **Normal**: masuk antrian biasa (urut waktu masuk)
- **EXPRESS**: muncul di urutan paling atas antrian, ditandai badge merah

Order EXPRESS juga bisa diatur dengan **Deadline** (tanggal & jam selesai). Job yang sudah melewati deadline tampil badge **"TERLAMBAT"** berwarna merah.

---

## Pemotongan Stok Bahan

| Kondisi | Stok yang dipotong |
|---|---|
| Pakai bahan roll baru (usedWaste = false) | Stok varian roll berkurang sebesar `luas m²` (dibulatkan ke atas) |
| Pakai sisa/waste (usedWaste = true) | Tidak ada pemotongan stok |
| Batch dengan bahan roll | Stok dipotong total luas gabungan semua job dalam batch |

Setiap pemotongan tercatat di **Riwayat Stok** (`StockMovement`) dengan keterangan nomor job/batch.

---

## FAQ Produksi

**Q: Mengapa job tidak muncul di antrian padahal sudah ada transaksi?**
> Pastikan produk sudah dicentang "Perlu Proses Produksi" di halaman edit produk. Produk tanpa flag ini tidak membuat job.

**Q: Apakah operator bisa mengakses dari HP?**
> Ya. Halaman `/produksi` didesain responsif untuk layar HP dan tablet.

**Q: Bagaimana jika PIN lupa?**
> Admin perlu mengubah PIN di Pengaturan → Umum, lalu beritahu operator PIN baru.

**Q: Apakah bisa ada beberapa operator yang buka halaman produksi bersamaan?**
> Ya — halaman ini real-time dan bisa dibuka di banyak perangkat sekaligus.

---

*Wiki PosPro — Terakhir diperbarui: 8 Maret 2026*
