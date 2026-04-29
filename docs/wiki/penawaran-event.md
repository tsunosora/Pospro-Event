# 📄 Penawaran Booth & Event (SPH)

**Penawaran** = dokumen yang dikirim ke calon klien sebelum deal. Di Pospro Event, penawaran disimpan sebagai entitas `Invoice` dengan `type = QUOTATION` (sehingga share field & lifecycle dengan Invoice).

## Akses

Sidebar: **Sales & Pipeline → Penawaran Booth/Event** (`/penawaran`).

## Variant

Pospro Event mendukung 2 variant penawaran (field `quotationVariant`):

| Variant | Untuk | Konten Khas |
|---|---|---|
| **SEWA** | Sewa perlengkapan/booth jadi (rental) | Tarif per event, durasi, lokasi pameran |
| **PENGADAAN_BOOTH** | Custom build / pengadaan booth special design | Material list, ukuran, finishing, jasa pasang |

## Halaman

| URL | Fungsi |
|---|---|
| `/penawaran` | List + filter variant + tombol "+ Buat Penawaran" (modal pilih variant) |
| `/penawaran/[id]` | Detail + edit field + items + tombol export & status |

> **Tidak ada halaman `/penawaran/new` terpisah** — pembuatan via modal di list page, lalu auto-redirect ke `/penawaran/[id]` untuk edit detail.

## Format Nomor (SPH Indonesia)

Format aktual:

```
${seq}/${kode}/Pnwr/${roman_bulan}/${yy}
```

| Field | Contoh | Catatan |
|---|---|---|
| `seq` | `42` | Sequence per (kode + tahun), auto-increment |
| `kode` | `Xp` / `Ep` | **Kode brand** — Xposer / Exindo / dll |
| `Pnwr` | `Pnwr` | Literal — singkatan "Penawaran" |
| `roman_bulan` | `IV` | Bulan dalam Romawi (I-XII) |
| `yy` | `26` | 2 digit tahun |

**Contoh**: `42/Xp/Pnwr/IV/26` = penawaran ke-42 dari brand Xposer di April 2026.

### Revisi
Saat penawaran direvisi (tombol "Revisi"), nomor jadi `42rev1/Xp/Pnwr/IV/26`. Field di schema: `parentQuotationId` (FK ke penawaran asli) + `revisionNumber` (0/1/2/...).

### Reset
Counter `DocumentNumberCounter` reset per kombinasi `(docType=Pnwr, kode, year)`. Setiap brand punya counter sendiri.

### Assign Number
Penawaran baru lahir dengan `invoiceNumber = "DRAFT-${id}"` (placeholder). Setelah final, klik tombol **"Assign Nomor"** → endpoint reserve nomor seq berikutnya.

## Field Penting (Schema)

```prisma
model Invoice {
  // Identity
  invoiceNumber       String              // unique
  type                INVOICE | QUOTATION
  quotationVariant    SEWA | PENGADAAN_BOOTH (untuk type=QUOTATION)
  parentQuotationId   Int?                // untuk revisi
  revisionNumber      Int                 // 0 = original
  
  // Klien
  clientName, clientCompany, clientAddress, clientPhone, clientEmail
  customerId          Int?                // link ke master Customer
  
  // Project / Event
  projectName         String?
  eventLocation       String?
  eventDateStart      DateTime?
  eventDateEnd        DateTime?
  
  // Lifecycle
  date                DateTime
  validUntil          DateTime?           // masa berlaku penawaran (Quotation)
  dueDate             DateTime?           // tempo bayar (Invoice)
  status              DRAFT|SENT|ACCEPTED|REJECTED|EXPIRED|PAID|CANCELLED
  
  // Keuangan
  subtotal, taxRate (% PPN), taxAmount (Rp), discount (Rp), total
  dpPercent           Decimal             // default 50%
  bankAccountIds      String?             // CSV id bank yang dicantumkan
  
  // Link ke RAB & items
  rabPlanId           Int?
  items               InvoiceItem[]       // multi-row item dengan qty, price, unit
  notes               String?             // S&K, garansi, dll
}
```

## Lifecycle Status

```
DRAFT  ──► SENT  ──► ACCEPTED  ──► (convert) Invoice  ──► PAID
                  └► REJECTED
                  └► EXPIRED   (auto kalau lewat validUntil)
                  └► CANCELLED
```

| Status | Aksi yang Boleh |
|---|---|
| DRAFT | Edit semua field, hapus, assign nomor |
| SENT | Edit minor (notes, dueDate), revisi |
| ACCEPTED | Convert ke Invoice, revisi |
| REJECTED / EXPIRED / CANCELLED | Read-only, bisa di-revisi |

## Endpoint Backend

| Method | Path | Fungsi |
|---|---|---|
| GET | `/invoices?type=QUOTATION&variant=...` | List penawaran (filter type & variant) |
| POST | `/invoices` | Buat penawaran baru (type=QUOTATION) |
| GET | `/invoices/:id` | Detail |
| PATCH | `/invoices/:id` | Update field/items |
| PATCH | `/invoices/:id/status` | Ubah status |
| PATCH | `/invoices/:id/type` | Toggle type (Quotation ↔ Invoice) |
| POST | `/invoices/:id/convert-to-invoice` | Generate Invoice baru dari Quotation ACCEPTED |
| POST | `/invoices/:id/assign-number` | Reserve nomor seq dari counter |
| POST | `/invoices/:id/revise` | Bikin revisi (parent → child) |
| GET | `/invoices/:id/export/pdf` | PDF |
| GET | `/invoices/:id/export/docx` | DOCX (bisa edit lanjutan di Word) |
| DELETE | `/invoices/:id` | Hapus draft |

## Export PDF & DOCX

Pospro Event punya **dua format export**:

- **PDF** — siap kirim klien via WhatsApp / Email
- **DOCX** — buka di Microsoft Word untuk **edit terakhir** (mis. ganti format paragraf, tambah catatan custom). Berguna saat klien minta revisi minor yang tidak match field standar.

Tombol di `/penawaran` per row & di detail page.

## Konversi & Integrasi

### Dari Lead (CRM Convert)
Saat lead di stage Closed Deal, tombol "Convert ke Customer" + checkbox "Sekalian buat draft Penawaran" → otomatis bikin Quotation kosong dengan customerId & projectName ter-pre-fill.

### Dari RAB
Buka RAB → tombol **"Generate Penawaran"** → bikin Quotation dengan item dari RAB (price = `priceRab` dari RabItem). Penawaran ter-link via `rabPlanId`.

### Ke Invoice
Saat klien ACCEPT, klik **"Convert to Invoice"** → bikin record Invoice baru (type=INVOICE) dengan invoiceNumber baru sesuai counter Invoice. Status Quotation tetap ACCEPTED, Invoice baru DRAFT/SENT.

## Bank Accounts

Field `bankAccountIds` — CSV string (mis. `"1,3,5"`) — list rekening yang dicantumkan di footer penawaran. Klien bisa pilih transfer ke salah satunya.

## DP Percent

Field `dpPercent` (default 50%) — persentase DP yang harus dibayar saat klien ACCEPT. Otomatis di-render di footer penawaran sebagai instruksi pembayaran.

## Best Practice

- 📅 **Set `validUntil` 14-30 hari** — biar tidak expired terlalu cepat. Status auto-EXPIRED kalau lewat.
- 🔢 **Jangan assign nomor di DRAFT** — tunggu siap kirim, baru assign supaya counter tidak kacau (kalau di-cancel, nomor tetap terpakai = gap).
- 📝 **Pakai `notes` untuk S&K** — termasuk garansi, klaim revisi, force majeure.
- 🏷️ **Set `projectName` jelas** — muncul di header PDF, bantu klien identify.
- 🔄 **Pakai Revisi, bukan Edit Drastis** — supaya history terjaga (penawaran asli tidak hilang).
- 💱 **PPN 11% (atau aktual)** — set `taxRate` sesuai status pengusaha kena pajak (PKP) Anda.

## Limitasi (Backlog)

- ❌ Tidak ada tombol "Buat RAB dari Penawaran" — flow saat ini cuma RAB → Penawaran (bukan sebaliknya)
- ❌ `bankAccountIds` masih CSV string — belum normalized ke join table
- ❌ Tidak ada auto-EXPIRED job — status EXPIRED harus diubah manual saat lewat `validUntil`
- ❌ Email klien dari sistem belum ada (manual via WA/email eksternal)

## Lihat Juga

- [RAB Event](./rab-event.md) — sumber item & pricing untuk Generate Penawaran
- [CRM Convert](./crm-convert.md) — auto-create draft Penawaran saat lead deal
- [Cashflow](./cashflow.md) — DP & pelunasan klien tag ke event


---

**© 2026 Muhammad Faishal Abdul Hakim · Pospro Event · All rights reserved.**
[Lihat lisensi lengkap →](./license)
