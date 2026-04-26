# 👶 Panduan Pemula — Pertama Kali Pakai

> **Halaman ini ngobrol pelan-pelan** seperti menjelaskan ke orang yang baru pertama kali pegang aplikasi. Kalau Anda owner yang nggak terlalu tech-savvy, atau staff baru yang lagi training, **mulai dari sini**.

## ⏱️ Berapa Lama?

- **Buka tutorial ini**: ±20 menit baca santai
- **Setup awal pertama kali**: ±1 jam (sekali saja)
- **Setelah itu**: pakai harian seperti biasa, 5-10 menit per task

## 🤔 Sebelum Mulai

Pastikan Anda sudah punya:
- ✅ Aplikasi Pospro Event sudah di-install (kalau belum, minta tim teknis pasang dulu)
- ✅ **Email & password admin** — biasanya `admin@pospro.id` / `admin123`
- ✅ Browser modern (Chrome, Edge, Firefox — yang penting bukan IE)
- ✅ Komputer/laptop dengan koneksi ke server aplikasi

---

## Langkah 1: Login Pertama Kali

### Buka Browser
Ketik alamat aplikasi di browser:
- Kalau di laptop sendiri: `http://localhost:3000`
- Kalau di kantor: tanya tim IT alamatnya (mis. `http://192.168.1.10:3000`)
- Kalau publik: `https://pospro.domain-anda.com`

### Halaman Login Muncul
```
┌─────────────────────┐
│   Pospro Event     │
│                     │
│   Email:            │
│   [_______________] │
│                     │
│   Password:         │
│   [_______________] │
│                     │
│      [ Login ]      │
└─────────────────────┘
```

### Isi Email & Password
- **Email**: `admin@pospro.id` (default)
- **Password**: `admin123` (default)

Klik **Login**.

### ⚠️ WAJIB: Ganti Password!
Begitu masuk, langsung:
1. Klik nama Anda di pojok kanan atas → **Profile**
2. Ganti password ke yang **kuat dan unik** (minimal 8 karakter, kombinasi huruf+angka)
3. Save.

> Jangan pakai `admin123` setelah login pertama. Itu password default yang **semua orang tahu**.

---

## Langkah 2: Atur Profil Toko

Klik **Pengaturan** (gear icon di pojok kiri bawah, di bawah sidebar).

### Isi Info Dasar:
- **Nama Toko / Brand**: misal "Pospro Event by Muhammad Faishal"
- **Alamat lengkap**
- **Nomor HP / Telepon**
- **Email**
- **Logo** — upload gambar logo (PNG/JPG, max 2 MB)

Klik **Save**. Sekarang nama dan logo Anda muncul di header sidebar.

---

## Langkah 3: Daftarkan Tim (Worker / Crew)

Daftarkan **semua orang yang kerja di tim Anda**. Worker dipakai sebagai PIC sales, operator produksi, crew lapangan, dll.

### Cara:
1. Buka **Pengaturan → Workers** (atau menu yang tersedia)
2. Klik **+ Tambah Worker**
3. Isi: Nama, Posisi (mis. "Senior Setter"), Phone, Photo (opsional)
4. **Save**

Ulangi untuk setiap orang. Mulai dari:
- Sales (yang handle lead WA)
- Owner / Manager
- Crew workshop (yang bikin booth di workshop)
- Crew lapangan (yang setting booth di event)
- Designer (kalau ada lini printing)

---

## Langkah 4: Setup Team Crew (Untuk Crew Lapangan)

Kalau Anda punya 2+ team yang dipisah (mis. **Team Kepuh** & **Team Sawah**), daftarkan di sini.

### Cara:
1. Sidebar → **Master Team Crew** (`/settings/crew-teams`)
2. Klik **+ Team Baru**
3. Isi:
   - **Nama**: "Team Kepuh"
   - **Leader**: pilih worker yang menghandle (mis. Pak Budi)
   - **Warna**: pilih warna identitas (mis. ungu)
   - **Catatan**: opsional, mis. "Wilayah Jakarta-Banten"
4. **Save**

Ulangi untuk team lain.

> Setelah setup ini, saat assign crew ke event, ada dropdown pilih team. Crew Anda dikelompokkan dengan rapi + leader contact langsung muncul di link WA mereka.

---

## Langkah 5: Daftarkan Supplier (Vendor Material)

Daftarkan vendor yang Anda biasa beli material — kayu, MDF, lighting, dll.

### Cara:
1. Sidebar → **Data Supplier**
2. Klik **+ Tambah Supplier**
3. Isi: Nama, Kategori (Kayu/Lighting/Transport/dll), PIC, Phone, Alamat, Kota
4. Save

### Kenapa Penting?
- Saat bikin RAB, harga material langsung ambil dari supplier termurah
- Filter supplier per kota — hemat ongkir saat event di luar kota
- Click-to-WA langsung ke PIC supplier

---

## Langkah 6: Daftarkan Bank Account

Sebelum terima pembayaran, daftarkan rekening Anda.

### Cara:
1. Sidebar → **Bank Accounts** (atau via Pengaturan)
2. Klik **+ Tambah Rekening**
3. Isi: Nama Bank, Nomor Rekening, Atas Nama, Active (✅)
4. **Save**

Daftarkan semua rekening yang Anda terima (BCA, Mandiri, BRI, dll).

---

## Langkah 7: Atur CRM (Lead Pipeline)

Pospro Event sudah pre-set 6 stage default + 4 label. Cek dulu sesuai apa.

### Cek Stages:
1. Sidebar → **CRM — Stages**
2. Lihat list: Lead Masuk · Follow Up · Penawaran · Negosiasi · Closed Deal · Lost
3. Kalau mau tambah custom (mis. "Booked"), klik **+ Tambah Stage**

### Cek Labels:
1. Sidebar → **CRM — Labels**
2. Default: Hot 🔴 · Warm 🟡 · Cold 🔵 · Tidak Merespon ⚫
3. Tambah custom kalau perlu (mis. "Booth F&B", "Pameran 2026")

---

## Langkah 8: Backup Pertama Anda

Setelah setup di atas selesai, **wajib backup**! Selalu mulai dengan kondisi setup awal.

### Cara:
1. Sidebar → **Pengaturan → Backup & Restore**
2. Tab **Backup / Export**
3. Centang semua paket data
4. Klik **Download Backup ZIP**
5. **Simpan ZIP di**:
   - Flashdisk
   - Google Drive / Dropbox
   - **JANGAN cuma di laptop yang sama**!

> Detail lengkap: [Backup & Restore](./backup.md)

---

## Sekarang Anda Siap! 🎉

Setup awal selesai. Sekarang Anda bisa:

### Skenario 1: Lead WA Masuk
1. Sidebar → **CRM — Pipeline**
2. Klik **+ Add Lead** → input nama + nomor HP
3. Card muncul di kolom "Lead Masuk"
4. Klik card → drawer detail → tombol **WA hijau** → buka chat
5. Setelah chat → drag card ke "Follow Up"

### Skenario 2: Klien Minta Penawaran
1. Sidebar → **Penawaran Booth/Event**
2. Klik **+ Buat Penawaran** → pilih variant (SEWA / PENGADAAN_BOOTH)
3. Isi info klien, project name, items
4. Save → **Assign Nomor** → **Export PDF**
5. Kirim PDF ke klien via WA/Email

### Skenario 3: Hitung RAB Project
1. Sidebar → **RAB (Anggaran Proyek)**
2. **+ Buat RAB**
3. Isi item per kategori (Material, Jasa, Transport, Akomodasi)
4. Per item: input harga jual + harga modal → margin kelihatan otomatis
5. Tab **Summary** → lihat total margin sehat atau tidak

### Skenario 4: Crew Berangkat Setting
1. Buka detail event → tab **Crew**
2. **+ Assign Crew** → pilih worker, team, role, jadwal
3. Klik tombol **💬 WA** → buka WA dengan template + link unik
4. Crew terima link → tap **Check-in** saat tiba di lokasi
5. Selesai → tap **Check-out** → durasi setup terhitung

### Skenario 5: Lihat Laba Project
1. Sidebar → **Laba per Project** (`/reports/event-profit`)
2. Filter periode (Bulan Ini / 3 Bulan / dll)
3. Lihat ranking event by profit
4. Klik row → buka detail event

---

## ❓ FAQ Pemula

### Saya lupa password admin, gimana?
Tanya tim IT — mereka bisa reset via database direct atau script.

### Aplikasi tiba-tiba refresh sendiri?
Token login sudah kadaluarsa. Login ulang. Kalau sering, tanya tim IT cek setting `JWT_SECRET` di server.

### Saya klik "Hapus" salah orang/event/lead — bisa undo nggak?
**Tidak bisa undo otomatis**. Tapi kalau Anda **rajin backup**, bisa restore dari backup terakhir → datanya kembali. Itulah kenapa **backup wajib rutin**.

### Foto crew check-in nggak masuk
- Pastikan crew kasih izin akses kamera di HP
- Foto opsional — kalau gagal upload, check-in tetap tercatat (cuma nggak ada foto)

### Bisa pakai dari HP nggak?
- ✅ Aplikasi mobile-friendly — bisa buka di HP
- ✅ Crew check-in via link WA memang dirancang untuk HP
- ⚠️ Tapi untuk input data berat (RAB, Penawaran), enak di laptop

### Data saya bisa dilihat orang lain di internet?
- Kalau install di komputer pribadi (localhost) → cuma Anda
- Kalau install di kantor LAN → orang di WiFi sama bisa akses (tergantung password)
- Kalau install di VPS publik → akses internet, **wajib HTTPS + password kuat**

### Saya mau ada banyak akun (sales beda akun, owner beda akun)
Bisa! Buka **Pengaturan → Users** → tambah user baru dengan role berbeda (admin/staff/cashier). Detail di docs.

### Aplikasi tiba-tiba lambat
- Cek koneksi internet
- Restart browser
- Kalau persisten, tanya tim IT cek server (mungkin perlu restart, atau database penuh)

---

## 📞 Butuh Bantuan?

- 📖 **Tutorial lebih detail**: lihat docs lain di [Wiki Daftar Isi](./README.md)
- 💬 **Pertanyaan teknis**: email muhamadfaisal288@gmail.com

## ✅ Checklist Setup Awal

Sudah selesai semua? Centang ini:

- [ ] Login pertama kali pakai default
- [ ] Ganti password admin
- [ ] Setup profil toko (nama + logo)
- [ ] Daftarkan minimal 3 worker (sales, owner, crew)
- [ ] Bikin minimal 1 Team Crew (mis. Team Kepuh)
- [ ] Daftarkan minimal 1 supplier
- [ ] Daftarkan minimal 1 bank account
- [ ] Cek CRM stages (default sudah ada)
- [ ] **Backup pertama → simpan di Google Drive/flashdisk**

Sudah semua? 🎉 **Selamat!** Anda siap pakai Pospro Event harian.

## 🎓 Lanjut Belajar

- [Alur Bisnis Event](./alur-bisnis.md) — gambaran besar end-to-end
- [CRM Pipeline](./crm-kanban.md) — kelola lead WhatsApp
- [Event Timeline](./event-timeline.md) — schedule semua event
- [Crew Tracking](./crew-tracking.md) — track crew di lapangan
- [Backup & Restore](./backup.md) — wajib baca!
