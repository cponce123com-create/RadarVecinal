import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

/**
 * Cadena de conexión configurada.
 *
 * `undefined` cuando no hay DATABASE_URL. Importar este módulo NO debe
 * lanzar: hay tests unitarios que importan el esquema y el código de los
 * workers sin(base de datos —inyectan un doble—) y, si el import fallara,
 * no podrían ni ejecutarse. La validación es explícita y ocurre al arrancar
 * el servidor (`assertDatabaseConfigured()`) o al lanzar las migraciones.
 */
const connectionString = process.env.DATABASE_URL;

/** Origen de conexión placeholder: el pool es perezoso, no conecta al crear. */
const PLACEHOLDER_CONNECTION_STRING =
  "postgresql://placeholder:placeholder@127.0.0.1:1/placeholder";

/**
 * Falla rápido si la base de datos no está configurada.
 *
 * Se llama al arrancar el servidor y en el runner de migraciones, para que
 * un despliegue mal configurado muera en el arranque y no en la primera
 * petición.
 */
export function assertDatabaseConfigured(): void {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
}

export const pool = new Pool({
  connectionString: connectionString ?? PLACEHOLDER_CONNECTION_STRING,
  // Límite de 3 conexiones: el free tier de Neon permite 5 conexiones simultáneas
  // como máximo. Con 3 dejamos margen para una conexión de migración o admin.
  // Elegimos configurar el propio pool en vez del connection string "-pooler" de
  // Neon porque queremos control explícito sobre timeouts y evitar la capa extra
  // de pooler que añade latencia.
  max: 3,
  idleTimeoutMillis: 30000, // cerrar conexiones inactivas después de 30s
  connectionTimeoutMillis: 10000, // fallar rápido si no hay conexión disponible
  // ── Zona horaria de la sesión SIEMPRE en UTC ─────────────────────────────
  // Desde la migración 0034 todas las columnas de fecha son `timestamptz`, así
  // que Postgres guarda el instante absoluto y las comparaciones ya no dependen
  // de la zona de la sesión. El ajuste se mantiene como defensa en profundidad:
  //   · Una columna `timestamp without time zone` que se añada por error
  //     seguiría escribiéndose en UTC, porque `now()` usa la hora de la sesión.
  //   · `CURRENT_DATE`, `date_trunc('day', ...)` y los `::text` de las consultas
  //     de estadísticas siguen produciendo días UTC, que es lo que asume la app.
  //
  // Bug histórico que motivó el ajuste (docs/audit/ITERATION-001.md): con la
  // sesión en America/Bogota, `GET /api/live` devolvía 0 emisores aunque
  // existieran filas válidas, y cada ping del dispositivo creaba una
  // transmisión duplicada porque el filtro de "transmisión activa" comparaba
  // hora local contra UTC.
  options: "-c timezone=UTC",
});
export const db = drizzle(pool, { schema });

export * from "./schema";
