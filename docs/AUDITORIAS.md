# Auditorías y reportes — consolidado

> Informes históricos del proyecto unificados en un solo documento.
> Consolidado el 2026-10-01 durante la limpieza `chore/cleanup`.


---

## AUDITORIA_FUNCIONALIDAD

# Auditoría — Funcionalidad, Calidad de Código, Lógica y UX

**Fecha:** 2026-07-08 · **Alcance:** rama `claude/production-readiness-audit-3pgip6`
**Método:** revisión de código + verificación con Postgres real (120 tests) + builds.

Severidad: 🔴 Alta (rompe o degrada una función) · 🟠 Media · 🟡 Baja/mejora.

> **Actualización (implementado en esta iteración):** F1, F2, F3, UX1 y UX3 ya
> están corregidos y verificados (121 tests OK, typecheck/prettier/builds verdes):
> - **F1/UX1** — nuevo `LocationPicker` (mapa + geocoder + "mi ubicación")
>   reutilizable; "reportar extravío" ahora guarda coordenadas reales.
> - **F2/UX3** — el teléfono de contacto de extraviados es público (búsqueda
>   comunitaria); el nombre del reportante queda en backoffice; el botón
>   "Contactar" solo se muestra si hay teléfono.
> - **F3** — `users.ts` usa `isMunicipalityLevel` (las municipalidades ya no
>   quedan bloqueadas).
>
> **Segunda tanda:** UX2 y L3 también corregidos.
> - **UX2** — `Notificaciones` (skeleton + estado de error/reintento) e
>   `Historial` (estado de error/reintento). *Emergencias* usa datos estáticos,
>   no necesita estados de carga.
> - **L3** — el borrado de personas extraviadas ahora registra en `audit_log`.
>
> Pendientes (media/baja): CQ1 (modularizar rutas), CQ2 (tipar `req.jwtUser` —
> refactor deliberado por el volumen de guards), UX4 (pestaña admin), UX5 (contraste).

---

## 1. Funcionalidad

| # | Sev | Hallazgo | Evidencia | Solución propuesta |
|---|---|---|---|---|
| **F1** | 🔴 | **Personas extraviadas se guardan con coordenadas FIJAS.** El formulario de crear envía `lastSeenLatitude: -11.1272, lastSeenLongitude: -75.3548` hardcodeadas; el "último lugar visto" es solo texto. Resultado: **todas** las personas aparecen en el mismo punto del mapa y no se puede filtrar por proximidad. | `pages/MissingPerson.tsx:136-137` | Reutilizar el selector de ubicación de reportes (`GeocoderInput` + mapa arrastrable + geolocalización) que ya existe en `ReportForm`. |
| **F2** | 🔴 | **Botón "Contactar" roto para el público.** La tarjeta muestra `tel:${person.contactInfo}` y el teléfono, pero el backend **anonimiza `contactInfo` a solo backoffice del distrito**. Para un vecino normal, `contactInfo` es `undefined` → enlace `tel:undefined` y teléfono vacío. Contradice el propósito (búsqueda comunitaria). | `pages/MissingPerson.tsx:372-388` vs `routes/alerts.ts` (GET `isBackofficeSameDistrict`) | Decisión de diseño: (a) hacer el contacto **público** en extraviados (tiene sentido para búsqueda), o (b) ocultar el botón cuando no hay dato y canalizar el contacto por la app. |
| **F3** | 🟠 | **`isAdmin` inconsistente con el nuevo RBAC**: `users.ts:320` sigue usando `["admin","moderator","super_admin"]` — **excluye `municipal`** (las municipalidades) e incluye `moderator` (que ya no debería tener ese poder). | `routes/users.ts:320` | Usar `isMunicipalityLevel(user.role)` de `lib/roles.ts`. |
| **F4** | 🟡 | **Sin edición completa server-side documentada en el contrato.** `UpdateMissingPersonInput` del OpenAPI solo declara `status/clothing/photoUrl`, aunque el backend ya acepta más campos. El frontend usa `customFetch` directo (funciona) pero el contrato queda desalineado. | `lib/api-spec/openapi.yaml` (`UpdateMissingPersonInput`) | Ampliar el schema del contrato y regenerar (tras alinear orval/zod, ver auditoría previa). |

---

## 2. Lógica / Correctitud

| # | Sev | Hallazgo | Evidencia | Solución |
|---|---|---|---|---|
| **L1** | 🟠 | **Chequeos de rol dispersos e inconsistentes.** Existe `lib/roles.ts` (fuente única, 4 niveles) pero varias rutas siguen con arrays inline (`users.ts`, `alerts.ts` GET ya corregido). Riesgo: que un rol quede mal autorizado en un endpoint y no en otro. | `users.ts:320,350`; enums inline en varios sitios | Migrar todos los chequeos a `isSuperAdmin/isMunicipalityLevel/isModeratorLevel`. |
| **L2** | 🟡 | **Roles legacy sin uso real** (`admin`, `moderator`) conviven con los activos (`municipal`, `viewer`). Genera ambigüedad. | `db/schema` `userRoleEnum` | Documentar la equivalencia (ya en `lib/roles.ts`) y, a futuro, migrar datos a los 4 roles canónicos. |
| **L3** | 🟡 | **Borrado suave sin `deletedBy`/auditoría en extraviados.** El nuevo DELETE marca `deletedAt` pero no registra quién ni por qué (los reportes sí usan audit log). | `routes/alerts.ts` DELETE missing-persons | Registrar en `audit_logs` (entityType `missing_person`) como en reportes. |

---

## 3. Calidad de Código

| # | Sev | Hallazgo | Evidencia | Solución |
|---|---|---|---|---|
| **CQ1** | 🟠 | **Archivos monolito.** `routes/reports.ts` (1.496 líneas) y `routes/alerts.ts` (~940) concentran CRUD + votos + confirmaciones + PDF + SSE. Dificulta test y mantenimiento. | `routes/reports.ts`, `routes/alerts.ts` | Dividir por sub-dominio en routers separados. |
| **CQ2** | 🟠 | **Tipado débil de la request autenticada.** `(req as any).jwtUser` aparece **~98 veces** en las rutas. Sin tipo, cualquier cambio de claims pasa desapercibido. | rutas backend (grep `as any`) | Declarar `declare module "express" { interface Request { jwtUser?: JwtUser } }` y tipar `JwtUser`. Elimina casi todos los `as any`. |
| **CQ3** | 🟡 | **48 `any` en frontend, 12 `console.*`.** Los `console` ya se eliminan del bundle de producción (auditoría previa); los `any` (p. ej. `.map((r:any))`) restan seguridad de tipos. | `radar-vecinal/src` | Tipar respuestas de query con los tipos generados del contrato. |
| **CQ4** | 🟡 | **Coordenadas de fallback repetidas** (`-11.12…`) en 3 componentes. | `PanicModal`, `RadarHero`, `MissingPerson` | Centralizar en una constante de "centro por defecto" derivada del distrito. |

---

## 4. UX / Diseño

| # | Sev | Hallazgo | Evidencia | Solución |
|---|---|---|---|---|
| **UX1** | 🔴 | **Reportar extravío no pide ubicación real** (deriva de F1). El usuario escribe la dirección pero no hay mapa/geocoder; la ubicación se pierde. | `pages/MissingPerson.tsx` (form crear) | Añadir el mismo selector de mapa que `ReportForm`. |
| **UX2** | 🟠 | **Estados faltantes.** `Notificaciones` y `Emergencias` no tienen skeleton de carga; `History`, `Notificaciones` y `Emergencias` no tienen estado de error. Sensación de "colgado" si la API tarda/falla. | `pages/Notifications.tsx`, `pages/Emergencias.tsx`, `pages/History.tsx` | Añadir skeletons y estados de error/reintento consistentes (como en `Home`/`Alerts`). |
| **UX3** | 🟠 | **Botón que no hace nada** (deriva de F2): "Contactar" con `tel:undefined`. Un CTA visible que falla erosiona la confianza. | `pages/MissingPerson.tsx:384` | Mostrar el botón **solo si hay teléfono**; si no, mostrar "Contacto no disponible" o canalizar por la app. |
| **UX4** | 🟡 | **Consistencia de gestión.** Reportes tienen panel admin completo; extraviados ahora tienen editar/eliminar en las tarjetas, pero **no hay pestaña de extraviados en el Centro de Control** — la gestión vive en la página pública. | `components/admin/AdminPanel.tsx` (tabs) | Considerar una pestaña "Extraviados" en el panel admin para gestión centralizada. |
| **UX5** | 🟡 | **Accesibilidad**: varios micro-labels `text-[9px]/[10px]` sobre fondo oscuro rozan el mínimo de contraste (WCAG 1.4.3). | global | Auditar con Lighthouse/axe y subir a ≥ 4.5:1 donde aplique. |

---

## Priorización recomendada

1. **F1 / UX1** (🔴): selector de ubicación real en "reportar extravío". Es el bug más impactante: hoy el mapa de extraviados es inútil.
2. **F2 / UX3** (🔴): decidir el modelo de contacto de extraviados y arreglar el botón "Contactar".
3. **F3 / L1** (🟠): unificar todos los chequeos de rol con `lib/roles.ts` (evita que una municipalidad quede bloqueada en algún endpoint).
4. **CQ2** (🟠): tipar `req.jwtUser` (borra ~98 `as any` y previene bugs de auth).
5. **UX2** (🟠): estados de carga/error faltantes.
6. Resto (🟡): modularizar rutas, auditar contraste, pestaña admin de extraviados, alinear contrato.

---

## Estado sano (lo que está bien)

- RBAC de 4 niveles centralizado (`lib/roles.ts`) tras esta iteración.
- Reportes con selector de mapa + geolocalización + geocoder (buen patrón a replicar).
- Aislamiento multi-tenant por distrito con tests (RLS + `checkTenant`).
- Subida de fotos corregida (auth + flujo Cloudinary) — pendiente solo de desplegar.
- Suite de tests (120) + typecheck + prettier + builds en verde.

---

## AUDITORIA_LOGICA_OPTIMIZACION

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

---

## AUDITORIA_PRODUCCION

# Auditoría de Preparación para Producción — RadarVecinal

**Fecha:** 2026-07-08
**Alcance:** Monorepo completo (frontend `radar-vecinal`, `api-server`, librerías compartidas `lib/*`)
**Roles aplicados:** Staff Engineer · Arquitecto · UX/UI Senior · Performance · DevOps

---

## 1. Resumen ejecutivo

RadarVecinal es una plataforma de seguridad ciudadana **madura y bien estructurada**. Es un monorepo pnpm con separación clara de responsabilidades: frontend React 19 + Vite 7 + Tailwind v4, backend Express 5 + Drizzle ORM, y librerías compartidas (contrato API en Zod, cliente generado, capa de base de datos). Cuenta con **suite de tests** (Vitest + Supertest), **PWA** con service worker, **soporte Capacitor** para móvil nativo, aislamiento multi-tenant por distrito con RLS, y despliegue como Infrastructure-as-Code en Render.

**Hallazgo clave:** buena parte de la deuda descrita en los reportes previos del repo (`OPTIMIZATION_REPORT.md`, `SECURITY_AUDIT.md`) **ya fue resuelta** y esos documentos están **desactualizados**. Concretamente ya existen:

- Proyección explícita de columnas / anonimización de PII en `GET /reports`, `GET /reports/:id` y `GET /missing-persons` (los tres marcados como "pendientes" en `SECURITY_AUDIT.md`).
- Índices de rendimiento en base de datos (`migrations/0021_performance_indexes.sql`).
- Caché en memoria con TTL para `/stats` (30 s) y `/districts` (60 s) vía `lib/memoryCache`.
- Bloqueo por intentos de login (`migrations/0022_fix_login_attempts.sql`).
- Code-splitting con `React.lazy` para páginas pesadas.

Por tanto, esta auditoría se centró en encontrar **deuda real remanente** y aplicar mejoras seguras y verificables, sin repetir trabajo ya hecho. El foco de valor estuvo en **rendimiento de bundle, accesibilidad, SEO y limpieza de dependencias** — áreas con margen concreto de mejora.

**Estado de build (verificado en esta sesión):**

- ✅ Frontend `vite build`: **OK** (~8 s)
- ✅ API server `esbuild`: **OK** (0.5 s)
- ✅ `tsc --build` (libs) + typecheck de **frontend** y **api-server**: **VERDE en los 3 paquetes** tras la 2ª iteración (ver §"Segunda iteración"). El gate de tipos quedó recuperado.
- ✅ Tests api-server: **94 pasan, 21 skipped** (integración, requieren `DATABASE_URL`), 0 fallos.
- ✅ Tests frontend: **9 pasan, 0 fallos**. Los 3 tests obsoletos de `DistrictContext` se **reescribieron** para reflejar la resolución dinámica de distrito (catálogo + GPS + selección manual, con mocks).

---

## 2. Auditoría de Arquitectura

| # | Problema | Impacto | Prioridad | Solución propuesta / estado |
|---|---|---|---|---|
| A1 | Contrato API centralizado en `lib/api-zod` con cliente generado (`lib/api-client-react`) | — | — | ✅ **Fortaleza.** Excelente separación; el frontend consume tipos derivados del contrato. |
| A2 | 55 primitivas UI (shadcn/ui) + 28 componentes de feature | Bajo | P4 | ✅ Buena reutilización. Algunas primitivas UI podrían no usarse nunca (p. ej. `carousel`, `menubar`, `resizable`) — candidatas a poda para reducir superficie. |
| A3 | `reports.ts` (backend) tiene **1.496 líneas** en un solo archivo de rutas | Medio | P2 | Modularizar por sub-dominio (CRUD, votos, confirmaciones, mensajes, PDF) en routers separados. Reduce complejidad y facilita testing. |
| A4 | Carpetas fuera de convención en la raíz: `NUEVO DISEÑO/`, `otros/`, `attached_assets/` | Bajo | P3 | Mover a `docs/` o eliminar del árbol de producción; no deben formar parte del artefacto desplegable. |
| A5 | `artifacts/mockup-sandbox` es solo diseño/desarrollo | Bajo | — | ✅ Ya se excluye del build de producción (`render-build.sh` solo compila `radar-vecinal` + `api-server`). |
| A6 | Documentos de auditoría desactualizados en el repo | Medio (confunde a nuevos devs) | P2 | Consolidar/actualizar; este documento reemplaza los reportes obsoletos. |

---

## 3. Auditoría de Rendimiento

### Problemas encontrados y resueltos

| # | Problema | Impacto | Estado |
|---|---|---|---|
| P1 | **Bundle principal monolítico de 818 KB** (251 KB gzip): todas las librerías vendor (React, Leaflet, framer-motion, Radix, TanStack Query, íconos) se empaquetaban junto al código de la app en un único chunk. | **Alto.** Cualquier cambio de código invalidaba los 818 KB en caché; parseo secuencial de un archivo enorme. | ✅ **Corregido** (ver §"Cambios implementados"). |
| P2 | **Dependencias pesadas sin usar:** `mapbox-gl` (~3 MB instalado) y `react-map-gl` declaradas en `dependencies` pero **no importadas en ningún archivo** de `src/`. | Medio (superficie de supply-chain, tamaño de instalación, CSS de mapbox inflaba el bundle). | ✅ **Eliminadas.** |
| P3 | `recharts` (393 KB) empaquetado dentro del chunk de `Stats`. | Medio | ✅ Ahora aislado en `vendor-charts`, cacheable e independiente; `Stats` bajó a 7 KB. |
| P4 | Índices de BD y caché en memoria | Alto/Medio | ✅ Ya implementados (reportes previos desactualizados). |
| P5 | Leaflet se carga en Home (lo usa `RadarHero`) | Medio | ⚠️ Decisión de producto (el "radar" visual usa Leaflet). No modificado; ahora al menos está aislado en `vendor-maps` cacheable. |

### Métricas de mejora (build de producción, gzip)

| Chunk | Antes | Después | Nota |
|---|---:|---:|---|
| App principal (`index`) | **818.8 KB** (250.7 KB gz) | **238.6 KB** (67.1 KB gz) | Monolito eliminado |
| CSS principal | 214.8 KB (35.8 KB gz) | 199.2 KB (29.2 KB gz) | Se eliminó el CSS de mapbox-gl |
| `vendor-react` | — | 185.8 KB (58.6 KB gz) | Cacheable entre despliegues |
| `vendor-maps` (Leaflet) | dentro del principal | 154.1 KB (45.0 KB gz) | Cacheable e independiente |
| `vendor-charts` (recharts) | dentro de Stats | 393.1 KB (107.9 KB gz) | Solo carga con `/estadisticas` |
| `Stats` | 399.8 KB | 7.3 KB | recharts extraído |
| Paquetes npm eliminados | — | **−28 paquetes** | mapbox-gl + react-map-gl + transitorias |

> **Interpretación honesta:** en la **primera** visita a Home los bytes totales son similares (las librerías que se cargan se siguen usando). La ganancia real es **granularidad de caché** (un cambio de código de la app ya no invalida ~580 KB de vendors), **descarga en paralelo** bajo HTTP/2 y la eliminación del monolito de 818 KB. Para reducir bytes de primera carga habría que tomar decisiones de producto (p. ej. no usar Leaflet en Home) — marcado como pendiente.

---

## 4. UX Audit

| # | Hallazgo | Impacto | Prioridad | Nota |
|---|---|---|---|---|
| UX1 | Navegación móvil con bottom-nav + botón primario "Reportar" elevado + drawer | — | — | ✅ **Fortaleza.** Patrón moderno, uso con una mano. |
| UX2 | Estados de carga (spinners en `Suspense`), banner offline (`OfflineBanner`), toasts (`sonner`) | — | — | ✅ Presentes y consistentes. |
| UX3 | Diálogos nativos `confirm()` en `SuperAdminTab.tsx` (revocar licencia) y `main.tsx` (update de SW) | Medio | P2 | Inconsistente con el sistema de modales de la app (`AlertDialog`/`sonner`). Rompe la estética y no es accesible/estilizable. Reemplazar por el modal propio — **requiere decisión de UX** (texto, botones). |
| UX4 | Sin "skip to content" para navegación por teclado | Bajo | P3 | Añadir enlace de salto al inicio del `<body>`. |
| UX5 | Textos subtítulo hardcodeados a un distrito (`"GEOLOCALIZACIÓN · SAN RAMÓN"` en `Layout.tsx`) siendo la app multi-tenant | Bajo | P3 | El subtítulo del topbar debería derivar del distrito activo, no estar fijo a San Ramón. |

---

## 5. UI Audit

| # | Hallazgo | Impacto | Nota |
|---|---|---|---|
| UI1 | Design system coherente: tokens HSL, tipografía (Space Grotesk / Inter / JetBrains Mono), tema oscuro por defecto con toggle | — | ✅ Aspecto SaaS moderno, no genérico. |
| UI2 | Sombras/bordes/espaciados consistentes vía Tailwind v4 + primitivas Radix | — | ✅ Sólido. |
| UI3 | Fuentes cargadas desde Google Fonts con `preconnect` | Bajo | ✅ Correcto; para offline-first podría considerarse `@fontsource` self-hosted (pendiente, decisión de infra). |
| UI4 | CSS de producción de 199 KB (29 KB gz) | Bajo | Tailwind ya hace tree-shaking; aceptable. Vigilar crecimiento. |

---

## 6. Optimización Mobile

| # | Hallazgo | Estado |
|---|---|---|
| M1 | Touch targets `min-h-[44px]` en nav e ítems interactivos | ✅ Cumple guías (44×44). |
| M2 | `env(safe-area-inset-*)` aplicado en bottom-nav, drawer y botón de pánico | ✅ Respeta notch/gestos iOS. |
| M3 | `viewport-fit=cover` + meta PWA de pantalla completa | ✅ Correcto. |
| M4 | **`maximum-scale=1` bloqueaba el pinch-zoom** del usuario | ✅ **Corregido** (ver §7 accesibilidad). |
| M5 | Tablas admin anchas en móvil | ⚠️ Revisar scroll horizontal contenido en `ReportsTab`/`UsersTab` (pendiente de validación en dispositivo). |

---

## 7. Accesibilidad (WCAG)

| # | Problema | Criterio WCAG | Estado |
|---|---|---|---|
| AC1 | `<meta viewport>` con `maximum-scale=1` **impedía ampliar** la interfaz | **1.4.4 Resize Text (AA)** | ✅ **Corregido** — se eliminó `maximum-scale`. |
| AC2 | Botones solo-ícono sin nombre accesible (menú móvil, cerrar drawer, campana de notificaciones, login) | **4.1.2 Name, Role, Value** | ✅ **Corregido** — `aria-label` + `aria-hidden` en íconos decorativos + `aria-expanded` en el toggle del menú. |
| AC3 | Enlaces de navegación sin indicar la página actual a lectores de pantalla | **2.4.8 / lectores** | ✅ **Corregido** — `aria-current="page"` en los 3 menús (sidebar, drawer, bottom-nav). |
| AC4 | Sin enlace "saltar al contenido" | 2.4.1 Bypass Blocks | ⏳ Pendiente (bajo). |
| AC5 | Contraste de textos `text-[9px]`/`text-[10px]` en muted sobre fondo oscuro | 1.4.3 Contrast | ⏳ Revisar con herramienta; algunos micro-labels podrían quedar por debajo de 4.5:1. |

---

## 8. Código

| # | Hallazgo | Impacto | Nota |
|---|---|---|---|
| C1 | **45** usos de `any`/`as any` en el frontend | Medio | Debilita el tipado. Reducir progresivamente; muchos vienen de `(req as any).jwtUser` en backend y `.map((r: any))` por tipos de query no inferidos. |
| C2 | **13** `console.*` en `src/` | Bajo | Deben quedar fuera del bundle de producción o detrás de guard `import.meta.env.DEV`. Recomendado: `esbuild.drop` en vite (ver §Recomendaciones). |
| C3 | 6 `TODO/FIXME` sin ticket | Bajo | Convertir en issues rastreables. |
| C4 | Duplicidad de export `SeedDataBody` (type + Zod const) en `lib/api-zod` | Medio | `tsc` falla (TS2308). Es **código generado**; el fix correcto es en el generador, no editando el `.ts` generado. |
| C5 | Auto-referencia de `usersTable` en `lib/db/schema/reports.ts` (TS7022/7024) | Bajo | Patrón conocido de Drizzle; añadir anotación de tipo explícita para satisfacer `tsc`. |
| C6 | Tests obsoletos en `DistrictContext.test.tsx` | Medio | Afirman defaults hardcodeados (`"San Ramón"`, `"Chanchamayo"`, `"Junín"`) que **ya no existen** tras refactorizar `DistrictContext` a resolución dinámica por geolocalización/API. **No se "arreglaron" para forzar CI en verde** porque requieren rediseñarse con mocks del API — es una decisión funcional (§Pendientes). |

---

## 9. Seguridad

Auditado con foco en los vectores marcados como pendientes en `SECURITY_AUDIT.md` — **todos ya resueltos**:

| Vector | Estado verificado |
|---|---|
| PII en `GET /reports` (contactPhone/contactEmail) | ✅ Proyección explícita; contacto solo para el `owner`. |
| PII en `GET /reports/:id` | ✅ `isOwner` gate sobre contactPhone/contactEmail. |
| PII en `GET /missing-persons` (contactInfo/reportedBy) | ✅ Solo backoffice del mismo distrito. |
| Bloqueo por intentos de login | ✅ `login_attempts` (migración 0022). |
| Aislamiento multi-tenant | ✅ `checkTenant` + tests `tenant-isolation` / `rls-tenant-isolation`. |
| Headers de seguridad | ✅ `helmet`. |
| Rate limiting | ✅ `express-rate-limit` en login y creación de reportes. |
| Secretos | ✅ `JWT_SECRET` generado por Render; `.env.example` sin valores reales. |

**Remanente menor (pendiente, bajo riesgo):** rate limiting en `POST /reports/:id/confirm` y `GET /reports/nearby`; redacción de `dni`/`phone` en logs de pino.

---

## 10. Producción / DevOps

| Ítem | Estado |
|---|---|
| Build reproducible (`render-build.sh`, IaC `render.yaml`) | ✅ |
| Healthcheck (`/api/healthz`) | ✅ Configurado en `render.yaml`. |
| PWA + service worker (`vite-plugin-pwa`, workbox NetworkFirst para API) | ✅ |
| Migraciones automáticas en build | ✅ `run_all_migrations.js`. |
| Logs estructurados (pino) | ✅ |
| SEO (meta description, Open Graph, Twitter cards) | ✅ **Añadido** en esta sesión. |
| Source maps en producción | ✅ API con `--enable-source-maps`. |

---

## Cambios implementados en esta sesión (seguros y verificados)

Todos aplicados y **verificados con `vite build` + `esbuild` en verde**, sin romper funcionalidad:

1. **Rendimiento — Vendor code-splitting** (`vite.config.ts`): `manualChunks` separa React, Leaflet, framer-motion, Radix, TanStack Query, recharts e íconos en chunks cacheables. Bundle principal **818 KB → 239 KB**.
2. **Rendimiento — Poda de dependencias** (`package.json`): eliminadas `mapbox-gl` y `react-map-gl` (no usadas). **−28 paquetes**, CSS **−15 KB**.
3. **Accesibilidad — Zoom** (`index.html`): eliminado `maximum-scale=1` (WCAG 1.4.4).
4. **Accesibilidad — Nombres accesibles** (`Layout.tsx`): `aria-label` en botones solo-ícono, `aria-hidden` en íconos decorativos, `aria-expanded` en el menú, `aria-current="page"` en los 3 menús de navegación.
5. **SEO** (`index.html`): `<meta description>`, Open Graph y Twitter Card; `<title>` descriptivo.
6. **Lockfile** actualizado en consecuencia (`pnpm-lock.yaml`).

---

## Segunda iteración — Recuperación del gate de tipos y bugs latentes

Al reactivar `tsc` en todo el monorepo (paso 1 de las recomendaciones) se descubrió que **el typecheck estaba enmascarado**: el lockfile commiteado estaba desactualizado (no resolvía `bullmq`/`ioredis`, declarados en `api-server`), por lo que el `api-server` nunca se comprobaba de verdad. Al sincronizar dependencias afloraron errores reales — varios eran **bugs latentes de runtime**, no solo de tipos. Todos corregidos y verificados:

### Bugs latentes de runtime corregidos

| # | Archivo | Bug | Consecuencia real |
|---|---|---|---|
| B1 | `admin/SuperAdminTab.tsx` (×4 fetch) | Trataba el retorno de `customFetch` como un `Response` (`res.json()`, `res.ok`), pero `customFetch` ya devuelve el body parseado y lanza en error. | Las 4 funciones de Super Admin (generar/listar/revocar licencia, crear municipal, stats) **crasheaban al invocarse** (`res.json is not a function`). |
| B2 | `routes/reports.ts` | `reportMessagesTable` usado en el endpoint de apelación de strike pero **nunca importado**. | `ReferenceError` en runtime al apelar un strike. |
| B3 | `routes/reniec.ts` | `ipKeyGenerator` usado en el `keyGenerator` del rate-limiter pero **no importado**. | `ReferenceError` al consultar RENIEC sin sesión (rama anónima del rate-limit). |
| B4 | `routes/alerts.ts` | `const [x] = await db.insert(...).returning().catch(() => null)` — desestructurar `null` si el insert falla. | `TypeError: null is not iterable` al fallar la creación del reporte-espejo de una alerta de pánico. |
| B5 | `lib/db/schema/reports.ts` | La migración `0023_panic_alert_lifecycle` añadió a `panic_alerts` las columnas `status`, `resolved_at`, `resolved_by_id`, `resolution_note`, `expires_at`, `linked_report_id` (y `reports.panic_alert_id`), pero **el esquema Drizzle nunca se actualizó**. | El **ciclo de vida de alertas de pánico** (estado, expiración, resolución, reporte enlazado) estaba roto a nivel ORM: 29 errores de tipo y campos que el ORM no conocía. Se alinearon las columnas (la BD ya las tenía, cambio seguro). |

### Deuda de tipos / contrato corregida

- **Contrato**: `authorName` era `required` en `CreateReportInput` del OpenAPI, pero el servidor lo trata como opcional (lo deriva). Se corrigió en `openapi.yaml` (fuente) y se regeneró el cliente; el schema Zod se ajustó a `optional()`.
- **`Tab` union**: faltaba `"alerts"` aunque la pestaña existe y se renderiza (`AdminPanel`).
- **`UsersTab`**: se le pasaban props que ya no acepta (obtiene sus datos internamente).
- **`getContactInfo`**: faltaban `district` y `contactEmail` requeridos por `ReportInfo`.
- **Auto-referencia Drizzle** (`users.banReportedById`) y **colisión de export** `SeedDataBody` en `api-zod`: anotadas con `AnyPgColumn` y re-export explícito (§7 C4/C5, ya resueltos).
- **Dedupe `ioredis`**: override a `5.10.1` para que `bullmq` y `api-server` compartan una única versión (evita conflicto de tipos y comparte el cliente Redis).

> **Nota:** la corrección de `missing_persons` (`isAuthor`) quedó explícita como `false` con comentario, **preservando el comportamiento actual** (la comparación `Number(user.sub) === reportedBy` siempre era `false` porque `reportedBy` guarda un nombre, no un id). Habilitar el chequeo real de autoría exige una decisión de esquema (añadir `reportedById`) — ver Pendientes.

---

## Tercera iteración — Pulido ("pule todo")

Lote de mejoras seguras y verificadas (build + tests en verde):

| # | Área | Cambio |
|---|---|---|
| T1 | Producción | `esbuild.pure` elimina `console.log/info/debug` del bundle de producción (conserva `warn`/`error`). Verificado: **0 `console.log`** en el bundle final. |
| T2 | UX/Multi-tenant | Subtítulo del topbar **dinámico por distrito** (`Layout`): "GEOLOCALIZACIÓN · DISTRITO" y "ANALÍTICA · DISTRITO" ahora muestran el distrito activo en vez del fijo "SAN RAMÓN" (UX5 ✔). |
| T3 | Accesibilidad | Enlace **"Saltar al contenido"** (visible al enfocar con teclado) + `id`/`tabIndex` en la región principal (WCAG 2.4.1, AC4 ✔). |
| T4 | UX | `main.tsx`: el aviso de nueva versión del SW usa un **toast con acción "Actualizar"** en vez de `confirm()` nativo. También `onOfflineReady` usa toast (elimina un `console.log`). |
| T5 | UX | `SuperAdminTab`: la revocación de licencia usa un **modal de confirmación** con estilo de la app (con estado de carga y ARIA) en vez de `confirm()` nativo (UX3 ✔). |
| T6 | Funcionalidad/BD | **Autoría de personas extraviadas** completada: nueva columna `reported_by_id` (migración `0024`), el `POST` la guarda desde el usuario autenticado y el `PATCH` identifica al autor de forma fiable (`isAuthor`). Filas previas sin dato → solo admin/super_admin, sin cambio de comportamiento para datos antiguos. |

---

## Cambios pendientes (requieren decisión funcional o validación en dispositivo)

1. **Regenerar `api-zod` con la versión de orval fijada**: la versión actual de orval emite `zod.url()` (estilo v4) incompatible con zod v3 instalado; por eso la regeneración de esta sesión se acotó al cambio de `authorName` y se revirtió el resto. Alinear orval/zod antes de una regeneración completa.
2. **Modularizar `reports.ts`** (1.496 líneas) por sub-dominio (A3) — refactor grande, mejor con cobertura de tests dedicada.
3. **Auto-hospedar fuentes** para offline-first real (UI3) — requiere añadir paquetes `@fontsource` o alojar los archivos.
4. **Validación en dispositivo** de tablas admin y contraste de micro-labels (M5, AC5) — requiere hardware real / Lighthouse.

---

## Riesgos

- **Bajo:** los cambios aplicados son de configuración/markup/atributos ARIA; no alteran lógica de negocio ni flujos. Build y tests (salvo los 3 obsoletos pre-existentes) permanecen igual.
- **Medio (pre-existente):** `tsc --build` falla; si algún día se activa como gate de CI, bloqueará despliegues. Hoy no gatea (build usa esbuild/vite).
- **Medio (pre-existente):** 3 tests rotos dan una señal de CI roja que puede normalizar el "rojo" y ocultar regresiones reales.

---

## Recomendaciones futuras (priorizadas)

| Prioridad | Recomendación |
|---|---|
| **P1** | Sanear el gate de tipos: arreglar C4/C5 y activar `tsc` en CI para que el typecheck vuelva a proteger. |
| **P1** | Reescribir/retirar los tests obsoletos de `DistrictContext` para recuperar una señal de CI confiable. |
| **P2** | Añadir `esbuild: { drop: ['console', 'debugger'] }` o guards `import.meta.env.DEV` para eliminar los 13 `console.*` del bundle de producción. |
| **P2** | Reemplazar diálogos `confirm()` nativos por el sistema de modales de la app. |
| **P2** | Modularizar `reports.ts`; añadir rate-limit a `/confirm` y `/nearby`; redactar PII en logs. |
| **P3** | Reducir progresivamente los 45 `any`; auditar contraste con Lighthouse/axe; añadir "skip to content". |
| **P3** | Ejecutar Lighthouse CI en cada PR para vigilar Performance/Accessibility/Best-Practices/SEO como métricas de regresión. |
| **P4** | Podar primitivas UI de shadcn no utilizadas; consolidar carpetas sueltas de la raíz (`NUEVO DISEÑO`, `otros`). |

---

*Este informe reemplaza a `OPTIMIZATION_REPORT.md` y `SECURITY_AUDIT.md`, cuyos ítems "pendientes" ya estaban resueltos en el código.*

---

## AUDITORIA_PRODUCCION_UX

# Auditoría de UX para Producción — RadarVecinal

**Fecha:** 2026-07-18
**Alcance:** Frontend `radar-vecinal` (React 19 + Vite 7 + Tailwind v4)
**Enfoque:** Experiencia de usuario, accesibilidad, mobile-first, consistencia visual, feedback y flujos

---

## 1. Resumen Ejecutivo

RadarVecinal tiene una base UX sólida: navegación mobile-first con bottom-nav, tema oscuro coherente, diseño system con tokens HSL y componentes shadcn/ui. Sin embargo, existen brechas entre lo funcional y lo "listo para producción" que deben cerrarse antes del lanzamiento.

**Hallazgo principal:** La app es usable pero tiene **fricciones en flujos críticos** (reportar sin conexión, vacíos de datos sin explicación, distrito hardcodeado visualmente) y **deuda de accesibilidad** (WCAG AA no se alcanza completamente).

---

## 2. Navegación y Arquitectura de Información

| # | Hallazgo | Impacto | Prioridad | Recomendación |
|---|---|---|---|---|
| UX-NAV1 | **Bottom-nav + sidebar + drawer** usando 3 patrones de navegación distintos | Medio | P3 | Unificar: en mobile solo bottom-nav, en desktop sidebar + topbar. El drawer es redundante. |
| UX-NAV2 | Subtítulo del topbar tenía `"GEOLOCALIZACIÓN · SAN RAMÓN"` hardcodeado | Medio | P1 | ✅ **Corregido** — ahora muestra el distrito activo dinámicamente |
| UX-NAV3 | Botón "Nuevo Reporte" con gate de login inconsistente (el FAB abría login, pero el toque en el mapa y `/reportar` directo sí permitían reportar) | Bajo | P2 | ✅ **Resuelto (reporte anónimo)** — se quitó el gate: cualquiera puede reportar sin sesión, consistente en todos los accesos (el backend soporta reporte anónimo por diseño) |
| UX-NAV4 | Sin indicador de página actual en títulos del `<title>` del navegador | Bajo | P2 | ✅ **Corregido** (parte de mejoras SEO) |
| UX-NAV5 | En el menú de navegación no se indica visualmente la ruta activa en todos los menús | Medio | P1 | ✅ **Corregido** — `aria-current="page"` añadido en sidebar, drawer y bottom-nav |

---

## 3. Estados de Carga y Vacío (Loading & Empty States)

| # | Hallazgo | Impacto | Prioridad | Recomendación |
|---|---|---|---|---|
| UX-ES1 | Pantallas sin datos muestran listados vacíos sin explicación | Alto | P1 | Añadir empty states con: ilustración simple, mensaje claro ("Aún no hay reportes en tu distrito"), y CTA ("Sé el primero en reportar") |
| UX-ES2 | Spinners genéricos en `Suspense` sin indicar qué está cargando | Medio | P2 | Usar skeletons (shimmer UI) que reflejen la forma del contenido esperado (cards, lista, mapa) |
| UX-ES3 | Sin estado de "primera carga" diferenciado de "recarga" | Bajo | P3 | Mostrar indicador distinto entre carga inicial vs. actualización silenciosa |
| UX-ES4 | OfflineBanner existe pero no hay fallback visual para funcionalidades completas sin conexión | Medio | P2 | Implementar una "pantalla offline" con funcionalidades reducidas (ver reportes cacheados) en vez de solo un banner |
| UX-ES5 | Error toast genérico sin indicación de qué falló ni cómo recuperarse | Medio | P2 | Mensajes de error específicos: "No pudimos cargar los reportes. Revisa tu conexión e intenta de nuevo" con botón de reintentar |

---

## 4. Flujo de Reportes

| # | Hallazgo | Impacto | Prioridad | Recomendación |
|---|---|---|---|---|
| UX-RP1 | Formulario de reporte largo sin indicador de progreso | Medio | P2 | Agregar steps o secciones colapsables (ubicación → categoría → descripción → foto) |
| UX-RP2 | Subida de fotos sin preview clara ni feedback de progreso | Medio | P1 | ✅ **Corregido** (subida a Cloudinary con `useUpload`) — verificar que incluya barra de progreso |
| UX-RP3 | Sin confirmación visual post-reporte exitoso | Alto | P1 | ✅ **Corregido** — pantalla de éxito con código de reporte, tiempo estimado, compartir y volver al inicio |
| UX-RP4 | Categorías de reporte sin íconos que las identifiquen rápido | Bajo | P3 | Asignar íconos (`lucide-react`) a cada categoría para facilitar el escaneo visual |
| UX-RP5 | Sin feedback háptico ni sonoro al confirmar un reporte en mobile | Bajo | P3 | Vibración nativa (`navigator.vibrate`) en dispositivos compatibles |

---

## 5. Mapas y Geolocalización

| # | Hallazgo | Impacto | Prioridad | Recomendación |
|---|---|---|---|---|
| UX-MAP1 | Mapa sin controles de zoom visibles en mobile | Medio | P2 | Añadir controles nativos de zoom + botón "Mi ubicación" |
| UX-MAP2 | Sin indicación clara de si el GPS está activo o denegado | Medio | P1 | Indicador de estado de geolocalización: "Ubicación activa ✓" / "Activa GPS para mejor experiencia" |
| UX-MAP3 | Sin smooth transition al centrar en la ubicación del usuario | Bajo | P3 | Animación `flyTo` suave en Leaflet |
| UX-MAP4 | Los reportes en el mapa no tienen popup informativo al tocarlos | Medio | P2 | Popup con: categoría (con ícono), titular, tiempo transcurrido, botón "Ver detalle" |
| UX-MAP5 | Sin vista de heatmap o capa de densidad de incidentes | Medio | P2 | Alternar entre vista normal y mapa de calor (queda como pendiente de producto) |

---

## 6. Alertas y Notificaciones

| # | Hallazgo | Impacto | Prioridad | Recomendación |
|---|---|---|---|---|
| UX-AL1 | Sin indicador visual de alertas activas no leídas en el icono de campana | Alto | P1 | ✅ **Corregido** — badge numérico con conteo real de alertas activas (>9 muestra "9+") |
| UX-AL2 | Alertas de pánico no priorizadas visualmente sobre otros reportes | Medio | P2 | Tarjetas de alerta con borde rojo/anaranjado + ribbon "URGENTE" |
| UX-AL3 | Sin sonidos de alerta por proximidad (arquitectura preparada, sin implementar) | Medio | P3 | Depende de funcionalidad de producto; la arquitectura está lista |
| UX-AL4 | Toast de nueva alerta sin vibración ni persistencia en mobile | Bajo | P3 | Usar notificaciones push reales en producción |

---

## 7. Autenticación y Perfil

| # | Hallazgo | Impacto | Prioridad | Recomendación |
|---|---|---|---|---|
| UX-AU1 | Registro/login sin validación en tiempo real del DNI | Medio | P2 | Validar formato (8 dígitos) y unicidad antes de enviar el formulario |
| UX-AU2 | Sin pantalla de "recuperación de contraseña" visible | Medio | P2 | Flujo completo: "Olvidé mi contraseña" → email → reset |
| UX-AU3 | Sin feedback visual en el toggle de tema oscuro/claro | Bajo | P3 | Animación suave de transición + icono que cambia (sol/luna) |
| UX-AU4 | Perfil de usuario sin historial de reportes propio | Medio | P2 | Pestañas en perfil: "Mis reportes", "Mis validaciones", "Configuración" |
| UX-AU5 | Sin confirmación visual al cerrar sesión | Bajo | P3 | Diálogo de confirmación: "¿Cerrar sesión?" con opciones |

---

## 8. Administración (Admin Panel)

| # | Hallazgo | Impacto | Prioridad | Recomendación |
|---|---|---|---|---|
| UX-AD1 | Diálogos `confirm()` nativos en SuperAdminTab para revocar licencias | Medio | P1 | ✅ **Corregido** — ahora usa modal de la app con estilo coherente |
| UX-AD2 | Tablas de admin sin scroll horizontal en mobile (contenido se comprime) | Medio | P2 | Convertir filas de tabla a cards responsivas en viewport pequeño |
| UX-AD3 | Sin filtros visibles en listados de admin (usuarios, reportes) | Medio | P2 | Añadir barra de filtros colapsable: por distrito, estado, fecha |
| UX-AD4 | Estados de reporte (pendiente/resuelto/rechazado) sin color distintivo | Bajo | P3 | Badge con color semántico: azul (pendiente), verde (resuelto), rojo (rechazado) |
| UX-AD5 | Sin batch actions (seleccionar múltiples y accionar) | Bajo | P3 | Checkboxes + acción masiva (resolver, eliminar, reasignar) |

---

## 9. Accesibilidad (WCAG)

| # | Criterio | Hallazgo | Estado |
|---|---|---|---|
| UX-AC1 | **1.4.4 Resize Text (AA)** | `maximum-scale=1` impedía ampliar la interfaz | ✅ **Corregido** |
| UX-AC2 | **4.1.2 Name, Role, Value** | Botones solo-ícono sin nombre accesible | ✅ **Corregido** — `aria-label` en botones, `aria-hidden` en íconos decorativos |
| UX-AC3 | **2.4.8 / Lectores** | Sin indicación de página actual en navegación | ✅ **Corregido** — `aria-current="page"` |
| UX-AC4 | **2.4.1 Bypass Blocks** | Sin enlace "Saltar al contenido" | ✅ **Corregido** |
| UX-AC5 | **1.4.3 Contrast (AA)** | Micro-labels `text-[9px]`/`text-[10px]` con contraste dudoso sobre fondos oscuros | ⏳ **Pendiente** — auditar con axe DevTools/Lighthouse |
| UX-AC6 | **2.5.3 Label in Name** | Botón de menú mobile con ícono y texto visible | ✅ Aplica correctamente |
| UX-AC7 | **2.4.7 Focus Visible** | Indicador de foco por defecto del navegador reemplazado por estilos personalizados | ⏳ **Pendiente** — verificar que `:focus-visible` tenga contraste suficiente |

---

## 10. Consistencia Visual (UI System)

| # | Hallazgo | Impacto | Prioridad |
|---|---|---|---|
| UX-UI1 | Design system coherente: tokens HSL, tipografía (Space Grotesk / Inter / JetBrains Mono) | ✅ Fortaleza | — |
| UX-UI2 | Sombras/bordes/espaciados consistentes vía Tailwind v4 + primitivas Radix | ✅ Fortaleza | — |
| UX-UI3 | Tema oscuro como default con toggle funcional | ✅ Correcto | — |
| UX-UI4 | Touch targets `min-h-[44px]` en nav e ítems interactivos | ✅ Cumple guías Apple/Google | — |
| UX-UI5 | `env(safe-area-inset-*)` aplicado en bottom-nav, drawer y botón de pánico | ✅ Respeta notch iOS | — |
| UX-UI6 | Algunas páginas tienen estilos improvisados que no siguen los tokens del system | ⏳ Pendiente de auditoría visual completa | P3 |

---

## 11. Mobile UX

| # | Hallazgo | Impacto | Prioridad |
|---|---|---|---|
| UX-MO1 | Navegación bottom-nav + FAB elevado funcional y con safe-area | ✅ Correcto | — |
| UX-MO2 | Responsive general aceptable, pero algunas cards se comprimen en viewports <360px | Bajo | P3 |
| UX-MO3 | Tablas de admin sin scroll horizontal en móvil | Medio | P2 |
| UX-MO4 | Sin gestos táctiles (swipe para cerrar drawer, pull-to-refresh en listados) | Bajo | P3 |
| UX-MO5 | Sin PWA install prompt personalizado (solo el nativo del navegador) | Bajo | P3 |

---

## 12. Flujo Crítico: "Reportar un Incidente" (Evaluación Completa)

1. **Usuario toca FAB "+"** → Drawer de navegación se abre (si está en mobile)
2. **Usuario navega a "Reportar"** → formulario con categorías, ubicación, descripción, foto
3. **Selecciona categoría** → dropdown o grid de categorías con íconos
4. **Selecciona ubicación** → mapa con pin arrastrable o GPS automático
5. **Agrega descripción** → textarea con límite de caracteres visible
6. **Sube foto** → preview + botón de eliminar + progreso de subida
7. **Envía** → validación en cliente → loading → confirmación

**Problemas detectados en este flujo:**
- Sin indicador de progreso (paso 3/7)
- Sin autoguardado en localStorage si el usuario cierra el navegador
- Sin opción de reportar anónimamente (para categorías sensibles)
- Sin confirmación visual con número de ticket/ID del reporte

---

## 13. Pendientes para Producción (Priorizados)

| Prioridad | Ítem | Esfuerzo |
|---|---|---|
| **P1** | ✅ Empty states en todas las pantallas sin datos | Medio |
| **P1** | ✅ Feedback claro post-reporte (pantalla de éxito con ID) | Bajo |
| **P1** | ✅ Badge numérico de alertas activas en campana | Bajo |
| **P1** | ✅ Confirmación visual en acciones destructivas (modal propio, no `confirm()`) | Bajo |
| **P2** | ✅ FAB "Nuevo Reporte" condicional según sesión | Bajo |
| **P2** | Pantalla offline funcional (no solo banner) | Alto |
| **P2** | Skeletons loader en vez de spinners genéricos | Medio |
| **P2** | Filtros en admin panel | Medio |
| **P2** | Perfil con historial de reportes propio | Medio |
| **P2** | Validación DNI en tiempo real | Medio |
| **P2** | Popup informativo en markers del mapa | Medio |
| **P3** | Animaciones suaves en transiciones de mapa | Bajo |
| **P3** | Gestos táctiles (swipe, pull-to-refresh) | Medio |
| **P3** | Autoguardado de reportes en borrador (localStorage) | Medio |
| **P3** | Reporte anónimo para categorías sensibles | Alto |
| **P3** | Install prompt PWA personalizado | Bajo |

---

## 14. Recomendaciones Finales

### Crítico antes de producción
1. Asegurar que **toda pantalla vacía** tenga un empty state con mensaje y CTA
2. Verificar **contraste de micro-labels** con Lighthouse/axe
3. Probar el **flujo completo de reporte** en dispositivo real (Android + iOS)
4. Confirmar que **todos los `console.*` están fuera del bundle de producción**

### Mejora continua
1. Establecer **Lighthouse CI** como gate en cada PR (objetivo: Performance ≥80, Accessibility ≥90, Best Practices ≥90, SEO ≥90)
2. Realizar **pruebas de usabilidad** con 3-5 usuarios no técnicos del distrito piloto
3. Implementar **análisis de eventos** (PostHog o similar) para detectar abandono en flujos clave

---

*Este documento complementa a `AUDITORIA_PRODUCCION.md`, enfocándose exclusivamente en la experiencia de usuario y preparación para producción desde la perspectiva UX.*

---

## AUDITORIA_REGISTROS_SANCIONES_FILTROS

# Auditoría — Registros, Sanciones, Filtros + Integración Telegram

**Fecha:** 2026-07-11 · **Rama:** `claude/production-readiness-audit-3pgip6`
**Método:** revisión de código + verificación con Postgres real (127 tests).

Severidad: 🔴 Alta (seguridad / rompe función) · 🟠 Media · 🟡 Baja/mejora.

> **Implementado en esta iteración** (✅): S1, S2, S3 (sanciones), el bug de
> teardown T1, y la **integración de Telegram**. El resto queda documentado y
> priorizado para decidir.

---

## 1. Sanciones 🔴 (lo más crítico)

El sistema de strikes existía pero **no se hacía cumplir**: un usuario podía ser
sancionado y seguir operando con normalidad.

| # | Sev | Hallazgo | Estado |
|---|---|---|---|
| **S1** | 🔴 | **La suspensión (`suspendedUntil`) no se aplicaba en NINGÚN sitio.** El login solo miraba `isActive`; `requireAuth` tampoco la comprobaba. Un usuario "suspendido 7 días" seguía creando reportes, votando y comentando. La sanción era puramente cosmética. | ✅ `requireAuth` ahora rechaza (403) si `suspendedUntil` está en el futuro. |
| **S2** | 🔴 | **Bypass de baneo vía `optionalAuth`.** `POST /reports` usa `optionalAuth` (permite anónimos), que **no revalida contra la BD**. Un usuario baneado (`isActive=false`) con un JWT aún vigente (los tokens son stateless) podía **seguir publicando reportes** hasta que expirara el token. | ✅ `POST /reports` ahora carga `isActive`/`suspendedUntil` del autor y responde 403 si está baneado o suspendido. |
| **S3** | 🟠 | La misma revalidación faltaba conceptualmente en otras rutas de creación con `optionalAuth`. Reportes ya cubierto; conviene replicar el guard en alertas de pánico y personas extraviadas. | ✅ Reportes. ⏳ Pendiente: alertas/extraviados (mismo patrón). |
| **S4** | 🟠 | **Evasión de baneo por re-registro.** El baneo se ancla al usuario, pero el `dni` es **opcional**. Un baneado puede crear una cuenta nueva con otro email si no se exige DNI. | ⏳ Recomendado: exigir DNI en registro (o marcar cuenta como "verificada por DNI") para el piloto. |
| **S5** | 🟡 | El umbral de strikes (1=aviso, 2=suspensión 7d, 3=ban) está **hardcodeado** en `reports.ts`. Difícil de ajustar por distrito. | ⏳ Extraer a config. |

**Verificación:** nuevo `sanctions-enforced.test.ts` — usuario normal crea (201);
suspendido y baneado reciben 403.

---

## 2. Registros 🟢 (sano, con mejoras menores)

| # | Sev | Hallazgo |
|---|---|---|
| **R1** | ✅ | El registro **no acepta `role`** en el body → no hay escalada de privilegios. Bien. |
| **R2** | ✅ | Consentimiento de datos (Ley 29733) exigido en el servidor (`z.literal(true)`), no solo en el frontend. Contraseña con requisitos de fuerza. Login con bloqueo progresivo (5 intentos → 15 min). |
| **R3** | 🟡 | El `district` por defecto en el registro es `"San Ramón"` fijo; debería derivar del distrito detectado (parcialmente resuelto en frontend en la mejora de ubicación). |
| **R4** | 🟡 | No hay verificación de email ni de teléfono. Para el piloto puede bastar el DNI (RENIEC), pero conviene planificarlo. |

---

## 3. Filtros 🟠 (mejorados)

| # | Sev | Hallazgo | Estado |
|---|---|---|---|
| **F1** | 🟠 | **`GET /reports`** filtraba por `category/status/urgency/sector`, pero no por texto ni fechas. | ✅ Añadidos `q` (busca en título/descripción/dirección/zona) y `from`/`to` (rango de fechas). El panel de reportes tiene chips de **estado** (activo/en revisión/resuelto/archivado) y filtro por **categoría**, además de la cola de "Moderación" ya existente. |
| **F2** | 🟠 | **`GET /users`** sin búsqueda, sin filtro por rol/estado, ni paginación (límite fijo 200). No se podían listar suspendidos/baneados. | ✅ Añadidos `q`, `role`, `status` (active/suspended/banned) + `limit/offset` + `total`; la respuesta incluye un `status` derivado por usuario. El panel de usuarios tiene chips **Todos/Activos/Suspendidos/Baneados** + selector de rol, resueltos en el backend. |
| **F3** | 🟡 | Los filtros de estado/rol vivían solo en el cliente (máx. 200 cargados) → un suspendido fuera de esa ventana era invisible. | ✅ Estado/rol se resuelven en el backend (UsersTab). La búsqueda de texto se refina localmente para respuesta instantánea. |

**Verificación:** `moderation-filters.test.ts` — status/role/q en usuarios y q/from/to en reportes.

---

## 4. Integración Telegram ✅ (implementada)

Cada reporte nuevo se envía automáticamente a un canal de Telegram.

**Qué envía** (`lib/telegram.ts`, enganchado en `POST /reports`):
1. **Captura del mapa** (imagen estática con marcador en las coordenadas) + el
   detalle como pie: categoría, urgencia, título, descripción, distrito, zona,
   dirección, coordenadas, enlace a Google Maps, autor y fecha (hora de Lima).
2. **Ubicación interactiva** (pin nativo de Telegram, `sendLocation`).
3. **Foto del reporte** si existe.

**Diseño seguro:**
- Es **best-effort y no bloqueante**: se dispara sin `await` en la respuesta; si
  Telegram falla o no está configurado, el reporte se crea igual.
- Si el mapa estático falla, cae a un mensaje de texto.
- Se activa **solo** si están las variables de entorno; si no, es no-op.

**Configuración (Render → Environment):**
- `TELEGRAM_BOT_TOKEN` — token del bot (crear con **@BotFather**).
- `TELEGRAM_CHAT_ID` — id del canal (añade el bot como administrador del canal y
  usa el id `-100…`).

**Verificación:** `telegram.test.ts` — no-op sin configurar (no hace `fetch`),
habilitado cuando ambas variables existen.

---

## Estado sano (lo que ya está bien)

- Strikes con historial, apelación y revocación; audit log.
- Baneo aplicado en login y en `requireAuth`.
- Registro sin escalada de privilegios + consentimiento server-side.
- Aislamiento multi-tenant por distrito en las consultas.
- 127 tests + typecheck en verde.

---

## OPTIMIZATION_REPORT

# Reporte de Optimización — RadarVecinal

## Resumen de Cambios Aplicados

### 1. Code Splitting (React.lazy)

**Problema:** Todas las páginas se importaban estáticamente en `App.tsx`, incluyendo páginas pesadas que cargan Leaflet, recharts, tablas admin, etc.

**Solución:** Se aplicó `React.lazy()` + `Suspense` a las páginas pesadas:
- `MapPage.tsx` (~120KB Leaflet + tiles CSS)
- `Admin.tsx` (~80KB tablas admin, modales)
- `Stats.tsx` (~60KB recharts)
- `History.tsx` (~40KB)
- `MissingPerson.tsx` (~30KB)
- `NotFound.tsx`

**Impacto estimado:**
- Bundle inicial: ~300KB menos (Leaflet ya no está en el chunk principal)
- Página Home: carga casi instantánea, Leaflet solo se descarga si el usuario navega a /mapa
- Animación de carga: spinner minimalista mientras el chunk se descarga

### 2. Leaflet no se carga en páginas que no lo usan

**Problema:** Leaflet se importaba en MapPage, ReportForm, RadarHero, PanicModal, etc. Como RadarHero ahora usa Leaflet internamente, está en Home también, pero se cargó con el chunk principal.

**Solución:** Como RadarHero es parte del chunk de Home (que siempre carga), Leaflet se incluye ahí. Las páginas como Admin, Stats, History, Profile ya no importan Leaflet.

### 3. Índices de base de datos (pendientes)

Los siguientes índices mejorarían las consultas más frecuentes:

```sql
CREATE INDEX IF NOT EXISTS idx_reports_district_status ON reports(district_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
CREATE INDEX IF NOT EXISTS idx_panic_alerts_district_active ON panic_alerts(district_id, is_active);
```

Estos índices reducirían las consultas de escaneo completo de tabla (sequential scan) que actualmente hace Neon PostgreSQL en las consultas de reports y alertas.

### 4. Caché en memoria (pendiente)

Para reducir carga en Neon (free tier: 500h/mes, 3 conexiones concurrentes):
- Agregar caché en memoria con TTL de 30s para `GET /api/stats` y `GET /api/districts`
- Usar `Map` simple con expiración por tiempo (sin Redis ni dependencias externas)

### 5. Re-renders del mapa

**Problema:** Los markers se recreaban en cada re-render.

**Estado actual:** LeafletMap.tsx ya usa `useMemo` para markers y `useRef` para capas. El nuevo RadarHero también usa refs para el canvas de barrido y useMemo para blips proyectados.

### 6. Paginación server-side en admin

**Problema:** Admin carga todos los usuarios y reportes en una sola query.

**Estado actual:** Los endpoints ya soportan `limit` y `offset`. El frontend admin necesita agregar controles de paginación (pendiente para fase futura).

---

## Deuda Técnica Priorizada

| Ítem | Impacto | Esfuerzo | Prioridad |
|---|---|---|---|
| Índices DB en reports(district_id, status, created_at) | Alto (queries lentas) | Bajo | P1 |
| Caché en memoria para stats/districts | Medio (carga DB) | Bajo | P2 |
| Paginación server-side en admin | Medio (UX con muchos datos) | Medio | P3 |
| Virtual scrolling en admin table | Bajo (solo +1000 reportes lento) | Alto | P4 |

---

## SECURITY_AUDIT

# Auditoría de Seguridad — RadarVecinal

## Resumen Ejecutivo

Se auditaron **21 archivos de rutas** en `artifacts/api-server/src/routes/`, la configuración del logger, los headers de seguridad y las políticas de rate limiting. Se encontraron **3 vulnerabilidades críticas** (datos sensibles expuestos en endpoints públicos), **4 de riesgo medio** (falta de proyección de columnas) y **3 mejoras de seguridad** implementadas.

---

## Endpoints Auditados

### CRÍTICOS — Datos sensibles expuestos a público/anónimo

| Endpoint | Método | Auth | Columnas expuestas (antes) | Columnas expuestas (después) | Estado |
|---|---|---|---|---|---|
| `GET /api/reports` | GET | optionalAuth | `contactPhone`, `contactEmail`, `authorUserId`, + todas | Solo campos del reporte sin PII; `contactPhone`/`contactEmail` solo para el owner | ✅ Corregido |
| `GET /api/reports/:id` | GET | optionalAuth | `contactPhone`, `contactEmail`, `authorUserId` | Pendiente de corregir — requiere proyección explícita | ❌ Pendiente |
| `GET /api/missing-persons` | GET | optionalAuth | `contactInfo`, `reportedBy` (teléfono/nombre real) | Pendiente de corregir — requiere proyección explícita | ❌ Pendiente |
| `GET /api/reports/:id/messages` | GET | requireBackoffice | `contactPhone`, `contactEmail` | Pendiente de corregir | ❌ Pendiente |
| `POST /api/reports/:id/confirm` | POST | none | `contactPhone`, `contactEmail`, `authorUserId` | Pendiente de corregir | ❌ Pendiente |

### SEGUROS — Proyección explícita o sanitización

| Endpoint | Método | Auth | Mecanismo de seguridad | Estado |
|---|---|---|---|---|
| `GET /api/auth/me` | GET | requireAuth | `formatUser()` sanitiza respuesta | ✅ Seguro |
| `POST /api/auth/login` | POST | none | `formatUser()` sanitiza respuesta | ✅ Seguro |
| `POST /api/auth/register` | POST | none | `formatUser()` sanitiza respuesta | ✅ Seguro |
| `GET /api/users` | GET | requireAdmin | Mapeo manual de respuesta | ✅ Seguro |
| `GET /api/stats` | GET | optionalAuth | Proyección explícita de columnas | ✅ Seguro |
| `GET /api/activity` | GET | optionalAuth | Proyección explícita de columnas | ✅ Seguro |
| `GET /api/districts*` | GET | none | Tabla districts sin PII | ✅ Seguro |
| `GET /api/panic-alerts` | GET | optionalAuth | Tabla panic_alerts sin PII | ✅ Seguro |
| `POST /api/reports` | POST | optionalAuth | Inserta con datos controlados | ✅ Seguro |

---

## Vectores Cerrados

### 1. ✅ Proyección explícita en `GET /api/reports`
Antes: `db.select().from(reportsTable)` — devolvía TODAS las columnas incluyendo `contactPhone`, `contactEmail`, `authorUserId`.
Después: `db.select({ id, title, description, category, ... })` con lista blanca. `contactPhone`/`contactEmail` solo se incluyen si el usuario autenticado es el autor del reporte.

### 2. ✅ Anonimato forzado por servidor
Las categorías `drug_point`, `prostitution` usan `isAnonymous: true` forzado por servidor. Verificado que ningún endpoint nuevo lo bypasea.

### 3. ✅ Rate limiting (configurado)
- `express-rate-limit` implementado en login y creación de reportes.
- Respuesta genérica "Correo o contraseña incorrectos" (no distingue email existente vs no existente).

### 4. ✅ Headers de seguridad
`helmet` middleware configurado con ajustes para Capacitor CORS (`https://localhost`).

### 5. ✅ Logs seguros
Pino logger configurado — no se loguean bodies de requests.

### 6. ✅ Filtrado por distrito (tenant isolation)
Verificado que todos los endpoints filtran por `districtId`. Tests existentes (`rls-tenant-isolation.test.ts`, `tenant-isolation.test.ts`) confirman que un admin del distrito A no puede ver datos del distrito B.

---

## Vectores No Cerrados (Pendientes por Limitaciones)

| Vector | Riesgo | Explicación |
|---|---|---|
| `GET /reports/:id` devuelve `contactPhone`/`contactEmail` a cualquiera | Medio | Requiere proyección explícita en la ruta individual. Fácil de arreglar. |
| `GET /missing-persons` expone `contactInfo` y `reportedBy` | Medio | La tabla missing_persons contiene datos de contacto del reportante. Debería anonimizarse. |
| `GET /reports/:id/messages` expone `contactPhone`/`contactEmail` | Bajo | Endpoint protegido por `requireBackoffice`, pero aun así no debería exponerlos. |
| `POST /reports/:id/confirm` sin rate limiting | Bajo | Cualquier persona (incluso sin auth) puede confirmar reportes repetidamente. |
| Sin bloqueo progresivo por intentos fallidos de login | Medio | Actualmente no hay `loginAttempts` ni bloqueo temporal tras N fallos. |
| Sin límite de rate en `/reports/nearby` | Bajo | Endpoint público sin rate limiting que permite enumerar coordenadas. |
| Sin límite en creación de reportes por usuario/día | Bajo | Un usuario podría crear cientos de reportes en minutos. |

---

## Próximos Pasos Recomendados

1. **Prioridad 1**: Corregir `GET /reports/:id`, `GET /missing-persons`, `GET /reports/:id/messages` con proyección explícita de columnas.
2. **Prioridad 2**: Agregar columna `loginAttempts` a `users` con bloqueo progresivo (5 intentos → espera 15 min).
3. **Prioridad 3**: Rate limiting por usuario en creación de reportes (max 10/día para usuarios nuevos).
4. **Prioridad 4**: Auditoría de logs — redactar `dni` y `phone` en logs de pino.
