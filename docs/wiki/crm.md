# 🎯 CRM / Lead Pipeline — Overview

Modul **CRM (Customer Relationship Management)** di Pospro Event dirancang khusus untuk vendor booth & event yang menerima lead dari banyak channel: **META Ads, WhatsApp, Website, Referral, Walk-in**.

## Konsep Inti

Setiap kontak masuk dicatat sebagai **Lead** — entitas terpisah dari `Customer`. Lead bergerak melalui **Stage** (Lead Masuk → Follow Up → Penawaran → Negosiasi → Closed Deal / Lost) dalam tampilan **Kanban drag-drop**.

Saat lead deal (stage Closed Deal), satu klik **Convert** akan membuat:
- `Customer` baru (auto-link ke lead asal)
- Opsional: draft **Penawaran** (variant SEWA / PENGADAAN_BOOTH)
- Opsional: draft **RAB Event**

## Halaman Utama

| Halaman | URL | Fungsi |
|---|---|---|
| Dashboard CRM | `/crm` | 4 stat cards (Today / Week / Month / Conversion %), breakdown by source |
| Pipeline Kanban | `/crm/board` | Drag-drop antar stage, filter PIC/Label, search |
| Daftar Lead | `/crm/leads` | Table view dengan filter lengkap |
| Tambah Lead | `/crm/leads/new` | Form manual entry |
| Import XLSX | `/crm/import` | Upload export tool lama, dry-run/commit |
| Stages | `/crm/stages` | Atur kolom kanban + warna |
| Labels | `/crm/labels` | Atur label (Hot/Warm/Cold/custom) |

## Struktur Data

- **Lead** — nama, phone (auto-normalize ke E.164), organization, productCategory, level (HOT/WARM/COLD), source (META_ADS/WHATSAPP/WEBSITE/...), status, stageId, assignedWorkerId, followUpDate, projectValueEst, eventDate, eventLocation
- **LeadStage** — kolom kanban; field `isTerminal` (sembunyikan dari kanban default), `isWinStage` (unlock tombol Convert)
- **LeadLabel** — chip warna multi-assign (M:N via `LeadLabelOnLead`)
- **LeadActivity** — timeline (GREETING_SENT, COMPRO_SENT, RESPONSE, NOTE, STAGE_CHANGED, CONVERTED)

## Quick Actions di Card

- **Tombol WA** → buka `https://wa.me/<phone>?text=<template>` di tab baru
- **Klik card** → drawer detail dengan 3 tab (Detail / Activities / Convert)
- **Drag** → pindah antar stage / reorder dalam stage (optimistic update + rollback)

## Lihat Juga

- [Pipeline Kanban](/crm-kanban) — cara pakai drag-drop
- [Import Lead XLSX](/crm-import) — migrasi dari tool lama
- [Convert Lead → Customer](/crm-convert) — flow lengkap konversi
