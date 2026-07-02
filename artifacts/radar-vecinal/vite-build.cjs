const path = require("path");

async function main() {
  const react = (await import("@vitejs/plugin-react")).default;
  const tailwindcss = (await import("@tailwindcss/vite")).default;
  const { VitePWA } = await import("vite-plugin-pwa");
  const { defineConfig, build } = await import("vite");

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

  await build(config);
}

main().catch(e => { console.error(e); process.exit(1); });
