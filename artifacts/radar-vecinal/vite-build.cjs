const fs = require("fs");
const path = require("path");

const startDir = __dirname; // /opt/render/project/src/artifacts/radar-vecinal
console.log("=== VITE DEBUG 3 ===");
console.log("startDir:", startDir);

// Check radar-vecinal's own .pnpm
const localPnpm = path.join(startDir, "node_modules", ".pnpm");
console.log("local .pnpm exists:", fs.existsSync(localPnpm));
if (fs.existsSync(localPnpm)) {
  const e = fs.readdirSync(localPnpm);
  console.log("local .pnpm entries:", e.length);
  console.log("local @vitejs:", e.filter(x => x.includes("@vitejs")).length);
  console.log("local tailwind:", e.filter(x => x.includes("tailwind")).length);
}

// Check root .pnpm
const rootPnpm = "/opt/render/project/src/node_modules/.pnpm";
console.log("root .pnpm exists:", fs.existsSync(rootPnpm));
if (fs.existsSync(rootPnpm)) {
  const e = fs.readdirSync(rootPnpm);
  console.log("root .pnpm entries:", e.length);
  console.log("root @vitejs:", e.filter(x => x.includes("@vitejs")).length);
  console.log("root tailwind:", e.filter(x => x.includes("tailwind")).length);
}
console.log("=== END DEBUG ===");

function resolveFromPnpm(name, startDir) {
  let dir = startDir;
  while (dir) {
    const pnpmDir = path.join(dir, "node_modules", ".pnpm");
    if (fs.existsSync(pnpmDir)) {
      const entries = fs.readdirSync(pnpmDir);
      const pnpmName = name.includes("/") ? name.replace("/", "+") : name;
      for (const entry of entries) {
        if (entry.startsWith(pnpmName + "@")) {
          const pkgDir = path.join(pnpmDir, entry, "node_modules", name);
          const pj = path.join(pkgDir, "package.json");
          if (fs.existsSync(pj)) {
            const pkg = JSON.parse(fs.readFileSync(pj, "utf-8"));
            const main = (typeof pkg.exports?.["."] === "string" ? pkg.exports["."] : pkg.exports?.["."]?.import) || pkg.module || pkg.main || "index.js";
            const mp = path.join(pkgDir, main);
            if (fs.existsSync(mp)) return mp;
          }
        }
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Cannot resolve " + name + " from " + startDir);
}

for (const pkg of ["esbuild", "rollup", "react", "react-dom", "react-dom/client", "@vitejs/plugin-react", "@tailwindcss/vite", "vite-plugin-pwa"]) {
  try { require(resolveFromPnpm(pkg, startDir)); } catch {}
}

const react = require(resolveFromPnpm("@vitejs/plugin-react", startDir));
const tailwindcss = require(resolveFromPnpm("@tailwindcss/vite", startDir));
const { VitePWA } = require(resolveFromPnpm("vite-plugin-pwa", startDir));
const { defineConfig } = require(resolveFromPnpm("vite", startDir));

const port = Number(process.env.PORT ?? 3000);
const basePath = process.env.BASE_PATH ?? "/";

const config = defineConfig({ base: basePath,
  plugins: [react(), tailwindcss(), VitePWA({ registerType: "autoUpdate", includeAssets: ["favicon.svg", "images/*"],
    manifest: { name: "Radar Vecinal", short_name: "RadarV", description: "Plataforma vecinal de seguridad", theme_color: "#060810", background_color: "#060810", display: "standalone", orientation: "portrait", start_url: "/", scope: "/", lang: "es-PE", categories: ["security", "utilities", "social"],
      icons: [{ src: "/favicon.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" }, { src: "/favicon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" }] },
    workbox: { globPatterns: ["**/*.{js,css,html,svg,png,jpg,webp,ico}"],
      runtimeCaching: [{ urlPattern: /^https?:\/\/.*\/api\/.*/i, handler: "NetworkFirst", options: { cacheName: "api-cache", expiration: { maxEntries: 100, maxAgeSeconds: 300 } } }] } })],
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "@assets": path.resolve(__dirname, "../..", "attached_assets") }, dedupe: ["react", "react-dom"] },
  root: __dirname, build: { outDir: path.resolve(__dirname, "dist/public"), emptyOutDir: true },
  server: { port, host: "0.0.0.0", allowedHosts: true, fs: { strict: true, deny: ["**/.*"] } }, preview: { port, host: "0.0.0.0", allowedHosts: true } });

const vite = require(resolveFromPnpm("vite", startDir));
vite.build(config).catch(e => { console.error(e); process.exit(1); });
