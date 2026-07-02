#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Dependencias ==="
npx pnpm@9 install --no-frozen-lockfile 2>&1 | tail -3

echo "=== 2. Build API Server ==="
node artifacts/api-server/build.cjs

echo "=== 3. Build Frontend ==="
cd artifacts/radar-vecinal
# Instalar paquetes faltantes (Render no los instala con pnpm install solo)
npx pnpm@9 add @vitejs/plugin-react@5.2.0 @tailwindcss/vite@4.3.2 --no-save 2>&1 | tail -3
# Buscar vite CLI en .pnpm store y ejecutar (mismo approach que esbuild que SÍ funciona)
VITE_CLI=$(node -e "
const fs=require('fs'),p=require('path');
const dirs=fs.readdirSync(p.join(process.cwd(),'../..','node_modules','.pnpm'));
for(const e of dirs.sort().reverse()){
  if(e.startsWith('vite@')){
    const c=p.join(process.cwd(),'../..','node_modules','.pnpm',e,'node_modules','vite','bin','vite.js');
    if(fs.existsSync(c)){console.log(c);process.exit(0)}
  }
}
process.exit(1)
")
echo "vite CLI: $VITE_CLI"
node "$VITE_CLI" build --config vite.config.ts 2>&1 | tail -15
cd "$OLDPWD"

echo "=== Build completado ==="
