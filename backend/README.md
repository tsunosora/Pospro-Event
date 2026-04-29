# Pospro Event — Backend

Backend NestJS 11 + Prisma 6 + MySQL untuk aplikasi **Pospro Event** (manajemen vendor booth & event).

**By Muhammad Faishal Abdul Hakim**

---

## 🧱 Tech Stack

- **Framework**: NestJS 11
- **ORM**: Prisma 6 (MySQL)
- **Auth**: JWT + Passport
- **PDF Generator**: Puppeteer + Handlebars
- **DOCX**: docx library
- **Excel**: ExcelJS
- **Backup**: archiver + adm-zip
- **WhatsApp Bot**: whatsapp-web.js
- **Image Upload**: Multer + Sharp (compression)

---

## 🚀 Quick Setup

```bash
# 1. Install deps
npm install

# 2. Setup .env
cp .env.example .env
# Edit DATABASE_URL, JWT_SECRET

# 3. Push schema ke database
npx prisma db push --accept-data-loss

# 4. Seed master data
npx ts-node prisma/seed.ts          # admin user + units + categories
npx ts-node prisma/seed-crm.ts      # CRM stages + labels
npx ts-node prisma/seed-brands.ts   # Brand settings (Exindo + Xposer)

# 5. Run dev server
npm run start:dev
# → http://localhost:3001
```

## 📦 Build Production

```bash
npm run build
npm run start:prod
```

## 🧪 Testing

```bash
npm run test         # unit tests
npm run test:e2e     # end-to-end
npm run test:cov     # coverage
```

## 📂 Struktur Modul

```
src/
├── auth/                    JWT auth
├── users/                   User CRUD
├── customers/               Pelanggan + analytics
├── workers/                 Karyawan (Marketing/Sales/Tukang/dll)
├── crm/                     Lead pipeline
├── rab/                     RAB plan + items
├── quotations/              Penawaran (SPH)
├── invoice/                 Invoice generation
├── inventory-acquisitions/  Tracking inventaris dari RAB
├── public-gudang/           Kiosk PIN-gated (tukang lapangan)
├── warehouse-pin/           PIN guard
├── stock-opname/            Stok opname (token-based)
├── withdrawals/             Pinjam/Pakai barang
├── events/                  Event timeline & crew
├── cashflow/                Arus kas masuk/keluar
├── backup/                  Export/import ZIP backup (v2.6)
├── exporters/               PDF/DOCX/XLSX templates
├── brands/                  Multi-brand config
├── notifications/           Real-time SSE notification
└── ...                      (40+ modules)
```

---

## 📄 Lisensi

**Copyright © 2026 Muhammad Faishal Abdul Hakim**
**All rights reserved.**

Proprietary software untuk operasional internal **CV. Exindo Pratama** & **CV. Xposer Event**. Lihat [`../LICENSE`](../LICENSE) untuk detail.

---

**© 2026 Muhammad Faishal Abdul Hakim · Pospro Event · All rights reserved.**
