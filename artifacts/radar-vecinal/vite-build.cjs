// vite-build.cjs - npm flat node_modules version
// Usa require() directo porque npm crea node_modules planos (funciona en Render)
const path = require("path");

const react = require("@vitejs/plugin-react");
const tailwindcss = require("@tailwindcss/vite");
const { VitePWA } = require("vite-plugin-pwa");
const { defineConfig, build } = require("vite");

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

build(config).catch(e => { console.error(e); process.exit(1); });
