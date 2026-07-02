import { fileURLToPath } from "url";
import { readdirSync, existsSync, readFileSync } from "fs";
import { dirname, join } from "path";

export function resolve(specifier, context, nextResolve) {
  return pnpmResolve(specifier, context, nextResolve);
}

async function pnpmResolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch {
    if (!specifier.startsWith(".") && !specifier.startsWith("node:") && !specifier.startsWith("file:")) {
      const parent = fileURLToPath(context.parentURL);
      const found = findInPnpm(specifier, parent) || findInPnpm(specifier, process.cwd());
      if (found) {
        return { url: new URL("file://" + found).href, shortCircuit: true };
      }
    }
    throw new Error(`Cannot resolve ${specifier}`);
  }
}

function findInPnpm(name, startDir) {
  const pnpmName = name.replace("/", "+");
  let dir = startDir;
  while (dir) {
    const pnpmDir = join(dir, "node_modules", ".pnpm");
    if (existsSync(pnpmDir)) {
      const entries = readdirSync(pnpmDir);
      for (const entry of entries) {
        if (entry.startsWith(pnpmName + "@")) {
          const pkgDir = join(pnpmDir, entry, "node_modules", name);
          const pj = join(pkgDir, "package.json");
          if (existsSync(pj)) {
            const pkg = JSON.parse(readFileSync(pj, "utf-8"));
            const main = pkg.exports?.["."]?.import || pkg.exports?.["."] || pkg.module || pkg.main || "index.js";
            const mp = join(pkgDir, main);
            if (existsSync(mp)) return mp;
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
