#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Dependencias ==="
npx pnpm@9 install --no-frozen-lockfile 2>&1 | tail -3

echo "=== 2. Build API Server ==="
node artifacts/api-server/build.cjs

echo "=== 3. Build Frontend ==="
# --experimental-require-module permite que CJS require() cargue módulos ESM
# (Necesario en Node 22+, disponible en Node 24 de Render)
node --experimental-require-module artifacts/radar-vecinal/vite-build.cjs 2>&1 | tail -15

echo "=== Build completado ==="
