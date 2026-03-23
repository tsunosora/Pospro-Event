# 🧮 Kalkulator HPP (Harga Pokok Penjualan)

> Kalkulator HPP adalah alat bantu untuk menghitung biaya produksi per unit secara terstruktur — terpisah dari alur transaksi kasir. Hasil kalkulasi bisa langsung diterapkan ke varian produk di inventori sebagai modal/HPP resmi.

---

## Apa itu HPP?

**HPP (Harga Pokok Penjualan)** adalah total biaya yang dikeluarkan untuk memproduksi satu unit produk — mencakup bahan baku, bahan pendukung, dan overhead (listrik, sewa, dll).

Dengan mengetahui HPP yang akurat, pemilik toko bisa:
- Menentukan harga jual yang menghasilkan margin yang diinginkan
- Memantau apakah harga jual saat ini masih menguntungkan
- Membandingkan HPP antar ukuran/varian produk secara sekaligus

---

## Membuka Kalkulator HPP

Buka menu **Laporan → Kalkulator HPP** (atau akses `/reports/hpp`).

---

## Membuat Worksheet HPP Baru

Worksheet adalah satu "lembar kerja" untuk satu jenis produk.

**Langkah-langkah:**

1. Klik **+ Worksheet Baru**
2. Isi **Nama Produk** — contoh: "Spanduk MMT 440gsm"
3. Isi **Target Volume** — perkiraan jumlah yang diproduksi per periode (misal: 100 pcs/bulan). Ini digunakan untuk membagi biaya tetap.
4. Isi **Margin Target (%)** — sistem akan menghitung saran harga jual otomatis berdasarkan margin ini
5. Isi biaya variabel dan biaya tetap (lihat bagian di bawah)
6. Klik **Simpan Worksheet**

---

## Biaya Variabel (Variable Costs)

Biaya yang berubah proporsional dengan jumlah produksi — biasanya bahan baku dan bahan habis pakai.

**Cara menambah biaya variabel:**

1. Klik **+ Tambah Bahan** di bagian Biaya Variabel
2. Pilih salah satu:
   - **Pilih dari Inventori** — klik dropdown dan cari produk bahan baku. Harga per unit diambil otomatis dari data inventori.
   - **Input Manual** — ketik nama bahan dan harga satuan langsung

3. Isi **Jumlah Pemakaian** — berapa banyak bahan yang dipakai per 1 unit produk jadi
4. Untuk bahan berbasis **luas area** (banner, vinyl, kain), aktifkan toggle **L × T (m²)**:
   - Masukkan Lebar (m) dan Tinggi (m)
   - Sistem otomatis menghitung luas m² dan mengalikan dengan harga per m²
   - Contoh: Vinyl 1,2m × 0,8m = 0,96 m², harga Rp 15.000/m² → biaya Rp 14.400

| Field | Keterangan |
|---|---|
| Nama Bahan | Nama bahan baku / material |
| Sumber Harga | Dari inventori (otomatis) atau manual |
| Jumlah Pakai | Berapa unit / m² per produk jadi |
| L × T (toggle) | Aktifkan jika bahan dihitung per luas m² |
| Subtotal | Otomatis = jumlah × harga satuan |

---

## Biaya Tetap (Fixed Costs)

Biaya overhead yang tetap tanpa memandang jumlah produksi — dibagi rata ke seluruh volume target.

Contoh: listrik Rp 500.000/bulan, target 100 pcs → HPP tambahan Rp 5.000/pcs

**Cara menambah biaya tetap:**

1. Klik **+ Tambah Biaya Tetap**
2. Isi keterangan (misal: "Listrik", "Sewa mesin")
3. Isi nominal biaya per periode
4. Sistem otomatis membagi ke seluruh target volume

---

## Hasil Kalkulasi HPP

Setelah semua biaya diisi, sistem menampilkan:

| Informasi | Keterangan |
|---|---|
| **HPP per Unit** | Total biaya variabel + (total biaya tetap ÷ target volume) |
| **Saran Harga Jual** | HPP × (1 + margin target ÷ 100) |
| **Margin Aktual** | Selisih harga jual vs HPP dalam persen |

---

## Kalkulasi Multi-Varian

Fitur **Kalkulasi Multi-Varian** memungkinkan Anda menghitung HPP beberapa ukuran/varian sekaligus dari satu worksheet yang sama — tanpa perlu membuat worksheet terpisah per ukuran.

**Contoh penggunaan:** Spanduk MMT tersedia dalam 3 ukuran berbeda (60×90cm, 100×150cm, 200×300cm). HPP per m² sama, tapi total HPP berbeda karena luasnya berbeda.

### Cara Menggunakan

1. Di bagian bawah worksheet, klik **Kalkulasi Multi-Varian**
2. Klik **+ Tambah Varian** untuk setiap ukuran/tipe yang ingin dihitung
3. Isi detail setiap baris:

| Kolom | Isi |
|---|---|
| **Nama Varian** | Identitas varian: ukuran, jenis, finishing |
| **L × T (m²)** atau **Faktor** | Pilih mode: Area (L × T dalam meter) atau Faktor pengali langsung |
| **HPP Base** | Otomatis = HPP/unit × skala (luas atau faktor) |
| **+ Biaya** | Biaya tambah flat (laminasi, cutting, packaging khusus) |
| **HPP Final** | Otomatis = HPP Base + Biaya Tambah — **ini yang disimpan ke produk** |
| **Harga Jual** | Bisa diisi manual atau dibiarkan kosong (pakai saran dari margin target) |
| **Tier** | Klik badge untuk membuka editor harga bertingkat (opsional) |

### Biaya Tambah (+ Biaya)

Beberapa varian punya proses tambahan di luar bahan baku base. Contoh:
- Laminasi doff: Rp 5.000/pcs
- Mata ayam + tali: Rp 2.000/pcs
- Cutting custom: Rp 3.500/pcs

Isi angka di kolom **+ Biaya**. HPP Final = HPP Base + jumlah ini.

### Harga Bertingkat per Varian (Opsional)

Setiap baris varian bisa punya harga bertingkat berdasarkan qty. Klik badge **[+ tier]** atau **[N tier]** di kolom Tier untuk membuka editor:

- Isi Label (opsional: "Reseller", "Grosir")
- Min Qty dan Max Qty (kosongkan Max = tidak ada batas atas)
- Harga per unit pada range qty tersebut

Harga Jual di kolom utama dipakai sebagai fallback jika qty tidak cocok tier manapun.

---

## Menyimpan Hasil ke Inventori

### Opsi 1 — Daftarkan Produk Baru

Digunakan jika produk ini **belum ada** di inventori.

1. Di bagian **Hasil Analisis HPP**, isi:
   - Nama Produk
   - Kategori
   - Satuan
2. Pastikan tabel Multi-Varian sudah terisi (setiap baris = satu varian)
3. Klik **Simpan Perhitungan & Jadikan Produk**
4. Sistem akan membuat **satu produk baru** dengan **semua baris Multi-Varian sebagai variannya** — lengkap dengan HPP Final, harga jual, dan price tiers (jika ada) per varian

### Opsi 2 — Apply ke Varian yang Sudah Ada

Digunakan jika produk **sudah ada** di inventori dan Anda hanya ingin memperbarui nilai HPP-nya.

1. Di tabel Multi-Varian, klik kolom **Link Varian** pada baris yang ingin di-link
2. Pilih varian yang ada dari dropdown (pencarian berdasarkan nama atau SKU)
3. Setelah semua baris di-link, klik **Simpan & Apply ke Varian**
4. Sistem memperbarui field HPP di masing-masing varian sesuai HPP Final per baris, dan mengganti price tiers jika ada

---

## Tips Penggunaan

- **Simpan dulu, apply kemudian** — Worksheet tersimpan otomatis. Anda bisa kembali kapan saja untuk mengubah biaya dan re-apply ke varian.
- **Gunakan Mode Area untuk bahan banner/vinyl** — Toggle L×T di biaya variabel menghemat waktu hitung manual luas m².
- **Margin target ≠ margin aktual** — Jika harga jual sudah terlanjur dipasang, lihat "Margin Aktual" untuk tahu apakah harga jual saat ini masih menguntungkan.
- **Multi-Varian untuk harga yang berbeda per ukuran** — Lebih efisien daripada membuat worksheet terpisah per ukuran.

---

*Dokumentasi Kalkulator HPP — PosPro v2.7 | 23 Maret 2026*
