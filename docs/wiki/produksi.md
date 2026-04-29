# 🖨️ Antrian Produksi Booth — Pospro Event

Modul **Antrian Produksi** mengatur job queue produksi booth & material event. Setiap RAB yang sudah APPROVED bisa diturunkan jadi Job Produksi, lalu dikerjakan operator workshop secara terurut & ter-track.

## Akses

Menu: **Operasional → Produksi** (`/produksi`).

## Konsep

```
RAB APPROVED ──► Buat Produksi Job ──► Tahap-tahap ──► Operator klaim ──► Selesai
                  (link RabPlan)         (cutting,     (PIN login,
                                          finishing,    update status
                                          packing,      real-time)
                                          kirim)
```

Setiap **ProduksiJob** punya:
- `name` — nama project (auto dari RAB.name, bisa override)
- `eventDate` — deadline event
- `rabPlanId` — link RAB sumber
- `status` — QUEUED / IN_PROGRESS / COMPLETED / CANCELLED
- `tahap[]` — list tahap produksi

## Tahap Default

Pre-set tahap untuk produksi booth:

1. **Cutting** — potong material sesuai ukuran (pakai BOM dari Product)
2. **Finishing** — cat duco, laminasi, finishing wood
3. **Assembly** — rakit booth (jika modular)
4. **Packing** — bungkus + label
5. **Loading & Kirim** — naik kendaraan, kirim ke lokasi event

Bisa custom per project — tambah tahap "QC", "Setup di Lokasi", dll.

## Halaman

| URL | Fungsi |
|---|---|
| `/produksi` | Dashboard — list job aktif by status |
| `/produksi/queue` | Queue view — operator pilih job berikutnya |
| `/produksi/[id]` | Detail job + timeline tahap |
| `/produksi/operator` | Login operator (PIN) — view khusus |

## Login Operator (PIN)

Operator workshop **tidak perlu akun email/password**. Cukup PIN 4-digit di tablet workshop:

```
┌──────────────────┐
│  Pospro Event    │
│  Workshop View   │
│                  │
│  PIN: ●●●●       │
│       [ Masuk ]  │
└──────────────────┘
```

Setelah login → tampil daftar tahap yang siap dikerjakan, sort by deadline event.

## Flow Operator

1. Buka `/produksi/operator` di tablet workshop → input PIN.
2. Lihat daftar tahap **Available** (belum di-claim).
3. Klik **Claim** → tahap berubah status `IN_PROGRESS` + log `workerId` + `startedAt`.
4. Mulai kerja. Tablet tampilkan timer.
5. Selesai → klik **Done** → status `COMPLETED` + `finishedAt`.
6. (Opsional) Upload foto bukti kerja.
7. BOM auto-potong stok material saat tahap `IN_PROGRESS`.

## BOM Auto-Reduce Stok

Setiap **Product** (material booth) punya BOM (Bill of Materials):

```
Booth 3x3 Custom (1 unit)
├── Plywood 18mm     × 8 lembar
├── MDF 12mm         × 4 lembar
├── Cat Duco Putih   × 2 kaleng
├── Lighting Strip   × 6 m
└── Engsel           × 12 pcs
```

Saat tahap **Cutting** dimulai (1 unit Booth 3x3), sistem otomatis:
```
StockMovement: -8 lembar Plywood 18mm  (referensi: ProduksiJob#42)
StockMovement: -4 lembar MDF 12mm
... dst
```

Stok di-track real-time, masuk laporan `/laporan-stok`.

## Batch Cetak (Paper)

Untuk material paper (banner, poster, X-banner) yang sering dicetak per batch — pakai modul terpisah [Mesin Cetak Paper](./mesin-cetak.md).

## Best Practice

- 🗓️ **Buat Job segera setelah RAB APPROVED** — jangan tunggu sampai mendekati deadline.
- 👷 **PIN unik per operator** — supaya jejak siapa kerjakan apa terlihat.
- 📸 **Wajibkan foto bukti** untuk tahap penting (Finishing, Loading) — meminimalkan dispute kualitas.
- ⏱️ **Review timer rata-rata** per tahap → input ke kalkulasi RAB project berikut (jasa/man-hour cost).

## Lihat Juga

- [RAB Event](./rab-event.md) — sumber Job Produksi
- [Mesin Cetak Paper](./mesin-cetak.md) — sub-queue untuk material paper
- [Laporan Stok](./laporan-stok.md) — efek BOM ke inventori


---

**© 2026 Muhammad Faishal Abdul Hakim · Pospro Event · All rights reserved.**
[Lihat lisensi lengkap →](./license)
