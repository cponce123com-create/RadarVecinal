#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Instalando dependencias ==="
npx pnpm@9 install --no-frozen-lockfile 2>&1 | tail -3

echo "=== 2. Buscando esbuild en store de pnpm ==="
ESBUILD_BIN=$(node -e "
const fs=require('fs'),p=require('path');
const dirs=fs.readdirSync(p.join(process.cwd(),'node_modules','.pnpm'));
const entries=dirs.filter(x=>x.startsWith('esbuild@')&&!x.includes('_')).sort().reverse();
if(!entries[0]){console.error('esbuild not found');process.exit(1)}
console.log(p.join(process.cwd(),'node_modules','.pnpm',entries[0],'node_modules','esbuild','bin','esbuild'));
")
echo "esbuild: $ESBUILD_BIN"

echo "=== 3. Build del API Server ==="
cd artifacts/api-server
mkdir -p dist
"$ESBUILD_BIN" src/index.ts --platform=node --bundle --format=esm --outdir=dist --out-extension:.js=.mjs --sourcemap=linked --external:sharp --external:bcrypt --external:@google-cloud/storage --external:pg-native --external:express --external:fsevents --external:pino-pretty --external:pino --external:drizzle-orm --external:zod --external:jsonwebtoken --external:helmet --external:express-rate-limit --external:cors --external:google-auth-library --external:bcryptjs --external:cookie-parser
cd "$OLDPWD"

echo "=== 4. Build del Frontend ==="
VITE_BIN=$(node -e "
const fs=require('fs'),p=require('path');
const dirs=fs.readdirSync(p.join(process.cwd(),'node_modules','.pnpm'));
// vite siempre tiene peer deps (suffix con _), buscamos el primero
const d=dirs.find(x=>x.startsWith('vite@'));
if(!d){console.error('vite not found');process.exit(1)}
console.log(p.join(process.cwd(),'node_modules','.pnpm',d,'node_modules','vite','bin','vite.js'));
")
echo "vite: $VITE_BIN"
cd artifacts/radar-vecinal
node "$VITE_BIN" build --config vite.config.ts 2>&1 | tail -5
cd "$OLDPWD"

echo "=== Build completado exitosamente ==="
