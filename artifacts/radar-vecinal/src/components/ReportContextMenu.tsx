import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, MessageSquare, X, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReportInfo {
  id: string;
  title: string;
  status: string;
}

interface ReportContextMenuProps {
  report: ReportInfo | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onResolved: () => void;
}

export default function ReportContextMenu({ report, position, onClose, onResolved }: ReportContextMenuProps) {
  const [showMessageInput, setShowMessageInput] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  if (!report || !position) return null;

  const handleResolve = async () => {
    setShowMessageInput(true);
  };

  const handleSendResolution = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const token = localStorage.getItem("radarvecinal_token");
      const res = await fetch(`/api/reports/${report.id}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al resolver");
      }

      toast({
        title: "✅ Incidencia resuelta",
        description: `Mensaje enviado al vecino: "${message.trim()}"`,
      });

      setMessage("");
      setShowMessageInput(false);
      onClose();
      onResolved();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "No se pudo resolver la incidencia",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleResolveQuick = async () => {
    setSending(true);
    try {
      const token = localStorage.getItem("radarvecinal_token");
      const defaultMsg = "Vecino, ya hemos atendido su reporte. El personal municipal ha resuelto la incidencia. Gracias por su colaboración.";
      const res = await fetch(`/api/reports/${report.id}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: defaultMsg }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al resolver");
      }

      toast({
        title: "✅ Incidencia resuelta",
        description: "La incidencia ha sido marcada como resuelta.",
      });

      onClose();
      onResolved();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "No se pudo resolver la incidencia",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -4 }}
        transition={{ duration: 0.12 }}
        className="fixed z-[10000] min-w-[220px]"
        style={{
          left: Math.min(position.x, window.innerWidth - 240),
          top: Math.min(position.y, window.innerHeight - (showMessageInput ? 280 : 160)),
        }}
      >
        <div className="bg-[#0f1220] border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl">
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-white/5">
            <p className="text-xs font-bold text-white truncate">{report.title}</p>
            <p className="text-[10px] text-muted-foreground/60">ID: #{report.id.slice(0, 8)}</p>
          </div>

          {/* Actions */}
          <div className="p-1.5 flex flex-col gap-0.5">
            {!showMessageInput ? (
              <>
                <button
                  onClick={handleResolveQuick}
                  disabled={sending}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left text-green-400 hover:bg-green-500/10 transition-all disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  <span className="font-medium">Resolver y avisar</span>
                </button>

                <button
                  onClick={handleResolve}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left text-blue-400 hover:bg-blue-500/10 transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="font-medium">Resolver con mensaje personalizado</span>
                </button>
              </>
            ) : (
              <div className="p-1 flex flex-col gap-2">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escribe un mensaje para el vecino...
Ej: Vecino, ya hemos enviado personal a la zona."
                  className="w-full h-24 rounded-lg bg-white/5 border border-white/10 p-2.5 text-xs text-white placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-primary/50 transition-colors"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSendResolution}
                    disabled={!message.trim() || sending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all disabled:opacity-40"
                  >
                    {sending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Enviar y resolver
                  </button>
                  <button
                    onClick={() => setShowMessageInput(false)}
                    className="px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-white hover:bg-white/8 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
