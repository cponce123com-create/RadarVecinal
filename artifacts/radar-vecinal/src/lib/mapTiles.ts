/**
 * Fuente única de verdad para el mapa base de Radar Vecinal.
 *
 * Proveedor: Esri World Dark Gray Canvas.
 *
 * Se usa Esri de forma fija para evitar que una variable antigua de CARTO
 * vuelva a activar un proveedor que requiere API key. Todos los mapas de la
 * aplicación deben importar esta configuración en lugar de declarar URLs de
 * teselas directamente.
 *
 * Esri sirve estas teselas sin una API key de CARTO y su estilo oscuro encaja
 * con la interfaz de Radar Vecinal. El detalle nativo llega hasta zoom 16;
 * Leaflet puede ampliar esas teselas hasta zoom 19.
 */

export const MAP_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";

/** Zoom máximo con teselas nativas de Esri. */
export const MAP_TILE_MAX_NATIVE_ZOOM = 16;

/** Zoom máximo permitido por la interfaz. */
export const MAP_TILE_MAX_ZOOM = 19;

/** Atribución requerida para el mapa base. */
export const MAP_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
