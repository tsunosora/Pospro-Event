# 👷 Setup Time Tracking per Crew

Modul **Crew Tracking** memungkinkan admin meng-assign crew lapangan ke event, dikelompokkan per **Team** (mis. Team Kepuh, Team Sawah) dengan **leader** masing-masing. Crew tinggal **klik link unik** dari WA untuk **Check-in** (saat tiba di lokasi) dan **Check-out** (saat selesai). Foto opsional, no-login, otomatis hitung durasi setup.

## 👥 Team Crew (Master)

Atur master team di **`/settings/crew-teams`** atau dari sidebar **Master Team Crew**.

| Field | Catatan |
|---|---|
| **Nama** | Unique. Contoh: "Team Kepuh", "Team Sawah" |
| **Leader** | Worker yang menghandle team (FK Worker). Phone leader muncul di link crew supaya crew lapangan bisa kontak langsung. |
| **Warna** | Identitas visual — muncul di group header CrewTab, kolom Team di laporan, leaderboard team |
| **Catatan** | Wilayah operasional / spesialisasi |
| **Active/Inactive** | Soft-delete: team Inactive tidak muncul di dropdown assign baru tapi history tetap utuh |

> **Setup awal**: Buat 2 team default sesuai tim Anda (Kepuh & Sawah), set leader masing-masing, kasih warna beda. Selesai sekali untuk seterusnya.

## Tujuan

- 📊 **Track durasi setup actual** per booth ukuran/tipe → input ke RAB project berikutnya (manhour cost lebih akurat).
- 🏆 **Ranking performa per crew DAN per team** — siapa paling cepat, team mana paling produktif.
- 📋 **Audit trail** — kalau ada dispute jadwal/lokasi, ada timestamp + foto bukti.
- 💸 **Basis komisi** — kalau ada bonus per project, hitung dari jam kerja real per crew.
- 🎯 **Leader management** — leader team langsung tahu siapa anggotanya di event tertentu, bisa koordinasi langsung via WA.

## Tujuan

- 📊 **Track durasi setup actual** per booth ukuran/tipe → input ke RAB project berikutnya (manhour cost lebih akurat).
- 🏆 **Ranking performa crew** — siapa paling cepat, siapa paling sering telat.
- 📋 **Audit trail** — kalau ada dispute jadwal/lokasi, ada timestamp + foto bukti.
- 💸 **Basis komisi** — kalau ada bonus per project, hitung dari jam kerja real.

## Akses

- **Admin (operasional)**: tab **Crew** di detail event (`/events/[id]` → Crew)
- **Admin (master)**: `/settings/crew-teams` — CRUD team
- **Admin (laporan)**: `/reports/crew` — leaderboard + detail durasi
- **Crew lapangan**: link unik dari WA `/public/crew/<token>` (no-login)

## Flow Lengkap

```
1. Admin buka /events/123 → tab Crew → Assign Crew
   - Pilih Worker (Sendy, Ivan, dll)
   - Pilih Team (Kepuh / Sawah / kosong = tanpa team)
   - Role: "Setter" / "Finisher" / "Loader" / "Driver"
   - Jadwal mulai-selesai (opsional)
                ↓
2. Sistem generate accessToken unik per assignment
                ↓
3. Klik tombol "💬 WA" → buka WhatsApp dengan template:
   "Halo Sendy, Tugas event: Setter
    Link check-in: https://app.../public/crew/abc123..."
                ↓
4. Crew terima link, buka di HP
   → Lihat detail event (nama, venue, jadwal)
                ↓
5. Tap [ Mulai Tugas (Check-in) ]
   - Foto opsional (tap kamera HP)
   - Catatan opsional (mis. "tiba on-time")
   - Submit → startedAt = now()
                ↓
6. Crew kerjakan tugas...
                ↓
7. Selesai → tap [ Selesai Tugas (Check-out) ]
   - Foto opsional bukti hasil kerja
   - Catatan opsional
   - Submit → finishedAt = now()
   - Sistem hitung durasi otomatis
                ↓
8. Status: ✅ Selesai. Durasi 4 jam 30 menit.
```

## Status Lifecycle

| Status | Indikator | Aksi Berikutnya |
|---|---|---|
| **ASSIGNED** | Belum check-in | Crew tap Check-in |
| **ON_SITE** | Sudah check-in, belum check-out | Crew tap Check-out saat selesai |
| **DONE** | Sudah check-out | Read-only, masuk laporan |

## Akses Crew (Public, No-Login)

Crew **tidak butuh akun atau PIN**. Cukup tap link `/public/crew/<token>` yang dikirim admin via WA.

```
┌──────────────────────────────────┐
│ 🟦 Pospro Event — Crew Check-in  │
│ Booth PT JAPURA — Surabaya       │
│ EVT-2026-042                     │
├──────────────────────────────────┤
│ 👤 Sendy                         │
│ Tugas: Setter                    │
├──────────────────────────────────┤
│ 📍 Hall A, JIExpo Kemayoran      │
│ Klien: PT JAPURA                 │
│ Jadwal: 28/04 08:00 → 28/04 14:00│
├──────────────────────────────────┤
│ 🕐 Check-in (Mulai Tugas)        │
│  📷 Foto (opsional): [Choose]    │
│  📝 Catatan: [_________________] │
│  [   Mulai Tugas (Check-in)   ] │
└──────────────────────────────────┘
```

Mobile-friendly. `<input type="file" capture="environment">` → langsung buka kamera HP saat tap "Choose".

## Halaman Admin (Tab Crew)

```
Crew Lapangan (5)                    [+ Assign Crew]

🟪 Team Kepuh   👑 Pak Budi · 0812-3456    3 crew
┌──────────────────────────────────────────────────┐
│ Sendy  [ON_SITE]  — Setter         [📋][💬][🔄][🗑] │
│ Jadwal: 28/04 08:00 → 28/04 14:00                │
│ ┌─────────────────────┬───────────────────────┐  │
│ │ 🕐 Check-in         │ ✓ Check-out           │  │
│ │ 28/04 08:15         │ Belum check-out       │  │
│ │ "tiba on-time"      │                       │  │
│ │ 📷 Lihat foto       │                       │  │
│ └─────────────────────┴───────────────────────┘  │
└──────────────────────────────────────────────────┘
[Sendy ...] [Ivan ...]

🟢 Team Sawah   👑 Pak Hadi · 0813-7890    2 crew
[Andi ...] [Joko ...]
┌──────────────────────────────────────────────────┐
│ Ivan   [DONE]     — Loader         [📋][💬][🔄][🗑] │
│ ┌─────────────────────┬───────────────────────┐  │
│ │ 🕐 Check-in         │ ✓ Check-out           │  │
│ │ 28/04 09:00         │ 28/04 13:30           │  │
│ │                     │ Durasi: 4j 30m        │  │
│ └─────────────────────┴───────────────────────┘  │
└──────────────────────────────────────────────────┘
```

Aksi per row:
- 📋 **Copy link** — salin URL public ke clipboard
- 💬 **Kirim WA** — buka WhatsApp dengan template otomatis (phone dari Worker.phone)
- 🔄 **Regenerate token** — invalidate link lama (kalau bocor / crew ganti)
- 🗑 **Hapus** — cancel assignment (kalau crew tidak jadi datang)

## Endpoint Backend

### Admin (JWT auth)

| Method | Path | Fungsi |
|---|---|---|
| GET | `/event-crew/by-event/:eventId` | List assignments per event (group by team) |
| GET | `/event-crew/report?eventId=X` | Report durasi: rows + byWorker + **byTeam** |
| POST | `/event-crew` | Assign crew baru (boleh kosongkan teamId) |
| PATCH | `/event-crew/:id` | Update teamId / role / jadwal |
| DELETE | `/event-crew/:id` | Hapus assignment |
| POST | `/event-crew/:id/regenerate-token` | Generate token baru |
| GET | `/crew-teams` | List master team |
| POST/PATCH/DELETE | `/crew-teams[/id]` | CRUD master team |

### Public (no auth, by token)

| Method | Path | Fungsi |
|---|---|---|
| GET | `/public/crew/:token` | Detail assignment + event |
| POST | `/public/crew/:token/check-in` | Multipart: photo (opsional) + note |
| POST | `/public/crew/:token/check-out` | Multipart: photo (opsional) + note |

## Schema

```prisma
model CrewTeam {
  id              Int      @id
  name            String   @unique  // "Kepuh", "Sawah"
  leaderWorkerId  Int?              // FK Worker — yang menghandle team
  color           String            // hex, identitas visual
  notes           String?
  isActive        Boolean
  ...
}

model EventCrewAssignment {
  id              Int       @id
  eventId         Int
  workerId        Int
  teamId          Int?      // FK CrewTeam (opsional)
  role            String?   // "Setter", "Finisher", "Loader", ...
  scheduledStart  DateTime?
  scheduledEnd    DateTime?
  startedAt       DateTime? // dari check-in
  finishedAt      DateTime? // dari check-out
  startPhotoUrl   String?   // upload opsional
  endPhotoUrl     String?   // upload opsional
  startNote       String?
  endNote         String?
  accessToken     String    // unik per assignment
  ...
  @@unique([eventId, workerId])
}
```

## Laporan

Endpoint `GET /event-crew/report` mengembalikan 3 agregasi:

```json
{
  "rows": [
    {
      "eventName": "Booth PT JAPURA - Surabaya",
      "workerName": "Sendy",
      "teamName": "Team Kepuh",
      "teamColor": "#6366f1",
      "role": "Setter",
      "startedAt": "2026-04-28T01:15:00Z",
      "finishedAt": "2026-04-28T05:45:00Z",
      "durationMinutes": 270
    },
    ...
  ],
  "byWorker": [
    { "workerName": "Sendy", "totalMinutes": 1840, "jobs": 5 },
    { "workerName": "Ivan",  "totalMinutes": 1620, "jobs": 4 },
    ...
  ],
  "byTeam": [
    { "teamName": "Team Kepuh", "teamColor": "#6366f1",
      "totalMinutes": 4520, "jobs": 12, "uniqueWorkers": 4 },
    { "teamName": "Team Sawah", "teamColor": "#10b981",
      "totalMinutes": 3680, "jobs": 9, "uniqueWorkers": 3 }
  ]
}
```

Halaman `/reports/crew` menampilkan:
- **Stat cards** atas: Total Tugas, Total Jam, Crew Aktif, Rata-rata
- **Team Leaderboard** baris atas (kalau ada team) — 3 metrik per team: total jam, jumlah tugas, unique crew
- **Crew Individual Leaderboard** kiri — top crew dengan medal 🥇🥈🥉
- **Detail table** kanan — kolom Event / Team / Crew / Role / Mulai / Selesai / Durasi
- **Export CSV** include kolom Team

## Use Case

### 1. Plan Setup Time untuk RAB Berikutnya

1. Owner buka report → lihat rata-rata setup booth 3×3 = 4 jam.
2. Bikin RAB project baru → kategori Jasa → input "Setter 4 jam × 2 orang".
3. Margin & timeline lebih realistis.

### 2. Ranking Performa Crew (Bonus / Komisi)

1. Akhir bulan: filter report periode bulan ini.
2. Sort `byWorker` by `totalMinutes` descending.
3. Top 3 crew dapet bonus / pengakuan.

### 3. Dispute Klien

> Klien: "Crew kalian terlambat, baru datang jam 10."

1. Buka detail event → tab Crew → cek `startedAt` Sendy = 08:15.
2. Lihat foto check-in (kalau di-upload) — ada timestamp & lokasi.
3. Tunjukkan bukti ke klien.

### 4. Audit Internal (Owner)

Crew yang **sering check-out tanpa check-in** atau **durasi tidak masuk akal** (mis. "30 menit untuk setup 3×3") → flag untuk review.

### 5. Koordinasi Leader Team

> Owner: "Hari ini Team Kepuh kerja di event mana saja?"

1. Owner buka `/reports/crew` → filter event hari ini.
2. Lihat row Team Kepuh di Team Leaderboard → 3 event aktif.
3. Klik nama event → buka detail → tab Crew → grup Team Kepuh terlihat: Sendy, Ivan, Andi.
4. Phone Pak Budi (leader) muncul di group header — tinggal klik untuk telpon.

### 6. Pembagian Komisi per Team

> Akhir bulan, Anda alokasikan bonus per project ke team yang ngerjain.

1. Buka report bulan ini → Team Leaderboard.
2. Team Kepuh: 75 jam, 12 tugas, 4 crew
3. Team Sawah: 62 jam, 9 tugas, 3 crew
4. Pembagian bonus by ratio jam atau by jumlah event closed.
5. Leader team distribute internal ke anggotanya.

## Best Practice

- 📞 **Selalu kirim link via WA**, bukan SMS — UX `wa.me/<phone>?text=` jauh lebih nyaman di HP.
- 📅 **Set scheduledStart/End** untuk semua assignment — jadi ada baseline pembanding actual time.
- 📸 **Encourage foto** walau opsional — sangat berguna untuk audit trail. Kasih instruksi "Foto di lokasi venue saat tiba & saat selesai".
- 🔄 **Regenerate token** kalau crew dikeluarkan dari project mid-way — link lama tidak akan bisa dipakai.
- 📊 **Review report mingguan** — input ke RAB / komisi.
- 🎯 **Naming role konsisten** — "Setter", "Finisher", "Loader", "Driver". Memudahkan filter laporan.

## Lihat Juga

- [Event Timeline (Gantt)](./event-timeline.md) — bisa ditambah kolom Crew nanti
- [Jadwal Event](./alur-bisnis.md) — Crew tab di detail event
- [Peminjaman Stok (Foto)](./peminjaman-stok.md) — pattern foto opsional yang sama
- [RAB Event](./rab-event.md) — input cost setter berdasarkan rata-rata setup time


---

**© 2026 Muhammad Faishal Abdul Hakim · Pospro Event · All rights reserved.**
[Lihat lisensi lengkap →](./license)
