# Auditoría — Funcionalidad, Calidad de Código, Lógica y UX

**Fecha:** 2026-07-08 · **Alcance:** rama `claude/production-readiness-audit-3pgip6`
**Método:** revisión de código + verificación con Postgres real (120 tests) + builds.

Severidad: 🔴 Alta (rompe o degrada una función) · 🟠 Media · 🟡 Baja/mejora.

---

## 1. Funcionalidad

| # | Sev | Hallazgo | Evidencia | Solución propuesta |
|---|---|---|---|---|
| **F1** | 🔴 | **Personas extraviadas se guardan con coordenadas FIJAS.** El formulario de crear envía `lastSeenLatitude: -11.1272, lastSeenLongitude: -75.3548` hardcodeadas; el "último lugar visto" es solo texto. Resultado: **todas** las personas aparecen en el mismo punto del mapa y no se puede filtrar por proximidad. | `pages/MissingPerson.tsx:136-137` | Reutilizar el selector de ubicación de reportes (`GeocoderInput` + mapa arrastrable + geolocalización) que ya existe en `ReportForm`. |
| **F2** | 🔴 | **Botón "Contactar" roto para el público.** La tarjeta muestra `tel:${person.contactInfo}` y el teléfono, pero el backend **anonimiza `contactInfo` a solo backoffice del distrito**. Para un vecino normal, `contactInfo` es `undefined` → enlace `tel:undefined` y teléfono vacío. Contradice el propósito (búsqueda comunitaria). | `pages/MissingPerson.tsx:372-388` vs `routes/alerts.ts` (GET `isBackofficeSameDistrict`) | Decisión de diseño: (a) hacer el contacto **público** en extraviados (tiene sentido para búsqueda), o (b) ocultar el botón cuando no hay dato y canalizar el contacto por la app. |
| **F3** | 🟠 | **`isAdmin` inconsistente con el nuevo RBAC**: `users.ts:320` sigue usando `["admin","moderator","super_admin"]` — **excluye `municipal`** (las municipalidades) e incluye `moderator` (que ya no debería tener ese poder). | `routes/users.ts:320` | Usar `isMunicipalityLevel(user.role)` de `lib/roles.ts`. |
| **F4** | 🟡 | **Sin edición completa server-side documentada en el contrato.** `UpdateMissingPersonInput` del OpenAPI solo declara `status/clothing/photoUrl`, aunque el backend ya acepta más campos. El frontend usa `customFetch` directo (funciona) pero el contrato queda desalineado. | `lib/api-spec/openapi.yaml` (`UpdateMissingPersonInput`) | Ampliar el schema del contrato y regenerar (tras alinear orval/zod, ver auditoría previa). |

---

## 2. Lógica / Correctitud

| # | Sev | Hallazgo | Evidencia | Solución |
|---|---|---|---|---|
| **L1** | 🟠 | **Chequeos de rol dispersos e inconsistentes.** Existe `lib/roles.ts` (fuente única, 4 niveles) pero varias rutas siguen con arrays inline (`users.ts`, `alerts.ts` GET ya corregido). Riesgo: que un rol quede mal autorizado en un endpoint y no en otro. | `users.ts:320,350`; enums inline en varios sitios | Migrar todos los chequeos a `isSuperAdmin/isMunicipalityLevel/isModeratorLevel`. |
| **L2** | 🟡 | **Roles legacy sin uso real** (`admin`, `moderator`) conviven con los activos (`municipal`, `viewer`). Genera ambigüedad. | `db/schema` `userRoleEnum` | Documentar la equivalencia (ya en `lib/roles.ts`) y, a futuro, migrar datos a los 4 roles canónicos. |
| **L3** | 🟡 | **Borrado suave sin `deletedBy`/auditoría en extraviados.** El nuevo DELETE marca `deletedAt` pero no registra quién ni por qué (los reportes sí usan audit log). | `routes/alerts.ts` DELETE missing-persons | Registrar en `audit_logs` (entityType `missing_person`) como en reportes. |

---

## 3. Calidad de Código

| # | Sev | Hallazgo | Evidencia | Solución |
|---|---|---|---|---|
| **CQ1** | 🟠 | **Archivos monolito.** `routes/reports.ts` (1.496 líneas) y `routes/alerts.ts` (~940) concentran CRUD + votos + confirmaciones + PDF + SSE. Dificulta test y mantenimiento. | `routes/reports.ts`, `routes/alerts.ts` | Dividir por sub-dominio en routers separados. |
| **CQ2** | 🟠 | **Tipado débil de la request autenticada.** `(req as any).jwtUser` aparece **~98 veces** en las rutas. Sin tipo, cualquier cambio de claims pasa desapercibido. | rutas backend (grep `as any`) | Declarar `declare module "express" { interface Request { jwtUser?: JwtUser } }` y tipar `JwtUser`. Elimina casi todos los `as any`. |
| **CQ3** | 🟡 | **48 `any` en frontend, 12 `console.*`.** Los `console` ya se eliminan del bundle de producción (auditoría previa); los `any` (p. ej. `.map((r:any))`) restan seguridad de tipos. | `radar-vecinal/src` | Tipar respuestas de query con los tipos generados del contrato. |
| **CQ4** | 🟡 | **Coordenadas de fallback repetidas** (`-11.12…`) en 3 componentes. | `PanicModal`, `RadarHero`, `MissingPerson` | Centralizar en una constante de "centro por defecto" derivada del distrito. |

---

## 4. UX / Diseño

| # | Sev | Hallazgo | Evidencia | Solución |
|---|---|---|---|---|
| **UX1** | 🔴 | **Reportar extravío no pide ubicación real** (deriva de F1). El usuario escribe la dirección pero no hay mapa/geocoder; la ubicación se pierde. | `pages/MissingPerson.tsx` (form crear) | Añadir el mismo selector de mapa que `ReportForm`. |
| **UX2** | 🟠 | **Estados faltantes.** `Notificaciones` y `Emergencias` no tienen skeleton de carga; `History`, `Notificaciones` y `Emergencias` no tienen estado de error. Sensación de "colgado" si la API tarda/falla. | `pages/Notifications.tsx`, `pages/Emergencias.tsx`, `pages/History.tsx` | Añadir skeletons y estados de error/reintento consistentes (como en `Home`/`Alerts`). |
| **UX3** | 🟠 | **Botón que no hace nada** (deriva de F2): "Contactar" con `tel:undefined`. Un CTA visible que falla erosiona la confianza. | `pages/MissingPerson.tsx:384` | Mostrar el botón **solo si hay teléfono**; si no, mostrar "Contacto no disponible" o canalizar por la app. |
| **UX4** | 🟡 | **Consistencia de gestión.** Reportes tienen panel admin completo; extraviados ahora tienen editar/eliminar en las tarjetas, pero **no hay pestaña de extraviados en el Centro de Control** — la gestión vive en la página pública. | `components/admin/AdminPanel.tsx` (tabs) | Considerar una pestaña "Extraviados" en el panel admin para gestión centralizada. |
| **UX5** | 🟡 | **Accesibilidad**: varios micro-labels `text-[9px]/[10px]` sobre fondo oscuro rozan el mínimo de contraste (WCAG 1.4.3). | global | Auditar con Lighthouse/axe y subir a ≥ 4.5:1 donde aplique. |

---

## Priorización recomendada

1. **F1 / UX1** (🔴): selector de ubicación real en "reportar extravío". Es el bug más impactante: hoy el mapa de extraviados es inútil.
2. **F2 / UX3** (🔴): decidir el modelo de contacto de extraviados y arreglar el botón "Contactar".
3. **F3 / L1** (🟠): unificar todos los chequeos de rol con `lib/roles.ts` (evita que una municipalidad quede bloqueada en algún endpoint).
4. **CQ2** (🟠): tipar `req.jwtUser` (borra ~98 `as any` y previene bugs de auth).
5. **UX2** (🟠): estados de carga/error faltantes.
6. Resto (🟡): modularizar rutas, auditar contraste, pestaña admin de extraviados, alinear contrato.

---

## Estado sano (lo que está bien)

- RBAC de 4 niveles centralizado (`lib/roles.ts`) tras esta iteración.
- Reportes con selector de mapa + geolocalización + geocoder (buen patrón a replicar).
- Aislamiento multi-tenant por distrito con tests (RLS + `checkTenant`).
- Subida de fotos corregida (auth + flujo Cloudinary) — pendiente solo de desplegar.
- Suite de tests (120) + typecheck + prettier + builds en verde.
