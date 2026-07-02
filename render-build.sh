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
npm install --cache /tmp/npm-cache --no-package-lock --prefer-offline=false 2>&1 | tail -10
# Instalar paquetes que npm a veces omite por peer deps
npm install --cache /tmp/npm-cache @vitejs/plugin-react@5.2.0 @tailwindcss/vite@4.3.2 2>&1 | tail -5
echo "--- DEBUG node_modules ---"
node -e "const fs=require('fs');const nm='node_modules';if(!fs.existsSync(nm)){console.log('node_modules MISSING');process.exit()};const d=fs.readdirSync(nm);console.log('count:',d.length,'scoped:',d.filter(x=>x.startsWith('@')).length);console.log('@vitejs:',fs.existsSync(nm+'/@vitejs'));console.log('vite find:',d.filter(x=>x.includes('vite')).join(','));const p=JSON.parse(fs.readFileSync('package.json','utf-8'));const a={...p.dependencies,...p.devDependencies};console.log('pkg has @vitejs:',!!a['@vitejs/plugin-react'],'vite:',!!a.vite,'tailwind:',!!a['@tailwindcss/vite']);"
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
