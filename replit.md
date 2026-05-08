# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains the **Radar Vecinal** citizen security platform — a PWA for community incident reporting, panic alerts, missing persons, and district intelligence.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui (artifacts/radar-vecinal)
- **Backend**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (import from `"zod"` — catalog resolves to v4), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Maps**: Leaflet + react-leaflet (OSM tiles, dark filter)
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Date formatting**: date-fns
- **Build**: esbuild (server bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── radar-vecinal/      # React + Vite frontend (PWA)
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── object-storage-web/ # Web client for object storage upload
├── scripts/                # Utility scripts
│   └── src/seed.ts         # Database seed script
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Radar Vecinal Features

### Frontend Routes (artifacts/radar-vecinal)
- `/` → Redirects to /home
- `/home` → Main dashboard: map, stats, activity feed, panic button
- `/mapa` → Interactive map with incident markers
- `/reportar` → Multi-step incident report form
- `/alertas` → Active panic alerts list
- `/historial` → Filterable incident history
- `/estadisticas` → Statistics with charts and KPIs
- `/perfil` → User profile page
- `/menor-perdido` → Missing persons alerts
- `/admin` → Admin control center (reports moderation + user management)

### API Routes (artifacts/api-server at /api)
- `GET /api/healthz` — Health check
- `GET/POST /api/reports` — Incident reports (supports `?district=` filter)
- `GET/PATCH /api/reports/:id` — Single report
- `DELETE /api/reports/:id` — Delete report (admin)
- `POST /api/seed` — Auto-seed demo data if DB has < 10 reports
- `GET/POST /api/panic-alerts` — Panic alerts
- `GET /api/panic-alerts/stream` — SSE stream for real-time panic alerts
- `GET/POST /api/missing-persons` — Missing person alerts
- `PATCH /api/missing-persons/:id` — Update missing person
- `GET /api/stats` — Statistics
- `GET /api/activity` — Activity feed
- `GET /api/users` — Users (admin)
- `GET /api/ad-slots` — Ad slots
- `POST /api/auth/register` — Register new user (JWT)
- `POST /api/auth/login` — Login (returns JWT, 30d expiry)
- `GET /api/auth/me` — Get current user from Bearer token

### Database Schema (lib/db)
Tables: `users`, `reports`, `panic_alerts`, `missing_persons`, `ad_slots`
Enums: `report_category`, `urgency_level`, `report_status`, `user_role`, `panic_alert_type`, `missing_person_status`
Notable fields: `contactPhone` (nullable) on reports — admin-only, used for calling reporters

### Map Features (LeafletMap.tsx)
- **Map mode**: Emoji DivIcon markers per category (last 15 days), category legend
- **Radar mode**: Animated canvas radar sweep with blips and cardinal rings
- **Heat mode**: Smoke heatmap — only robbery + fight (6-month window)
- **Category filters**: 14 scrollable pills in MapPage
- **User location**: Geolocation with simulated fallback to San Ramón centro
- **Sensitive categories**: informal_commerce, prostitution, drug_point, bar_trouble → auto-anonymous
- **F-10 Zoom controls**: Custom `MapControls` component — +/- zoom buttons + locate button grouped at top-right (dark-themed, mobile-friendly; replaced Leaflet's default ZoomControl)

### Admin Panel Features (Admin.tsx)
- KPI cards: total reports, active alerts, resolved today, users
- Report table: icon, title, category, sector, time, status badge, action buttons
- Action buttons: resolve ✓, review 👁, archive 🕐, delete 🗑, call ☎ (when contactPhone exists)
- Delete confirmation modal
- "Cargar datos demo" button → POST /api/seed (fixes empty production DB)
- Search/filter across reports and users
- Users tab with roles
- **Publicidad tab (B-26)**: Ad slots management — toggle active/inactive, CTR metrics (impressions, clicks), inline edit modal with all slot fields

### Stats (estadisticas) Features (Stats.tsx)
- **Period selector (B-23)**: 4 buttons — 7 días, 30 días, 3 meses, 1 año (default 30d); KPI cards and category chart filtered by selected period using client-side computation from full reports list
- Per-category bar chart filtered by period; top sectors bar list filtered by period

### History (historial) Features (History.tsx)
- **Pagination (B-25)**: 20 reports per page; prev/next buttons, page number pills with ellipsis, "Página X de Y · N incidentes" footer; resets to page 1 on filter/search change

### Missing Persons (menor-perdido) Features (MissingPerson.tsx)
- **Photo URL field (B-17)**: Optional URL input with live image preview (preview hidden on load error); coordinates set to San Ramón, Chanchamayo

### Profile (perfil) Features (Profile.tsx)
- **Edit form (B-22)**: "Editar" button (desktop) opens modal with name text field and sector dropdown (7 sectors); saves via PATCH /api/users/:id with Bearer token; guest mode shows demo profile without edit button

### Notifications Features (Notifications.tsx)
- **Backend connection (B-16)**: Calls GET /api/notifications on mount; merges API system notifications (by id deduplication) into local DEMO_NOTIFS state; new API notifications prepended as unread

### Visual Identity
- Dark carbon/navy backgrounds
- Electric blue accents
- Red for critical alerts
- Green for resolved status
- Inter font family
- Panic button: always-visible red floating button

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck

## Root Scripts

- `pnpm run build` — runs typecheck + builds all packages
- `pnpm run typecheck` — runs full typecheck
- `pnpm --filter @workspace/scripts run seed` — Seed the database

## Key Files

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API)
- `lib/db/src/schema/reports.ts` — All DB tables and enums
- `artifacts/radar-vecinal/src/App.tsx` — Frontend router (wraps with AuthProvider + DistrictProvider)
- `artifacts/radar-vecinal/src/components/Layout.tsx` — App shell with sidebar/bottom nav (auth user card, district selector)
- `artifacts/radar-vecinal/src/components/AuthModal.tsx` — Login/Register slide-up modal (JWT auth)
- `artifacts/radar-vecinal/src/components/PanicModal.tsx` — Emergency panic button modal
- `artifacts/radar-vecinal/src/contexts/AuthContext.tsx` — Auth state (user, isLoggedIn, login/logout/register); token in localStorage key `radar_token`
- `artifacts/radar-vecinal/src/contexts/DistrictContext.tsx` — District selector state, 6 Chanchamayo districts; persisted in localStorage
- `artifacts/api-server/src/routes/auth.ts` — JWT auth routes (register/login/me); secret from JWT_SECRET env (required)
- `artifacts/api-server/src/routes/` — All API route handlers

### Real-time Features (F-07, F-09)
- **Global SSE hook** (`usePanicAlertStream.ts`): Mounts in App.tsx via `<GlobalPanicStream />`, subscribes to `/api/panic-alerts/stream` from any page, shows toast notifications for every new panic alert, includes haversine distance to user
- **Sound alerts** (F-09): Web Audio API tones generated in `usePanicAlertStream.ts` — robbery/fight: triple high beep (1200Hz); fire: siren sweep; medical: double low beep; other: single sine tone. AudioContext resumes on interaction before playing.

### Image Upload (F-06)
- **Google Cloud Storage**: Provisioned bucket via `GCS_BUCKET_NAME` env var
- **API routes**: `POST /api/storage/uploads/request-url` (presigned URL), `GET /api/storage/objects/*` (serve objects)
- **Frontend**: Two-step upload in ReportForm step 2 — POST metadata → get presigned URL → PUT file to GCS → store `/api/storage/objects/{path}` as imageUrl
- **Preview**: shows local blob URL immediately while uploading; shows green "Imagen subida" badge on success; X button to remove

### Route Security (F-03)
- `PATCH /api/reports/:id` → `requireAuth` (any authenticated user)
- `DELETE /api/reports/:id` → `requireAuth` + `requireAdmin` (admin/moderator only)
- `requireAuth`/`requireAdmin` middleware in `artifacts/api-server/src/routes/auth.ts`

## Security Notes

- Sensitive categories (prostitution, drug_point, bar_trouble, informal_commerce) are forced anonymous server-side
- JWT expires in 30 days; JWT_SECRET env variable is required (no fallback)
- PATCH/DELETE /api/reports require valid JWT; DELETE also requires admin/moderator role
TE also requires admin/moderator role
