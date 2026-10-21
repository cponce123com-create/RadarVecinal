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

## Ciclo 002 — Enfoque: contrato, cliente nativo y esquema de fechas

**Objetivo técnico:** que la funcionalidad pendiente sea segura en el APK
nativo, que el contrato de API cubra lo que realmente se consume y que el
esquema de fechas deje de depender de una convención invisible.

| #   | Tarea                                                                                                                              | Riesgo que cierra | Sev | Esfuerzo |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --- | -------- |
| 2.1 | Rebase de `531dac12` sobre `main` en rama nueva                                                                                    | R-04              | 🔴  | Bajo     |
| 2.2 | Sustituir el `fetch` desnudo por `customFetch` en `PasswordRecovery`, `ResetPassword` y `MyReports`                                | R-03              | 🔴  | Bajo     |
| 2.3 | Test que simule `window.Capacitor` definido y compruebe que la URL base se aplica                                                  | R-03              | 🟠  | Medio    |
| 2.4 | Añadir `/reports/mine`, `/auth/forgot-password`, `/auth/reset-password` al OpenAPI y regenerar (verificar antes el salto de orval) | R-07              | 🟡  | Medio    |
| 2.5 | Migración `timestamp without time zone` → `with time zone` (script reversible + verificación con `EXPLAIN`)                        | R-01, R-02        | 🟠  | Alto     |
| 2.6 | Rate limit específico para `POST /auth/forgot-password` (email bombing)                                                            | —                 | 🟡  | Bajo     |
| 2.7 | `GET /reports/mine` con `currentUser` + verificación de que no filtra PII de otros autores                                         | —                 | 🟡  | Bajo     |

**Criterio de cierre del ciclo:** 0 vulnerabilidades críticas abiertas, suite
26/26 + E2E verde, typecheck y formato verdes, `pnpm audit --prod` sin altas.

---

## Ciclo 003 — Enfoque: aislamiento por defecto y E2E

**Objetivo técnico:** que el aislamiento multi-tenant deje de depender de que
cada ruta recuerde filtrar, y que exista un recorrido ciudadano de extremo a
extremo verificado en navegador real.

| #   | Tarea                                                                                                 | Riesgo que cierra | Sev | Esfuerzo |
| --- | ----------------------------------------------------------------------------------------------------- | ----------------- | --- | -------- |
| 3.1 | Middleware de aislamiento por defecto (`tenantScope`) aplicado al router                              | R-06              | 🟠  | Alto     |
| 3.2 | Test que recorra todas las rutas registradas y verifique que ninguna cruza distritos                  | R-06              | 🟠  | Medio    |
| 3.3 | Playwright: registro → login → reporte con foto → recepción admin → cambio de estado → logout         | R-09              | 🟡  | Alto     |
| 3.4 | Test E2E del APK simulado (`window.Capacitor`)                                                        | R-09              | 🟡  | Medio    |
| 3.5 | Revisión de las rutas con `as any` restantes y del `requireSuperAdmin` duplicado en `routes/admin.ts` | —                 | 🔵  | Bajo     |

---

## Ciclo 004 — Enfoque: diseño, accesibilidad y panel administrativo

**Objetivo técnico:** cerrar las brechas de UX con evidencia objetiva en lugar
de con percepciones.

| #   | Tarea                                                                 | Área            | Sev | Esfuerzo |
| --- | --------------------------------------------------------------------- | --------------- | --- | -------- |
| 4.1 | axe/Lighthouse como gate de CI                                        | Accesibilidad   | 🟡  | Medio    |
| 4.2 | Contraste de los micro-labels `text-[9px]`/`text-[10px]` (WCAG 1.4.3) | Accesibilidad   | 🟡  | Bajo     |
| 4.3 | `:focus-visible` con contraste suficiente (UX-AC7)                    | Accesibilidad   | 🟡  | Bajo     |
| 4.4 | Empty states con CTA en todas las pantallas sin datos                 | Diseño UI/UX    | 🟡  | Medio    |
| 4.5 | Tablas del panel responsive en < 360 px                               | Panel admin     | 🟡  | Medio    |
| 4.6 | Filtros y acciones masivas seguras en el panel                        | Panel admin     | 🟡  | Alto     |
| 4.7 | Filtros por tipo/estado y popups informativos en el mapa              | Geolocalización | 🟡  | Medio    |
| 4.8 | Preferencias de notificación por categoría y deduplicación            | Notificaciones  | 🟡  | Medio    |

---

## Ciclo 005 — Enfoque: arquitectura, privacidad y operación

**Objetivo técnico:** bajar la deuda estructural y cubrir el marco legal de
protección de datos con mecanismos, no con notas.

| #   | Tarea                                                                                    | Área                   | Sev | Esfuerzo |
| --- | ---------------------------------------------------------------------------------------- | ---------------------- | --- | -------- |
| 5.1 | Modularizar `routes/reports.ts` (1.762 líneas) y `routes/live.ts` (1.193) por subdominio | Backend                | 🟡  | Alto     |
| 5.2 | Migración a cookies `HttpOnly` + `SameSite` + CSRF para web                              | Autenticación          | 🟠  | Alto     |
| 5.3 | Política formal de retención y mecanismo de ejercicio de derechos (ARCO)                 | Privacidad             | 🟠  | Alto     |
| 5.4 | Minimización de PII: qué datos se conservan y por qué                                    | Privacidad             | 🟡  | Medio    |
| 5.5 | Métricas de latencia y error + alertas operativas                                        | Observabilidad         | 🟡  | Medio    |
| 5.6 | Objetivos de p95 por endpoint + pruebas de carga                                         | Escalabilidad          | 🟡  | Medio    |
| 5.7 | Idempotencia explícita y estados de entrega verificables en las alertas                  | Alertas                | 🟠  | Medio    |
| 5.8 | Flujo de verificación y moderación de personas desaparecidas                             | Personas desaparecidas | 🟠  | Alto     |
| 5.9 | Montar `/api-docs` solo en desarrollo o tras autenticación                               | Ciberseguridad         | 🟡  | Bajo     |

---

## Criterios de cierre del objetivo global

El objetivo (≥ 9.8 en las 25 áreas) **solo** puede declararse cumplido si se
cumplen las 14 condiciones del encargo, entre ellas:

- [ ] Las 25 áreas ≥ 9.8 según la rúbrica de `QUALITY_SCORECARD.md`.
- [ ] 0 vulnerabilidades críticas y 0 altas abiertas (producción y total).
- [ ] Los 2 riesgos críticos abiertos (R-03, R-04) cerrados.
- [ ] Compilación, typecheck, lint, formato y tests en verde.
- [ ] Aislamiento multi-tenant comprobado con un test que recorra todas las rutas.
- [ ] Migraciones verificadas (aplicadas desde cero y reversibles).
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
