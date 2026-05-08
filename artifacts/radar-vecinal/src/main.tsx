import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("Nueva versión disponible. ¿Actualizar?")) {
      updateSW();
    }
  },
  onOfflineReady() {
    console.log("Radar Vecinal listo para usar sin conexión");
  },
});

createRoot(document.getElementById("root")!).render(<App />);
