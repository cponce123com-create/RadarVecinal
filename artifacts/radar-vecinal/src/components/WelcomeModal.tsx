/**
 * WelcomeModal — Mini-introducción amigable la primera vez que se abre la app.
 *
 * Explica en lenguaje sencillo qué se puede hacer. Se muestra una sola vez
 * (bandera en localStorage). Se puede volver a abrir desde Ajustes con
 * `openWelcome()` (dispara un evento que este componente escucha).
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

const SEEN_KEY = "rv_welcome_seen_v1";
const OPEN_EVENT = "rv:open-welcome";

/** Reabrir la introducción (p. ej. desde Ajustes). */
export function openWelcome() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

interface Slide { emoji: string; title: string; body: string }
const SLIDES: Slide[] = [
  {
    emoji: "👋",
    title: "Bienvenido a Radar Vecinal",
    body: "La app de seguridad y servicios de tu barrio. Aquí te enteras de lo que pasa cerca y avisas cuando algo ocurre.",
  },
  {
    emoji: "🗺️",
    title: "Reporta y mira el mapa",
    body: "Reporta un incidente en segundos y míralo en el mapa del distrito en tiempo real, junto con lo que reportan tus vecinos.",
  },
  {
    emoji: "🚨",
    title: "Botón de pánico",
    body: "En una emergencia, el botón rojo avisa al instante a los vecinos cercanos. Úsalo solo cuando de verdad lo necesites.",
  },
  {
    emoji: "🚛",
    title: "Servicios en vivo",
    body: "Sigue al camión recolector, al panadero o al vendedor en el mapa. Incluso puedes ver si el recolector pasó por tu casa y a qué hora.",
  },
  {
    emoji: "📍",
    title: "Elige tu distrito",
    body: "Arriba puedes ver y cambiar tu distrito. Todo lo que ves (mapa, alertas, servicios) es de ese distrito.",
  },
];

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    // Mostrar la primera vez.
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch { /* almacenamiento no disponible */ }
    // Permitir reabrir desde Ajustes.
    const onOpen = () => { setI(0); setOpen(true); };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
  };

  const last = i === SLIDES.length - 1;
  const s = SLIDES[i];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm"
            onClick={close}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[71] mx-auto max-w-sm max-h-[88vh] overflow-y-auto rounded-3xl border border-white/10 bg-card p-6 shadow-2xl"
            role="dialog" aria-modal="true" aria-label="Introducción"
          >
            <button onClick={close} aria-label="Cerrar"
              className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/8 transition-colors">
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center gap-3 pt-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="w-20 h-20 rounded-3xl bg-primary/12 border border-primary/25 flex items-center justify-center text-4xl">
                    {s.emoji}
                  </div>
                  <h2 className="font-display text-xl font-bold text-white">{s.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed px-2 min-h-[72px]">{s.body}</p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Puntos de progreso */}
            <div className="flex items-center justify-center gap-1.5 my-4">
              {SLIDES.map((_, idx) => (
                <button key={idx} onClick={() => setI(idx)} aria-label={`Ir al paso ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all ${idx === i ? "w-5 bg-primary" : "w-1.5 bg-white/20"}`} />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {i > 0 ? (
                <button onClick={() => setI(i - 1)}
                  className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-white transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Atrás
                </button>
              ) : (
                <button onClick={close} className="px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-white transition-colors">
                  Saltar
                </button>
              )}
              <button
                onClick={() => (last ? close() : setI(i + 1))}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-br from-primary to-[#1e52d6] text-white font-semibold hover:-translate-y-px transition-transform"
              >
                {last ? "Empezar" : "Siguiente"}
                {!last && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
