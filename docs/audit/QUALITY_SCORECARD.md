# Scorecard de calidad — Radar Vecinal

> Metodología, pesos y puntuaciones de las 25 áreas de la auditoría continua.
> **Ciclo 002** · 2026-10-21 · Base `main@cf366234` · Rama `feature/audit-cycle-002` (apilada sobre `feature/audit-cycle-001`)

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

|   # | Área                              | Ciclo 001 | Ciclo 002 |    Δ | Evidencia del ciclo 002                                                                                                                                                                                                                                                                                       |
| --: | --------------------------------- | --------: | --------: | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Arquitectura general              |       8.4 |       8.5 | +0.1 | La cadena de migraciones pasa a ser el camino de despliegue **verificado**: job de CI que la aplica desde cero y comprueba el esquema resultante. Pendiente: `routes/reports.ts` (1.762 líneas) y `routes/live.ts` (1.193).                                                                                   |
|   2 | Organización del código           |       8.8 |       8.9 | +0.1 | `as any` eliminados en `useBranding` y `/reports/mine`; `DistrictInfo` y el payload del token de reset tipados; `ApiError`/`ResponseParseError` exportados para distinguir error HTTP de fallo de red. Pendiente: archivos de rutas enormes.                                                                  |
|   3 | Backend y API                     |       8.9 |       9.0 | +0.1 | Tres endpoints nuevos con validación Zod, rate limit y contrato OpenAPI; `/reports/mine` usa `currentUser()` y valida el `sub`. Pendiente: versionado del contrato y modularización.                                                                                                                          |
|   4 | Frontend                          |       8.5 |       8.8 | +0.3 | `customFetch` en recuperar/restablecer/mis reportes; los fallos de red y el 429 ya se muestran (antes: "Revisa tu correo" con la petición perdida); el cobranding por distrito vuelve a funcionar (columnas restauradas); test de Capacitor.                                                                  |
|   5 | Diseño UI/UX                      |       8.5 |       8.5 |    = | Sin cambios visuales. **NO VERIFICADO**: sigue sin auditoría de contraste con axe ni revisión visual.                                                                                                                                                                                                         |
|   6 | Panel administrativo              |       8.0 |       8.0 |    = | Sin cambios. **NO VERIFICADO**: sin prueba de consistencia backend↔frontend ni auditoría de la tabla en móvil.                                                                                                                                                                                                |
|   7 | Autenticación y autorización      |       8.7 |       9.2 | +0.5 | Token de recuperación separado del de sesión (`purpose: "access"`): el enlace del correo ya no sirve como credencial. Límite doble en `forgot-password` (10/15 min por IP, 3/hora por correo). Envío sin esperar (sin oráculo de tiempo). URL de reset nunca en logs de producción. Single-use atado al hash. |
|   8 | Ciberseguridad                    |       9.0 |       9.1 | +0.1 | Cerrados: uso del token de reset como sesión, fuga del enlace en logs y amplificación de correos con enumeración por tiempo. Pendiente: 4 avisos moderados (R-14), CSP con nonce, `/api-docs` público (R-17).                                                                                                 |
|   9 | Base de datos                     |       9.0 |       9.4 | +0.4 | 51 columnas `timestamptz` con prueba de epoch; migración idempotente + revert; `user_consents` y 5 `NOT NULL` alineados; la cadena desde cero reproduce el esquema (29 tablas / 51 timestamptz) y se verifica en CI; el runner falla de verdad. **Pendiente**: R-19 y R-20, `EXPLAIN` sobre datos reales.     |
|  10 | Aislamiento entre municipalidades |       8.5 |       8.5 |    = | Sin cambios estructurales; se añade cobertura de aislamiento de `/reports/mine`. Pendiente: middleware obligatorio en vez de disciplina por ruta (R-06).                                                                                                                                                      |
|  11 | Reportes ciudadanos               |       8.6 |       8.8 | +0.2 | `GET /reports/mine` está en el contrato OpenAPI, lo consume `MyReports` y su aislamiento está probado. Pendiente: autoguardado de borrador y prevención de duplicados.                                                                                                                                        |
|  12 | Geolocalización y mapas           |       8.4 |       8.4 |    = | Sin cambios. Pendiente: agrupamiento de marcadores, heatmap y filtros.                                                                                                                                                                                                                                        |
|  13 | Alertas y emergencias             |       9.0 |       9.0 |    = | La causa raíz del bug de emisiones queda cerrada en el esquema (`timestamptz`), sin cambios funcionales nuevos. Pendiente: idempotencia explícita y cola de reintentos.                                                                                                                                       |
|  14 | Personas desaparecidas            |       8.2 |       8.2 |    = | Sin cambios. Pendiente: verificación de publicaciones y flujo de moderación específico.                                                                                                                                                                                                                       |
|  15 | Notificaciones                    |       8.0 |       8.0 |    = | Sin cambios. Pendiente: preferencias por categoría, deduplicación y bandeja histórica.                                                                                                                                                                                                                        |
|  16 | Android y PWA                     |       8.3 |       8.4 | +0.1 | Test de URL base y token con `window.Capacitor` definido (4 casos); las pantallas nuevas ya no rompen dentro del APK. Pendiente: E2E en dispositivo real (R-09).                                                                                                                                              |
|  17 | Rendimiento                       |       8.4 |       8.4 |    = | Sin medición nueva. **NO VERIFICADO**: sin Lighthouse ni p95. Nota: R-19 (32 índices que `push` borraría) afecta a esta área si se ejecuta `push` contra una base real.                                                                                                                                       |
|  18 | Escalabilidad                     |       8.5 |       8.5 |    = | Sin cambios. Pendiente: objetivos de p95 por endpoint y pruebas de carga.                                                                                                                                                                                                                                     |
|  19 | Accesibilidad                     |       8.0 |       8.0 |    = | Sin cambios. **NO VERIFICADO**: contraste de micro-labels y `:focus-visible` siguen sin auditoría WCAG.                                                                                                                                                                                                       |
|  20 | SEO y metadatos                   |       9.0 |       9.0 |    = | Sin cambios. Pendiente: sitemap, `robots.txt` y schema.org.                                                                                                                                                                                                                                                   |
|  21 | Pruebas automatizadas             |       8.6 |       8.8 | +0.2 | 28 suites / 180 tests backend (antes 26/173) y 5 suites / 21 tests frontend (antes 4/17). Nuevos: aislamiento de `/reports/mine`, token de reset que no sirve como sesión, rate limit 429, Capacitor y regresión de cobranding. Pendiente: E2E y cobertura medida.                                            |
|  22 | CI/CD y despliegue                |       8.8 |       9.2 | +0.4 | 9 jobs. Nuevo job de migraciones desde cero + idempotencia + aserciones de esquema. Los PR apilados ya se verifican. El build de producción usa `--frozen-lockfile`. Una migración rota aborta el despliegue (exit 1). Pendiente: staging/CD, smoke tests post-deploy y rollback automatizado.                |
|  23 | Documentación                     |       9.0 |       9.1 | +0.1 | OpenAPI con recuperación de contraseña y "mis reportes"; cliente regenerado; `docs/audit/*` al día con evidencia. Pendiente: ~55 % de endpoints fuera del contrato y runbooks de operación.                                                                                                                   |
|  24 | Privacidad y protección de datos  |       8.4 |       8.6 | +0.2 | `user_consents` la crea una migración: en una base nueva el registro ya puede guardar el consentimiento (antes fallaba). El enlace de reset no se escribe en logs de producción. `/reports/mine` solo devuelve datos propios. Pendiente: retención y derechos ARCO.                                           |
|  25 | Observabilidad y mantenimiento    |       8.4 |       8.5 | +0.1 | El runner de migraciones deja de tragarse errores: resumen, código de salida 1 y clasificación por SQLSTATE (independiente del idioma del servidor). Job de CI dedicado. Pendiente: métricas, trazas y alertas operativas.                                                                                    |

---

## 3. Resultado global

|                                    |     Ciclo 001 |     Ciclo 002 |
| ---------------------------------- | ------------: | ------------: |
| **GLOBAL** (media de 25 áreas)     | **8.56 / 10** | **8.67 / 10** |
| Áreas por debajo de 9.8            |       25 / 25 |       25 / 25 |
| Áreas por debajo de 9.0            |            20 |            17 |
| Vulnerabilidades críticas abiertas |             0 |         **0** |
| Vulnerabilidades altas abiertas    |             0 |         **0** |

> Corrección respecto al ciclo 001: la tabla anterior decía «8 áreas por debajo
> de 9.0» y «7 áreas en 9.0–10», pero las puntuaciones de esa misma tabla daban
> 20 y 5. Recalculado desde los valores, no desde el texto.

### Distribución tras el ciclo 002

| Rango   | Áreas                                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 9.0–10  | Backend y API · Autenticación · Ciberseguridad · Base de datos · Alertas · SEO · CI/CD · Documentación (8)                                  |
| 8.5–8.9 | Arquitectura · Organización · Frontend · Diseño UI/UX · Aislamiento · Reportes · Escalabilidad · Pruebas · Privacidad · Observabilidad (10) |
| 8.0–8.4 | Panel admin · Geolocalización · Personas desaparecidas · Notificaciones · Android/PWA · Rendimiento · Accesibilidad (7)                     |

---

## 4. Áreas que bloquean el objetivo 9.8

Para declarar el objetivo alcanzado hacen falta las 25 áreas ≥ 9.8. Ordenadas
por brecha:

| Área                     | Ciclo 002 | Brecha | Qué falta para 9.8                                                                                     |
| ------------------------ | --------: | -----: | ------------------------------------------------------------------------------------------------------ |
| Panel administrativo     |       8.0 |    1.8 | Filtros y acciones masivas; export; verificación de consistencia backend↔frontend                      |
| Notificaciones           |       8.0 |    1.8 | Preferencias por categoría; deduplicación; bandeja con histórico                                       |
| Accesibilidad            |       8.0 |    1.8 | Contraste de micro-labels; `:focus-visible`; auditoría WCAG 2.2 AA con axe                             |
| Personas desaparecidas   |       8.2 |    1.6 | Flujo de verificación de publicaciones; moderación específica; retirada rápida                         |
| Geolocalización y mapas  |       8.4 |    1.4 | Agrupamiento de marcadores; popups informativos; filtro por tipo/estado                                |
| Android/PWA              |       8.4 |    1.4 | E2E en dispositivo real; verificación de la app nativa; estrategia de actualización                    |
| Rendimiento              |       8.4 |    1.4 | Lighthouse CI; medir LCP/INP/CLS en condiciones documentadas                                           |
| Arquitectura             |       8.5 |    1.3 | Extraer capas (servicio/repositorio) en los dominios grandes                                           |
| Diseño UI/UX             |       8.5 |    1.3 | Auditoría de contraste con axe; estados vacíos en todas las pantallas; tabla admin responsive en móvil |
| Aislamiento multi-tenant |       8.5 |    1.3 | Migrar el tenant a middleware en vez de helpers en línea; cubrir con tests cada ruta nueva             |
| Escalabilidad            |       8.5 |    1.3 | Objetivos de p95 por endpoint; pruebas de carga; caché si se pasa a >1 instancia                       |
| Observabilidad           |       8.5 |    1.3 | Métricas de latencia y error; alertas; trazas                                                          |
| Privacidad               |       8.6 |    1.2 | Política de retención; mecanismo ARCO; minimizing de PII                                               |
| Frontend                 |       8.8 |    1.0 | E2E de las pantallas críticas; unificar el acceso a datos; migrar a cookies HttpOnly                   |
| Reportes ciudadanos      |       8.8 |    1.0 | Autoguardado de borrador; prevención de duplicados; historial de cambios                               |
| Pruebas                  |       8.8 |    1.0 | E2E de navegador; cobertura medida; tests de contrato                                                  |
| Organización             |       8.9 |    0.9 | Eliminar los `any` restantes; extraer módulos grandes                                                  |
| Backend y API            |       9.0 |    0.8 | Modularizar `reports.ts`/`live.ts`; versionado del contrato; idempotencia                              |
| Alertas y emergencias    |       9.0 |    0.8 | Idempotencia explícita; cola de reintentos; estados de entrega verificables                            |
| SEO                      |       9.0 |    0.8 | Sitemap; `robots.txt`; schema.org                                                                      |
| Ciberseguridad           |       9.1 |    0.7 | CSP con nonce; CSP de reporte; cerrar R-14 y R-17                                                      |
| Documentación            |       9.1 |    0.7 | OpenAPI completo; runbooks de operación                                                                |
| Autenticación            |       9.2 |    0.6 | Migrar a cookies HttpOnly + CSRF; proteger el almacenamiento en Android (R-05)                         |
| CI/CD                    |       9.2 |    0.6 | Staging con despliegue automático; smoke tests post-deploy; rollback verificado                        |
| Base de datos            |       9.4 |    0.4 | Declarar los 32 índices en el esquema (R-19); journal completo (R-20); `EXPLAIN` sobre datos reales    |

---

## 5. Histórico de puntuaciones

| Ciclo    | Fecha      |   Global | Críticas | Altas | Áreas ≥ 9.8 |        Suites backend | Tests backend |
| -------- | ---------- | -------: | -------: | ----: | ----------: | --------------------: | ------------: |
| Baseline | 2026-10-21 |     7.90 |       15 |    51 |        0/25 | 18/25 (7 con timeout) |     163 / 171 |
| 001      | 2026-10-21 |     8.56 |        0 |     0 |        0/25 |                 26/26 |           173 |
| 002      | 2026-10-21 | **8.67** |    **0** | **0** |        0/25 |             **28/28** |       **180** |

---

_Regenerar esta tabla al cerrar cada ciclo. Nunca editar una fila anterior._
