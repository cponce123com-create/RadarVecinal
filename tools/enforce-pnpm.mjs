#!/usr/bin/env node
/**
 * enforce-pnpm.mjs — Guardianes de instalación del monorepo.
 *
 * Sustituye al script `sh -c` que estaba en el `preinstall` del root:
 * `sh` no existe en Windows (cmd/PowerShell), así que `pnpm install` fallaba
 * para cualquier desarrollador en Windows y para los runners de CI con
 * `shell: sh` ausente. Este script es cross-platform (solo Node).
 *
 * 1. Elimina los lockfiles de otros gestores (npm/yarn) para que no se
 *    mezclen con el de pnpm y generen resolutions distintas.
 * 2. Falla si la instalación no la está haciendo pnpm: este repo es un
 *    workspace pnpm (catálogos + `pnpm-workspace.yaml`) y npm no lo soporta.
 */

import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const file of ["package-lock.json", "yarn.lock"]) {
  rmSync(path.join(root, file), { force: true });
}

const userAgent = process.env.npm_config_user_agent ?? "";
// Si no hay user-agent (ej. ejecución manual del script) no se bloquea.
if (userAgent && !userAgent.startsWith("pnpm/")) {
  console.error(
    "Use pnpm instead: Radar Vecinal es un workspace pnpm (pnpm-workspace.yaml + catálogos).",
  );
  process.exit(1);
}
