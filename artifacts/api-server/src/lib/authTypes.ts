/**
 * authTypes.ts — Forma del usuario autenticado que viaja en `req.jwtUser`.
 *
 * Fuente única de verdad: la usan los middlewares de auth, el aislamiento
 * multi-tenant (`tenant.ts`) y todas las rutas. Antes cada ruta repetía
 * `req.jwtUser`, lo que dejaba el payload del JWT sin tipar y
 * escondía bugs reales (p. ej. leer `user.name` o `user.province`, que el
 * JWT nunca llevaba).
 *
 * ── Claims del JWT (los emite `signToken` en routes/auth.ts) ───────────────
 *   sub        → id del usuario (string, es un claim de texto)
 *   email      → correo del titular
 *   role       → rol canónico (super_admin | admin | municipal | moderator | viewer | user)
 *   district   → nombre del distrito (legado, kept por compatibilidad)
 *   districtId → id del distrito (autoridad para el aislamiento multi-tenant)
 *
 * ── Campos que NO viajan en el JWT ────────────────────────────────────────
 * `name`, `displayName` y los datos territoriales (`province`, `department`)
 * NO están en el token: son datos de la ficha del usuario/distrito que
 * pueden cambiar. `requireAuth` los carga de la base de datos y los adjunta;
 * `optionalAuth` no consulta la BD, así que ahí son `undefined`.
 */
export interface JwtUser {
  /** Id del usuario. String porque en el JWT es un claim de texto. */
  sub: string;
  email: string;
  role: string;
  /** Nombre del distrito (legado; la autoridad real es `districtId`). */
  district: string;
  /** Id del distrito: base del aislamiento multi-tenant. */
  districtId: number;
  /**
   * Nombre real del usuario. Lo rellena `requireAuth` (leyendo la BD);
   * con `optionalAuth` es `undefined`.
   */
  name?: string;
  /**
   * Nombre visible del usuario ("Vecino XXXXXX" / nombre en clave). Lo
   * rellena `requireAuth`; con `optionalAuth` es `undefined`.
   */
  displayName?: string | null;
}
