import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { uploadMedia } from "@/lib/uploadMedia";

const MAX_MS = 20_000; // 20 segundos

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

interface Props {
  /** Recibe la URL subida (o null si se elimina). */
  onChange: (url: string | null) => void;
}

/**
 * Graba una nota de voz de máximo 20s, la sube a Cloudinary y devuelve la URL.
 * Corta automáticamente al llegar a 20s para no saturar el almacenamiento.
 */
export default function VoiceNoteRecorder({ onChange }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    timerRef.current = null;
    stopTimeoutRef.current = null;
  };

  useEffect(() => () => {
    cleanupStream();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Tu navegador no permite grabar audio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        cleanupStream();
        setRecording(false);
        void handleUpload(blob, type);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setElapsed(0);
      const startedAt = Date.now();
      timerRef.current = setInterval(() => setElapsed(Date.now() - startedAt), 100);
      stopTimeoutRef.current = setTimeout(() => stop(), MAX_MS);
    } catch {
      cleanupStream();
      setError("No se pudo acceder al micrófono. Revisa los permisos.");
    }
  };

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  };

  const handleUpload = async (blob: Blob, type: string) => {
    // Preview local inmediato
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setUploading(true);
    setUploaded(false);
    try {
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      const secureUrl = await uploadMedia(blob, "audio", `nota-voz.${ext}`);
      onChange(secureUrl);
      setUploaded(true);
    } catch (err: any) {
      setError(err?.message || "No se pudo subir la nota de voz.");
      onChange(null);
    } finally {
      setUploading(false);
    }
  };

  const remove = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setUploaded(false);
    setError(null);
    onChange(null);
  };

  const secs = Math.min(20, Math.floor(elapsed / 1000));
  const pct = Math.min(100, (elapsed / MAX_MS) * 100);

  // ── Grabando ──
  if (recording) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3.5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
          <span className="text-sm font-medium text-white tabular-nums">
            Grabando… {secs}s <span className="text-muted-foreground">/ 20s</span>
          </span>
          <button
            type="button"
            onClick={stop}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
          >
            <Square className="h-3.5 w-3.5" /> Detener
          </button>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-red-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  // ── Con nota grabada ──
  if (previewUrl) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-3">
          <audio src={previewUrl} controls className="h-9 min-w-0 flex-1" />
          {uploading ? (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Subiendo…
            </span>
          ) : uploaded ? (
            <span className="text-[11px] font-medium text-green-400">✓ Adjunta</span>
          ) : null}
          <button
            type="button"
            onClick={remove}
            aria-label="Eliminar nota de voz"
            className="flex-shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-white/8 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        {error && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-400">
            <AlertTriangle className="h-3 w-3" /> {error}
          </p>
        )}
      </div>
    );
  }

  // ── Estado inicial ──
  return (
    <div>
      <button
        type="button"
        onClick={start}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/10 py-3 text-sm text-muted-foreground transition-all hover:border-primary/40 hover:bg-white/[0.02] hover:text-white"
      >
        <Mic className="h-5 w-5 opacity-70" />
        Grabar nota de voz <span className="text-[11px] opacity-60">(máx. 20s)</span>
      </button>
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-400">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}
