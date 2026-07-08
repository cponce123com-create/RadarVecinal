import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

const updateSW = registerSW({
  onNeedRefresh() {
    // UX: aviso no bloqueante con acción, en vez de un confirm() nativo.
    toast({
      title: "Nueva versión disponible",
      description: "Actualiza para obtener las últimas mejoras.",
      action: (
        <ToastAction altText="Actualizar ahora" onClick={() => updateSW(true)}>
          Actualizar
        </ToastAction>
      ),
    });
  },
  onOfflineReady() {
    toast({
      title: "Listo sin conexión",
      description: "Radar Vecinal ya funciona sin internet.",
    });
  },
});

createRoot(document.getElementById("root")!).render(<App />);
