# Auditoría — Ciclo 002

> Recuperación de contraseña, contrato OpenAPI, `timestamptz` y verificación real
> de la cadena de migraciones.
> Fecha: 2026-10-21 · Rama: `feature/audit-cycle-002` · Base: `feature/audit-cycle-001` @ `4e02cbe1`

Este ciclo se apila sobre el 001 (PR #35) en vez de sobre `main` para heredar
`currentUser()`, `req.jwtUser`, la sesión UTC y el CI arreglado. `main` sigue sin
tocar.

---

## 1. Resumen ejecutivo

| Métrica                           | Ciclo 001 |    Ciclo 002 |
| --------------------------------- | --------: | -----------: |
| Global (25 áreas)                 |      8.56 |     **8.67** |
| Áreas ≥ 9.8                       |      0/25 |         0/25 |
| Áreas ≥ 9.0                       |         5 |            8 |
| Vulnerabilidades críticas / altas |       0/0 |          0/0 |
| Suites backend / tests            |  26 / 173 | **28 / 180** |
| Suites frontend / tests           |    4 / 17 |   **5 / 21** |
| Jobs de CI                        |         8 |        **9** |
| Riesgos críticos abiertos         |         2 |        **0** |

Lo más importante del ciclo no fue una función nueva, sino lo que apareció al
verificar el camino real de despliegue: **la cadena de migraciones no reproducía
el esquema**. Una base creada solo con `lib/db/migrations` (que es exactamente lo
que hace `render-build.sh` en cada despliegue) tenía 28 tablas y 50 columnas con
zona horaria, frente a 29 y 51 del esquema. Faltaba `user_consents`, la tabla en
la que `POST /auth/register` guarda el consentimiento informado.

Y el runner que aplica esas migraciones **ignoraba los errores y terminaba con
código 0**: el despliegue habría seguido adelante con el esquema a medias.

---

## 2. Entorno de verificación

| Elemento   | Valor                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| Node       | v24.21.0                                                                                                    |
| pnpm       | 11.9.0 vía `corepack` (el global es 9.15.4 y no respeta `packageManager`)                                   |
| PostgreSQL | 17.11 local                                                                                                 |
| Bases      | `radarvecinal_test` (push), `radarvecinal_mig3` (solo migraciones), `radarvecinal_mig` (migraciones + push) |
| Sistema    | Windows · TZ del proceso `America/Lima` · TZ de la sesión PG `America/Bogota`                               |

---

## 3. Cambios

### 3.1 Recuperación de contraseña y "Mis reportes"

Se aplicó el diff de `531dac12` (rama `claude/production-readiness-audit-3pgip6`)
sobre la base del ciclo 001, con las correcciones que el código actual exigía.

- `GET /reports/mine` usa `currentUser()` tipado en vez de `(req as any).jwtUser`
  y valida que el `sub` sea un entero positivo.
- **El token de recuperación ya no vale como token de sesión.** Ambos se firman
  con el mismo `JWT_SECRET`; sin distinguirlos, el enlace del correo servía como
  credencial durante 30 minutos, incluso después de usarlo. Ahora
  `optionalAuth`, `requireAuth`, `/auth/me` y `verifyToken` exigen
  `purpose: "access"` (o su ausencia, por compatibilidad con tokens ya emitidos).
- **`POST /auth/forgot-password` tiene doble límite**: 10/15 min por IP y 3/hora
  por correo destino. El limitador de `/api/auth` usa email+IP como clave, así
  que rotar el correo lo esquivaba: permitía usar el formulario como amplificador
  para inundar de correos a terceros y para enumerar cuentas.
- El envío del correo no se espera: el tiempo de respuesta no delata si la cuenta
  existe.
- El enlace de reset (token de un solo uso que permite tomar la cuenta) ya no se
  escribe en los logs cuando `NODE_ENV=production`.
- Payload del token tipado en vez de `any`.

### 3.2 `customFetch` en las pantallas nuevas

`PasswordRecovery`, `ResetPassword` y `MyReports` llamaban a `fetch("/api/...")`
directamente. En web funciona; dentro del APK de Capacitor la webview carga desde
`https://localhost` y la ruta relativa apunta al propio móvil. Ahora usan
`customFetch`, que aplica la URL base de `apiConfig` y adjunta el token que
registra `AuthContext`.

Además, `PasswordRecovery` ya no oculta el fallo: un 429 muestra el mensaje del
límite, otro error HTTP muestra reintento y un fallo de red avisa de que no hay
conexión. El caso "correo no registrado" sigue siendo indistinguible del caso
"correo registrado" (200 genérico), así que no se abre un oráculo de
enumeración.

### 3.3 Contrato OpenAPI

`/auth/forgot-password`, `/auth/reset-password` y `/reports/mine` no estaban en
`openapi.yaml`. Se añadieron con sus esquemas (`ForgotPasswordInput`,
`ResetPasswordInput`, `GenericMessage`, `MyReport`) y se regeneró el cliente.

Al regenerar aparecieron tres supuestos ocultos que rompían la compilación y
explican por qué el cliente había derivado:

- El proyecto usa **zod 3**, pero orval no puede leer `"zod": "catalog:"` y
  asumía v4 (`z.coerce.int`, `z.string().email`). Se fija
  `override.zod.version: 3`.
- El proyecto usa **@tanstack/react-query 5**, pero orval generaba tipos de v4.
  Se fija `override.query.version: 5`.
- El cliente nuevo usa `Headers.entries()`, que exige `dom.iterable` en el `lib`
  de TypeScript.

### 3.4 `timestamptz` en las 51 columnas de fecha

El esquema usaba `timestamp without time zone`. Con esa representación el mismo
instante se escribe de tres formas distintas y el resultado depende de la zona de
la sesión de Postgres: `now()` usa la hora de la sesión, Drizzle escribe UTC y
`pg` al leer interpreta el reloj como hora local del proceso. De ahí el bug del
ciclo 001 (`GET /api/live` devolvía 0 emisores y duplicaba transmisiones con la
sesión en `America/Bogota`). El arreglo anterior (`TZ=UTC` + `-c timezone=UTC`)
tapaba el síntoma en un solo pool.

- 51 columnas declaradas `timestamp(..., { withTimezone: true })`.
- `0034_timestamptz.sql` convierte las existentes con
  `USING col AT TIME ZONE 'UTC'`, conservando el instante.
- Migración **idempotente** (recorre `information_schema` y solo toca lo que
  sigue sin zona): ejecutarla dos veces convierte 0 columnas. Importa porque
  `render-build.sh` aplica todas las migraciones en cada despliegue.
- `revert/0034_timestamptz_down.sql` deja el camino de vuelta y no se aplica solo
  (`run_all_migrations.js` no entra en subcarpetas).

### 3.5 Deriva esquema ↔ migraciones

| Hallazgo                                                        | Impacto real                                                                                            | Corrección                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `user_consents` no la creaba ninguna migración                  | En una base nueva, `POST /auth/register` fallaba al guardar el consentimiento                           | `0035_user_consents.sql`                              |
| 5 columnas `NOT NULL` en el esquema, nulables en migraciones    | Filas con `NULL` donde el tipo generado promete un valor                                                | `0036_not_null_alignment.sql`                         |
| `districts.brand_name/logo_url/primary_color` fuera del esquema | `GET /districts` dejó de devolverlas y el cobranding caía siempre a los valores por defecto (sin error) | Restauradas en el esquema y tipadas en `DistrictInfo` |

Comparación de `information_schema` entre la base creada por migraciones y la
creada por `drizzle-kit push`, tras las correcciones: **sin diferencias** en
columna, tipo, nulabilidad ni default.

### 3.6 CI y despliegue

- `run_all_migrations.js` ya no se traga los errores: si queda una sentencia
  fallida, imprime el resumen y sale con **código 1** para que Render cancele el
  despliegue.
- La detección de errores benignos pasó de comparar texto en inglés a usar
  **SQLSTATE** (`42P07`, `42P06`, `42701`, `42710`, `23505`). En un Postgres en
  español el mensaje es "ya existe…", así que la versión anterior marcaba como
  error cada sentencia ya aplicada.
- Nuevo job `migrations`: base vacía → cadena completa → segunda pasada
  (idempotencia) → aserciones de tablas, `timestamptz`, `user_consents`,
  cobranding y las 5 columnas `NOT NULL`.
- El CI ya corre en PRs apilados: `pull_request` sin filtro de rama base.
- `render-build.sh` usa `--frozen-lockfile` (antes `--no-frozen-lockfile`): el
  artefacto desplegado tiene que ser el que pasó los tests.

### 3.7 Otros defectos corregidos

- `pnpm --filter @workspace/db run migrate` no podía ejecutarse: `tsx` no estaba
  declarado. Además, el journal de Drizzle solo conoce 3 de 37 migraciones, así
  que el runner habría aplicado 3 y dicho "success". Ahora hay un preflight que
  aborta y enumera las 34 que faltan, y `tsx` está en devDependencies.
- Comentario corrupto en `ci.yml` (`son打击 por`) corregido.
- La tabla del scorecard tenía la fila 3 fusionada con la 2, y los totales
  «8 áreas por debajo de 9.0» / «7 áreas en 9.0–10» no coincidían con las
  puntuaciones (eran 20 y 5). Recalculado.

---

## 4. Verificación reproducible

Todos los comandos se ejecutaron en este equipo, salvo donde se indica.

| Comprobación                           | Comando                                            | Resultado                                                         |
| -------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------- |
| Typecheck (libs + API + frontend)      | `pnpm run typecheck`                               | ✅ exit 0                                                         |
| Formato (globs del CI)                 | `pnpm exec prettier --check ...`                   | ✅ `All matched files use Prettier code style!`                   |
| Tests backend (Postgres real)          | `pnpm --filter @workspace/api-server run test`     | ✅ 28 suites / 180 pass / 1 skip                                  |
| Tests frontend                         | `pnpm --filter @workspace/radar-vecinal run test`  | ✅ 5 suites / 21 pass                                             |
| Build API                              | `pnpm --filter @workspace/api-server run build`    | ✅ `dist/index.mjs` 4.1 mb                                        |
| Build frontend                         | `pnpm --filter @workspace/radar-vecinal run build` | ✅ 42.22 s · PWA                                                  |
| Auditoría de dependencias              | `pnpm audit --prod --audit-level high`             | ✅ 0 high/critical · 1 low + 4 moderate                           |
| Cadena de migraciones desde cero       | `node run_all_migrations.js` (base vacía)          | ✅ 37 migraciones · 29 tablas · 51 `timestamptz` · 0 errores      |
| Idempotencia                           | `node run_all_migrations.js` (segunda pasada)      | ✅ 0 errores · exit 0                                             |
| Fail-fast                              | migración temporal con tabla inexistente           | ✅ exit 1 + resumen                                               |
| Integridad del instante                | tabla sonda con `2026-10-21 10:00:00`              | ✅ epoch 1792576800 antes/después; 10:00+00 / 05:00-05 / 19:00+09 |
| Esquema ↔ migraciones (columnas)       | `information_schema` vs `drizzle-kit push`         | ✅ sin diferencias                                                |
| `drizzle-kit push` sobre la BD migrada | `pnpm --filter @workspace/db run push`             | ✅ `No changes detected`                                          |
| Preflight del runner de Drizzle        | `pnpm --filter @workspace/db run migrate`          | ✅ exit 1 · «conoce 3 de 37»                                      |
| CI                                     | run `39600787424` en `26a82ead`                    | ✅ **9/9 jobs success**                                           |

### Pruebas nuevas o ampliadas

- `auth-recovery-mine.test.ts` (6): respuesta genérica, reset válido, token
  inválido, aislamiento de `/reports/mine`, **el token de reset no sirve como
  sesión**, límite por IP → 429.
- `districts-branding.test.ts` (1): `GET /api/districts` devuelve `brandName`,
  `logoUrl` y `primaryColor` con los valores guardados.
- `api-config-capacitor.test.ts` (4): URL base y token con `window.Capacitor`.
- `db-timezone.test.ts` (existente): sigue en verde con `timestamptz`.

---

## 5. Lo que NO se ha verificado

- **Entorno real de producción.** Sin credenciales de Neon, SMTP, Cloudinary,
  Firebase ni Render no se puede comprobar que el despliegue aplique las
  migraciones ni que el correo de recuperación salga.
- **E2E de navegador y en dispositivo.** No hay Playwright ni un APK instalado.
  Los flujos están cubiertos por tests de API y de configuración, no por un
  navegador real.
- **Rendimiento y accesibilidad.** Sin Lighthouse, axe ni medición de p95.
- **Volumen de producción.** El tiempo que tardará `0034` en convertir 51
  columnas depende del número de filas real; no está medido (R-18).
- **Entrega de correo.** El envío es fire-and-forget; un fallo de SMTP no se
  propaga al usuario (decisión de diseño para no filtrar existencia de cuentas).

---

## 6. Riesgos

Cerrados en este ciclo: R-01, R-02, R-03, R-04. Mitigados: R-07, R-20.
Nuevos: R-18 (lock de `0034`), R-19 (`push` borra 32 índices), R-20 (journal
incompleto). El detalle está en `RISK_REGISTER.md`.

Ninguna vulnerabilidad crítica o alta de dependencias queda abierta.

---

## 7. Commits del ciclo

| Commit     | Contenido                                                                        |
| ---------- | -------------------------------------------------------------------------------- |
| `c4f408d1` | Recuperación de contraseña + "mis reportes" + endurecimiento de tokens y límites |
| `55afd23f` | `customFetch` en recuperar, restablecer y mis reportes                           |
| `f1d611d9` | Contrato OpenAPI de los 3 endpoints + cliente regenerado                         |
| `89819ee6` | `timestamptz` en las 51 columnas                                                 |
| `e6434044` | CI en PRs apilados                                                               |
| `3b69725a` | No ocultar el fallo de red en "recuperar contraseña"                             |
| `40471305` | Deriva de esquema: `user_consents`, `NOT NULL`, cobranding                       |
| `d3ea8190` | Migraciones verificadas desde cero; el runner falla de verdad                    |
| `88e1c44e` | Preflight del journal de Drizzle + `tsx` declarado                               |
| `7ef61ff6` | Documentación de cierre del ciclo 002                                            |
| `6d3c21ce` | Formato de `migrate.ts` (lo detectó el gate de CI)                               |
| `26a82ead` | `0035` comprueba la FK por columna, no por nombre                                |

PR: <https://github.com/cponce123com-create/RadarVecinal/pull/36> (base
`feature/audit-cycle-001`, **no fusionar sin autorización**: `render.yaml` apunta
a `main` y el merge dispara despliegue en Render).

---

## 8. Siguiente ciclo

Prioridades del ciclo 003 (detalle en `WORK_PLAN.md`):

1. R-19: declarar los 32 índices en el esquema **o** bloquear `push` sobre bases
   con datos.
2. R-18: medir el tiempo de `0034` y, si hace falta, convertir por lotes.
3. Cobertura medida + E2E de los flujos críticos (login, recuperación, reporte,
   alerta de pánico).
4. Dependencias moderadas (R-14) con verificación completa.
5. `/api-docs` fuera de producción (R-17).
