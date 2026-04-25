# 🧮 RAB Event (Rencana Anggaran Biaya)

**RAB** = Rencana Anggaran Biaya — breakdown internal biaya per event/project. Beda dengan Penawaran (yang dikirim ke klien), RAB adalah dokumen **internal** untuk:

1. Hitung modal & margin sebelum deal
2. Tracking realisasi biaya saat eksekusi event
3. Laporan profitabilitas per project

## Halaman

| URL | Fungsi |
|---|---|
| `/rab` | List RAB Plan (filter: DRAFT / APPROVED / EXECUTED / CLOSED) |
| `/rab/new` | Bikin RAB baru |
| `/rab/[id]` | Detail + edit item + lihat margin |
| `/rab?customerId=X` | Filter per customer |

## Struktur RAB

Setiap **RabPlan** punya kategori biaya:

| Kategori | Contoh Item |
|---|---|
| **Material** | Plywood 18mm, MDF, Cat duco, Acrylic |
| **Jasa** | Tukang, Finishing, Setter, Designer |
| **Transport** | Pick-up Surabaya-Jakarta, Forklift, Toll |
| **Akomodasi** | Hotel crew 3 hari, Konsumsi |
| **Sewa Alat** | Genset, Lighting tambahan, Trolley |
| **Loose Items** | Item lepasan / kontingensi (ditampung di `RabLooseItem`) |

## Field per Item

- `name`, `qty`, `unit` (pcs/m/m²/m³/hari/orang)
- `unitCost` — harga modal (cost)
- `unitPrice` — harga jual ke klien (untuk preview margin)
- `subtotalCost = qty × unitCost`
- `subtotalPrice = qty × unitPrice`

## Kalkulasi Margin

Per RabPlan, dashboard menampilkan:

```
Total Cost:    Rp 8.500.000
Total Price:   Rp 12.765.000   (sinkron dgn Penawaran)
Margin:        Rp 4.265.000   (33,4%)
```

Warning jika margin < threshold (default 20% — atur di settings).

## Flow Lifecycle

```
DRAFT  ─────►  APPROVED  ─────►  EXECUTED  ─────►  CLOSED
(planning)    (acc owner)     (event jalan)    (selesai +
                                                 realisasi
                                                 dicatat)
```

- **DRAFT** → masih bisa edit semua field.
- **APPROVED** → item terkunci, hanya catatan realisasi yang bisa ditambah.
- **EXECUTED** → event sedang berlangsung; tab "Realisasi" aktif untuk catat actual cost.
- **CLOSED** → laporan final, masuk ke Cashflow & laporan laba per project.

## Konversi

- **Dari Lead** (CRM Convert): bikin draft RAB kosong ter-link customer.
- **Dari Penawaran**: tombol "Buat RAB" — copy item dari SPH ke RAB sebagai baseline.
- **Ke Invoice**: setelah CLOSED, RAB tidak otomatis bikin invoice — pakai Penawaran/Invoice terkait.

## Export

- **PDF** — laporan internal (boleh untuk pemilik/investor).
- **XLSX** — buka di Excel untuk analisis lebih lanjut. Pakai `XlsxExportService` di backend.

## Lihat Juga

- [Penawaran Booth/Event](/penawaran-event) — sumber harga jual
- [Cashflow Bisnis](/cashflow) — realisasi biaya masuk ke sini
- [Kalkulator HPP](/hpp-calculator) — bantu hitung unitCost material
