# 🔄 Alur Bisnis Pospro Event — End-to-End

Halaman ini menjelaskan bagaimana semua modul **Pospro Event** bekerja bersama — dari Lead pertama yang masuk via META Ads / WhatsApp, sampai event selesai dan laba dihitung.

## Diagram Alur

```
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │  META Ads    │     │  WhatsApp    │     │   Website    │
  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
         └────────────────────┴────────────────────┘
                              ↓
                    ╔═════════════════════╗
                    ║   1. CRM            ║  (Sales)
                    ║   /crm/board        ║
                    ║   Kanban drag-drop  ║
                    ╚══════════╤══════════╝
                               ↓ deal
                    ╔═════════════════════╗
                    ║   2. Convert        ║
                    ║   → Customer        ║
                    ║   → draft Penawaran ║
                    ║   → draft RAB       ║
                    ╚══════════╤══════════╝
                               ↓
                ┌──────────────┴──────────────┐
                ↓                             ↓
       ╔════════════════╗            ╔════════════════╗
       ║  3a. Penawaran ║ kirim klien║  3b. RAB Event ║  (Internal)
       ║  (SPH PDF)     ║ ─────────► ║  (cost plan)   ║
       ║  ACCEPTED      ║            ║  APPROVED      ║
       ╚════════╤═══════╝            ╚════════╤═══════╝
                ↓ convert                     ↓ event jalan
       ╔════════════════╗            ╔════════════════╗
       ║  4a. Invoice   ║            ║  4b. Produksi  ║
       ║  (final)       ║            ║  (job queue)   ║
       ╚════════╤═══════╝            ╚════════╤═══════╝
                └──────────────┬──────────────┘
                               ↓
                    ╔═════════════════════╗
                    ║   5. Cashflow       ║
                    ║   + Laba Project    ║
                    ║   + RAB CLOSED      ║
                    ╚═════════════════════╝
```

## Tahap 1 — Lead Capture (CRM)

Lead masuk via 3 channel utama:

- **META Ads** — biasanya banyak (ratusan/bulan), mayoritas tidak respon. Import via XLSX dari tool ads/CRM eksternal.
- **WhatsApp** — chat masuk manual. PIC catat di card.
- **Website** — form kontak (jika ada).

**Aksi PIC sales:**
1. Buka `/crm/board` → kanban kolom "Lead Masuk" terisi.
2. Klik card → drawer detail.
3. Tombol **WA** → buka chat di tab baru dengan template greeting.
4. Setelah kirim → tombol "Greeting Sent" → log activity.
5. Kirim ComPro PDF → tombol "ComPro Sent" → log.
6. Klien respon → drag card ke "Follow Up" + assign label Hot/Warm/Cold.

→ [Detail: CRM Overview](./crm.md) · [Pipeline Kanban](./crm-kanban.md)

## Tahap 2 — Convert ke Customer

Saat klien deal, drag card ke **Closed Deal** → tombol Convert unlock.

```
[ Convert ke Customer ]
  ☑ Sekalian buat draft Penawaran  (•) PENGADAAN_BOOTH
  ☑ Sekalian buat draft RAB Event
  [ Convert → ]
```

Output 1 transaksi:
- `Customer` baru (link ke leadId)
- Draft `Invoice` (Penawaran SPH) — variant pilihan
- Draft `RabPlan`
- Activity `CONVERTED` di timeline lead

→ [Detail: Convert Lead → Customer](./crm-convert.md)

## Tahap 3a — Penawaran (External)

Penawaran adalah dokumen yang **dikirim ke klien**.

1. Buka draft `Penawaran` → edit item via Catalog Picker / Custom Item.
2. Kalkulasi auto: subtotal, PPN 11%, total.
3. Cetak PDF → kirim WhatsApp/Email ke klien.
4. Klien ACC → ubah status SPH → ACCEPTED.
5. (Opsional) Convert SPH → Invoice final dengan nomor `INV/<bln>/<thn>/<seq>`.

→ [Detail: Penawaran Booth/Event](./penawaran-event.md)

## Tahap 3b — RAB (Internal)

RAB adalah breakdown biaya **internal** — tidak dikirim ke klien.

1. Buka draft `RabPlan` → isi item per kategori:
   - Material (plywood, MDF, cat duco, dll)
   - Jasa (tukang, finishing, setter)
   - Transport, Akomodasi, Sewa Alat, Loose Items
2. Per item: qty × unitCost (modal) vs unitPrice (jual).
3. Dashboard auto-tampilkan **margin %**.
4. Approve → status APPROVED → item terkunci.

→ [Detail: RAB Event](./rab-event.md)

## Tahap 4a — Invoice & Pembayaran

- Klien transfer DP → catat di Invoice → masuk Cashflow otomatis.
- Pelunasan saat event selesai.

## Tahap 4b — Produksi Booth

1. RAB APPROVED → buka `/produksi` → bikin Job baru link ke RAB.
2. Per item booth: tahap **Cutting → Finishing → Packing → Kirim**.
3. Operator login dengan PIN → klaim job → update status.
4. BOM auto-potong stok material saat tahap mulai.

→ [Detail: Produksi](./produksi.md) · [Mesin Cetak Paper](./mesin-cetak.md)

## Tahap 5 — Realisasi & Laporan

Saat event berjalan & selesai:

1. **RAB EXECUTED** → tab Realisasi aktif → catat actual cost (boleh beda dengan plan).
2. **RAB CLOSED** → laporan final, masuk Cashflow.
3. Buka `/cashflow` → lihat arus kas per event.
4. Laporan laba project: `(Total Invoice) − (Total RAB CLOSED) = Laba`.

→ [Detail: Cashflow](./cashflow.md) · [Laporan Stok](./laporan-stok.md)

## Setup Awal (One-Time)

Sebelum mulai operasional, lakukan ini sekali:

1. **Login admin** → `admin@pospro.id` / `admin123` (ganti password).
2. **Master Worker** — daftarkan PIC sales, operator produksi, designer.
3. **Master Supplier** — vendor kayu, lighting, transport.
4. **Master Material** — plywood, MDF, dll dengan stok awal.
5. **CRM Stages** — default sudah ada (Lead Masuk → Lost). Sesuaikan via `/crm/stages`.
6. **CRM Labels** — default Hot/Warm/Cold. Tambah custom (Booth F&B, Event Pameran, dll) via `/crm/labels`.
7. **Backup pertama** — `/backup` → Download ZIP. Simpan di drive eksternal.

## Tips Operasional Harian

- **Pagi**: Cek `/crm` dashboard → stat hari ini. Buka `/crm/board` → follow-up lead Warm/Hot.
- **Siang**: Update activity card lead yang baru kontak.
- **Sore**: Cek `/produksi` → progress booth on-going.
- **Akhir minggu**: Backup ZIP → simpan eksternal.
- **Akhir bulan**: Review `/cashflow` + laba per project di RAB CLOSED.
