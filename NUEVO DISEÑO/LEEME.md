# Radar Vecinal — Rediseño de frontend

Estos archivos aplican el nuevo sistema visual a tu repo real (React + Vite + Tailwind v4 + shadcn/ui). Están pensados para **reemplazar** los archivos equivalentes de tu proyecto.

## Estructura (copia sobre `artifacts/radar-vecinal/`)

```
index.html                    → reemplaza  artifacts/radar-vecinal/index.html
src/index.css                 → reemplaza  src/index.css
src/components/Layout.tsx      → reemplaza  src/components/Layout.tsx
src/pages/Home.tsx             → reemplaza  src/pages/Home.tsx
```

## Pasos

1. **Haz un commit/backup** de tu estado actual (por si quieres volver).
2. Copia los 4 archivos a las rutas indicadas, sobrescribiendo.
3. Reinicia el dev server (`pnpm dev`). No hace falta instalar dependencias nuevas: se siguen usando `lucide-react`, `framer-motion`, `wouter` y `date-fns`, que ya tienes.
4. Verifica `Inicio` y la navegación. Las fuentes nuevas (Space Grotesk + JetBrains Mono) se cargan desde `index.html`.

## Qué cambió

- **Tokens (`index.css`)**: paleta carbón por capas, azul eléctrico `#2f6bff`, cian radar `#22d3ee`, verde/ámbar/rojo afinados. Nueva fuente display (Space Grotesk) y mono (JetBrains Mono). Se añadió el color `cyan`, utilidades `.rv-grid`, `.radar-sweep`, `.label-mono`, `.rv-in` y glows.
- **`Layout.tsx`**: barra lateral con logo radar en gradiente, botón "Nuevo Reporte" elevado, nav con estado activo azul, tarjeta de usuario, **topbar de escritorio** con título dinámico por ruta + píldora "RED ACTIVA", y botón de pánico con glow.
- **`Home.tsx`**: dashboard con **radar animado** (blips desde tus reportes reales), KPIs, acciones rápidas, panel de alertas activas, feed de actividad y resumen del distrito. Usa tus hooks (`useGetStats`, `useGetReports`, etc.) sin cambios.

## Siguientes pantallas

El mismo lenguaje (tokens + clases) aplica a las demás páginas. Cuando quieras, genero:
`MapPage.tsx`, `Alerts.tsx`, `ReportForm.tsx`, `Emergencias.tsx`, `Stats.tsx`, `Admin.tsx`, `Profile.tsx`.

## Notas

- Clases como `bg-cyan/18` o `from-cyan` funcionan porque se registró `--color-cyan` en `@theme inline`.
- Si usas `class="dark"` en algún lado, el tema ya es oscuro por defecto; no es necesario.
- El prototipo de referencia completo está en `Radar Vecinal.dc.html`.
