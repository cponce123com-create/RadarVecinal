# Auditoría — Registros, Sanciones, Filtros + Integración Telegram

**Fecha:** 2026-07-11 · **Rama:** `claude/production-readiness-audit-3pgip6`
**Método:** revisión de código + verificación con Postgres real (127 tests).

Severidad: 🔴 Alta (seguridad / rompe función) · 🟠 Media · 🟡 Baja/mejora.

> **Implementado en esta iteración** (✅): S1, S2, S3 (sanciones), el bug de
> teardown T1, y la **integración de Telegram**. El resto queda documentado y
> priorizado para decidir.

---

## 1. Sanciones 🔴 (lo más crítico)

El sistema de strikes existía pero **no se hacía cumplir**: un usuario podía ser
sancionado y seguir operando con normalidad.

| # | Sev | Hallazgo | Estado |
|---|---|---|---|
| **S1** | 🔴 | **La suspensión (`suspendedUntil`) no se aplicaba en NINGÚN sitio.** El login solo miraba `isActive`; `requireAuth` tampoco la comprobaba. Un usuario "suspendido 7 días" seguía creando reportes, votando y comentando. La sanción era puramente cosmética. | ✅ `requireAuth` ahora rechaza (403) si `suspendedUntil` está en el futuro. |
| **S2** | 🔴 | **Bypass de baneo vía `optionalAuth`.** `POST /reports` usa `optionalAuth` (permite anónimos), que **no revalida contra la BD**. Un usuario baneado (`isActive=false`) con un JWT aún vigente (los tokens son stateless) podía **seguir publicando reportes** hasta que expirara el token. | ✅ `POST /reports` ahora carga `isActive`/`suspendedUntil` del autor y responde 403 si está baneado o suspendido. |
| **S3** | 🟠 | La misma revalidación faltaba conceptualmente en otras rutas de creación con `optionalAuth`. Reportes ya cubierto; conviene replicar el guard en alertas de pánico y personas extraviadas. | ✅ Reportes. ⏳ Pendiente: alertas/extraviados (mismo patrón). |
| **S4** | 🟠 | **Evasión de baneo por re-registro.** El baneo se ancla al usuario, pero el `dni` es **opcional**. Un baneado puede crear una cuenta nueva con otro email si no se exige DNI. | ⏳ Recomendado: exigir DNI en registro (o marcar cuenta como "verificada por DNI") para el piloto. |
| **S5** | 🟡 | El umbral de strikes (1=aviso, 2=suspensión 7d, 3=ban) está **hardcodeado** en `reports.ts`. Difícil de ajustar por distrito. | ⏳ Extraer a config. |

**Verificación:** nuevo `sanctions-enforced.test.ts` — usuario normal crea (201);
suspendido y baneado reciben 403.

---

## 2. Registros 🟢 (sano, con mejoras menores)

| # | Sev | Hallazgo |
|---|---|---|
| **R1** | ✅ | El registro **no acepta `role`** en el body → no hay escalada de privilegios. Bien. |
| **R2** | ✅ | Consentimiento de datos (Ley 29733) exigido en el servidor (`z.literal(true)`), no solo en el frontend. Contraseña con requisitos de fuerza. Login con bloqueo progresivo (5 intentos → 15 min). |
| **R3** | 🟡 | El `district` por defecto en el registro es `"San Ramón"` fijo; debería derivar del distrito detectado (parcialmente resuelto en frontend en la mejora de ubicación). |
| **R4** | 🟡 | No hay verificación de email ni de teléfono. Para el piloto puede bastar el DNI (RENIEC), pero conviene planificarlo. |

---

## 3. Filtros 🟠 (mejorados)

| # | Sev | Hallazgo | Estado |
|---|---|---|---|
| **F1** | 🟠 | **`GET /reports`** filtraba por `category/status/urgency/sector`, pero no por texto ni fechas. | ✅ Añadidos `q` (busca en título/descripción/dirección/zona) y `from`/`to` (rango de fechas). El panel de reportes tiene chips de **estado** (activo/en revisión/resuelto/archivado) y filtro por **categoría**, además de la cola de "Moderación" ya existente. |
| **F2** | 🟠 | **`GET /users`** sin búsqueda, sin filtro por rol/estado, ni paginación (límite fijo 200). No se podían listar suspendidos/baneados. | ✅ Añadidos `q`, `role`, `status` (active/suspended/banned) + `limit/offset` + `total`; la respuesta incluye un `status` derivado por usuario. El panel de usuarios tiene chips **Todos/Activos/Suspendidos/Baneados** + selector de rol, resueltos en el backend. |
| **F3** | 🟡 | Los filtros de estado/rol vivían solo en el cliente (máx. 200 cargados) → un suspendido fuera de esa ventana era invisible. | ✅ Estado/rol se resuelven en el backend (UsersTab). La búsqueda de texto se refina localmente para respuesta instantánea. |

**Verificación:** `moderation-filters.test.ts` — status/role/q en usuarios y q/from/to en reportes.

---

## 4. Integración Telegram ✅ (implementada)

Cada reporte nuevo se envía automáticamente a un canal de Telegram.

**Qué envía** (`lib/telegram.ts`, enganchado en `POST /reports`):
1. **Captura del mapa** (imagen estática con marcador en las coordenadas) + el
   detalle como pie: categoría, urgencia, título, descripción, distrito, zona,
   dirección, coordenadas, enlace a Google Maps, autor y fecha (hora de Lima).
2. **Ubicación interactiva** (pin nativo de Telegram, `sendLocation`).
3. **Foto del reporte** si existe.

**Diseño seguro:**
- Es **best-effort y no bloqueante**: se dispara sin `await` en la respuesta; si
  Telegram falla o no está configurado, el reporte se crea igual.
- Si el mapa estático falla, cae a un mensaje de texto.
- Se activa **solo** si están las variables de entorno; si no, es no-op.

**Configuración (Render → Environment):**
- `TELEGRAM_BOT_TOKEN` — token del bot (crear con **@BotFather**).
- `TELEGRAM_CHAT_ID` — id del canal (añade el bot como administrador del canal y
  usa el id `-100…`).

**Verificación:** `telegram.test.ts` — no-op sin configurar (no hace `fetch`),
habilitado cuando ambas variables existen.

---

## Estado sano (lo que ya está bien)

- Strikes con historial, apelación y revocación; audit log.
- Baneo aplicado en login y en `requireAuth`.
- Registro sin escalada de privilegios + consentimiento server-side.
- Aislamiento multi-tenant por distrito en las consultas.
- 127 tests + typecheck en verde.
