import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 30_000,
    // Los tests de integración levantan la app real contra Postgres real y
    // hacen bcrypt (10 rondas) en cada usuario de prueba. Con el paralelismo
    // por defecto de Vitest (una worker por núcleo) los `beforeAll` se pasaban
    // de los 15 s y la suite fallaba de forma intermitente — señal roja que
    // normaliza el "rojo" y oculta regresiones reales.
    hookTimeout: 30_000,
    // Techo de workers: evita la saturación de CPU (bcrypt) y de conexiones
    // (cada worker abre su propio pool de 3 contra Postgres).
    maxWorkers: 3,
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
