# Auditoría — Ciclo 001

> Baseline de la auditoría continua de Radar Vecinal.
> Fecha: 2026-10-21 · Rama: `feature/audit-cycle-001` · Base: `main` @ `cf366234`

Este documento es el **punto de partida medido** del ciclo de auditoría continua.
Todo lo que sigue está respaldado por comandos ejecutados sobre el repositorio
y, cuando aplica, por una base de datos PostgreSQL 17 real.

---

## 1. Entorno de verificación

| Elemento   | Valor                                                                         |
| ---------- | ----------------------------------------------------------------------------- |
| Node       | v24.21.0                                                                      |
| pnpm       | 11.9.0 (vía `corepack`, según `packageManager`)                               |
| PostgreSQL | 17.11 local, base de datos dedicada `radarvecinal_test`                       |
| Sistema    | Windows · TZ del proceso `America/Lima` · TZ de la sesión PG `America/Bogota` |

> La diferencia de zona horaria entre el proceso Node y la sesión de Postgres
> fue, sin saberlo, el detector de un bug crítico (§4.2). Un entorno con todo
> en UTC no lo habría mostrado.

### Comandos de verificación

```bash
pnpm install --frozen-lockfile       # instalación reproducible
pnpm run typecheck                    # libs (tsc --build) + api-server + frontend
pnpm exec prettier --check "..."      # formato (backend + frontend + libs)
pnpm --filter @workspace/api-server run test          # 26 suites, Postgres real
pnpm --filter @workspace/radar-vecinal run test       # 4 suites
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/radar-vecinal run build
pnpm audit --prod --audit-level high
pnpm peers check
```

---

## 2. Inventario del repositorio

| Área                                           | Ubicación                                                                                 | Volumen                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------- |
| Backend                                        | `artifacts/api-server/src`                                                                | 36 archivos `.ts`, 20 ficheros de rutas |
| Frontend                                       | `artifacts/radar-vecinal/src`                                                             | 84 archivos `.ts/.tsx`                  |
| Librerías                                      | `lib/db`, `lib/api-spec`, `lib/api-zod`, `lib/api-client-react`, `lib/object-storage-web` | 71 archivos                             |
| Total código (sin `node_modules`/`dist`/tests) | —                                                                                         | **≈ 29 971 líneas**                     |
| Tablas                                         | `lib/db/src/schema/reports.ts`                                                            | **30** (`pgTable`)                      |
| Migraciones                                    | `lib/db/migrations`                                                                       | **34** (0000 → 0033)                    |
| Tests backend                                  | `artifacts/api-server/src/__tests__`                                                      | 26 suites                               |
| Tests frontend                                 | `artifacts/radar-vecinal/__tests__`                                                       | 4 suites                                |
| CI                                             | `.github/workflows/ci.yml`, `android.yml`                                                 | 2 workflows                             |

### Rutas de la API por fichero

`auth` · `users` · `reports` · `alerts` (pánico + extraviados) · `live`
(servicios en vivo) · `admin` · `stats` · `activity` · `categories` ·
`civicEducation` · `districts` · `embed` · `features` · `health` · `licenses` ·
`messages` · `reniec` · `reportsPdf` · `storage` · `telegram` · `tenant`

### Servicios externos

Neon PostgreSQL · Cloudinary (imágenes) · Firebase Cloud Messaging (push) ·
SMTP (correo) · API RENIEC (`api.decolecta.com`) · Telegram Bot API ·
Render (hosting) · Esri (teselas del mapa base, sin clave)

### Variables de entorno (de `.env.example`, sin valores reales)

`DATABASE_URL` · `JWT_SECRET` · `SUPER_ADMIN_EMAIL` · `SUPER_ADMIN_CLAIM_SECRET` ·
`PORT` · `NODE_ENV` · `CORS_ORIGIN` · `CLOUDINARY_*` · `RENIEC_API_TOKEN` ·
`SEED_KEY` · `FCM_SERVICE_ACCOUNT` · `SMTP_*` · `APP_URL` · `TELEGRAM_*`

---

## 3. Estado inicial (baseline medido)

| Verificación                           | Estado en `main` | Detalle                                                                                                                                                                                                        |
| -------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`       | ❌ **ROTO**      | `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`: el lockfile declaraba un override `ioredis: 5.10.1` que `pnpm-workspace.yaml` ya no tenía (se eliminó con los workers de Redis). **Los 6 jobs de CI fallaban en `main`.** |
| `pnpm run typecheck`                   | ✅ verde         | (con `as any` en 82 puntos del backend)                                                                                                                                                                        |
| `pnpm exec prettier --check` (backend) | ⚠️ engañoso      | Fallaba en Windows por CRLF; el gate de CI solo cubría backend y el frontend **nunca** se formateó (79 archivos).                                                                                              |
| Tests backend                          | ❌ **ROTO**      | 7 suites con `Hook timed out in 15000ms` (paralelismo) + **4 tests rojos reales** en `live-providers.test.ts`. El README afirmaba "159 tests en verde".                                                        |
| Tests frontend                         | ✅ verde         | 4 suites / 17 tests                                                                                                                                                                                            |
| `pnpm audit`                           | ❌               | **15 críticas, 51 altas** (1 crítica y 33 altas en dependencias de producción).                                                                                                                                |
| `pnpm peers check`                     | ❌               | 2 conflictos: `openapi-types` ausente y `@capacitor/push-notifications@8` exigiendo `@capacitor/core@8` con el core en 7.                                                                                      |
| `pnpm install` en Windows              | ❌               | El `preinstall` usaba `sh -c`: sin shell POSIX, la instalación fallaba.                                                                                                                                        |
| `vitest` en Windows                    | ❌               | `Cannot find module @rollup/rollup-win32-x64-msvc`: los overrides de `pnpm-workspace.yaml` excluían el binario nativo de Windows.                                                                              |

---

## 4. Hallazgos del ciclo 001

Severidad: 🔴 Crítica · 🟠 Alta · 🟡 Media · 🔵 Baja.

### 4.1 🔴 CI — el pipeline estaba roto en `main`

**Causa raíz.** `pnpm-lock.yaml` conservaba el override `ioredis: 5.10.1`
(heredado de los workers de Redis, eliminados en `e0c94913`), pero
`pnpm-workspace.yaml` ya no lo declaraba. pnpm 11 aborta con
`PNPM_LOCKFILE_CONFIG_MISMATCH` y **los seis jobs del workflow fallaban**,
incluido el de instalación.

**Corrección.** Lockfile regenerado con pnpm 11.9.0 (la versión que fija
`packageManager`), overrides recalculados y verificado que
`pnpm install --frozen-lockfile` funciona.

### 4.2 🔴 Base de datos — la zona horaria rompía "Servicios en vivo"

**Causa raíz.** El esquema usa `timestamp without time zone` en las 30 tablas y
hay **tres** vías distintas de escribir un instante en esa columna:

| Vía                                  | Representación              |
| ------------------------------------ | --------------------------- |
| `defaultNow()` / `now()` de Postgres | hora local de la **sesión** |
| Drizzle (columna `timestamp()`)      | `toISOString()` → **UTC**   |
| `pg` con un `Date` en SQL crudo      | hora local del **proceso**  |

Con la sesión en `America/Bogota` y el proceso en `America/Lima` (mismo
offset, distinta zona), el resultado observado fue:

```
updated_at (defaultNow)  = 2026-10-21 00:01:40   ← hora local de la sesión
fresh  (Date de la app)  = 2026-10-21 05:01:41   ← UTC
```

La comparación `updated_at > fresh` **siempre daba falso**. Symptoms:

- `GET /api/live` devolvía **0 emisores** aunque existieran filas válidas →
  el mapa de "Servicios en vivo" nunca mostraba nada.
- El filtro de "transmisión activa" del ping de dispositivo **no encontraba**
  la transmisión anterior → **cada ping creaba una duplicada**.

**Corrección (dos partes, ambas necesarias).**

1. `lib/db/src/index.ts`: la sesión de Postgres se fija en UTC
   (`options: "-c timezone=UTC"`), lo que alinea `defaultNow()` con Drizzle.
2. `artifacts/api-server/src/lib/timezone.ts`: `process.env.TZ = "UTC"` al
   arrancar, lo que alinea el parámetro `Date` en SQL crudo. El módulo se
   importa como **primer** import de `app.ts` e `index.ts`.

**Prueba de regresión.** `src/__tests__/db-timezone.test.ts` verifica que la
sesión está en UTC y que `defaultNow()` y un `Date` de la app son
comparables. Sin el arreglo, los 4 tests de `live-providers.test.ts` fallan.

**Alcance del riesgo.** En producción (Neon) la sesión ya está en UTC, por eso
el bug no se había manifiesto; pero cualquier despliegue sobre un Postgres con
otra zona horaria rompía el módulo por completo.

### 4.3 🟠 Territorio corrupto en usuarios y reportes

**Causa raíz.** `users` y `reports` guardan `district`, `province` y
`department` como columnas derivadas, pero:

- `POST /auth/register` rellenaba solo `district` (del body) → `province` y
  `department` caían a los valores por defecto del esquema
  (`"Chanchamayo"` / `"Junín"`).
- `POST /reports` rellenaba solo `district` → igual.
- `POST /users/viewers` leía `authUser.province` / `authUser.department`
  **del JWT**, que nunca los llevaba → siempre `undefined` → mismos valores
  por defecto.

Consecuencia: **todo usuario, reporte y visor creado fuera de Chanchamayo/Junín
quedaba con la provincia y el departamento equivocados**, y el nombre del
distrito podía no cuadrar con su `districtId`.

**Corrección.** Nuevo helper `lib/district.ts` (`getDistrictTerritory`) que
resuelve el territorio desde el catálogo `districts` (fuente de verdad). Se
aplica en registro, creación de reportes, creación de visores y en el reporte
espejo de las alertas de pánico.

### 4.4 🟠 Campos del JWT que nunca existieron

Al tipar `req.jwtUser` aparecieron tres **bugs latentes** que el `as any`
ocultaba:

| Código                          | Problema                                    | Efecto real                                                                                                                                                                                                |
| ------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reports.ts` (resolver reporte) | `user?.name`                                | El JWT solo lleva `{sub,email,role,district,districtId}` → `name` era siempre `undefined` → el reporte quedaba firmado como "— Administrador municipal" en vez del nombre del funcionario que lo resolvió. |
| `messages.ts`                   | `user?.name`                                | Rama muerta: el nombre salía siempre de la BD, pero el fallback nunca funcionaba.                                                                                                                          |
| `users.ts` (crear visor)        | `authUser.province` / `authUser.department` | -properties inexistentes → valores por defecto (ver §4.3).                                                                                                                                                 |

**Corrección.** `requireAuth` ahora carga `name` y `displayName` desde la ficha
del usuario y los adjunta a `req.jwtUser` (los claims del token no los
llevan, así que se leen de la BD para que el dato mostrado sea el vigente).

### 4.5 🟠 Tipado de `req.jwtUser` (82 `as any` → 0)

Se añadió la augmentación del namespace global `Express.Request`
(`src/types/express.d.ts`) y el tipo `JwtUser` (`src/lib/authTypes.ts`), más
el helper `currentUser(req)` para las rutas que pasan por `requireAuth`.

Consecuencia secundaria beneficiosa: **el compilador destapó los bugs de
§4.4**, que con `as any` no se veían.

### 4.6 🟠 Dependencias vulnerables

| Métrica                | Antes | Después |
| ---------------------- | ----: | ------: |
| Críticas (total)       |    15 |   **0** |
| Altas (total)          |    51 |   **0** |
| Críticas (producción)  |     1 |   **0** |
| Altas (producción)     |    33 |   **0** |
| Moderadas (producción) |    23 |       4 |
| Bajas (producción)     |     2 |       1 |

La crítica de producción era `proxy-addr` (versión < 2.0.8): confunde las
direcciones IPv4 mapeadas en IPv6 y permite **suplantar la IP real**. Como el
rate limit de login se calcula con `ipKeyGenerator(req.ip)`, un atacante
podía **evadir el bloqueo por intentos** y forzar contraseñas a la fuerza.

Correcciones aplicadas: `proxy-addr@^2.0.8`, `nodemailer@^10.0.6` (DoS
quadrático en el parser de direcciones con las direcciones de contacto que
envía la app), `js-yaml`, `fast-uri`, `ip-address`, `postcss`, `nanoid`,
`fast-xml-parser`, `browserslist`, `source-map-js`, `vite`, `@grpc/grpc-js`,
`@fastify/busboy`, `brace-expansion`, `undici`, `tar`, `markdown-it`,
`@xmldom/xmldom`, `@capacitor/*@^7.6.9`, `orval@^8.22.0`, `vitest@^4.1.12`
(vitest 4 elimina la dependencia vulnerable `tinypool`).

Los 6 avisos moderados y 1 bajo restantes son transitorios, no tienen ruta de
explotación en el contexto de esta app y están documentados en el registro de
riesgos.

### 4.7 🟠 CI — el gate no cubría el frontend ni las dependencias

`ci.yml` solo comprobaba el tipo y el formato del backend. El frontend podía
llegar a producción con errores de tipos, sin tests y sin formatear.

**Corrección.** Workflow reescrito con: job de instalación reproducible
(comprueba `--frozen-lockfile`), Prettier sobre backend **y** frontend,
`pnpm audit --prod --audit-level high` como gate bloqueante + informe completo
como artefacto, `pnpm run typecheck` (monorepo completo), tests del frontend,
tests de integración contra Postgres real, `permissions: contents: read`,
`concurrency` con cancelación y build sin `|| true` (antes un fallo de las
librerías compartidas quedaba enmascarado).

### 4.8 🟡 Portabilidad — Windows

| Problema                                    | Causa                                                                                             | Corrección                                                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install` falla en Windows             | `preinstall` con `sh -c`                                                                          | `tools/enforce-pnpm.mjs` (solo Node, cross-platform)                                                                                                                  |
| `vitest`/`vite` no arrancan en Windows      | Los overrides excluían el binario nativo de Windows (`rollup>@rollup/rollup-win32-x64-msvc: '-'`) | `supportedArchitectures: {os: [current], cpu: [current]}` en `pnpm-workspace.yaml`: mismo resultado (instalación liviana) sin romper ningún SO. 1266 → 1069 paquetes. |
| `prettier --check` siempre falla en Windows | No había `.prettierrc`; prettier espera LF y el checkout de Windows da CRLF                       | `.prettierrc.json` con `endOfLine: "auto"`                                                                                                                            |

### 4.9 🟡 CSP y CORS

- **CSP**: `scriptSrc` incluía `'unsafe-inline'` en producción sin ningún
  script inline en el HTML compilado (verificado sobre `dist/public/index.html`).
  Eliminado; se añaden `frameAncestors: ["'none'"]` y `formAction: ["'self'"]`.
- **CORS**: en producción, si faltaba `CORS_ORIGIN`, se admitían los orígenes
  de desarrollo `http://localhost:5173` y `http://localhost:3000`. Ahora, en
  producción solo se admiten los orígenes de Capacitor (los que necesita el
  APK) más los configurados; si falta `CORS_ORIGIN` se avisa en el log.
  Test de regresión añadido en `cors.test.ts`.

### 4.10 🟡 Fiabilidad de la suite de tests

Los tests de integración levantan la app real contra Postgres real y hacen
bcrypt (10 rondas) por usuario. Con el paralelismo por defecto de Vitest
(una worker por núcleo) los `beforeAll` superaban los 15 s y **7 suites
fallaban de forma intermitente**.

**Corrección.** `maxWorkers: 3` y `hookTimeout`/`testTimeout` de 30 s en
`vitest.config.ts`, con el motivo documentado en el propio archivo.

---

## 5. Resultados de la verificación (post-corrección)

| Verificación                                                     | Resultado                                       |
| ---------------------------------------------------------------- | ----------------------------------------------- |
| `pnpm install --frozen-lockfile`                                 | ✅ exit 0                                       |
| `pnpm run typecheck` (libs + api-server + frontend)              | ✅ exit 0                                       |
| `pnpm exec prettier --check` (backend + frontend + libs + tools) | ✅ "All matched files use Prettier code style!" |
| Tests backend (Postgres 17 real)                                 | ✅ **26/26 suites · 173 pasan · 1 skip**        |
| Tests frontend                                                   | ✅ **4/4 suites · 17 pasan**                    |
| `pnpm --filter @workspace/api-server run build`                  | ✅ exit 0                                       |
| `pnpm --filter @workspace/radar-vecinal run build`               | ✅ exit 0 (PWA: 44 entradas en precache)        |
| `pnpm audit --prod --audit-level high`                           | ✅ exit 0 (0 críticas, 0 altas)                 |
| `pnpm peers check`                                               | ✅ "No peer dependency issues found"            |

### Tamaño del bundle (frontend)

| Chunk                   |    Tamaño |      gzip |
| ----------------------- | --------: | --------: |
| `vendor-charts`         | 393.09 kB | 107.88 kB |
| `vendor-react`          | 185.84 kB |  58.60 kB |
| `vendor-maps` (Leaflet) | 154.62 kB |  45.07 kB |
| `vendor-motion`         | 125.39 kB |  41.29 kB |
| `index` (app)           | 287.23 kB |  82.67 kB |
| `vendor-radix`          |  58.16 kB |  20.33 kB |
| `vendor-query`          |  35.74 kB |  10.57 kB |
| `vendor-icons`          |  30.79 kB |  10.51 kB |
| CSS principal           | 213.31 kB |  31.94 kB |

Code-splitting por vendor ya existente: un cambio de código de la app ya no
invalida ~660 kB de vendors.

---

## 6. Limitaciones de esta iteración

1. **Sin credenciales de producción**: no se ejecutó nada contra Neon, Cloudinary,
   Firebase, SMTP ni Render. Los hallazgos de seguridad son de análisis
   estático + pruebas con Postgres local equivalente.
2. **Sin despliegue**: los cambios de CI no se han ejecutado en GitHub Actions;
   se validó localmente el equivalente de cada paso.
3. **Sin Lighthouse / axe**: no se midió LCP/INP/CLS ni contraste WCAG de forma
   automatizada. Queda para el ciclo 002.
4. **Métricas de rendimiento de API**: no se hizo pruebas de carga; falta
   definir los objetivos de latencia p95 por endpoint.
5. **E2E de navegador**: no hay Playwright/Cypress; los recorridos Currently
   citizen se validan a nivel de API (supertest), no de interfaz.

---

## 7. Pendientes priorizados para el ciclo 002

| #   | Ítem                                                                                                                                                                                                                                        | Severidad | Impacto esperado                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------- |
| 1   | Integrar la rama `claude/production-readiness-audit-3pgip6` (recuperación de contraseña + "Mis reportes") **corregida**: hoy usa `fetch("/api/...")` desnudo, que en el APK nativo (origen `https://localhost`) nunca sale del dispositivo. | 🔴        | Alto — recupera UX-AU2/UX-AU4 sin introducir un fallo silencioso en Android |
| 2   | Migrar las 30 tablas a `timestamp with time zone` (el arreglo actual alinea las tres vías, pero el esquema sigue siendo ambiguo)                                                                                                            | 🟠        | Alto — elimina la clase de bug de raíz                                      |
| 3   | Añadir `GET /reports/mine` y los endpoints de auth al contrato OpenAPI                                                                                                                                                                      | 🟡        | Medio — la deriva de contrato (F4) sigue abierta                            |
| 4   | E2E de navegador con Playwright (recorrido ciudadano completo)                                                                                                                                                                              | 🟡        | Medio — hoy solo hay cobertura de API                                       |
| 5   | Lighthouse CI + auditoría axe de accesibilidad                                                                                                                                                                                              | 🟡        | Medio — cierra AC5/UX-AC5 con evidencia                                     |
| 6   | Eliminar la duplicación de `requireSuperAdmin` en `routes/admin.ts` (guard local con `any` frente al de `routes/auth.ts`)                                                                                                                   | 🔵        | Bajo                                                                        |
| 7   | Extraer los 82 `as any` restantes del frontend y de `lib/`                                                                                                                                                                                  | 🔵        | Bajo                                                                        |
| 8   | Profiling de consultas lentas con `EXPLAIN ANALYZE` sobre datos realistas                                                                                                                                                                   | 🔵        | Bajo                                                                        |

---

_Documento generado durante el ciclo 001 de la auditoría continua._
_Siguiente: `ITERATION-002.md`._
