# 🗂️ Pipeline Kanban — Cara Pakai

Halaman **`/crm/board`** adalah jantung modul CRM — semua aktivitas harian PIC sales fokus di sini.

## Layout

```
┌────────────────────────────────────────────────────────────┐
│ Pipeline Lead              [↻] [Import XLSX] [+ Add Lead]  │
├────────────────────────────────────────────────────────────┤
│ [🔍 Cari nama/HP/org...]  [PIC ▾]  [Label ▾]  [× Reset]    │
├────────┬────────┬────────┬────────┬────────┬───────────────┤
│Lead    │Follow  │Pena-   │Nego-   │Closed  │     Lost      │
│Masuk   │Up      │waran   │siasi   │Deal    │   (terminal)  │
│ [card] │ [card] │ [card] │ [card] │ [card] │   [hidden]    │
│ [card] │ [card] │ [card] │        │        │               │
└────────┴────────┴────────┴────────┴────────┴───────────────┘
```

## Drag-Drop

- **Pindah antar kolom** — geser card ke kolom lain. Stage berubah otomatis, log activity `STAGE_CHANGED`.
- **Reorder dalam kolom** — geser card ke posisi atas/bawah dalam kolom yang sama.
- **Optimistic update** — UI bergerak instan, request `POST /crm/leads/reorder` di-fire async. Jika gagal, board re-fetch & kembali ke posisi lama.

## Filter

| Filter | Kelakuan |
|---|---|
| Search | Cocokkan ke nama, phone, organization, productCategory, orderDescription, notes |
| PIC | Dropdown isi otomatis dari `assignedWorker` semua lead di board |
| Label | Pilih satu label → tampilkan hanya card yang punya label itu |
| Reset | Bersihkan semua filter |

> **Catatan**: Filter hanya mempengaruhi **tampilan**. Drag-drop tetap pakai data raw — orderIndex yang dikirim ke backend tidak akan rusak walau filter aktif.

## Card Anatomy

```
┌──────────────────────────────────┐
│ [HOT]  Ivan – PT. JAPURA         │
│ Special Design Kayu              │
│ 👤 Sendy   📅 2026-04-30         │
│ #SewaBooth #JuniSurabaya         │
│ ────────────────────────────     │
│ 📱 +62 877-xxxx-xxxx     [💬]    │
└──────────────────────────────────┘
```

- **Level badge** — HOT (merah) / WARM (amber) / COLD (sky)
- **Tombol WA** (💬) — buka `wa.me/...` dengan template greeting
- **Klik card** — buka drawer detail (tab Detail / Activities / Convert)

## Tips

- Stage dengan `isTerminal=true` (Closed Deal, Lost) **disembunyikan** dari kanban default — atur di `/crm/stages`.
- Tombol **Convert** muncul hanya saat lead di stage `isWinStage=true`.
- Warna kolom diambil dari `LeadStage.color` — atur di `/crm/stages`.
