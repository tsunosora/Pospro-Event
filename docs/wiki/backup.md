# 💾 Backup & Restore Data

> Panduan lengkap untuk mengekspor data ke file ZIP dan memulihkan data dari backup.

---

## Apa itu Fitur Backup?

Fitur **Backup & Restore** memungkinkan Anda mengekspor seluruh (atau sebagian) data database PosPro ke dalam satu file ZIP. File tersebut bisa disimpan sebagai cadangan dan digunakan untuk memulihkan data jika terjadi masalah.

Manfaat:
- **Cadangan berkala** sebelum update sistem
- **Migrasi data** ke server baru
- **Pemulihan data** setelah kerusakan atau kesalahan input massal

---

## Halaman Backup

Buka **Pengaturan → Backup & Restore** (`/settings/backup`).

---

## Export (Membuat Backup)

### Langkah-langkah Export

1. Buka halaman **Pengaturan → Backup & Restore**
2. Di panel **Export**, pilih **grup data** yang ingin dicadangkan:
   - Centang grup yang diperlukan (contoh: Produk, Transaksi, Pelanggan)
   - Atau klik **Pilih Semua** untuk mencadangkan seluruh database
3. Atur opsi **Sertakan Gambar**:
   - **Aktif** (default): gambar produk, logo, dan foto bukti ikut dimasukkan ke dalam ZIP
   - **Nonaktif**: hanya data teks/angka dari database, ukuran file lebih kecil
4. Klik **Export** — file ZIP langsung diunduh ke komputer Anda

> **Catatan Teknis**: File ZIP di-*stream* langsung ke browser tanpa dibuffer di memori server. Ini berarti export data besar tetap efisien dan tidak membebani server.

### Grup Data yang Tersedia

Endpoint `GET /backup/groups` mengembalikan daftar grup yang bisa dipilih. Biasanya mencakup:

| Grup | Isi |
|---|---|
| Produk & Inventori | Produk, varian, bahan baku, stok |
| Transaksi | Riwayat transaksi dan item terjual |
| Pelanggan | Database pelanggan |
| Cashflow | Catatan arus kas |
| Shift Reports | Laporan tutup shift |
| Pengaturan | Konfigurasi toko, rekening bank |
| Supplier | Data supplier dan harga beli |

---

## Preview Sebelum Restore

Sebelum melakukan restore, Anda bisa **preview** isi file backup:

1. Klik tombol **Preview Backup**
2. Upload file ZIP backup
3. Sistem menampilkan ringkasan: berapa record per tabel yang ada di dalam file
4. Tinjau informasi ini sebelum memutuskan apakah akan melanjutkan restore

---

## Restore (Memulihkan dari Backup)

> ⚠️ **Peringatan**: Restore adalah operasi yang **tidak bisa dibatalkan**. Selalu buat backup terbaru sebelum melakukan restore.

### Langkah-langkah Restore

1. Di panel **Restore**, klik **Pilih File** dan unggah file ZIP backup
2. Pilih **Mode Restore**:
   - **Skip** — data yang sudah ada di database dibiarkan, hanya data baru yang ditambahkan
   - **Overwrite** — data yang sudah ada akan **ditimpa** dengan data dari backup
3. Klik **Mulai Restore**
4. Tunggu proses selesai — sistem menampilkan ringkasan berapa record berhasil diimpor

### Perbedaan Mode Skip vs Overwrite

| Skenario | Skip | Overwrite |
|---|---|---|
| Record dengan ID yang sama sudah ada | Dilewati | Ditimpa dengan data backup |
| Record baru (ID belum ada di DB) | Dimasukkan | Dimasukkan |
| Cocok untuk | Menambah data ke DB yang sudah berisi | Mengembalikan DB ke kondisi snapshot backup |

---

## Endpoint API (Untuk Developer)

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/backup/groups` | Ambil daftar grup data yang bisa di-export |
| `POST` | `/backup/export` | Export data ke ZIP (returns binary stream) |
| `POST` | `/backup/preview` | Preview isi file backup tanpa merestore |
| `POST` | `/backup/restore` | Restore data dari file ZIP |

> **Catatan**: `POST /backup/export` mengembalikan **binary stream** (bukan JSON). Jika memanggil endpoint ini dari kode, pastikan response type diset ke `blob` atau `arraybuffer`, bukan JSON.

---

## Catatan Penting

- **Backup rutin dianjurkan** — minimal seminggu sekali, atau sebelum setiap update sistem
- **Simpan file backup di lokasi terpisah** dari server (hard drive eksternal, cloud storage)
- **Ukuran file** tergantung jumlah data dan apakah gambar disertakan:
  - Tanpa gambar: biasanya beberapa MB
  - Dengan gambar: bisa puluhan hingga ratusan MB tergantung banyaknya foto produk
- **Mode Overwrite** cocok untuk disaster recovery; **Mode Skip** cocok untuk merge data dari dua instalasi berbeda

---

*Wiki PosPro — Backup & Restore | Maret 2026*
