/**
 * Skeleton — bloques "shimmer" para estados de carga.
 *
 * Mejora la percepción de velocidad: en vez de un spinner genérico, se muestra
 * la forma aproximada del contenido que va a aparecer. Respeta
 * `prefers-reduced-motion` (sin animación si el usuario lo pide).
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg bg-white/[0.06] motion-safe:animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

/** Skeleton genérico de página (encabezado + tarjetas) para los Suspense. */
export function PageSkeleton() {
  return (
    <div className="w-full max-w-[1180px] mx-auto flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-7 w-52" />
      <Skeleton className="h-4 w-72" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-1">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <div className="flex flex-col gap-2.5 mt-2">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
      </div>
    </div>
  );
}
