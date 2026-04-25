# 💾 Backup & Restore Pospro Event

Panduan lengkap export data ke file ZIP & restore. Mencakup **semua tabel** termasuk modul CRM, Penawaran, RAB, Produksi, dan Master.

## Akses

Menu: **Pengaturan → Backup & Restore** (`/backup`).

## Group Tabel

Backup di-organisir per group fungsional. Saat export, pilih group yang mau di-include:

| Group | Tabel |
|---|---|
| **CRM / Pipeline Lead** | `leadStage`, `leadLabel`, `lead`, `leadLabelOnLead`, `leadActivity` |
| **Master Customer** | `customer`, `customerContact` |
| **Master Worker** | `worker`, `workerSession` |
| **Master Supplier** | `supplier` |
| **Master Produk & Stok** | `product`, `productVariant`, `productCategory`, `bomItem`, `stockMovement` |
| **Penawaran & Invoice** | `invoice`, `invoiceItem`, `quotation`, `quotationItem` |
| **RAB Event** | `rabPlan`, `rabItem`, `rabLooseItem`, `rabRealisasi` |
| **Produksi** | `produksiJob`, `produksiTahap`, `produksiBatch` |
| **Cashflow & Keuangan** | `cashflowEntry`, `cashflowCategory`, `bankAccount` |
| **System** | `user`, `role`, `setting`, `notification` |

## Export Backup

1. Buka `/backup` → tab **Export**.
2. Centang group yang mau di-backup (default: semua).
3. Klik **Download Backup ZIP**.
4. File `pospro-event-backup-YYYYMMDD-HHMMSS.zip` ter-download.

Isi ZIP:

```
pospro-event-backup-20260425-143022.zip
├── meta.json              (versi 2.3, daftar tabel, timestamp)
├── crm/
│   ├── leadStage.json
│   ├── leadLabel.json
│   ├── lead.json
│   ├── leadLabelOnLead.json
│   └── leadActivity.json
├── master/...
├── rab/...
└── ...
```

> Versi schema backup saat ini: **2.3** (sudah include tabel CRM + RAB Loose Items).

## Restore Backup

1. Buka `/backup` → tab **Restore**.
2. Upload file ZIP (drag-drop atau click).
3. Pilih mode:
   - **Skip Duplicate** — baris dengan PK yang sudah ada akan di-skip (aman, default).
   - **Overwrite** — upsert; data lama ditimpa data backup.
4. Klik **Restore** → konfirmasi.
5. Backend menjalankan dalam 1 transaksi:
   ```sql
   SET FOREIGN_KEY_CHECKS = 0;
   -- INSERT/UPSERT semua data sesuai RESTORE_ORDER
   SET FOREIGN_KEY_CHECKS = 1;
   ```
6. Ringkasan: `{ table: { success, skipped }, errors[] }`.

## Restore Order (FK Safety)

Urutan restore dipilih supaya FK terjaga:

```
1. role, user, setting           (system)
2. worker, workerSession         (master indep.)
3. supplier
4. customer, customerContact
5. leadStage, leadLabel          (CRM stages/labels independent)
6. productCategory
7. product, productVariant
8. bomItem, stockMovement
9. rabLooseItem                  (master loose items)
10. invoice, invoiceItem, quotation, quotationItem
11. rabPlan, rabItem, rabRealisasi
12. produksiJob, produksiTahap, produksiBatch
13. cashflowCategory, bankAccount, cashflowEntry
14. lead                         (depends customer + worker + leadStage)
15. leadLabelOnLead              (depends lead + leadLabel) — composite PK
16. leadActivity                 (depends lead)
17. notification
```

## Composite PK Handling

Tabel `LeadLabelOnLead` punya `@@id([leadId, labelId])` (no `id` field). Restore otomatis pakai `createMany({ skipDuplicates: true })` — bukan `upsert by id`.

## Auto-Backup (Rclone)

Untuk auto-backup ke cloud (Google Drive, Dropbox, S3):

1. Install [Rclone](https://rclone.org) di server.
2. Setup remote: `rclone config`.
3. Cron job harian (Linux):
   ```bash
   0 2 * * * cd /path/to/app && curl -X POST http://localhost:3001/backup/auto-export -o /tmp/backup.zip && rclone copy /tmp/backup.zip remote:pospro-event-backups/
   ```
4. Windows Task Scheduler: panggil PowerShell yang sama.

## Best Practice

- 📅 **Mingguan**: Manual download ZIP → simpan di drive eksternal / cloud pribadi.
- 📅 **Harian**: Auto-backup via Rclone ke cloud.
- 🔄 **Sebelum upgrade**: Selalu backup dulu sebelum `prisma db push` atau update schema.
- 🧪 **Test restore**: Sekali sebulan, restore backup ke DB sandbox untuk verify integritas.

## Troubleshooting

| Error | Solusi |
|---|---|
| `FK constraint fails` saat restore | Pakai mode Overwrite, atau cek RESTORE_ORDER apakah parent table sudah ter-restore |
| `Duplicate entry for PK` | Pakai mode Skip Duplicate |
| ZIP corrupt | Coba download ulang; pastikan archiver versi backend cocok dengan adm-zip versi restore |
| Tabel CRM tidak ke-backup | Cek meta.json — versi harus ≥ 2.3 |
