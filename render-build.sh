#!/usr/bin/env bash
set -euo pipefail

# Render build script — Radar Vecinal
# Se usa npx pnpm@9 porque corepack falla en Render (ROFS en /usr/bin)

PNPM="npx pnpm@9"

echo "=== 1. Instalando dependencias ==="
$PNPM install --no-frozen-lockfile

echo "=== 2. Build del API Server ==="
$PNPM --filter @workspace/api-server run build

echo "=== 3. Build del Frontend ==="
$PNPM --filter @workspace/radar-vecinal run build

echo "=== Build completado exitosamente ==="
