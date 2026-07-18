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

## Ruta recorrida (línea verde) + historial por fecha

Cada transmisión guarda su **ruta** como puntos (breadcrumbs), submuestreados:
solo se guarda un punto si el transmisor avanzó **≥ 12 m** desde el último
(ruta fiel sin inflar la base de datos), con un tope de 5 000 puntos por
transmisión.

- **En vivo** (`components/LiveProvidersLayer.tsx`): para el **camión
  recolector** se dibuja una **línea verde** desde que inició su transmisión, así
  la ciudadanía ve por dónde pasó y comprueba si pasó por su casa. Se refresca
  cada 12 s.
- **Historial** (`pages/LiveHistory.tsx`, ruta `/rutas`, menú *Historial de
  rutas*): eliges una **fecha** (y opcionalmente el tipo de servicio) y ves todas
  las rutas de ese día en tu distrito. Al seleccionar una, se dibuja su recorrido
  en un mapa con inicio (🔵) y fin (🟢/🔴 si sigue en curso), más **duración,
  distancia total y nº de puntos**.

Backend (`routes/live.ts`), tabla `live_tracks` (migración `0030`):
- `POST /live/start` inserta el primer punto.
- `POST /live/:id/ping` inserta un punto si avanzó ≥ 12 m (haversine).
- `GET /live/:id/track` → puntos de una ruta en orden (línea en vivo o detalle).
- `GET /live/history?districtId=&from=&to=&type=` → resumen de rutas por rango
  (el cliente manda `from`/`to` del día local; el servidor no asume zona horaria).

## ¿Pasó el recolector por mi casa?

En `/rutas`, una tarjeta permite al vecino compartir su ubicación (GPS) y saber,
para la fecha elegida, **si el camión pasó cerca, a qué hora y a cuántos metros**:

- `GET /live/passed?districtId=&lat=&lng=&from=&to=&type=`: acota con una caja
  delimitadora (~2 km, índices de `live_tracks`) y calcula la distancia exacta
  (haversine) sobre los candidatos para hallar el punto de ruta más cercano.
- Devuelve `{ nearest: { distanceMeters, at, providerId } | null, passedNear,
  thresholdMeters }`. `passedNear` es true si el punto más cercano quedó a ≤ 60 m.
- La UI responde: *"Sí pasó. El recolector estuvo a 25 m de tu casa a las 08:14"*,
  o *"No pasó muy cerca (lo más cerca: 340 m a las 08:20)"*, o *"No pasó cerca"*.

## Dispositivos oficiales (celular montado / GPS vehicular)

Para que el camión recolector transmita **sin operador ni login**, la
municipalidad registra un **dispositivo** desde el panel admin (pestaña
**Recolector**):

- Se crea un dispositivo con un nombre y tipo → el sistema genera una
  **`deviceKey`** secreta y un **enlace** `…/en-vivo?device=CLAVE`.
- Ese enlace se abre **una vez** en el celular montado en el camión (con chip):
  entra en **modo dispositivo**, pide la ubicación y **transmite solo**,
  marcado como **✓ Oficial** en el mapa, con su ruta e historial. Reanuda al
  recargar (la clave va en la URL) y usa el servicio en segundo plano del APK.
- El admin puede **habilitar/deshabilitar, renombrar o eliminar** el dispositivo;
  deshabilitarlo corta su transmisión al instante.

Backend (`routes/live.ts`, tabla `live_devices`, migración `0031`):
- `GET/POST /live/devices`, `PATCH/DELETE /live/devices/:id` — gestión (nivel
  municipalidad, aislado por distrito).
- `GET /live/device/:deviceKey` — info pública para el modo dispositivo.
- `POST /live/device/:deviceKey/ping` — **ingesta de ubicación sin login**:
  busca o crea UNA transmisión activa por dispositivo (verificada), actualiza
  posición y agrega punto de ruta. **La misma clave sirve para un GPS vehicular**
  que reporte por HTTP (o vía un puente Traccar) el día que se quiera migrar.
- `POST /live/device/:deviceKey/stop` — finaliza.

`live_providers` gana `deviceId` + `verified` (distintivo "Oficial" en el mapa).

## Avisos por voz — "el recolector está cerca de tu casa" (v1)

Como cuando navegas con Maps y te avisa por voz, la app anuncia en **español**
cuando un servicio en vivo se acerca a tu casa. **Sin costo ni audios**: usa la
voz del propio dispositivo (Web Speech API `speechSynthesis`).

- **Ajustes → Avisos por voz:** activas el aviso, **marcas tu casa** (con GPS,
  guardada solo en tu dispositivo), eliges la **distancia** (200/300/500 m) y
  **qué servicios** anunciar (recolector por defecto; también panadero, lechero,
  gasero, agua…). Botón "Probar voz".
- **Cómo funciona** (`lib/voiceAlerts.ts` + `hooks/useProximityVoice.ts`, montado
  global en `App`): con la app abierta consulta la posición en vivo cada 12 s,
  calcula la distancia a tu casa y, al **cruzar el umbral acercándose**, dice
  *"El camión recolector está a unos 300 metros de tu casa"* — una sola vez, con
  enfriamiento de 8 min para no repetir.
- El audio requiere un gesto del usuario (los navegadores lo exigen): al activar
  el aviso se desbloquea con un mensaje de confirmación.

**Limitación (honesta):** los navegadores suspenden el audio en segundo plano,
así que la **voz** suena **con la app abierta**. Con la app cerrada llega un
**push** (fase 2, abajo); leerlo en voz alta en segundo plano requiere el APK
nativo (fase 3).

### Fase 2 — Push con la app cerrada

La detección de cercanía también corre **en el servidor**, así el aviso llega
aunque la app esté cerrada (push FCM, como el pánico).

- El vecino, al activar los avisos y marcar su casa, registra en el servidor su
  **casa + token push** (`lib/proximityPush.ts`, solo en el APK nativo; en web
  es no-op). `PUT/DELETE /live/proximity-subscription` (tabla
  `proximity_subscriptions`, migración `0033`).
- Cuando un proveedor se mueve (`/live/:id/ping` y `/live/device/:key/ping`), el
  servidor ejecuta `notifyProximity`: busca las casas del distrito dentro del
  radio que siguen ese tipo y, respetando un **enfriamiento de 8 min por
  (vecino, tipo)**, envía el push (`lib/fcm.ts#sendProximityPush`). El texto usa
  la **frase del clip de voz** si existe, si no una por defecto.
- **Nota nativa (al compilar el APK):** requiere `FCM_SERVICE_ACCOUNT` en el
  servidor y crear el canal de notificación Android `live-services` (como
  `panic-alerts`). En web no hay push (haría falta Web Push + service worker).

### Voz propia grabada (acento local) — panel admin → "Audios"

En vez del TTS robótico, el superadmin/municipalidad puede **grabar su propia
voz** (o subir un audio) por tipo de servicio y distrito: *"Vecino, la tamalera
está cerca"*. La app reproduce ese clip en el aviso de cercanía; si no hay clip,
usa el TTS como respaldo.

- Panel admin, pestaña **Audios**: por cada servicio (recolector, tamalero,
  panadero, lechero, gasero, agua) puede **grabar** (≤20 s, reutiliza
  `VoiceNoteRecorder` → Cloudinary), **subir** un archivo, **escuchar**, editar
  la **frase** (respaldo TTS), activar/desactivar y **quitar** el audio.
- Backend (tabla `live_voice_clips`, migración `0032`, único por distrito+tipo):
  - `GET /live/voice-clips?districtId=` (público) — la app del vecino los
    obtiene para reproducirlos.
  - `PUT /live/voice-clips` (municipalidad, aislado por distrito) — upsert.
  - `DELETE /live/voice-clips/:id` (municipalidad).
- Reproducción: `lib/voiceAlerts.ts#playClip` usa un `<audio>` que se desbloquea
  con el mismo gesto del usuario que activa los avisos; `useProximityVoice`
  reproduce el clip del tipo si existe, si no habla por TTS.

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

### Panel de diagnóstico (superadmin)

Al final de `/en-vivo`, el superadmin ve **"Transmisiones activas (todos los
distritos)"** (`GET /live/all`, solo super_admin): lista cada transmisión con su
**distrito** y hace cuánto se vio. Sirve para resolver el caso típico *"no lo veo
en el otro celular"*: **una transmisión solo aparece en el mapa de quien está en
el mismo distrito**. Si la fila dice *"otro distrito"* respecto al que tienes
seleccionado, ese es el desajuste — pon ambos celulares en el mismo distrito con
el selector de arriba.

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
