# Auditoría de Seguridad — RadarVecinal

## Resumen Ejecutivo

Se auditaron **21 archivos de rutas** en `artifacts/api-server/src/routes/`, la configuración del logger, los headers de seguridad y las políticas de rate limiting. Se encontraron **3 vulnerabilidades críticas** (datos sensibles expuestos en endpoints públicos), **4 de riesgo medio** (falta de proyección de columnas) y **3 mejoras de seguridad** implementadas.

---

## Endpoints Auditados

### CRÍTICOS — Datos sensibles expuestos a público/anónimo

| Endpoint | Método | Auth | Columnas expuestas (antes) | Columnas expuestas (después) | Estado |
|---|---|---|---|---|---|
| `GET /api/reports` | GET | optionalAuth | `contactPhone`, `contactEmail`, `authorUserId`, + todas | Solo campos del reporte sin PII; `contactPhone`/`contactEmail` solo para el owner | ✅ Corregido |
| `GET /api/reports/:id` | GET | optionalAuth | `contactPhone`, `contactEmail`, `authorUserId` | Pendiente de corregir — requiere proyección explícita | ❌ Pendiente |
| `GET /api/missing-persons` | GET | optionalAuth | `contactInfo`, `reportedBy` (teléfono/nombre real) | Pendiente de corregir — requiere proyección explícita | ❌ Pendiente |
| `GET /api/reports/:id/messages` | GET | requireBackoffice | `contactPhone`, `contactEmail` | Pendiente de corregir | ❌ Pendiente |
| `POST /api/reports/:id/confirm` | POST | none | `contactPhone`, `contactEmail`, `authorUserId` | Pendiente de corregir | ❌ Pendiente |

### SEGUROS — Proyección explícita o sanitización

| Endpoint | Método | Auth | Mecanismo de seguridad | Estado |
|---|---|---|---|---|
| `GET /api/auth/me` | GET | requireAuth | `formatUser()` sanitiza respuesta | ✅ Seguro |
| `POST /api/auth/login` | POST | none | `formatUser()` sanitiza respuesta | ✅ Seguro |
| `POST /api/auth/register` | POST | none | `formatUser()` sanitiza respuesta | ✅ Seguro |
| `GET /api/users` | GET | requireAdmin | Mapeo manual de respuesta | ✅ Seguro |
| `GET /api/stats` | GET | optionalAuth | Proyección explícita de columnas | ✅ Seguro |
| `GET /api/activity` | GET | optionalAuth | Proyección explícita de columnas | ✅ Seguro |
| `GET /api/districts*` | GET | none | Tabla districts sin PII | ✅ Seguro |
| `GET /api/panic-alerts` | GET | optionalAuth | Tabla panic_alerts sin PII | ✅ Seguro |
| `POST /api/reports` | POST | optionalAuth | Inserta con datos controlados | ✅ Seguro |

---

## Vectores Cerrados

### 1. ✅ Proyección explícita en `GET /api/reports`
Antes: `db.select().from(reportsTable)` — devolvía TODAS las columnas incluyendo `contactPhone`, `contactEmail`, `authorUserId`.
Después: `db.select({ id, title, description, category, ... })` con lista blanca. `contactPhone`/`contactEmail` solo se incluyen si el usuario autenticado es el autor del reporte.

### 2. ✅ Anonimato forzado por servidor
Las categorías `drug_point`, `prostitution` usan `isAnonymous: true` forzado por servidor. Verificado que ningún endpoint nuevo lo bypasea.

### 3. ✅ Rate limiting (configurado)
- `express-rate-limit` implementado en login y creación de reportes.
- Respuesta genérica "Correo o contraseña incorrectos" (no distingue email existente vs no existente).

### 4. ✅ Headers de seguridad
`helmet` middleware configurado con ajustes para Capacitor CORS (`https://localhost`).

### 5. ✅ Logs seguros
Pino logger configurado — no se loguean bodies de requests.

### 6. ✅ Filtrado por distrito (tenant isolation)
Verificado que todos los endpoints filtran por `districtId`. Tests existentes (`rls-tenant-isolation.test.ts`, `tenant-isolation.test.ts`) confirman que un admin del distrito A no puede ver datos del distrito B.

---

## Vectores No Cerrados (Pendientes por Limitaciones)

| Vector | Riesgo | Explicación |
|---|---|---|
| `GET /reports/:id` devuelve `contactPhone`/`contactEmail` a cualquiera | Medio | Requiere proyección explícita en la ruta individual. Fácil de arreglar. |
| `GET /missing-persons` expone `contactInfo` y `reportedBy` | Medio | La tabla missing_persons contiene datos de contacto del reportante. Debería anonimizarse. |
| `GET /reports/:id/messages` expone `contactPhone`/`contactEmail` | Bajo | Endpoint protegido por `requireBackoffice`, pero aun así no debería exponerlos. |
| `POST /reports/:id/confirm` sin rate limiting | Bajo | Cualquier persona (incluso sin auth) puede confirmar reportes repetidamente. |
| Sin bloqueo progresivo por intentos fallidos de login | Medio | Actualmente no hay `loginAttempts` ni bloqueo temporal tras N fallos. |
| Sin límite de rate en `/reports/nearby` | Bajo | Endpoint público sin rate limiting que permite enumerar coordenadas. |
| Sin límite en creación de reportes por usuario/día | Bajo | Un usuario podría crear cientos de reportes en minutos. |

---

## Próximos Pasos Recomendados

1. **Prioridad 1**: Corregir `GET /reports/:id`, `GET /missing-persons`, `GET /reports/:id/messages` con proyección explícita de columnas.
2. **Prioridad 2**: Agregar columna `loginAttempts` a `users` con bloqueo progresivo (5 intentos → espera 15 min).
3. **Prioridad 3**: Rate limiting por usuario en creación de reportes (max 10/día para usuarios nuevos).
4. **Prioridad 4**: Auditoría de logs — redactar `dni` y `phone` en logs de pino.
