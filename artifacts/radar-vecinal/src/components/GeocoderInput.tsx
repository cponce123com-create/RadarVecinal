import { useState, useRef, useEffect } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";

interface GeoResult {
  lat: number;
  lng: number;
  label: string;
}

interface Props {
  onSelect: (lat: number, lng: number, address: string) => void;
  placeholder?: string;
}

/**
 * GeocoderInput — Escribe una dirección y obtén coordenadas vía Nominatim.
 * Inspirado en SafeRoute (Node-Geocoder).
 */
export default function GeocoderInput({ onSelect, placeholder = "Ej. Av. La Mar 1234, San Ramón" }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const search = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(data.results?.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  const select = (r: GeoResult) => {
    onSelect(r.lat, r.lng, r.label);
    setQuery(r.label.split(",")[0]);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={query}
          onChange={e => search(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 rounded-xl bg-[#0f1219] border border-white/10 shadow-2xl z-50 overflow-hidden">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => select(r)}
              className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
            >
              <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-xs text-white leading-tight">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
