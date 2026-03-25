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
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
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
│   └── db/                 # Drizzle ORM schema + DB connection
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
- `GET/POST /api/reports` — Incident reports
- `GET/PATCH /api/reports/:id` — Single report
- `DELETE /api/reports/:id` — Delete report (admin)
- `POST /api/seed` — Auto-seed demo data if DB has < 10 reports
- `GET/POST /api/panic-alerts` — Panic alerts
- `GET/POST /api/missing-persons` — Missing person alerts
- `PATCH /api/missing-persons/:id` — Update missing person
- `GET /api/stats` — Statistics
- `GET /api/activity` — Activity feed
- `GET /api/users` — Users (admin)
- `GET /api-slots` — Ad slots

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

### Admin Panel Features (Admin.tsx)
- KPI cards: total reports, active alerts, resolved today, users
- Report table: icon, title, category, sector, time, status badge, action buttons
- Action buttons: resolve ✓, review 👁, archive 🕐, delete 🗑, call ☎ (when contactPhone exists)
- Delete confirmation modal
- "Cargar datos demo" button → POST /api/seed (fixes empty production DB)
- Search/filter across reports and users
- Users tab with roles

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
- `artifacts/radar-vecinal/src/App.tsx` — Frontend router
- `artifacts/radar-vecinal/src/components/Layout.tsx` — App shell with sidebar/bottom nav
- `artifacts/radar-vecinal/src/components/PanicModal.tsx` — Emergency panic button modal
- `artifacts/api-server/src/routes/` — All API route handlers
