import L from "leaflet";

/**
 * Marcador de mapa como divIcon con SVG inline.
 *
 * Evita el patrón `L.Icon.Default.mergeOptions({ iconUrl: unpkg.com/... })`,
 * que en producción se rompe con Vite (los assets no se resuelven) y depende
 * de una CDN externa en runtime (fallible por CSP/offline). Al ser SVG inline
 * no hay peticiones de red ni marcadores rotos.
 */
const PIN_SVG = `
<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.5))">
  <path d="M15 39C15 39 27 24.5 27 14A12 12 0 1 0 3 14C3 24.5 15 39 15 39Z" fill="#2f6bff" stroke="#ffffff" stroke-width="2.5"/>
  <circle cx="15" cy="14" r="4.5" fill="#ffffff"/>
</svg>`;

/** Pin azul de marca, anclado por la punta. Reutilizable en todos los mapas. */
export const pinIcon: L.DivIcon = L.divIcon({
  className: "",
  html: PIN_SVG,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  tooltipAnchor: [0, -38],
});
