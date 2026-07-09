import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

const port = Number(process.env.PORT ?? 3000);
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  // Elimina console.log/info/debug del bundle de producción (al minificar),
  // conservando console.warn/error para diagnóstico. En dev no afecta.
  esbuild: {
    pure: ["console.log", "console.info", "console.debug"],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "images/*"],
      manifest: {
        name: "Radar Vecinal",
        short_name: "RadarV",
        description: "Plataforma vecinal de seguridad y reportes ciudadanos",
        theme_color: "#060810",
        background_color: "#060810",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "es-PE",
        categories: ["security", "utilities", "social"],
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,webp,ico}"],
        // La imagen social (og-image) solo la consumen los crawlers; no precachearla.
        globIgnores: ["**/og-image.png"],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: "NetworkFirst",
            options: { cacheName: "api-cache", expiration: { maxEntries: 100, maxAgeSeconds: 300 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Vendor code-splitting: separa librerías pesadas en chunks cacheables
    // de forma independiente al código de la app (mejor caché entre despliegues
    // y descarga en paralelo). No cambia CUÁNDO se cargan, solo el empaquetado.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/leaflet") || id.includes("react-leaflet")) return "vendor-maps";
          if (id.includes("recharts") || id.includes("/d3-") || id.includes("victory-vendor")) return "vendor-charts";
          if (id.includes("framer-motion") || id.includes("/motion-")) return "vendor-motion";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("/node_modules/react-dom/") || id.includes("/node_modules/react/") || id.includes("/scheduler/")) return "vendor-react";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("lucide-react") || id.includes("react-icons")) return "vendor-icons";
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
