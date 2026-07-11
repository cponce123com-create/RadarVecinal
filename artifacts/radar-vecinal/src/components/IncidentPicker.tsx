import { useMemo, useRef, useState } from "react";
import { Search, X, ChevronRight, Sparkles } from "lucide-react";
import { ReportCategory, ReportUrgency } from "@workspace/api-client-react";
import { CATEGORY_CONFIG, CAT_HEX } from "@/lib/constants";
import { FREQUENT_QUICK, searchCatalog } from "@/lib/reportCatalog";

export interface IncidentPick {
  category: ReportCategory;
  label: string;
  urgency: ReportUrgency;
}

interface Props {
  category: string;
  title: string;
  onPick: (pick: IncidentPick) => void;
  onClear: () => void;
}

/**
 * Buscador inteligente de "¿Qué está pasando?": el vecino escribe (p. ej.
 * "robo") y elige un subtipo concreto, o toca un acceso frecuente. Reemplaza la
 * antigua parrilla de ~19 botones por una sola entrada intuitiva.
 */
export default function IncidentPicker({ category, title, onPick, onClear }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchCatalog(query, 8), [query]);
  const q = query.trim();
  const showFreeform =
    q.length >= 3 && !results.some((r) => r.label.toLowerCase() === q.toLowerCase());

  // ── Estado seleccionado ──
  if (category) {
    const cfg = (CATEGORY_CONFIG as any)[category];
    const Icon = cfg?.icon;
    const hex = CAT_HEX[category] ?? "#6b7280";
    return (
      <div
        className="flex items-center gap-3 p-3.5 rounded-xl border"
        style={{ background: `${hex}14`, borderColor: `${hex}55` }}
      >
        {Icon && (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${hex}22` }}
          >
            <Icon className="w-5 h-5" style={{ color: hex }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{title || cfg?.label}</p>
          <p className="text-[11px] text-muted-foreground truncate">{cfg?.label ?? category}</p>
        </div>
        <button
          type="button"
          onClick={() => { onClear(); setQuery(""); setTimeout(() => inputRef.current?.focus(), 0); }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/8 text-[11px] font-medium text-white/80 hover:bg-white/12"
        >
          <X className="w-3.5 h-3.5" /> Cambiar
        </button>
      </div>
    );
  }

  const pickFreeform = () =>
    onPick({ category: ReportCategory.other, label: q, urgency: ReportUrgency.medium });

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (results[0]) onPick({ category: results[0].category, label: results[0].label, urgency: results[0].urgency });
              else if (showFreeform) pickFreeform();
            }
          }}
          placeholder="Escribe: robo, agua, basura, ruido…"
          className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Resultados */}
      {q.length >= 2 && (
        <div className="mt-2 rounded-xl border border-white/8 bg-background/60 overflow-hidden divide-y divide-white/5">
          {results.map((r) => {
            const cfg = (CATEGORY_CONFIG as any)[r.category];
            const Icon = cfg?.icon;
            const hex = CAT_HEX[r.category] ?? "#6b7280";
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => onPick({ category: r.category, label: r.label, urgency: r.urgency })}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-white/5 transition-colors"
              >
                {Icon && (
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${hex}20` }}>
                    <Icon className="w-4 h-4" style={{ color: hex }} />
                  </span>
                )}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-white truncate">{r.label}</span>
                  <span className="block text-[10px] text-muted-foreground truncate">{cfg?.label}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
              </button>
            );
          })}
          {showFreeform && (
            <button
              type="button"
              onClick={pickFreeform}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-white/5 transition-colors"
            >
              <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/6">
                <Sparkles className="w-4 h-4 text-muted-foreground" />
              </span>
              <span className="flex-1 min-w-0 text-sm text-white truncate">
                Reportar “<span className="font-semibold">{q}</span>” (otro)
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
            </button>
          )}
          {results.length === 0 && !showFreeform && (
            <p className="px-3.5 py-3 text-xs text-muted-foreground">Sigue escribiendo…</p>
          )}
        </div>
      )}

      {/* Accesos frecuentes */}
      {q.length < 2 && (
        <div className="mt-3">
          <p className="text-[11px] text-muted-foreground mb-2">Más frecuentes</p>
          <div className="grid grid-cols-2 gap-2">
            {FREQUENT_QUICK.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={() => onPick({ category: f.category, label: f.label, urgency: f.urgency })}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/8 text-sm font-medium text-white/85 hover:border-primary/40 hover:bg-white/[0.06] transition-all"
              >
                <span className="text-base">{f.emoji}</span>
                <span className="truncate">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
