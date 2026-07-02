/**
 * tenant.ts — Helpers compartidos de aislamiento multi-tenant (M-04)
 *
 * Centraliza getDistrictId y checkTenant que estaban duplicados en
 * reports.ts, alerts.ts, stats.ts y activity.ts.
 */
import type { Request } from "express";

export interface JwtUser {
  sub: string;
  email: string;
  role: string;
  district: string;
  districtId: number;
}

/**
 * Obtiene el districtId del request, priorizando:
 *   1. Usuario autenticado (jwtUser.districtId) — excepto super_admin
 *   2. Query param o body districtId
 * Retorna null si no se puede determinar.
 */
export function getDistrictId(req: Request): number | null {
  const jwtUser = (req as any).jwtUser as JwtUser | undefined;
  if (jwtUser?.districtId && jwtUser.role !== "super_admin") {
    return Number(jwtUser.districtId);
  }
  const q = (req as any).query?.districtId ?? (req as any).body?.districtId;
  if (q != null) return Number(q);
  return null;
}

/**
 * Verifica que el usuario autenticado pertenezca al mismo distrito
 * que el recurso solicitado. super_admin puede acceder a todos.
 */
export function checkTenant(req: Request, resourceDistrictId: number): boolean {
  const jwtUser = (req as any).jwtUser as JwtUser | undefined;
  if (!jwtUser) return false;
  if (jwtUser.role === "super_admin") return true;
  return Number(jwtUser.districtId) === Number(resourceDistrictId);
}
