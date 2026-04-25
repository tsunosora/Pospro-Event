# 📋 Stok Opname — Pospro Event

**Stok Opname** = audit fisik material booth & event di gudang, dicocokkan dengan data sistem. Karena material booth banyak (kayu, MDF, plywood, lighting, paper, hardware), Pospro Event menyediakan sistem opname berbasis **link unik** yang bisa dishare ke crew gudang — mereka hitung langsung dari HP tanpa login.

## Akses

Menu: **Operasional → Stok Opname** (`/stock-opname`).

## Flow

```
1. Admin bikin sesi opname
   ↓ (pilih kategori: kayu / metal / lighting / paper / all)
2. Sistem generate URL unik (token)
   ↓
3. Share URL ke crew gudang via WhatsApp
   ↓
4. Crew buka link di HP — input qty fisik per material
   ↓
5. Submit → admin review selisih
   ↓
6. Approve → adjustment otomatis dibuat (StockMovement)
```

## Field Sesi Opname

| Field | Catatan |
|---|---|
| `name` | "Opname Kayu Q2 2026" |
| `category` | Filter material apa saja yang dicount |
| `tokenUrl` | URL share (expire 7 hari) |
| `status` | OPEN / SUBMITTED / APPROVED / CANCELLED |
| `assignedWorkerId` | Crew yang ditugasi (opsional) |

## Crew View (No-Login)

```
┌───────────────────────────────────┐
│ Pospro Event — Opname Kayu Q2     │
│ Crew: Pak Budi                    │
│                                   │
│ ┌──────────────────────────────┐ │
│ │ Plywood 18mm Phenolic        │ │
│ │ Sistem: 24 lembar            │ │
│ │ Hitung: [____] lembar        │ │
│ ├──────────────────────────────┤ │
│ │ MDF 12mm                     │ │
│ │ Sistem: 18 lembar            │ │
│ │ Hitung: [____] lembar        │ │
│ ├──────────────────────────────┤ │
│ │ ...                           │ │
│ └──────────────────────────────┘ │
│                                   │
│         [ Submit Hitungan ]       │
└───────────────────────────────────┘
```

> Crew **tidak melihat** angka sistem saat menghitung — supaya benar-benar count fisik (mode hidden default).

## Review Selisih

Setelah submit, admin lihat tabel rekonsiliasi:

| Material | Sistem | Fisik | Selisih | Aksi |
|---|---|---|---|---|
| Plywood 18mm | 24 | 22 | **−2** | [Approve adjust] |
| MDF 12mm | 18 | 18 | 0 | OK |
| Cat Duco Putih | 5 | 6 | **+1** | [Approve adjust] |

Klik **Approve** → auto-bikin `StockMovement` tipe `OPNAME_ADJUST` dengan referensi sesi.

## Best Practice

- 📅 Opname rutin **per bulan** atau setelah event besar (banyak material keluar).
- 👥 **2 crew per opname** untuk cross-check (mode "double count" — opsional).
- 📦 Opname per **kategori** (bukan all-at-once) supaya selesai cepat.
- 🚫 Hindari opname saat ada job produksi aktif — stok bergerak terus.

## Lihat Juga

- [Antrian Produksi](./produksi.md) — sumber pemotongan stok via BOM
- [Laporan Stok](./laporan-stok.md) — tracking semua mutasi stok
