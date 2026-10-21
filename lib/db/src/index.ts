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
  // ── Zona horaria de la sesión SIEMPRE en UTC ─────────────────────────────
  // El esquema usa `timestamp without time zone` (sin zona) en todas las
  // tablas. Hay dos formas de escribir un instante en esa columna y discrepban
  // si la sesión no está en UTC:
  //   · `defaultNow()` / `now()` → hora local de la SESIÓN de Postgres.
  //   · Drizzle (`timestamp()` con mode "date") → `toISOString()`, es decir UTC.
  // Con la sesión en hora local, comparar una columna con un `Date` de la app
  // compara dos instantes distintos por el offset y el filtro siempre falla.
  // Bug real observado: con la sesión en America/Bogota, `GET /api/live`
  // devolvía 0 emisores aunque existieran filas válidas, y cada ping del
  // dispositivo creaba una transmisión duplicada (el filtro de "transmisión
  // activa" no encontraba la anterior).
  // Fijar la sesión en UTC hace que ambas vías escriban el mismo instante y
  // que `now()` sea comparable con los `Date` de la aplicación.
  options: "-c timezone=UTC",
});
export const db = drizzle(pool, { schema });

export * from "./schema";
