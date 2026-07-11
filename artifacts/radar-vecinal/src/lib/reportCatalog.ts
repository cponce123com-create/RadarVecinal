/**
 * reportCatalog — catálogo de tipos de incidente para el buscador inteligente
 * de "¿Qué está pasando?".
 *
 * En vez de una parrilla con decenas de botones, el vecino escribe (p. ej.
 * "robo") y ve subtipos concretos ("Robo a mano armada", "Hurto de celular"…).
 * Cada entrada mapea a una categoría del backend + urgencia sugerida. Esto crea
 * una taxonomía consistente de reportes y facilita la analítica por subtipo.
 */
import { ReportCategory, ReportUrgency } from "@workspace/api-client-react";

export interface CatalogEntry {
  label: string;
  category: ReportCategory;
  urgency: ReportUrgency;
  keywords?: string[];
}

export const REPORT_CATALOG: CatalogEntry[] = [
  // ── Robo / hurto ──
  { label: "Robo a mano armada a transeúnte", category: ReportCategory.robbery, urgency: ReportUrgency.critical, keywords: ["robo", "asalto", "arma", "pistola", "cuchillo", "arrebato", "transeunte"] },
  { label: "Robo a local comercial", category: ReportCategory.robbery, urgency: ReportUrgency.high, keywords: ["robo", "tienda", "negocio", "local", "comercio", "bodega"] },
  { label: "Robo a vivienda / casa", category: ReportCategory.robbery, urgency: ReportUrgency.high, keywords: ["robo", "casa", "vivienda", "domicilio", "departamento"] },
  { label: "Hurto de celular (arrebato)", category: ReportCategory.robbery, urgency: ReportUrgency.high, keywords: ["hurto", "celular", "telefono", "arrebato", "robo"] },
  { label: "Robo de vehículo", category: ReportCategory.robbery, urgency: ReportUrgency.high, keywords: ["robo", "auto", "carro", "moto", "vehiculo"] },
  { label: "Robo de autopartes / accesorios", category: ReportCategory.robbery, urgency: ReportUrgency.medium, keywords: ["robo", "autopartes", "llantas", "espejos", "bateria", "aro"] },

  // ── Actitud sospechosa ──
  { label: "Persona sospechosa merodeando", category: ReportCategory.suspicious, urgency: ReportUrgency.medium, keywords: ["sospechoso", "merodeando", "raro", "vigilando", "marca"] },
  { label: "Vehículo sospechoso", category: ReportCategory.suspicious, urgency: ReportUrgency.medium, keywords: ["sospechoso", "auto", "carro", "vehiculo", "placa"] },
  { label: "Intento de robo", category: ReportCategory.suspicious, urgency: ReportUrgency.high, keywords: ["intento", "robo", "forzar", "chapa"] },

  // ── Violencia ──
  { label: "Pelea callejera", category: ReportCategory.fight, urgency: ReportUrgency.high, keywords: ["pelea", "riña", "bronca", "golpes"] },
  { label: "Agresión física", category: ReportCategory.fight, urgency: ReportUrgency.high, keywords: ["agresion", "golpes", "ataque"] },
  { label: "Violencia familiar", category: ReportCategory.fight, urgency: ReportUrgency.critical, keywords: ["violencia", "familiar", "domestica", "maltrato"] },

  // ── Agua ──
  { label: "Falta de agua", category: ReportCategory.water_cut, urgency: ReportUrgency.medium, keywords: ["agua", "corte", "sin agua", "desabastecimiento"] },
  { label: "Fuga / tubería rota", category: ReportCategory.water_cut, urgency: ReportUrgency.medium, keywords: ["fuga", "tuberia", "agua", "cañeria", "rotura"] },

  // ── Basura ──
  { label: "Basura acumulada", category: ReportCategory.garbage, urgency: ReportUrgency.low, keywords: ["basura", "desechos", "acumulada", "desmonte"] },
  { label: "Punto de basura ilegal", category: ReportCategory.garbage, urgency: ReportUrgency.low, keywords: ["basura", "botadero", "ilegal"] },
  { label: "No pasó el camión de basura", category: ReportCategory.garbage, urgency: ReportUrgency.low, keywords: ["basura", "recojo", "camion", "recoleccion"] },

  // ── Ruido ──
  { label: "Ruidos molestos", category: ReportCategory.noise, urgency: ReportUrgency.low, keywords: ["ruido", "bulla", "musica", "molesto"] },
  { label: "Fiesta ruidosa", category: ReportCategory.noise, urgency: ReportUrgency.medium, keywords: ["fiesta", "ruido", "musica", "bulla"] },

  // ── Luz / alumbrado ──
  { label: "Corte de luz", category: ReportCategory.power_outage, urgency: ReportUrgency.high, keywords: ["luz", "electricidad", "corte", "apagon", "energia"] },
  { label: "Poste sin alumbrado", category: ReportCategory.power_outage, urgency: ReportUrgency.medium, keywords: ["poste", "alumbrado", "luz", "oscuro", "foco"] },
  { label: "Cable eléctrico caído", category: ReportCategory.power_outage, urgency: ReportUrgency.high, keywords: ["cable", "caido", "electrico", "peligro"] },

  // ── Pista / vereda ──
  { label: "Pista dañada / bache", category: ReportCategory.street_damage, urgency: ReportUrgency.low, keywords: ["pista", "bache", "hueco", "asfalto", "via"] },
  { label: "Vereda rota", category: ReportCategory.street_damage, urgency: ReportUrgency.low, keywords: ["vereda", "rota", "peaton"] },
  { label: "Semáforo malogrado", category: ReportCategory.street_damage, urgency: ReportUrgency.medium, keywords: ["semaforo", "malogrado", "transito"] },

  // ── Drogas (sensible) ──
  { label: "Punto de venta de drogas", category: ReportCategory.drug_point, urgency: ReportUrgency.critical, keywords: ["droga", "venta", "microcomercializacion", "paco", "ollita"] },
  { label: "Consumo de drogas en vía pública", category: ReportCategory.drug_point, urgency: ReportUrgency.high, keywords: ["droga", "consumo", "fumar"] },

  // ── Prostitución / bar (sensible) ──
  { label: "Prostíbulo clandestino", category: ReportCategory.prostitution, urgency: ReportUrgency.high, keywords: ["prostibulo", "prostitucion", "trata"] },
  { label: "Bar / cantina clandestina", category: ReportCategory.bar_trouble, urgency: ReportUrgency.high, keywords: ["bar", "cantina", "clandestino", "licor", "trago"] },

  // ── Comercio informal ──
  { label: "Comercio ambulatorio en la vía", category: ReportCategory.informal_commerce, urgency: ReportUrgency.low, keywords: ["ambulante", "comercio", "informal", "vereda"] },

  // ── Extraviados ──
  { label: "Persona desaparecida", category: ReportCategory.missing_person, urgency: ReportUrgency.critical, keywords: ["desaparecido", "extraviado", "perdido", "persona"] },
  { label: "Menor extraviado", category: ReportCategory.missing_person, urgency: ReportUrgency.critical, keywords: ["menor", "niño", "extraviado", "desaparecido"] },
  { label: "Adulto mayor perdido", category: ReportCategory.missing_person, urgency: ReportUrgency.critical, keywords: ["adulto mayor", "anciano", "perdido", "extraviado"] },

  // ── Mascota ──
  { label: "Mascota perdida", category: ReportCategory.lost_pet, urgency: ReportUrgency.medium, keywords: ["mascota", "perro", "gato", "perdida"] },

  // ── Emergencias ──
  { label: "Incendio", category: ReportCategory.fire, urgency: ReportUrgency.critical, keywords: ["incendio", "fuego", "quema"] },
  { label: "Emergencia médica", category: ReportCategory.medical_emergency, urgency: ReportUrgency.critical, keywords: ["medica", "emergencia", "herido", "desmayo", "ambulancia"] },
  { label: "Accidente de tránsito", category: ReportCategory.medical_emergency, urgency: ReportUrgency.high, keywords: ["accidente", "choque", "transito", "atropello"] },

  // ── Animales / clima ──
  { label: "Perros callejeros agresivos", category: ReportCategory.stray_dogs, urgency: ReportUrgency.medium, keywords: ["perros", "callejeros", "jauria", "agresivos"] },
  { label: "Inundación / huaico", category: ReportCategory.flooding, urgency: ReportUrgency.critical, keywords: ["inundacion", "huaico", "desborde", "lluvia"] },
];

/** Accesos rápidos: los 4 problemas más frecuentes (un toque). */
export const FREQUENT_QUICK: { label: string; emoji: string; category: ReportCategory; urgency: ReportUrgency }[] = [
  { label: "Falta de agua", emoji: "💧", category: ReportCategory.water_cut, urgency: ReportUrgency.medium },
  { label: "Basura acumulada", emoji: "🗑️", category: ReportCategory.garbage, urgency: ReportUrgency.low },
  { label: "Corte de luz", emoji: "⚡", category: ReportCategory.power_outage, urgency: ReportUrgency.high },
  { label: "Ruidos molestos", emoji: "🔊", category: ReportCategory.noise, urgency: ReportUrgency.low },
];

/** Normaliza texto para búsqueda: minúsculas y sin acentos. */
export function normalizeText(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Busca en el catálogo por etiqueta + keywords, con puntaje simple. */
export function searchCatalog(query: string, limit = 8): CatalogEntry[] {
  const q = normalizeText(query.trim());
  if (q.length < 2) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const scored = REPORT_CATALOG.map((e) => {
    const label = normalizeText(e.label);
    const hay = normalizeText(e.label + " " + (e.keywords ?? []).join(" "));
    let score = 0;
    for (const t of terms) {
      if (label.startsWith(t)) score += 4;
      else if (label.includes(t)) score += 2;
      else if (hay.includes(t)) score += 1;
    }
    return { e, score };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);
}
