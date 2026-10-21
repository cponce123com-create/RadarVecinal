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
# --frozen-lockfile: el despliegue instala EXACTAMENTE el lockfile revisado en
# CI. Antes usaba --no-frozen-lockfile, que permite resolver versiones nuevas
# durante el build de producción: el artefacto desplegado podía no ser el que
# pasó los tests.
$PNPM install --frozen-lockfile

echo "=== 1.5. Migraciones de BD ==="
# Aplica TODAS las migraciones de lib/db/migrations (idempotentes, se
# reejecutan en cada despliegue). Si alguna falla, el script termina con código
# distinto de cero y Render cancela el despliegue: no se sirve tráfico con un
# esquema a medias.
# Requiere DATABASE_URL configurada en las variables de entorno de Render
node run_all_migrations.js

echo "=== 2. Build API Server ==="
# Construye el backend Express con esbuild → dist/index.mjs
$PNPM --filter @workspace/api-server run build

echo "=== 3. Build Frontend ==="
# Construye el frontend Vite + Tailwind v4 + React → dist/public/
$PNPM --filter @workspace/radar-vecinal run build

echo "=== Build completado ==="
