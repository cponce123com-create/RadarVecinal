import { MAP_ATTRIBUTION } from "@/lib/mapTiles";

/**
 * Crédito del proveedor de teselas del mapa base (obligatorio para Esri y
 * CARTO).
 *
 * Leaflet ya lo pinta en los mapas grandes (su control de atribución está
 * activo), pero los widgets pequeños lo desactivan porque ese control tapa
 * botones o datos. Este componente muestra el mismo texto como una etiqueta
 * diminuta en una esquina del mapa.
 *
 * `MAP_ATTRIBUTION` es HTML con enlaces, así que se inyecta tal cual.
 */
export default function MapCredit({ className = "" }: { className?: string }) {
  return (
    <span
      className={
        "pointer-events-auto select-none text-[9px] leading-none text-white/40 " +
        "[&_a]:text-white/40 [&_a]:no-underline hover:[&_a]:text-white/70 " +
        className
      }
      dangerouslySetInnerHTML={{ __html: MAP_ATTRIBUTION }}
    />
  );
}
