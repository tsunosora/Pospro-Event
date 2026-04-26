# 👥 Data Pelanggan (Customer)

**Customer** = master data klien — di Pospro Event mostly **B2B** (PT/CV/instansi yang order booth/event), dengan sebagian kecil walk-in (printing).

## Akses

Sidebar: **Sales & Pipeline → Data Pelanggan** (`/customers`).

## Schema

```prisma
model Customer {
  id          Int       @id
  name        String          // Nama PIC klien (mis. "Bp. Ivan")
  phone       String?
  email       String?
  address     String?         // Alamat klien
  companyName String?         // Perusahaan/instansi (mis. "PT JAPURA")
  companyPIC  String?         // PIC di perusahaan (kalau beda dari `name`)

  // Relasi keluar
  invoices    Invoice[]       // Penawaran + Invoice
  rabPlans    RabPlan[]       // RAB project
  events      Event[]         // Event yg di-link
  salesOrders SalesOrder[]    // Surat order designer
  lead        Lead?           // Lead asal (kalau hasil CRM Convert) — 1:1
}
```

### Catatan Field

- **`name`** — nama orang yang Anda hadapi (PIC). Untuk B2B, ini pasangan dengan `companyName`.
- **`companyName`** — nama perusahaan/brand klien (contoh: "PT JAPURA Tbk"). Muncul di Penawaran header.
- **`companyPIC`** — kalau yang ttd kontrak / pembuat keputusan beda dari `name` (mis. `name=Ivan` adalah project manager, tapi `companyPIC=Bp. Direktur` yang sign).

## Halaman

| URL | Fungsi |
|---|---|
| `/customers` | List + stats per customer (orders, revenue) |

> **Tidak ada `/customers/[id]` page detail terpisah** — analytics customer ditampilkan via **AnalyticsModal** di list page (klik tombol di tiap row).

## Field Bisa Diisi

Saat tambah/edit Customer:
- Nama (wajib)
- HP, Email, Alamat
- Nama Perusahaan, PIC Perusahaan

> Tidak ada field "kategori klien" / "status active" / "sumber lead" di Customer model. Untuk tracking lead source, lihat modul [CRM Lead Pipeline](./crm.md) — Customer di-link ke Lead via `Lead.convertedCustomerId`.

## Endpoint Backend

| Method | Path | Fungsi |
|---|---|---|
| GET | `/customers/public` | List tanpa auth (untuk public form / kiosk) |
| GET | `/customers` | List authenticated |
| GET | `/customers/with-stats` | List + agregasi (totalOrders, totalRevenue, lastOrderDate) |
| GET | `/customers/export-data` | Data siap export (Excel/PDF) |
| GET | `/customers/:id/analytics` | Detail analytics (revenue, top products, top kategori) |
| POST | `/customers` | Create |
| PATCH | `/customers/:id` | Update |
| DELETE | `/customers/:id` | Hapus |

## Konversi & Integrasi

### Dari Lead (CRM Convert)
Saat lead di stage Closed Deal, klik **Convert ke Customer** → otomatis create Customer dengan field pre-fill dari Lead (nama, phone, organization → companyName).

Detail flow: [CRM Convert](./crm-convert.md).

### Dari Walk-in (Printing)
Saat klien walk-in counter, admin bikin Customer baru langsung dari form Sales Order (Surat Order Designer) — atau pre-create via `/customers`.

### Ke Penawaran / RAB / Event
Setiap Penawaran/RAB/Event punya field `customerId` — pilih dari dropdown. Otomatis populate `clientName`, `clientCompany`, dll dari Customer.

## Analytics per Customer

Klik tombol "📊 Analytics" di row customer → modal popup:
- **Total Revenue** — sum DP dari Transaction yg statusnya PAID/PARTIAL, di-match by phone (fallback by name)
- **Total Orders** — jumlah Transaction
- **Last Order Date**
- **Top Products** — produk paling sering diorder
- **Top Categories** — kategori produk paling sering

> ⚠️ **Limitasi penting untuk vendor booth/event**: analytics ini sumbernya **`Transaction` (POS kasir)**, bukan Invoice/RAB/Event. Untuk klien yang main flow-nya event (95% bisnis Anda), revenue di sini akan **kosong/under-counted** karena DP/pelunasan event biasanya masuk lewat `/cashflow` manual, bukan via POS.

### Workaround sementara

Untuk audit revenue klien event yang akurat, gunakan kombinasi:
1. `/penawaran?customerId=X` — list penawaran ACCEPTED ke klien itu
2. `/rab?customerId=X` — list RAB project klien itu
3. `/cashflow` filter event yang ter-link ke project klien
4. `/reports/event-profit` — leaderboard yang sudah account for cashflow tagged-event

## Export

Tombol **Export** di list page:
- **Excel** — semua field Customer + stats
- **PDF** — formatted printable list

Source: endpoint `GET /customers/export-data` + frontend converter.

## Best Practice (Konteks Vendor Booth)

- 🏢 **Selalu isi `companyName`** untuk B2B — muncul di header Penawaran/Invoice
- 👤 **`name` = PIC operasional** (yg sehari-hari komunikasi via WA), **`companyPIC` = PIC formal** (yg sign)
- 📞 **Nomor HP unik per customer** — analytics & matching pakai phone
- 🔗 **Convert dari Lead, bukan input ulang** — supaya history WhatsApp & lead tracking terjaga
- 🚫 **Hindari duplikasi** — sebelum tambah baru, search dulu by phone

## Limitasi (Backlog)

- ❌ **Tidak ada halaman detail terpisah** — semua action via list page + modal
- ❌ **Analytics POS-centric** — belum include revenue dari Penawaran/RAB/Event yang ter-tag cashflow
- ❌ **Tidak ada custom field/tag** — kalau perlu klasifikasi (mis. tag "VIP", "Repeat Customer", kategori industri), harus tambah field
- ❌ **Tidak ada timeline/history aksi** per customer (kapan terakhir kontak, dll)
- ❌ **Tidak ada merge customer** — kalau ada duplikasi, harus hapus + reassign manual

## Lihat Juga

- [CRM Convert Lead → Customer](./crm-convert.md) — sumber utama Customer baru
- [Penawaran Booth/Event](./penawaran-event.md) — Customer dipakai sebagai client
- [RAB Event](./rab-event.md) — Customer dipakai sebagai project owner
- [Surat Order Designer](./sales-order.md) — Customer untuk lini printing
