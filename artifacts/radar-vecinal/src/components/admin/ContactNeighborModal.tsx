import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, MessageSquare, Send, Loader2, MessageCircle, Mail, Bell,
  Clock, Check, AlertCircle, History, FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Tipos ───────────────────────────────────────────────────────────────────
interface ReportInfo {
  id: string;
  title: string;
  category: string;
  sector: string;
  district: string;
  authorName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  isAnonymous: boolean;
  status: string;
}

interface Message {
  id: string;
  sender: "admin" | "vecino";
  channel: "whatsapp" | "app" | "email";
  content: string;
  adminName: string | null;
  createdAt: string;
  readAt: string | null;
}

interface Props {
  report: ReportInfo | null;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

// ── Plantillas rápidas ──────────────────────────────────────────────────────
const QUICK_TEMPLATES = [
  {
    label: "Revisión en curso",
    content: "Estimado vecino, su reporte ha sido recibido y estamos evaluando la situación. Nuestro personal se encuentra en camino para atender la incidencia. Agradecemos su paciencia y colaboración.",
  },
  {
    label: "Más información",
    content: "Estimado vecino, para poder atender su reporte de manera eficiente, necesitamos información adicional. Por favor, comuníquese con nuestra central al 987-654-321 o acérquese a la oficina de atención al vecino. Gracias.",
  },
  {
    label: "Incidencia resuelta",
    content: "Estimado vecino, le informamos que su reporte ha sido atendido y la incidencia se encuentra resuelta. El personal municipal verificó la zona y tomó las acciones correspondientes. Agradecemos su compromiso con la seguridad de nuestro distrito.",
  },
  {
    label: "Derivado a otra área",
    content: "Estimado vecino, su reporte ha sido derivado al área correspondiente para su atención. Le mantendremos informado sobre el avance. Para cualquier consulta, puede comunicarse con nuestra central. Gracias.",
  },
];

// ── Metadata de canales ──────────────────────────────────────────────────────
const CHANNEL_META = {
  whatsapp: {
    icon: MessageCircle,
    label: "WhatsApp",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.15)",
    description: "Abrirá WhatsApp con el mensaje prellenado",
    recommended: true,
  },
  app: {
    icon: Bell,
    label: "Notificación en app",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.15)",
    description: "El vecino recibirá el mensaje en la app",
    recommended: false,
  },
  email: {
    icon: Mail,
    label: "Correo electrónico",
    color: "#a855f7",
    bg: "rgba(168,85,247,0.15)",
    description: "Se enviará un email al vecino",
    recommended: false,
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatPhoneForWa(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("51")) return digits;
  if (digits.startsWith("9")) return `51${digits}`;
  return digits;
}

// ── Componente principal ────────────────────────────────────────────────────
export default function ContactNeighborModal({ report, open, onClose, onSent }: Props) {
  const [channel, setChannel] = useState<"whatsapp" | "app" | "email">("whatsapp");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const { toast } = useToast();

  // Reset al abrir
  useEffect(() => {
    if (open && report) {
      setChannel("whatsapp");
      setContent("");
      setMessages([]);
      loadHistory();
    }
  }, [open, report?.id]);

  // Cargar historial de mensajes
  const loadHistory = async () => {
    if (!report) return;
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem("radarvecinal_token");
      const res = await fetch(`/api/reports/${report.id}/messages`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } catch { /* ignore */ }
    setLoadingHistory(false);
  };

  // Detectar disponibilidad de canales
  const hasPhone = !!report?.contactPhone;
  const isEmail = report?.contactPhone?.includes("@") ?? false;

  const isWhatsappAvailable = hasPhone;
  const isAppAvailable = !report?.isAnonymous;
  const isEmailAvailable = isEmail;

  const channels = [
    { id: "whatsapp" as const, available: isWhatsappAvailable, reason: "El vecino no registró número telefónico" },
    { id: "app" as const, available: isAppAvailable, reason: "El reporte fue realizado de forma anónima" },
    { id: "email" as const, available: isEmailAvailable, reason: "El vecino no registró correo electrónico" },
  ];

  // Manejar envío
  const handleSend = async () => {
    if (!report || !content.trim()) return;

    // WhatsApp: deep link directo (no requiere API)
    if (channel === "whatsapp") {
      const phone = formatPhoneForWa(report.contactPhone ?? "");
      const districtName = report.district || "San Ramón";
      const waMsg = encodeURIComponent(
        `🏛️ *Municipalidad de ${districtName}*

` +
        `Reporte: "${report.title}"
` +
        `Categoría: ${report.category}
` +
        `Sector: ${report.sector}

` +
        `${content.trim()}`
      );
      window.open(`https://wa.me/${phone}?text=${waMsg}`, "_blank");

      // Guardar en BD como enviado
      try {
        const token = localStorage.getItem("radarvecinal_token");
        await fetch(`/api/reports/${report.id}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ channel: "whatsapp", content: content.trim() }),
        });
      } catch { /* best-effort */ }

      toast({ title: "WhatsApp abierto", description: "El mensaje se ha prellenado en WhatsApp." });
      onSent();
      onClose();
      return;
    }

    // App o Email: vía API
    setSending(true);
    try {
      const token = localStorage.getItem("radarvecinal_token");
      const res = await fetch(`/api/reports/${report.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ channel, content: content.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al enviar mensaje");
      }

      toast({
        title: "✅ Mensaje enviado",
        description: `El vecino recibirá la notificación por ${CHANNEL_META[channel].label}.`,
      });

      setContent("");
      loadHistory();
      onSent();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "No se pudo enviar el mensaje",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  // Seleccionar plantilla
  const applyTemplate = (template: string) => {
    setContent(template);
  };

  // Time formateado
  const timeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 60000);
    if (diff < 1) return "Ahora";
    if (diff < 60) return `Hace ${diff} min`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} día${days > 1 ? "s" : ""}`;
  };

  if (!report) return null;

  const selectedMeta = CHANNEL_META[channel];

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 bg-black/70 z-[9998]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-4 md:inset-auto md:top-[5%] md:left-1/2 md:-translate-x-1/2 md:w-[520px] md:max-h-[85vh] z-[9999] bg-[#0b0e1a] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">Contactar vecino</h3>
                  <p className="text-[11px] text-muted-foreground truncate">{report.title}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/8 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar p-5 space-y-5">
              {/* Selector de canal */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2.5 block">
                  Canal de comunicación
                </label>
                <div className="flex flex-col gap-1.5">
                  {channels.map(ch => {
                    const meta = CHANNEL_META[ch.id];
                    const Icon = meta.icon;
                    const active = channel === ch.id;
                    return (
                      <button
                        key={ch.id}
                        onClick={() => ch.available && setChannel(ch.id)}
                        disabled={!ch.available}
                        className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all border ${
                          active
                            ? "bg-primary/10 border-primary/40"
                            : ch.available
                            ? "bg-white/[0.03] border-white/8 hover:border-white/15"
                            : "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"
                        }`}
                        title={!ch.available ? ch.reason : undefined}
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: meta.bg }}
                        >
                          <Icon className="w-4 h-4" style={{ color: meta.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">
                              {meta.label}
                              {meta.recommended && (
                                <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  Recomendado
                                </span>
                              )}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground/60">
                            {ch.available ? meta.description : ch.reason}
                          </p>
                        </div>
                        {active && (
                          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-primary" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Plantillas rápidas */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2.5 block">
                  Plantillas rápidas
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.label}
                      onClick={() => applyTemplate(tpl.content)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.04] border border-white/8 text-muted-foreground hover:text-white hover:border-white/20 transition-all"
                    >
                      <FileText className="w-3 h-3" />
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Área de texto */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2 block">
                  Mensaje
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    channel === "whatsapp"
                      ? "Escriba el mensaje que se prellenará en WhatsApp..."
                      : "Escriba el mensaje que recibirá el vecino..."
                  }
                  className="w-full h-28 rounded-xl bg-white/[0.04] border border-white/10 p-3.5 text-sm text-white placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-primary/50 transition-all"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-muted-foreground/40">
                    {content.length}/2000 caracteres
                  </span>
                  <span className="text-[10px] text-muted-foreground/40">
                    {content.trim() ? `${content.trim().split(/\s+/).length} palabras` : ""}
                  </span>
                </div>
              </div>

              {/* Historial de mensajes */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <History className="w-3.5 h-3.5 text-muted-foreground/60" />
                  <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                    Historial de comunicación
                  </span>
                </div>

                {loadingHistory ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <MessageSquare className="w-6 h-6 text-muted-foreground/20" />
                    <p className="text-xs text-muted-foreground/50">
                      No hay mensajes previos en este reporte.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {messages.map(msg => {
                      const meta = CHANNEL_META[msg.channel];
                      const Icon = meta?.icon ?? MessageSquare;
                      return (
                        <div
                          key={msg.id}
                          className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/5"
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: meta?.bg ?? "rgba(107,114,128,0.15)" }}
                          >
                            <Icon className="w-3.5 h-3.5" style={{ color: meta?.color ?? "#6b7280" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-white">
                                {msg.adminName ?? "Administración"}
                              </span>
                              <span
                                className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                                style={{ background: meta?.bg, color: meta?.color }}
                              >
                                {meta?.label ?? msg.channel}
                              </span>
                              {msg.readAt && (
                                <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/40">
                                  <Check className="w-2.5 h-2.5" />
                                  Leído
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                              {msg.content}
                            </p>
                            <span className="text-[9px] text-muted-foreground/40 mt-1 block">
                              {timeAgo(msg.createdAt)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/8 flex-shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/8 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSend}
                disabled={!content.trim() || sending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-40"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {channel === "whatsapp" ? "Abrir WhatsApp" : "Enviar mensaje"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
