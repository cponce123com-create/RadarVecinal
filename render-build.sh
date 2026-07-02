#!/usr/bin/env bash
set -euo pipefail

# Render build script — Radar Vecinal

echo "=== 1. Instalando dependencias ==="
npx pnpm@9 install --no-frozen-lockfile

echo "=== 2. Build del API Server ==="
npx pnpm@9 --filter @workspace/api-server run build

echo "=== 3. Build del Frontend ==="
npx pnpm@9 --filter @workspace/radar-vecinal run build

echo "=== Build completado exitosamente ==="
