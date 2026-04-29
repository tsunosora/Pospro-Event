# 📥 Import Lead dari XLSX

Untuk migrasi dari tool WhatsApp CRM lama (atau export manual dari Excel), Pospro Event punya importer di **`/crm/import`**.

## Format File

File `.xlsx` dengan header kolom (case-insensitive):

| Header Excel | Field Lead | Catatan |
|---|---|---|
| Name | `name` | Boleh kosong (lead anonim dari META) |
| Product Category | `productCategory` | Free text — "Special Design Kayu", dll |
| Organization | `organization` | Nama PT/CV |
| Phone | `phone` | Auto-normalize: `+62 877-xxxx` → `6287xxxx` |
| Lead Level | `level` | Hot / Warm / Cold / Unqualified |
| Lead Source | `source` | META Ads / WhatsApp / Website / Referral / Walk-in |
| Assigned Staff | `assignedWorkerId` | Lookup Worker by name; auto-create jika belum ada |
| Follow-up Date | `followUpDate` | Format ISO atau dd/mm/yyyy |
| Status | `status` + `stage` | Mapping otomatis (lihat di bawah) |
| Order Description | `orderDescription` | |
| Project Value Est. | `projectValueEst` | "Rp 25.000.000" → `25000000` |
| Notes | `notes` | |
| Created At | `leadCameAt` | |
| Last Contacted | `lastContactedAt` | |

## Status → Stage Mapping

| Status (Excel) | Stage (Kanban) |
|---|---|
| New, Contacted | Lead Masuk |
| Responded, Waiting | Follow Up |
| In Progress | Penawaran |
| Closed Deal, Done | Closed Deal |
| Closed Lost, Cancel, No Response | Lost |

## Flow Upload

1. Buka **`/crm/import`** dari sidebar atau tombol di kanban.
2. Pilih file `.xlsx` (drag-drop atau click).
3. Klik **Dry-Run** → preview hasil parse + ringkasan `{ parsed, willCreate, willUpdate, willSkip, errors[] }`.
4. Cek error list — koreksi data sumber jika perlu.
5. Klik **Commit** → import beneran. Ringkasan akhir `{ created, updated, skipped }`.

## Dedupe

Importer pakai `upsert by phoneNormalized`:

- **Phone sudah ada** → update field non-null (tidak menimpa data yang sudah lengkap).
- **Lead lama berstatus `CLOSED_DEAL`** → **skip** (tidak boleh ditimpa).
- **Phone baru** → create.

## Tips

- File contoh: `contacts-export-2026-04-25.xlsx` dari tool WhatsApp CRM lama bisa langsung di-import tanpa edit.
- Jika butuh re-export (audit / migrasi balik), pakai endpoint `GET /crm/export/xlsx`.


---

**© 2026 Muhammad Faishal Abdul Hakim · Pospro Event · All rights reserved.**
[Lihat lisensi lengkap →](./license)
