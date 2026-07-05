# Notas de Despliegue — RadarVecinal (FASE 1-6)

## Acciones Manuales Requeridas

### 1. Migraciones de Base de Datos

Ejecutar en orden en Neon:

```sql
-- Migration 0018: boundary column (point-in-polygon)
ALTER TABLE districts ADD COLUMN IF NOT EXISTS boundary jsonb;

-- Migration 0019: new report categories
-- NOTA: Estos deben ejecutarse fuera de transacción (ADD VALUE no es transaccional en PG < 13)
DO $$ BEGIN
  ALTER TYPE report_category ADD VALUE IF NOT EXISTS 'lost_pet';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE report_category ADD VALUE IF NOT EXISTS 'power_outage';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE report_category ADD VALUE IF NOT EXISTS 'street_damage';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE report_category ADD VALUE IF NOT EXISTS 'stray_dogs';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE report_category ADD VALUE IF NOT EXISTS 'flooding';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Migration 0020: strike system
ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_score integer DEFAULT 50;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until timestamp;

CREATE TABLE IF NOT EXISTS user_strikes (
  id SERIAL PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id),
  report_id integer NOT NULL REFERENCES reports(id),
  motivo text NOT NULL,
  admin_id integer NOT NULL REFERENCES users(id),
  created_at timestamp DEFAULT now(),
  activo boolean DEFAULT true,
  expires_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_user_strikes_user_id ON user_strikes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_strikes_activo ON user_strikes(activo);
```

### 2. Cargar Polígonos de Distritos (GeoJSON)

Para que el point-in-polygon funcione, necesitas cargar los límites de los distritos:

1. Obtener GeoJSON de límites distritales del Perú:
   - GitHub: https://github.com/edwinpgm/peru-geojson (recomendado)
   - INEI / IDEP: https://idep.inei.gob.pe/
   - OCHA Perú: https://data.humdata.org/group/per

2. Ejecutar el script de importación:
   ```bash
   cd scripts
   pnpm run import-geojson -- --file=~/descargas/distritos-lima.geojson
   ```

3. El script busca distritos por nombre exacto (case-insensitive) en la tabla `districts`.

### 3. Variables de Entorno en Render

Migrado de Google Cloud Storage a **Cloudinary** para almacenamiento de imágenes.

#### Cloudinary (requerido para subir imágenes)

Crea una cuenta gratis en https://cloudinary.com (25 GB almacenamiento gratis).

Del Dashboard de Cloudinary, copia estos 3 valores y agrégalos en Render:

| Variable | Valor (ejemplo) | Dónde encontrarlo |
|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | `dgp7qxhfj` | Dashboard > Account Details > Cloud Name |
| `CLOUDINARY_API_KEY` | `482916734512873` | Dashboard > Account Details > API Key |
| `CLOUDINARY_API_SECRET` | `abc123def456...` | Dashboard > Account Details > API Secret |

#### Otras variables requeridas:
- `DATABASE_URL` — Neon PostgreSQL
- `JWT_SECRET` — Firma de tokens
- `SUPER_ADMIN_EMAIL` — Email del superadmin

### 4. Regenerar Clientes Orval (si se modificó el spec)

Si se modificó `lib/api-spec/openapi.yaml`, regenerar los clientes:

```bash
cd lib/api-spec
pnpm orval
```

Esto actualiza `lib/api-client-react/src/generated/` y `lib/api-zod/src/generated/`.

---

## Resumen de Fases

| Fase | Cambios | Tests |
|---|---|---|
| **F1** Radar en mapa real | RadarHero.tsx (Leaflet + canvas), Home.tsx, index.css | ✅ Pasados |
| **F2** Point-in-polygon | districts.ts, pointInPolygon.ts, DistrictContext.tsx, migration 0018 | ✅ Pasados |
| **F3** Nuevas categorías | Schema, constants, templates, migration 0019 | ✅ Pasados |
| **F4** Seguridad | reports.ts (proyección), SECURITY_AUDIT.md | ✅ Pasados |
| **F5** Sistema de strikes | Schema, migration 0020, reports.ts, UsersTab, ReportsTab | ✅ Pasados |
| **F6** Optimización | App.tsx (lazy), OPTIMIZATION_REPORT.md | Pendiente |

## Compatibilidad

- ✅ Capacitor 7 / Android WebView
- ✅ Gestos táctiles (Leaflet touchZoom + canvas pointer events)
- ✅ Render free tier (sin nuevas dependencias pesadas)
- ✅ Español peruano en todo el UI
