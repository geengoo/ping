#!/bin/bash
set -e

echo "=== ping deploy ==="
cd /root/Projetos/geengoo/ping

echo "--- api: install + build ---"
cd api && npm ci && npm run build && cd ..

echo "--- api: prisma migrate ---"
cd api && npx prisma migrate deploy && cd ..

echo "--- web: install + build ---"
cd web && npm ci && npm run build && cd ..

echo "--- pm2 reload ---"
pm2 reload ping-api ping-web ping-worker 2>/dev/null || pm2 start ecosystem.config.js

echo "=== deploy concluído ==="
