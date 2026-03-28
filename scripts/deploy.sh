#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
export PM2_APP_NAME="$(basename "$APP_DIR")"

echo "==> Deploying telegram bot from: $APP_DIR (PM2 name: $PM2_APP_NAME)"
cd "$APP_DIR"

echo "==> Pulling latest code..."
git pull

echo "==> Installing dependencies..."
npm ci

echo "==> Building..."
npm run build

echo "==> Restarting via PM2..."
if pm2 describe "$PM2_APP_NAME" > /dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME"
else
  npm run pm2:start
fi

pm2 save

echo "==> Done. Bot status:"
pm2 status "$PM2_APP_NAME"
