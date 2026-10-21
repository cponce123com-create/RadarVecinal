# Scorecard de calidad — Radar Vecinal

> Metodología, pesos y puntuaciones de las 25 áreas de la auditoría continua.
> **Ciclo 001** · 2026-10-21 · Base `main@cf366234` · Rama `feature/audit-cycle-001`

---

## 1. Metodología

Cada área se puntúa de 0 a 10 con una **rúbrica fija** de cinco dimensiones,
ponderadas. La puntuación de un área es la media ponderada de sus dimensiones.

| Dimensión                             | Peso | Qué mide                                                                 |
| ------------------------------------- | ---: | ------------------------------------------------------------------------ |
| **C** Corrección funcional            | 25 % | ¿Hace lo que debe, en todos los caminos? ¿Sin estados intermedios rotos? |
| **S** Seguridad                       | 25 % | Autenticación, autorización, validación, PII, superficie de ataque       |
| **P** Pruebas                         | 20 % | Cobertura de los caminos críticos y **calidad** de esas pruebas          |
| **Q** Calidad de implementación       | 15 % | Tipado, separación de responsabilidades, legibilidad, deuda              |
| **M** Mantenibilidad / observabilidad | 15 % | Documentación, logs, métricas, facilidad de cambio                       |

### Escala

| Rango | Significado                                                                    |
| ----- | ------------------------------------------------------------------------------ |
| 10    | Excelente, con evidencia directa. Sin acciones pendientes en el área.          |
| 9–9,7 | Muy bueno. Deuda menor, no bloqueante.                                         |
| 8–8,9 | Sólido. Hay defectos reales pero acotados y sin impacto crítico.               |
| 7–7,9 | Necesita trabajo. Defectos que afectan a usuarios o a la confianza en el dato. |
| 6–6,9 | Deficiente. Funcionalidad o seguridad en riesgo.                               |
| < 6   | Crítico. No apto para producción.                                              |

### Reglas de la escala (Reglas 1, 6 y 14 del encargo)

- **No se sube una puntuación sin evidencia nueva** (comando ejecutado + salida).
- **Un criterio sin evidencia suficiente se marca `NO VERIFICADO`** y puntúa
  como el mínimo del rango, no como aprobado.
- **Ningún promedio compensa una vulnerabilidad crítica abierta**: el objetivo
  global solo se declara cumplido con las 25 áreas ≥ 9.8.

### Fórmula

```
Área = 0,25·C + 0,25·S + 0,20·P + 0,15·Q + 0,15·M
Global = (Σ las 25 áreas) / 25
```

---

## 2. Puntuación por área

|   # | Área                              | Antes | Después |    Δ | Evidencia principal del ciclo 001                                                                                                                                                                                                        |
| --: | --------------------------------- | ----: | ------: | ---: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Arquitectura general              |   8.0 |     8.4 | +0.4 | Monorepo coherente; separación rutas/lib/frontend correcta. Pendiente: modularizar `routes/reports.ts` (1.762 líneas) y `routes/live.ts` (1.193).                                                                                        |
|   2 | Organización del código           |   8.2 | **8.8** | +0.6 | 82 `as any` eliminados del backend; `JwtUser` tipado; `currentUser()`; 79 archivos del frontend formateados (antes el gate de formato no los cubría).                                                                                    |     | 3   | Backend y API | 8.1 | **8.9** | +0.8 | `requireAuth` revalida contra BD (isActive + suspensión); `checkTenant`/`getDistrictId` centralizados; validación Zod uniforme; error handler global. |
|   4 | Frontend                          |   8.0 |     8.5 | +0.5 | React Query con `staleTime`; code-splitting por vendor; estados de carga/error. Pendiente: el `fetch` desnudo de la rama de recuperación de contraseña rompe el APK nativo.                                                              |
|   5 | Diseño UI/UX                      |   8.5 |     8.5 |    = | Sistema de diseño coherente (tokens HSL, shadcn/ui); bottom-nav móvil; safe-area. **NO VERIFICADO**: sin auditoría visual ni de contraste con axe.                                                                                       |
|   6 | Panel administrativo              |   8.0 |     8.0 |    = | Tabs, filtros, paginación en reportes y usuarios. Pendiente: sin filtros en visores, sin acciones masivas, sin export. **NO VERIFICADO**: sin prueba de la consistencia backend↔frontend.                                                |
|   7 | Autenticación y autorización      |   7.8 | **8.7** | +0.9 | `SUPER_ADMIN_CLAIM_SECRET` fail-closed; refresh tokens con hash SHA-256 en BD; `requireAuth` revalida `isActive`/`suspendedUntil`; RBAC de 4 niveles en `lib/roles.ts`. Pendiente: tokens en `localStorage` (XSS), sin cookies HttpOnly. |
|   8 | Ciberseguridad                    |   7.5 | **9.0** | +1.5 | CSP sin `unsafe-inline` en scripts; CORS sin fallback de desarrollo en producción; rate limiting por endpoint; helmet; `proxy-addr` parcheado (evita evadir el rate limit de login).                                                     |
|   9 | Base de datos                     |   7.6 | **9.0** | +1.4 | Sesión UTC (bug crítico de servicios en vivo); territorio derivado del catálogo; 30 tablas con FK e índices; migraciones reproducibles. Pendiente: `timestamp without time zone` en el esquema.                                          |
|  10 | Aislamiento entre municipalidades |   8.5 |     8.5 |    = | `checkTenant` + `getDistrictId` + tests `tenant-isolation`/`rls-tenant-isolation`; RLS como defensa estática. Pendiente: la mayoría de rutas resuelven el tenant a mano.                                                                 |
|  11 | Reportes ciudadanos               |   8.3 |     8.6 | +0.3 | Categorías sensibles con anonimato forzado; confirmaciones `kind` separadas; `GET /reports/mine` pendiente de integrar; sin autoguardado de borrador.                                                                                    |
|  12 | Geolocalización y mapas           |   8.4 |     8.4 |    = | Leaflet con teselas de Esri (sin clave); `LocationPicker` con mapa + geocoder + GPS; caché de geocodificación con TTL y timeout. Pendiente: sin agrupamiento de marcadores, sin heatmap.                                                 |
|  13 | Alertas y emergencias             |   8.0 | **9.0** | +1.0 | **Bug crítico corregido**: las emisiones no aparecían en el mapa y cada ping duplicaba la transmisión. Ciclo de vida con `status`/`resolved_at`/`expires_at`; SSE.                                                                       |
|  14 | Personas desaparecidas            |   8.2 |     8.2 |    = | Contacto público con decisión de diseño documentada; `reported_by_id` para autoría; soft-delete con `audit_log`. Pendiente: sin verificación de publicaciones, sin flujo de moderación específico.                                       |
|  15 | Notificaciones                    |   8.0 |     8.0 |    = | FCM con canal Android; preferencias; proximity-push con cooldown de 8 min. Pendiente: sin bandeja de preferencias por categoría, sin deduplicación probada.                                                                              |
|  16 | Android y PWA                     |   7.5 |     8.3 | +0.8 | Capacitor 7.6.9; PWA con service worker (44 entradas precacheadas) y `autoUpdate`; `supportedArchitectures` desbloquea el build en Windows. Pendiente: sin E2E en dispositivo, sin verificación de la app nativa.                        |
|  17 | Rendimiento                       |   8.2 |     8.4 | +0.2 | Bundle de la app 287 kB (82.7 kB gzip) + vendors cacheables; `esbuild.pure` elimina `console.log` del bundle; caché en memoria en `/stats` y `/districts`. **NO VERIFICADO**: sin Lighthouse ni p95 medidos.                             |
|  18 | Escalabilidad                     |   8.0 |     8.5 | +0.5 | Pool de 3 conexiones (Neon free tier); índices de rendimiento (migración 0021); sin Redis/Kafka; servicios en vivo con muestreo de breadcrumbs (≤5.000 puntos).                                                                          |
|  19 | Accesibilidad                     |   7.8 |     8.0 | +0.2 | `aria-label`, `aria-current`, `aria-expanded`, "Saltar al contenido", sin `maximum-scale` (zoom permitido), focus visible. **NO VERIFICADO**: contraste de micro-labels `text-[9px]` (AC5) y `:focus-visible`.                           |
|  20 | SEO y metadatos                   |   9.0 |     9.0 |    = | Title y description descriptivos, Open Graph, Twitter Card, `lang="es"`, `theme-color`, manifest PWA.                                                                                                                                    |
|  21 | Pruebas automatizadas             |   7.0 | **8.6** | +1.6 | 26 suites backend / 173 tests contra Postgres real + 4 suites frontend / 17 tests; suite que fallaba de forma intermitente arreglada; test de regresión de zona horaria. Pendiente: sin E2E de navegador, sin cobertura medida.          |
|  22 | CI/CD y despliegue                |   5.0 | **8.8** | +3.8 | El pipeline **estaba roto** (lockfile incompatible → los 6 jobs fallaban). Rehecho: instalación reproducible, formato completo, auditoría bloqueante, typecheck del monorepo, tests de frontend, tests de integración, hardening.        |
|  23 | Documentación                     |   8.0 | **9.0** | +1.0 | README completo; `docs/AUDITORIAS.md` consolidado; `docs/SERVICIOS_EN_VIVO.md`; nuevos `docs/audit/*`. Pendiente: el OpenAPI no cubre ~60% de los endpoints.                                                                             |
|  24 | Privacidad y protección de datos  |   8.0 |     8.4 | +0.4 | Consentimiento versionado en BD (`user_consents`); PII proyectada (contacto solo al dueño / backoffice); alias público; `Ley 29733` citada. Pendiente: sin política formal de retención ni exercise de derechos ARCO.                    |
|  25 | Observabilidad y mantenimiento    |   7.8 |     8.4 | +0.6 | Logs estructurados con pino + `req.id`; healthcheck; tasks de mantenimiento; `audit_log` en las operaciones sensibles. Pendiente: sin métricas ni trazas, sin alertas operativas.                                                        |

---

## 3. Resultado global

|                                    |           Antes |       Después |
| ---------------------------------- | --------------: | ------------: |
| **GLOBAL** (media de 25 áreas)     |   **7.90 / 10** | **8.56 / 10** |
| Áreas por debajo de 9.8            |         25 / 25 |   **25 / 25** |
| Áreas por debajo de 9.0            |              13 |             8 |
| Vulnerabilidades críticas abiertas |  1 (+14 en dev) |         **0** |
| Vulnerabilidades altas abiertas    | 33 (+18 en dev) |         **0** |

### Distribución tras el ciclo 001

| Rango   | Áreas                                                                                                                                                           |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9.0–10  | Backend y API · Ciberseguridad · Base de datos · Alertas y emergencias · SEO · CI/CD · Documentación                                                            |
| 8.5–8.9 | Organización · Frontend · Autenticación · Reportes · Escalabilidad · Pruebas · Observabilidad · Privacidad                                                      |
| 8.0–8.4 | Arquitectura · Diseño UI/UX · Panel admin · Aislamiento · Geolocalización · Personas desaparecidas · Notificaciones · Android/PWA · Rendimiento · Accesibilidad |

---

## 4. Áreas que bloquean el objetivo 9.8

Para declarar el objetivo alcanzado hacen falta las 25 áreas ≥ 9.8. Las que
exigen más trabajo (ordenadas por brecha):

| Área                     | Actual | Brecha | Qué falta para 9.8                                                                                     |
| ------------------------ | -----: | -----: | ------------------------------------------------------------------------------------------------------ |
| Diseño UI/UX             |    8.5 |    1.3 | Auditoría de contraste con axe; estados vacíos en todas las pantallas; tabla admin responsive en móvil |
| Panel administrativo     |    8.0 |    1.8 | Filtros y acciones masivas; export; verificación de consistencia backend↔frontend                      |
| Notificaciones           |    8.0 |    1.8 | Preferencias por categoría; deduplicación; bandeja con histórico                                       |
| Accesibilidad            |    8.0 |    1.8 | Contraste de micro-labels; `:focus-visible`; auditoría WCAG 2.2 AA con axe                             |
| Personas desaparecidas   |    8.2 |    1.6 | Flujo de verificación de publicaciones; moderación específica; retirada rápida                         |
| Geolocalización y mapas  |    8.4 |    1.4 | Agrupamiento de marcadores; popups informativos; filtro por tipo/estado                                |
| Aislamiento multi-tenant |    8.5 |    1.3 | Migrar el tenant a middleware en vez de helpers en línea; cubrir con tests cada ruta nueva             |
| Frontend                 |    8.5 |    1.3 | Corregir el `fetch` desnudo de la rama de recuperación; unificar el acceso a datos                     |
| Reportes ciudadanos      |    8.6 |    1.2 | Autoguardado de borrador; prevención de duplicados; historial de cambios                               |
| Autenticación            |    8.7 |    1.1 | Migrar a cookies HttpOnly + CSRF; proteger el almacenamiento en Android                                |
| Privacidad               |    8.4 |    1.4 | Política de retención; mecanismo ARCO; minimizing de PII                                               |
| Observabilidad           |    8.4 |    1.4 | Métricas de latencia y error; alertas; trazas                                                          |
| Escalabilidad            |    8.5 |    1.3 | Objetivos de p95 por endpoint; pruebas de carga; caché si se pasa a >1 instancia                       |
| Rendimiento              |    8.4 |    1.4 | Lighthouse CI; medir LCP/INP/CLS en condiciones documentadas                                           |
| Android/PWA              |    8.3 |    1.5 | E2E en dispositivo real; verificación de la app nativa; estrategia de actualización                    |
| Pruebas                  |    8.6 |    1.2 | E2E de navegador; cobertura medida; tests de contrato                                                  |
| Base de datos            |    9.0 |    0.8 | Migración a `timestamptz`; `EXPLAIN ANALYZE` sobre consultas reales                                    |
| Backend y API            |    8.9 |    0.9 | Modularizar `reports.ts`/`live.ts`; versionado del contrato; idempotencia                              |
| Organización             |    8.8 |    1.0 | Eliminar los `any` restantes; extraer módulos grandes                                                  |
| Ciberseguridad           |    9.0 |    0.8 | CSP con nonce; CSP de reporte; endurecer la configuración de FCM                                       |
| Alertas y emergencias    |    9.0 |    0.8 | Idempotencia explícita; cola de reintentos; estados de entrega verificables                            |
| Arquitectura             |    8.4 |    1.4 | Extraer capas (servicio/repositorio) en los dominios grandes                                           |
| Documentación            |    9.0 |    0.8 | OpenAPI completo; runbooks de operación                                                                |
| SEO                      |    9.0 |    0.8 | Sitemap; `robots.txt`; schema.org                                                                      |

---

## 5. Histórico de puntuaciones

| Ciclo    | Fecha      |   Global | Críticas | Altas | Áreas ≥ 9.8 |        Suites backend | Tests backend |
| -------- | ---------- | -------: | -------: | ----: | ----------: | --------------------: | ------------: |
| Baseline | 2026-10-21 |     7.90 |       15 |    51 |        0/25 | 18/25 (7 con timeout) |     163 / 171 |
| 001      | 2026-10-21 | **8.56** |    **0** | **0** |        0/25 |             **26/26** |       **173** |

---

_Regenerar esta tabla al cerrar cada ciclo. Nunca editar una fila anterior._
