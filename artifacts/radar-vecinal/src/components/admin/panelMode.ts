/**
 * panelMode — determina si el panel admin opera en modo "municipal" o "superadmin".
 * 
 * Se lee de VITE_PANEL_MODE (env var de Vite, seteable al build):
 *   VITE_PANEL_MODE=municipal   → oculta el selector de distrito, fuerza el distrito del usuario
 *   VITE_PANEL_MODE=superadmin  → muestra selector de distrito, permite cambiar entre distritos
 *   (sin setear)                → se comporta según el rol del JWT (isSuperAdmin)
 * 
 * Esto permite buildear la misma app para subdominios distintos sin duplicar código:
 *   admin.miradar.pe       → VITE_PANEL_MODE=municipal
 *   plataforma.miradar.pe  → VITE_PANEL_MODE=superadmin
 */

export const PANEL_MODE = (import.meta as any).env?.VITE_PANEL_MODE as string | undefined;

export function getEffectiveSuperAdmin(isSuperAdminFromJwt: boolean): boolean {
  if (PANEL_MODE === "municipal") return false;
  if (PANEL_MODE === "superadmin") return true;
  return isSuperAdminFromJwt;
}
