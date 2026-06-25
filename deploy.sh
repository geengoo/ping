#!/bin/bash
set -e

ROOT=/root/Projetos/geengoo/ping
echo "=== ping deploy ==="

echo "--- api: install + prisma generate + build ---"
cd "$ROOT/api"
npm ci
npx prisma generate
npm run build

echo "--- api: prisma migrate ---"
DATABASE_URL="postgresql://ping:ping_2026@187.77.56.138:5432/ping" npx prisma migrate deploy

echo "--- web: install + prisma generate + build ---"
cd "$ROOT/web"
npm ci
npx prisma generate
npm run build

echo "--- pm2 reload ---"
cd "$ROOT"
pm2 reload ping-api ping-web ping-worker 2>/dev/null || pm2 start ecosystem.config.js

echo "=== deploy concluído ==="
