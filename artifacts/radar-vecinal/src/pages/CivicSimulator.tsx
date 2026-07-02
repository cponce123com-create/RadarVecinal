import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Landmark, Users, ShieldCheck, Building2, Wallet, TrendingUp, 
  Star, AlertCircle, Lightbulb, RotateCcw, Award, BadgeCheck,
  Siren, Trees, School, Bus 
} from "lucide-react";

interface Scenario {
  id: string;
  title: string;
  description: string;
  context: string;
  icon: any;
  choices: {
    label: string;
    budget: number; // -100 to +100 (budget allocation)
    safety: number; // impact on safety
    popularity: number; // public approval
    description: string;
  }[];
}

const SCENARIOS: Scenario[] = [
  {
    id: "budget",
    title: "Presupuesto Municipal",
    description: "La municipalidad tiene S/1,000,000 para el trimestre. ¿Cómo lo distribuyes?",
    context: "El concejo municipal te ha dado libertad para asignar el presupuesto del próximo trimestre. Tus decisiones afectarán la seguridad, limpieza y educación del distrito.",
    icon: Wallet,
    choices: [
      { label: "🚔 Más serenazgo y cámaras", budget: -60, safety: 80, popularity: 40, description: "Aumenta la vigilancia en zonas críticas. Reduce robos pero no mejora otros servicios." },
      { label: "🧹 Limpieza y parques",       budget: -40, safety: 20, popularity: 70, description: "Recupera espacios públicos. La gente nota el cambio pero la seguridad no mejora." },
      { label: "📚 Talleres y educación",     budget: -30, safety: 10, popularity: 60, description: "Invierte en programas para jóvenes. Impacto a largo plazo en prevención." },
      { label: "⚖️ Balanceado",               budget: -45, safety: 40, popularity: 55, description: "Reparte equitativamente. Nadie está del todo contento pero nadie se queja demasiado." },
    ],
  },
  {
    id: "security",
    title: "Ola de Robos",
    description: "Los robos en el distrito aumentaron 40% en el último mes. ¿Qué haces?",
    context: "Los vecinos están alarmados. Los reportes de robos en la app se han duplicado y el serenazgo no da abasto.",
    icon: Siren,
    choices: [
      { label: "🚨 Toque de queda juvenil",   budget: -10, safety: 60, popularity: -30, description: "Medida drástica: restringes la circulación nocturna de menores. Reduce robos pero genera polémica." },
      { label: "📱 App + alertas vecinales",  budget: -20, safety: 50, popularity: 50, description: "Inviertes en mejorar la app Radar Vecinal con alertas en tiempo real. Los vecinos se organizan." },
      { label: "👮 20 nuevos serenos",        budget: -80, safety: 70, popularity: 40, description: "Contratas más personal. Es caro pero efectivo. El presupuesto de otras áreas se reduce." },
      { label: "💡 Alumbrado público",        budget: -50, safety: 45, popularity: 65, description: "Iluminas calles oscuras. Medida preventiva de mediano plazo. La gente se siente más segura." },
    ],
  },
  {
    id: "disaster",
    title: "Desastre Natural",
    description: "Un huayco ha bloqueado tres calles principales y hay familias damnificadas. ¿Cómo respondes?",
    context: "Las fuertes lluvias han causado un huayco en la parte alta del distrito. Hay 20 familias evacuadas y el acceso al centro de salud está bloqueado.",
    icon: AlertCircle,
    choices: [
      { label: "🚑 Evacuación y albergues",  budget: -70, safety: 60, popularity: 70, description: "Priorizas la vida. Abres albergues y coordinas con bomberos. La gente valora la respuesta rápida." },
      { label: "🛠️ Maquinaria pesada",       budget: -50, safety: 30, popularity: 40, description: "Limpia las calles bloqueadas primero. Restableces el tránsito pero las familias damnificadas esperan." },
      { label: "📢 Campaña de donaciones",   budget: -20, safety: 20, popularity: 55, description: "Pides ayuda a la ciudadanía. Menos gasto municipal pero la respuesta es más lenta." },
      { label: "🤝 Coordinación regional",    budget: -30, safety: 40, popularity: 50, description: "Pides ayuda al gobierno regional. Más recursos pero más burocracia." },
    ],
  },
];

const PERSONALITY_TYPES = [
  { id: "planner",  label: "Planificador/a",   desc: "Distribuyes recursos con cuidado",   icon: "📋" },
  { id: "protector", label: "Protector/a",     desc: "Priorizas la seguridad ciudadana",   icon: "🛡️" },
  { id: "populist", label: "Popular",          desc: "Buscas el aplauso de la gente",      icon: "🌟" },
  { id: "visionary",label: "Visionario/a",     desc: "Inviertes en el futuro del distrito",icon: "🔮" },
];

/** Inspirado en Civix — Civic Simulator */
export default function CivicSimulator() {
  const [step, setStep] = useState<"intro" | "playing" | "result">("intro");
  const [currentScenario, setCurrentScenario] = useState(0);
  const [budget, setBudget] = useState(100);
  const [safety, setSafety] = useState(50);
  const [popularity, setPopularity] = useState(50);
  const [decisions, setDecisions] = useState<{ scenario: string; choice: string }[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);

  const scenario = SCENARIOS[currentScenario];
  const isLast = currentScenario >= SCENARIOS.length - 1;

  const handleChoice = (idx: number) => {
    setSelectedChoice(idx);
    setShowOutcome(true);
  };

  const nextScenario = () => {
    const c = scenario.choices[selectedChoice!];
    setBudget(Math.max(0, Math.min(100, budget + c.budget)));
    setSafety(Math.max(0, Math.min(100, safety + c.safety)));
    setPopularity(Math.max(0, Math.min(100, popularity + c.popularity)));
    setDecisions([...decisions, { scenario: scenario.title, choice: c.label }]);
    setSelectedChoice(null);
    setShowOutcome(false);

    if (isLast) {
      // Calculate personality
      setStep("result");
    } else {
      setCurrentScenario(currentScenario + 1);
    }
  };

  const reset = () => {
    setStep("intro");
    setCurrentScenario(0);
    setBudget(100);
    setSafety(50);
    setPopularity(50);
    setDecisions([]);
    setSelectedChoice(null);
    setShowOutcome(false);
  };

  // Determine personality
  const getPersonality = () => {
    if (budget > 70) return PERSONALITY_TYPES[0]; // planner
    if (safety > 70) return PERSONALITY_TYPES[1]; // protector
    if (popularity > 70) return PERSONALITY_TYPES[2]; // populist
    return PERSONALITY_TYPES[3]; // visionary
  };

  const personality = getPersonality();
  const avgScore = Math.round((budget + safety + popularity) / 3);

  if (step === "intro") {
    return (
      <div className="max-w-lg mx-auto pb-8 flex flex-col gap-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card border border-white/5 p-6 text-center">
          <Landmark className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">🏛️ Simulador Cívico</h1>
          <p className="text-sm text-muted-foreground mb-5">
            Ponte en los zapatos de un alcalde o alcaldesa. Toma decisiones sobre presupuesto, 
            seguridad y emergencias. Cada decisión afecta tu popularidad, la seguridad del 
            distrito y las finanzas municipales.
          </p>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-5 text-xs text-yellow-400 text-left">
            <Lightbulb className="w-4 h-4 inline mr-1" />
            <strong>Consejo:</strong> No hay respuestas incorrectas. Cada decisión tiene consecuencias 
            y revela tu estilo de liderazgo. ¡Juega varias veces para descubrir tu personalidad cívica!
          </div>
          <button onClick={() => setStep("playing")}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-[0_0_16px_hsl(217_100%_55%_/_0.3)]">
            Comenzar simulación
          </button>
        </motion.div>
      </div>
    );
  }

  if (step === "result") {
    return (
      <div className="max-w-lg mx-auto pb-8 flex flex-col gap-5">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl bg-card border border-green-500/30 p-6 text-center">
          <Award className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white mb-1">🎉 Simulación completada</h2>
          <p className="text-sm text-muted-foreground mb-4">Has gobernado tu distrito. Aquí están tus resultados:</p>

          <div className="flex justify-center gap-4 mb-5">
            {[
              { label: "Presupuesto", value: budget, color: budget > 50 ? "#22c55e" : "#ef4444" },
              { label: "Seguridad",   value: safety, color: safety > 50 ? "#22c55e" : "#ef4444" },
              { label: "Popularidad", value: popularity, color: popularity > 50 ? "#22c55e" : "#ef4444" },
            ].map(m => (
              <div key={m.label} className="text-center">
                <div className="w-16 h-16 rounded-full border-4 flex items-center justify-center text-xl font-bold text-white mx-auto mb-1"
                  style={{ borderColor: m.color }}>
                  {m.value}
                </div>
                <p className="text-[10px] text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-4">
            <p className="text-xs text-muted-foreground mb-1">Tu perfil de liderazgo:</p>
            <p className="text-lg font-bold text-white">{personality.icon} {personality.label}</p>
            <p className="text-xs text-muted-foreground">{personality.desc}</p>
          </div>

          <p className="text-xs text-muted-foreground mb-4">Puntaje general: <strong className="text-white">{avgScore}/100</strong></p>

          <button onClick={reset}
            className="w-full py-3 rounded-xl bg-primary/20 border border-primary/40 text-primary font-bold text-sm hover:bg-primary/30 transition-all flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" /> Jugar de nuevo
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-8 flex flex-col gap-4">
      {/* Progress */}
      <div className="flex gap-1">
        {SCENARIOS.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
            i < currentScenario ? "bg-primary" : i === currentScenario ? "bg-primary/60" : "bg-white/10"
          }`} />
        ))}
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-white/5 text-xs">
        {[
          { label: "💰", value: budget, color: budget > 50 ? "#22c55e" : "#ef4444" },
          { label: "🛡️", value: safety, color: safety > 50 ? "#22c55e" : "#ef4444" },
          { label: "⭐", value: popularity, color: popularity > 50 ? "#22c55e" : "#ef4444" },
        ].map(m => (
          <span key={m.label}>{m.label} <span style={{ color: m.color }}>{m.value}</span></span>
        ))}
        <span className="text-muted-foreground">Escenario {currentScenario + 1}/{SCENARIOS.length}</span>
      </div>

      {/* Scenario */}
      {scenario && (
        <motion.div key={scenario.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-card border border-white/5 overflow-hidden">
          <div className="p-4 bg-white/[0.02] border-b border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <scenario.icon className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-white">{scenario.title}</h3>
            </div>
            <p className="text-xs text-muted-foreground">{scenario.description}</p>
          </div>

          <div className="p-4">
            <p className="text-xs text-muted-foreground bg-white/5 rounded-lg p-3 mb-3">{scenario.context}</p>

            <div className="flex flex-col gap-2">
              {scenario.choices.map((c, i) => (
                <button key={i} onClick={() => handleChoice(i)} disabled={showOutcome}
                  className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${
                    selectedChoice === i
                      ? "border-primary bg-primary/10 text-white"
                      : "border-white/8 bg-white/5 text-white hover:border-primary/50"
                  } ${showOutcome ? "opacity-60" : ""}`}>
                  <p className="font-semibold text-sm mb-1">{c.label}</p>
                  {showOutcome && selectedChoice === i && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-muted-foreground">
                      {c.description}
                    </motion.p>
                  )}
                  {!showOutcome && (
                    <div className="flex gap-2 mt-1.5 text-[10px] text-muted-foreground">
                      <span>💰 {c.budget > 0 ? "+" : ""}{c.budget}</span>
                      <span>🛡️ {c.safety > 0 ? "+" : ""}{c.safety}</span>
                      <span>⭐ {c.popularity > 0 ? "+" : ""}{c.popularity}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <AnimatePresence>
              {showOutcome && (
                <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  onClick={nextScenario}
                  className="w-full mt-3 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all">
                  {isLast ? "Ver resultados" : "Siguiente escenario"}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </div>
  );
}
