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
cd artifacts/radar-vecinal
# vite.cjs usa createRequire para cargar Vite como CJS, evitando problemas
# del loader ESM de Node 24 con symlinks de pnpm
node vite-build.cjs 2>&1 | tail -15
cd "$OLDPWD"

echo "=== Build completado exitosamente ==="
