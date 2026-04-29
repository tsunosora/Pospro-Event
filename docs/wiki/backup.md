# 💾 Backup & Restore — Panduan Mudah

> **Singkatnya**: Backup itu seperti **foto kopi semua data Anda**. Kalau komputer rusak, datanya kebanjiran, atau ada yang salah klik, Anda bisa kembalikan semua dari foto kopi ini. Wajib dilakukan **rutin**!

## Kenapa Wajib Backup?

Bayangkan kerja keras berbulan-bulan: data ratusan klien, puluhan event, daftar harga material, foto crew check-in di lokasi, semua nomor penawaran… **semua hilang dalam sekejap** kalau:

- 💻 Komputer/laptop rusak
- ⚡ Mati lampu mendadak saat update
- 🦠 Kena virus / ransomware
- ✋ Salah klik "hapus" atau "restore" yang salah
- 🔄 Update aplikasi yang gagal

**Backup = asuransi data**. 5 menit setiap minggu, bisa selamatkan kerja berbulan-bulan.

## Akses

Menu sidebar: **Pengaturan** (di footer kiri bawah) → **Backup & Restore** (`/backup`).

## Apa Saja yang Di-Backup?

Pospro Event mem-backup **semua data** yang Anda input. Dikelompokkan jadi beberapa "paket" supaya bisa dipilih kalau perlu:

| Paket | Isinya |
|---|---|
| **Master Data** | Pengaturan toko, kategori produk, satuan, rekening bank, cabang |
| **Pengguna** | Akun login user (admin, kasir, dll) |
| **Produk & Inventori** | Daftar produk, varian, stok, mutasi stok |
| **Supplier** | Daftar pemasok material |
| **Pelanggan** | Master customer (nama, kontak, perusahaan) |
| **HPP & Costing** | Worksheet hitung modal produk |
| **Transaksi & Penjualan** | Transaksi POS kasir + cashflow |
| **Invoice & Penawaran** | SPH (penawaran) & invoice |
| **Produksi** | Job produksi booth, batch cetak |
| **Stok Opname** | Sesi audit stok |
| **Laporan Shift** | Tutup shift kasir + kompetitor |
| **Petugas / Worker** | Daftar crew/karyawan |
| **Gudang & Lokasi** | Master gudang + rak penyimpanan |
| **Event & Packing** | Event + packing list + peminjaman barang |
| **Crew Lapangan & Team** ⭐ | Team Kepuh/Sawah + check-in/out crew |
| **RAB & Penomoran** | RAB plan + counter nomor dokumen |
| **CRM / Pipeline Lead** | Lead, stages, label, activity |
| **Printing & Antrian** | Job cetak paper |
| **Sales Order & Designer** | Surat order ke designer |

> **Versi backup saat ini: 2.6** ⭐ — sudah include semua tabel & field-level additions terbaru (Brand Settings, Quotation Variants, Inventory Acquisition, Worker fullName, Variant description/notes/defaultWarehouseId, RabPlan tags).

## Cara Backup (Bikin Foto Kopi)

### Langkah 1
Klik menu **"Pengaturan"** di sidebar kiri bawah → pilih **"Backup & Restore"**.

### Langkah 2
Klik tab **"Backup / Export"**.

### Langkah 3
Centang paket data yang ingin di-backup. **Untuk aman, centang semua**.

### Langkah 4
Klik tombol biru **"Download Backup ZIP"**.

### Langkah 5
File `backup-pospro-event-YYYY-MM-DD.zip` akan ter-download ke komputer Anda.

```
Contoh nama file:
  backup-pospro-event-2026-04-27.zip
  └────────────────────────────────┘
        artinya: backup tanggal 27 April 2026
```

### Langkah 6 — PENTING!
**Pindahkan file ZIP** ke tempat aman:
- 💾 Flashdisk / hard disk eksternal
- ☁️ Google Drive / Dropbox / OneDrive
- 📧 Email ke diri sendiri (lampiran)

> **Jangan simpan file ZIP cuma di laptop yang sama**! Kalau laptop rusak, ZIP-nya juga ikut hilang. Selalu **simpan minimal 2 tempat**.

## Cara Restore (Kembalikan dari Backup)

Restore dipakai saat:
- Ganti komputer / pindah server
- Data hilang karena error
- Mau coba di komputer lain (testing)

### Langkah 1
Buka **Pengaturan → Backup & Restore** → tab **"Restore / Import"**.

### Langkah 2
Klik **"Pilih File ZIP"** → pilih file backup ZIP yang Anda punya.

### Langkah 3
Pilih mode:

| Mode | Kapan Dipakai |
|---|---|
| **Skip Duplicate** ✅ (default, paling aman) | Data lama yang sudah ada **tidak ditimpa**. Hanya isi data baru yang belum ada |
| **Overwrite** ⚠️ | Data lama **diganti** dengan data dari backup. Pakai hanya kalau yakin mau timpa total |

### Langkah 4
Klik **"Restore"** → konfirmasi → tunggu sampai selesai.

### Langkah 5
Halaman akan tampilkan ringkasan: berapa baris berhasil di-import, berapa di-skip, dll.

> **Catatan**: Restore akan butuh **beberapa menit** kalau data banyak. Jangan tutup browser/refresh sampai selesai.

## Penjelasan Versi Backup

Setiap file backup punya **versi** yang menunjukkan struktur datanya:

| Versi | Tanggal Rilis | Perubahan |
|---|---|---|
| 2.0 | 2026 awal | Versi awal Pospro Event |
| 2.1 | 2026 awal | Tambah CRM Pipeline |
| 2.2 | 2026 Q1 | Tambah RAB Loose Items |
| 2.3 | 2026 April | Tambah link Cashflow ke Event/RAB |
| 2.4 | 2026 April | Tambah CrewTeam + EventCrewAssignment |
| 2.5 | 2026 April | Tambah BrandSettings, QuotationVariantConfig, InventoryAcquisition |
| **2.6** ⭐ | **2026 April** | **Field-level additions: Worker.fullName, ProductVariant.description/notes/defaultWarehouseId, RabPlan.tags, Lead.assignedWorkerId** |

### 🆕 Apa Saja yang Otomatis Ter-backup di v2.6?

Selain semua tabel di grup yang kelihatan, **field-level baru** ini juga ikut backup tanpa perlu setting tambahan:

- **Worker.fullName** — nama lengkap karyawan (selain nama panggilan)
- **ProductVariant.description** — keterangan/spesifikasi varian
- **ProductVariant.notes** — catatan internal varian
- **ProductVariant.defaultWarehouseId** — gudang lokasi utama varian
- **RabPlan.tags** — multi-tag JSON ("Stand Standar 3x3", "Indoor", dll)
- **Lead.assignedWorkerId** — marketing yang menghandle lead

### ⚠️ Bisa Restore Versi Lama?

- ✅ Restore backup **2.0–2.5** ke aplikasi 2.6 → **OK**, field baru jadi `null` di data lama (default Prisma)
- ❌ Restore backup **2.6** ke aplikasi versi lama → **TIDAK BISA**, tabel/field baru tidak dikenali

**Saran**: Setelah upgrade aplikasi, **buat backup baru** secepatnya supaya selalu pakai format terbaru.

## Best Practice — Jadwal Backup

Pakai aturan **3-2-1**:
- **3 copy** data (1 di komputer + 2 di tempat lain)
- **2 jenis penyimpanan** berbeda (mis. flashdisk + cloud)
- **1 copy off-site** (di luar kantor — mis. Google Drive)

### Jadwal Disarankan:

| Frekuensi | Aktivitas |
|---|---|
| **Setiap Senin pagi** | Download backup ZIP → simpan ke flashdisk + Google Drive |
| **Sebelum update aplikasi** | Wajib backup dulu sebelum klik update |
| **Sebelum acara besar (event)** | Backup biar pas-pasan saat sibuk tidak khawatir |
| **Setelah input besar** (mis. import 500 lead) | Backup supaya tidak mubazir kalau ada gangguan |

## Auto-Backup ke Cloud (Opsional)

Kalau Anda mau **otomatis** (tanpa harus klik manual tiap minggu), bisa setup auto-backup pakai **Rclone** ke Google Drive/Dropbox/dll. Detail cara setup di [Panduan Deployment](./deployment.md).

## Apa yang TIDAK Termasuk Backup?

- ❌ **File foto upload** (foto produk, foto check-in crew, foto proof) — disimpan terpisah di folder `public/uploads/`. Kalau pindah server, **manually copy folder tersebut juga**.
- ❌ **Konfigurasi WhatsApp Bot** — sesi WA login, perlu re-login di server baru.
- ❌ **File PDF/DOCX hasil export** — itu cuma file output, bukan data master.

**Saran**: untuk backup foto upload, pakai **Rclone** atau **rsync** untuk sync folder `public/uploads/` ke cloud secara terpisah.

## Troubleshooting

### "File ZIP corrupt" saat upload
- Coba download ulang file backup → mungkin saat transfer rusak
- Pastikan tidak buka/extract ZIP-nya dulu sebelum upload (biarkan tetap ZIP)

### Restore stuck / lama
- Data banyak butuh waktu — buka tab terminal/network di browser lihat progress
- Jangan refresh page sampai notif sukses muncul

### "FK constraint failed"
- Pakai mode **Overwrite** (mungkin ada data lama yang konflik)
- Atau hapus data manual dulu yang konflik, baru restore mode Skip Duplicate

### Setelah restore, foto produk tidak muncul
- File foto disimpan terpisah dari database — perlu copy folder `public/uploads/` juga
- Lihat penjelasan di section "Apa yang TIDAK Termasuk Backup?"

### Backup file terlalu besar
- File ZIP biasanya 5-50 MB tergantung jumlah data
- Kalau > 200 MB, mungkin ada banyak transaksi POS → wajar untuk usaha aktif

## Lihat Juga

- [Panduan Deployment](./deployment.md) — setup auto-backup via Rclone
- [Alur Bisnis Event](./alur-bisnis.md) — gambaran besar Pospro Event


---

**© 2026 Muhammad Faishal Abdul Hakim · Pospro Event · All rights reserved.**
[Lihat lisensi lengkap →](./license)
