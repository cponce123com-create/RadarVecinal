# Continuidad — Auditoría continua

> Lee este archivo primero si retomas el trabajo. No vuelvas a empezar desde cero.

**Actualizado:** 2026-10-21 · **Ciclo actual:** 001 (cerrado) · **Rama:** `feature/audit-cycle-001`

---

## 1. Estado

| Elemento                                     | Valor                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Rama base                                    | `main` @ `cf366234`                                                                               |
| Rama de trabajo                              | `feature/audit-cycle-001`                                                                         |
| Iteraciones completadas                      | **1**                                                                                             |
| Objetivo global                              | ≥ 9.8/10 en 25 áreas                                                                              |
| Puntuación global estimada tras el ciclo 001 | **8.56 / 10** (ver `QUALITY_SCORECARD.md`)                                                        |
| Última verificación                          | ✅ typecheck · ✅ 26/26 suites backend · ✅ 4/4 frontend · ✅ build · ✅ audit 0 críticas/0 altas |

---

## 2. Puntuaciones

Las 25 áreas están en `QUALITY_SCORECARD.md`. Resumen del ciclo 001:

| Área                              | Antes | Después |
| --------------------------------- | ----: | ------: |
| Arquitectura general              |   8.0 |     8.4 |
| Organización del código           |   8.2 |     8.8 |
| Backend y API                     |   8.1 |     8.9 |
| Frontend                          |   8.0 |     8.5 |
| Diseño UI/UX                      |   8.5 |     8.5 |
| Panel administrativo              |   8.0 |     8.0 |
| Autenticación y autorización      |   7.8 |     8.7 |
| Ciberseguridad                    |   7.5 |     9.0 |
| Base de datos                     |   7.6 |     9.0 |
| Aislamiento entre municipalidades |   8.5 |     8.5 |
| Reportes ciudadanos               |   8.3 |     8.6 |
| Geolocalización y mapas           |   8.4 |     8.4 |
| Alertas y emergencias             |   8.0 |     9.0 |
| Personas desaparecidas            |   8.2 |     8.2 |
| Notificaciones                    |   8.0 |     8.0 |
| Android y PWA                     |   7.5 |     8.3 |
| Rendimiento                       |   8.2 |     8.4 |
| Escalabilidad                     |   8.0 |     8.5 |
| Accesibilidad                     |   7.8 |     8.0 |
| SEO y metadatos                   |   9.0 |     9.0 |
| Pruebas automatizadas             |   7.0 |     8.6 |
| CI/CD y despliegue                |   5.0 |     8.8 |
| Documentación                     |   8.0 |     9.0 |
| Privacidad y protección de datos  |   8.0 |     8.4 |
| Observabilidad y mantenimiento    |   7.8 |     8.4 |

---

## 3. Cambios del ciclo 001

### Correcciones de comportamiento (bugs reales)

| Archivo                                                 | Cambio                                                                                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/db/src/index.ts`                                   | Sesión de Postgres en UTC (`options: "-c timezone=UTC"`). **Arregla que "Servicios en vivo" no mostrara emisores y duplicara transmisiones.**         |
| `artifacts/api-server/src/lib/timezone.ts` _(nuevo)_    | `process.env.TZ = "UTC"`; alinea el `Date` en SQL crudo con el resto de vías.                                                                         |
| `artifacts/api-server/src/app.ts`                       | Import de `timezone` primero; CSP sin `'unsafe-inline'` en `scriptSrc`; `frameAncestors`/`formAction`; CORS sin fallback de desarrollo en producción. |
| `artifacts/api-server/src/index.ts`                     | Import de `timezone` primero.                                                                                                                         |
| `artifacts/api-server/src/lib/district.ts` _(nuevo)_    | `getDistrictTerritory()`: resuelve distrito/provincia/departamento desde el catálogo.                                                                 |
| `artifacts/api-server/src/routes/auth.ts`               | Territorio derivado del catálogo en el registro; `requireAuth` adjunta `name`/`displayName`; `currentUser()`; `optionalAuth` tipado.                  |
| `artifacts/api-server/src/routes/reports.ts`            | Territorio derivado del catálogo al crear el reporte.                                                                                                 |
| `artifacts/api-server/src/routes/alerts.ts`             | Territorio del reporte espejo de la alerta de pánico.                                                                                                 |
| `artifacts/api-server/src/routes/users.ts`              | Territorio del catálogo al crear un visor (antes leía `province`/`department` del JWT, que no existen).                                               |
| `artifacts/api-server/src/types/express.d.ts` _(nuevo)_ | Augmentación de `Express.Request` con `jwtUser`.                                                                                                      |
| `artifacts/api-server/src/lib/authTypes.ts` _(nuevo)_   | Tipo `JwtUser`.                                                                                                                                       |
| `artifacts/api-server/src/vitest.config.ts`             | `maxWorkers: 3`, timeouts de 30 s.                                                                                                                    |

### Infraestructura

| Archivo                                | Cambio                                                                                                                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm-lock.yaml`                       | Regenerado con pnpm 11.9.0 (arregla el `LOCKFILE_CONFIG_MISMATCH` que rompía **toda** la CI).                                                                                                  |
| `pnpm-workspace.yaml`                  | `supportedArchitectures` en vez de ~80 overrides por plataforma; overrides de seguridad; se elimina el override `ioredis` obsoleto.                                                            |
| `package.json`                         | `preinstall` cross-platform (`tools/enforce-pnpm.mjs`); pnpm 11.9.0.                                                                                                                           |
| `tools/enforce-pnpm.mjs` _(nuevo)_     | Sustituye al `sh -c` que rompía Windows.                                                                                                                                                       |
| `.prettierrc.json` _(nuevo)_           | `endOfLine: "auto"` (el gate de formato era inalcanzable en Windows).                                                                                                                          |
| `.github/workflows/ci.yml`             | Reescrito: instalación reproducible, formato de backend **y** frontend, auditoría de deps bloqueante, typecheck del monorepo, tests de frontend, tests de integración, hardening del workflow. |
| `artifacts/api-server/package.json`    | `nodemailer@^10.0.6`, `openapi-types`, `vitest@^4.1.12`.                                                                                                                                       |
| `artifacts/radar-vecinal/package.json` | `@capacitor/push-notifications@^7.0.7`, `vitest@^4.1.12`.                                                                                                                                      |
| `lib/api-spec/package.json`            | `orval@^8.22.0`.                                                                                                                                                                               |
| `package.json` (root)                  | `@capacitor/*@^7.6.9`.                                                                                                                                                                         |

### Tests

| Archivo                                                 | Cambio                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| `src/__tests__/db-timezone.test.ts` _(nuevo)_           | Invariante de zona horaria de la sesión.                     |
| `src/__tests__/cors.test.ts`                            | Test de que producción no admite los orígenes de desarrollo. |
| `src/__tests__/maintenance.test.ts`                     | Cadena de mocks reescrita (prettier era inestable con ella). |
| `src/__tests__/auth.test.ts`, `middleware-auth.test.ts` | Tipado del `jwtUser`.                                        |

### Formato

Se formatearon con Prettier los **79 archivos del frontend** que nunca se
habían formateado (el gate de CI solo cubría el backend). Cambio 100%
cosmético, en commit propio.

---

## 4. Pruebas pendientes

- [ ] E2E de navegador (Playwright): registro → login → reporte con foto →
      recepción administrativa → cambio de estado → cierre de sesión.
- [ ] Pruebas de carga por endpoint con objetivos de latencia p95 definidos.
- [ ] Lighthouse CI (Performance / Accessibility / Best Practices / SEO).
- [ ] Auditoría de contraste con axe (cierra AC5 / UX-AC5).
- [ ] Validación en dispositivo Android real (tablas admin, PWA, push).
- [ ] Verificación de que `pnpm run codegen` (orval) no rompe el contrato
      tras el salto de orval 8.19 → 8.22+.

---

## 5. Problemas pendientes (abiertos)

| #   | Problema                                                                                                                                                                                                                                                                                                                 | Severidad | Dónde                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | --------------------------------------------- |
| 1   | La rama `claude/production-readiness-audit-3pgip6` usa `fetch("/api/...")` desnudo: en el APK nativo (origen `https://localhost`) la petición no sale del dispositivo y la UI muestra "Revisa tu correo" sin enviar nada. `MyReports` además lee el token a mano del `localStorage` (sin URL base ni refresco ante 401). | 🔴        | Rama `claude/...`, pendiente de rebase        |
| 2   | La misma rama está 15 commits atrás: su diff **revierte** la protección `SUPER_ADMIN_CLAIM_SECRET` y el refresco de token de `main`. **No mergear tal cual** — hacer rebase de `531dac12`.                                                                                                                               | 🔴        | Git                                           |
| 3   | El esquema usa `timestamp without time zone` en las 30 tablas. El arreglo actual alinea las tres vías de escritura, pero el esquema sigue siendo ambiguo.                                                                                                                                                                | 🟠        | `lib/db/src/schema/reports.ts`                |
| 4   | `GET /reports/mine` y los endpoints de auth no están en el contrato OpenAPI (deriva de contrato, F4 de la auditoría previa).                                                                                                                                                                                             | 🟡        | `lib/api-spec/openapi.yaml`                   |
| 5   | `routes/admin.ts` define un `requireSuperAdmin` local con `any`, duplicando el de `routes/auth.ts`.                                                                                                                                                                                                                      | 🔵        | `artifacts/api-server/src/routes/admin.ts:34` |
| 6   | 6 avisos moderados y 1 bajo de dependencias, todos transitorios y sin ruta de explotación en el contexto de la app.                                                                                                                                                                                                      | 🔵        | `pnpm audit`                                  |
| 7   | El docs OpenAPI no cubre ~60% de los endpoints reales (solo 24 paths frente a 20 ficheros de rutas).                                                                                                                                                                                                                     | 🟡        | `lib/api-spec/openapi.yaml`                   |
| 8   | Sin objetivos de latencia p95 por endpoint ni pruebas de carga.                                                                                                                                                                                                                                                          | 🟡        | —                                             |

---

## 6. Próxima tarea

**Ciclo 002 — foco: integración de la rama de recuperación de contraseña +
mapa y alertas.**

1. Rebase de `531dac12` sobre `main` en una rama nueva.
2. Sustituir el `fetch` desnudo por `customFetch` en `PasswordRecovery`,
   `ResetPassword` y `MyReports` (corrige el fallo silencioso en Android).
3. Añadir `GET /reports/mine`, `/auth/forgot-password` y `/auth/reset-password`
   al contrato OpenAPI y regenerar.
4. Migración a `timestamp with time zone` con script reversible y prueba.
5. Playwright E2E del recorrido ciudadano.

---

## 7. Comandos necesarios

```bash
# Instalación (usar SIEMPRE corepack: el repo fija pnpm 11.9.0)
corepack pnpm install --frozen-lockfile

# Verificación completa
corepack pnpm run typecheck
corepack pnpm exec prettier --check "artifacts/api-server/src/**/*.ts" \
  "artifacts/radar-vecinal/src/**/*.{ts,tsx}" \
  "artifacts/radar-vecinal/__tests__/**/*.{ts,tsx}" \
  "lib/**/*.ts" "tools/*.mjs" --no-error-on-unmatched-pattern
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/radar-vecinal run test
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/radar-vecinal run build
corepack pnpm audit --prod --audit-level high
corepack pnpm peers check
```

### Base de datos local para los tests

El Postgres 17 local (`C:\Program Files\PostgreSQL\17`) sirve con el usuario
`postgres`. Base de datos de test dedicada: **`radarvecinal_test`** (creada
para esta auditoría; no contiene datos de otros proyectos).

```bash
# Recrear la base de test desde cero
PGPASSWORD=<password> psql -U postgres -h 127.0.0.1 -p 5432 -c "DROP DATABASE radarvecinal_test;"
PGPASSWORD=<password> psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE radarvecinal_test;"

# Aplicar el esquema
$env:DATABASE_URL="postgresql://postgres:<password>@127.0.0.1:5432/radarvecinal_test"
corepack pnpm --filter @workspace/db run push

# Ejecutar los tests con BD
$env:DATABASE_URL="postgresql://postgres:<password>@127.0.0.1:5432/radarvecinal_test"
$env:JWT_SECRET="test-secret-for-audit-cycle-001-min32"
corepack pnpm --filter @workspace/api-server run test
```

> `JWT_SECRET` debe tener **al menos 32 caracteres**: el servidor lo exige al
> arrancar (`throw` si falta).

---

## 8. Bloqueos

| Bloqueo                                                                   | Impacto                                                 | Cómo desbloquearlo                                                       |
| ------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Sin credenciales de producción (Neon, Cloudinary, Firebase, SMTP, Render) | No se puede validar en el entorno real                  | Pedir acceso o un entorno de staging                                     |
| Sin `gh` (GitHub CLI)                                                     | No se pueden abrir PRs desde la CLI                     | `winget install GitHub.cli` o usar la web                                |
| Sin Lighthouse/Playwright instalados                                      | No hay métricas de rendimiento ni E2E                   | `corepack pnpm add -D -w @playwright/test` (y descargar los navegadores) |
| `pnpm install` en Windows requiere `corepack pnpm`                        | El `pnpm` global es 9.15.4 y no soporta el lockfile v11 | Usar `corepack pnpm` o actualizar el global                              |
| `sh` no existe en el PATH de Windows                                      | Los scripts con `sh -c` fallan                          | Ya resuelto para `preinstall`; revisar cualquier script nuevo            |

---

## 9. Riesgos conocidos

1. **El arreglo de zona horaria alinea las tres vías, pero el esquema sigue
   usando `timestamp without time zone`.** Si alguien configura la sesión de
   Postgres fuera de UTC por fuera del pool (p. ej. un `ALTER DATABASE`), el
   bug vuelve. El test `db-timezone.test.ts` lo detecta.
2. **`process.env.TZ = "UTC"` debe ejecutarse antes del primer `Date`.** Está
   en el primer import de `app.ts` e `index.ts`; si alguien lo mueve, hay que
   volver a comprobarlo.
3. **El salto de orval (8.19 → 8.22+) puede cambiar el código generado.** El
   `codegen` no se ejecuta en CI, así que el contrato commiteado no se
   regenera solo; hay que revisarlo a mano la próxima vez que se use.
4. **El salto de vitest 3 → 4 cambia el comportamiento de `mockReset`.** La
   suite pasa, pero conviene vigilarla al añadir mocks nuevos.
5. **El formateo masivo del frontend** (79 archivos) ensucia el historial de
   `git blame`. Está en un commit propio para poder revertirlo sin arrastrar
   los cambios funcionales.

---

_Última actualización: 2026-10-21, tras el cierre del ciclo 001._
