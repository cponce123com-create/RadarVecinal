#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Instalando dependencias con pnpm ==="
npx pnpm@9 install --no-frozen-lockfile 2>&1 | tail -3

echo "=== 2. Build del API Server ==="
mkdir -p /tmp/npx-cache
cd artifacts/api-server
mkdir -p dist
npm_config_cache=/tmp/npx-cache npx --cache /tmp/npx-cache -y esbuild src/index.ts --platform=node --bundle --format=esm --outdir=dist --out-extension:.js=.mjs --sourcemap=linked --external:sharp --external:bcrypt --external:@google-cloud/storage --external:pg-native --external:express --external:fsevents --external:pino-pretty --external:pino --external:drizzle-orm --external:zod --external:jsonwebtoken --external:helmet --external:express-rate-limit --external:cors --external:google-auth-library --external:bcryptjs --external:cookie-parser
cd "$OLDPWD"

echo "=== 3. Build del Frontend ==="
cd artifacts/radar-vecinal
npm_config_cache=/tmp/npx-cache npx --cache /tmp/npx-cache -y vite build --config vite.config.ts 2>&1 | tail -5
cd "$OLDPWD"

echo "=== Build completado exitosamente ==="
