/**
 * DevicesTab — Registro de dispositivos oficiales de rastreo (panel admin).
 *
 * La municipalidad da de alta un camión/servicio y obtiene un enlace con una
 * clave secreta. Ese enlace se abre UNA vez en el celular montado en el camión
 * y transmite solo (sin login ni operador), apareciendo como "Oficial" en el
 * mapa con su ruta e historial. La misma clave sirve luego para un GPS
 * vehicular vía el endpoint de ingesta HTTP.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Truck, Plus, Copy, Trash2, ToggleLeft, ToggleRight, ExternalLink, Radio, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  listDevices, createDevice, updateDevice, deleteDevice,
  PROVIDER_META, providerMeta, type LiveDevice, type LiveProviderType,
} from "@/lib/liveProviders";

function deviceUrl(key: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/en-vivo?device=${key}`;
}

export default function DevicesTab() {
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [type, setType] = useState<LiveProviderType>("recolector");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-live-devices"],
    queryFn: () => listDevices(),
    refetchInterval: 15000,
  });
  const devices = data ?? [];

  const create = async () => {
    if (label.trim().length < 2) {
      toast({ title: "Ponle un nombre", description: "Ej: Camión Recolector 1.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await createDevice({ label: label.trim(), type });
      setLabel("");
      toast({ title: "Dispositivo creado", description: "Abre su enlace en el celular del camión." });
      refetch();
    } catch (e: any) {
      toast({ title: "No se pudo crear", description: e?.message ?? "Intenta de nuevo.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (d: LiveDevice) => {
    setBusyId(d.id);
    try {
      await updateDevice(d.id, { enabled: !d.enabled });
      refetch();
    } catch (e: any) {
      toast({ title: "No se pudo actualizar", description: e?.message ?? "", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (d: LiveDevice) => {
    if (!confirm(`¿Eliminar "${d.label}"? El enlace dejará de funcionar.`)) return;
    setBusyId(d.id);
    try {
      await deleteDevice(d.id);
      toast({ title: "Dispositivo eliminado" });
      refetch();
    } catch (e: any) {
      toast({ title: "No se pudo eliminar", description: e?.message ?? "", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = (d: LiveDevice) => {
    navigator.clipboard?.writeText(deviceUrl(d.deviceKey)).then(
      () => toast({ title: "Enlace copiado", description: "Ábrelo en el celular del camión." }),
      () => toast({ title: "No se pudo copiar", variant: "destructive" }),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-white flex items-center gap-2"><Truck className="w-4 h-4 text-primary" /> Dispositivos oficiales de rastreo</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Registra el camión recolector u otro servicio. Abre su enlace en el celular montado (con chip)
          y transmitirá solo, marcado como <b className="text-emerald-300">Oficial</b>, con su ruta e historial.
        </p>
      </div>

      {/* Crear */}
      <div className="flex flex-col sm:flex-row gap-2 p-3 rounded-xl bg-card border border-white/8">
        <input
          value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="Nombre (ej: Camión Recolector 1)" maxLength={80}
          className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
        />
        <select
          value={type} onChange={(e) => setType(e.target.value as LiveProviderType)}
          className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none [color-scheme:dark]"
        >
          {PROVIDER_META.map((m) => <option key={m.type} value={m.type}>{m.emoji} {m.label}</option>)}
        </select>
        <button
          onClick={create} disabled={creating}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary/15 border border-primary/40 text-primary text-sm font-semibold hover:bg-primary/25 transition-all disabled:opacity-50"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Crear
        </button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Aún no hay dispositivos. Crea el primero arriba.</div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence>
            {devices.map((d) => {
              const meta = providerMeta(d.type);
              return (
                <motion.div
                  key={d.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className={`p-3 rounded-xl border ${d.enabled ? "bg-card border-white/8" : "bg-white/[0.02] border-white/6 opacity-70"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{meta.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-white truncate">{d.label}</p>
                        {d.liveNow && (
                          <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/40 text-red-300">
                            <Radio className="w-2.5 h-2.5" /> EN VIVO
                          </span>
                        )}
                        {!d.enabled && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/8 text-muted-foreground">deshabilitado</span>}
                      </div>
                      <p className="text-[10.5px] text-muted-foreground truncate">{deviceUrl(d.deviceKey)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                    <button onClick={() => copyLink(d)}
                      className="flex items-center gap-1 px-3 py-2 min-h-[38px] rounded-lg bg-white/[0.05] border border-white/10 text-[11px] text-white/80 hover:bg-white/10 transition-colors">
                      <Copy className="w-3 h-3" /> Copiar enlace
                    </button>
                    <a href={deviceUrl(d.deviceKey)} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 px-3 py-2 min-h-[38px] rounded-lg bg-white/[0.05] border border-white/10 text-[11px] text-white/80 hover:bg-white/10 transition-colors">
                      <ExternalLink className="w-3 h-3" /> Abrir modo dispositivo
                    </a>
                    <button onClick={() => toggle(d)} disabled={busyId === d.id}
                      className="flex items-center gap-1 px-3 py-2 min-h-[38px] rounded-lg bg-white/[0.05] border border-white/10 text-[11px] text-white/80 hover:bg-white/10 transition-colors disabled:opacity-50">
                      {d.enabled ? <><ToggleRight className="w-3.5 h-3.5 text-emerald-400" /> Habilitado</> : <><ToggleLeft className="w-3.5 h-3.5" /> Deshabilitado</>}
                    </button>
                    <button onClick={() => remove(d)} disabled={busyId === d.id}
                      className="flex items-center gap-1 px-3 py-2 min-h-[38px] rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50 ml-auto">
                      <Trash2 className="w-3 h-3" /> Eliminar
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
        En el celular del camión: abre el enlace, permite la ubicación y déjalo montado y cargando.
        Transmite en segundo plano. Para detener, deshabilita el dispositivo aquí o cierra la pantalla en el celular.
      </p>
    </div>
  );
}
