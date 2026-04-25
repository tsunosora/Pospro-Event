# 📊 Laporan Stok — Pospro Event

Halaman **Laporan Stok** (`/reports/stock`) memberi visibilitas lengkap atas semua mutasi material booth & event — material masuk dari supplier, terpotong saat produksi, koreksi opname, hingga stok saat ini.

## Sumber Mutasi (StockMovement)

| Tipe | Trigger | Tanda |
|---|---|---|
| `PURCHASE_IN` | Beli material dari supplier | + (masuk) |
| `PRODUKSI_OUT` | BOM auto-potong saat tahap produksi | − (keluar) |
| `OPNAME_ADJUST` | Approve selisih opname | ± |
| `RETURN_IN` | Material lebih dari project (kembali) | + |
| `WASTE_OUT` | Material rusak / hilang | − |
| `MANUAL` | Input bebas admin | ± |

## Halaman

| URL | Fungsi |
|---|---|
| `/reports/stock` | Dashboard saldo + filter periode |
| `/reports/stock/movements` | Detail per mutasi |
| `/reports/stock/aging` | Material yang lama tidak bergerak |

## Filter

- Periode (date range)
- Material/kategori
- Tipe mutasi
- Reference (link ke ProduksiJob, RAB, Supplier, dll)

## Visualisasi

### Tabel Saldo

| Material | Saldo Awal | Masuk | Keluar | Adjust | Saldo Akhir | Min | Status |
|---|---|---|---|---|---|---|---|
| Plywood 18mm | 24 | 16 | 30 | −2 | **8** | 10 | ⚠️ Low |
| MDF 12mm | 18 | 0 | 12 | 0 | 6 | 5 | OK |
| Lighting Strip | 50 m | 100 | 80 | 0 | 70 m | 30 | OK |

Material **⚠️ Low** (di bawah `minStock`) muncul di notifikasi dashboard.

### Chart Mutasi Bulanan

Stacked bar per kategori material (Kayu, Metal, Lighting, Paper, dll) — gampang lihat material apa yang paling banyak terpakai.

## Aging Report

Material yang **6+ bulan tidak bergerak** muncul di Aging Report — kandidat untuk:
- Sale clearance (jual murah)
- Repurpose ke project lain
- Write-off jika rusak

## Export

Excel: kolom lengkap (movement_id, date, type, product, qty, ref_type, ref_id, worker, notes).

## Best Practice

- 📦 **Set `minStock`** untuk semua material booth utama — auto-warning sebelum kehabisan.
- 🔍 **Audit movement** mingguan — cek apakah jumlah PURCHASE_IN sesuai PO supplier.
- 🚚 **Catat RETURN_IN** dari project — kalau forget, stok sistem terlihat lebih sedikit dari aktual → over-purchase.

## Lihat Juga

- [Stok Opname](./stock-opname.md)
- [Antrian Produksi](./produksi.md) — sumber `PRODUKSI_OUT`
- [Suppliers](./suppliers.md) — sumber `PURCHASE_IN`
