# Registro de riesgos — Radar Vecinal

> Riesgos vivos del proyecto, con severidad, evidencia y mitigación.
> Actualizado al cierre del ciclo 001 (2026-10-21).

Severidad: 🔴 Crítica · 🟠 Alta · 🟡 Media · 🔵 Baja.
**Estado:** `ABIERTO` · `MITIGADO` · `CERRADO` · `ACEPTADO` (con justificación)

---

## R-01 · Zona horaria de la base de datos

|               |                                                           |
| ------------- | --------------------------------------------------------- |
| **Severidad** | 🔴 Crítica                                                |
| **Estado**    | 🟡 MITIGADO (el esquema de fondo sigue siendo ambiguo)    |
| **Área**      | Base de datos · Alertas y emergencias · Servicios en vivo |

**Descripción.** El esquema usa `timestamp without time zone` en las 30 tablas y
hay tres vías de escribir un instante: `defaultNow()` (hora local de la sesión
de Postgres), Drizzle (`toISOString()`, UTC) y `pg` con un `Date` en SQL crudo
(hora local del proceso). Si no coinciden, toda comparación "columna > Date de
la app" falla en silencio.

**Evidencia del bug.** Con la sesión en `America/Bogota`:
`updated_at` (defaultNow) = `00:01:40` y `fresh` (Date de la app) = `05:01:41`
→ `00:01:40 > 05:01:41` es falso. Resultado: `GET /api/live` devolvía 0
emisores y cada ping de dispositivo creaba una transmisión duplicada.

**Mitigación aplicada.**

1. `lib/db/src/index.ts`: `options: "-c timezone=UTC"` en el pool.
2. `artifacts/api-server/src/lib/timezone.ts`: `process.env.TZ = "UTC"`,
   importado como primer módulo de `app.ts` e `index.ts`.
3. `src/__tests__/db-timezone.test.ts`: test de regresión que falla si la
   sesión no está en UTC.

**Riesgo residual.** El esquema sigue siendo ambiguo: si alguien configura la
sesión fuera de UTC por fuera del pool (p. ej. `ALTER DATABASE`), el bug
vuelve. **Mitigación definitiva pendiente:** migrar a `timestamp with time
zone` (migración 0034).

**Ver ALSO:** R-02.

---

## R-02 · Migración del esquema a `timestamptz`

|               |               |
| ------------- | ------------- |
| **Severidad** | 🟠 Alta       |
| **Estado**    | 🟠 ABIERTO    |
| **Área**      | Base de datos |

**Descripción.** 30 tablas con `timestamp without time zone`. Postgres tiene un
tipo correcto para instantes (`timestamptz`) y el actual obliga a que todas las
capas coincidan en la zona horaria.

**Mitigación.** El plan de migración (ciclo 002) debe ser reversible y
verificarse con `EXPLAIN` sobre datos reales. El test `db-timezone.test.ts`
actúa como red de seguridad mientras tanto.

---

## R-03 · Recuperación de contraseña rota en Android

|               |                                                              |
| ------------- | ------------------------------------------------------------ |
| **Severidad** | 🔴 Crítica                                                   |
| **Estado**    | 🔴 ABIERTO (rama `claude/production-readiness-audit-3pgip6`) |
| **Área**      | Autenticación · Android/PWA                                  |

**Descripción.** `PasswordRecovery.tsx`, `ResetPassword.tsx` y `MyReports.tsx`
usan `fetch("/api/...")` desnudo. En el APK nativo el documento se sirve desde
`https://localhost`, así que la petición se queda en el dispositivo: **nunca
sale a la red**. `PasswordRecovery` captura el error y muestra igualmente
"Revisa tu correo" → **fallo silencioso**: el usuario cree que recibió el
correo y no lo recibió.

`MyReports` además lee el token a mano de `localStorage`, sin URL base y sin
refresco automático ante 401.

**Mitigación pendiente.** Sustituir por `customFetch` de
`@workspace/api-client-react` (ya resuelve la URL base en Capacitor y renueva
la sesión ante 401) durante el rebase de la rama.

---

## R-04 · La rama de recuperación de contraseña revierte dos protecciones

|               |               |
| ------------- | ------------- |
| **Severidad** | 🔴 Crítica    |
| **Estado**    | 🔴 ABIERTO    |
| **Área**      | Autenticación |

**Descripción.** `claude/production-readiness-audit-3pgip6` está **15 commits
atrás** de `main`. Su diff neto _elimina_:

- la validación `SUPER_ADMIN_CLAIM_SECRET` de `POST /auth/claim-superadmin`
  (fail-closed: sin ella, cualquiera que se registre con el correo del
  superadministrador puede reclamar el rol), y
- la entrega del `refreshToken` en login y registro.

**Mitigación pendiente.** **No mergear la rama tal cual.** Rebasear el commit
`531dac12` sobre `main` (el commit en sí es puramente aditivo).

---

## R-05 · Token de sesión en `localStorage`

|               |                                |
| ------------- | ------------------------------ |
| **Severidad** | 🟠 Alta                        |
| **Estado**    | 🟠 ABIERTO                     |
| **Área**      | Autenticación · Ciberseguridad |

**Descripción.** El access token (15 min) y el refresh token (30 días) se guardan
en `localStorage`, accesibles desde cualquier XSS. El refresh token sí está
protegido en el servidor (hash SHA-256, revocable, `revoked`), lo que limita
el daño, pero el access token es reutilizable mientras dure.

**Mitigación pendiente.** Migrar a cookies `HttpOnly` + `Secure` + `SameSite`
con protección CSRF para web, y almacenamiento seguro en Android. Requiere
migración coordinada (frontend + backend + PWA).

**Mitigación actual.** CSP sin `'unsafe-inline'` en scripts, helmet completo,
`frameAncestors: 'none'`, y sin scripts inline en el bundle.

---

## R-06 · Aislamiento multi-tenant dependiente de la disciplina de cada ruta

|               |                          |
| ------------- | ------------------------ |
| **Severidad** | 🟠 Alta                  |
| **Estado**    | 🟠 ABIERTO               |
| **Área**      | Aislamiento multi-tenant |

**Descripción.** La defensa de aislamiento vive en helpers (`getDistrictId`,
`checkTenant`) que **cada ruta debe llamar**. Un endpoint nuevo que olvide
filtrar expone datos de otro distrito. `requireSameDistrict` y
`requireDistrictFilter` existen pero están infrautilizados (el propio código
lo documenta en `routes/auth.ts:661-668`).

**Mitigación actual.** Tests `tenant-isolation.test.ts` (313 líneas) y
`rls-tenant-isolation.test.ts` (123 líneas) + políticas RLS en la BD como
defensa estática.

**Mitigación pendiente.** Convertir el aislamiento en middleware obligatorio
por defecto, con un test que recorra todas las rutas registradas y verifique
que ninguna devuelve datos de otro distrito.

---

## R-07 · Deriva del contrato OpenAPI

|               |                               |
| ------------- | ----------------------------- |
| **Severidad** | 🟡 Media                      |
| **Estado**    | 🟡 ABIERTO                    |
| **Área**      | Documentación · Backend y API |

**Descripción.** El contrato tiene 24 paths frente a los ~120 endpoints
reales. El frontend consume el resto con `customFetch` directo: funciona, pero
sin tipos generados ni validación.

**Mitigación pendiente.** Cubrir el contrato por dominio. El bloqueador
conocido es la incompatibilidad entre el zod v3 que usa `lib/api-zod` y la
salida zod v4 de orval. El salto de orval a 8.22+ (hecho en el ciclo 001)
puede resolverlo: **verificar antes de regenerar**.

---

## R-08 · Los datos territoriales derivados no se validan

|               |                                                        |
| ------------- | ------------------------------------------------------ |
| **Severidad** | 🟡 Media                                               |
| **Estado**    | ✅ CERRADO (ciclo 001) — con riesgo residual de deriva |

**Descripción.** `users` y `reports` guardan `district`, `province` y
`department` como columnas derivadas, y el `districtId` es la autoridad. Si
ambas se rellenan por separado pueden divergir.

**Corrección aplicada.** Nuevo helper `getDistrictTerritory()` que las deriva
del catálogo `districts`, aplicado en registro, creación de reportes, creación
de visores y reporte espejo de alertas.

**Riesgo residual.** Other rutas que escriben `reports`/`users` podrían
seguir rellenando el territorio a mano. Buscar con
`Select-String -Path "artifacts/api-server/src" -Pattern "province:"`.

---

## R-09 · Sin E2E de navegador

|               |                            |
| ------------- | -------------------------- |
| **Severidad** | 🟡 Media                   |
| **Estado**    | 🟡 ABIERTO                 |
| **Área**      | Pruebas automatizadas · UX |

**Descripción.** La cobertura llega a la API (supertest) pero no a la
interfaz: no hay prueba de que el flujo de reporte funcione en el navegador,
ni del APK nativo. Un fallo como R-03 (que solo se manifiesta en Capacitor)
escaparía a los tests actuales.

**Mitigación pendiente.** Playwright con el recorrido ciudadano completo y
un test que verifique el comportamiento bajo `window.Capacitor` definido.

---

## R-10 · Sin métricas de rendimiento ni objetivos de latencia

|               |                                              |
| ------------- | -------------------------------------------- |
| **Severidad** | 🟡 Media                                     |
| **Estado**    | 🟡 ABIERTO                                   |
| **Área**      | Rendimiento · Escalabilidad · Observabilidad |

**Descripción.** No hay Lighthouse, ni métricas de p95 por endpoint, ni
pruebas de carga. El bundle se midió a mano una vez.

**Mitigación pendiente.** Lighthouse CI con umbrales (Performance ≥ 95,
Accessibility ≥ 90), y objetivos de p95 documentados por endpoint.

---

## R-11 · Accesibilidad sin evidencia objetiva

|               |               |
| ------------- | ------------- |
| **Severidad** | 🟡 Media      |
| **Estado**    | 🟡 ABIERTO    |
| **Área**      | Accesibilidad |

**Descripción.** Se corrigieron varios puntos (zoom, `aria-label`,
`aria-current`, "saltar al contenido"), pero quedan micro-labels
`text-[9px]`/`text-[10px]` sobre fondo oscuro que rozan el mínimo de contraste
de WCAG 1.4.3, y no se ha auditado `:focus-visible` (UX-AC7).

**Mitigación pendiente.** axe/Lighthouse como gate en CI.

---

## R-12 · El CI no cubría el frontend

|               |                        |
| ------------- | ---------------------- |
| **Severidad** | 🟠 Alta                |
| **Estado**    | ✅ CERRADO (ciclo 001) |
| **Área**      | CI/CD                  |

**Descripción.** `ci.yml` solo comprobaba tipo y formato del backend. El
frontend podía llegar a producción con errores de tipos, sin tests y sin
formatear (79 archivos nunca se habían formateado).

**Corrección aplicada.** Workflow reescrito con typecheck del monorepo,
tests del frontend, Prettier sobre frontend y backend, y auditoría de
dependencias bloqueante.

---

## R-13 · Pipeline roto por lockfile desincronizado

|               |                        |
| ------------- | ---------------------- |
| **Severidad** | 🔴 Crítica             |
| **Estado**    | ✅ CERRADO (ciclo 001) |
| **Área**      | CI/CD                  |

**Descripción.** El lockfile declaraba un override `ioredis: 5.10.1` que
`pnpm-workspace.yaml` ya no tenía → `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` →
**los 6 jobs de CI fallaban en `main`**. El gate de calidad no existía.

**Corrección aplicada.** Lockfile regenerado con la versión de pnpm que fija
`packageManager`, y job de CI que verifica `--frozen-lockfile` como primer paso.

---

## R-14 · Avisos de dependencias moderados y bajos

|               |                |
| ------------- | -------------- |
| **Severidad** | 🔵 Baja        |
| **Estado**    | ✅ ACEPTADO    |
| **Área**      | Ciberseguridad |

**Descripción.** Quedan 6 avisos moderados y 1 bajo, todos transitorios
(`uuid`, `protobufjs`, `qs`, `postcss-selector-parser`, `fast-copy`, `esbuild`).
Ninguno tiene ruta de explotación en el contexto de esta aplicación: son
utilidades de parsing que no procesan entrada no confiable en este código.

**Justificación de la aceptación.** El gate de CI bloquea con `high` en
dependencias de producción (0 actualmente) y publica el informe completo como
artefacto. Revisar en el siguiente ciclo.

---

## R-15 · Escolta de dependencias por pins de plataforma

|               |                        |
| ------------- | ---------------------- |
| **Severidad** | 🟡 Media               |
| **Estado**    | ✅ CERRADO (ciclo 001) |
| **Área**      | CI/CD · Android/PWA    |

**Descripción.** Los `overrides` que excluían los binarios nativos de Windows
(`rollup>@rollup/rollup-win32-x64-msvc: '-'`) impedían ejecutar vitest y vite
en Windows.

**Corrección aplicada.** `supportedArchitectures: {os: [current], cpu: [current]}`
en `pnpm-workspace.yaml`: instala solo lo de la plataforma actual (instalación
liviana: 1.266 → 1.069 paquetes) sin romper ningún sistema operativo.

---

## R-16 · Autorización de superadministrador por correo

|               |                                        |
| ------------- | -------------------------------------- |
| **Severidad** | 🟠 Alta                                |
| **Estado**    | ✅ CERRADO (ciclo 001) — pero ver R-04 |
| **Área**      | Autenticación                          |

**Descripción.** `POST /auth/claim-superadmin` permite obtener el rol
`super_admin` si el correo coincide con `SUPER_ADMIN_EMAIL`.

**Corrección aplicada (ya estaba en `main`, commit `cf366234`).** Exige además
`SUPER_ADMIN_CLAIM_SECRET` (fail-closed: si no está configurado, el endpoint
devuelve 503). El riesgo persiste si la rama R-04 se mergea sin rebasar.

---

## R-17 · Superficie de la documentación de la API

|               |                                |
| ------------- | ------------------------------ |
| **Severidad** | 🟡 Media                       |
| **Estado**    | 🟡 ABIERTO                     |
| **Área**      | Ciberseguridad · Documentación |

**Descripción.** `swagger-ui-express` expone `/api-docs` en todos los entornos,
incluida producción. Documenta la superficie completa de la API (incluidos los
endpoints de backoffice).

**Mitigación pendiente.** Montar `/api-docs` solo en desarrollo, o protegerlo
con el rol de backoffice.

---

## Resumen

| Severidad  | Total |                    Abiertos |       Cerrados | Aceptados | Mitigados |
| ---------- | ----: | --------------------------: | -------------: | --------: | --------: |
| 🔴 Crítica |     4 |              2 (R-03, R-04) |       1 (R-13) |         0 |  1 (R-01) |
| 🟠 Alta    |     6 | 4 (R-02, R-05, R-06, R-10*) | 2 (R-12, R-16) |         0 |         0 |
| 🟡 Media   |     5 |  4 (R-07, R-09, R-10, R-11) |       1 (R-15) |         0 |         0 |
| 🔵 Baja    |     1 |                           0 |              0 |  1 (R-14) |         0 |

\* R-10 está clasificado como Media en su ficha.

**Regla aplicada:** ninguna vulnerabilidad crítica o alta puede quedar abierta
para declarar el objetivo global cumplido. Los dos críticos abiertos (R-03,
R-04) son el foco del ciclo 002.

---

_Actualizar en cada cierre de ciclo. No borrar entradas: cambiar el estado._
