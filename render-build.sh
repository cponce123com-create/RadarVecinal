#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Dependencias ==="
npx pnpm@9 install --no-frozen-lockfile 2>&1 | tail -3

echo "=== 2. Build API Server ==="
node artifacts/api-server/build.cjs

echo "=== 3. Build Frontend ==="
node --experimental-require-module artifacts/radar-vecinal/vite-build.cjs

echo "=== Build completado ==="
