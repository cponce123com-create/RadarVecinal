import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, ShieldAlert, Heart, Users, Flame, UserX, Zap } from "lucide-react";
import { PanicAlertType, useCreatePanicAlert } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface PanicModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PANIC_OPTIONS: { type: PanicAlertType; icon: any; label: string; sub: string; color: string; bg: string }[] = [
  { type: PanicAlertType.robbery, icon: AlertTriangle, label: "Asalto", sub: "Robo en progreso", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  { type: PanicAlertType.medical, icon: Heart, label: "Emergencia médica", sub: "Necesito ambulancia", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  { type: PanicAlertType.fight, icon: Users, label: "Violencia física", sub: "Pelea o agresión", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  { type: PanicAlertType.fire, icon: Flame, label: "Incendio", sub: "Fuego fuera de control", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  { type: PanicAlertType.missing_person, icon: UserX, label: "Persona extraviada", sub: "Menor o adulto mayor", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  { type: PanicAlertType.other, icon: Zap, label: "Otra emergencia", sub: "Describir luego", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
];

export function PanicModal({ isOpen, onClose }: PanicModalProps) {
  const [selected, setSelected] = useState<(typeof PANIC_OPTIONS)[0] | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const { toast } = useToast();
  const createAlert = useCreatePanicAlert();

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { triggerAlert(); return; }
    const t = setTimeout(() => setCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSelect = (opt: (typeof PANIC_OPTIONS)[0]) => {
    setSelected(opt);
    setCountdown(3);
  };

  const cancelAlert = () => {
    setSelected(null);
    setCountdown(null);
  };

  const handleClose = () => {
    cancelAlert();
    onClose();
  };

  const triggerAlert = () => {
    if (!selected) return;
    createAlert.mutate({
      data: {
        type: selected.type,
        latitude: -12.0784,
        longitude: -77.0852,
        address: "Av. de la Marina 2000, San Miguel",
        authorName: "Usuario",
        sector: "San Miguel Centro",
      }
    }, {
      onSuccess: () => {
        toast({
          title: "⚠ ALERTA ENVIADA",
          description: "Serenazgo y vecinos cercanos han sido notificados.",
          variant: "destructive",
        });
        handleClose();
      },
      onError: () => {
        toast({ title: "Error al enviar alerta", description: "Intenta de nuevo.", variant: "destructive" });
        cancelAlert();
      }
    });
  };

  const circumference = 2 * Math.PI * 54; // r=54

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4"
          style={{ background: "hsl(224 15% 4% / 0.97)", backdropFilter: "blur(24px)" }}
        >
          {/* Animated red vignette when counting down */}
          <AnimatePresence>
            {countdown !== null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.15, 0.05, 0.15, 0.05] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute inset-0 pointer-events-none"
                style={{ background: "radial-gradient(ellipse at center, hsl(0 90% 55% / 0.15) 0%, transparent 70%)" }}
              />
            )}
          </AnimatePresence>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/6 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-all z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* ── Selection State ── */}
          <AnimatePresence mode="wait">
            {countdown === null ? (
              <motion.div
                key="select"
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -16 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-sm flex flex-col items-center"
              >
                {/* Icon */}
                <div className="relative mb-5">
                  <div className="w-20 h-20 rounded-full bg-destructive/15 border-2 border-destructive/40 flex items-center justify-center">
                    <ShieldAlert className="w-10 h-10 text-destructive" />
                  </div>
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-destructive"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>

                <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">BOTÓN DE PÁNICO</h2>
                <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
                  Selecciona la emergencia. Se enviará una alerta inmediata a serenazgo y vecinos cercanos.
                </p>

                {/* Emergency type grid */}
                <div className="grid grid-cols-2 gap-2.5 w-full">
                  {PANIC_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <motion.button
                        key={opt.type}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleSelect(opt)}
                        className="flex items-center gap-3 p-3.5 rounded-xl border border-white/6 hover:border-white/15 transition-all text-left"
                        style={{ background: opt.bg }}
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${opt.color}20` }}
                        >
                          <Icon className="w-5 h-5" style={{ color: opt.color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white leading-tight">{opt.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{opt.sub}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              /* ── Countdown State ── */
              <motion.div
                key="countdown"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center text-center"
              >
                {selected && (() => {
                  const Icon = selected.icon;
                  return (
                    <>
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border border-white/10"
                        style={{ background: selected.bg }}
                      >
                        <Icon className="w-7 h-7" style={{ color: selected.color }} />
                      </div>
                      <p className="text-muted-foreground text-base font-medium mb-1">{selected.label}</p>
                    </>
                  );
                })()}

                <h3 className="text-2xl font-bold text-white mb-8">Enviando alerta...</h3>

                {/* SVG Countdown ring */}
                <div className="relative w-44 h-44 mb-8">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(220 14% 14%)" strokeWidth="8" />
                    <motion.circle
                      cx="60" cy="60" r="54"
                      fill="none"
                      stroke="hsl(0 90% 55%)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ duration: 3, ease: "linear" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                      key={countdown}
                      initial={{ scale: 1.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-6xl font-bold text-destructive text-glow-red"
                    >
                      {countdown}
                    </motion.span>
                    <span className="text-xs text-muted-foreground mt-1">segundos</span>
                  </div>
                </div>

                <button
                  onClick={cancelAlert}
                  className="px-8 py-3 rounded-full border-2 border-white/12 bg-white/4 text-white font-bold text-sm tracking-wider hover:bg-white/8 hover:border-white/20 transition-all"
                >
                  CANCELAR ALERTA
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
