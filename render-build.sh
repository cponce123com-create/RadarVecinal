#!/usr/bin/env bash
set -euo pipefail

echo "=== Instalando dependencias ==="
npx pnpm@9 install --no-frozen-lockfile 2>&1 | tail -3

echo "=== Build del API Server ==="
node artifacts/api-server/build.cjs

echo "=== Build del Frontend ==="
node artifacts/radar-vecinal/vite-build.cjs 2>&1 | tail -10

echo "=== Build completado ==="
