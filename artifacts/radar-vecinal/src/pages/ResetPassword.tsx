/**
 * ResetPassword — fija la nueva contraseña con el token del enlace del correo.
 * Ruta: /restablecer?token=...
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

function tokenFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strongEnough = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strongEnough) { setError("La contraseña debe tener 8+ caracteres, con mayúscula, minúscula y número."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) setDone(true);
      else setError(body.error || "No se pudo restablecer. Solicita un enlace nuevo.");
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="rounded-2xl bg-card border border-white/8 p-7">
          {!token ? (
            <div className="flex flex-col items-center text-center gap-3">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <p className="text-sm text-muted-foreground">Enlace inválido. Solicita uno nuevo desde “¿Olvidaste tu contraseña?”.</p>
              <Link href="/recuperar"><span className="text-sm text-primary hover:underline cursor-pointer">Solicitar enlace</span></Link>
            </div>
          ) : done ? (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-success/12 border border-success/25 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white mb-1">¡Contraseña actualizada!</h2>
                <p className="text-sm text-muted-foreground">Ya puedes iniciar sesión con tu nueva contraseña.</p>
              </div>
              <button onClick={() => setLocation("/home?auth=login")}
                className="w-full py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all">
                Iniciar sesión
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-white mb-1">Nueva contraseña</h2>
              <p className="text-sm text-muted-foreground mb-5">Elige una contraseña segura para tu cuenta.</p>
              <form onSubmit={submit} className="flex flex-col gap-3">
                {[{ v: password, set: setPassword, ph: "Nueva contraseña", ac: "new-password" },
                  { v: confirm, set: setConfirm, ph: "Repite la contraseña", ac: "new-password" }].map((f, i) => (
                  <div className="relative" key={i}>
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type={show ? "text" : "password"} value={f.v} onChange={(e) => f.set(e.target.value)} required
                      placeholder={f.ph} autoComplete={f.ac}
                      className="w-full pl-9 pr-10 py-2.5 bg-background border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors" />
                    {i === 0 && (
                      <button type="button" onClick={() => setShow(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
                        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                ))}
                {password.length > 0 && !strongEnough && (
                  <p className="text-[11px] text-amber-400/80">Mínimo 8 caracteres, con mayúscula, minúscula y número.</p>
                )}
                {error && <p className="text-[12px] text-red-400">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : "Guardar contraseña"}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
