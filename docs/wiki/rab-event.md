# 🧮 RAB Event (Rencana Anggaran Biaya)

**RAB** = Rencana Anggaran Biaya — dokumen **internal** breakdown biaya per event/project. Beda dengan Penawaran (yang dikirim ke klien), RAB adalah tools untuk:

1. Hitung modal & margin sebelum deal
2. Track item & cost sebelum generate Penawaran
3. Bridge ke pembukuan (Cashflow) saat realisasi

> **Catatan**: RAB di Pospro Event adalah **dokumen statis** — tidak ada lifecycle status (DRAFT/APPROVED/EXECUTED/CLOSED). Dokumen selalu mutable. Kontrol approval terjadi di luar sistem (mis. owner sign-off di WA).

## Akses

Sidebar: **Sales & Pipeline → RAB (Anggaran Proyek)** (`/rab`).

## Halaman

| URL | Fungsi |
|---|---|
| `/rab` | List RAB Plan |
| `/rab/[id]` | Detail + edit field + items + tombol generate/duplicate/save-as-product |

> **Tidak ada `/rab/new`** — pembuatan via tombol "+ Buat RAB" di list page (modal/inline form), lalu redirect ke `/rab/[id]`.

## Format Code

```
RAB-${year}-${seq.padStart(4)}
```

**Contoh**: `RAB-2026-0037` = RAB ke-37 di tahun 2026.

Counter auto-increment per tahun. Reset awal tahun baru (sequence per tahun).

## Schema RabPlan

```prisma
model RabPlan {
  // Identity
  code         String  // unique, format RAB-YYYY-NNNN
  title        String
  projectName  String?
  location     String?
  periodStart  DateTime?
  periodEnd    DateTime?
  customerId   Int?    // link ke master Customer

  // Pendapatan (proyeksi internal — bukan field penawaran)
  dpAmount     Decimal  // DP yang diharapkan/diterima
  pelunasan    Decimal  // Pelunasan yang diharapkan/diterima
  incomeOther  Decimal  // Pendapatan lain-lain

  notes        String?  // S&K internal, asumsi, dll

  // Relasi keluar
  items             RabItem[]
  quotations        Invoice[]  // Penawaran yang ter-generate dari RAB ini
  generatedVariants ProductVariant[]  // Hasil "Save as Product"
  events            Event[]     // Event yang ter-link
  cashflows         Cashflow[]  // Cashflow yang ter-tag
}
```

## Schema RabItem

```prisma
model RabItem {
  rabPlanId    Int
  categoryId   Int            // FK ke RabCategory
  orderIndex   Int
  description  String
  unit         String?        // pcs, m², lembar, set, hari, orang, dll

  // ⚠️ DUAL QUANTITY & PRICE — penting!
  quantity      Decimal       // QTY sisi RAB (client-facing — apa yg ditawarkan)
  quantityCost  Decimal       // QTY sisi COST (internal — yg dibeli/dieksekusi)
  priceRab      Decimal       // Harga JUAL ke klien (jadi item Penawaran)
  priceCost     Decimal       // Harga MODAL aktual

  productVariantId      Int?  // optional link ke katalog
  sourcePackingItemId   Int?  // generated dari Packing List event
  notes                 String?
}
```

### Kenapa Dual Qty/Price?

Vendor booth sering jualkan unit beda dari yang di-eksekusi:
- **Client-facing**: "Booth 3×3 = Rp 8.000.000" → `quantity=1, priceRab=8jt, unit=unit`
- **Internal cost**: 8 lembar plywood × Rp 285k = Rp 2.280.000 → `quantityCost=8, priceCost=285k, unit=lembar`

Sehingga 1 line bisa nampung **dua perspektif** dalam satu item — yang akan muncul di Penawaran (qty/price RAB) vs internal margin calc (qty/price Cost).

## Master `RabCategory`

Kategori bisa di-CRUD di settings (default seed):
- Material
- Jasa
- Transport
- Akomodasi
- Sewa Alat
- (custom — owner bisa tambah sendiri)

Field: `name (unique)`, `orderIndex`, `key (slug stable)`, `isActive`.

## Master `RabLooseItem` (Item Lepasan Reusable)

Item yang sering muncul di banyak RAB tapi belum dianggap "produk catalog" — disimpan sebagai master:

```prisma
model RabLooseItem {
  description       String
  normalizedKey     String  // unique, untuk dedupe
  unit              String?
  lastPriceRab      Decimal
  lastPriceCost     Decimal
  defaultCategory   String?
  usageCount        Int     // auto-increment tiap dipakai
  lastUsedAt        DateTime?
  promotedVariantId Int?    // jika di-promote ke ProductVariant
}
```

**Use case**: "Cat duco putih 1L" sering muncul di RAB tapi belum jadi produk. Saat search di RAB editor, muncul di autocomplete dengan harga terakhir (last price). Setelah dipakai 5x+, owner bisa **promote** jadi ProductVariant resmi → `promotedVariantId` ter-set.

## Kalkulasi Margin (Summary)

Endpoint `GET /rab/:id/summary` mengembalikan:

```json
{
  "totals": {
    "totalRab": 12765000,    // Sum (quantity × priceRab) per item
    "totalCost": 8420000,    // Sum (quantityCost × priceCost) per item
    "totalSelisih": 4345000  // = totalRab - totalCost
  },
  "income": {
    "dpAmount": 6000000,
    "pelunasan": 6765000,
    "incomeOther": 0,
    "totalIncome": 12765000
  },
  "saldo": 4345000,  // totalIncome - totalCost
  "categories": [
    { "categoryName": "Material", "subtotalRab": ..., "subtotalCost": ..., "selisih": ... },
    ...
  ]
}
```

Margin % bisa dihitung di frontend dari `(totalRab - totalCost) / totalRab × 100`.

> Tidak ada hard threshold warning di backend. Frontend mungkin tampilkan visual cue (Event Timeline punya RAB margin chip dengan threshold 30/15/<15%).

## Endpoint Backend

| Method | Path | Fungsi |
|---|---|---|
| GET | `/rab` | List semua RAB |
| GET | `/rab/:id` | Detail (RabPlan + items + customer) |
| GET | `/rab/:id/summary` | Margin/totals breakdown |
| POST | `/rab` | Create baru |
| PATCH | `/rab/:id` | Update field/items |
| DELETE | `/rab/:id` | Hapus |
| POST | `/rab/:id/duplicate` | Duplikasi (copy ke RAB baru) |
| POST | `/rab/:id/generate-quotation` | Generate Penawaran (Invoice type=QUOTATION) dari item RAB |
| POST | `/rab/:id/save-as-product` | Convert item RAB jadi ProductVariant katalog |
| POST | `/rab/:id/generate-cashflow` | Bulk-create Cashflow expense entries |
| GET | `/rab/:id/export/xlsx` | Export Excel |

> **Tidak ada PDF export** untuk RAB sendiri. Untuk laporan PDF, pakai [Project Report PDF](#) dari event detail (yang gabungkan RAB + cashflow + crew).

## Konversi & Integrasi

### Dari Lead (CRM Convert)
Saat lead di Closed Deal, checkbox "Sekalian buat draft RAB" → otomatis bikin RabPlan kosong dengan `customerId` ter-pre-fill.

### Dari Packing List Event
Item di `EventPackingItem` (yg ditandai disposition tertentu) bisa di-import jadi `RabItem` dengan `sourcePackingItemId` ter-set.

### Ke Penawaran ⭐
Tombol **"Generate Penawaran"** di `/rab/[id]` — bikin Invoice (type=QUOTATION) dengan:
- Items dari RAB (price = `priceRab`, qty = `quantity`)
- `rabPlanId` ter-set sebagai backlink
- Status awal: DRAFT, butuh assign nomor + edit final

### Ke Produk Katalog ⭐
Tombol **"Simpan sebagai Produk"** di RAB detail. Lihat [Save RAB as Product](./rab-to-product.md).

### Ke Cashflow ⭐
Tombol **"💸 Generate Cashflow"** di RAB detail — bulk create expense entries dengan auto-tag eventId & rabPlanId. Detail lengkap di section bawah.

## 💸 Generate Cashflow dari RAB

```
┌─────────────────────────────────────────────┐
│ 💸 Generate Cashflow dari RAB               │
│                                              │
│ Total Cost RAB:    Rp 8.420.000              │
│ Jumlah Item:       12 item                   │
│                                              │
│ Mode Generate:                               │
│  ◉ Detail (1 entry per item RAB)            │
│  ○ Kategori (1 entry per RabCategory)       │
│                                              │
│ ⚠️ Entry akan ter-tag ke RAB ini + event     │
│    terkait. Flagged excludeFromShift.        │
│                                              │
│         [Batal]  [Generate]                  │
└─────────────────────────────────────────────┘
```

### Mode

| Mode | Perilaku | Cocok untuk |
|---|---|---|
| **Detail** | 1 cashflow entry per RabItem | Audit per material |
| **Kategori** | 1 entry per RabCategory (sum) | Cashflow ringkas |

### Auto-mapping kategori
RAB category name di-map ke kategori cashflow vendor booth:
- "Material*" → "Material Booth (Kayu/MDF)"
- "Jasa*" → "Jasa Crew Lapangan"
- "Transport*" → "Transport Event"
- "Akomodasi*" → "Akomodasi Crew"
- "Sewa*" → "Sewa Alat Event"
- Lainnya → pakai nama RabCategory as-is

### Auto-tag
- `rabPlanId` — selalu di-tag
- `eventId` — auto kalau RAB ini ter-link ke **tepat 1 event** (via `Event.rabPlanId`)
- `excludeFromShift = true` — supaya tidak nyangkut di laporan kasir POS

### Anti-duplikat
Sistem **menolak generate kalau RAB ini sudah pernah di-generate** (cek `Cashflow.rabPlanId` count > 0). Hapus dulu entry lama di `/cashflow?rabPlanId=X` kalau mau regenerate.

### Endpoint
```
POST /rab/:id/generate-cashflow
Body: { mode?: 'detail' | 'category', eventId?: number, skipExisting?: boolean }
```

## Best Practice

- 🧮 **Pakai dual quantity** dengan benar — `quantity` untuk apa yang ditawarkan, `quantityCost` untuk apa yang dieksekusi
- 📁 **Naming category konsisten** — supaya auto-mapping ke Cashflow akurat
- 🔄 **Duplicate RAB** untuk event mirip — daripada bikin baru dari nol
- 🏷️ **Pakai LooseItem search** di editor — daripada ketik manual, ambil dari history
- 📊 **Cek summary sebelum approve** — pastikan `totalSelisih` (margin) ≥ 30% sebelum kirim Penawaran
- 💰 **Update `dpAmount` & `pelunasan`** saat klien transfer — biar `saldo` summary akurat (ini terpisah dari Cashflow tag, sifatnya RAB-internal)

## Limitasi (Backlog)

- ❌ **Tidak ada lifecycle status** (DRAFT/APPROVED/CLOSED) — semua mutable. Kalau perlu approval workflow, harus ditambah field & guard
- ❌ **Tidak ada PDF export** standalone untuk RAB — pakai Excel atau Project Report (level event)
- ❌ **Margin warning threshold** belum hard-coded di backend
- ❌ **Realisasi cost vs plan** belum ada (tab "Realisasi" yg saya sebut di docs lama tidak ada)

## Lihat Juga

- [Penawaran Booth/Event](./penawaran-event.md) — output utama dari Generate Penawaran
- [Save RAB as Product](./rab-to-product.md) — convert item ke katalog
- [Cashflow Bisnis](./cashflow.md) — Generate Cashflow flow
- [Kalkulator HPP](./hpp-calculator.md) — bantu hitung priceCost material
