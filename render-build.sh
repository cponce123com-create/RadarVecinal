#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Dependencias ==="
npx pnpm@9 install --no-frozen-lockfile 2>&1 | tail -3

echo "=== 2. Build API Server ==="
node artifacts/api-server/build.cjs

echo "=== 3. Build Frontend ==="
cd artifacts/radar-vecinal
# Render con Node 24 + pnpm v9 no instala @vitejs/plugin-react ni @tailwindcss/vite
npx pnpm@9 add @vitejs/plugin-react@5.2.0 @tailwindcss/vite@4.3.2 --no-save 2>&1 | tail -3
# vite-build.cjs usa CJS require() + resolveFromPnpm, evita ESM loader issues
node --experimental-require-module vite-build.cjs 2>&1 | tail -10
cd "$OLDPWD"

echo "=== Build completado ==="
