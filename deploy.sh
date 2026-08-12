#!/usr/bin/env bash
#
# deploy.sh — Deploy Pospro Event di server (jalankan SETELAH SSH ke VPS).
#
#   ssh user@server
#   cd /opt/pospro-event/app      # folder repo (tempat file ini berada)
#   ./deploy.sh
#
# Alur: git pull → backend (install + prisma generate + db push + build)
#       → frontend (install + build) → restart PM2 (api & web).
#
# Opsi:
#   --backend-only     hanya deploy backend
#   --frontend-only    hanya deploy frontend
#   --no-pull          lewati `git pull`
#   --no-install       lewati `npm install`
#   --no-db            lewati `prisma db push` (hanya generate)
#   --no-build         lewati `npm run build`
#   --no-restart       lewati restart PM2
#   -h | --help        tampilkan bantuan
#
# Override lewat environment variable:
#   BRANCH=main  PM2_API=api  PM2_WEB=web  ./deploy.sh
#
set -euo pipefail

# ── Konfigurasi (bisa dioverride via env var) ──────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR"                 # = folder repo `app/`
BRANCH="${BRANCH:-main}"             # branch yang di-deploy
PM2_API="${PM2_API:-api}"           # nama proses PM2 backend
PM2_WEB="${PM2_WEB:-web}"           # nama proses PM2 frontend
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

# ── Flag ───────────────────────────────────────────────────────────────────
DO_BACKEND=1; DO_FRONTEND=1
DO_PULL=1; DO_INSTALL=1; DO_DB=1; DO_BUILD=1; DO_RESTART=1
for arg in "$@"; do
  case "$arg" in
    --backend-only)  DO_FRONTEND=0 ;;
    --frontend-only) DO_BACKEND=0 ;;
    --no-pull)       DO_PULL=0 ;;
    --no-install)    DO_INSTALL=0 ;;
    --no-db)         DO_DB=0 ;;
    --no-build)      DO_BUILD=0 ;;
    --no-restart)    DO_RESTART=0 ;;
    -h|--help)       sed -n '2,26p' "$0"; exit 0 ;;
    *) echo "Opsi tak dikenal: $arg (pakai --help)"; exit 1 ;;
  esac
done

# ── Util tampilan ──────────────────────────────────────────────────────────
if [ -t 1 ]; then C_B="\033[1m"; C_G="\033[32m"; C_Y="\033[33m"; C_R="\033[31m"; C_0="\033[0m"; else C_B=""; C_G=""; C_Y=""; C_R=""; C_0=""; fi
step() { echo -e "\n${C_B}${C_G}▶ $*${C_0}"; }
info() { echo -e "  ${C_0}$*"; }
warn() { echo -e "${C_Y}⚠ $*${C_0}"; }
die()  { echo -e "\n${C_R}✖ Deploy gagal: $*${C_0}" >&2; exit 1; }
START_TS=$(date +%s)
trap 'die "perintah error di baris $LINENO"' ERR

# ── Muat env Node bila SSH non-interaktif tak memuat PATH (nvm/fnm) ─────────
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
command -v fnm >/dev/null 2>&1 && eval "$(fnm env)" >/dev/null 2>&1 || true

# ── Prasyarat ──────────────────────────────────────────────────────────────
for bin in git node npm npx; do
  command -v "$bin" >/dev/null 2>&1 || die "'$bin' tidak ditemukan di PATH."
done
[ "$DO_RESTART" -eq 1 ] && ! command -v pm2 >/dev/null 2>&1 && { warn "pm2 tidak ada — restart dilewati."; DO_RESTART=0; }

echo -e "${C_B}Pospro Event — Deploy${C_0}"
info "Repo    : $APP_DIR"
info "Branch  : $BRANCH"
info "Node    : $(node -v)"
info "Target  : $([ "$DO_BACKEND" -eq 1 ] && echo -n 'backend ')$([ "$DO_FRONTEND" -eq 1 ] && echo -n 'frontend')"

# ── 1. Git pull ────────────────────────────────────────────────────────────
if [ "$DO_PULL" -eq 1 ]; then
  step "git pull origin $BRANCH"
  cd "$APP_DIR"
  git fetch --prune origin "$BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
  info "HEAD sekarang: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"
else
  warn "Lewati git pull (--no-pull)."
fi

# ── 2. Backend ─────────────────────────────────────────────────────────────
if [ "$DO_BACKEND" -eq 1 ]; then
  step "Backend"
  cd "$BACKEND_DIR"
  [ -f .env ] || warn "backend/.env tidak ada — pastikan DATABASE_URL & JWT_SECRET terset."
  if [ "$DO_INSTALL" -eq 1 ]; then info "npm install…";     npm install --no-audit --no-fund; fi
  info "prisma generate…"; npx prisma generate
  if [ "$DO_DB" -eq 1 ]; then
    warn "prisma db push (--accept-data-loss) — sinkron skema DB. Pastikan sudah BACKUP ZIP!"
    npx prisma db push --accept-data-loss
  else
    warn "Lewati prisma db push (--no-db). Terapkan perubahan kolom via ALTER manual."
  fi
  if [ "$DO_BUILD" -eq 1 ]; then info "npm run build…"; npm run build; fi
fi

# ── 3. Frontend ────────────────────────────────────────────────────────────
if [ "$DO_FRONTEND" -eq 1 ]; then
  step "Frontend"
  cd "$FRONTEND_DIR"
  [ -f .env.local ] || warn "frontend/.env.local tidak ada — pastikan NEXT_PUBLIC_API_URL terset."
  if [ "$DO_INSTALL" -eq 1 ]; then info "npm install…"; npm install --no-audit --no-fund; fi
  if [ "$DO_BUILD" -eq 1 ]; then info "npm run build…"; npm run build; fi
fi

# ── 4. Restart PM2 ─────────────────────────────────────────────────────────
# restart bila proses sudah ada; kalau belum → start baru.
pm2_up() { # $1=nama  $2=cwd  $3..=perintah start
  local name="$1" cwd="$2"; shift 2
  if pm2 describe "$name" >/dev/null 2>&1; then
    info "pm2 restart $name"; pm2 restart "$name" --update-env
  else
    info "pm2 start $name (baru)"; ( cd "$cwd" && pm2 start "$@" --name "$name" )
  fi
}
if [ "$DO_RESTART" -eq 1 ]; then
  step "Restart PM2"
  [ "$DO_BACKEND" -eq 1 ]  && pm2_up "$PM2_API" "$BACKEND_DIR" "$BACKEND_DIR/dist/main.js"
  [ "$DO_FRONTEND" -eq 1 ] && pm2_up "$PM2_WEB" "$FRONTEND_DIR" npm -- start
  pm2 save >/dev/null 2>&1 || true
  pm2 status
else
  warn "Lewati restart PM2 (--no-restart)."
fi

trap - ERR
echo -e "\n${C_B}${C_G}✔ Deploy selesai dalam $(( $(date +%s) - START_TS ))s${C_0}"
