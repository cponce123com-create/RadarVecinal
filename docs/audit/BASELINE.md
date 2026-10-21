# Baseline — Radar Vecinal

> Línea base medida del proyecto antes/después del ciclo 001.
> Detalle completo en `ITERATION-001.md`. Resumen de métricas: `QUALITY_SCORECARD.md`.

**Fecha de medición:** 2026-10-21 · **Base:** `main@cf366234` · **Rama de trabajo:** `feature/audit-cycle-001`

---

## 1. Identificación del proyecto

| Campo             | Valor                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Nombre            | Radar Vecinal                                                                                                |
| Propósito         | Plataforma de seguridad ciudadana y reporte de incidencias para municipalidades del Perú                     |
| Licencia          | MIT                                                                                                          |
| Stack             | React 19 · Vite 7 · Tailwind 4 · Express 5 · Drizzle ORM · PostgreSQL (Neon) · Capacitor 7 · pnpm workspaces |
| Despliegue        | Render (web service + Neon Postgres) · APK Android vía Capacitor                                             |
| Idioma / i18n     | Español (Perú) — monolingüe                                                                                  |
| Base legal citada | Ley N.º 29733 (Protección de Datos Personales)                                                               |

---

## 2. Baseline funcional

| Flujo                      | Estado inicial             | Nota                                                                        |
| -------------------------- | -------------------------- | --------------------------------------------------------------------------- |
| Registro vecino            | ✅ funcional               | Territorio (provincia/departamento) **corrupto** fuera de Junín → corregido |
| Login / sesión             | ✅ funcional               | Refresh token de 30 días con hash SHA-256 en BD                             |
| Recuperación de contraseña | ❌ **no existía**          | Existe en la rama `claude/...`, pendiente de integrar y corregir            |
| Reportar incidente         | ✅ funcional               | Anonimato forzado en categorías sensibles; territorio corrupto → corregido  |
| Mapa y geolocalización     | ✅ funcional               | Teselas Esri sin clave; `LocationPicker` reutilizable                       |
| Alerta de pánico           | ✅ funcional               | **El mapa nunca mostraba emisiones** en BD no-UTC → corregido               |
| Persona desaparecida       | ✅ funcional               | `reported_by_id`, soft-delete con auditoría                                 |
| Servicios en vivo (rutas)  | ⚠️ **roto**                | Emisores invisibles + transmisiones duplicadas → corregido                  |
| Panel municipal            | ✅ funcional               | Tabs de reportes, usuarios, alertas, licencias, dispositivos, voz           |
| Notificaciones push        | ✅ funcional               | FCM, canales Android, avisos de proximidad con cooldown                     |
| Admin global (superadmin)  | ✅ funcional               | `SUPER_ADMIN_CLAIM_SECRET` fail-closed                                      |
| Telegram                   | ✅ funcional               | 1 bot, N canales por distrito                                               |
| Consulta RENIEC            | ✅ funcional               | Solo backoffice, 10/hora, auditado                                          |
| PDF de reportes            | ✅ funcional               | pdfkit                                                                      |
| PWA                        | ✅ funcional               | Service worker, 44 entradas precacheadas                                    |
| App Android                | ⚠️ **no verificable aquí** | Sin SDK ni dispositivo en el entorno                                        |

---

## 3. Baseline técnico

| Métrica                                      | Valor inicial                                                       |
| -------------------------------------------- | ------------------------------------------------------------------- |
| Líneas de código (sin `node_modules`/`dist`) | ≈ 29 971                                                            |
| Ficheros `.ts/.tsx`                          | 191 (36 backend, 84 frontend, 71 libs)                              |
| Tablas                                       | 30                                                                  |
| Migraciones                                  | 34                                                                  |
| Endpoints REST                               | ≈ 120 (20 ficheros de rutas)                                        |
| Paths en el contrato OpenAPI                 | 24 (**≈ 60 % del backend sin cubrir**)                              |
| Suites de test backend                       | 25 (18 pasaban, 7 con timeout intermitente)                         |
| Tests backend                                | 171 (163 pasaban, 4 rojos reales, 1 skip)                           |
| Suites de test frontend                      | 4                                                                   |
| Tests frontend                               | 17                                                                  |
| `as any` en backend                          | **82**                                                              |
| `as any` en frontend                         | ≈ 48                                                                |
| Archivos con `console.*`                     | 12 (eliminados del bundle por `esbuild.pure`)                       |
| `TODO`/`FIXME` sin ticket                    | 0                                                                   |
| Bundle principal (app)                       | 287.23 kB (82.67 kB gzip)                                           |
| Bundle CSS                                   | 213.31 kB (31.94 kB gzip)                                           |
| Chunk mayor                                  | `vendor-charts` 393.09 kB (recharts, carga solo en `/estadisticas`) |
| PWA precache                                 | 44 entradas / 3.723 MB                                              |
| Vulnerabilidades de dependencias             | 15 críticas · 51 altas · 39 moderadas · 6 bajas                     |
| Conflictos de peer dependencies              | 2                                                                   |

---

## 4. Baseline de calidad por dimensión

| Dimensión                       | Puntuación inicial | Observación                                                                                                       |
| ------------------------------- | -----------------: | ----------------------------------------------------------------------------------------------------------------- |
| Corrección funcional            |                8.1 | Bugs latentes en territorio, nombre de usuario y zona horaria                                                     |
| Seguridad                       |                7.5 | 1 crítica en producción (`proxy-addr`, evadía el rate limit), CSP con `unsafe-inline`, CORS abierto en producción |
| Pruebas                         |                7.0 | Suite intermitente, 4 tests rojos reales, sin E2E de navegador                                                    |
| Calidad de implementación       |                8.2 | 82 `as any` en backend; dos rutas de 1.762 y 1.193 líneas                                                         |
| Mantenibilidad / observabilidad |                7.8 | CI decorativa, sin métricas, OpenAPI incompleto                                                                   |

---

## 5. Baseline de infraestructura

| Elemento                         | Estado inicial                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile` | ❌ rota (mismatch de overrides) → CI entera roja                                     |
| `pnpm install` en Windows        | ❌ rota (`preinstall` con `sh -c`)                                                   |
| `vitest` / `vite` en Windows     | ❌ rotos (binario nativo de rollup excluido)                                         |
| `pnpm exec prettier --check`     | ⚠️ solo backend, y siempre rojo en Windows (CRLF)                                    |
| Typecheck en CI                  | ⚠️ solo backend                                                                      |
| Tests del frontend en CI         | ❌ ausentes                                                                          |
| Auditoría de dependencias en CI  | ❌ ausente                                                                           |
| Migraciones en CI                | ⚠️ `                                                                                 |     | true` enmascaraba fallos |
| `permissions:` / `concurrency:`  | ❌ ausentes                                                                          |
| Despliegue                       | `render.yaml` (web service + Postgres) · `render-build.sh` · `run_all_migrations.js` |

---

## 6. Línea base de la auditoría

El punto de partida cuantitativo es:

> **Global 7.90 / 10** · 0/25 áreas en el objetivo (9.8) · 15 vulnerabilidades
> críticas · 51 altas · CI rota · 7 suites de test intermitentes · 4 tests rojos.

Y el punto de partida cualitativo es: _una base de código con muy buena
estructura yRBAC sólido, pero con la capa de infraestructura (instalación, CI,
formato) rota y con bugs de datos que silenciosamente corrompen el territorio
y el functionality en vivo._

---

_Ver `ITERATION-001.md` para el detalle de cada hallazgo y su corrección._
