import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, ShieldAlert } from "lucide-react";
import { PANIC_TYPES } from "@/lib/constants";
import { PanicAlertType, useCreatePanicAlert } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface PanicModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PanicModal({ isOpen, onClose }: PanicModalProps) {
  const [selectedType, setSelectedType] = useState<PanicAlertType | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const { toast } = useToast();
  
  const createAlert = useCreatePanicAlert();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0) {
      triggerAlert();
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSelect = (type: PanicAlertType) => {
    setSelectedType(type);
    setCountdown(3);
  };

  const cancelAlert = () => {
    setSelectedType(null);
    setCountdown(null);
  };

  const triggerAlert = () => {
    if (!selectedType) return;
    
    createAlert.mutate({
      data: {
        type: selectedType,
        latitude: -12.0784, // Mock location
        longitude: -77.0852,
        address: "Av. de la Marina 2000, San Miguel",
        authorName: "Usuario Local",
        sector: "San Miguel Centro"
      }
    }, {
      onSuccess: () => {
        toast({
          title: "ALERTA ENVIADA",
          description: "Las autoridades y vecinos cercanos han sido notificados.",
          variant: "destructive",
        });
        cancelAlert();
        onClose();
      }
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-background/95 backdrop-blur-xl"
        >
          {/* Animated Background Warning */}
          <div className="absolute inset-0 bg-destructive/5 animate-pulse" />
          
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-3 rounded-full bg-card border border-white/10 text-muted-foreground hover:text-white transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="relative z-10 w-full max-w-md flex flex-col items-center">
            {countdown === null ? (
              <>
                <motion.div
                  initial={{ scale: 0.8, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-24 h-24 rounded-full bg-destructive/20 text-destructive flex items-center justify-center mb-6 neon-glow-destructive"
                >
                  <ShieldAlert className="w-12 h-12" />
                </motion.div>
                
                <h2 className="text-3xl font-display font-bold text-white mb-2 text-center text-glow">
                  BOTÓN DE PÁNICO
                </h2>
                <p className="text-muted-foreground text-center mb-8">
                  Selecciona el tipo de emergencia. Esto notificará inmediatamente a serenazgo y vecinos.
                </p>

                <div className="grid grid-cols-2 gap-3 w-full">
                  {(Object.entries(PANIC_TYPES) as [PanicAlertType, any][]).map(([type, config]) => {
                    const Icon = config.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => handleSelect(type)}
                        className={`flex flex-col items-center p-4 rounded-2xl border border-white/5 bg-card/50 hover:bg-card hover:border-${config.color.split('-')[1]}-500/50 transition-all duration-300 group`}
                      >
                        <div className={`p-3 rounded-xl mb-3 ${config.color} text-white shadow-lg`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <span className="text-sm font-medium text-center group-hover:text-white transition-colors text-muted-foreground">
                          {config.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center text-center"
              >
                <div className="text-destructive mb-6">
                  <AlertTriangle className="w-20 h-20 animate-pulse" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Enviando Alerta...</h3>
                <p className="text-muted-foreground mb-12">
                  {PANIC_TYPES[selectedType!].label}
                </p>
                
                <div className="relative flex items-center justify-center w-48 h-48 mb-12">
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle 
                      cx="96" cy="96" r="88" 
                      className="stroke-muted fill-none" strokeWidth="8"
                    />
                    <motion.circle 
                      cx="96" cy="96" r="88" 
                      className="stroke-destructive fill-none" strokeWidth="8"
                      strokeDasharray="553"
                      initial={{ strokeDashoffset: 553 }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ duration: 3, ease: "linear" }}
                    />
                  </svg>
                  <span className="text-7xl font-display font-bold text-destructive text-glow">
                    {countdown}
                  </span>
                </div>

                <button
                  onClick={cancelAlert}
                  className="px-8 py-4 rounded-full bg-card border-2 border-white/10 text-white font-bold tracking-widest hover:bg-white/5 transition-colors"
                >
                  CANCELAR ALERTA
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
