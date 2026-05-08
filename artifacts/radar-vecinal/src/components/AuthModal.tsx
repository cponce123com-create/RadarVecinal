import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Mail, Lock, Phone, MapPin, ChevronRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SECTORS, DISTRICT } from "@/lib/constants";
import { DISTRICTS } from "@/contexts/DistrictContext";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Mode = "login" | "register";

export default function AuthModal({ open, onClose }: Props) {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [form, setForm] = useState({
    name:     "",
    email:    "",
    password: "",
    sector:   SECTORS[0],
    district: DISTRICT.name,
    dni:      "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
        toast({ title: "¡Bienvenido de vuelta!", description: "Sesión iniciada correctamente." });
      } else {
        await register({
          name:     form.name,
          email:    form.email,
          password: form.password,
          sector:   form.sector,
          district: form.district,
          dni:      form.dni || undefined,
        });
        toast({ title: "¡Cuenta creada!", description: "Ya puedes usar todas las funciones de Radar Vecinal." });
      }
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Intenta de nuevo.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const google = (window as any).google;
    if (google?.accounts) {
      google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
        callback: async (response: any) => {
          if (response?.credential) {
            try {
              // Call the googleLogin from AuthContext
              const res = await fetch(`/api/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error);
              localStorage.setItem('radar_token', data.token);
              window.location.reload(); // Reload to re-hydrate auth state
            } catch (err: any) {
              toast({ title: "Error", description: err.message, variant: "destructive" });
            }
          }
        },
      });
      google.accounts.id.prompt();
    } else {
      toast({ title: "Info", description: "Cargando Google Sign-In...", variant: "default" });
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => handleGoogleLogin();
      document.body.appendChild(script);
    }
  };

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
            className="w-full sm:max-w-md bg-[#0a0e1a] border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/6">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mode === "login"
                    ? "Accede a tu perfil y sigue tus reportes"
                    : "Únete a la red de seguridad vecinal"
                  }
                </p>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/8 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-0 mx-6 mt-4 border border-white/8 rounded-xl overflow-hidden p-0.5 bg-card">
              {(["login", "register"] as Mode[]).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    mode === m ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
                  }`}>
                  {m === "login" ? "Entrar" : "Registrarse"}
                </button>
              ))}
            </div>

              {/* Google OAuth */}
              <button type="button" onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-white hover:bg-white/10 transition-all">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuar con Google
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-xs text-muted-foreground/50">o</span>
                <div className="flex-1 h-px bg-white/8" />
              </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 pt-4 pb-6 flex flex-col gap-3">
              <AnimatePresence mode="wait">
                {mode === "register" && (
                  <motion.div
                    key="register-fields"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-col gap-3 overflow-hidden"
                  >
                    {/* Name */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nombre completo</label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input name="name" value={form.name} onChange={handleChange} required
                          placeholder="Tu nombre" autoComplete="name"
                          className="w-full pl-9 pr-4 py-2.5 bg-background border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors" />
                      </div>
                    </div>

                    {/* DNI (optional) */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">DNI <span className="text-muted-foreground/40 font-normal normal-case">(opcional)</span></label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input name="dni" value={form.dni} onChange={handleChange}
                          placeholder="12345678" maxLength={8}
                          className="w-full pl-9 pr-4 py-2.5 bg-background border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors" />
                      </div>
                    </div>

                    {/* District */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Distrito</label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <select name="district" value={form.district} onChange={handleChange}
                          className="w-full pl-9 pr-4 py-2.5 bg-background border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-primary transition-colors appearance-none">
                          {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
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
              </AnimatePresence>

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
                className="w-full mt-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                  : <>{mode === "login" ? "Entrar" : "Crear cuenta"} <ChevronRight className="w-4 h-4" /></>
                }
              </button>

              <p className="text-center text-xs text-muted-foreground/60 mt-1">
                {mode === "login"
                  ? <>¿No tienes cuenta? <button type="button" onClick={() => setMode("register")} className="text-primary hover:underline">Regístrate</button></>
                  : <>¿Ya tienes cuenta? <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">Inicia sesión</button></>
                }
              </p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
