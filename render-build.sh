#!/usr/bin/env bash
set -euo pipefail

# Render build script — Radar Vecinal
# En Node 24 + pnpm, las dependencias están en node_modules/.pnpm/
# pero Node no puede resolverlas directamente. La solución es usar
# NODE_PATH para apuntar al directorio donde pnpm hoistea los paquetes.

echo "=== 1. Instalando dependencias ==="
npx pnpm@9 install --no-frozen-lockfile

echo "=== 2. Build del API Server ==="
cd artifacts/api-server
# NODE_PATH permite que Node encuentre paquetes en node_modules/ del proyecto
export NODE_PATH=$(pwd)/../../node_modules
node build.cjs
cd "$OLDPWD"

echo "=== 3. Build del Frontend ==="
cd artifacts/radar-vecinal
npx pnpm@9 run build
cd "$OLDPWD"

echo "=== Build completado exitosamente ==="
