import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    setupFiles: ["./src/test-setup.ts"],
  },
  resolve: {
    // El orden importa: los alias más específicos van primero. Con objeto, el
    // prefijo "@workspace/db" capturaría "@workspace/db/schema". Se usa forma de
    // array anclada por regex para que cada subpath resuelva a su .ts correcto
    // (necesario para los import() dinámicos de los tests de integración).
    alias: [
      {
        find: /^@workspace\/db\/schema$/,
        replacement: path.resolve(__dirname, "../../lib/db/src/schema/index.ts"),
      },
      {
        find: /^@workspace\/db$/,
        replacement: path.resolve(__dirname, "../../lib/db/src/index.ts"),
      },
      {
        find: /^@workspace\/api-zod$/,
        replacement: path.resolve(__dirname, "../../lib/api-zod/src/index.ts"),
      },
    ],
  },
});
