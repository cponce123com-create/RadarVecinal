# Telegram — 1 bot, N canales (uno por distrito)

Radar Vecinal envía cada reporte al **canal del distrito** correspondiente. Un
**único bot** publica en todos los canales; lo único que cambia por distrito es
el `chat_id` del canal, guardado en la base de datos.

## 1. Variables de entorno (Render → Environment)

| Variable | Qué es | Obligatoria |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Token del bot (BotFather). | Sí |
| `TELEGRAM_WEBHOOK_SECRET` | Cadena secreta que eliges tú (p. ej. 32 hex). Protege el webhook. | Sí (para `/vincular`) |
| `TELEGRAM_BOT_USERNAME` | Usuario del bot, ej. `radar_vecinal_bot` (sin @). | Recomendada |
| `TELEGRAM_CHAT_ID` | Canal **global de respaldo** (opcional): destino si un distrito aún no tiene canal. | No |

> ⚠️ El token es una credencial. No lo pongas en el código ni lo compartas en
> chats. Si se expuso, regenéralo en **@BotFather → /revoke** y actualízalo en
> Render.

## 2. Registrar el webhook (una sola vez)

Necesario solo para la auto-vinculación con `/vincular`. Ejecuta (reemplaza los
valores):

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<TU-DOMINIO-RENDER>/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Comprobar: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`.

## 3. Vincular el canal de un distrito

Dos formas (ambas disponibles):

### A) Desde el panel (tú, superadmin)
`Administración → Panel de Super Administrador → Canales de Telegram`.
Pega el `chat_id` del canal (formato `-100…`) y **Guardar**. Ahí mismo puedes
**Desvincular**.

### B) Auto-vinculación por comando (la municipalidad, sin copiar ids)
1. La municipalidad crea su canal en Telegram.
2. Agrega **@radar_vecinal_bot** como **administrador** del canal.
3. Publica en el canal: `/vincular CÓDIGO`
   (el código aparece por distrito en el panel; hay un botón "Copiar").
4. El bot responde ✅ y desde ese momento los reportes de ese distrito llegan
   a ese canal.

## 4. Qué se envía por cada reporte

- **Captura del mapa** (imagen con marcador) + detalle: categoría, urgencia,
  título, descripción, distrito, zona, dirección, coordenadas, enlace a Google
  Maps, autor y hora (Lima).
- **Ubicación interactiva** (pin nativo).
- **Foto del reporte**, si la tiene.

## 5. Notas

- Si un distrito no tiene canal y no hay `TELEGRAM_CHAT_ID` global, ese reporte
  simplemente no se envía a Telegram (el reporte se crea con normalidad).
- El envío es best-effort y **no bloquea** la creación del reporte.
- Para el detalle: si el reporte es anónimo, el autor aparece como "Anónimo".
- Añadir un distrito nuevo = crear su canal y vincularlo (panel o `/vincular`);
  no hay que tocar código ni variables de entorno.
