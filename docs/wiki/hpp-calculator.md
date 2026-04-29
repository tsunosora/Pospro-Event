# 🧮 Kalkulator HPP — Pospro Event

**HPP** (Harga Pokok Penjualan) = total modal produksi 1 unit booth/material. Kalkulator ini membantu menentukan harga jual yang sehat (margin di atas threshold) sebelum bikin Penawaran/RAB.

## Akses

Menu: **Master → Kalkulator HPP** (`/hpp-calculator`).

## Konsep

```
Material (qty × unitCost)  +
Jasa Tukang (jam × rate)   +
Overhead (listrik, sewa)   +
Marketing & Misc           =  HPP per unit
                              ↓
                              × markup (% margin)
                              =  Harga Jual saran
```

## Struktur Worksheet

### Section 1: Biaya Variabel (per unit)

| Bahan | Lebar (m) | Tinggi (m) | Luas (m²) | Harga/m² | Subtotal |
|---|---|---|---|---|---|
| Plywood 18mm Phenolic | 1.22 | 2.44 | 2.97 | Rp 95.000 | Rp 282.470 |
| Cat Duco | — | — | — | Rp 75.000 (kaleng × 2) | Rp 150.000 |

> Kolom **Lebar × Tinggi** auto-hitung **Luas (m²)** untuk material lembaran (plywood, MDF, banner). Untuk material satuan (kaleng cat, lighting strip, hardware), kosongkan W/H dan input qty langsung.

### Section 2: Biaya Tetap (alokasi per unit)

| Item | Total | Per Unit (÷ qty produksi) |
|---|---|---|
| Sewa Workshop bulanan | Rp 5.000.000 | Rp 50.000 (asumsi 100 unit/bln) |
| Listrik | Rp 1.500.000 | Rp 15.000 |
| Marketing META Ads | Rp 3.000.000 | Rp 30.000 |

### Section 3: Multi-Varian (Booth Custom)

Untuk booth custom dengan beberapa ukuran (3×3, 3×4, 4×6 dll) dalam satu hitung:

| Varian | Material Base | Tambah (Lighting Premium) | HPP | Saran Jual (markup 40%) |
|---|---|---|---|---|
| Booth 3×3 Standard | Rp 4.200.000 | — | Rp 4.200.000 | Rp 5.880.000 |
| Booth 3×3 Premium | Rp 4.200.000 | + Rp 800.000 | Rp 5.000.000 | Rp 7.000.000 |
| Booth 4×6 Standard | Rp 7.500.000 | — | Rp 7.500.000 | Rp 10.500.000 |

## Output

1. **Simpan ke Produk** — bikin produk baru di `/products` dengan multi-varian.
2. **Apply ke Varian** — update HPP varian yang sudah ada.
3. **Export ke RAB** — copy hitungan langsung jadi item RAB baru.
4. **Print Worksheet** — PDF untuk arsip / approval owner.

## Use Case

- 🆕 **Sebelum bikin Penawaran**: hitung HPP dulu, set markup 40%, bandingkan dengan harga kompetitor.
- 📈 **Review tahunan**: harga material naik → re-calculate HPP semua varian → update harga jual.
- 🧪 **Quote special design**: klien minta booth custom → quick calc di kalkulator → langsung ke Penawaran.

## Best Practice

- 📐 Untuk material lembaran, **selalu pakai Lebar × Tinggi** (jangan estimasi luas) — error jadi minim.
- 🔄 **Update harga supplier** dulu di `/suppliers` sebelum kalkulasi — kalkulator ambil harga terbaru.
- 💡 Set **markup minimal** di settings (mis. 30%) — kalkulator warning jika rendah.

## Lihat Juga

- [Suppliers](./suppliers.md) — sumber harga material
- [RAB Event](./rab-event.md) — gunakan output kalkulator sebagai baseline
- [Penawaran](./penawaran-event.md) — saran harga jual


---

**© 2026 Muhammad Faishal Abdul Hakim · Pospro Event · All rights reserved.**
[Lihat lisensi lengkap →](./license)
