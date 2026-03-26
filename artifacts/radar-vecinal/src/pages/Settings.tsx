import { useState } from "react";
import { motion } from "framer-motion";
import {
  Settings as SettingsIcon, Bell, Volume2, Map, Shield, Lock,
  Smartphone, Globe, Trash2, Download, ChevronRight, AlertTriangle,
  Eye, EyeOff, Wifi, BellOff, Radius, SlidersHorizontal,
  Moon, SunMedium, Clock, Users, Navigation, Thermometer, Radar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DISTRICT } from "@/lib/constants";

// Lightweight local persistence (UI demo)
function useSetting<T>(key: string, defaultVal: T) {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem(`rvs_${key}`) : null;
  const [val, setVal] = useState<T>(stored !== null ? JSON.parse(stored) : defaultVal);
  const update = (v: T) => {
    setVal(v);
    if (typeof localStorage !== "undefined") localStorage.setItem(`rvs_${key}`, JSON.stringify(v));
  };
  return [val, update] as const;
}

interface ToggleProps { checked: boolean; onChange: (v: boolean) => void; }
function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative flex-shrink-0 transition-all duration-300 ${checked ? "bg-primary" : "bg-white/10"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

interface SettingSectionProps { title: string; icon: React.ElementType; iconColor?: string; children: React.ReactNode; }
function SettingSection({ title, icon: Icon, iconColor = "text-primary", children }: SettingSectionProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 px-1 mb-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <h3 className="text-xs font-bold text-muted-foreground/70 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="rounded-2xl bg-card border border-white/5 overflow-hidden divide-y divide-white/5">
        {children}
      </div>
    </div>
  );
}

interface SettingRowProps {
  label: string;
  sub?: string;
  children?: React.ReactNode;
  danger?: boolean;
  onClick?: () => void;
}
function SettingRow({ label, sub, children, danger, onClick }: SettingRowProps) {
  const isClickable = !!onClick;
  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-3.5 transition-colors ${
        isClickable ? "cursor-pointer hover:bg-white/[0.025]" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${danger ? "text-red-400" : "text-white"}`}>{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{sub}</p>}
      </div>
      {children && <div className="flex-shrink-0">{children}</div>}
    </div>
  );
}

const ALERT_RADII = ["500m", "1 km", "2 km", "5 km", "Todo el distrito"];
const DEFAULT_VIEWS = [
  { id: "map",   label: "Mapa de calles", icon: Map },
  { id: "radar", label: "Radar circular", icon: Radar },
  { id: "heat",  label: "Mapa de calor",  icon: Thermometer },
];
const INCIDENT_CATEGORIES = [
  { id: "robbery",           label: "Robo / Asalto",        color: "#ef4444" },
  { id: "fight",             label: "Pelea callejera",       color: "#f97316" },
  { id: "suspicious",        label: "Actitud sospechosa",   color: "#eab308" },
  { id: "fire",              label: "Incendio",              color: "#ef4444" },
  { id: "medical_emergency", label: "Emergencia médica",     color: "#3b82f6" },
  { id: "missing_person",    label: "Persona extraviada",   color: "#f59e0b" },
  { id: "noise",             label: "Ruidos molestos",       color: "#6b7280" },
  { id: "water_cut",         label: "Corte de agua",         color: "#3b82f6" },
];

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("rvs_theme", dark ? "dark" : "light");
}

export default function Settings() {
  const { toast } = useToast();

  // Theme
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("rvs_theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches !== false;
  });

  const toggleDarkMode = (v: boolean) => {
    setDarkMode(v);
    applyTheme(v);
  };

  // Notification prefs
  const [pushEnabled,     setPushEnabled]     = useSetting("push",          true);
  const [soundEnabled,    setSoundEnabled]     = useSetting("sound",         true);
  const [panicAlerts,     setPanicAlerts]      = useSetting("panic",         true);
  const [missingAlerts,   setMissingAlerts]    = useSetting("missing",       true);
  const [quietHours,      setQuietHours]       = useSetting("quietHours",    false);
  const [quietStart,      setQuietStart]       = useSetting("quietStart",    "22:00");
  const [quietEnd,        setQuietEnd]         = useSetting("quietEnd",      "07:00");
  const [alertRadius,     setAlertRadius]      = useSetting("alertRadius",   "2 km");
  const [alertCategories, setAlertCategories]  = useSetting<string[]>("alertCats", ["robbery","fight","fire","medical_emergency","missing_person"]);

  // Privacy prefs
  const [defaultAnon,     setDefaultAnon]      = useSetting("defaultAnon",   false);
  const [showInConfirms,  setShowInConfirms]   = useSetting("showInConfirms", true);
  const [shareLocation,   setShareLocation]    = useSetting("shareLocation", true);

  // Map prefs
  const [defaultView,     setDefaultView]      = useSetting("defaultView",   "map");
  const [autoCenter,      setAutoCenter]       = useSetting("autoCenter",    true);

  const toggleCategory = (id: string) => {
    setAlertCategories(
      alertCategories.includes(id)
        ? alertCategories.filter(c => c !== id)
        : [...alertCategories, id]
    );
  };

  const save = () => toast({ title: "✓ Configuración guardada", description: "Tus preferencias fueron actualizadas." });

  const cardVariants = { hidden: { opacity: 0, y: 16 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07 } }) };

  return (
    <div className="max-w-2xl mx-auto pb-8 flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-primary" />
            Configuración
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Personalizá tu experiencia en Radar Vecinal
          </p>
        </div>
        <button
          onClick={save}
          className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all shadow-[0_0_14px_hsl(217_100%_55%_/_0.3)]"
        >
          Guardar
        </button>
      </div>

      {/* ── Apariencia ── */}
      <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
        <SettingSection title="Apariencia" icon={darkMode ? Moon : SunMedium} iconColor={darkMode ? "text-blue-400" : "text-yellow-400"}>
          <SettingRow
            label="Modo oscuro"
            sub={darkMode ? "Modo oscuro activo — diseñado para usar de noche" : "Modo claro activo — mejor visibilidad de día"}
          >
            <Toggle checked={darkMode} onChange={toggleDarkMode} />
          </SettingRow>
        </SettingSection>
      </motion.div>

      {/* ── Notificaciones ── */}
      <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible">
        <SettingSection title="Notificaciones" icon={Bell}>
          <SettingRow
            label="Notificaciones push"
            sub="Recibir alertas aunque la app esté en segundo plano"
          >
            <Toggle checked={pushEnabled} onChange={setPushEnabled} />
          </SettingRow>
          <SettingRow
            label="Alertas sonoras"
            sub="Sonido de alerta según tipo de incidente y distancia"
          >
            <Toggle checked={soundEnabled} onChange={setSoundEnabled} />
          </SettingRow>
          <SettingRow
            label="Alertas de pánico"
            sub="Notificación inmediata ante botón de pánico activado"
          >
            <Toggle checked={panicAlerts} onChange={setPanicAlerts} />
          </SettingRow>
          <SettingRow
            label="Personas extraviadas"
            sub="Recibir cuando se reporta un extravío en tu zona"
          >
            <Toggle checked={missingAlerts} onChange={setMissingAlerts} />
          </SettingRow>
        </SettingSection>
      </motion.div>

      {/* ── Radio de Alertas ── */}
      <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible">
        <SettingSection title="Radio de alertas" icon={Navigation} iconColor="text-green-400">
          <div className="px-4 py-4">
            <p className="text-xs text-muted-foreground mb-3">
              Solo recibirás alertas de incidentes dentro del radio seleccionado desde tu ubicación actual.
            </p>
            <div className="flex flex-wrap gap-2">
              {ALERT_RADII.map(r => (
                <button
                  key={r}
                  onClick={() => setAlertRadius(r)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    alertRadius === r
                      ? "bg-green-500/20 text-green-400 border-green-500/40"
                      : "bg-transparent text-muted-foreground border-white/10 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Category filters */}
          <div className="px-4 pb-4">
            <p className="text-xs font-semibold text-white/60 mb-3 uppercase tracking-wide">Categorías que generan alerta</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {INCIDENT_CATEGORIES.map(cat => {
                const active = alertCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      active ? "border-white/15 bg-white/[0.04]" : "border-white/5 opacity-50 hover:opacity-75"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                      active ? "border-transparent" : "border-white/20 bg-transparent"
                    }`} style={active ? { background: cat.color + "33", borderColor: cat.color + "66" } : {}}>
                      {active && <div className="w-2 h-2 rounded-sm" style={{ background: cat.color }} />}
                    </div>
                    <span className={`text-xs font-medium ${active ? "text-white" : "text-muted-foreground"}`}>
                      {cat.label}
                    </span>
                    <div
                      className="w-1.5 h-1.5 rounded-full ml-auto flex-shrink-0"
                      style={{ background: active ? cat.color : "transparent" }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quiet hours */}
          <SettingRow
            label="Horas silenciosas"
            sub="No recibir alertas sonoras durante un horario definido"
          >
            <Toggle checked={quietHours} onChange={setQuietHours} />
          </SettingRow>
          {quietHours && (
            <div className="px-4 pb-4 flex items-center gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Desde</label>
                <input
                  type="time"
                  value={quietStart}
                  onChange={e => setQuietStart(e.target.value)}
                  className="w-full bg-background border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="text-muted-foreground text-sm mt-5">—</div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Hasta</label>
                <input
                  type="time"
                  value={quietEnd}
                  onChange={e => setQuietEnd(e.target.value)}
                  className="w-full bg-background border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>
          )}
        </SettingSection>
      </motion.div>

      {/* ── Privacidad ── */}
      <motion.div custom={2} variants={cardVariants} initial="hidden" animate="visible">
        <SettingSection title="Privacidad" icon={Shield} iconColor="text-accent">
          <SettingRow
            label="Modo anónimo por defecto"
            sub="Todos tus reportes se enviarán anónimamente"
          >
            <Toggle checked={defaultAnon} onChange={setDefaultAnon} />
          </SettingRow>
          <SettingRow
            label="Mostrar mi nombre en confirmaciones"
            sub="Cuando confirmes un reporte, tu nombre será visible"
          >
            <Toggle checked={showInConfirms} onChange={setShowInConfirms} />
          </SettingRow>
          <SettingRow
            label="Compartir mi ubicación"
            sub="Permite calcular distancia a incidentes cercanos"
          >
            <Toggle checked={shareLocation} onChange={setShareLocation} />
          </SettingRow>
        </SettingSection>
      </motion.div>

      {/* ── Mapa ── */}
      <motion.div custom={3} variants={cardVariants} initial="hidden" animate="visible">
        <SettingSection title="Preferencias del mapa" icon={Map} iconColor="text-blue-400">
          <div className="px-4 py-4">
            <p className="text-xs font-semibold text-white/60 mb-3 uppercase tracking-wide">Vista por defecto al abrir /mapa</p>
            <div className="flex gap-2">
              {DEFAULT_VIEWS.map(v => {
                const Icon = v.icon;
                const active = defaultView === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setDefaultView(v.id)}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all ${
                      active
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-card border-white/8 text-muted-foreground hover:border-white/15 hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>
          <SettingRow
            label="Centrar automáticamente"
            sub="El mapa vuela a tu ubicación al abrirse"
          >
            <Toggle checked={autoCenter} onChange={setAutoCenter} />
          </SettingRow>
        </SettingSection>
      </motion.div>

      {/* ── Distrito ── */}
      <motion.div custom={4} variants={cardVariants} initial="hidden" animate="visible">
        <SettingSection title="Distrito y territorio" icon={Globe} iconColor="text-yellow-400">
          <SettingRow
            label="Distrito piloto"
            sub="Todos los reportes y alertas corresponden a esta zona"
          >
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="text-white font-medium">{DISTRICT.displayName}</span>
            </div>
          </SettingRow>
          <SettingRow
            label="Provincia"
            sub=""
          >
            <span className="text-sm text-white font-medium">{DISTRICT.province}</span>
          </SettingRow>
          <SettingRow
            label="Región"
            sub=""
          >
            <span className="text-sm text-white font-medium">{DISTRICT.region}</span>
          </SettingRow>
          <SettingRow
            label="Expandir a otros distritos"
            sub="Escalabilidad provincial y regional disponible próximamente"
          >
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/6 text-muted-foreground border border-white/8">
              Próximamente
            </span>
          </SettingRow>
        </SettingSection>
      </motion.div>

      {/* ── Cuenta ── */}
      <motion.div custom={5} variants={cardVariants} initial="hidden" animate="visible">
        <SettingSection title="Cuenta" icon={Smartphone} iconColor="text-muted-foreground">
          <SettingRow
            label="Exportar mis datos"
            sub="Descarga un archivo con todos tus reportes y actividad"
            onClick={() => toast({ title: "Exportación solicitada", description: "Recibirás un archivo en tu correo registrado." })}
          >
            <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-white">
              <Download className="w-4 h-4" />
              <ChevronRight className="w-4 h-4" />
            </div>
          </SettingRow>
          <SettingRow
            label="Versión de la app"
            sub=""
          >
            <span className="text-xs text-muted-foreground font-mono">v2.1.0-beta</span>
          </SettingRow>
        </SettingSection>
      </motion.div>

      {/* ── Zona de peligro ── */}
      <motion.div custom={6} variants={cardVariants} initial="hidden" animate="visible">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 px-1 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-xs font-bold text-red-400/60 uppercase tracking-widest">Zona de peligro</h3>
          </div>
          <div className="rounded-2xl bg-red-950/15 border border-red-900/25 overflow-hidden divide-y divide-red-900/20">
            <SettingRow
              label="Eliminar mi cuenta"
              sub="Esta acción es irreversible. Se eliminarán todos tus datos del sistema."
              danger
              onClick={() => toast({ title: "Acción no disponible en demo", description: "Contacta a soporte para eliminar tu cuenta.", variant: "destructive" })}
            >
              <div className="flex items-center gap-1.5 text-red-400/50">
                <Trash2 className="w-4 h-4" />
                <ChevronRight className="w-4 h-4" />
              </div>
            </SettingRow>
          </div>
        </div>
      </motion.div>

      {/* Save button (bottom) */}
      <button
        onClick={save}
        className="w-full py-3.5 rounded-2xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all shadow-[0_0_20px_hsl(217_100%_55%_/_0.25)] active:scale-[0.99]"
      >
        Guardar configuración
      </button>
    </div>
  );
}
