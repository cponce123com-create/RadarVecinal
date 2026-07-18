/**
 * ErrorBoundary — Red de seguridad de producción.
 *
 * Sin esto, cualquier error de render (o un chunk lazy que falla al cargar tras
 * un deploy) deja la pantalla en blanco. Muestra un mensaje amigable con botón
 * de recarga. Si el fallo es de carga de módulo (deploy nuevo → chunks viejos
 * 404), recargar resuelve.
 */
import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean; isChunkError: boolean }

function isChunkLoadError(error: unknown): boolean {
  const msg = String((error as any)?.message ?? error ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported module/i.test(msg);
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error: unknown) {
    // Log local; no hay telemetría remota configurada.
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-sm w-full rounded-2xl bg-card border border-white/8 p-8 flex flex-col items-center gap-4 text-center">
          <img src="/favicon.svg" alt="" width="48" height="48" className="w-12 h-12 opacity-90" />
          <div>
            <h2 className="text-lg font-bold text-white mb-1">
              {this.state.isChunkError ? "Hay una versión nueva" : "Algo salió mal"}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {this.state.isChunkError
                ? "La app se actualizó. Recarga para usar la versión más reciente."
                : "Ocurrió un error inesperado. Recarga la página para continuar."}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all"
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }
}
