import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Mail, Lock, Phone, MapPin, ChevronRight, Eye, EyeOff, Loader2, Search, ShieldAlert, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SECTORS, DISTRICT } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

interface Props { open: boolean; onClose: () => void; }
type Mode = "login" | "register";

const LOGIN_WARNING = "⚠️ ESTÁ PROHIBIDO REALIZAR REPORTES FALSOS.\n\nSegún la Ley N° 30076 (Código Penal Peruano), realizar denuncias falsas es un delito. Los reportes falsos serán investigados y el responsable será BANEADO PERMANENTEMENTE de Radar Vecinal, sin posibilidad de crear una nueva cuenta.\n\nTu identidad está protegida: tus datos personales (DNI, nombre, teléfono) son visibles SOLO para la Municipalidad. Los demás vecinos ven tu reporte como anónimo.\n\nLa Municipalidad se compromete a NO difundir tu identidad. Tus reportes ayudan a construir un distrito más seguro para todos.";

export default function AuthModal({ open, onClose }: Props) {
  const { login } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", password: "", sector: SECTORS[0], district: DISTRICT.name,
    dni: "", phone: "", firstName: "", lastName: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // ── Búsqueda RENIEC automática al escribir DNI ──────────────────────────
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDniChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
    setForm(prev => ({ ...prev, dni: raw }));
    if (raw.length !== 8) return;
    setLookupLoading(true);
    try {
      const res = await fetch(`/api/reniec/lookup/${raw}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.data) {
        setForm(prev => ({
          ...prev,
          firstName: data.data.firstName ?? "",
          lastName: data.data.lastName ?? "",
          name: `${data.data.firstName ?? ""} ${data.data.lastName ?? ""}`.trim() || prev.name,
        }));
        if (data.data.firstName && data.data.firstName !== "—") {
          toast({ title: "✅ Datos encontrados", description: `DNI verificado: ${data.data.firstName} ${data.data.lastName}` });
        }
      }
    } catch { /* ignore */ }
    setLookupLoading(false);
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "register" && !showWarning) {
      setShowWarning(true);
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const loginRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error(loginData.error || "Credenciales inválidas");

        // Verificar si el usuario está baneado
        if (loginData.user?.bannedAt) {
          throw new Error("🚫 Tu cuenta ha sido suspendida permanentemente por reportes falsos. No puedes acceder a Radar Vecinal.");
        }

        login(loginData.token, loginData.user);
        toast({ title: "¡Bienvenido de vuelta!", description: "Sesión iniciada correctamente." });
      } else {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${form.firstName} ${form.lastName}`.trim() || form.name,
            email: form.email,
            password: form.password,
            sector: form.sector,
            district: form.district,
            dni: form.dni || undefined,
            phone: form.phone || undefined,
            firstName: form.firstName || form.name,
            lastName: form.lastName || "",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al registrarse");
        login(data.token, data.user);
        toast({ title: "¡Cuenta creada!", description: "Ya puedes reportar incidentes en tu distrito." });
      }
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Intenta de nuevo.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const isDniComplete = form.dni.length === 8;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 48, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0,   y: 48,  scale: 0.96 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-lg bg-[#0a0e1a] border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/6 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mode === "login" ? "Accede a tu cuenta" : "Únete a la red de seguridad vecinal"}
                </p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/8 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 pb-6">
              {/* ── AVISO LEGAL (si es registro y no ha confirmado) ── */}
              {mode === "register" && showWarning && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-destructive">⚠️ REPORTES FALSOS = BANEO PERMANENTE</p>
                      <p className="text-[11px] text-destructive/80 mt-1 leading-relaxed whitespace-pre-line">{LOGIN_WARNING}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 pt-1">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-green-400/80">Al hacer clic en "Aceptar y continuar" confirmas que:
                      • No realizarás reportes falsos
                      • Entiendes que los reportes falsos serán sancionados con BANEO PERMANENTE
                      • Autorizas a la Municipalidad a verificar tu identidad con DNI
                      • Entiendes que tus datos son visibles solo para la Municipalidad, no para otros vecinos</p>
                  </div>
                </motion.div>
              )}

              {/* ── Aviso login ── */}
              {mode === "login" && (
                <div className="mt-3 p-3 rounded-xl bg-yellow-500/8 border border-yellow-500/20 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-yellow-400/70 leading-relaxed">
                    Los reportes falsos son delito y serán sancionados con BANEO PERMANENTE.
                    Tus datos son privados y solo visibles para la Municipalidad.
                  </p>
                </div>
              )}

              {/* ── Tab switcher ── */}
              <div className="flex gap-0 mt-4 border border-white/8 rounded-xl overflow-hidden p-0.5 bg-card">
                {(["login", "register"] as Mode[]).map(m => (
                  <button key={m} onClick={() => { setMode(m); setShowWarning(false); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === m ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"}`}>
                    {m === "login" ? "Entrar" : "Registrarse"}
                  </button>
                ))}
              </div>

              {/* ── Formulario ── */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-4">
                {/* ── CAMPOS DE REGISTRO ── */}
                {mode === "register" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
                    {/* DNI + búsqueda RENIEC */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                        DNI <span className="text-primary font-normal normal-case">· Se buscarán tus datos automáticamente</span>
                      </label>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input name="dni" value={form.dni} onChange={handleDniChange}
                          placeholder="12345678" maxLength={8} inputMode="numeric"
                          className="w-full pl-9 pr-10 py-2.5 bg-background border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors font-mono tracking-widest" />
                        {lookupLoading && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin" />}
                        {isDniComplete && !lookupLoading && <CheckCircle2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-green-400" />}
                      </div>
                    </div>

                    {/* Nombres y Apellidos (auto-completados por RENIEC) */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nombres</label>
                        <input name="firstName" value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                          placeholder="Nombres" required
                          className="w-full px-3 py-2.5 bg-background border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Apellidos</label>
                        <input name="lastName" value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
                          placeholder="Apellidos" required
                          className="w-full px-3 py-2.5 bg-background border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors" />
                      </div>
                    </div>

                    {/* Teléfono */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Teléfono <span className="text-muted-foreground/40 font-normal normal-case">(opcional)</span></label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input name="phone" value={form.phone} onChange={handleChange}
                          placeholder="987 654 321" type="tel"
                          className="w-full pl-9 pr-4 py-2.5 bg-background border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors" />
                      </div>
                    </div>

                    {/* Distrito */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Distrito</label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <select name="district" value={form.district} onChange={handleChange}
                          className="w-full pl-9 pr-4 py-2.5 bg-background border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-primary transition-colors appearance-none">
                          <option value={DISTRICT.name}>{DISTRICT.name}</option>
                        </select>
                      </div>
                    </div>

                    {/* Sector */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Sector / Barrio</label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <select name="sector" value={form.sector} onChange={handleChange}
                          className="w-full pl-9 pr-4 py-2.5 bg-background border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-primary transition-colors appearance-none">
                          {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Email */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Correo electrónico</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input name="email" type="email" value={form.email} onChange={handleChange} required
                      placeholder="tu@correo.com" autoComplete="email"
                      className="w-full pl-9 pr-4 py-2.5 bg-background border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors" />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Contraseña</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input name="password" type={showPass ? "text" : "password"} value={form.password} onChange={handleChange} required
                      placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Tu contraseña"}
                      autoComplete={mode === "register" ? "new-password" : "current-password"}
                      minLength={mode === "register" ? 6 : 1}
                      className="w-full pl-9 pr-10 py-2.5 bg-background border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors" />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button type="submit" disabled={loading}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-[0_0_20px_hsl(217_100%_55%_/_0.25)]">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                    : mode === "register" && !showWarning ? <>Verificar datos <ChevronRight className="w-4 h-4" /></>
                    : mode === "register" && showWarning ? <>Aceptar y continuar <ChevronRight className="w-4 h-4" /></>
                    : <>Entrar <ChevronRight className="w-4 h-4" /></>}
                </button>

                <p className="text-center text-xs text-muted-foreground/60 mt-1">
                  {mode === "login"
                    ? <>¿No tienes cuenta? <button type="button" onClick={() => { setMode("register"); setShowWarning(false); }} className="text-primary hover:underline">Regístrate</button></>
                    : <>¿Ya tienes cuenta? <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">Inicia sesión</button></>}
                </p>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
