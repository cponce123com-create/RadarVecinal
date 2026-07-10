import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDistrict } from "@/contexts/DistrictContext";
import { alertUser } from "@/lib/alertSound";

// F-07: Global SSE hook for real-time panic alert notifications from any page.
// Connects once to /api/panic-alerts/stream with districtId filter.
export function usePanicAlertStream() {
  const { toast } = useToast();
  const { currentDistrictId } = useDistrict();
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastAlertRef = useRef<string>("");

  useEffect(() => {
    // M-02: Solo conectar si tenemos districtId
    if (!currentDistrictId) return;

    // Cleanup previous connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/panic-alerts/stream?districtId=${currentDistrictId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data.type) return; // heartbeat

        const alertKey = data.id + data.createdAt;
        if (alertKey === lastAlertRef.current) return;
        lastAlertRef.current = alertKey;

        // Sonido + vibración por tipo (respeta silencio y horario en el motor)
        alertUser(data.type);

        const typeMap: Record<string, string> = {
          robbery: "🚨 Robo",
          medical: "🚑 Emergencia Médica",
          fight: "⚔️ Pelea",
          fire: "🔥 Incendio",
          missing_person: "🔍 Persona Desaparecida",
          other: "⚠️ Alerta General",
        };

        toast({
          title: typeMap[data.type] || "⚠️ Alerta de Pánico",
          description: `${data.authorName} — ${data.address || data.sector || ""}`,
          variant: data.type === "robbery" || data.type === "fire" ? "destructive" as const : "default" as const,
        });
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // Connection lost — will auto-reconnect by browser default
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [currentDistrictId, toast]);
}
