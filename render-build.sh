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
const cat={
  '@tailwindcss/vite':'^4.1.14','@tanstack/react-query':'^5.90.21',
  '@types/node':'^25.3.3','@types/react':'^19.2.0','@types/react-dom':'^19.2.0',
  '@vitejs/plugin-react':'^5.0.4','class-variance-authority':'^0.7.1',
  'clsx':'^2.1.1','framer-motion':'12.35.1','lucide-react':'^0.545.0',
  'react':'^19.1.0','react-dom':'^19.1.0','tailwind-merge':'^3.3.1',
  'tailwindcss':'^4.1.14','vite':'^7.3.0','zod':'^3.25.76','tsx':'^4.21.0'
};
const fix = (d) => Object.fromEntries(Object.entries(d||{})
  .filter(([k,v])=>!k.startsWith('@workspace/')&&!v.startsWith('workspace:'))
  .map(([k,v])=>[k,v==='catalog:'?(cat[k]||'latest'):v]));
p.dependencies=fix(p.dependencies);
p.devDependencies=fix(p.devDependencies);
fs.writeFileSync('package.json',JSON.stringify(p,null,2));
"
echo "--- npm install ---"
npm install --no-package-lock --ignore-scripts 2>&1 | tail -5
# Crear symlinks para @workspace/* (no existen en npm registry)
mkdir -p node_modules/@workspace
# Todos los paquetes del workspace que puedan necesitarse
for pkgdir in ../../lib/* ../../lib/integrations/* ../../artifacts/*; do
  [ -f "$pkgdir/package.json" ] || continue
  name=$(basename "$pkgdir")
  ln -sfn "$(cd "$pkgdir" && pwd -P)" "node_modules/@workspace/$name" 2>/dev/null || true
done
echo "--- vite build ---"
node node_modules/vite/bin/vite.js build --config vite.config.ts 2>&1 | tail -15
# Restaurar
mv package.json.bak package.json
rm -rf node_modules 2>/dev/null || true
cd "$OLDPWD"

echo "=== Build completado ==="
