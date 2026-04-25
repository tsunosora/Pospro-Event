# 🚀 Panduan Deployment Pospro Event

Pasang Pospro Event di home server (Windows/Linux) atau VPS publik. Pakai **PM2** untuk process manager dan **Cloudflare Zero Trust Tunnel** untuk akses publik tanpa port forwarding.

## Pilihan Deployment

| Skenario | Cocok untuk |
|---|---|
| **A. Localhost (Dev)** | Testing, single-user di laptop |
| **B. Home Server (LAN-only)** | Tim kecil, akses via WiFi kantor |
| **C. Home Server + Cloudflare Tunnel** | Akses publik tanpa VPS, tanpa public IP |
| **D. VPS (Linux)** | Production, multi-user, uptime tinggi |

---

## A. Localhost (Quick)

```bash
# Backend
cd app/backend
npm install
cp .env.example .env       # set DATABASE_URL, JWT_SECRET
npx prisma db push --accept-data-loss
npx ts-node prisma/seed.ts
npx ts-node prisma/seed-crm.ts
npm run start:dev          # → :3001

# Frontend (terminal lain)
cd app/frontend
npm install
cp .env.example .env.local
npm run dev                # → :3000
```

Akses: `http://localhost:3000`

---

## B. Home Server LAN (Windows + XAMPP/Laragon)

1. **Install prasyarat**
   - Node.js 20+ (LTS)
   - XAMPP atau Laragon (untuk MySQL)
   - Git

2. **Clone & install**
   ```powershell
   git clone <repo-url> C:\Apps\pospro-event
   cd C:\Apps\pospro-event\app\backend
   npm install
   ```

3. **Setup database**
   - Buka phpMyAdmin → bikin database `pospro_event`.
   - Edit `.env`:
     ```
     DATABASE_URL="mysql://root:@localhost:3306/pospro_event"
     JWT_SECRET="..."
     ```
   - Push schema: `npx prisma db push --accept-data-loss`
   - Seed: `npx ts-node prisma/seed.ts && npx ts-node prisma/seed-crm.ts`

4. **Build production**
   ```powershell
   cd C:\Apps\pospro-event\app\backend
   npm run build
   cd ..\frontend
   npm install
   npm run build
   ```

5. **PM2 (jalankan sebagai service)**
   ```powershell
   npm install -g pm2 pm2-windows-startup
   pm2-startup install

   pm2 start C:\Apps\pospro-event\app\backend\dist\main.js --name pospro-event-api
   pm2 start "npm" --name pospro-event-web --cwd C:\Apps\pospro-event\app\frontend -- start
   pm2 save
   ```

6. **Akses dari device lain di WiFi yang sama**
   - Cek IP server: `ipconfig` → cari IPv4 (mis. `192.168.1.10`).
   - Edit `frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://192.168.1.10:3001`.
   - Rebuild frontend.
   - Akses dari HP/laptop lain: `http://192.168.1.10:3000`.

---

## C. Home Server + Cloudflare Tunnel (Akses Publik)

Lanjutan dari Skenario B. Bikin Pospro Event bisa diakses dari mana saja via `https://pospro.domain-anda.com` tanpa public IP / port forwarding.

1. **Setup domain di Cloudflare**
   - Daftar domain → arahkan nameserver ke Cloudflare.

2. **Cloudflare Zero Trust → Tunnel**
   - Login [Cloudflare Dashboard](https://dash.cloudflare.com) → Zero Trust → Networks → Tunnels.
   - Create tunnel `pospro-event` → copy install command (Windows/Linux).
   - Jalankan di server.

3. **Public Hostname**
   - Add hostname: `pospro.domain-anda.com` → Service `http://localhost:3000`.
   - Add hostname: `api.pospro.domain-anda.com` → Service `http://localhost:3001`.

4. **Update frontend env**
   ```
   NEXT_PUBLIC_API_URL=https://api.pospro.domain-anda.com
   ```
   Rebuild frontend → restart PM2.

5. **Test**
   ```bash
   curl https://pospro.domain-anda.com
   curl https://api.pospro.domain-anda.com/health
   ```

---

## D. VPS Linux (Ubuntu 22.04+)

```bash
# 1. Update sistem
sudo apt update && sudo apt upgrade -y

# 2. Install Node 20 + MySQL + PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs mysql-server git nginx
sudo npm install -g pm2

# 3. Setup MySQL
sudo mysql_secure_installation
sudo mysql -e "CREATE DATABASE pospro_event; CREATE USER 'pospro'@'localhost' IDENTIFIED BY 'STRONG_PASS'; GRANT ALL ON pospro_event.* TO 'pospro'@'localhost'; FLUSH PRIVILEGES;"

# 4. Clone & build
cd /opt && sudo git clone <repo-url> pospro-event
cd pospro-event/app/backend
sudo cp .env.example .env  # edit DATABASE_URL
sudo npm install && sudo npx prisma db push --accept-data-loss
sudo npx ts-node prisma/seed.ts && sudo npx ts-node prisma/seed-crm.ts
sudo npm run build

cd ../frontend
sudo cp .env.example .env.local  # edit NEXT_PUBLIC_API_URL=https://api.domain.com
sudo npm install && sudo npm run build

# 5. PM2 + systemd startup
pm2 start /opt/pospro-event/app/backend/dist/main.js --name api
pm2 start npm --name web --cwd /opt/pospro-event/app/frontend -- start
pm2 save && pm2 startup

# 6. Nginx reverse proxy + Let's Encrypt
sudo tee /etc/nginx/sites-available/pospro << 'EOF'
server {
  server_name pospro.domain.com;
  location / { proxy_pass http://localhost:3000; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; }
}
server {
  server_name api.pospro.domain.com;
  location / { proxy_pass http://localhost:3001; proxy_set_header Host $host; }
}
EOF
sudo ln -s /etc/nginx/sites-available/pospro /etc/nginx/sites-enabled/
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d pospro.domain.com -d api.pospro.domain.com
```

---

## Variabel Environment

### Backend (`app/backend/.env`)

```env
DATABASE_URL="mysql://USER:PASS@HOST:3306/DB"
JWT_SECRET="<random-64-char-string>"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV=production

# Backup (opsional)
BACKUP_TEMP_DIR="/tmp/pospro-backup"
```

### Frontend (`app/frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=https://api.pospro.domain.com
```

---

## Update / Upgrade

```bash
cd /opt/pospro-event
git pull
cd app/backend && npm install && npx prisma db push --accept-data-loss && npm run build
cd ../frontend && npm install && npm run build
pm2 restart all
```

> ⚠️ **Selalu backup ZIP** (`/backup`) sebelum `git pull` + `prisma db push`.

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Node 24 + nest-watch crash | Pakai Node 22 LTS untuk `start:dev`; production `start:prod` aman di Node 24 |
| Prisma `EPERM` di Windows | Stop semua process Node, coba lagi `prisma generate` |
| Cloudflare Tunnel 502 | Cek PM2: `pm2 status` — pastikan `api` & `web` online |
| Login berhasil tapi 401 di API | Cek `NEXT_PUBLIC_API_URL` di frontend `.env.local`, rebuild |
| MySQL `Too many connections` | Tambah `connection_limit` di DATABASE_URL: `?connection_limit=20` |
