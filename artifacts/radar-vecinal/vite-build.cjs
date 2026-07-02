const fs = require("fs");
const path = require("path");

function resolveFromPnpm(name, startDir) {
  let dir = startDir;
  while (dir) {
    const pnpmDir = path.join(dir, "node_modules", ".pnpm");
    if (fs.existsSync(pnpmDir)) {
      const entries = fs.readdirSync(pnpmDir);
      for (const entry of entries) {
        if (entry.startsWith(name + "@")) {
          const pkgDir = path.join(pnpmDir, entry, "node_modules", name);
          const pkgJson = path.join(pkgDir, "package.json");
          if (fs.existsSync(pkgJson)) {
            const pkg = JSON.parse(fs.readFileSync(pkgJson, "utf-8"));
            const main = pkg.exports?.["."] || pkg.main || "index.js";
            const mainPath = path.join(pkgDir, main);
            if (fs.existsSync(mainPath)) {
              return mainPath;
            }
          }
        }
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Cannot resolve " + name + " from .pnpm");
}

const vite = require(resolveFromPnpm("vite", __dirname));
vite.build({ configFile: path.join(__dirname, "vite.config.ts"), logLevel: "info" })
  .catch(e => { console.error(e); process.exit(1); });
