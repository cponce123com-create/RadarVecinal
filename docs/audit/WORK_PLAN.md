# Plan de trabajo — Auditoría continua

> Hoja de ruta derivada de `QUALITY_SCORECARD.md` y `RISK_REGISTER.md`.
> Los ciclos se ejecutan en orden: primero lo que puede romper producción.

---

## Principios de priorización

1. **Seguridad antes que funcionalidad** — una vulnerabilidad crítica abierta
   bloquea el objetivo global, por mucho que suba el promedio.
2. **Integridad de datos antes que features** — un dato corrupto (territorio,
   fechas) destruye la confianza en la plataforma.
3. **Infraestructura antes que producto** — si el CI está roto, ninguna otra
   mejora se sostiene.
4. **Evidencia antes que afirmación** — ninguna corrección se da por buena sin
   comando ejecutado y salida registrada.
5. **Reversibilidad** — toda corrección debe poder revertirse sin dejar el
   proyecto inconsistente.

---

## Ciclo 001 — Cerrado (2026-10-21)

**Objetivo técnico:** restaurar la capacidad de verificar el proyecto (instalación
reproducible, CI real, suite fiable) y eliminar los defectos que corrompen datos
o rompen funciones en condiciones no triviales.

**Resultado:** global 7.90 → **8.56** · 15 críticas → **0** · 51 altas → **0**
· CI rota → funcional · 7 suites intermitentes → 26/26 en verde.

Detalle en `ITERATION-001.md`.

---

## Ciclo 002 — Cerrado (2026-10-21)

**Objetivo técnico:** que la funcionalidad pendiente sea segura en el APK
nativo, que el contrato de API cubra lo que realmente se consume y que el
esquema de fechas deje de depender de una convención invisible.

**Resultado:** global 8.56 → **8.67** · críticas abiertas **0** · CI 8 → **9
jobs, 9/9 en verde** · suite 26/173 → **28/180**.

| #    | Tarea                                                                                             | Estado |
| ---- | ------------------------------------------------------------------------------------------------- | ------ |
| 2.1  | Rebase de `531dac12` sobre la rama del ciclo 001                                                  | ✅     |
| 2.2  | `customFetch` en `PasswordRecovery`, `ResetPassword` y `MyReports`                                | ✅     |
| 2.3  | Test de `window.Capacitor` + URL base + token                                                     | ✅     |
| 2.4  | Los 3 endpoints en OpenAPI + cliente regenerado (zod v3, react-query v5, `dom.iterable`)          | ✅     |
| 2.5  | `timestamp without time zone` → `timestamptz` (51 columnas, idempotente, revert, prueba de epoch) | ✅     |
| 2.6  | Rate limit por IP **y** por correo en `forgot-password`                                           | ✅     |
| 2.7  | `GET /reports/mine` con `currentUser` y aislamiento probado                                       | ✅     |
| 2.8  | Token de reset separado del de sesión (`purpose: "access"`)                                       | ✅     |
| 2.9  | Migración `0035_user_consents.sql` (tabla que solo existía en el esquema)                         | ✅     |
| 2.10 | Migración `0036_not_null_alignment.sql` (5 columnas)                                              | ✅     |
| 2.11 | Restaurar `brand_name`/`logo_url`/`primary_color` en el esquema (cobranding estaba muerto)        | ✅     |
| 2.12 | `run_all_migrations.js`: fail-fast por SQLSTATE + resumen                                         | ✅     |
| 2.13 | Job de CI «Migraciones desde cero» + idempotencia + aserciones                                    | ✅     |
| 2.14 | Preflight del journal de Drizzle + `tsx` declarado                                                | ✅     |
| 2.15 | CI verifica PRs apilados; `render-build.sh` con `--frozen-lockfile`                               | ✅     |

**Criterio de cierre:** cumplido salvo el E2E, que no estaba en el alcance del
ciclo y sigue en R-09.

Detalle en `ITERATION-002.md`.

---

## Ciclo 003 — Enfoque: cerrar las altas y empezar a medir

**Objetivo técnico:** eliminar los tres riesgos altos que quedan
(R-05, R-06, R-19) y sustituir «no verificado» por números en pruebas,
rendimiento y accesibilidad.

| #    | Tarea                                                                                                                                                                                 | Riesgo que cierra | Sev | Esfuerzo |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --- | -------- |
| 3.1  | Declarar los 32 índices en el esquema Drizzle (`index()`/`uniqueIndex()` con los nombres de las migraciones) y comprobar que `push` sobre una base migrada dice `No changes detected` | R-19              | 🟠  | Alto     |
| 3.2  | Si 3.1 no es viable: guardia que impida `push` sobre una base con tablas                                                                                                              | R-19              | 🟠  | Bajo     |
| 3.3  | Middleware de aislamiento por defecto (`tenantScope`) aplicado al router                                                                                                              | R-06              | 🟠  | Alto     |
| 3.4  | Test que recorra todas las rutas registradas y verifique que ninguna cruza distritos                                                                                                  | R-06              | 🟠  | Medio    |
| 3.5  | Medir el tiempo de `0034` con un volumen representativo; lotes con `lock_timeout` si excede lo aceptable                                                                              | R-18              | 🟡  | Medio    |
| 3.6  | `@vitest/coverage-v8`, cobertura medida y umbral mínimo en CI                                                                                                                         | —                 | 🟡  | Medio    |
| 3.7  | Playwright: registro → login → reporte con foto → recepción admin → cambio de estado → logout                                                                                         | R-09              | 🟡  | Alto     |
| 3.8  | Playwright del recorrido de recuperación (el token de reset no debe abrir sesión)                                                                                                     | R-09              | 🟡  | Medio    |
| 3.9  | Overrides de `qs`, `uuid` y `protobufjs` con verificación completa (tests + ambos builds)                                                                                             | R-14              | 🔵  | Medio    |
| 3.10 | `/api-docs` solo fuera de producción o tras autenticación de backoffice                                                                                                               | R-17              | 🟡  | Bajo     |

---

## Ciclo 004 — Enfoque: sesión en cookies, diseño, accesibilidad y panel

**Objetivo técnico:** cerrar la última alta de seguridad (R-05) y las brechas de
UX con evidencia objetiva en lugar de con percepciones.

| #   | Tarea                                                                 | Área            | Sev | Esfuerzo |
| --- | --------------------------------------------------------------------- | --------------- | --- | -------- |
| 4.1 | Migración a cookies `HttpOnly` + `SameSite` + CSRF (web y Capacitor)  | Autenticación   | 🟠  | Alto     |
| 4.2 | axe/Lighthouse como gate de CI                                        | Accesibilidad   | 🟡  | Medio    |
| 4.3 | Contraste de los micro-labels `text-[9px]`/`text-[10px]` (WCAG 1.4.3) | Accesibilidad   | 🟡  | Bajo     |
| 4.4 | `:focus-visible` con contraste suficiente (UX-AC7)                    | Accesibilidad   | 🟡  | Bajo     |
| 4.5 | Empty states con CTA en todas las pantallas sin datos                 | Diseño UI/UX    | 🟡  | Medio    |
| 4.6 | Tablas del panel responsive en < 360 px                               | Panel admin     | 🟡  | Medio    |
| 4.7 | Filtros y acciones masivas seguras en el panel                        | Panel admin     | 🟡  | Alto     |
| 4.8 | Filtros por tipo/estado y popups informativos en el mapa              | Geolocalización | 🟡  | Medio    |
| 4.9 | Preferencias de notificación por categoría y deduplicación            | Notificaciones  | 🟡  | Medio    |

---

## Ciclo 005 — Enfoque: arquitectura, privacidad y operación

**Objetivo técnico:** bajar la deuda estructural y cubrir el marco legal de
protección de datos con mecanismos, no con notas.

| #   | Tarea                                                                                    | Área                   | Sev | Esfuerzo |
| --- | ---------------------------------------------------------------------------------------- | ---------------------- | --- | -------- |
| 5.1 | Modularizar `routes/reports.ts` (1.762 líneas) y `routes/live.ts` (1.193) por subdominio | Backend                | 🟡  | Alto     |
| 5.2 | Política formal de retención y mecanismo de ejercicio de derechos (ARCO)                 | Privacidad             | 🟠  | Alto     |
| 5.3 | Minimización de PII: qué datos se conservan y por qué                                    | Privacidad             | 🟡  | Medio    |
| 5.4 | Métricas de latencia y error + alertas operativas                                        | Observabilidad         | 🟡  | Medio    |
| 5.5 | Objetivos de p95 por endpoint + pruebas de carga                                         | Escalabilidad          | 🟡  | Medio    |
| 5.6 | Idempotencia explícita y estados de entrega verificables en las alertas                  | Alertas                | 🟠  | Medio    |
| 5.7 | Flujo de verificación y moderación de personas desaparecidas                             | Personas desaparecidas | 🟠  | Alto     |
| 5.8 | Sitemap, `robots.txt` y schema.org                                                       | SEO                    | 🟡  | Bajo     |
| 5.9 | Regenerar el journal de Drizzle o retirar el runner duplicado                            | Base de datos          | 🔵  | Medio    |

---

## Criterios de cierre del objetivo global

El objetivo (≥ 9.8 en las 25 áreas) **solo** puede declararse cumplido si se
cumplen las 14 condiciones del encargo, entre ellas:

- [ ] Las 25 áreas ≥ 9.8 según la rúbrica de `QUALITY_SCORECARD.md`.
- [ ] 0 vulnerabilidades críticas y 0 altas abiertas (producción y total).
- [x] Los 2 riesgos críticos abiertos (R-03, R-04) cerrados (ciclo 002).
- [ ] 0 riesgos **altos** abiertos (hoy: R-05, R-06, R-19).
- [ ] Compilación, typecheck, lint, formato y tests en verde.
- [ ] Aislamiento multi-tenant comprobado con un test que recorra todas las rutas.
- [x] Migraciones verificadas desde cero (job `migrations` del CI). El revert de
      `0034` existe pero no se ha ejecutado en un ensayo.
- [ ] E2E del recorrido ciudadano y del administrativo en verde.
- [ ] Métricas de rendimiento medidas en condiciones documentadas.
- [ ] Evidencia suficiente para sustentar cada puntuación.

Si alguna de estas condiciones no se cumple, **no se declara el objetivo
alcanzado**: se documenta el bloqueo y se continúa con el siguiente ciclo.

---

## Ritmo de trabajo

| Momento          | Acción                                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inicio de ciclo  | Leer `CONTINUATION.md` y `RISK_REGISTER.md`; verificar el estado de Git                                                                                        |
| Durante          | Un commit por corrección, con su test; sin mezclar formatos y cambios funcionales                                                                              |
| Fin de ciclo     | `pnpm run typecheck` + suite completa + build + audit + prettier; actualizar `ITERATION-NNN.md`, `QUALITY_SCORECARD.md`, `RISK_REGISTER.md`, `CONTINUATION.md` |
| Antes de push/PR | Verificar que no hay secretos ni archivos `.env` en el staging                                                                                                 |

---

_Plan vivo: se actualiza al cerrar cada ciclo._
