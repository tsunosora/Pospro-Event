# 📅 Event Timeline (Gantt View)

Halaman **Event Timeline** (`/events/timeline`) adalah Gantt-style command center untuk vendor booth/event yang menjalankan banyak project paralel. Lihat semua phase (Departure → Setup → Event → Dismantle) dari semua event aktif dalam satu layar.

## Konsep

```
                      April 2026
        S M T W T F S S M T W T F S
Event A     ▓▓▓░░░
Event B           ▓▓▓░░░
Event C                  ▓▓▓░░░
Event D                        ▓▓▓
                  ▲ today
```

- **Sumbu X**: hari dalam periode (zoom Hari/Minggu/Kuartal)
- **Sumbu Y**: 1 row per event
- **Bar warna**: phase event di hari itu

## Akses

Menu: **Operasional → Event Timeline** (`/events/timeline`)

## Phase & Warna

| Warna | Phase | Sumber Data |
|---|---|---|
| ⚪ Abu-abu | Departure (logistik berangkat) | `departureStart..departureEnd` |
| 🔴 Merah | Setup (build booth di lokasi) | `setupStart..setupEnd` |
| 🟡 Kuning | Event Day (event berjalan) | `eventStart..eventEnd` |
| 🔵 Biru | Dismantle (bongkar + load-out) | `loadingStart..loadingEnd` |

> **Bar pudar** = sudah lewat hari ini · **Bar penuh** = on-going atau future

## Fitur Lengkap

### 🔍 Filter & Search

- **Search box** — cari nama event / client / PIC / venue. Match → row di-highlight kuning (bukan filter, tetap kelihatan kontekstual).
- **All Clients / All Teams / All Locations** — dropdown filter, otomatis ter-isi dari data event di periode aktif.
- **Reset** — bersihkan semua filter.

### 📊 Stat Cards

5 angka summary di atas grid:

- **Total Events** — jumlah event di periode
- **Setup Days** — total hari setup (merah)
- **Event Days** — total hari event berjalan (kuning)
- **Dismantle Days** — total hari bongkar (biru)
- **Active Teams** — jumlah PIC unik yang ditugaskan

### 🔭 Zoom Level

Toggle 3 mode di header:

| Mode | Range | Cell Width | Use Case |
|---|---|---|---|
| **Hari** | 1 bulan | 28 px | Operasional harian, plan minggu |
| **Minggu** | 12 minggu (3 bulan) | 12 px | Plan kuartal |
| **Kuartal** | 3 bulan | 9 px | Overview tahunan |

### 📦 Group By

Dropdown "Group" di filter row — kelompokkan event per:
- **Client** (PT. JAPURA, ISHIDA, dll)
- **PIC** (Sendy, Ivan, dll)
- **Brand** (EXINDO, XPOSER, OTHER)
- **Venue** (JIExpo, ICE BSD, dll)

Tiap group muncul dengan header bertanda ▾ + jumlah event.

### 🎨 Color Mode

Toggle "Color" — switch antara:
- **Phase color** — warna sesuai phase (default, untuk operasional)
- **Brand color** — warna sesuai brand event (Exindo indigo, Xposer pink) — bagus untuk presentasi ke owner

### ⚠️ Conflict Detection (PIC bentrok)

Saat PIC yang sama dijadwalkan di 2+ event yang phase-nya overlap, cell kena **ring kuning** + tooltip warning "⚠️ KONFLIK PIC". Visual instan kalau ada bentrokan jadwal.

### 📈 Capacity Histogram

Row "**Load**" di header (sticky, di bawah header tanggal) — bar vertikal per hari menampilkan berapa banyak event aktif:

- 🟢 Hijau (≤ 2 event)
- 🟡 Kuning (3–4 event)
- 🔴 Merah (5+ event)

Hover bar → tooltip "X event aktif". Identifikasi minggu paling sibuk yang butuh crew tambahan.

### 🏷️ Per-Row Detail

Setiap row event menampilkan:

- **Brand strip** vertikal kiri (indigo/pink/abu)
- **Status badge** (Draft / Terjadwal / Berlangsung / Selesai / Batal)
- **📦 Withdrawal count** — jumlah pinjaman barang dari gudang
- **RAB margin chip** — persen margin (hijau ≥30%, kuning 15–30%, merah <15%) dengan tooltip detail Total Jual / Modal

### 💡 Hover Tooltip Bar

Hover bar warna → tooltip multi-line:
```
Setup: PETFEST
📅 28 April 2026
🏢 Pasific Harvest
👤 Ivan
📍 ICE BSD
⚠️ KONFLIK PIC (jika ada)
```

### 🖱️ Klik Bar → Quick Actions

Klik bar → modal kecil dengan info phase + 4 tombol:

- **Buka Detail** → `/events/[id]`
- **Packing List** → tab packing di detail event
- **Pinjaman** → halaman peminjaman dengan filter event
- **Buka RAB** → halaman RAB plan (kalau ter-link)

### ✏️ Edit Mode (Drag-Drop Resize)

Tombol **Edit** di header (jadi kuning saat ON):

1. Klik **Edit** → bar dapat handle kanan putih (cursor `ew-resize`).
2. Drag handle → preview real-time (bar memanjang/memendek).
3. Lepas mouse → tanggal selesai phase otomatis ter-update via `PATCH /events/:id`.
4. Mode klik (modal) dinonaktifkan saat Edit ON — supaya tidak bentrok.

Field yang ter-update:
- Departure → `departureEnd`
- Setup → `setupEnd`
- Event → `eventEnd`
- Dismantle → `loadingEnd`

> Validasi: end tidak boleh < start. Drag yang invalid akan di-skip.

### 🎯 Today Indicator

- Kolom hari ini di-highlight **biru muda** di seluruh tinggi grid.
- **Garis vertikal biru** tipis melintasi semua row → visual anchor.

### ◀ ▶ Multi-Month Continuation

Saat zoom Minggu/Kuartal: event yang dimulai sebelum range / berakhir setelah range akan menampilkan **panah ◀ / ▶** di ujung bar — penanda bahwa event ini punya continuation.

### 🚀 Tools

| Tombol | Fungsi |
|---|---|
| **Print** | Cetak A3 landscape (`@page` CSS auto-applied), header & filter ter-sembunyi |
| **.ics** | Export ke iCal — bisa import ke Google Calendar / Outlook (per phase jadi 1 entry) |
| **Copy WA** | Generate text ringkasan formatted untuk paste ke grup WhatsApp |

### ⌨️ Keyboard Shortcuts

| Key | Aksi |
|---|---|
| `←` / `→` | Navigasi periode (mundur/maju) |
| `T` | Lompat ke bulan berjalan |
| `1` | Zoom Hari |
| `2` | Zoom Minggu |
| `3` | Zoom Kuartal |
| `Esc` | Tutup modal quick action |

### 🎚️ Departure Toggle

Checkbox "Departure lane" — toggle visibility bar abu-abu departure. Default ON. Matikan kalau cuma fokus ke phase utama (setup/event/dismantle).

## Use Case

### 1. Plan Minggu Depan (Sales/PIC)

1. Buka `/events/timeline`, mode Hari.
2. Filter PIC = nama Anda.
3. Lihat phase apa yang mulai minggu depan.
4. Klik tombol bar → buka detail event → cek packing list & material.

### 2. Cari Bentrokan Sebelum Assign (Owner)

1. Buka timeline mode Minggu (zoom 2).
2. Group by PIC.
3. Lihat row PIC yang ada **ring kuning** → konflik!
4. Pindahkan salah satu event ke PIC lain via detail event.

### 3. Briefing Mingguan ke Crew

1. Filter periode minggu ini.
2. Klik **Copy WA** → text ringkasan ter-copy ke clipboard.
3. Paste ke grup WhatsApp crew → semua tahu jadwal mingguan.

### 4. Review Profitabilitas Bulan (Owner)

1. Mode Hari, bulan target.
2. Lihat **RAB margin chip** per event:
   - Banyak hijau → bulan sehat ✅
   - Banyak merah → re-evaluate pricing 🔴
3. Klik margin chip / tombol "Buka RAB" untuk drill-down.

### 5. Reschedule Event (Owner/PIC)

1. Klik **Edit** di header.
2. Drag handle kanan bar Setup mundur 1 hari → setupEnd ter-update otomatis.
3. Klik **Edit** lagi untuk lock perubahan.

### 6. Sync ke Calendar Pribadi

1. Klik **.ics** → file `event-timeline-April-2026.ics` ter-download.
2. Drag file ke Google Calendar / Outlook → semua phase masuk sebagai event terpisah.

## Best Practice

- 🔄 **Cek conflict tiap pagi** — biasakan buka timeline jam 8 sebelum assign tugas baru.
- 📅 **Update tanggal segera** kalau ada perubahan client — pakai Edit Mode supaya cepat.
- 🎨 **Gunakan Color: Brand** saat presentasi ke owner — beda brand keliatan jelas.
- 🟢 **Target margin RAB minimal 25%** — kalau chip merah/kuning, review dulu sebelum approve event.
- 📞 **Forward Copy WA** ke grup PIC lapangan setiap Senin pagi — sinkronisasi tim.

## Lihat Juga

- [RAB Event](/rab-event) — sumber RAB margin chip
- [Peminjaman Stok (Foto)](/peminjaman-stok) — sumber count 📦 di card event
- [Antrian Produksi](/produksi) — eksekusi setelah phase Setup
