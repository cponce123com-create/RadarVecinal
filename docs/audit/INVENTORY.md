# Inventario — Radar Vecinal

> Mapa del repositorio: estructura, dependencias, contratos, roles y flujos.
> Generado durante el ciclo 001 (2026-10-21) sobre `main@cf366234`.

---

## 1. Estructura

```
radar-vecinal/
├── artifacts/
│   ├── api-server/              🚀 Backend Express 5
│   │   ├── src/
│   │   │   ├── routes/          20 ficheros de endpoints
│   │   │   ├── lib/             logger, email, fcm, telegram, roles,
│   │   │   │                    objectStorage, district, claimSecret,
│   │   │   │                    authTypes, license, swagger, pointInPolygon
│   │   │   ├── workers/         maintenance (tareas internas del servidor)
│   │   │   ├── types/           express.d.ts (augmentación de Request)
│   │   │   ├── __tests__/       26 suites
│   │   │   ├── app.ts           helmet, CORS, CSP, rate limits, rutas
│   │   │   └── index.ts         arranque, graceful shutdown
│   │   └── build.cjs            bundle esbuild
│   └── radar-vecinal/           🌐 Frontend React 19 + Vite 7
│       ├── src/
│       │   ├── pages/           17 páginas
│       │   ├── components/      ~50 (UI shadcn + feature + admin/)
│       │   ├── contexts/        Auth, District, Theme
│       │   ├── hooks/           toasts, proximity voice, etc.
│       │   └── lib/             apiConfig, liveProviders, voiceAlerts,
│       │                        proximityPush, pushRegistration,
│       │                        backgroundGeo, mapTiles, constants
│       └── __tests__/           4 suites
├── lib/
│   ├── db/                      🗄️ esquema Drizzle (30 tablas) + 34 migraciones
│   ├── api-spec/                📐 openapi.yaml + orval.config.ts
│   ├── api-zod/                 ✅ schemas Zod generados
│   ├── api-client-react/        🔌 cliente generado + custom-fetch.ts
│   └── object-storage-web/      ☁️ uploader Cloudinary (Uppy)
├── docs/
│   ├── AUDITORIAS.md            informes históricos consolidados
│   ├── SERVICIOS_EN_VIVO.md     documentación del módulo de rutas
│   ├── replit.md                racional de la decisiones de infraestructura
│   └── audit/                   🆕 auditoría continua
├── tools/                       🆕 enforce-pnpm.mjs
└── .github/workflows/           ci.yml, android.yml
```

---

## 2. Dependencias de producción

### Backend (`@workspace/api-server`)

| Paquete                                | Versión  | Para qué                                     |
| -------------------------------------- | -------- | -------------------------------------------- |
| `express`                              | ^5       | Servidor HTTP                                |
| `drizzle-orm`                          | catalog  | ORM + esquema tipado                         |
| `bcryptjs`                             | ^3.0.3   | Hash de contraseñas (10 rondas)              |
| `jsonwebtoken`                         | ^9.0.3   | Access tokens (15 min) + reset de contraseña |
| `helmet`                               | ^8.1.0   | Cabeceras de seguridad + CSP                 |
| `cors`                                 | ^2       | CORS                                         |
| `express-rate-limit`                   | ^8.3.1   | Rate limiting por endpoint                   |
| `pino` / `pino-http`                   | ^9 / ^10 | Logs estructurados                           |
| `firebase-admin`                       | ^14.1.0  | Push FCM                                     |
| `nodemailer`                           | ^10.0.6  | Correo SMTP                                  |
| `pdfkit`                               | ^0.19.1  | PDF de reportes                              |
| `swagger-jsdoc` / `swagger-ui-express` | ^6 / ^5  | Docs `/api-docs`                             |
| `zod`                                  | catalog  | Validación de entrada                        |

### Frontend (`@workspace/radar-vecinal`)

| Paquete                                       | Para qué                   |
| --------------------------------------------- | -------------------------- |
| `react` / `react-dom` 19.1.0                  | UI                         |
| `react-router` (wouter)                       | Enrutado                   |
| `@tanstack/react-query`                       | Cache de datos en servidor |
| `leaflet` + `react-leaflet`                   | Mapas                      |
| `framer-motion`                               | Animaciones                |
| `recharts`                                    | Gráficos de estadísticas   |
| `lucide-react`                                | Iconografía                |
| `tailwindcss` v4 + shadcn/ui                  | Sistema visual             |
| `@capacitor/core` + `cli` + `android` 7.6.9   | App nativa                 |
| `@capacitor/push-notifications` 7.0.7         | Push nativo                |
| `@capacitor-community/background-geolocation` | GPS en segundo plano       |
| `date-fns`                                    | Formato de fechas          |

### Servicios externos

| Servicio                 | Uso                   | Configuración         |
| ------------------------ | --------------------- | --------------------- |
| Neon PostgreSQL          | Base de datos         | `DATABASE_URL`        |
| Cloudinary               | Imágenes y audio      | `CLOUDINARY_*`        |
| Firebase Cloud Messaging | Push                  | `FCM_SERVICE_ACCOUNT` |
| SMTP                     | Correo                | `SMTP_*`              |
| API RENIEC               | Consulta de DNI       | `RENIEC_API_TOKEN`    |
| Telegram Bot API         | Difusión de reportes  | `TELEGRAM_*`          |
| Esri                     | Teselas del mapa base | Sin clave             |
| Render                   | Hosting               | `render.yaml`         |

---

## 3. Modelo de datos (30 tablas)

| Grupo                  | Tablas                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| Territorial            | `districts` (con `boundary` GeoJSON, centro, Telegram)                                                |
| Usuarios               | `users`, `user_consents`, `refresh_tokens`, `user_strikes`, `user_education_progress`                 |
| Reportes               | `reports`, `report_messages`, `resolution_confirmations`, `votes`, `community_flags`, `static_points` |
| Emergencias            | `panic_alerts` (con ciclo de vida: `status`, `resolved_at`, `expires_at`, `linked_report_id`)         |
| Personas desaparecidas | `missing_persons` (con `reported_by_id`)                                                              |
| Servicios en vivo      | `live_providers`, `live_tracks`, `live_devices`, `live_voice_clips`, `proximity_subscriptions`        |
| Contenido              | `categories`, `departments`, `civic_education_topics`, `district_resources`                           |
| Operación              | `audit_log`, `notifications`, `subscriptions`, `ad_slots`, `licenses`                                 |

**Claves y restricciones:** PK `serial` en todas; FK con `references()`;
`unique` en `users.email`, `users.dni`, `users.vecino_id`, `users.alias`,
`districts.slug`, `refresh_tokens.token_hash`, `live_devices.device_key`,
`resolution_confirmations (report_id, user_id, kind)`.

**Índices de rendimiento:** migración `0021_performance_indexes.sql`;
`0028_confirmation_kind.sql` añade unicidad por tipo de confirmación.

---

## 4. Roles y permisos

Fuente única de verdad: `lib/roles.ts` (4 niveles).

| Nivel | Roles                 | Capacidad                                         |
| ----- | --------------------- | ------------------------------------------------- |
| 4     | `super_admin`         | Todo, todos los distritos                         |
| 3     | `admin`, `municipal`  | Municipality: gestionar y eliminar en su distrito |
| 2     | `moderator`, `viewer` | Backoffice: ver y moderar, sin eliminar           |
| 1     | `user`                | Vecino                                            |

Guards disponibles: `requireAuth` · `requireAdmin` · `requireMunicipal` ·
`requireBackoffice` · `requireViewerOrAbove` · `requireSuperAdmin` ·
`optionalAuth` · `requireSameDistrict` · `requireDistrictFilter`.
Aislamiento: `getDistrictId(req)` y `checkTenant(req, resourceDistrictId)`
(`routes/tenant.ts`).

---

## 5. Flujos críticos

| Flujo                | Pasos                                                      | Puntos de control                                                                                                                     |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Vecino reporta       | Map → categoría → descripción → foto → GPS → enviar        | Anonimato forzado en categorías sensibles; rate limit (5/min anónimo, 30/min autenticado); revalidación de sanción en `POST /reports` |
| Alerta de pánico     | Activar → SSE a los conectados → push FCM → reporte espejo | `panic_alerts` con ciclo de vida; `linked_report_id`; expiración por `expires_at`                                                     |
| Persona desaparecida | Reportar → foto → contacto opcional → actualizar estado    | `reported_by_id`; contacto solo a backoffice del mismo distrito; soft-delete auditado                                                 |
| Servicio en vivo     | Start → ping (~10 s) → ruta (muestreada) → stop            | `broadcastKey` sin sesión; `deviceKey` para dispositivos oficiales; expiración perezosa a los 3 min                                   |
| Moderación           | Reporte → strike → sanción → apelación                     | `user_strikes`; `requireAuth` rechaza `suspendedUntil` futuro; `isActive=false` bloquea en `POST /reports`                            |
| Admin municipal      | Licencia → viewers → dispositivos → clips de voz           | Licencia activa con tope de viewers; aislamiento por `districtId`                                                                     |

---

## 6. Contratos

| Contrato      | Dónde                                                | Estado                                                                        |
| ------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| OpenAPI       | `lib/api-spec/openapi.yaml` (1.453 líneas, 24 paths) | **Parcial**: cubre ~40 % de los endpoints reales                              |
| Zod generado  | `lib/api-zod/src/generated`                          | Generado por orval (colisión `SeedDataBody` resuelta con re-export explícito) |
| Cliente React | `lib/api-client-react/src/generated`                 | Generado, con mutador `customFetch`                                           |
| Esquema DB    | `lib/db/src/schema/reports.ts`                       | Tipado en TS, 30 tablas                                                       |

**Deriva conocida:** los endpoints no cobertos por el contrato se consumen con
`customFetch` directo, lo que funciona pero no genera tipos ni valida el
contrato. La generación con orval está bloqueada por la incompatibilidad
zod v3 (`lib/api-zod`) frente a la salida zod v4 de orval.

---

## 7. Observabilidad

| Aspecto               | Estado                                                                           |
| --------------------- | -------------------------------------------------------------------------------- |
| Logs                  | pino con `req.id`, método, url sin query, status. Serializadores personalizados. |
| Health check          | `GET /api/healthz` (usado por `render.yaml`)                                     |
| Auditoría de acciones | `audit_log` en reportes, alertas, usuarios, mensajes, RENIEC, categorías         |
| Mantenimiento         | `workers/maintenance.ts` (tareas internas, sin Redis)                            |
| Métricas / trazas     | ❌ ninguna                                                                       |
| Alertas operativas    | ❌ ninguna                                                                       |

---

## 8. CI/CD

| Workflow      | Jobs                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `ci.yml`      | install · lint-format · audit · typecheck · test-api · test-frontend · test-integration · build |
| `android.yml` | build del APK con `pnpm install --frozen-lockfile` + `cap sync android`                         |

Despliegue: `render.yaml` (web service `radarvecinal-api` + Postgres
`radarvecinal-db`), `render-build.sh`, `run_all_migrations.js` (migraciones
automáticas en el build).

---

## 9. Mapa de dependencias y riesgos

```
                    ┌──────────────┐
   navegador ──────▶│  Express 5   │◀────── APK Capacitor (https://localhost)
                    └──────┬───────┘
                           │
        ┌──────────────────┼───────────────────┐
        ▼                  ▼                   ▼
   PostgreSQL        Cloudinary/SMTP      FCM / Telegram
   (Neon, 30 tablas)  (archivos, correo)  (push, difusión)
        │
        └── RLS (defensa estática) + checkTenant (aplicación)

Riesgos estructurales:
 · La lógica de negocio vive en los ficheros de rutas (reports.ts 1.762 líneas).
 · El aislamiento multi-tenant depende de que cada ruta recuerde filtrar.
 · El contrato OpenAPI cubre menos de la mitad de la API.
 · El token de sesión vive en localStorage (expuesto a XSS).
 · `timestamp without time zone` en todo el esquema (ver RISK_REGISTER).
```

---

_Inventario regenerable: revisa de nuevo al cerrar cada ciclo._
