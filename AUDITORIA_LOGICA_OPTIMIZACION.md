# Auditoría — Lógica, Concurrencia y Optimización

**Fecha:** 2026-07-13 · **Rama:** `claude/production-readiness-audit-3pgip6`
**Método:** revisión de código + verificación con Postgres real (146 tests).

Severidad: 🔴 Alta · 🟠 Media · 🟡 Baja/mejora.

> **Implementado y verificado en esta iteración:** L1, L2, O1. El resto queda
> documentado y priorizado.

---

## 1. Lógica / Correctitud

| # | Sev | Hallazgo | Estado |
|---|---|---|---|
| **L1** | 🔴 | **`/confirm` y `/confirm-resolution` compartían tabla y unicidad.** Las confirmaciones de VALIDEZ ("el reporte es real") y de RESOLUCIÓN ("ya se resolvió") se guardaban en `resolution_confirmations` con la misma unicidad `(report_id, user_id)`. Consecuencia: **un vecino que confirmaba la validez NO podía confirmar la resolución** (409), y ambos contadores (`confirmedCount` / `resolutionConfirmedCount`) se calculaban de las **mismas filas** → el umbral de "10 confirmaciones → archivado" podía dispararse con confirmaciones de validez. | ✅ Se añadió `kind` ('validity'\|'resolution') con índices únicos por tipo (migración 0028). Cada endpoint inserta/cuenta su `kind`. Test que reproduce el bug. |
| **L2** | 🟠 | **Doble escritor de `confirmedCount`.** El endpoint `/reports/:id/vote` (upvote, tabla `votes`) escribía la **misma** columna `confirmedCount` que el `/confirm` que sí usa la app, pisándose. Además `votes` **no tenía índice único** → voto duplicable en carrera. El componente `VoteButton` que lo llamaba **no se renderizaba en ningún sitio** (código muerto). | ✅ Eliminado `VoteButton` + los endpoints `/vote` (código muerto y conflictivo). Queda `/confirm` como único escritor. |
| **L3** | 🟡 | El geocoder inverso se refresca en cada arrastre del marcador; sin caché podía repetir llamadas para coordenadas casi idénticas. | ✅ Cubierto por O1 (caché por coords redondeadas). |

---

## 2. Optimización / Rendimiento

| # | Sev | Hallazgo | Estado |
|---|---|---|---|
| **O1** | 🔴 | **Geocodificación sin caché, sin timeout, sin límite.** `/geocode` y `/geocode/reverse` llaman a **Nominatim (OSM)**, cuya política exige **≤1 req/s y cachear**, o **bloquean la IP del servidor**. Con el reporte llamando reverse en cada arrastre, el riesgo de baneo en producción era real (rompería la búsqueda y el autocompletado de dirección para todos). | ✅ Caché en memoria (TTL 1h) por consulta y por coords redondeadas (~11 m) + `AbortSignal.timeout(6s)` + User-Agent con contacto. Reduce drásticamente las llamadas a Nominatim. |
| **O2** | 🟠 | **N+1 en enriquecimientos.** `GET /users/:id/strikes` y `/reports/strikes/...` enriquecen cada strike con consultas por-fila dentro de `Promise.all` (nombre del admin, título del reporte). Acotado por página, pero escala mal. | ⏳ Recomendado: un `JOIN`/`IN (...)` para traer admins y reportes en 2 consultas. |
| **O3** | 🟡 | **Sin paginación en algunas listas del panel** (extraviados, recursos). Con volumen alto puede pesar. | ⏳ Añadir `limit/offset` como en reportes/usuarios. |

---

## 3. Estado sano (lo que ya está bien)

- `/confirm-resolution` recuenta desde la tabla (fuente de verdad) y protege
  carreras con índices únicos — buen patrón (ahora también por `kind`).
- React Query con `staleTime` y `refetchOnWindowFocus:false` (evita refetch
  storms); el buscador de direcciones ya venía con debounce.
- SSE de pánico con `refetchInterval` de respaldo por si el stream se cae.
- Sanciones aplicadas, filtros de moderación, multi-tenant por distrito.
- 146 tests + typecheck + builds en verde.

---

## Priorización recomendada (pendiente)

1. **O2** — quitar los N+1 de strikes (2 consultas con `IN`).
2. **O3** — paginación en las listas restantes del panel.
3. Considerar mover el caché de geocodificación a Redis si se escala a varios
   procesos (hoy es por-proceso, suficiente para 1 instancia).
