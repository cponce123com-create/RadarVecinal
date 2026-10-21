# Continuidad — Auditoría continua

> Lee este archivo primero si retomas el trabajo. No vuelvas a empezar desde cero.

**Actualizado:** 2026-10-21 · **Ciclo actual:** 002 (cerrado) · **Rama:** `feature/audit-cycle-002`

---

## 1. Estado

| Elemento                            | Valor                                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Rama base                           | `main` @ `cf366234` (sin tocar)                                                                                   |
| Rama del ciclo 001                  | `feature/audit-cycle-001` @ `4e02cbe1` — PR #35 abierto, **no fusionado**                                         |
| Rama del ciclo 002                  | `feature/audit-cycle-002` — PR #36, apilada sobre la del 001                                                      |
| Iteraciones completadas             | **2**                                                                                                             |
| Objetivo global                     | ≥ 9.8/10 en 25 áreas                                                                                              |
| Puntuación global tras el ciclo 002 | **8.67 / 10** (ver `QUALITY_SCORECARD.md`)                                                                        |
| Última verificación                 | ✅ typecheck · ✅ 28/28 suites backend (180) · ✅ 5/5 frontend (21) · ✅ builds · ✅ 0 críticas/altas · ✅ CI 9/9 |

> **No fusionar sin autorización.** `render.yaml` tiene `branch: main`, así que
> el merge de cualquiera de los dos PR dispara un despliegue en Render.

---

## 2. Puntuaciones

| Área                              | Ciclo 001 | Ciclo 002 |
| --------------------------------- | --------: | --------: |
| Arquitectura general              |       8.4 |       8.5 |
| Organización del código           |       8.8 |       8.9 |
| Backend y API                     |       8.9 |       9.0 |
| Frontend                          |       8.5 |       8.8 |
| Diseño UI/UX                      |       8.5 |       8.5 |
| Panel administrativo              |       8.0 |       8.0 |
| Autenticación y autorización      |       8.7 |       9.2 |
| Ciberseguridad                    |       9.0 |       9.1 |
| Base de datos                     |       9.0 |       9.4 |
| Aislamiento entre municipalidades |       8.5 |       8.5 |
| Reportes ciudadanos               |       8.6 |       8.8 |
| Geolocalización y mapas           |       8.4 |       8.4 |
| Alertas y emergencias             |       9.0 |       9.0 |
| Personas desaparecidas            |       8.2 |       8.2 |
| Notificaciones                    |       8.0 |       8.0 |
| Android y PWA                     |       8.3 |       8.4 |
| Rendimiento                       |       8.4 |       8.4 |
| Escalabilidad                     |       8.5 |       8.5 |
| Accesibilidad                     |       8.0 |       8.0 |
| SEO y metadatos                   |       9.0 |       9.0 |
| Pruebas automatizadas             |       8.6 |       8.8 |
| CI/CD y despliegue                |       8.8 |       9.2 |
| Documentación                     |       9.0 |       9.1 |
| Privacidad y protección de datos  |       8.4 |       8.6 |
| Observabilidad y mantenimiento    |       8.4 |       8.5 |
| **GLOBAL**                        |  **8.56** |  **8.67** |

---

## 3. Qué se hizo en el ciclo 002

1. **Recuperación de contraseña + "Mis reportes"** (`c4f408d1`), con cuatro
   correcciones de seguridad que el diff original no traía:
   - el token de reset ya no sirve como token de sesión (`purpose: "access"`);
   - límite por IP **y** por correo destino en `forgot-password` (antes rotar el
     correo esquivaba el límite);
   - el envío del correo no se espera (sin oráculo de tiempo);
   - la URL de reset no se escribe en logs de producción.
2. **`customFetch` en las tres pantallas nuevas** (`55afd23f`) y error visible
   ante fallo de red o 429 (`3b69725a`).
3. **OpenAPI** de los tres endpoints + cliente regenerado (`f1d611d9`). El
   bloqueador de orval quedó documentado: zod v3, react-query v5 y
   `dom.iterable`.
4. **`timestamptz`** en las 51 columnas, con migración idempotente y revert
   (`89819ee6`).
5. **Deriva esquema ↔ migraciones** (`40471305`): `user_consents`, 5 columnas
   `NOT NULL` y las 3 de cobranding.
6. **CI y despliegue** (`e6434044`, `d3ea8190`): PRs apilados verificados, job de
   migraciones desde cero, `run_all_migrations.js` con fail-fast real por
   SQLSTATE, `--frozen-lockfile` en producción.
7. **Preflight del runner de Drizzle** + `tsx` declarado: `pnpm migrate` ya no
   puede decir "success" habiendo aplicado 3 de 37.

El detalle con evidencia está en `ITERATION-002.md`.

---

## 4. Pruebas pendientes

- [ ] E2E de navegador (Playwright): registro → login → reporte con foto →
      recepción administrativa → cambio de estado → cierre de sesión.
- [ ] E2E del recorrido de recuperación (el token de reset no debe abrir sesión).
- [ ] Pruebas de carga por endpoint con objetivos de latencia p95 definidos.
- [ ] Lighthouse CI (Performance / Accessibility / Best Practices / SEO).
- [ ] Auditoría de contraste con axe (cierra AC5 / UX-AC5).
- [ ] Validación en dispositivo Android real (tablas admin, PWA, push).
- [ ] Cobertura medida (`vitest --coverage`) y umbral mínimo.
- [ ] Tests de contrato generados desde OpenAPI.

---

## 5. Problemas pendientes (abiertos)

| #   | Problema                                                                                                                                                                | Severidad | Dónde                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------- |
| 1   | `drizzle-kit push` borra los 32 índices que las migraciones crean y el esquema no declara. Un `push` contra una base real degradaría el rendimiento en silencio (R-19). | 🟠        | `lib/db/src/schema/*`                    |
| 2   | El token de sesión sigue en `localStorage` (XSS) y sin cookies HttpOnly/CSRF (R-05).                                                                                    | 🟠        | `artifacts/radar-vecinal/src/contexts`   |
| 3   | El aislamiento multi-tenant depende de que cada ruta llame a los helpers (R-06).                                                                                        | 🟠        | `artifacts/api-server/src/routes`        |
| 4   | `0034` toma un lock por tabla al convertir a `timestamptz`; no está medido con el volumen de producción (R-18).                                                         | 🟡        | `lib/db/migrations/0034_timestamptz.sql` |
| 5   | Sin E2E de navegador (R-09).                                                                                                                                            | 🟡        | —                                        |
| 6   | Sin métricas de rendimiento ni objetivos p95 (R-10).                                                                                                                    | 🟡        | —                                        |
| 7   | Accesibilidad sin evidencia objetiva (R-11).                                                                                                                            | 🟡        | —                                        |
| 8   | `/api-docs` se sirve en producción (R-17).                                                                                                                              | 🟡        | `artifacts/api-server/src/app.ts`        |
| 9   | El OpenAPI cubre ~45 % de los endpoints (R-07, mitigado).                                                                                                               | 🟡        | `lib/api-spec/openapi.yaml`              |
| 10  | 4 avisos moderados y 1 bajo en dependencias de producción (R-14).                                                                                                       | 🔵        | `pnpm audit`                             |
| 11  | `routes/admin.ts` define un `requireSuperAdmin` local con `any`, duplicando el de `routes/auth.ts`.                                                                     | 🔵        | `routes/admin.ts:34`                     |
| 12  | El journal de Drizzle sigue incompleto (3 de 37); el preflight lo detecta, pero no lo arregla (R-20).                                                                   | 🔵        | `lib/db/migrations/meta/_journal.json`   |

---

## 6. Próxima tarea

**Ciclo 003 — foco: cerrar las altas restantes y empezar a medir.**

Orden propuesto:

1. **R-19**: declarar los 32 índices en el esquema Drizzle (`index()` con los
   mismos nombres) y comprobar que `push` sobre una base migrada dice
   `No changes detected`. Si es inviable, añadir un guardia que impida `push`
   sobre una base con tablas.
2. **R-05**: migrar la sesión a cookies HttpOnly + CSRF (afecta a web y APK;
   requiere coordinar con Capacitor).
3. **R-18**: medir el tiempo de `0034` con un volumen representativo; si excede
   lo aceptable, convertir por lotes.
4. **Cobertura**: instalar `@vitest/coverage-v8`, medir y fijar un umbral.
5. **E2E**: Playwright para los flujos críticos.
6. **R-14**: overrides de `qs`, `uuid`, `protobufjs` con verificación completa.
7. **R-17**: montar `/api-docs` solo fuera de producción.

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
  "lib/**/*.ts" "tools/*.mjs" "run_all_migrations.js" --no-error-on-unmatched-pattern
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/radar-vecinal run test
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/radar-vecinal run build
corepack pnpm audit --prod --audit-level high
```

### Base de datos local para los tests

Postgres 17 local (`C:\Program Files\PostgreSQL\17`), usuario `postgres`.

```bash
# Base de test (esquema por push)
PGPASSWORD=<password> psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE radarvecinal_test;"
$env:DATABASE_URL="postgresql://postgres:<password>@127.0.0.1:5432/radarvecinal_test"
corepack pnpm --filter @workspace/db run push

# Base para probar SOLO la cadena de migraciones (camino de producción)
PGPASSWORD=<password> psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE radarvecinal_mig3;"
$env:DATABASE_URL="postgresql://postgres:<password>@127.0.0.1:5432/radarvecinal_mig3"
node run_all_migrations.js

# Tests con BD
$env:DATABASE_URL="postgresql://postgres:<password>@127.0.0.1:5432/radarvecinal_test"
$env:JWT_SECRET="test-secret-for-audit-cycle-001-min32"
corepack pnpm --filter @workspace/api-server run test
```

> `JWT_SECRET` debe tener **al menos 32 caracteres**: el servidor lo exige al
> arrancar (`throw` si falta).

> En PowerShell, `psql -c "SET ...; SELECT ..."` no devuelve el SELECT. Usar
> `$env:PGOPTIONS="-c timezone=..."` y una sentencia por `-c`.

---

## 8. Bloqueos

| Bloqueo                                                                   | Impacto                                             | Cómo desbloquearlo                                                       |
| ------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| Sin credenciales de producción (Neon, Cloudinary, Firebase, SMTP, Render) | No se puede validar en el entorno real              | Pedir acceso o un entorno de staging                                     |
| Sin `gh` (GitHub CLI)                                                     | Los PRs se abren por API REST con el token de `git` | `winget install GitHub.cli` o usar la web                                |
| Sin Lighthouse/Playwright instalados                                      | No hay métricas de rendimiento ni E2E               | `corepack pnpm add -D -w @playwright/test` (y descargar los navegadores) |
| `pnpm` global 9.15.4                                                      | No soporta el lockfile v11                          | Usar `corepack pnpm`                                                     |
| PowerShell 5.1 estropea el UTF-8 al hacer piping                          | Los scripts con acentos fallan al imprimir          | Escribir a archivo con `[System.IO.File]::ReadAllText(..., UTF8)`        |

---

## 9. Riesgos conocidos y decisiones

1. **`timestamptz` mantiene `TZ=UTC` como defensa en profundidad.** Ya no es la
   única protección, pero `CURRENT_DATE`/`date_trunc` y columnas legacy siguen
   dependiendo de la sesión.
2. **No fusionar los PRs sin autorización.** El merge dispara Render.
3. **`drizzle-kit push` no es el camino de producción.** Producción usa
   `run_all_migrations.js`; el CI usa `push` solo sobre base vacía. Con R-19
   abierto, nunca ejecutar `push` contra una base con datos.
4. **Las migraciones se reaplican enteras en cada despliegue.** Cualquier
   migración nueva tiene que ser idempotente (`IF NOT EXISTS`, `DO $$`, etc.).
5. **El fail-fast del runner depende de SQLSTATE.** Si se añade una migración que
   espera un error benigno distinto, hay que ampliar `BENIGN_CODES` en
   `run_all_migrations.js`; nunca comparar el texto.
6. **El cliente generado por orval cambió la cabecera** (`Generated by orval
v8.19.0` → `Generated by orval`) en ~50 archivos: es cosmético, no revertir a
   mano.

---

## 10. Punto exacto de continuación (handoff)

**Estado al guardar la sesión:** ciclo 002 cerrado, todo commiteado y empujado.

| Elemento             | Valor                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| Rama                 | `feature/audit-cycle-002` (origin, sin cambios locales)                  |
| HEAD (código)        | `26a82ead` · `fix(db): 0035 comprueba la FK por columna y no por nombre` |
| HEAD (documentación) | el commit que añade este apartado; no toca código                        |
| Base                 | `feature/audit-cycle-001` @ `4e02cbe1` (PR #35, sin fusionar)            |
| PR                   | #36, cuerpo actualizado, **no fusionar sin autorización**                |
| CI del código        | run `39600787424` en `26a82ead` → **9/9 jobs success**                   |
| `main`               | intacto en `cf366234`                                                    |
| Árbol de trabajo     | limpio tras commitear este documento                                     |

**Bases locales**

| Base                | Contenido                                                        | Estado                                         |
| ------------------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| `radarvecinal_test` | Esquema aplicado con `drizzle-kit push` + columnas de cobranding | Lista para tests                               |
| `radarvecinal_mig3` | Solo `run_all_migrations.js` (37 migraciones)                    | 29 tablas, 51 `timestamptz`, 1 FK, idempotente |
| `radarvecinal_mig`  | Migraciones + push (usada para comparar índices)                 | Desechable                                     |
| `radarvecinal_mig2` | Migraciones + push (comparación de `NOT NULL`)                   | Desechable                                     |

**Comprobaciones que ya están hechas y no hay que repetir**

- CI 9/9 en el HEAD, incluido el job `migrations`.
- Typecheck, Prettier, 28/180 backend, 5/21 frontend, ambos builds y
  `pnpm audit --prod --audit-level high` en verde.
- Cadena de migraciones desde cero e idempotente; epoch preservado.
- `drizzle-kit push` contra la base migrada: `No changes detected`.
- Preflight del journal de Drizzle: exit 1 con las 34 migraciones que faltan.

**Lo que queda para el siguiente ciclo (003)**

1. **R-19** (alta): declarar los 32 índices en el esquema o bloquear `push`
   sobre bases con datos. Es la primera tarea (3.1/3.2 en `WORK_PLAN.md`).
2. **R-06** (alta): middleware de aislamiento por defecto + test que recorra las
   rutas.
3. **R-18** (media): medir el lock de `0034` con volumen representativo.
4. Cobertura medida y Playwright E2E.
5. R-14 (4 moderados) y R-17 (`/api-docs` en producción).

**Si retomas y algo no cuadra**

```bash
git log --oneline -5          # HEAD debe ser 26a82ead o posterior
git status                    # debe estar limpio
corepack pnpm install --frozen-lockfile
corepack pnpm run typecheck
```

Si el CI del HEAD no aparece en verde, mirar el run `39600787424` y comparar con
el estado local antes de tocar nada.

---

_Última actualización: 2026-10-21, tras el cierre del ciclo 002._
