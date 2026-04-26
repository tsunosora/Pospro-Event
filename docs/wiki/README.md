# 📚 Wiki Pospro Event — Daftar Isi Lengkap

Selamat datang di dokumentasi **Pospro Event** — aplikasi manajemen vendor booth & event by Muhammad Faishal Abdul Hakim.

## 🚀 Mulai dari Sini

- [🔄 Alur Bisnis Event](./alur-bisnis.md) — overview end-to-end dari Lead sampai Event selesai

## 🎯 CRM & Lead Pipeline

| Halaman | Fungsi |
|---|---|
| [📊 CRM Overview](./crm.md) | Konsep modul CRM + struktur data |
| [🗂️ Pipeline Kanban](./crm-kanban.md) | Cara pakai drag-drop board, filter, card anatomy |
| [📥 Import Lead XLSX](./crm-import.md) | Migrasi dari tool WhatsApp CRM lama |
| [🔁 Convert Lead → Customer](./crm-convert.md) | Flow konversi + auto-create Penawaran/RAB |
| [👥 Data Pelanggan (Customer)](./customers.md) | Master klien B2B + analytics + integrasi ke Penawaran/RAB/Event |

## 📑 Penawaran & RAB Event

| Halaman | Fungsi |
|---|---|
| [📄 Penawaran Booth/Event](./penawaran-event.md) | SPH variant SEWA & PENGADAAN_BOOTH |
| [🧮 RAB Event](./rab-event.md) | Rencana Anggaran Biaya internal per project |
| [📦 Save RAB as Product](./rab-to-product.md) | Convert item RAB jadi katalog produk reusable — booth standar siap jual via POS / SPH / RAB lain |
| [🏭 Data Supplier](./suppliers.md) | Manajemen vendor material booth |

## 🏪 Operasional Event

| Halaman | Fungsi |
|---|---|
| [📅 Event Timeline (Gantt)](./event-timeline.md) | Gantt-style command center untuk semua event paralel — drag-drop reschedule, conflict detection, RAB margin chip, export iCal |
| [👷 Setup Time Tracking Crew](./crew-tracking.md) | Assign crew ke event, kirim WA link unik → crew check-in/check-out di lokasi (foto opsional) → laporan durasi & ranking |
| [📝 Surat Order Designer](./sales-order.md) | Work order ke designer untuk digital printing (banner/poster/X-banner) — public link, upload proof, convert ke POS |
| [🖨️ Antrian Produksi](./produksi.md) | Job queue produksi booth (cutting → kirim) |
| [🖨️ Antrian Cetak Paper](./mesin-cetak.md) | Sub-queue cetak material paper |
| [📋 Stok Opname](./stock-opname.md) | Audit stok material berkala |
| [📤 Peminjaman Stok (Foto)](./peminjaman-stok.md) | Pinjam material dari gudang dengan konfirmasi foto checkout & return |

## 💰 Laporan & Keuangan

| Halaman | Fungsi |
|---|---|
| [💸 Cashflow Bisnis](./cashflow.md) | Arus kas masuk/keluar per event |
| [📊 Laporan Stok](./laporan-stok.md) | Mutasi material booth |
| [🧮 Kalkulator HPP](./hpp-calculator.md) | Hitung modal material per booth |
| [🗺️ Peta Cuan Lokasi](./peta-cuan.md) | Visualisasi lokasi event/pameran |

## ⚙️ Pengaturan & Teknis

| Halaman | Fungsi |
|---|---|
| [💾 Backup & Restore](./backup.md) | Export ZIP database (CRM + RAB + dll), restore satu klik |
| [🚀 Panduan Deployment](./deployment.md) | Pasang di home server / VPS |

---

## 📌 Tentang Aplikasi

- **Nama**: Pospro Event
- **Author**: Muhammad Faishal Abdul Hakim
- **Stack**: NestJS 11 + Prisma 6 + MySQL · Next.js 16 + React 19 + TanStack Query · VitePress 1.6
- **License**: Internal (operasional vendor booth & event)

### Modul Inti

- **CRM** — Lead Pipeline, Kanban drag-drop, Import XLSX, WhatsApp click-to-chat, Convert ke Customer
- **Penawaran (SPH)** — Variant SEWA & PENGADAAN_BOOTH, nomor Indonesia, cetak PDF
- **RAB Event** — Material/Jasa/Transport/Akomodasi, kalkulasi margin, lifecycle DRAFT → CLOSED
- **Produksi** — Job queue booth, PIN operator, batch, tracking per tahap
- **Stok & Supplier** — Inventori material, varian, BOM, opname
- **Cashflow** — Arus kas otomatis + manual, chart tren, export Excel
- **Backup** — ZIP semua tabel (termasuk CRM), restore satu klik
