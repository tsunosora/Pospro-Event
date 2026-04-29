# 🔁 Convert Lead → Customer (+ Penawaran / RAB)

Saat lead deal, tombol **Convert ke Customer** akan unlock di drawer lead. Satu klik bikin tiga hal sekaligus.

## Prasyarat

- Lead harus berada di stage dengan `isWinStage = true` (default: **Closed Deal**).
- Atur stage win lain via **`/crm/stages`** jika perlu (mis. tambahkan stage "Booked" sebagai win stage).

## Flow

1. Buka card lead di **`/crm/board`** → drawer terbuka.
2. Drag lead ke kolom **Closed Deal** (atau win stage lain).
3. Tab **Convert** di drawer aktif → form muncul:

   ```
   ┌──────────────────────────────────────┐
   │ Convert ke Customer                  │
   │                                      │
   │ Nama Customer: [Ivan – PT. JAPURA]   │
   │ Phone:        [62877xxxx]            │
   │ Organization: [PT. JAPURA]           │
   │                                      │
   │ ☑ Sekalian buat draft Penawaran      │
   │   Variant: ( ) SEWA                  │
   │            (•) PENGADAAN_BOOTH       │
   │                                      │
   │ ☐ Sekalian buat draft RAB Event      │
   │                                      │
   │           [Cancel]  [Convert →]      │
   └──────────────────────────────────────┘
   ```

4. Klik **Convert** → endpoint `POST /crm/leads/:id/convert` dipanggil dalam 1 transaksi:
   - Buat `Customer` baru, link `Lead.convertedCustomerId`
   - Set `Lead.convertedAt = now()`
   - Log activity `CONVERTED`
   - Jika `createQuotation` → buat draft `Invoice` (variant SEWA / PENGADAAN_BOOTH) ter-link ke `customerId` & `leadId`
   - Jika `createRab` → buat draft `RabPlan` ter-link ke `customerId` & `leadId`

## Setelah Convert

Drawer lead berubah — tab Convert sekarang menampilkan **shortcut** ke entitas yang baru dibuat:

- 🔗 [Buka Penawaran](/penawaran-event)
- 🔗 [Buka RAB Event](/rab-event)
- 🔗 Buka detail Customer

Lead **tetap ada** di kanban (di kolom Closed Deal) — tidak dihapus, supaya history terjaga.

## Re-Convert

Jika perlu unlink (mis. salah convert), edit `Lead.convertedCustomerId = null` & `convertedAt = null` via Prisma Studio. Jangan hapus Customer-nya — entitas downstream (Invoice/RAB) akan FK-error.

## Lihat Juga

- [Penawaran Booth/Event](/penawaran-event)
- [RAB Event](/rab-event)


---

**© 2026 Muhammad Faishal Abdul Hakim · Pospro Event · All rights reserved.**
[Lihat lisensi lengkap →](./license)
