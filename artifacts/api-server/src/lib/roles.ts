/**
 * Jerarquía de roles (4 niveles) — fuente única de verdad para RBAC.
 *
 *   super_admin (4) ─ todo, todos los distritos
 *   admin / municipal (3) ─ municipalidad: gestiona SU distrito (incl. eliminar)
 *   moderator / viewer (2) ─ moderador: ve y edita/modera SU distrito (sin eliminar)
 *   user (1) ─ ciudadano
 *
 * `admin` y `municipal` son equivalentes; `moderator` y `viewer` también.
 */
const TIER: Record<string, number> = {
  user: 1,
  viewer: 2,
  moderator: 2,
  municipal: 3,
  admin: 3,
  super_admin: 4,
};

export function roleTier(role?: string | null): number {
  return TIER[role ?? ""] ?? 0;
}

/** super_admin: acceso total, todos los distritos. */
export const isSuperAdmin = (role?: string | null): boolean =>
  roleTier(role) >= 4;

/** Municipalidad o superior: puede gestionar y ELIMINAR contenido de su distrito. */
export const isMunicipalityLevel = (role?: string | null): boolean =>
  roleTier(role) >= 3;

/** Moderador o superior: puede VER y EDITAR/moderar contenido (sin eliminar). */
export const isModeratorLevel = (role?: string | null): boolean =>
  roleTier(role) >= 2;
