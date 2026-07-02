import { useState, useEffect } from "react";
import { WifiOff, CloudUpload, RefreshCw, CheckCircle } from "lucide-react";
import { getPending, syncPending } from "@/lib/offlineSync";

/**
 * OfflineBanner — Indicador de estado offline + botón de sincronización.
 * Inspirado en Tancítaro (offline mode).
 */
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = useState(getPending().length);
  const [syncing, setSyncing] = useState(false);
  const [showSync, setShowSync] = useState(false);

  useEffect(() => {
    const goOnline = () => { setIsOffline(false); syncNow(); };
    const goOffline = () => setIsOffline(true);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Actualizar contador periódicamente
  useEffect(() => {
    const interval = setInterval(() => setPendingCount(getPending().length), 3000);
    return () => clearInterval(interval);
  }, []);

  const syncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    const result = await syncPending();
    setPendingCount(getPending().length);
    setSyncing(false);
    if (result.synced > 0) {
      setShowSync(true);
      setTimeout(() => setShowSync(false), 3000);
    }
  };

  // Si hay pendientes pero estamos online, ofrecer sincronizar
  // Auto-sync cuando hay pendientes y estamos online
  useEffect(() => {
    if (!isOffline && pendingCount > 0) {
      const timer = setTimeout(() => syncNow(), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOffline, pendingCount]);

  if (isOffline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 bg-red-500/20 border-b border-red-500/30 text-red-400 text-xs font-medium">
        <WifiOff className="w-3.5 h-3.5" />
        Sin conexión — los reportes se guardarán localmente
        {pendingCount > 0 && <span className="ml-1">({pendingCount} pendientes)</span>}
      </div>
    );
  }

  if (showSync) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 bg-green-500/20 border-b border-green-500/30 text-green-400 text-xs font-medium">
        <CheckCircle className="w-3.5 h-3.5" />
        Reportes sincronizados correctamente
      </div>
    );
  }

  return null;
}
