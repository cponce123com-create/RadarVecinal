import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Report } from "@workspace/api-client-react";
import { CATEGORY_CONFIG } from "@/lib/constants";

interface MapPlaceholderProps {
  reports?: Report[];
  center?: { lat: number; lng: number };
  zoom?: number;
  interactive?: boolean;
}

export function MapPlaceholder({ reports = [], interactive = false }: MapPlaceholderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Generate random positions if we don't have real coordinates for the visual effect
  const markers = reports.length > 0 ? reports : Array(12).fill(null).map((_, i) => ({
    id: `mock-${i}`,
    category: ['robbery', 'suspicious', 'water_cut', 'noise'][i % 4] as any,
    top: `${Math.random() * 80 + 10}%`,
    left: `${Math.random() * 80 + 10}%`,
  }));

  return (
    <div className="relative w-full h-full bg-[#0a0a0f] overflow-hidden rounded-xl border border-white/5">
      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--primary)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--primary)) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* City blocks abstract lines */}
      <svg className="absolute inset-0 w-full h-full opacity-20 text-white/40" preserveAspectRatio="none">
        <path d="M 10 10 L 100 50 L 150 20 L 300 100 M 50 200 L 120 150 L 200 250 M 250 50 L 350 80 L 400 30" 
              fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" />
      </svg>

      {/* Radar Sweep */}
      <div className="absolute top-1/2 left-1/2 w-[200%] h-[200%] -translate-x-1/2 -translate-y-1/2 radar-sweep pointer-events-none" />

      {/* Center Reticle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border-2 border-primary rounded-full opacity-50 flex items-center justify-center pointer-events-none">
        <div className="w-1 h-1 bg-primary rounded-full" />
      </div>

      {/* Markers */}
      {markers.map((marker: any) => {
        const config = CATEGORY_CONFIG[marker.category as keyof typeof CATEGORY_CONFIG];
        if (!config) return null;
        
        return (
          <motion.div
            key={marker.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: Math.random() * 1 }}
            className={`absolute w-3 h-3 rounded-full marker-pulse cursor-pointer transition-transform hover:scale-150 z-10`}
            style={{
              top: marker.top || `${50 + (marker.latitude + 12.07) * 500}%`, // Rough mapping for Lima mock coords
              left: marker.left || `${50 + (marker.longitude + 77.09) * 500}%`,
              backgroundColor: `hsl(var(--${config.color.split('-')[1]}))` || 'hsl(var(--primary))',
              color: `hsl(var(--${config.color.split('-')[1]}))` || 'hsl(var(--primary))'
            }}
          />
        );
      })}

      {/* Vignette Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#0a0a0f_100%)] pointer-events-none" />

      {!interactive && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[2px] opacity-0 hover:opacity-100 transition-opacity duration-300">
          <span className="px-4 py-2 rounded-full bg-primary/20 text-primary border border-primary/30 font-medium text-sm">
            Ver Mapa Interactivo
          </span>
        </div>
      )}
      
      {/* Mapbox notice */}
      <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/50 tracking-wider">
        RADAR_SYS_v2.0
      </div>
    </div>
  );
}
