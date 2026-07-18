# Push en Android — configurar Firebase (una sola vez)

Para que las notificaciones push funcionen en el APK (alertas de pánico y avisos
de "servicios en vivo" con la app cerrada) hace falta Firebase. El código ya
está listo; solo falta esta configuración de tu cuenta.

## 1. Crear el proyecto Firebase y la app Android

1. Entra a <https://console.firebase.google.com> → **Agregar proyecto**.
2. Dentro del proyecto → **Agregar app** → **Android**.
3. **Nombre del paquete (obligatorio, exacto):** `pe.miradar.vecinal`
   (es el `appId` de `capacitor.config.ts`).
4. Descarga el archivo **`google-services.json`** que te da Firebase.

## 2. Guardar el archivo como secreto de GitHub

No subas `google-services.json` al repo. En su lugar:

1. Abre el contenido del `google-services.json` (es un JSON).
2. GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**.
3. Nombre: **`GOOGLE_SERVICES_JSON`**
   Valor: **pega el contenido completo del JSON** (tal cual, con sus llaves).
4. Guardar.

El workflow del APK (`.github/workflows/android.yml`) detecta ese secreto y, al
compilar, escribe el archivo y aplica el plugin de Google Services. Si el
secreto no está, el APK igual se compila pero sin push.

## 3. Configurar el servidor (envío de push)

En **Render** (backend), agrega la variable de entorno:

- **`FCM_SERVICE_ACCOUNT`** = el JSON de la **cuenta de servicio** de Firebase.
  Se obtiene en: Firebase Console → **Configuración del proyecto → Cuentas de
  servicio → Generar nueva clave privada** (descarga un JSON; pega su contenido
  como valor de la variable).

## 4. Compilar y probar

1. GitHub → **Actions → 📱 Build Android APK → Run workflow** → rama
   `claude/production-readiness-audit-3pgip6` (o `main` si ya se mergeó).
2. Descarga el APK del artefacto, instálalo en el teléfono.
3. En **Ajustes → Avisos por voz**: activa, marca tu casa. Acepta el permiso de
   notificaciones.
4. Prueba: con la app cerrada, que otro teléfono transmita el recolector cerca de
   tu casa → debe llegar la notificación.

## Notas

- El push muestra **texto + sonido** ("La tamalera está cerca de tu casa"). El
  audio grabado (tu voz) suena con la **app abierta**; reproducirlo como sonido
  de la notificación en segundo plano queda para una fase nativa posterior.
- Canales de notificación Android (`panic-alerts`, `live-services`) ya se crean
  solos al registrar el push.
