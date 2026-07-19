/**
 * PasswordRecovery — "Olvidé mi contraseña": pide el correo y solicita el enlace.
 * La respuesta es siempre genérica (no revela si el correo existe).
 */
import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Mail, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";

export default function PasswordRecovery() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      /* respuesta genérica igual */
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="rounded-2xl bg-card border border-white/8 p-7">
          {sent ? (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-success/12 border border-success/25 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Revisa tu correo</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Si <b className="text-white/80">{email}</b> está registrado, te enviamos un enlace para restablecer tu contraseña. Vence en 30 minutos.
                </p>
              </div>
              <Link href="/home">
                <span className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline cursor-pointer">
                  <ArrowLeft className="w-4 h-4" /> Volver al inicio
                </span>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-white mb-1">Recuperar contraseña</h2>
              <p className="text-sm text-muted-foreground mb-5">Ingresa tu correo y te enviaremos un enlace para crear una nueva.</p>
              <form onSubmit={submit} className="flex flex-col gap-3">
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                    placeholder="tu@correo.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-background border border-white/10 rounded-xl text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</> : "Enviar enlace"}
                </button>
              </form>
              <Link href="/home">
                <span className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-white mt-4 cursor-pointer">
                  <ArrowLeft className="w-3.5 h-3.5" /> Volver
                </span>
              </Link>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
