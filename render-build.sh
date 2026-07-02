#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Instalando dependencias (hoisted) ==="
npx pnpm@9 install --no-frozen-lockfile 2>&1 | tail -3

echo "=== 2. Build del API Server ==="
# Ejecutamos desde la raíz para que Node resuelva módulos desde node_modules/ raíz
node artifacts/api-server/build.cjs 2>&1

echo "=== 3. Build del Frontend ==="
cd artifacts/radar-vecinal
node vite-build.cjs 2>&1 | tail -15
cd "$OLDPWD"

echo "=== Build completado exitosamente ==="
