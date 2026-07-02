#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Dependencias del proyecto ==="
npx pnpm@9 install --no-frozen-lockfile 2>&1

echo "=== 2. Build API Server ==="
node artifacts/api-server/build.cjs

echo "=== 3. Build Frontend ==="
cd artifacts/radar-vecinal
echo "=== npm install ==="
npm install --no-package-lock --ignore-scripts 2>&1
echo "=== vite build ==="
npx -y vite build --config vite.config.ts 2>&1
echo "=== FIN ==="
cd "$OLDPWD"

echo "=== Build completado ==="
