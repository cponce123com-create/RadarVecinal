/**
 * express.d.ts — Augmentación de los tipos de Express.
 *
 * Añade `req.jwtUser` (opcional) a `Request` para eliminar los ~70
 * `req.jwtUser` que había en el backend. El campo lo inyectan
 * `optionalAuth` y `requireAuth` (routes/auth.ts).
 *
 * Se usa el namespace global `Express.Request` (y no `declare module
 * "express-serve-static-core"`) porque `@types/express` redeclara su propia
 * interfaz `Request` que extiende `core.Request`, y la interfaz abierta
 * `Express.Request` de `express-serve-static-core` es el punto de extensión
 * documentado ("may be extended in an application-specific manner via
 * declaration merging").
 */
import type { JwtUser } from "../lib/authTypes";

declare global {
  namespace Express {
    interface Request {
      /** Claims del usuario autenticado. `undefined` si la request es anónima. */
      jwtUser?: JwtUser;
    }
  }
}

export {};
