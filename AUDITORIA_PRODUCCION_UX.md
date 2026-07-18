# Auditoría de UX para Producción — RadarVecinal

**Fecha:** 2026-07-18
**Alcance:** Frontend `radar-vecinal` (React 19 + Vite 7 + Tailwind v4)
**Enfoque:** Experiencia de usuario, accesibilidad, mobile-first, consistencia visual, feedback y flujos

---

## 1. Resumen Ejecutivo

RadarVecinal tiene una base UX sólida: navegación mobile-first con bottom-nav, tema oscuro coherente, diseño system con tokens HSL y componentes shadcn/ui. Sin embargo, existen brechas entre lo funcional y lo "listo para producción" que deben cerrarse antes del lanzamiento.

**Hallazgo principal:** La app es usable pero tiene **fricciones en flujos críticos** (reportar sin conexión, vacíos de datos sin explicación, distrito hardcodeado visualmente) y **deuda de accesibilidad** (WCAG AA no se alcanza completamente).

---

## 2. Navegación y Arquitectura de Información

| # | Hallazgo | Impacto | Prioridad | Recomendación |
|---|---|---|---|---|
| UX-NAV1 | **Bottom-nav + sidebar + drawer** usando 3 patrones de navegación distintos | Medio | P3 | Unificar: en mobile solo bottom-nav, en desktop sidebar + topbar. El drawer es redundante. |
| UX-NAV2 | Subtítulo del topbar tenía `"GEOLOCALIZACIÓN · SAN RAMÓN"` hardcodeado | Medio | P1 | ✅ **Corregido** — ahora muestra el distrito activo dinámicamente |
| UX-NAV3 | Botón "Nuevo Reporte" FAB (flotante) visible siempre, incluso sin sesión | Bajo | P2 | Mostrarlo solo si el usuario está autenticado, o redirigir a login con mensaje claro |
| UX-NAV4 | Sin indicador de página actual en títulos del `<title>` del navegador | Bajo | P2 | ✅ **Corregido** (parte de mejoras SEO) |
| UX-NAV5 | En el menú de navegación no se indica visualmente la ruta activa en todos los menús | Medio | P1 | ✅ **Corregido** — `aria-current="page"` añadido en sidebar, drawer y bottom-nav |

---

## 3. Estados de Carga y Vacío (Loading & Empty States)

| # | Hallazgo | Impacto | Prioridad | Recomendación |
|---|---|---|---|---|
| UX-ES1 | Pantallas sin datos muestran listados vacíos sin explicación | Alto | P1 | Añadir empty states con: ilustración simple, mensaje claro ("Aún no hay reportes en tu distrito"), y CTA ("Sé el primero en reportar") |
| UX-ES2 | Spinners genéricos en `Suspense` sin indicar qué está cargando | Medio | P2 | Usar skeletons (shimmer UI) que reflejen la forma del contenido esperado (cards, lista, mapa) |
| UX-ES3 | Sin estado de "primera carga" diferenciado de "recarga" | Bajo | P3 | Mostrar indicador distinto entre carga inicial vs. actualización silenciosa |
| UX-ES4 | OfflineBanner existe pero no hay fallback visual para funcionalidades completas sin conexión | Medio | P2 | Implementar una "pantalla offline" con funcionalidades reducidas (ver reportes cacheados) en vez de solo un banner |
| UX-ES5 | Error toast genérico sin indicación de qué falló ni cómo recuperarse | Medio | P2 | Mensajes de error específicos: "No pudimos cargar los reportes. Revisa tu conexión e intenta de nuevo" con botón de reintentar |

---

## 4. Flujo de Reportes

| # | Hallazgo | Impacto | Prioridad | Recomendación |
|---|---|---|---|---|
| UX-RP1 | Formulario de reporte largo sin indicador de progreso | Medio | P2 | Agregar steps o secciones colapsables (ubicación → categoría → descripción → foto) |
| UX-RP2 | Subida de fotos sin preview clara ni feedback de progreso | Medio | P1 | ✅ **Corregido** (subida a Cloudinary con `useUpload`) — verificar que incluya barra de progreso |
| UX-RP3 | Sin confirmación visual post-reporte exitoso | Alto | P1 | Pantalla de éxito con: "Reporte enviado ✓", tiempo estimado de revisión, opción de compartir |
| UX-RP4 | Categorías de reporte sin íconos que las identifiquen rápido | Bajo | P3 | Asignar íconos (`lucide-react`) a cada categoría para facilitar el escaneo visual |
| UX-RP5 | Sin feedback háptico ni sonoro al confirmar un reporte en mobile | Bajo | P3 | Vibración nativa (`navigator.vibrate`) en dispositivos compatibles |

---

## 5. Mapas y Geolocalización

| # | Hallazgo | Impacto | Prioridad | Recomendación |
|---|---|---|---|---|
| UX-MAP1 | Mapa sin controles de zoom visibles en mobile | Medio | P2 | Añadir controles nativos de zoom + botón "Mi ubicación" |
| UX-MAP2 | Sin indicación clara de si el GPS está activo o denegado | Medio | P1 | Indicador de estado de geolocalización: "Ubicación activa ✓" / "Activa GPS para mejor experiencia" |
| UX-MAP3 | Sin smooth transition al centrar en la ubicación del usuario | Bajo | P3 | Animación `flyTo` suave en Leaflet |
| UX-MAP4 | Los reportes en el mapa no tienen popup informativo al tocarlos | Medio | P2 | Popup con: categoría (con ícono), titular, tiempo transcurrido, botón "Ver detalle" |
| UX-MAP5 | Sin vista de heatmap o capa de densidad de incidentes | Medio | P2 | Alternar entre vista normal y mapa de calor (queda como pendiente de producto) |

---

## 6. Alertas y Notificaciones

| # | Hallazgo | Impacto | Prioridad | Recomendación |
|---|---|---|---|---|
| UX-AL1 | Sin indicador visual de alertas activas no leídas en el icono de campana | Alto | P1 | Badge numérico con contador de alertas no leídas |
| UX-AL2 | Alertas de pánico no priorizadas visualmente sobre otros reportes | Medio | P2 | Tarjetas de alerta con borde rojo/anaranjado + ribbon "URGENTE" |
| UX-AL3 | Sin sonidos de alerta por proximidad (arquitectura preparada, sin implementar) | Medio | P3 | Depende de funcionalidad de producto; la arquitectura está lista |
| UX-AL4 | Toast de nueva alerta sin vibración ni persistencia en mobile | Bajo | P3 | Usar notificaciones push reales en producción |

---

## 7. Autenticación y Perfil

| # | Hallazgo | Impacto | Prioridad | Recomendación |
|---|---|---|---|---|
| UX-AU1 | Registro/login sin validación en tiempo real del DNI | Medio | P2 | Validar formato (8 dígitos) y unicidad antes de enviar el formulario |
| UX-AU2 | Sin pantalla de "recuperación de contraseña" visible | Medio | P2 | Flujo completo: "Olvidé mi contraseña" → email → reset |
| UX-AU3 | Sin feedback visual en el toggle de tema oscuro/claro | Bajo | P3 | Animación suave de transición + icono que cambia (sol/luna) |
| UX-AU4 | Perfil de usuario sin historial de reportes propio | Medio | P2 | Pestañas en perfil: "Mis reportes", "Mis validaciones", "Configuración" |
| UX-AU5 | Sin confirmación visual al cerrar sesión | Bajo | P3 | Diálogo de confirmación: "¿Cerrar sesión?" con opciones |

---

## 8. Administración (Admin Panel)

| # | Hallazgo | Impacto | Prioridad | Recomendación |
|---|---|---|---|---|
| UX-AD1 | Diálogos `confirm()` nativos en SuperAdminTab para revocar licencias | Medio | P1 | ✅ **Corregido** — ahora usa modal de la app con estilo coherente |
| UX-AD2 | Tablas de admin sin scroll horizontal en mobile (contenido se comprime) | Medio | P2 | Convertir filas de tabla a cards responsivas en viewport pequeño |
| UX-AD3 | Sin filtros visibles en listados de admin (usuarios, reportes) | Medio | P2 | Añadir barra de filtros colapsable: por distrito, estado, fecha |
| UX-AD4 | Estados de reporte (pendiente/resuelto/rechazado) sin color distintivo | Bajo | P3 | Badge con color semántico: azul (pendiente), verde (resuelto), rojo (rechazado) |
| UX-AD5 | Sin batch actions (seleccionar múltiples y accionar) | Bajo | P3 | Checkboxes + acción masiva (resolver, eliminar, reasignar) |

---

## 9. Accesibilidad (WCAG)

| # | Criterio | Hallazgo | Estado |
|---|---|---|---|
| UX-AC1 | **1.4.4 Resize Text (AA)** | `maximum-scale=1` impedía ampliar la interfaz | ✅ **Corregido** |
| UX-AC2 | **4.1.2 Name, Role, Value** | Botones solo-ícono sin nombre accesible | ✅ **Corregido** — `aria-label` en botones, `aria-hidden` en íconos decorativos |
| UX-AC3 | **2.4.8 / Lectores** | Sin indicación de página actual en navegación | ✅ **Corregido** — `aria-current="page"` |
| UX-AC4 | **2.4.1 Bypass Blocks** | Sin enlace "Saltar al contenido" | ✅ **Corregido** |
| UX-AC5 | **1.4.3 Contrast (AA)** | Micro-labels `text-[9px]`/`text-[10px]` con contraste dudoso sobre fondos oscuros | ⏳ **Pendiente** — auditar con axe DevTools/Lighthouse |
| UX-AC6 | **2.5.3 Label in Name** | Botón de menú mobile con ícono y texto visible | ✅ Aplica correctamente |
| UX-AC7 | **2.4.7 Focus Visible** | Indicador de foco por defecto del navegador reemplazado por estilos personalizados | ⏳ **Pendiente** — verificar que `:focus-visible` tenga contraste suficiente |

---

## 10. Consistencia Visual (UI System)

| # | Hallazgo | Impacto | Prioridad |
|---|---|---|---|
| UX-UI1 | Design system coherente: tokens HSL, tipografía (Space Grotesk / Inter / JetBrains Mono) | ✅ Fortaleza | — |
| UX-UI2 | Sombras/bordes/espaciados consistentes vía Tailwind v4 + primitivas Radix | ✅ Fortaleza | — |
| UX-UI3 | Tema oscuro como default con toggle funcional | ✅ Correcto | — |
| UX-UI4 | Touch targets `min-h-[44px]` en nav e ítems interactivos | ✅ Cumple guías Apple/Google | — |
| UX-UI5 | `env(safe-area-inset-*)` aplicado en bottom-nav, drawer y botón de pánico | ✅ Respeta notch iOS | — |
| UX-UI6 | Algunas páginas tienen estilos improvisados que no siguen los tokens del system | ⏳ Pendiente de auditoría visual completa | P3 |

---

## 11. Mobile UX

| # | Hallazgo | Impacto | Prioridad |
|---|---|---|---|
| UX-MO1 | Navegación bottom-nav + FAB elevado funcional y con safe-area | ✅ Correcto | — |
| UX-MO2 | Responsive general aceptable, pero algunas cards se comprimen en viewports <360px | Bajo | P3 |
| UX-MO3 | Tablas de admin sin scroll horizontal en móvil | Medio | P2 |
| UX-MO4 | Sin gestos táctiles (swipe para cerrar drawer, pull-to-refresh en listados) | Bajo | P3 |
| UX-MO5 | Sin PWA install prompt personalizado (solo el nativo del navegador) | Bajo | P3 |

---

## 12. Flujo Crítico: "Reportar un Incidente" (Evaluación Completa)

1. **Usuario toca FAB "+"** → Drawer de navegación se abre (si está en mobile)
2. **Usuario navega a "Reportar"** → formulario con categorías, ubicación, descripción, foto
3. **Selecciona categoría** → dropdown o grid de categorías con íconos
4. **Selecciona ubicación** → mapa con pin arrastrable o GPS automático
5. **Agrega descripción** → textarea con límite de caracteres visible
6. **Sube foto** → preview + botón de eliminar + progreso de subida
7. **Envía** → validación en cliente → loading → confirmación

**Problemas detectados en este flujo:**
- Sin indicador de progreso (paso 3/7)
- Sin autoguardado en localStorage si el usuario cierra el navegador
- Sin opción de reportar anónimamente (para categorías sensibles)
- Sin confirmación visual con número de ticket/ID del reporte

---

## 13. Pendientes para Producción (Priorizados)

| Prioridad | Ítem | Esfuerzo |
|---|---|---|
| **P1** | ✅ Empty states en todas las pantallas sin datos | Medio |
| **P1** | ⚠️ Feedback claro post-reporte (pantalla de éxito con ID) | Bajo |
| **P1** | ✅ Badge de alertas no leídas en campana | Bajo |
| **P1** | ✅ Confirmación visual en acciones destructivas (modal propio, no `confirm()`) | Bajo |
| **P2** | Pantalla offline funcional (no solo banner) | Alto |
| **P2** | Skeletons loader en vez de spinners genéricos | Medio |
| **P2** | Filtros en admin panel | Medio |
| **P2** | Perfil con historial de reportes propio | Medio |
| **P2** | Validación DNI en tiempo real | Medio |
| **P2** | Popup informativo en markers del mapa | Medio |
| **P3** | Animaciones suaves en transiciones de mapa | Bajo |
| **P3** | Gestos táctiles (swipe, pull-to-refresh) | Medio |
| **P3** | Autoguardado de reportes en borrador (localStorage) | Medio |
| **P3** | Reporte anónimo para categorías sensibles | Alto |
| **P3** | Install prompt PWA personalizado | Bajo |

---

## 14. Recomendaciones Finales

### Crítico antes de producción
1. Asegurar que **toda pantalla vacía** tenga un empty state con mensaje y CTA
2. Verificar **contraste de micro-labels** con Lighthouse/axe
3. Probar el **flujo completo de reporte** en dispositivo real (Android + iOS)
4. Confirmar que **todos los `console.*` están fuera del bundle de producción**

### Mejora continua
1. Establecer **Lighthouse CI** como gate en cada PR (objetivo: Performance ≥80, Accessibility ≥90, Best Practices ≥90, SEO ≥90)
2. Realizar **pruebas de usabilidad** con 3-5 usuarios no técnicos del distrito piloto
3. Implementar **análisis de eventos** (PostHog o similar) para detectar abandono en flujos clave

---

*Este documento complementa a `AUDITORIA_PRODUCCION.md`, enfocándose exclusivamente en la experiencia de usuario y preparación para producción desde la perspectiva UX.*
