# Sistem Notifikasi Real-Time

Dokumentasi lengkap sistem notifikasi real-time pada aplikasi PosPro POS.

---

## Arsitektur Umum

```
[Frontend App]                        [Backend NestJS]
  Header Bell Icon  ◄── SSE ──────── GET /notifications/stream
  ShiftReminderBanner                     ▲
  useNotificationStream                   │ NotificationsService
  useShiftReminder (timer)            ────┤   (RxJS Subject)
                                          │
  POS page (order berhasil) ─────────────►│ checkLowStock()
  SyncManager (sync selesai) ────────────►│ notifyNewTransactionDiscord()
                                          │
  POST /webhook/github ───────────────────┘
                                          │
                                          ▼
                                   Discord Webhook URL
                                   (fetch POST keluar)
```

### Komponen Kunci

| Layer | File | Fungsi |
|-------|------|--------|
| Backend | `notifications/notifications.service.ts` | RxJS Subject, emit SSE, `sendToDiscord()` |
| Backend | `notifications/notifications.controller.ts` | SSE endpoint `/notifications/stream` |
| Backend | `webhook/webhook.controller.ts` | Terima push event dari GitHub |
| Backend | `transactions/transactions.service.ts` | Emit low-stock & kirim Discord saat transaksi |
| Frontend Store | `store/notification-store.ts` | Zustand + IndexedDB, state banner shift |
| Frontend Hook | `hooks/useNotificationStream.ts` | EventSource SSE client + auto-reconnect |
| Frontend Hook | `hooks/useShiftReminder.ts` | Timer harian untuk 2 shift |
| Frontend UI | `components/layout/Header.tsx` | Bell icon + dropdown list notifikasi |
| Frontend UI | `components/layout/ShiftReminderBanner.tsx` | Popup banner mencolok saat waktu shift |
| Frontend UI | `app/settings/notifications/page.tsx` | Halaman konfigurasi notifikasi |

---

## Backend

### 1. Server-Sent Events (SSE)

Endpoint: `GET /notifications/stream?token=<jwt>`

> **Perhatian:** EventSource browser tidak mendukung custom header, sehingga JWT dikirim via query parameter, bukan header `Authorization`.

```typescript
// notifications.controller.ts
@Sse('stream')
stream(@Query('token') token: string): Observable<MessageEvent> {
    // verifikasi JWT manual
    // return Observable dari NotificationsService
}
```

Payload event SSE:
```json
{
  "data": {
    "type": "transaction | stock | shift | update | system",
    "title": "Judul Notifikasi",
    "message": "Isi pesan notifikasi"
  }
}
```

### 2. Emit Notifikasi dari Service Lain

Inject `NotificationsService` ke service/controller manapun:

```typescript
constructor(private notificationsService: NotificationsService) {}

// Emit ke semua client yang terhubung
this.notificationsService.emit({
    type: 'stock',
    title: 'Stok Hampir Habis',
    message: 'Kertas A4: sisa 3 rim',
});

// Kirim ke Discord
await this.notificationsService.sendToDiscord(webhookUrl, 'Pesan Discord');
```

### 3. Trigger Notifikasi

| Event | Trigger | SSE | Discord |
|-------|---------|-----|---------|
| Transaksi baru | `transactions.service.ts` setelah `create()` | ❌ frontend | ✅ |
| Stok menipis | `transactions.service.ts` → `checkLowStock()` | ✅ | ✅ |
| Tutup shift | `reports.service.ts` → `closeShift()` | ❌ | ✅ |
| GitHub commit | `webhook.controller.ts` → `handleGithub()` | ✅ | ✅ |

> **Catatan:** Notifikasi transaksi baru ditambahkan di sisi **frontend** (POS page `onSuccess`) karena semua data sudah tersedia di client. Discord dikirim dari **backend**.

### 4. GitHub Webhook

Endpoint: `POST /webhook/github`

Cara kerja:
1. Developer push commit ke GitHub
2. GitHub POST ke endpoint di atas dengan header `x-hub-signature-256`
3. Backend verifikasi HMAC-SHA256 menggunakan `githubWebhookSecret` dari settings
4. Jika valid → emit SSE ke semua client → (opsional) kirim ke Discord

**Setup di GitHub:**
1. Repository Settings → Webhooks → Add webhook
2. Payload URL: `https://domain-kamu.com/webhook/github`
3. Content type: `application/json`
4. Secret: sama dengan `githubWebhookSecret` di Settings aplikasi
5. Events: **Just the push event**

---

## Frontend

### 1. Notification Store (Zustand + IndexedDB)

File: `store/notification-store.ts`

```typescript
interface AppNotification {
    id: string;
    type: 'transaction' | 'stock' | 'sync' | 'shift' | 'update' | 'system';
    title: string;
    message: string;
    timestamp: number;
    read: boolean;
}
```

**State:**
- `notifications[]` — list notifikasi (max 50, terbaru di atas)
- `unreadCount` — jumlah belum dibaca
- `shiftBanner` — state popup banner shift reminder

**Actions:**
```typescript
addNotification({ type, title, message })  // tambah notif baru
markRead(id)                               // tandai satu notif dibaca
markAllRead()                             // tandai semua dibaca
clearAll()                                // hapus semua notifikasi
showShiftBanner(label, time)              // tampilkan popup banner
dismissShiftBanner()                      // tutup popup banner
```

**Persistensi:** Notifikasi disimpan ke IndexedDB (`pos-notifications-db`) sehingga tetap ada setelah reload/restart browser.

### 2. Hook: useNotificationStream

File: `hooks/useNotificationStream.ts`

Koneksi SSE ke backend, parse event, dan simpan ke store. Fitur:
- **JWT otomatis** dari `localStorage` atau `sessionStorage`  
- **Auto-reconnect** 5 detik jika koneksi terputus
- Cleanup otomatis saat komponen unmount

Dipasang di `MainLayout` melalui `AppInitializer` — aktif di semua halaman authenticated.

### 3. Hook: useShiftReminder

File: `hooks/useShiftReminder.ts`

Timer browser yang berjalan setiap hari untuk mengingatkan tutup shift. Mendukung **2 shift** sekaligus:
- **Shift 1** — jam yang dikonfigurasi di `shiftReminderTime`
- **Shift 2** — jam yang dikonfigurasi di `shiftReminderTime2`

Saat waktu tiba:
1. Tambah notifikasi ke bell icon (`addNotification`)
2. Tampilkan popup banner mencolok (`showShiftBanner`)

> Timer adalah **client-side only**, tidak butuh backend. Berjalan selama tab browser terbuka.

### 4. Komponen: ShiftReminderBanner

File: `components/layout/ShiftReminderBanner.tsx`

Popup banner fullscreen yang muncul saat waktu shift tiba. Fitur:
- Overlay blur seluruh layar
- Icon bell bergoyang (animasi wiggle)
- Badge merah ping
- **Countdown ring SVG** 60 detik (auto-dismiss jika tidak ada aksi)
- Tombol **"Buka Laporan Shift"** → redirect ke `/pos/close-shift`
- Tombol **"Nanti"** → dismiss

### 5. Header Bell Icon

File: `components/layout/Header.tsx`

**Badge merah** di ikon bell menampilkan jumlah notifikasi belum dibaca (max tampil `9+`).

**Panel dropdown** saat bell diklik:
- List notifikasi terbaru (max 12 tampil)
- Icon berbeda per tipe:
  - 🛒 `transaction` — hijau
  - 📦 `stock` — amber
  - 🔄 `sync` — biru
  - 📄 `shift` — indigo
  - 🔧 `update` (GitHub) — violet
  - ℹ️ `system` — abu
- Item belum dibaca tampil dengan highlight + dot biru
- Klik item → tandai dibaca
- Tombol **"Semua dibaca"** dan **🗑 Hapus semua**
- Timestamp relatif: "2 menit lalu", "3 jam lalu"
- Link ke **Pengaturan Notifikasi**

---

## Halaman Pengaturan Notifikasi

URL: `/settings/notifications`

### Seksi 1: Notifikasi Aplikasi (In-App)

| Toggle | Deskripsi |
|--------|-----------|
| Transaksi Baru | Notif di bell setelah order berhasil |
| Stok Hampir Habis | Notif + Discord saat stok ≤ threshold |
| Sinkronisasi Offline Selesai | Notif saat data offline berhasil diunggah |
| Pengingat Tutup Shift | Aktifkan timer shift reminder |

Jika pengingat shift aktif:
- **Input jam Shift 1** (misal `08:00`)
- **Input jam Shift 2** (misal `17:00`)
- Input threshold stok minimum (default: 5 unit)

### Seksi 2: Integrasi Discord

- Input **Discord Webhook URL**
- Tombol **"Kirim Test"** — kirim pesan test langsung ke Discord
- Notifikasi yang dikirim ke Discord: transaksi baru, stok hampir habis, tutup shift, commit GitHub

### Seksi 3: Integrasi GitHub Webhook

- Toggle **"Aktifkan Notifikasi Commit GitHub"**
- Field **URL Webhook** (readonly) + tombol **Salin**
- Field **Secret Token** (untuk verifikasi HMAC)
- Panduan step-by-step cara daftarkan di GitHub

---

## Format Notifikasi Discord

### Order Berhasil Masuk

```
🛒 Order Berhasil Masuk
━━━━━━━━━━━━━━━━━━━━━
📋 Invoice: `INV-20260331-0001`
👥 Pelanggan: Ahmad Faisal
👤 Kasir: Budi
🧑‍🔧 Desainer/Operator: Deni
📅 Estimasi Selesai: Sen, 3 Apr 2026
🚀 PRIORITAS: EXPRESS

🧾 Detail Item:
  1. Spanduk Banner [1.2×2.5m] — Rp 90.000
     📝 Logo ACME, laminasi doff
  2. Stiker Vinyl [50×50cm] ×3pcs — Rp 45.000

━━━━━━━━━━━━━━━━━━━━━
💰 Total: Rp 135.000  |  💳 Transfer
```

### Stok Hampir Habis

```
⚠️ Stok Hampir Habis
Kertas A4 - Rim: sisa 3 unit
```

### Tutup Shift

```
📊 Laporan Shift Ditutup — [Kasir] ...
```

### Commit GitHub

```
🔄 Pembaruan Aplikasi
👤 developer push 2 commit ke `main`
📝 feat: tambah fitur notifikasi real-time
```

---

## Tips & Troubleshooting

### SSE tidak terhubung (`ERR_CONNECTION_REFUSED`)
- Pastikan backend berjalan di port 3001
- Hook akan **auto-reconnect otomatis** setiap 5 detik

### Notifikasi Discord tidak terkirim
- Pastikan URL webhook valid dan tidak expired
- Cek toggle "Notifikasi Transaksi Baru" di /settings/notifications
- Discord webhook hanya dari **backend** — tidak dari browser langsung

### Stok produk cetak (trackStock=false) salah trigger notif stok
- Fixed: `checkLowStock()` di backend sekarang hanya cek produk dengan `trackStock: true`

### Timer shift reminder tidak muncul
- Timer berjalan **di browser** — tab harus tetap terbuka
- Jika jam sudah lewat hari ini, timer akan muncul keesokan harinya
- Test: set jam 1-2 menit dari sekarang, simpan, tunggu

### GitHub webhook gagal verifikasi
- Pastikan `githubWebhookSecret` di Settings sama persis dengan Secret di GitHub Webhooks
- Kosongkan secret jika tidak ingin verifikasi (kurang aman)
