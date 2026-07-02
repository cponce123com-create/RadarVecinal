#!/usr/bin/env bash
# render-build.sh — Script de build para Render
# Estrategia: pnpm nativo (Corepack + pnpm install + pnpm build).
# Render usa Node 24 que incluye Corepack. Al leer "packageManager"
# en el package.json raíz, Corepack activa automáticamente pnpm.
set -euo pipefail

echo "=== 1. Corepack + pnpm install ==="
# Corepack activa la versión de pnpm definida en "packageManager"
# del package.json raíz (pnpm@11.9.0).
corepack enable
pnpm install --no-frozen-lockfile

echo "=== 2. Build API Server ==="
# Construye el backend Express con esbuild → dist/index.mjs
pnpm --filter @workspace/api-server run build

echo "=== 3. Build Frontend ==="
# Construye el frontend Vite + Tailwind v4 + React → dist/public/
# @workspace/mockup-sandbox se omite (es solo para desarrollo/design).
pnpm --filter @workspace/radar-vecinal run build

echo "=== Build completado ==="
