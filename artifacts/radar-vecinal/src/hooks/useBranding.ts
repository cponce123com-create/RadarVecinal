import { useEffect } from "react";
import { useDistrict } from "@/contexts/DistrictContext";

/**
 * useBranding — Aplica el theming visual del distrito activo vía CSS custom properties.
 * Inspirado en FixMyStreet (cobrand system).
 *
 * El distrito puede tener:
 *   - primary_color: color principal (ej. #22c55e para San Ramón)
 *   - brand_name: nombre de marca (ej. "Radar Vecinal San Ramón")
 *   - logo_url: URL del logo del distrito
 */
export default function useBranding() {
  const { districtInfo } = useDistrict();

  useEffect(() => {
    if (!districtInfo) return;

    const color = (districtInfo as any).primaryColor || "#3b82f6";
    const brandName = (districtInfo as any).brandName || "Radar Vecinal";

    // Aplicar color primario como CSS custom property
    document.documentElement.style.setProperty("--brand-primary", color);
    document.documentElement.style.setProperty("--brand-primary-rgb", hexToRgb(color));

    // Actualizar título
    document.title = brandName;

    // Meta theme-color para mobile browsers
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", color);

    return () => {
      document.documentElement.style.removeProperty("--brand-primary");
      document.documentElement.style.removeProperty("--brand-primary-rgb");
    };
  }, [districtInfo]);
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : "59, 130, 246";
}
