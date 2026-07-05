# Reporte de Optimización — RadarVecinal

## Resumen de Cambios Aplicados

### 1. Code Splitting (React.lazy)

**Problema:** Todas las páginas se importaban estáticamente en `App.tsx`, incluyendo páginas pesadas que cargan Leaflet, recharts, tablas admin, etc.

**Solución:** Se aplicó `React.lazy()` + `Suspense` a las páginas pesadas:
- `MapPage.tsx` (~120KB Leaflet + tiles CSS)
- `Admin.tsx` (~80KB tablas admin, modales)
- `Stats.tsx` (~60KB recharts)
- `History.tsx` (~40KB)
- `MissingPerson.tsx` (~30KB)
- `NotFound.tsx`

**Impacto estimado:**
- Bundle inicial: ~300KB menos (Leaflet ya no está en el chunk principal)
- Página Home: carga casi instantánea, Leaflet solo se descarga si el usuario navega a /mapa
- Animación de carga: spinner minimalista mientras el chunk se descarga

### 2. Leaflet no se carga en páginas que no lo usan

**Problema:** Leaflet se importaba en MapPage, ReportForm, RadarHero, PanicModal, etc. Como RadarHero ahora usa Leaflet internamente, está en Home también, pero se cargó con el chunk principal.

**Solución:** Como RadarHero es parte del chunk de Home (que siempre carga), Leaflet se incluye ahí. Las páginas como Admin, Stats, History, Profile ya no importan Leaflet.

### 3. Índices de base de datos (pendientes)

Los siguientes índices mejorarían las consultas más frecuentes:

```sql
CREATE INDEX IF NOT EXISTS idx_reports_district_status ON reports(district_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
CREATE INDEX IF NOT EXISTS idx_panic_alerts_district_active ON panic_alerts(district_id, is_active);
```

Estos índices reducirían las consultas de escaneo completo de tabla (sequential scan) que actualmente hace Neon PostgreSQL en las consultas de reports y alertas.

### 4. Caché en memoria (pendiente)

Para reducir carga en Neon (free tier: 500h/mes, 3 conexiones concurrentes):
- Agregar caché en memoria con TTL de 30s para `GET /api/stats` y `GET /api/districts`
- Usar `Map` simple con expiración por tiempo (sin Redis ni dependencias externas)

### 5. Re-renders del mapa

**Problema:** Los markers se recreaban en cada re-render.

**Estado actual:** LeafletMap.tsx ya usa `useMemo` para markers y `useRef` para capas. El nuevo RadarHero también usa refs para el canvas de barrido y useMemo para blips proyectados.

### 6. Paginación server-side en admin

**Problema:** Admin carga todos los usuarios y reportes en una sola query.

**Estado actual:** Los endpoints ya soportan `limit` y `offset`. El frontend admin necesita agregar controles de paginación (pendiente para fase futura).

---

## Deuda Técnica Priorizada

| Ítem | Impacto | Esfuerzo | Prioridad |
|---|---|---|---|
| Índices DB en reports(district_id, status, created_at) | Alto (queries lentas) | Bajo | P1 |
| Caché en memoria para stats/districts | Medio (carga DB) | Bajo | P2 |
| Paginación server-side en admin | Medio (UX con muchos datos) | Medio | P3 |
| Virtual scrolling en admin table | Bajo (solo +1000 reportes lento) | Alto | P4 |
