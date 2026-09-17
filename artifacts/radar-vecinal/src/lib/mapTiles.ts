/**
 * Fuente única de verdad del mapa base (las imágenes de calles).
 *
 * ── Por qué NO se usa OpenStreetMap directamente ─────────────────────────────
 * Antes cada mapa pedía las teselas a `tile.openstreetmap.org`. La política de
 * uso de la OpenStreetMap Foundation prohíbe ese servidor para aplicaciones
 * publicadas y bloquea el acceso (HTTP 403 «Access blocked») sin previo aviso:
 *   https://operations.osmfoundation.org/policies/tiles/
 *
 * ── Qué se usa ahora ─────────────────────────────────────────────────────────
 * CARTO basemaps (`basemaps.cartocdn.com`), que sí autoriza el uso desde
 * aplicaciones. Su estilo «Dark Matter» ya es oscuro, así que encaja con el
 * tema de la app sin invertir colores por CSS. Requiere atribución visible:
 * ver MAP_ATTRIBUTION.
 *   https://carto.com/basemaps
 */

/** Estilo oscuro de CARTO. Alternativas: "light_all", "voyager". */
const CARTO_STYLE = "dark_all";

/**
 * Clave de API de CARTO (opcional). Se inyecta al COMPILAR desde la variable
 * de entorno VITE_CARTO_API_KEY (p. ej. en el panel de Render), por lo que
 * añadirla o cambiarla requiere un nuevo despliegue.
 *
 * Si no está definida se usa la URL pública sin clave: el mapa funciona igual
 * hoy, así que obtener la clave más adelante no obliga a tocar código.
 */
const CARTO_API_KEY = (import.meta.env.VITE_CARTO_API_KEY ?? "").trim();

const CARTO_API_KEY_QUERY = CARTO_API_KEY
  ? `?api_key=${encodeURIComponent(CARTO_API_KEY)}`
  : "";

/**
 * URL plantilla para `<TileLayer url={MAP_TILE_URL} />`.
 * `{s}` reparte las peticiones entre los subdominios del CDN y `{r}` añade
 * "@2x" en pantallas de alta densidad; Leaflet sustituye ambos solo.
 */
export const MAP_TILE_URL = `https://{s}.basemaps.cartocdn.com/${CARTO_STYLE}/{z}/{x}/{y}{r}.png${CARTO_API_KEY_QUERY}`;

/** Zoom máximo servido por el proveedor. */
export const MAP_TILE_MAX_ZOOM = 19;

/** Atribución obligatoria: datos de OpenStreetMap, teselas de CARTO. */
export const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
