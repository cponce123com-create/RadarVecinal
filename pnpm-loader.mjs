// pnpm-loader.mjs - Custom ESM loader for Node.js
// Resolves packages from pnpm's .pnpm store when symlinks are broken.
import { readFileSync, readdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const baseURL = new URL("file://");
baseURL.pathname = process.cwd() + "/";

export function resolve(specifier, context, nextResolve) {
  return pnpmResolve(specifier, context, nextResolve);
}

async function pnpmResolve(specifier, context, nextResolve) {
  // First try normal resolution
  try {
    return await nextResolve(specifier, context);
  } catch {
    // If it fails, try to find the package in .pnpm store
    if (!specifier.startsWith(".") && !specifier.startsWith("file:")) {
      const found = findInPnpm(specifier, fileURLToPath(context.parentURL || baseURL.href));
      if (found) {
        return { url: new URL("file://" + found).href, shortCircuit: true };
      }
    }
    throw new Error(`Cannot resolve ${specifier}`);
  }
}

function findInPnpm(name, startDir) {
  let dir = startDir;
  // Scoped packages (@scope/name) are stored as @scope+name in .pnpm
  const pnpmName = name.replace("/", "+");
  while (dir) {
    const pnpmDir = join(dir, "node_modules", ".pnpm");
    if (existsSync(pnpmDir)) {
      const entries = readdirSync(pnpmDir);
      for (const entry of entries.sort().reverse()) {
        if (entry.startsWith(pnpmName + "@")) {
          const pkgDir = join(pnpmDir, entry, "node_modules", name);
          const pkgJson = join(pkgDir, "package.json");
          if (existsSync(pkgJson)) {
            const pkg = JSON.parse(readFileSync(pkgJson, "utf-8"));
            const main = pkg.exports?.["."]?.import || pkg.exports?.["."] || pkg.module || pkg.main || "index.js";
            const mainPath = join(pkgDir, main);
            if (existsSync(mainPath)) return mainPath;
          }
        }
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
