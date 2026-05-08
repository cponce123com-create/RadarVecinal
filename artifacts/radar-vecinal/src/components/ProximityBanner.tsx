import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, MapPin, X } from 'lucide-react';
import { Link } from 'wouter';

interface NearbyAlert {
  id: string;
  title: string;
  category: string;
  distance: number;
  latitude: number;
  longitude: number;
  address?: string;
  sector?: string;
}

interface ProximityBannerProps {
  nearbyAlerts: NearbyAlert[];
  onDismiss?: (id: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  robbery: 'Robo/Asalto',
  fight: 'Pelea',
  suspicious: 'Sospechoso',
  fire: 'Incendio',
  medical_emergency: 'Emergencia Médica',
  missing_person: 'Persona Extraviada',
  water_cut: 'Corte de Agua',
  garbage: 'Basura',
  noise: 'Ruidos',
  other: 'Incidente',
  prostitution: 'Prostíbulo',
  drug_point: 'Drogas',
  bar_trouble: 'Bar Problemático',
  informal_commerce: 'Comercio Ilícito',
};

const CATEGORY_COLORS: Record<string, string> = {
  robbery: '#ef4444',
  fight: '#f97316',
  fire: '#ef4444',
  medical_emergency: '#ef4444',
  missing_person: '#f59e0b',
  suspicious: '#eab308',
  water_cut: '#3b82f6',
  garbage: '#6b7280',
  noise: '#f59e0b',
  other: '#6b7280',
};

export default function ProximityBanner({ nearbyAlerts, onDismiss }: ProximityBannerProps) {
  if (nearbyAlerts.length === 0) return null;

  const topAlert = nearbyAlerts[0];
  const color = CATEGORY_COLORS[topAlert.category] ?? '#ef4444';
  const label = CATEGORY_LABELS[topAlert.category] ?? topAlert.category;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <div
          className="relative flex items-start gap-3 px-4 py-3 rounded-xl border overflow-hidden"
          style={{
            background: `${color}12`,
            borderColor: `${color}40`,
          }}
        >
          {/* Blinking dot */}
          <div className="mt-1 flex-shrink-0">
            <span
              className="block w-3 h-3 rounded-full animate-ping opacity-75"
              style={{ background: color }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color }}>
              ⚠️ Alerta de {label}
            </p>
            <p className="text-sm text-white font-semibold mt-0.5 truncate">
              {topAlert.title}
            </p>
            <p className="text-xs text-white/60 mt-0.5">
              {topAlert.sector || topAlert.address || ''}
              {topAlert.distance > 0 && (
                <span className="font-mono ml-1" style={{ color }}>
                  · {topAlert.distance < 1000 ? `${topAlert.distance} m` : `${(topAlert.distance / 1000).toFixed(1)} km`}
                </span>
              )}
            </p>

            <Link href="/mapa">
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold mt-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ background: `${color}22`, color }}
              >
                <MapPin className="w-3 h-3" />
                Ver en mapa
              </span>
            </Link>
          </div>

          {nearbyAlerts.length > 1 && (
            <span
              className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: `${color}22`, color }}
            >
              +{nearbyAlerts.length - 1}
            </span>
          )}

          {onDismiss && (
            <button
              onClick={() => onDismiss(topAlert.id)}
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-white/50" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
