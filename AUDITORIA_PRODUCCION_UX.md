# Auditoría integral — UX, pulido y listo-para-producción

**Fecha:** 2026-07-18 · **Rama:** `claude/production-readiness-audit-3pgip6`
**Método:** revisión de código + verificación (typecheck, build, 155 tests con Postgres real).

> ✅ = corregido en esta iteración · ⏳ = documentado, pendiente.

---

## 1. UX / Diseño

| # | Hallazgo | Estado |
|---|---|---|
| U1 | **Filtros del mapa: ~15 opciones en 3 filas de píldoras.** Sobrecarga visual (el problema que señalaste). | ✅ Reemplazado por **una lista desplegable agrupada** (Seguridad / Servicios públicos / Otros) con punto de color del filtro activo y botón "Todos". El `<select>` nativo abre el picker del sistema en móvil — más simple e intuitivo. |
| U2 | **Ajustes → "Categorías que generan alerta": 8 casillas grandes** en grilla (mucho peso visual). | ✅ Compactadas a **chips** con contador "N de 8" (es multi-selección, no puede ser desplegable simple). |
| U3 | Tipos del botón de pánico (6 opciones grandes). | ⏳ Se deja como está a propósito: en una emergencia, opciones grandes y visibles son MEJOR que un desplegable (menos toques, menos error). |

## 2. Robustez de producción

| # | Hallazgo | Estado |
|---|---|---|
| P1 | **Sin ErrorBoundary**: cualquier error de render, o un chunk lazy que 404ea tras un deploy, dejaba **pantalla en blanco**. | ✅ `components/ErrorBoundary.tsx` envolviendo la app: mensaje amigable + botón Recargar; detecta el caso "hay versión nueva" (fallo de import dinámico). |
| P2 | **Logs de depuración en producción**: 8 `console.log` de GPS en `LeafletMap` y 2 en `apiConfig`. | ✅ Condicionados a `import.meta.env.DEV` (en producción, consola limpia). |

## 3. Rendimiento (backend)

| # | Hallazgo | Estado |
|---|---|---|
| R1 | **N+1 en `GET /users/:id/strikes`**: 2 consultas por strike (hasta 100 extra). | ✅ 2 consultas totales con `IN` + mapas en memoria. |
| R2 | **N+1 en `GET /reports/reviewing`**: hasta 3 consultas por reporte (autor, strikes, flags → hasta 150 extra). | ✅ 3 consultas agrupadas (`IN` + `GROUP BY`). |
| R3 | Paginación en listas restantes del panel (extraviados, recursos) — O3 de la auditoría anterior. | ⏳ Volumen bajo en el piloto de 2 distritos; añadir `limit/offset` al escalar. |

## 4. Higiene de código

| # | Hallazgo | Estado |
|---|---|---|
| H1 | `startSimulatedWatch` (paseo aleatorio) quedó muerto al llegar el simulador manual. | ✅ Eliminado. |
| H2 | `MapPlaceholder.tsx` sin ningún uso. | ✅ Eliminado. |
| H3 | Haversine duplicado en `LiveHistory` (ya existía en `voiceAlerts`). | ✅ Consolidado (importa `distanceMeters`). |

## 5. Estado sano (verificado, sin cambios)

- PWA en `registerType: autoUpdate` + ahora ErrorBoundary cubre el hueco de chunks viejos.
- Code-splitting por página (lazy) con vendor chunks; bundle principal ~80 kB gzip.
- React Query con `staleTime`/sin refetch-storms; geocoder cacheado (Nominatim).
- 155 tests de API contra Postgres real + typecheck + builds en verde.
- RBAC 4 niveles, multi-tenant por distrito, RLS.

## Pendientes recomendados (no bloqueantes)

1. **R3** — paginación en listas del panel al escalar a más distritos.
2. Telemetría de errores del frontend (hoy el ErrorBoundary solo loggea local).
3. Mover el caché de geocodificación a Redis si se pasa a varias instancias.
