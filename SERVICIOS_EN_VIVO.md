# Servicios en Vivo — Rastreo GPS en tiempo real

Rama: `claude/production-readiness-audit-3pgip6`

Permite que un **transmisor** comparta su ubicación GPS en vivo y que los
**vecinos** lo vean moverse por el mapa del distrito. Pensado para:

- 🚛 **Camión recolector** — saber cuándo pasa la basura por tu cuadra.
- 🍞 Panadero · 🥛 Lechero · 🫔 Tamalero · 🔥 Gasero · 💧 Aguatero — ambulantes
  que recorren el distrito y muchas veces buscamos sin saber dónde están.
- 🍲 **"Vendo comida hoy"** (domingos) — pollada, patasca, tamales… con una
  etiqueta libre que escribe el propio vendedor.

## Cómo se usa

**Transmisor** (menú → *Servicios en vivo*, ruta `/en-vivo`):
1. Elige qué es. Para "vendedor"/"otro" escribe qué ofrece hoy.
2. Pulsa **Iniciar transmisión**. La app pide permiso de ubicación.
3. Mientras transmite: indicador 🔴 EN VIVO, tiempo transcurrido y precisión GPS.
   La pantalla se mantiene encendida (Wake Lock, best-effort).
4. **Detener** deja de compartir. La sesión se guarda en el dispositivo, así que
   se puede navegar por la app o recargar sin cortar la transmisión.

**Vecino** (mapa): el toggle **En vivo** (esquina superior derecha) muestra u
oculta los marcadores. Cada uno tiene su emoji y un popup con el nombre, qué
vende y hace cuánto se le vio.

## Diseño técnico

- **Tabla** `live_providers` (migración `0029_live_providers.sql`): distrito,
  usuario opcional, tipo, etiqueta libre, nombre, lat/lng, `is_active`,
  `broadcast_key`, `started_at`, `updated_at` (= última vez visto).
- **API** (`routes/live.ts`):
  - `POST /live/start` → crea la transmisión, devuelve `{ id, broadcastKey }`.
  - `POST /live/:id/ping` → actualiza lat/lng (requiere `broadcastKey`).
  - `POST /live/:id/stop` → finaliza (requiere `broadcastKey`).
  - `GET  /live?districtId=` → activos y **frescos** (ping < 3 min) del distrito.
- **Autorización**: la `broadcastKey` (secreta, devuelta al iniciar) autoriza
  ping/stop **sin sesión iniciada**, porque muchos ambulantes no tienen cuenta.
  Si el transmisor sí está logueado, se enlaza su `userId` y al reiniciar se
  cierran sus transmisiones anteriores (evita duplicados fantasma).
- **Expiración perezosa**: al listar/consultar, las transmisiones sin ping en
  3 minutos se marcan inactivas (el transmisor cerró la app o perdió señal).
- **Frontend**:
  - `lib/liveProviders.ts` — catálogo de tipos + helpers de API (usa
    `customFetch`, que ya resuelve base URL de Capacitor y el token).
  - `pages/LiveBroadcast.tsx` — modo transmisor (watchPosition + ping cada ~10 s
    + Wake Lock + persistencia local de la sesión).
  - `components/LiveProvidersLayer.tsx` — capa del mapa (polling 12 s); los
    marcadores se mueven al llegar nuevos pings.
  - Integrado en `MapPage` con un toggle mostrar/ocultar y contador en vivo.

## Seguimiento en segundo plano (APK nativo)

`lib/backgroundGeo.ts` unifica el seguimiento con dos implementaciones:

- **APK nativo (Capacitor)** → `@capacitor-community/background-geolocation`.
  Usa un **servicio en primer plano con notificación persistente** ("Radar
  Vecinal está compartiendo tu ubicación"), de modo que el GPS sigue enviando
  ubicaciones **aunque la pantalla esté apagada o la app en segundo plano** —
  clave para el camión recolector que transmite durante horas.
- **Web** → `navigator.geolocation.watchPosition` (solo primer plano) + Wake
  Lock para que la pantalla no se suspenda.

Detalles:
- El watcher vive a nivel de módulo: la transmisión **no se corta al navegar**
  por la app y no se duplica al re-montar la página.
- El plugin se referencia con `registerPlugin("BackgroundGeolocation")`, así el
  **bundle web no incluye código nativo** (la rama nativa nunca se ejecuta en
  web).
- Permisos Android: el manifest del plugin ya declara `ACCESS_FINE/COARSE_LOCATION`,
  `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS` y el
  servicio con `foregroundServiceType="location"`. `cap sync` los fusiona en la
  app automáticamente — **sin edición manual del manifest**.
- Build: tanto `build-apk.sh` como `.github/workflows/android.yml` hacen
  `pnpm install --frozen-lockfile` + `cap sync android`, que instalan el plugin
  e incluyen su módulo Android. El lockfile ya está actualizado.

> Nota: en Android 13+ el usuario debe conceder el permiso de notificaciones
> para ver el aviso del servicio; si lo rechaza, la transmisión sigue pero sin
> notificación visible. El plugin solicita el permiso de ubicación al iniciar.

## Modo prueba (superadmin)

Para probar la función sin salir a la calle, un **superadmin** ve en
`/en-vivo` un toggle **"Modo prueba (superadmin)"**. Al activarlo e iniciar:

- No usa el GPS real: `lib/simulateRoute.ts` genera un **recorrido que se mueve
  solo** alrededor del centro del distrito (paseo aleatorio suave, ~20 m/paso,
  acotado a ~650 m para no salirse del distrito).
- Alimenta exactamente el mismo flujo que una transmisión real (crea la sesión y
  envía pings), así se prueba la ruta completa backend + mapa.
- Queda **marcado como `🧪 PRUEBA`** en el mapa y con un badge *MODO PRUEBA* en
  la pantalla del transmisor, para no confundirlo con un vendedor real.
- Se detiene con **Detener** (o expira solo a los 3 min). Solo visible para
  `super_admin`; no cambia nada en el backend (es una ayuda de cliente).

Para verlo moverse: activa el toggle **"En vivo"** en el mapa (esquina superior
derecha) — el marcador 🧪 avanza cada ~12 s (intervalo de refresco del mapa).

## Privacidad

- Solo se comparte la ubicación **mientras** el transmisor está transmitiendo;
  al **Detener** (o al expirar por inactividad) desaparece del mapa.
- La ubicación es voluntaria y explícita (el propio proveedor la activa).
- El `broadcast_key` nunca se expone en `GET /live` (solo se devuelve a quien
  inicia la transmisión).

## Pruebas

`src/__tests__/live-providers.test.ts` (3 tests, Postgres real): ciclo completo
start→ping→list→stop, rechazo de ping con clave equivocada, y vendedor con
etiqueta libre. Suite total: **149 tests en verde**.
