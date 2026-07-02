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
node -e "
const fs=require('fs');
const p=JSON.parse(fs.readFileSync('package.json','utf-8'));
p.dependencies=Object.fromEntries(Object.entries(p.dependencies||{}).filter(([k,v])=>!k.startsWith('@workspace/')&&!v.startsWith('workspace:')));
p.devDependencies=Object.fromEntries(Object.entries(p.devDependencies||{}).filter(([k,v])=>!k.startsWith('@workspace/')&&!v.startsWith('workspace:')));
fs.writeFileSync('package.json',JSON.stringify(p,null,2));
"
echo "--- npm install ---"
npm install --no-package-lock --ignore-scripts 2>&1 | tail -5
# Crear symlinks para @workspace/* (no existen en npm registry)
mkdir -p node_modules/@workspace
for d in ../../lib/*/package.json; do
  pkgdir=$(dirname "$d")
  name=$(basename "$pkgdir")
  ln -sfn "$(cd "$pkgdir" && pwd -P)" "node_modules/@workspace/$name" 2>/dev/null || true
done
echo "--- vite build ---"
npx -y vite build --config vite.config.ts 2>&1 | tail -15
# Restaurar
mv package.json.bak package.json
rm -rf node_modules 2>/dev/null || true
cd "$OLDPWD"

echo "=== Build completado ==="
