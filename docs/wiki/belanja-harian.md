# 🛒 Buku Belanja Harian — Pospro Event

Modul **Belanja Harian** mencatat pengeluaran belanja operasional event secara cepat & mobile. Konsepnya: admin memegang **satu kantong kas** (uang dari owner), lalu tiap belanja dicatat dan **di-tag** ke event/RAB tertentu (jadi *real cost*) atau ke "keperluan lain". Tujuannya menghindari lupa/ketuker uang keluar untuk apa.

> **Persetujuan cukup lisan.** Tidak ada alur pengajuan/approval di sistem — begitu uang diterima & dibelanjakan, langsung dicatat.

## Akses

Menu sidebar: **Keuangan → Belanja Harian** (`/belanja`).

## Konsep Inti

| Hal | Perilaku |
|---|---|
| **Kas satu kantong** | Uang dari owner dicatat via **Uang Masuk**. Saldo = Σ uang masuk − Σ belanja. |
| **Tag per-transaksi** | Tiap belanja wajib di-tag: **Untuk Event** (→ real cost RAB) atau **Keperluan Lain** (kategori bebas). |
| **Real cost RAB** | Belanja yang di-tag ke event ber-RAB otomatis jadi realisasi RAB, tampil di halaman RAB (rencana vs real per pos). |
| **Per-admin** | Tiap entri teratribusi ke admin. Ada opsi input atas nama admin lain. Saldo bisa dilihat global atau per-admin. |
| **Sinkron Cashflow** | Tiap belanja otomatis membuat 1 entri `Cashflow` EXPENSE (`excludeFromShift=true`, ter-tag event/RAB) supaya laba `event-profit` akurat. Hapus belanja → cashflow-nya ikut terhapus. |

## Input Belanja Cepat

Tombol **+ Catat Belanja** membuka sheet mobile-friendly:

1. **Nominal** (besar, autofocus)
2. **Untuk apa?** (deskripsi, mis. "Beli cat")
3. **Tag**: *Untuk Event* (pilih event + pos anggaran opsional) / *Keperluan Lain* (kategori bebas)
4. **Tanggal** (default hari ini)
5. **Upload nota** (bisa langsung kamera HP)
6. (Opsional) **Atas nama admin** lain

## Rekap Harian

Daftar belanja dikelompokkan otomatis **per hari** dengan total per hari. Tiap baris menampilkan deskripsi, badge tag (kode event / kategori "Lainnya"), pos anggaran, admin, link nota, dan nominal.

## Endpoint Backend

| Method | Path | Fungsi |
|---|---|---|
| GET | `/kas/summary?userId=` | Ringkasan kas (global / per-admin) |
| GET | `/kas/by-admin` | Saldo kas per admin |
| GET | `/kas/penerimaan?userId=` | Daftar uang masuk |
| POST | `/kas/penerimaan` | Catat uang masuk (opsional `attributeToUserId`) |
| DELETE | `/kas/penerimaan/:id` | Hapus penerimaan |
| GET | `/belanja?from=&to=&eventId=&rabPlanId=&untagged=` | Daftar belanja |
| GET | `/belanja/rekap-harian?from=&to=` | Rekap per hari |
| GET | `/belanja/realisasi-rab/:rabPlanId` | Realisasi rencana vs real per pos |
| POST | `/belanja` | Catat belanja (auto real cost + auto Cashflow) |
| POST | `/belanja/:id/nota` | Upload nota (gambar/PDF) |
| DELETE | `/belanja/:id` | Hapus belanja (+ cashflow-nya) |

## ⚠️ Perhatian: Double-count dengan "Generate Cashflow dari RAB"

Fitur lama **"💸 Generate Cashflow dari RAB"** juga membuat entri expense ber-`rabPlanId`. Kalau dipakai **bersamaan** dengan Buku Belanja untuk event yang sama, laba `event-profit` akan **dobel hitung**.

> **Rekomendasi:** untuk event yang dikelola lewat Buku Belanja Harian, **jangan** pakai Generate Cashflow dari RAB. Biarkan realisasi berasal dari belanja aktual.

## Catatan

- **Envelope soft** — saldo tidak terkunci per-event; "tidak kecampur" dijaga lewat tag wajib + laporan per-event/RAB.
- **Event tanpa RAB** — belanja tetap bisa di-tag ke event, hanya tidak muncul sebagai realisasi RAB.
- **Edit belanja** belum ada (MVP) — koreksi = hapus + input ulang.

## Lihat Juga

- [RAB Event](./rab-event.md) — realisasi belanja tampil di halaman RAB
- [Cashflow Bisnis](./cashflow.md) — tiap belanja tersinkron ke sini sebagai EXPENSE

---

**© 2026 Muhammad Faishal Abdul Hakim · Pospro Event · All rights reserved.**
