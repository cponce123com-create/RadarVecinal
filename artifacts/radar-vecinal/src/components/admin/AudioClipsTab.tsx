/**
 * AudioClipsTab — Audios de los avisos por voz (panel admin).
 *
 * El superadmin/municipalidad graba (con su propia voz y acento) o sube un
 * audio por tipo de servicio. La app lo reproduce en el aviso de cercanía en
 * vez del TTS robótico ("Vecino, la tamalera está cerca").
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Volume2, Play, Upload, Trash2, Save, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDistrict } from "@/contexts/DistrictContext";
import VoiceNoteRecorder from "@/components/VoiceNoteRecorder";
import { uploadMedia } from "@/lib/uploadMedia";
import { playClip } from "@/lib/voiceAlerts";
import { listVoiceClips, upsertVoiceClip, deleteVoiceClip, type VoiceClip } from "@/lib/voiceClips";
import { providerMeta, type LiveProviderType } from "@/lib/liveProviders";

const CLIP_TYPES: LiveProviderType[] = ["recolector", "tamalero", "panadero", "lechero", "gasero", "agua"];

const DEFAULT_PHRASE: Record<string, string> = {
  recolector: "Vecino, el camión recolector está cerca.",
  tamalero: "Vecino, la tamalera está cerca.",
  panadero: "Vecino, el panadero está cerca.",
  lechero: "Vecino, el lechero está cerca.",
  gasero: "Vecino, el gas está pasando cerca.",
  agua: "Vecino, el repartidor de agua está cerca.",
};

export default function AudioClipsTab() {
  const { toast } = useToast();
  const { currentDistrictId, currentDistrict } = useDistrict();
  const [phrases, setPhrases] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["admin-voice-clips", currentDistrictId],
    queryFn: () => listVoiceClips(currentDistrictId as number),
    enabled: !!currentDistrictId,
  });
  const byType = new Map<string, VoiceClip>();
  for (const c of data ?? []) byType.set(c.type, c);

  const phraseFor = (t: LiveProviderType) =>
    phrases[t] ?? byType.get(t)?.phrase ?? DEFAULT_PHRASE[t] ?? "";

  const save = async (t: LiveProviderType, patch: { audioUrl?: string | null; enabled?: boolean }) => {
    if (!currentDistrictId) return;
    setBusy(t);
    try {
      const cur = byType.get(t);
      await upsertVoiceClip({
        type: t,
        districtId: currentDistrictId,
        phrase: phraseFor(t),
        audioUrl: patch.audioUrl !== undefined ? patch.audioUrl : cur?.audioUrl ?? null,
        enabled: patch.enabled !== undefined ? patch.enabled : cur?.enabled ?? true,
      });
      await refetch();
      toast({ title: "Audio guardado" });
    } catch (e: any) {
      toast({ title: "No se pudo guardar", description: e?.message ?? "", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const onUploadFile = async (t: LiveProviderType, file: File) => {
    if (!file.type.startsWith("audio/")) {
      toast({ title: "Formato no válido", description: "Sube un archivo de audio (mp3, m4a, ogg).", variant: "destructive" });
      return;
    }
    setBusy(t);
    try {
      const url = await uploadMedia(file, "audio", `aviso-${t}`);
      await save(t, { audioUrl: url });
    } catch (e: any) {
      toast({ title: "No se pudo subir", description: e?.message ?? "", variant: "destructive" });
      setBusy(null);
    }
  };

  const remove = async (clip: VoiceClip) => {
    if (!confirm("¿Eliminar este audio? El aviso volverá a usar la voz automática.")) return;
    setBusy(clip.type);
    try {
      await deleteVoiceClip(clip.id);
      await refetch();
      toast({ title: "Audio eliminado" });
    } catch (e: any) {
      toast({ title: "No se pudo eliminar", description: e?.message ?? "", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (!currentDistrictId) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Elige un distrito para gestionar los audios.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-white flex items-center gap-2"><Volume2 className="w-4 h-4 text-emerald-400" /> Audios de los avisos de voz</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Graba con tu voz o sube un audio por servicio para <b className="text-white/80">{currentDistrict || "tu distrito"}</b>.
          La app lo reproducirá cuando el servicio se acerque a la casa del vecino. Si no hay audio, usa la voz automática.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {CLIP_TYPES.map((t) => {
            const meta = providerMeta(t);
            const clip = byType.get(t);
            const hasAudio = !!clip?.audioUrl;
            return (
              <motion.div key={t} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl border border-white/8 bg-card">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <span className="text-2xl">{meta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-white">{meta.label}</p>
                    <p className="text-[10.5px] text-muted-foreground">
                      {hasAudio ? "🎙️ Audio grabado" : "Usa la voz automática (TTS)"}
                    </p>
                  </div>
                  {clip && (
                    <button onClick={() => save(t, { enabled: !clip.enabled })} disabled={busy === t}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-[11px] text-white/80 disabled:opacity-50">
                      {clip.enabled ? <><ToggleRight className="w-3.5 h-3.5 text-emerald-400" /> Activo</> : <><ToggleLeft className="w-3.5 h-3.5" /> Inactivo</>}
                    </button>
                  )}
                </div>

                {/* Frase (respaldo de voz automática + guía para grabar) */}
                <input
                  value={phraseFor(t)}
                  onChange={(e) => setPhrases((p) => ({ ...p, [t]: e.target.value }))}
                  placeholder={DEFAULT_PHRASE[t]}
                  maxLength={200}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                />

                {/* Reproducir / grabar / subir / guardar / eliminar */}
                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                  {hasAudio && (
                    <button onClick={() => playClip(clip!.audioUrl!)}
                      className="flex items-center gap-1 px-3 py-2 min-h-[38px] rounded-lg bg-emerald-500/12 border border-emerald-500/35 text-emerald-300 text-[11px] font-semibold">
                      <Play className="w-3.5 h-3.5" /> Escuchar
                    </button>
                  )}

                  {/* Grabar con la propia voz (≤20s) → sube y guarda */}
                  <div className="min-w-[150px]">
                    <VoiceNoteRecorder onChange={(url) => { if (url) save(t, { audioUrl: url }); }} />
                  </div>

                  {/* Subir un archivo de audio */}
                  <label className="flex items-center gap-1 px-3 py-2 min-h-[38px] rounded-lg bg-white/[0.05] border border-white/10 text-[11px] text-white/80 cursor-pointer hover:bg-white/10 transition-colors">
                    <Upload className="w-3.5 h-3.5" /> Subir
                    <input type="file" accept="audio/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadFile(t, f); e.currentTarget.value = ""; }} />
                  </label>

                  <button onClick={() => save(t, {})} disabled={busy === t}
                    className="flex items-center gap-1 px-3 py-2 min-h-[38px] rounded-lg bg-primary/15 border border-primary/40 text-primary text-[11px] font-semibold disabled:opacity-50">
                    {busy === t ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar frase
                  </button>

                  {clip && (
                    <button onClick={() => remove(clip)} disabled={busy === t}
                      className="flex items-center gap-1 px-3 py-2 min-h-[38px] rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-[11px] disabled:opacity-50 ml-auto">
                      <Trash2 className="w-3.5 h-3.5" /> Quitar audio
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
        Consejo: graba frases cortas y claras ("Vecino, la tamalera está cerca"). El audio se reproduce con la app
        abierta; con la app cerrada llegará como notificación (fase siguiente).
      </p>
    </div>
  );
}
