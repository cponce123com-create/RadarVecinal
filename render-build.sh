#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Dependencias ==="
npx pnpm@9 install --no-frozen-lockfile 2>&1 | tail -3

echo "=== 2. Build API Server ==="
node artifacts/api-server/build.cjs

echo "=== 3. Build Frontend ==="
# Custom ESM loader resuelve imports desde .pnpm (Render no sigue symlinks)
node --experimental-loader ./pnpm-loader.mjs artifacts/radar-vecinal/vite-build.cjs 2>&1 | tail -15

echo "=== Build completado ==="
