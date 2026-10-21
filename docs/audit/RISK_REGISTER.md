# Registro de riesgos — Radar Vecinal

> Riesgos vivos del proyecto, con severidad, evidencia y mitigación.
> Actualizado al cierre del ciclo 002 (2026-10-21).

Severidad: 🔴 Crítica · 🟠 Alta · 🟡 Media · 🔵 Baja.
**Estado:** `ABIERTO` · `MITIGADO` · `CERRADO` · `ACEPTADO` (con justificación)

---

## R-01 · Zona horaria de la base de datos

|               |                                                           |
| ------------- | --------------------------------------------------------- |
| **Severidad** | 🔴 Crítica                                                |
| **Estado**    | ✅ CERRADO (ciclo 002)                                    |
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

**Cierre (ciclo 002).** La mitigación definitiva está aplicada: las 51 columnas
son `timestamp with time zone` y la conversión conserva el instante.

- Migración `0034_timestamptz.sql`, idempotente: recorre `information_schema` y
  solo convierte lo que sigue sin zona. Segunda ejecución: 0 columnas.
- Prueba de integridad con una tabla sonda que contenía
  `2026-10-21 10:00:00`: epoch `1792576800` antes y después. En sesión UTC se lee
  `10:00+00`, en `America/Lima` `05:00-05` y en `Asia/Tokyo` `19:00+09`: mismo
  instante, distinto reloj de pared.
- `revert/0034_timestamptz_down.sql` deja el camino de vuelta y no se aplica
  solo (`run_all_migrations.js` no entra en subcarpetas).
- Se mantienen `TZ=UTC` y `-c timezone=UTC` como defensa en profundidad para
  columnas legacy y para `CURRENT_DATE`/`date_trunc`.

**Ver ALSO:** R-02.

---

## R-02 · Migración del esquema a `timestamptz`

|               |                        |
| ------------- | ---------------------- |
| **Severidad** | 🟠 Alta                |
| **Estado**    | ✅ CERRADO (ciclo 002) |
| **Área**      | Base de datos          |

**Descripción.** 30 tablas con `timestamp without time zone`. Postgres tiene un
tipo correcto para instantes (`timestamptz`) y el actual obliga a que todas las
capas coincidan en la zona horaria.

**Cierre (ciclo 002).** Aplicada `0034_timestamptz.sql` sobre PostgreSQL 17:

- 51 columnas convertidas; segunda ejecución convierte 0.
- `drizzle-kit push` contra la base migrada: `No changes detected`.
- Suite completa en verde tras el cambio (28 suites / 180 tests).
- La cadena entera de migraciones sobre una base vacía deja 51 columnas
  `timestamptz` y 29 tablas, y ahora se verifica en el job `migrations` del CI.

**Riesgo residual.** `ALTER TABLE ... TYPE` toma un lock por tabla. Con el
volumen actual es cuestión de segundos, pero conviene ejecutarlo en ventana de
baja actividad (ver R-18).

---

## R-03 · Recuperación de contraseña rota en Android

|               |                             |
| ------------- | --------------------------- |
| **Severidad** | 🔴 Crítica                  |
| **Estado**    | ✅ CERRADO (ciclo 002)      |
| **Área**      | Autenticación · Android/PWA |

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

**Cierre (ciclo 002).**

- Las tres pantallas (`PasswordRecovery`, `ResetPassword`, `MyReports`) usan
  `customFetch`.
- `PasswordRecovery` ya no oculta el fallo: un 429 muestra el mensaje del
  límite, un error HTTP muestra reintento y un fallo de red avisa de que no hay
  conexión. El caso "correo no registrado" sigue siendo indistinguible del caso
  "correo registrado" (200 genérico), así que no se abre un oráculo de
  enumeración.
- Test `__tests__/lib/api-config-capacitor.test.ts`: con `window.Capacitor`
  definido, la URL base es la del servidor configurado; sin él, la ruta relativa
  (4 casos).
- `MyReports` ya no lee el token a mano: lo adjunta `customFetch` desde
  `AuthContext`.

---

## R-04 · La rama de recuperación de contraseña revierte dos protecciones

|               |                        |
| ------------- | ---------------------- |
| **Severidad** | 🔴 Crítica             |
| **Estado**    | ✅ CERRADO (ciclo 002) |
| **Área**      | Autenticación          |

**Descripción.** `claude/production-readiness-audit-3pgip6` está **15 commits
atrás** de `main`. Su diff neto _elimina_:

- la validación `SUPER_ADMIN_CLAIM_SECRET` de `POST /auth/claim-superadmin`
  (fail-closed: sin ella, cualquiera que se registre con el correo del
  superadministrador puede reclamar el rol), y
- la entrega del `refreshToken` en login y registro.

**Mitigación pendiente.** **No mergear la rama tal cual.** Rebasear el commit
`531dac12` sobre `main` (el commit en sí es puramente aditivo).

**Cierre (ciclo 002).** Se hizo el equivalente a un rebase: se aplicó el diff de
`531dac12` sobre la rama del ciclo 001 (que ya contiene `currentUser()`,
`req.jwtUser`, UTC y el CI arreglado) y se corrigió lo que el código actual
exigía. Las dos protecciones intactas:

- `SUPER_ADMIN_CLAIM_SECRET` sigue siendo fail-closed (test
  `superadmin-claim.test.ts` en verde).
- `refreshToken` se sigue entregando en login y registro (test `auth.test.ts`).

La rama `claude/production-readiness-audit-3pgip6` no se mergea y se puede
eliminar.

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
| **Estado**    | 🟡 MITIGADO (ciclo 002)       |
| **Área**      | Documentación · Backend y API |

**Descripción.** El contrato tiene 24 paths frente a los ~120 endpoints
reales. El frontend consume el resto con `customFetch` directo: funciona, pero
sin tipos generados ni validación.

**Mitigación pendiente.** Cubrir el contrato por dominio. El bloqueador
conocido es la incompatibilidad entre el zod v3 que usa `lib/api-zod` y la
salida zod v4 de orval. El salto de orval a 8.22+ (hecho en el ciclo 001)
puede resolverlo: **verificar antes de regenerar**.

**Avance (ciclo 002).** El bloqueador está resuelto y documentado:

- `lib/api-spec/orval.config.ts` fija `override.zod.version: 3` y
  `override.query.version: 5` (orval no sabe leer `"zod": "catalog:"` y asumía
  v4 y react-query v4).
- `lib/api-client-react/tsconfig.json` incluye `dom.iterable`, que el cliente
  nuevo necesita para `Headers.entries()`.
- Se añadieron `/auth/forgot-password`, `/auth/reset-password` y `/reports/mine`
  con sus esquemas, y se regeneró el cliente sin errores de compilación.

Queda cubrir el resto de endpoints; ya no hay un impedimento técnico, solo
volumen.

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

**Descripción.** Tras el ciclo 002 quedan **4 avisos moderados y 1 bajo** en
dependencias de producción:

| Paquete      | Ruta                                 | Versión corregida       |
| ------------ | ------------------------------------ | ----------------------- |
| `qs` (×2)    | `express > body-parser > qs`         | `>=6.15.4` / `>=6.16.0` |
| `uuid`       | `firebase-admin > @google-cloud/...` | `>=11.1.1`              |
| `protobufjs` | `firebase-admin > @google-cloud/...` | `>=7.6.5`               |
| `esbuild`    | `vite-plugin-pwa > vite > esbuild`   | `>=0.28.1`              |

`esbuild` es de la cadena de build (no llega al bundle); los otros tres son
utilidades de parsing dentro de Firebase/Express.

**Justificación de la aceptación.** El gate de CI bloquea con `high` o
`critical` en dependencias de producción: hoy 0. Los cuatro moderados no tienen
una ruta de explotación conocida en este código (no procesan entrada no
confiable de forma directa) y forzar los overrides puede romper la cadena de
build. Se abordan en el ciclo 003 con verificación completa (tests + ambos
builds). Si en ese momento alguna queda sin parche compatible, se documenta
como riesgo aceptado con la justificación concreta.

**Nota.** `pnpm audit --prod --audit-level high` sale con código 0: el pipeline
no se rompe por estos avisos, pero tampoco se ocultan (el informe completo se
publica como artefacto en cada ejecución).

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

## R-18 · Lock de tabla al convertir a `timestamptz` en el despliegue

|               |                    |
| ------------- | ------------------ |
| **Severidad** | 🟡 Media           |
| **Estado**    | 🟡 ABIERTO         |
| **Área**      | CI/CD · Despliegue |

**Descripción.** `0034_timestamptz.sql` ejecuta un `ALTER TABLE ... ALTER COLUMN
... TYPE timestamptz` por cada una de las 51 columnas. Cada `ALTER` toma un lock
`ACCESS EXCLUSIVE` sobre su tabla, así que bloquea lecturas y escrituras de esa
tabla mientras dure. Con el volumen actual (decenas de miles de filas) es
cuestión de segundos por tabla, pero no está medido sobre producción.

**Mitigación.** Ejecutar el despliegue en ventana de baja actividad y observar
el tiempo total de `render-build.sh`. La migración es idempotente: si el
despliegue se corta a mitad, el siguiente pase continúa donde quedó.

**Pendiente.** Medir el tiempo real con el volumen de producción y, si excede
lo aceptable, convertir por lotes con `lock_timeout` y reintentos.

---

## R-19 · `drizzle-kit push` elimina 32 índices que el esquema no declara

|               |                             |
| ------------- | --------------------------- |
| **Severidad** | 🟠 Alta                     |
| **Estado**    | 🟠 ABIERTO                  |
| **Área**      | Base de datos · Rendimiento |

**Descripción.** Las migraciones crean 32 índices (migración 0021 y posteriores)
que el esquema Drizzle no declara. `drizzle-kit push` hace que el esquema sea la
verdad y **borra lo que no reconoce**.

**Evidencia.** Se compararon dos bases:

- `radarvecinal_mig3`: solo `run_all_migrations.js` → 32 índices presentes.
- `radarvecinal_mig`: migraciones y después `drizzle-kit push` → esos 32 índices
  ya no existen (`pg_indexes`, diferencia de 32).

Producción no usa `push` (`render-build.sh` usa `run_all_migrations.js`), y el
CI lo usa solo sobre una base vacía. El riesgo es operativo: un
`pnpm --filter @workspace/db run push` contra una base real degradaría el
rendimiento en silencio.

**Mitigación pendiente (ciclo 003).** Declarar los índices en el esquema
(`index()`/`uniqueIndex()` con los mismos nombres) **o** añadir un guardia que
impida `push` sobre una base con tablas. Mientras tanto: no ejecutar `push`
contra producción.

---

## R-20 · El journal de Drizzle conoce 3 de 37 migraciones

|               |                         |
| ------------- | ----------------------- |
| **Severidad** | 🟡 Media                |
| **Estado**    | 🟡 MITIGADO (ciclo 002) |
| **Área**      | Base de datos · CI/CD   |

**Descripción.** `lib/db/migrations/meta/_journal.json` solo registra
`0000`–`0002`; las otras 34 se añadieron a mano. El comando documentado
`pnpm --filter @workspace/db run migrate` usa el migrator de Drizzle, que
**ignora en silencio** los `.sql` que no están en el journal: podía terminar con
«Migrations applied successfully» habiendo aplicado 3 de 37. Además, el script
dependía de `tsx`, que no estaba declarado y hacía que fallara al arrancar.

**Mitigación aplicada (ciclo 002).**

- `migrate.ts` comprueba el journal antes de migrar y aborta con la lista de
  archivos que faltan, indicando que se use `run_all_migrations.js`.
- `tsx` añadido a las devDependencies de `@workspace/db`.
- Verificado: el comando sale con código 1 y enumera las 34 migraciones que el
  journal desconoce.

**Pendiente.** Regenerar el journal (o retirar el runner de Drizzle y dejar
`run_all_migrations.js` como único camino). Producción ya usa el segundo.

---

## Resumen

| Severidad  | Total |                         Abiertos |                   Cerrados | Aceptados |      Mitigados |
| ---------- | ----: | -------------------------------: | -------------------------: | --------: | -------------: |
| 🔴 Crítica |     4 |                                0 | 4 (R-01, R-03, R-04, R-13) |         0 |              0 |
| 🟠 Alta    |     6 |             3 (R-05, R-06, R-19) |       3 (R-02, R-12, R-16) |         0 |              0 |
| 🟡 Media   |     9 | 5 (R-09, R-10, R-11, R-17, R-18) |             2 (R-08, R-15) |         0 | 2 (R-07, R-20) |
| 🔵 Baja    |     1 |                                0 |                          0 |  1 (R-14) |              0 |

**Regla aplicada:** ninguna vulnerabilidad crítica o alta puede quedar abierta
para declarar el objetivo global cumplido. Tras el ciclo 002 no queda ninguna
crítica abierta. Las altas abiertas son R-05 (token en `localStorage`), R-06
(aislamiento multi-tenant por disciplina) y R-19 (`push` borra índices).

---

_Actualizar en cada cierre de ciclo. No borrar entradas: cambiar el estado._
