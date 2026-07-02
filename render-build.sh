#!/usr/bin/env bash
set -euo pipefail

# Render build script — Radar Vecinal
# Se usa npx pnpm@9 porque corepack falla en Render (ROFS en /usr/bin)

PNPM="npx pnpm@9"

echo "=== 1. Instalando dependencias ==="
$PNPM install --no-frozen-lockfile

echo "=== 2. Build del API Server ==="
cd artifacts/api-server
$PNPM exec node build.mjs
cd "$OLDPWD"

echo "=== 3. Build del Frontend ==="
cd artifacts/radar-vecinal
$PNPM run build
cd "$OLDPWD"

echo "=== Build completado exitosamente ==="
