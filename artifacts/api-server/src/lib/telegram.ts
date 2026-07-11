/**
 * telegram — envío de reportes a un canal de Telegram vía Bot API.
 *
 * Se activa SOLO si están configuradas las variables de entorno:
 *   TELEGRAM_BOT_TOKEN  — token del bot (BotFather)
 *   TELEGRAM_CHAT_ID    — id del canal/grupo destino (ej. -1001234567890)
 * Si faltan, las funciones son no-op (la creación de reportes nunca falla por
 * esto). Los envíos son best-effort: los errores se registran y se ignoran.
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Canal global de respaldo (opcional): destino cuando un distrito no tiene el
// suyo. En multi-distrito, cada distrito define su propio chat_id en la BD.
const GLOBAL_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : "";

/** El bot está operativo si hay token (los canales se resuelven por distrito). */
export function botEnabled(): boolean {
  return Boolean(TOKEN);
}

/** Mantiene compatibilidad: había consumidores que consultaban esto. */
export function telegramEnabled(): boolean {
  return Boolean(TOKEN && GLOBAL_CHAT_ID);
}

async function call(
  method: string,
  chatId: string,
  body: Record<string, unknown>,
): Promise<boolean> {
  if (!TOKEN || !chatId) return false;
  try {
    const res = await fetch(`${API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, ...body }),
      // Evita que un Telegram lento cuelgue el proceso
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Envía un mensaje de texto simple (usado por la confirmación de /vincular). */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<boolean> {
  return call("sendMessage", chatId, { text, parse_mode: "HTML" });
}

const CATEGORY_ES: Record<string, string> = {
  robbery: "🔪 Robo / Asalto",
  fight: "🥊 Pelea callejera",
  suspicious: "👁️ Actitud sospechosa",
  water_cut: "💧 Corte de agua",
  garbage: "🗑️ Basura acumulada",
  informal_commerce: "🛒 Comercio ilícito",
  noise: "🔊 Ruidos molestos",
  missing_person: "🔍 Persona desaparecida",
  fire: "🔥 Incendio",
  medical_emergency: "🚑 Emergencia médica",
  prostitution: "🏩 Prostíbulo / Local",
  drug_point: "💊 Punto de drogas",
  bar_trouble: "🍺 Bar problemático",
  lost_pet: "🐾 Mascota perdida",
  power_outage: "⚡ Corte de luz",
  street_damage: "🚧 Pista/vereda dañada",
  stray_dogs: "🐕 Perros callejeros",
  flooding: "🌊 Inundación/Huaico",
  other: "📌 Otro",
};

const URGENCY_ES: Record<string, string> = {
  low: "🟢 Baja",
  medium: "🟡 Media",
  high: "🟠 Alta",
  critical: "🔴 Crítica",
};

function esc(s: string): string {
  // Escapa para parse_mode HTML de Telegram
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export interface ReportForTelegram {
  id: number | string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  sector?: string | null;
  districtName?: string | null;
  authorName?: string | null;
  isAnonymous?: boolean;
  imageUrl?: string | null;
  audioUrl?: string | null;
  createdAt?: Date | string;
}

/**
 * Deriva una URL de audio compatible con Telegram. Cloudinary transcodifica al
 * cambiar la extensión: forzamos .mp3 para que sendAudio reproduzca siempre
 * (los .webm/.mp4 del navegador no siempre son aceptados).
 */
export function telegramAudioUrl(url: string): string {
  if (/res\.cloudinary\.com/.test(url)) {
    return url.replace(/\.(webm|mp4|m4a|ogg|oga|wav|aac|opus)(\?.*)?$/i, ".mp3");
  }
  return url;
}

/** URL de mapa estático (sin API key) con un marcador en las coordenadas. */
function staticMapUrl(lat: number, lng: number): string {
  const c = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${c}&zoom=16&size=640x360&maptype=mapnik&markers=${c},red-pushpin`;
}

function buildCaption(r: ReportForTelegram): string {
  const cat = CATEGORY_ES[r.category] ?? `📌 ${esc(r.category)}`;
  const urg = URGENCY_ES[r.urgency] ?? esc(r.urgency);
  const lat = r.latitude.toFixed(6);
  const lng = r.longitude.toFixed(6);
  const gmaps = `https://www.google.com/maps?q=${lat},${lng}`;
  const when = r.createdAt ? new Date(r.createdAt) : new Date();
  const author = r.isAnonymous ? "Anónimo" : esc(r.authorName || "Vecino");
  const lines = [
    `🚨 <b>NUEVO REPORTE</b> — ${cat}`,
    `<b>Urgencia:</b> ${urg}`,
    "",
    `<b>${esc(r.title)}</b>`,
    esc(r.description),
    "",
  ];
  if (r.districtName) lines.push(`🏙️ <b>Distrito:</b> ${esc(r.districtName)}`);
  if (r.sector) lines.push(`📍 <b>Zona:</b> ${esc(r.sector)}`);
  if (r.address) lines.push(`🏠 <b>Dirección:</b> ${esc(r.address)}`);
  lines.push(`🧭 <b>Coordenadas:</b> <code>${lat}, ${lng}</code>`);
  lines.push(`🗺️ <a href="${gmaps}">Ver en Google Maps</a>`);
  lines.push(`👤 <b>Autor:</b> ${author}`);
  lines.push(
    `🕒 ${when.toLocaleString("es-PE", { timeZone: "America/Lima" })} · #${r.id}`,
  );
  // Telegram limita la caption a 1024 caracteres
  return lines.join("\n").slice(0, 1024);
}

/**
 * Envía un reporte al canal de Telegram indicado (el del distrito) o, si no se
 * pasa, al canal global de respaldo. Envía captura del mapa + detalle, la
 * ubicación interactiva y, si existe, la foto del reporte. No lanza; devuelve
 * false si no hay bot/canal o falló todo.
 */
export async function notifyReportToTelegram(
  r: ReportForTelegram,
  chatIdOverride?: string | null,
): Promise<boolean> {
  const chatId = chatIdOverride || GLOBAL_CHAT_ID;
  if (!TOKEN || !chatId) return false;
  const caption = buildCaption(r);

  // 1) Captura del mapa (foto) con el detalle como caption. Si el mapa estático
  //    falla (servicio comunitario), caemos a un mensaje de texto.
  const sentPhoto = await call("sendPhoto", chatId, {
    photo: staticMapUrl(r.latitude, r.longitude),
    caption,
    parse_mode: "HTML",
  });
  if (!sentPhoto) {
    await call("sendMessage", chatId, {
      text: caption,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    });
  }

  // 2) Ubicación interactiva (pin nativo de Telegram)
  await call("sendLocation", chatId, {
    latitude: r.latitude,
    longitude: r.longitude,
  });

  // 3) Foto adjunta del reporte, si la hay
  if (r.imageUrl) {
    await call("sendPhoto", chatId, {
      photo: r.imageUrl,
      caption: `📷 Evidencia · #${r.id}`,
    });
  }

  // 4) Nota de voz, si la hay (como audio mp3 para máxima compatibilidad)
  if (r.audioUrl) {
    await call("sendAudio", chatId, {
      audio: telegramAudioUrl(r.audioUrl),
      title: `Nota de voz · #${r.id}`,
      performer: "Radar Vecinal",
    });
  }

  return true;
}
