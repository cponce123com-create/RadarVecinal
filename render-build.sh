#!/usr/bin/env bash
set -euo pipefail

# Render Build — Radar Vecinal
# En Render, pnpm con linker default (isolated) crea symlinks rotos
# porque el store global (~/.local/share/pnpm) está en filesystem readonly.
# Usamos node-linker=hoisted para crear node_modules planos y funcionales.

echo "=== 1. Instalando dependencias (hoisted) ==="
npx pnpm@9 install --no-frozen-lockfile --config.node-linker=hoisted 2>&1 | tail -3

echo "=== 2. Build del API Server ==="
cd artifacts/api-server
node build.cjs 2>&1
cd "$OLDPWD"

echo "=== 3. Build del Frontend ==="
cd artifacts/radar-vecinal
node vite-build.cjs 2>&1 | tail -15
cd "$OLDPWD"

echo "=== Build completado exitosamente ==="
