#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Instalando dependencias ==="
npx pnpm@9 install --no-frozen-lockfile 2>&1 | tail -3

echo "=== 2. Build del API Server ==="
cd artifacts/api-server
mkdir -p dist
# npm exec busca el binario dentro de node_modules/.bin/
# A diferencia de npx, npm exec no descarga nada, solo usa lo instalado
npm_config_cache=/tmp/npm-cache npm exec -- esbuild src/index.ts --platform=node --bundle --format=esm --outdir=dist --out-extension:.js=.mjs --sourcemap=linked --external:sharp --external:bcrypt --external:@google-cloud/storage --external:pg-native --external:express --external:fsevents --external:pino-pretty --external:pino --external:drizzle-orm --external:zod --external:jsonwebtoken --external:helmet --external:express-rate-limit --external:cors --external:google-auth-library --external:bcryptjs --external:cookie-parser
cd "$OLDPWD"

echo "=== 3. Build del Frontend ==="
cd artifacts/radar-vecinal
npm exec -- vite build --config vite.config.ts 2>&1 | tail -5
cd "$OLDPWD"

echo "=== Build completado exitosamente ==="
