import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Límite de 3 conexiones: el free tier de Neon permite 5 conexiones simultáneas
  // como máximo. Con 3 dejamos margen para una conexión de migración o admin.
  // Elegimos configurar el propio pool en vez del connection string "-pooler" de
  // Neon porque queremos control explícito sobre timeouts y evitar la capa extra
  // de pooler que añade latencia.
  max: 3,
  idleTimeoutMillis: 30000, // cerrar conexiones inactivas después de 30s
  connectionTimeoutMillis: 10000, // fallar rápido si no hay conexión disponible
});
export const db = drizzle(pool, { schema });

export * from "./schema";
