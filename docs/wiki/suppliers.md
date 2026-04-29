# 🏭 Data Supplier — Pospro Event

Manajemen vendor/pemasok material booth & event. Setiap material booth (kayu, plywood, lighting, dll) bisa di-link ke supplier dengan harga beli per varian.

## Akses

Menu: **Master → Supplier** (`/suppliers`).

## Struktur Data

| Field | Tipe | Catatan |
|---|---|---|
| `name` | String | "PT. Plywood Jaya" |
| `phone` | String | Auto-format E.164 |
| `email` | String | Opsional |
| `address` | Text | Alamat workshop/gudang |
| `city`, `province` | String | Untuk filter peta |
| `picName` | String | Nama PIC supplier |
| `category` | Enum | KAYU / METAL / KAIN / LIGHTING / ELECTRONIC / TRANSPORT / JASA / OTHER |
| `notes` | Text | Catatan internal (rate, lead time, dll) |
| `isActive` | Boolean | Sembunyikan supplier yang sudah tidak dipakai |

## Halaman

| URL | Fungsi |
|---|---|
| `/suppliers` | List + filter category/city + search |
| `/suppliers/new` | Tambah supplier |
| `/suppliers/[id]` | Detail + edit + list produk yang di-link |

## Link ke Produk/Material

Di halaman **Produk** (`/products/[id]`), tab **Supplier**:

```
┌─────────────────────────────────────────────┐
│ Plywood 18mm Phenolic                       │
│ ┌─────────────────────────────────────────┐ │
│ │ Supplier         │ Harga Beli │ Lead    │ │
│ ├─────────────────────────────────────────┤ │
│ │ PT. Plywood Jaya │ Rp 285.000 │ 2 hari  │ │
│ │ CV. Kayu Mulia   │ Rp 270.000 │ 5 hari  │ │
│ └─────────────────────────────────────────┘ │
│ [+ Tambah Supplier]                         │
└─────────────────────────────────────────────┘
```

Saat bikin **RAB**, kalkulator HPP & price suggestion otomatis ambil harga supplier termurah (atau yang ditandai default).

## Use Case di Pospro Event

- **Kalkulasi RAB**: Material section di RAB auto-suggest supplier berdasarkan harga terbaik.
- **PO / Order**: (future feature) generate Purchase Order ke supplier.
- **Filter per kota**: cari supplier lokal Jakarta/Surabaya/Bandung saat event di kota tertentu — hemat ongkir.
- **Tracking lead time**: rencana produksi booth disesuaikan dengan lead time supplier.

## Best Practice

- 🏷️ Tandai 1 supplier sebagai **default** per material — RAB pakai harga ini saat plan baru.
- 📍 Isi **city/province** lengkap — krusial buat filter logistik event di luar kota.
- 📞 PIC name + WA — tombol click-to-chat aktif (sama seperti CRM).
- 🔄 Update **harga beli** minimal sekali sebulan — jaga akurasi RAB & margin.

## Lihat Juga

- [Kalkulator HPP](./hpp-calculator.md) — kalkulasi modal pakai harga supplier
- [RAB Event](./rab-event.md) — supplier dipakai di kategori Material


---

**© 2026 Muhammad Faishal Abdul Hakim · Pospro Event · All rights reserved.**
[Lihat lisensi lengkap →](./license)
