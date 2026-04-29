# 📲 Install Pospro Event sebagai Aplikasi

Pospro Event sudah didukung sebagai **PWA (Progressive Web App)** — bisa di-install seperti aplikasi native di **HP, tablet, dan desktop** lewat browser. Tidak perlu Play Store / App Store.

---

## 🎯 Kenapa Install sebagai App?

| Kalau install | Manfaat |
|---|---|
| **Icon di home screen** | Tap langsung buka app, gak perlu buka browser dulu |
| **Full-screen mode** | Gak ada address bar — area kerja lebih lega |
| **Lebih cepat** | Asset di-cache, loading kedua kali instant |
| **Sebagian fitur offline** | Halaman yang sudah dibuka tetap bisa diakses tanpa internet |
| **Nama "Pospro Event"** di task bar / app drawer | Look & feel app native |

**Cocok untuk:**
- 📱 **HP tukang** — buka kiosk Stok Lapangan tanpa buka browser dulu
- 📱 **HP marketing** — akses CRM cepat di lapangan
- 💻 **Laptop admin** — desktop app feel, multi-window OK
- 📱 **Tablet kasir** — Order Booth/Event jalan kayak app POS

---

## 📱 Install di Android (Chrome / Edge)

1. Buka **Chrome** atau **Edge** di HP Android
2. Akses URL Pospro Event (mis. `https://pospenawaran.exindo.com`)
3. Login normal pakai email + password
4. Browser akan tampilkan **prompt "Install Pospro Event"** otomatis di bagian bawah layar
   - Kalau gak muncul: ketuk titik tiga `⋮` di pojok kanan atas → pilih **"Install app"** atau **"Add to home screen"**
5. Tap **"Install"** → konfirmasi
6. Icon Pospro Event muncul di home screen 🎉

**Tap icon → app langsung buka full-screen** (gak ada URL bar).

---

## 🍎 Install di iPhone / iPad (Safari)

iOS pakai cara berbeda:

1. Buka **Safari** (harus Safari, bukan Chrome di iOS)
2. Akses URL Pospro Event
3. Login normal
4. Tap tombol **Share** (kotak dengan panah ke atas, di toolbar bawah)
5. Scroll ke bawah → tap **"Add to Home Screen"** / **"Tambahkan ke Layar Utama"**
6. Edit nama (default: "Pospro Event") → tap **"Add"** / **"Tambah"**
7. Icon muncul di home screen

**Tip iOS**: Setelah install, login ulang dari icon — sesi browser & app terpisah.

---

## 💻 Install di Desktop (Chrome / Edge / Brave)

1. Buka Chrome/Edge/Brave
2. Akses URL Pospro Event → login
3. Lihat di **address bar** — ada icon **install (⊕ atau monitor kecil)** di sebelah kanan URL
4. Klik icon tersebut
5. Confirm **"Install"**
6. App terbuka di window terpisah (tanpa tab/address bar) + icon muncul di:
   - **Windows**: Start Menu + Taskbar (kalau di-pin)
   - **Mac**: Applications + Dock (kalau di-pin)
   - **Linux**: App launcher

**Dari menu**:
- Chrome: titik tiga `⋮` → **"Install Pospro Event..."**
- Edge: titik tiga `...` → **"Apps"** → **"Install this site as an app"**

---

## 🔄 Update Aplikasi

Saat ada update di server, app **auto-update** saat dibuka kembali (tidak perlu uninstall/reinstall).

Kalau update gak masuk-masuk:
1. Tutup app sepenuhnya (force close)
2. Buka lagi → tunggu 5-10 detik (service worker update di background)
3. **Hard refresh** kalau perlu: tahan icon refresh di address bar (kalau masih ada) → "Empty cache and hard reload"

---

## 🗑️ Uninstall

### Android
- Long-press icon di home screen → **"Uninstall"** / **"Hapus"**

### iOS
- Long-press icon → **"Remove App"** → **"Delete from Home Screen"**

### Desktop
- Buka app → klik titik tiga di pojok app window → **"Uninstall Pospro Event..."**
- Atau: control panel / system settings → cari "Pospro Event" → uninstall

---

## ⚙️ Untuk Admin / IT

### Persyaratan Server (PWA Requirement)

PWA **wajib HTTPS** di production (kecuali localhost). Pastikan:
- ✅ Domain pakai SSL certificate (mis. Let's Encrypt via Certbot, Cloudflare, dll.)
- ✅ HTTP otomatis redirect ke HTTPS
- ✅ Tidak ada mixed content (semua asset HTTPS)

### File yang harus accessible publicly

Tanpa autentikasi (di-whitelist di middleware):
- `/manifest.webmanifest` — manifest file
- `/sw.js` — service worker
- `/icon.svg`, `/icon-192.png`, `/icon-512.png`, `/apple-touch-icon.png` — icon files
- `/favicon.ico`, `/favicon-16.png`, `/favicon-32.png`

### Verifikasi PWA berhasil

Buka **Chrome DevTools** → tab **Application**:
- **Manifest** section: harus tampilkan name, theme_color, icons (no error)
- **Service Workers** section: status **activated and is running**
- **Cache Storage**: harus ada `pospro-v1-static` setelah load pertama

### Lighthouse audit

Run Lighthouse PWA audit (Chrome DevTools → Lighthouse tab):
- ✅ Manifest: PASS
- ✅ Service worker: PASS
- ✅ Splash screen ready: PASS
- ✅ Themed omnibox: PASS

---

## 🔧 Troubleshooting

### "Install app" prompt gak muncul di Android
- Pastikan akses via **HTTPS** (bukan HTTP)
- Buka di **Chrome/Edge**, bukan in-app browser (mis. dari WhatsApp browser)
- Coba clear browser data: Settings → Site settings → cari domain → Clear

### Icon di home screen blank / error
- Generate ulang icon: `cd backend && node scripts/gen-pwa-icons.mjs`
- Hard refresh browser, uninstall + reinstall app

### Service worker error di console
- Buka DevTools → Application → Service Workers → klik **"Unregister"**
- Refresh halaman → service worker baru di-register dari scratch

### App terbuka tapi loading lambat / blank
- Service worker mungkin cache versi lama → DevTools → Cache Storage → delete semua cache → refresh

### Notifikasi tidak masuk
- Notif push belum diimplementasi di v1.1 — saat ini hanya in-app notification via SSE (Server-Sent Events). Push notification offline planned di phase berikutnya.

---

## 🆚 PWA vs Native App

| Hal | PWA (saat ini) | Native (future) |
|---|---|---|
| **Install dari** | Browser | Play Store / App Store |
| **Butuh approval store** | ❌ Tidak | ✅ Ya |
| **Push notification** | ⚠️ Limited (web push) | ✅ Full native |
| **Akses kamera/foto** | ✅ Via browser API | ✅ Native API |
| **Akses GPS** | ✅ Via browser API | ✅ Native API |
| **Akses storage HP** | ⚠️ Sandboxed | ✅ Full access |
| **Update app** | ✅ Otomatis dari server | ⚠️ Lewat store |
| **Biaya** | ✅ Gratis | 💰 $25 Play / $99/yr Apple |

**Saran**: Pakai PWA dulu untuk MVP & internal team. Kalau butuh distribusi publik atau fitur native dalam (seperti background sync, file system akses), nanti baru wrap ke Capacitor/Cordova/Tauri.

---

## 🎨 Customize Icon / Branding

Kalau mau ganti icon dengan logo perusahaan:

1. Replace **`app/frontend/public/icon.svg`** dengan logo SVG kamu (kanvas 512×512)
2. Run script regenerate PNG:
   ```bash
   cd app/backend
   node scripts/gen-pwa-icons.mjs
   ```
3. Edit `app/frontend/public/manifest.webmanifest`:
   - Ubah `name`, `short_name`, `description`
   - Sesuaikan `theme_color`, `background_color` dengan brand
4. Build production: `cd app/frontend && npm run build && npm run start`
5. User uninstall + reinstall app untuk dapat icon baru

---

::: info Dokumentasi terkait
- [💾 Backup & Restore](./backup) — versi 2.6
- [🚀 Panduan Deployment](./deployment)
:::

---

**© 2026 Muhammad Faishal Abdul Hakim · Pospro Event · All rights reserved.**
[Lihat lisensi lengkap →](./license)
