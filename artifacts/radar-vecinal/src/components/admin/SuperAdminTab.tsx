import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Key, Building2, List, RefreshCw, CheckCircle2, XCircle,
  Shield, Users, FileText, Calendar, Copy, Check, Globe,
} from "lucide-react";
import { customFetch } from "@workspace/api-client-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface License {
  id: string;
  code: string;
  siglas: string;
  districtName: string;
  province: string;
  department: string;
  isActive: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
  municipalUserId: string | null;
  createdAt: string;
}

interface MunicipalUser {
  id: string;
  name: string;
  email: string;
  role: string;
  district: string;
  displayName: string | null;
  isActive: boolean;
}

interface AdminStats {
  municipalUsers: number;
  viewerUsers: number;
  activeLicenses: number;
  pendingLicenses: number;
  totalUsers: number;
  totalReports: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

// ── Generar Código ═════════════════════════════════════════════════════════
function GenerateLicenseForm({ onGenerated }: { onGenerated: () => void }) {
  const [siglas, setSiglas] = useState("");
  const [distrito, setDistrito] = useState("");
  const [provincia, setProvincia] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ code: string; siglas: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siglas.trim() || !distrito.trim() || !provincia.trim() || !departamento.trim()) {
      setError("Todos los campos son obligatorios");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      // customFetch devuelve el body ya parseado y lanza ApiError si !ok.
      const data = await customFetch<{ license: { code: string; siglas: string } }>("/api/admin/licenses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siglas, distrito, provincia, departamento }),
      });
      setResult({ code: data.license.code, siglas: data.license.siglas });
      setSiglas(""); setDistrito(""); setProvincia(""); setDepartamento("");
      onGenerated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-card border border-white/8 p-5">
      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
        <Key className="w-4 h-4 text-primary" />
        Generar Código de Licencia
      </h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input value={siglas} onChange={e => setSiglas(e.target.value.toUpperCase())}
          placeholder="Siglas (ej: MDSR)"
          className="col-span-1 px-3 py-2.5 rounded-xl bg-black/30 border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors"
        />
        <input value={distrito} onChange={e => setDistrito(e.target.value)}
          placeholder="Distrito (ej: San Ramón)"
          className="col-span-1 px-3 py-2.5 rounded-xl bg-black/30 border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors"
        />
        <input value={provincia} onChange={e => setProvincia(e.target.value)}
          placeholder="Provincia (ej: Chanchamayo)"
          className="col-span-1 px-3 py-2.5 rounded-xl bg-black/30 border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors"
        />
        <input value={departamento} onChange={e => setDepartamento(e.target.value)}
          placeholder="Departamento (ej: Junín)"
          className="col-span-1 px-3 py-2.5 rounded-xl bg-black/30 border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors"
        />
        <button type="submit" disabled={loading}
          className="col-span-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50">
          {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generando...</>
            : <><Key className="w-4 h-4" /> Generar Código de 16 Dígitos</>}
        </button>
      </form>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <p className="text-xs text-emerald-400 font-semibold mb-2">
              ✅ Código generado para {result.siglas}
            </p>
            <div className="flex items-center gap-2 bg-black/40 rounded-lg p-3">
              <code className="text-lg font-mono font-bold text-white tracking-widest flex-1 text-center">
                {result.code}
              </code>
              <button onClick={() => { copyToClipboard(result.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="p-2 rounded-lg hover:bg-white/8 transition-colors">
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground text-center">
              Entrégale este código al usuario municipal para que active su licencia.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Lista de Licencias ═════════════════════════════════════════════════════
function LicenseList() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await customFetch<{ licenses: License[] }>("/api/admin/licenses");
      setLicenses(data.licenses ?? []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const handleRevoke = async (id: string) => {
    if (!confirm("¿Revocar esta licencia? El municipal perderá acceso.")) return;
    try {
      await customFetch(`/api/admin/licenses/${id}/revoke`, { method: "POST" });
      fetch();
    } catch {}
  };

  if (loading) return <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="rounded-2xl bg-card border border-white/8 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <List className="w-4 h-4 text-primary" />
          Licencias ({licenses.length})
        </h3>
        <button onClick={fetch} className="p-1.5 rounded-lg hover:bg-white/8 transition-colors">
          <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {licenses.map(l => (
          <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/5">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${l.isActive ? "bg-emerald-400" : "bg-amber-400"}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{l.siglas}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/6 text-muted-foreground font-mono">{l.code.slice(0, 4)}...{l.code.slice(-4)}</span>
                {l.isActive && l.daysRemaining !== null && (
                  <span className={`text-[10px] font-medium ${l.daysRemaining > 30 ? "text-emerald-400" : l.daysRemaining > 7 ? "text-amber-400" : "text-red-400"}`}>
                    {l.daysRemaining}d
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{l.districtName} - {l.province}, {l.department}</p>
            </div>
            {l.isActive && (
              <button onClick={() => handleRevoke(l.id)}
                className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
              </button>
            )}
          </div>
        ))}
        {licenses.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sin licencias aún</p>}
      </div>
    </div>
  );
}

// ── Crear Municipal ═══════════════════════════════════════════════════════
function CreateMunicipalForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", email: "", password: "",
    siglas: "", districtName: "", province: "", department: "",
    displayName: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setResult(null);
    try {
      // customFetch devuelve el body ya parseado y lanza ApiError si !ok.
      const data = await customFetch<{ user: { name: string; email: string }; license?: { code: string } }>("/api/admin/municipal-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, generateLicense: true }),
      });
      setResult(data);
      setForm({ name: "", email: "", password: "", siglas: "", districtName: "", province: "", department: "", displayName: "" });
      onCreated();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="rounded-2xl bg-card border border-white/8 p-5">
      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
        <Building2 className="w-4 h-4 text-primary" />
        Crear Usuario Municipal
      </h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input value={form.name} onChange={handleChange("name")} placeholder="Nombre completo"
          className="col-span-1 px-3 py-2.5 rounded-xl bg-black/30 border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50" />
        <input value={form.email} onChange={handleChange("email")} placeholder="Email (ej: mdsr@radarvecinal.pe)"
          className="col-span-1 px-3 py-2.5 rounded-xl bg-black/30 border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50" />
        <input value={form.password} onChange={handleChange("password")} type="password" placeholder="Contraseña (mín 8)"
          className="col-span-1 px-3 py-2.5 rounded-xl bg-black/30 border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50" />
        <input value={form.siglas} onChange={handleChange("siglas")} placeholder="Siglas (ej: MDSR)"
          className="col-span-1 px-3 py-2.5 rounded-xl bg-black/30 border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50" />
        <input value={form.districtName} onChange={handleChange("districtName")} placeholder="Distrito (ej: San Ramón)"
          className="col-span-1 px-3 py-2.5 rounded-xl bg-black/30 border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50" />
        <input value={form.province} onChange={handleChange("province")} placeholder="Provincia (ej: Chanchamayo)"
          className="col-span-1 px-3 py-2.5 rounded-xl bg-black/30 border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50" />
        <input value={form.department} onChange={handleChange("department")} placeholder="Departamento (ej: Junín)"
          className="col-span-1 px-3 py-2.5 rounded-xl bg-black/30 border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50" />
        <input value={form.displayName} onChange={handleChange("displayName")} placeholder="Nombre para mostrar (ej: Juan Pérez)"
          className="col-span-1 px-3 py-2.5 rounded-xl bg-black/30 border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50" />
        <button type="submit" disabled={loading}
          className="col-span-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent/90 transition-all disabled:opacity-50">
          {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creando...</>
            : <><Building2 className="w-4 h-4" /> Crear Municipal + Licencia</>}
        </button>
      </form>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <p className="text-xs text-emerald-400 font-semibold">✅ Municipal creado</p>
          <p className="text-xs text-muted-foreground mt-1">{result.user.name} · {result.user.email}</p>
          {result.license && (
            <div className="mt-2 flex items-center gap-2 bg-black/40 rounded-lg p-2.5">
              <code className="text-sm font-mono font-bold text-white tracking-widest flex-1 text-center">
                {result.license.code}
              </code>
              <button onClick={() => { copyToClipboard(result.license.code); }}
                className="p-1.5 rounded-lg hover:bg-white/8 transition-colors">
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ── Dashboard Stats ═══════════════════════════════════════════════════════
function StatsCards() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customFetch<{ stats: AdminStats }>("/api/admin/stats").then(d => {
      setStats(d.stats);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading || !stats) return null;

  const cards = [
    { label: "Municipales", value: stats.municipalUsers, icon: Building2, color: "bg-blue-500/10 border-blue-500/30 text-blue-400" },
    { label: "Visores", value: stats.viewerUsers, icon: Users, color: "bg-violet-500/10 border-violet-500/30 text-violet-400" },
    { label: "Licencias Activas", value: stats.activeLicenses, icon: CheckCircle2, color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
    { label: "Licencias Pendientes", value: stats.pendingLicenses, icon: Key, color: "bg-amber-500/10 border-amber-500/30 text-amber-400" },
    { label: "Total Usuarios", value: stats.totalUsers, icon: Globe, color: "bg-sky-500/10 border-sky-500/30 text-sky-400" },
    { label: "Total Reportes", value: stats.totalReports, icon: FileText, color: "bg-rose-500/10 border-rose-500/30 text-rose-400" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(c => {
        const Icon = c.icon;
        return (
          <div key={c.label} className={`rounded-xl p-3 border ${c.color} flex flex-col gap-1`}>
            <Icon className="w-4 h-4" />
            <span className="text-lg font-bold">{c.value}</span>
            <span className="text-[10px] opacity-80">{c.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Componente Principal ══════════════════════════════════════════════════
export default function SuperAdminTab() {
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = () => setRefreshKey(k => k + 1);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-white">Panel de Super Administrador</h2>
      </div>

      <StatsCards key={`stats-${refreshKey}`} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GenerateLicenseForm onGenerated={reload} />
        <LicenseList key={`lic-${refreshKey}`} />
      </div>

      <CreateMunicipalForm onCreated={reload} />
    </div>
  );
}
