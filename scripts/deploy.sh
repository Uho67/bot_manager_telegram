#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> Deploying telegram bot from: $APP_DIR"
cd "$APP_DIR"

echo "==> Pulling latest code..."
git pull

echo "==> Installing dependencies (production)..."
npm ci --omit=dev

echo "==> Building..."
npm run build

echo "==> Restarting via PM2..."
if pm2 describe telegram-bot > /dev/null 2>&1; then
  pm2 restart telegram-bot
else
  npm run pm2:start
fi

pm2 save

echo "==> Done. Bot status:"
pm2 status telegram-bot
