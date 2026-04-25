# 📄 Penawaran Booth & Event (SPH)

**Penawaran** = Surat Penawaran Harga (SPH) yang dikirim ke calon klien sebelum deal. Di Pospro Event, penawaran disesuaikan untuk industri vendor booth & pameran.

## Variant

Pospro Event mendukung 2 variant utama:

| Variant | Untuk | Konten Khas |
|---|---|---|
| **SEWA** | Sewa booth jadi (rental) | Tarif harian/per-event, durasi, lokasi pameran |
| **PENGADAAN_BOOTH** | Custom build / pengadaan booth | Material list, ukuran, spec finishing, jasa pasang |

## Halaman

| URL | Fungsi |
|---|---|
| `/penawaran` | List semua penawaran (filter status: DRAFT / SENT / ACCEPTED / REJECTED) |
| `/penawaran/new?variant=SEWA` | Buat penawaran sewa baru |
| `/penawaran/new?variant=PENGADAAN_BOOTH` | Buat penawaran pengadaan baru |
| `/penawaran/[id]` | Detail + edit + cetak PDF |
| `/penawaran?customerId=X` | Filter ke customer tertentu (dipakai shortcut dari CRM) |

## Format Nomor

Format Indonesia standar: `SPH/<bulan-romawi>/<tahun>/<seq>` — mis. `SPH/IV/2026/0042`.

Reset sequence per tahun. Generated otomatis di backend (`app/backend/src/penawaran/penawaran.service.ts`).

## Struktur Dokumen

```
[Logo Pospro Event]                         No: SPH/IV/2026/0042
                                            Tanggal: 25 April 2026

Kepada Yth.
Bp. Ivan
PT. JAPURA
Surabaya

Perihal: Penawaran Sewa Booth Pameran Juni 2026

Dengan hormat,
Berikut kami sampaikan penawaran ...

┌──────────────────────────────────────────────┐
│ No │ Item              │ Qty │ Harga  │ Total │
├──────────────────────────────────────────────┤
│  1 │ Booth 3x3 Custom  │  1  │ 8jt    │ 8jt   │
│  2 │ Lighting Set      │  1  │ 1.5jt  │ 1.5jt │
│  3 │ Setup & Bongkar   │  1  │ 2jt    │ 2jt   │
└──────────────────────────────────────────────┘
                      Subtotal: Rp 11.500.000
                      PPN 11%:  Rp  1.265.000
                      TOTAL:    Rp 12.765.000

Hormat kami,
[TTD]
Muhammad Faishal Abdul Hakim
Pospro Event
```

## Konversi

- **Dari Lead**: tombol Convert di CRM otomatis bikin draft penawaran ter-link.
- **Ke RAB**: dari halaman penawaran, tombol "Buat RAB" → bikin RabPlan dengan item yang sama.
- **Ke Invoice (final)**: setelah klien ACCEPT, klik "Convert ke Invoice" → status SPH jadi ACCEPTED, Invoice baru dibuat dengan nomor `INV/<bln>/<thn>/<seq>`.

## Cetak PDF

Tombol **Cetak** di detail penawaran → render PDF (A4 portrait), siap kirim ke klien via WhatsApp/Email.
