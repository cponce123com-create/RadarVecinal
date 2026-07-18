/**
 * voiceAlerts.ts — Avisos por voz (Text-to-Speech) + preferencias.
 *
 * Usa la Web Speech API (speechSynthesis), la voz del propio dispositivo, para
 * anunciar en español "El camión recolector está cerca de tu casa" — sin costo,
 * sin audios, sin servidor. Guarda la ubicación de la casa y las preferencias
 * en localStorage (solo en este dispositivo).
 *
 * Limitación conocida: los navegadores suspenden el audio en segundo plano, así
 * que la voz funciona con la app abierta. Para avisos con la app cerrada haría
 * falta push (FCM) o el APK nativo (fases posteriores).
 */
import type { LiveProviderType } from "./liveProviders";

// ── Text-to-Speech ──────────────────────────────────────────────────────────

let _voices: SpeechSynthesisVoice[] = [];

function refreshVoices() {
  try {
    _voices = window.speechSynthesis?.getVoices?.() ?? [];
  } catch {
    _voices = [];
  }
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  refreshVoices();
  // getVoices() suele estar vacío hasta este evento.
  window.speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
}

export function isVoiceSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Mejor voz en español disponible: prioriza Perú → LatAm → cualquiera es-*. */
function pickSpanishVoice(): SpeechSynthesisVoice | null {
  if (_voices.length === 0) refreshVoices();
  const byLang = (re: RegExp) => _voices.find((v) => re.test(v.lang || ""));
  return (
    byLang(/^es[-_]?PE/i) ||
    byLang(/^es[-_]?419/i) ||
    byLang(/^es[-_]?(MX|CO|CL|AR|US)/i) ||
    byLang(/^es/i) ||
    null
  );
}

/** Habla un texto en español. No falla si el dispositivo no soporta TTS. */
export function speak(text: string): void {
  if (!isVoiceSupported()) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-PE";
    u.rate = 1;
    u.pitch = 1;
    const v = pickSpanishVoice();
    if (v) u.voice = v;
    window.speechSynthesis.cancel(); // evita solapar avisos
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

// Elemento de audio reutilizable para los clips grabados (se "desbloquea" con
// el primer gesto del usuario, igual que el TTS).
let _clipAudio: HTMLAudioElement | null = null;
function clipAudio(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!_clipAudio) _clipAudio = new Audio();
  return _clipAudio;
}

/** Reproduce un clip de audio (voz grabada). Devuelve una promesa best-effort. */
export function playClip(url: string): void {
  const a = clipAudio();
  if (!a) return;
  try {
    a.src = url;
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

/**
 * Desbloquea el audio: los navegadores exigen un gesto del usuario antes de
 * poder hablar/reproducir. Llamar desde un onClick. Devuelve true si se soporta.
 */
export function unlockAndTestVoice(sample = "Avisos por voz activados."): boolean {
  // Prime del elemento de audio de clips (permite reproducir luego sin gesto).
  try {
    const a = clipAudio();
    if (a) { a.muted = true; void a.play().then(() => { a.pause(); a.muted = false; }).catch(() => { a.muted = false; }); }
  } catch { /* ignore */ }
  if (!isVoiceSupported()) return false;
  speak(sample);
  return true;
}

// ── Ubicación de la casa ────────────────────────────────────────────────────

const HOME_KEY = "rv_home_location";

export interface HomeLocation {
  lat: number;
  lng: number;
  savedAt: number;
}

export function getHome(): HomeLocation | null {
  try {
    const raw = localStorage.getItem(HOME_KEY);
    return raw ? (JSON.parse(raw) as HomeLocation) : null;
  } catch {
    return null;
  }
}

export function setHome(lat: number, lng: number): HomeLocation {
  const home = { lat, lng, savedAt: Date.now() };
  try { localStorage.setItem(HOME_KEY, JSON.stringify(home)); } catch { /* ignore */ }
  return home;
}

export function clearHome(): void {
  try { localStorage.removeItem(HOME_KEY); } catch { /* ignore */ }
}

// ── Preferencias de avisos por voz ──────────────────────────────────────────

const PREFS_KEY = "rv_voice_prefs";

export interface VoicePrefs {
  enabled: boolean;
  distanceM: number; // umbral de cercanía
  types: LiveProviderType[]; // qué servicios anunciar
}

const DEFAULT_PREFS: VoicePrefs = {
  enabled: false,
  distanceM: 300,
  types: ["recolector"],
};

export function getVoicePrefs(): VoicePrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<VoicePrefs>) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function setVoicePrefs(patch: Partial<VoicePrefs>): VoicePrefs {
  const next = { ...getVoicePrefs(), ...patch };
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  // Avisar a los watchers en la misma pestaña (localStorage 'storage' no dispara
  // en la pestaña que escribe).
  try { window.dispatchEvent(new CustomEvent("rv:voice-prefs-changed")); } catch { /* ignore */ }
  return next;
}

// ── Utilidad de distancia (haversine) ───────────────────────────────────────
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
