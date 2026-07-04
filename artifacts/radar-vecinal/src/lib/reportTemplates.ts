/**
 * reportTemplates.ts — Plantillas de problemas frecuentes del distrito.
 *
 * Cada plantilla prellena categoría, título, descripción y urgencia en el
 * formulario de reporte. El vecino solo ajusta los detalles y envía.
 * Las descripciones incluyen [corchetes] señalando qué debe completar.
 */
import { ReportCategory, ReportUrgency } from "@workspace/api-client-react";

export interface ReportTemplate {
  id: string;
  emoji: string;
  label: string;
  category: ReportCategory;
  urgency: ReportUrgency;
  title: string;
  description: string;
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "bar_clandestino",
    emoji: "🍺",
    label: "Bar clandestino",
    category: ReportCategory.bar_trouble,
    urgency: ReportUrgency.high,
    title: "Bar clandestino operando sin licencia",
    description: "Funciona un bar clandestino en [dirección/referencia]. Opera principalmente en el horario de [horario] y los días [días]. Genera ruido, desorden y consumo de alcohol en la vía pública. Se solicita fiscalización municipal.",
  },
  {
    id: "prostibulo",
    emoji: "🏠",
    label: "Prostíbulo",
    category: ReportCategory.prostitution,
    urgency: ReportUrgency.high,
    title: "Prostíbulo clandestino en la zona",
    description: "Se ha identificado un local que funcionaría como prostíbulo clandestino en [dirección/referencia]. Hay movimiento constante de personas en el horario de [horario]. Los vecinos solicitan intervención de fiscalización y serenazgo.",
  },
  {
    id: "venta_drogas",
    emoji: "💊",
    label: "Venta de drogas",
    category: ReportCategory.drug_point,
    urgency: ReportUrgency.critical,
    title: "Punto de venta de drogas",
    description: "Se observa venta de drogas en [calle/referencia], principalmente en el horario de [horario]. Se ve a personas merodeando y realizando intercambios rápidos. Los vecinos solicitan intervención policial y patrullaje constante.",
  },
  {
    id: "corte_agua",
    emoji: "💧",
    label: "Corte de agua",
    category: ReportCategory.water_cut,
    urgency: ReportUrgency.medium,
    title: "Corte de agua en el sector",
    description: "No hay servicio de agua potable desde [hora/fecha]. Afecta a [número aproximado] de viviendas de la zona.",
  },
  {
    id: "basura_acumulada",
    emoji: "🗑️",
    label: "Basura acumulada",
    category: ReportCategory.garbage,
    urgency: ReportUrgency.low,
    title: "Acumulación de basura sin recojo",
    description: "Hay basura acumulada desde hace [días]. El camión recolector no pasa por [calle/jirón]. Genera malos olores y presencia de animales.",
  },
  {
    id: "alumbrado",
    emoji: "💡",
    label: "Poste sin luz",
    category: ReportCategory.other,
    urgency: ReportUrgency.medium,
    title: "Alumbrado público sin funcionar",
    description: "El poste de alumbrado ubicado en [referencia] no enciende desde hace [días]. La zona queda oscura y peligrosa por las noches.",
  },
  {
    id: "ruido_bar",
    emoji: "🍺",
    label: "Bar con ruido",
    category: ReportCategory.bar_trouble,
    urgency: ReportUrgency.medium,
    title: "Bar con ruidos molestos y desorden",
    description: "El local ubicado en [dirección/referencia] genera ruidos molestos y desorden hasta altas horas. Ocurre principalmente los días [días de la semana].",
  },
  {
    id: "ruidos_molestos",
    emoji: "🔊",
    label: "Ruidos molestos",
    category: ReportCategory.noise,
    urgency: ReportUrgency.low,
    title: "Ruidos molestos en la zona",
    description: "Se escuchan ruidos molestos (música alta / maquinaria / otros) provenientes de [referencia], principalmente en el horario de [horario].",
  },
  {
    id: "sospechosos",
    emoji: "👁️",
    label: "Personas sospechosas",
    category: ReportCategory.suspicious,
    urgency: ReportUrgency.high,
    title: "Personas en actitud sospechosa",
    description: "Se observa a [número] persona(s) en actitud sospechosa cerca de [referencia]. Visten [descripción breve]. Merodean la zona desde [hora].",
  },
  {
    id: "robo_zona",
    emoji: "🔪",
    label: "Robos en la zona",
    category: ReportCategory.robbery,
    urgency: ReportUrgency.high,
    title: "Robos frecuentes en el sector",
    description: "Se han registrado robos/asaltos en [calle/referencia], principalmente en el horario de [horario]. Los vecinos solicitan patrullaje de serenazgo.",
  },
  {
    id: "comercio_informal",
    emoji: "🛒",
    label: "Comercio informal",
    category: ReportCategory.informal_commerce,
    urgency: ReportUrgency.low,
    title: "Comercio informal ocupando la vía",
    description: "Vendedores informales ocupan la vereda/pista en [referencia], dificultando el paso peatonal y vehicular. Presentes principalmente en [horario].",
  },
  {
    id: "pista_daniada",
    emoji: "🕳️",
    label: "Pista dañada",
    category: ReportCategory.other,
    urgency: ReportUrgency.low,
    title: "Pista o vereda en mal estado",
    description: "Existe un [bache/hueco/vereda rota] en [calle/referencia] que representa peligro para vehículos y peatones desde hace [tiempo].",
  },
  {
    id: "perros_callejeros",
    emoji: "🐕",
    label: "Perros callejeros",
    category: ReportCategory.other,
    urgency: ReportUrgency.low,
    title: "Perros callejeros agresivos",
    description: "Hay una jauría de aproximadamente [número] perros callejeros en [referencia]. Algunos muestran comportamiento agresivo con los transeúntes.",
  },
];
