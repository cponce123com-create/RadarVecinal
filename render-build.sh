#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Dependencias del proyecto ==="
npx pnpm@9 install --no-frozen-lockfile 2>&1 | tail -3

echo "=== 2. Build API Server ==="
node artifacts/api-server/build.cjs

echo "=== 3. Build Frontend (npm aislado) ==="
cd artifacts/radar-vecinal
# pnpm no funciona en Render (Node 24 + filesystem readonly).
# npm instalar con node_modules plano (sin pnpm store).
# Backup package.json, remover workspace:* deps (no existen en npm registry)
cp package.json package.json.bak
node fix-pkg.cjs
echo "--- npm install (fresh) ---"
rm -rf node_modules 2>/dev/null || true
npm install --cache /tmp/npm-cache --no-package-lock --ignore-scripts 2>&1
# DEBUG: check if vite was installed
echo "--- checking install ---"
ls node_modules/vite/bin/vite.js 2>&1 || echo "vite bin NOT FOUND"
ls node_modules/@vitejs/plugin-react/package.json 2>&1 || echo "@vitejs/plugin-react NOT FOUND"
echo "first 15 dirs:" $(ls node_modules/ 2>/dev/null | head -15) "..."
echo "--- vite build ---"
mkdir -p node_modules/@workspace
# Todos los paquetes del workspace que puedan necesitarse
for pkgdir in ../../lib/* ../../lib/integrations/* ../../artifacts/*; do
  [ -f "$pkgdir/package.json" ] || continue
  name=$(basename "$pkgdir")
  ln -sfn "$(cd "$pkgdir" && pwd -P)" "node_modules/@workspace/$name" 2>/dev/null || true
done
echo "--- vite build ---"
node --experimental-require-module vite-build.cjs 2>&1 | tail -15
# Restaurar package.json y node_modules de pnpm para runtime
mv package.json.bak package.json
rm -rf node_modules 2>/dev/null || true
echo "--- restoring pnpm node_modules ---"
npx pnpm@9 install --no-frozen-lockfile 2>&1 | tail -3
cd "$OLDPWD"

echo "=== Build completado ==="
