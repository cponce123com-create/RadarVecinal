/**
 * timezone.ts — Fija UTC como zona horaria del proceso.
 *
 * ── Por qué ─────────────────────────────────────────────────────────────────
 * El esquema usa `timestamp without time zone` (sin zona) en todas las tablas.
 * Un instante puede llegar a esa columna por tres vías, y cada una usa una
 * representación distinta:
 *
 *   1. `defaultNow()` / `now()` de Postgres → hora local de la SESIÓN.
 *   2. Drizzle con una columna (`timestamp()`) → `toISOString()`, o sea UTC.
 *   3. `pg` con un parámetro `Date` en SQL crudo → hora local del PROCESO.
 *
 * Si esas tres no coinciden, comparar la columna contra un `Date` de la
 * aplicación compara instantes que no son el mismo momento, y los filtros por
 * tiempo fallan en silencio.
 *
 * Bug real observado en producción (24/10/2026): con la sesión de Postgres en
 * America/Bogota, `GET /api/live` devolvía 0 emisores aunque existieran filas
 * válidas, y cada ping de un dispositivo oficial creaba una transmisión
 * duplicada (el filtro de "transmisión activa" no encontraba la anterior).
 *
 * ── Cómo se resuelve ───────────────────────────────────────────────────────
 * · `process.env.TZ = "UTC"` → hace que (1) y (3) usen UTC.
 * · La sesión de Postgres se fija en UTC en `lib/db` (`options: "-c
 *   timezone=UTC"`), lo que cubre (1).
 * · (2) ya es UTC por definición.
 *
 * Con las tres en UTC, el instante escrito es el mismo sea cual sea la vía.
 *
 * IMPORTANTE: este módulo debe importarse lo antes posible, antes de
 * cualquier uso de `Date`, porque Node fija la zona horaria en el primer uso.
 */
process.env.TZ = "UTC";

export {};
