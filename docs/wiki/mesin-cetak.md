# 🖨️ Antrian Cetak Paper — Pospro Event

Sub-queue khusus untuk material **paper-based**: banner vinyl, X-banner, poster, brochure, sticker. Terpisah dari [Antrian Produksi](./produksi.md) booth karena alur kerjanya beda — pakai mesin cetak digital.

## Akses

Menu: **Operasional → Mesin Cetak** (`/mesin-cetak`).

## Konsep

```
Order Paper ──► Antrian Cetak ──► Operator mesin ──► Cetak ──► QC ──► Selesai
                                  (klaim batch)
```

## Tracking Mesin

Per mesin cetak, sistem track:

- **Klik meter** — counter total klik (sinkron dgn meteran fisik mesin)
- **Tinta level** — kosong/penuh per warna (manual update)
- **Maintenance log** — service terakhir, ganti drum, dll
- **Operator aktif** — siapa yang lagi pakai mesin

## Field Job Cetak

| Field | Catatan |
|---|---|
| `customerId` / `rabPlanId` | Link ke project / event |
| `material` | Vinyl frontlite, photopaper, X-banner stand, dll |
| `width × height` | Auto-hitung m² |
| `qty` | Jumlah cetak |
| `priority` | NORMAL / RUSH (event H-1) |
| `dueDate` | Deadline kirim |
| `status` | QUEUED → PRINTING → QC → DONE |

## Halaman

| URL | Fungsi |
|---|---|
| `/mesin-cetak` | Dashboard antrian + status semua mesin |
| `/mesin-cetak/queue` | Queue view operator |
| `/mesin-cetak/machines` | Master mesin (klik meter, tinta, maintenance) |

## Best Practice

- 🚦 Mark job **RUSH** untuk H-1 event — auto-prioritas di queue.
- 🖋️ Update klik meter mesin **tiap pagi** — kontrol biaya tinta per klik.
- 🔧 Schedule maintenance setiap 10.000 klik — jangan tunggu sampai rusak.

## Lihat Juga

- [Antrian Produksi Booth](./produksi.md)
- [Stok Opname](./stock-opname.md) — material paper masuk inventory
