#!/usr/bin/env bash
# render-build.sh — Script de build para Render
# Estrategia: pnpm nativo vía Corepack.
# Render usa Node 24 que incluye Corepack.
# "corepack pnpm" ejecuta la versión definida en "packageManager"
# del package.json raíz sin necesitar symlinks globales (evita EROFS
# en /usr/bin/ donde corepack enable fallaría).
set -euo pipefail

# Alias para no repetir "corepack pnpm" en cada línea
PNPM="corepack pnpm"

echo "=== 1. pnpm install ==="
$PNPM install --no-frozen-lockfile

echo "=== 1.5. Migraciones de BD ==="
# Ejecuta todas las migraciones SQL pendientes (0000 a 0015)
# Requiere DATABASE_URL configurada en las variables de entorno de Render
node run_all_migrations.js

echo "=== 2. Build API Server ==="
# Construye el backend Express con esbuild → dist/index.mjs
$PNPM --filter @workspace/api-server run build

echo "=== 3. Build Frontend ==="
# Construye el frontend Vite + Tailwind v4 + React → dist/public/
# @workspace/mockup-sandbox se omite (es solo para desarrollo/design).
$PNPM --filter @workspace/radar-vecinal run build

echo "=== Build completado ==="
