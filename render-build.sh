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
# set +e: pnpm v11 sale con ERR_PNPM_IGNORED_BUILDS si hay build
# scripts no aprobados en el lockfile (generado con pnpm v9).
set +e
$PNPM install --no-frozen-lockfile
set -e

# Rebuild ejecuta los build scripts (esbuild, etc.) que pnpm v11
# omite durante install si no están aprobados en el lockfile.
echo "=== 1b. pnpm rebuild (build scripts) ==="
$PNPM rebuild

echo "=== 2. Build API Server ==="
# Construye el backend Express con esbuild → dist/index.mjs
$PNPM --filter @workspace/api-server run build

echo "=== 3. Build Frontend ==="
# Construye el frontend Vite + Tailwind v4 + React → dist/public/
# @workspace/mockup-sandbox se omite (es solo para desarrollo/design).
$PNPM --filter @workspace/radar-vecinal run build

echo "=== Build completado ==="
