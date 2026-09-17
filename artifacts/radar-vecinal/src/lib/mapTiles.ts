/**
 * Fuente única de verdad del mapa base (las imágenes de calles).
 *
 * ── Proveedor por defecto: Esri (no necesita clave) ──────────────────────────
 * Se usan las teselas del "Dark Gray Canvas" de Esri
 * (`server.arcgisonline.com`): ya son oscuras, así que encajan con el tema de
 * la app sin filtros CSS, y no requieren registrarse ni clave. Su detalle
 * nativo llega hasta el zoom 16; por encima de eso Leaflet reutiliza (agranda)
 * la última tesela disponible, así el mapa nunca queda en blanco.
 *
 * ── Proveedor alternativo: CARTO (requiere clave gratuita) ───────────────────
 * Antes se usaba CARTO (`basemaps.cartocdn.com`, estilo "Dark Matter").
 * CARTO dejó de servir teselas a apps sin clave: las entrega con la marca de
 * agua «API key required» encima del mapa. Por eso CARTO solo se usa si se
 * define VITE_CARTO_API_KEY al compilar (p. ej. en el panel de Render), con lo
 * que se recupera su estilo y su detalle hasta zoom 19.
 *   https://carto.com/basemaps
 *
 * ── Por qué NO se usa OpenStreetMap directamente ─────────────────────────────
 * La política de la OpenStreetMap Foundation prohíbe `tile.openstreetmap.org`
 * para aplicaciones publicadas y bloquea el acceso (HTTP 403 «Access blocked»)
 * sin previo aviso:
 *   https://operations.osmfoundation.org/policies/tiles/
 */

/** Clave de API de CARTO (opcional). Se inyecta al COMPILAR desde
 * VITE_CARTO_API_KEY, así que añadirla o cambiarla requiere un nuevo despliegue. */
const CARTO_API_KEY = (import.meta.env.VITE_CARTO_API_KEY ?? "").trim();

const CARTO_API_KEY_QUERY = CARTO_API_KEY
  ? `?api_key=${encodeURIComponent(CARTO_API_KEY)}`
  : "";

/** true → CARTO (con clave); false → Esri (sin clave). */
export const USING_CARTO = CARTO_API_KEY.length > 0;

/**
 * URL plantilla para `<TileLayer url={MAP_TILE_URL} />`.
 * Esri pide las teselas en orden `{z}/{y}/{x}`; CARTO en `{z}/{x}/{y}`
 * (`{s}` reparte entre subdominios y `{r}` añade "@2x" en pantallas densas).
 */
export const MAP_TILE_URL = USING_CARTO
  ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${CARTO_API_KEY_QUERY}`
  : "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";

/**
 * Zoom máximo con teselas propias del proveedor. Por encima de este valor
 * Leaflet agranda la última tesela disponible (se ve algo borroso, pero el
 * mapa sigue funcionando). Esri: 16 · CARTO: 19.
 */
export const MAP_TILE_MAX_NATIVE_ZOOM = USING_CARTO ? 19 : 16;

/** Zoom máximo que puede alcanzar el mapa (permite acercarse más allá del nativo). */
export const MAP_TILE_MAX_ZOOM = 19;

/** Atribución obligatoria de cada proveedor. */
export const MAP_ATTRIBUTION = USING_CARTO
  ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  : 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
