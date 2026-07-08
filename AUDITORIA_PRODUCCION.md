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

- ✅ Frontend `vite build`: **OK** (7 s)
- ✅ API server `esbuild`: **OK** (0.4 s)
- ⚠️ `tsc --build` (typecheck estricto): falla por deuda de tipos (ver §7). **No bloquea producción** porque el build real usa esbuild/vite, no `tsc`.
- ⚠️ Tests frontend: 3 fallos **pre-existentes** en `DistrictContext.test.tsx` (tests obsoletos, ver §7).

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

## Cambios pendientes (requieren decisión funcional o validación en dispositivo)

1. **Reemplazar `confirm()` nativos** (SuperAdminTab, main.tsx) por el modal propio de la app — requiere definir copy/estética (UX3).
2. **Reescribir `DistrictContext.test.tsx`** con mocks del API que reflejen la resolución dinámica de distrito (C6). No debe "arreglarse" ocultando el fallo.
3. **Corregir generación de `lib/api-zod`** para evitar la colisión `SeedDataBody` (C4) — tocar el generador, no el código generado.
4. **Modularizar `reports.ts`** (1.496 líneas) por sub-dominio (A3).
5. **Subtítulo del topbar dinámico por distrito** en vez de "SAN RAMÓN" fijo (UX5).
6. **Auto-hospedar fuentes** para offline-first real (UI3).
7. **Validación en dispositivo** de tablas admin y contraste de micro-labels (M5, AC5).

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
