/**
 * alertSound — motor único de sonido/vibración para alertas y notificaciones.
 *
 * Reemplaza dos implementaciones divergentes (usePanicAlertStream +
 * useProximitySound) y corrige sus fallos:
 *   · Respeta SIEMPRE las preferencias (silencio maestro + horario de silencio).
 *   · Reutiliza UN solo AudioContext (antes se creaba uno por alerta → fuga).
 *   · Desbloquea el audio en el primer gesto del usuario (política de autoplay).
 *   · Sonidos distintos por tipo con envolventes suaves (sin "clicks") y
 *     vibración por severidad.
 *
 * Preferencias (localStorage, compartidas con Ajustes):
 *   rvs_sound "true|false" · rvs_quietHours "true|false" ·
 *   rvs_quietStart/rvs_quietEnd "HH:MM"
 */

type ToneSpec = {
  f: number; // frecuencia (Hz)
  f2?: number; // si se define, barrido lineal hasta f2
  type?: OscillatorType;
  at: number; // inicio relativo (s)
  dur: number; // duración (s)
  vol?: number; // 0..1 relativo al master
};

const MASTER = 0.22; // volumen global (audible sin ser estridente)

let ctx: AudioContext | null = null;
let unlockBound = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return ctx;
}

// Desbloqueo por gesto: los navegadores suspenden el audio hasta que el usuario
// interactúa. Al primer toque/tecla reanudamos el contexto para que las alertas
// posteriores suenen aunque lleguen sin interacción.
function bindUnlock() {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const resume = () => {
    getCtx()?.resume().catch(() => {});
  };
  ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    window.addEventListener(ev, resume, { passive: true }),
  );
}
bindUnlock();

/** true si el usuario silenció el sonido o estamos en horario de silencio. */
export function soundMuted(): boolean {
  try {
    if (localStorage.getItem("rvs_sound") === "false") return true;
    if (localStorage.getItem("rvs_quietHours") === "true") {
      const s = (localStorage.getItem("rvs_quietStart") ?? "22:00").split(":").map(Number);
      const e = (localStorage.getItem("rvs_quietEnd") ?? "07:00").split(":").map(Number);
      const now = new Date();
      const cur = now.getHours() * 60 + now.getMinutes();
      const sm = s[0] * 60 + (s[1] ?? 0);
      const em = e[0] * 60 + (e[1] ?? 0);
      if (sm <= em) {
        if (cur >= sm && cur < em) return true;
      } else {
        // rango que cruza medianoche (p. ej. 22:00 → 07:00)
        if (cur >= sm || cur < em) return true;
      }
    }
  } catch {
    /* localStorage no disponible */
  }
  return false;
}

function tone(c: AudioContext, t0: number, s: ToneSpec) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = s.type ?? "sine";
  const start = t0 + s.at;
  osc.frequency.setValueAtTime(s.f, start);
  if (s.f2 !== undefined) osc.frequency.linearRampToValueAtTime(s.f2, start + s.dur);

  // Envolvente: ataque corto + liberación suave (evita clicks/pops).
  const peak = Math.max(0.0002, (s.vol ?? 1) * MASTER);
  const attack = 0.008;
  const release = Math.min(0.12, s.dur * 0.5);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + attack);
  g.gain.setValueAtTime(peak, start + Math.max(attack, s.dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, start + s.dur);

  osc.connect(g);
  g.connect(c.destination);
  osc.start(start);
  osc.stop(start + s.dur + 0.02);
}

// ── Partituras por tipo de alerta ───────────────────────────────────────────
const SCORES: Record<string, ToneSpec[]> = {
  // Robo: sirena policial de dos tonos, urgente pero clara
  robbery: [
    { f: 880, type: "triangle", at: 0.0, dur: 0.18 },
    { f: 660, type: "triangle", at: 0.2, dur: 0.18 },
    { f: 880, type: "triangle", at: 0.4, dur: 0.18 },
    { f: 660, type: "triangle", at: 0.6, dur: 0.24 },
  ],
  // Incendio: gorjeo rápido ascendente/descendente (alarma de fuego)
  fire: [
    { f: 1000, f2: 1350, type: "sawtooth", at: 0.0, dur: 0.16, vol: 0.85 },
    { f: 1350, f2: 1000, type: "sawtooth", at: 0.18, dur: 0.16, vol: 0.85 },
    { f: 1000, f2: 1350, type: "sawtooth", at: 0.36, dur: 0.16, vol: 0.85 },
    { f: 1350, f2: 1000, type: "sawtooth", at: 0.54, dur: 0.2, vol: 0.85 },
  ],
  // Médica: dos tonos tipo ambulancia, más pausado
  medical: [
    { f: 800, type: "sine", at: 0.0, dur: 0.34 },
    { f: 620, type: "sine", at: 0.36, dur: 0.34 },
    { f: 800, type: "sine", at: 0.72, dur: 0.38 },
  ],
  // Pelea: staccato corto y seco
  fight: [
    { f: 720, type: "square", at: 0.0, dur: 0.1, vol: 0.75 },
    { f: 720, type: "square", at: 0.16, dur: 0.1, vol: 0.75 },
    { f: 720, type: "square", at: 0.32, dur: 0.13, vol: 0.75 },
  ],
  // Extraviado: campanilla descendente suave (búsqueda, no pánico)
  missing_person: [
    { f: 880, type: "sine", at: 0.0, dur: 0.28 },
    { f: 698, type: "sine", at: 0.26, dur: 0.28 },
    { f: 587, type: "sine", at: 0.52, dur: 0.44 },
  ],
  // General: dos notas ascendentes
  other: [
    { f: 660, type: "sine", at: 0.0, dur: 0.2 },
    { f: 880, type: "sine", at: 0.18, dur: 0.3 },
  ],
};

// Notificación no urgente (confirmaciones, avisos): campanilla breve y sutil
const NOTIFY: ToneSpec[] = [
  { f: 987, type: "sine", at: 0.0, dur: 0.14, vol: 0.6 },
  { f: 1319, type: "sine", at: 0.12, dur: 0.24, vol: 0.6 },
];

// Vibración por severidad (ms on/off)
const VIBE: Record<string, number[]> = {
  robbery: [120, 60, 120, 60, 200],
  fire: [90, 50, 90, 50, 90, 50, 220],
  medical: [200, 100, 200],
  fight: [80, 40, 80, 40, 80],
  missing_person: [80, 40, 80],
  other: [100],
  notify: [40],
};

function render(specs: ToneSpec[], force = false) {
  if (!force && soundMuted()) return;
  const c = getCtx();
  if (!c) return;
  const go = () => {
    const t0 = c.currentTime + 0.02;
    for (const s of specs) tone(c, t0, s);
  };
  if (c.state === "suspended") c.resume().then(go).catch(() => {});
  else go();
}

/**
 * Reproduce el sonido de alerta del tipo indicado (fallback: "other").
 * `force` ignora el silencio/horario — úsalo solo para la vista previa en Ajustes.
 */
export function playAlertSound(type: string, force = false) {
  render(SCORES[type] ?? SCORES.other, force);
}

/** Campanilla suave para notificaciones no urgentes. */
export function playNotificationChime() {
  render(NOTIFY);
}

/** Vibra según el tipo. Respeta el silencio/horario (haptics = parte del aviso). */
export function vibrateForType(type: string) {
  if (soundMuted()) return;
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(VIBE[type] ?? VIBE.other);
    }
  } catch {
    /* vibración no soportada */
  }
}

/** Aviso completo de alerta: sonido + vibración, respetando preferencias. */
export function alertUser(type: string) {
  playAlertSound(type);
  vibrateForType(type);
}

// Lista de tipos con partitura (para previews/ajustes)
export const ALERT_SOUND_TYPES = Object.keys(SCORES);
