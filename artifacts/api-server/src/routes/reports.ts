import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { reportsTable, panicAlertsTable, missingPersonsTable, usersTable, adSlotsTable } from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

const router: IRouter = Router();

// ── Allowed enum values (B-03: whitelist query params) ─────────────────────
const VALID_CATEGORIES = new Set(["robbery","fight","suspicious","water_cut","garbage","informal_commerce","noise","missing_person","fire","medical_emergency","prostitution","drug_point","bar_trouble","other"]);
const VALID_STATUSES   = new Set(["active","reviewing","resolved","archived"]);
const VALID_URGENCIES  = new Set(["low","medium","high","critical"]);

// ── B-12: categories that must always be anonymous ─────────────────────────
const SENSITIVE_CATEGORIES = new Set(["prostitution","drug_point","bar_trouble","informal_commerce"]);

// ── B-10: Zod schema for creating a report ─────────────────────────────────
const createReportSchema = z.object({
  title:       z.string().min(5, "Título demasiado corto").max(160),
  description: z.string().min(10, "Descripción demasiado corta").max(2000),
  category:    z.string().refine(v => VALID_CATEGORIES.has(v), "Categoría inválida"),
  urgency:     z.string().refine(v => VALID_URGENCIES.has(v),  "Urgencia inválida"),
  isAnonymous: z.boolean().optional().default(false),
  latitude:    z.number().min(-90).max(90),
  longitude:   z.number().min(-180).max(180),
  address:     z.string().max(500).optional().default(""),
  sector:      z.string().min(1, "Sector requerido").max(100),
  district:    z.string().max(100).optional().default("San Ramón"),
  imageUrl:    z.string().url().optional().nullable(),
  authorName:  z.string().min(1).max(100),
  contactPhone:z.string().max(20).optional().nullable(),
});

function formatReport(r: typeof reportsTable.$inferSelect) {
  return {
    id:           String(r.id),
    title:        r.title,
    description:  r.description,
    category:     r.category,
    urgency:      r.urgency,
    status:       r.status,
    isAnonymous:  r.isAnonymous,
    latitude:     r.latitude,
    longitude:    r.longitude,
    address:      r.address,
    sector:       r.sector,
    district:     r.district,
    imageUrl:     r.imageUrl ?? null,
    authorName:   r.authorName,
    contactPhone: r.contactPhone ?? null,
    confirmedCount: r.confirmedCount,
    createdAt:    r.createdAt.toISOString(),
    updatedAt:    r.updatedAt.toISOString(),
  };
}

router.get("/reports", async (req, res) => {
  try {
    // B-03: Validate enum query params against whitelist
    const category = req.query.category as string | undefined;
    const status   = req.query.status   as string | undefined;
    const urgency  = req.query.urgency  as string | undefined;

    if (category && !VALID_CATEGORIES.has(category)) return res.status(400).json({ error: `Categoría inválida: "${category}"` });
    if (status   && !VALID_STATUSES.has(status))     return res.status(400).json({ error: `Estado inválido: "${status}"` });
    if (urgency  && !VALID_URGENCIES.has(urgency))   return res.status(400).json({ error: `Urgencia inválida: "${urgency}"` });

    const limitRaw  = parseInt(req.query.limit  as string);
    const offsetRaw = parseInt(req.query.offset as string);
    const limit  = isNaN(limitRaw)  || limitRaw  <= 0 ? 200 : Math.min(limitRaw, 500);
    const offset = isNaN(offsetRaw) || offsetRaw < 0   ? 0   : offsetRaw;

    const conditions = [];
    if (category) conditions.push(eq(reportsTable.category, category as any));
    if (status)   conditions.push(eq(reportsTable.status,   status   as any));
    if (urgency)  conditions.push(eq(reportsTable.urgency,  urgency  as any));
    if (req.query.sector)   conditions.push(eq(reportsTable.sector,   req.query.sector   as string));
    // B-05: District segmentation — filter by district if provided
    if (req.query.district) conditions.push(eq(reportsTable.district, req.query.district as string));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const reports = await db.select().from(reportsTable).where(where).orderBy(desc(reportsTable.createdAt)).limit(limit).offset(offset);
    const total   = await db.select({ count: sql<number>`count(*)` }).from(reportsTable).where(where);

    res.json({ reports: reports.map(formatReport), total: Number(total[0]?.count ?? 0) });
  } catch (err) {
    req.log.error({ err }, "Failed to get reports");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/reports", async (req, res) => {
  try {
    // B-10: Validate body with Zod — return 400 with descriptive errors
    const parsed = createReportSchema.safeParse(req.body);
    if (!parsed.success) {
      const messages = parsed.error.issues.map(i => i.message).join("; ");
      return res.status(400).json({ error: `Datos inválidos: ${messages}` });
    }
    const data = parsed.data;

    // B-12: Force anonymous for sensitive categories — regardless of client value
    const forcedAnonymous = SENSITIVE_CATEGORIES.has(data.category) ? true : data.isAnonymous;
    const authorName = forcedAnonymous ? "Anónimo" : data.authorName;

    const [report] = await db.insert(reportsTable).values({
      title:        data.title,
      description:  data.description,
      category:     data.category as any,
      urgency:      data.urgency  as any,
      isAnonymous:  forcedAnonymous,
      latitude:     data.latitude,
      longitude:    data.longitude,
      address:      data.address ?? "",
      sector:       data.sector,
      district:     data.district ?? "San Ramón",
      imageUrl:     data.imageUrl ?? null,
      authorName,
      contactPhone: data.contactPhone ?? null,
      confirmedCount: 0,
    }).returning();

    // B-15: Auto-increment reportsCount for the authenticated user
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const { verifyToken } = await import("./auth");
        const payload = verifyToken(authHeader.slice(7));
        if (payload?.id) {
          await db.update(usersTable)
            .set({ reportsCount: sql`${usersTable.reportsCount} + 1` })
            .where(eq(usersTable.id, Number(payload.id)));
        }
      } catch { /* ignore — unauthenticated reports are allowed */ }
    }

    res.status(201).json(formatReport(report));
  } catch (err) {
    req.log.error({ err }, "Failed to create report");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/reports/:id", async (req, res) => {
  try {
    const [report] = await db.select().from(reportsTable).where(eq(reportsTable.id, parseInt(req.params.id)));
    if (!report) return res.status(404).json({ error: "Not found" });
    res.json(formatReport(report));
  } catch (err) {
    req.log.error({ err }, "Failed to get report");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/reports/:id", async (req, res) => {
  try {
    const data = req.body;
    const updates: Partial<typeof reportsTable.$inferInsert> = {};
    if (data.status !== undefined) updates.status = data.status;
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    updates.updatedAt = new Date();

    const [report] = await db.update(reportsTable).set(updates).where(eq(reportsTable.id, parseInt(req.params.id))).returning();
    if (!report) return res.status(404).json({ error: "Not found" });
    res.json(formatReport(report));
  } catch (err) {
    req.log.error({ err }, "Failed to update report");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/reports/:id", async (req, res) => {
  try {
    const [deleted] = await db.delete(reportsTable).where(eq(reportsTable.id, parseInt(req.params.id))).returning();
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ success: true, id: String(deleted.id) });
  } catch (err) {
    req.log.error({ err }, "Failed to delete report");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── B-20: Confirm a report ─────────────────────────────────────────────────
router.post("/reports/:id/confirm", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    const [report] = await db
      .update(reportsTable)
      .set({ confirmedCount: sql`${reportsTable.confirmedCount} + 1`, updatedAt: new Date() })
      .where(eq(reportsTable.id, id))
      .returning();

    if (!report) return res.status(404).json({ error: "Reporte no encontrado" });
    res.json(formatReport(report));
  } catch (err) {
    req.log.error({ err }, "Failed to confirm report");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Auto-seed demo data (50 reportes — 3 meses de vecinos de San Ramón) ────
// B-14: Only allowed in development or with the admin seed header
router.post("/seed", async (req, res) => {
  const isDev = process.env["NODE_ENV"] === "development";
  const seedHeader = req.headers["x-seed-key"];
  const seedKey = process.env["SEED_KEY"];
  const hasKey = seedKey && seedHeader === seedKey;

  if (!isDev && !hasKey) {
    return res.status(403).json({ error: "Acceso denegado. Solo disponible en entorno de desarrollo." });
  }
  try {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(reportsTable);
    if (Number(count) >= 5) {
      return res.json({ seeded: false, message: `Ya hay ${count} reportes. No se necesita seed.` });
    }

    const now = new Date();
    const ts = (daysAgo: number, hrsAgo = 0) =>
      new Date(now.getTime() - daysAgo * 86400000 - hrsAgo * 3600000);
    const j = (v: number, r = 0.0025) => parseFloat((v + (Math.random() * 2 - 1) * r).toFixed(6));
    const LAT = -11.1272, LNG = -75.3548;

    const seedReports = [
      // Últimos 15 días
      { title: "Asalto a mano armada en Jr. Tarma", description: "Dos sujetos en moto asaltaron a señora frente al banco BN. Se llevaron cartera con documentos y celular Samsung.", category: "robbery" as const, urgency: "critical" as const, status: "active" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. Tarma cdra. 3 frente al Banco de la Nación", sector: "San Ramón Centro", authorName: "Carlos Quispe", contactPhone: "987-654-321", confirmedCount: 8, createdAt: ts(0, 1) },
      { title: "Grupo sospechoso merodeando el mercado", description: "Cuatro individuos desconocidos recorren el mercado central, siguen a compradores. Parecen al acecho.", category: "suspicious" as const, urgency: "high" as const, status: "reviewing" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Mercado Central de San Ramón, Jr. Junín", sector: "San Ramón Centro", authorName: "Rosa Huamán Torres", contactPhone: "943-221-100", confirmedCount: 11, createdAt: ts(0, 3) },
      { title: "Prostíbulo clandestino en Jr. Lima", description: "Local sin licencia opera desde las 10pm. Se han visto menores de edad ingresando.", category: "prostitution" as const, urgency: "high" as const, status: "reviewing" as const, isAnonymous: true, latitude: j(LAT), longitude: j(LNG), address: "Jr. Lima cdra. 4, San Ramón", sector: "San Ramón Centro", authorName: "Anónimo", contactPhone: null, confirmedCount: 6, createdAt: ts(1, 2) },
      { title: "Pelea a la salida de cantina en Jr. Grau", description: "Riña entre 6 personas, botellazos y sillazos. Un herido con corte en la cabeza.", category: "fight" as const, urgency: "high" as const, status: "active" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. Grau cdra. 1, San Ramón", sector: "San Ramón Centro", authorName: "Pedro Campos López", contactPhone: "976-334-889", confirmedCount: 14, createdAt: ts(2, 1) },
      { title: "Punto de venta de drogas frente a la Iglesia", description: "Grupo de jóvenes vende sustancias en motos viernes y sábados desde las 8pm.", category: "drug_point" as const, urgency: "high" as const, status: "active" as const, isAnonymous: true, latitude: j(LAT), longitude: j(LNG), address: "Pampa del Carmen, frente a Iglesia Evangélica", sector: "Pampa del Carmen", authorName: "Anónimo", contactPhone: null, confirmedCount: 17, createdAt: ts(3) },
      { title: "Bar sin licencia con música hasta el amanecer", description: "Cantina opera sin permiso, música a todo volumen hasta las 5am. Ebrios en la calle cada fin de semana.", category: "bar_trouble" as const, urgency: "medium" as const, status: "active" as const, isAnonymous: true, latitude: j(LAT), longitude: j(LNG), address: "Av. Circunvalación cdra. 4, Pampa del Carmen", sector: "Pampa del Carmen", authorName: "Anónimo", contactPhone: null, confirmedCount: 9, createdAt: ts(4, 8) },
      { title: "Robo de moto Honda Wave en la noche", description: "Honda Wave color rojo, placa 3847-K, robada frente a mi casa. Cámara del vecino captó dos sujetos a pie.", category: "robbery" as const, urgency: "high" as const, status: "active" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Pampa del Carmen, Calle 7 Mz. D Lt. 3", sector: "Pampa del Carmen", authorName: "Jorge Suárez Rengifo", contactPhone: "989-002-341", confirmedCount: 3, createdAt: ts(5) },
      { title: "Corte de agua sin previo aviso — 3ro día", description: "Llevamos tres días sin agua. EMAPA no responde. Familias con niños y adultos mayores afectadas.", category: "water_cut" as const, urgency: "medium" as const, status: "active" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Av. Circunvalación cdra. 5, entre Jr. Cusco y Jr. Puno", sector: "Pampa del Carmen", authorName: "María Flores Espinoza", contactPhone: "987-123-456", confirmedCount: 22, createdAt: ts(6, 7) },
      { title: "Incendio en vivienda de material noble — San Luis", description: "Incendio por cortocircuito en segundo piso. Bomberos tardaron 18 min. Familia de 4 personas sin hogar.", category: "fire" as const, urgency: "critical" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Sector San Luis, Calle Los Pinos Mz. C Lt. 9", sector: "San Luis", authorName: "Ana Tuesta Valles", contactPhone: "943-558-712", confirmedCount: 25, createdAt: ts(7, 22) },
      { title: "Basura acumulada 4 días sin recojo", description: "El camión de limpieza no pasa desde hace 4 días. Montones de basura atraen ratas y generan mal olor.", category: "garbage" as const, urgency: "low" as const, status: "active" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. Junín, frente al Mercado Central", sector: "San Ramón Centro", authorName: "Cecilia Ríos Mendoza", contactPhone: null, confirmedCount: 15, createdAt: ts(8, 5) },
      { title: "Menor seguido por adulto desconocido", description: "Escolar de primaria fue seguido por hombre adulto desde el colegio. Intentó que subiera a un auto.", category: "suspicious" as const, urgency: "critical" as const, status: "reviewing" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. Ramón Castilla cdra. 6, San Ramón", sector: "San Ramón Centro", authorName: "Rosa Huamán Torres", contactPhone: "943-221-100", confirmedCount: 7, createdAt: ts(9, 14) },
      { title: "Comercio ambulatorio ilegal bloquea vía", description: "Vendedores sin permiso ocupan vereda y calzada en Jr. Tarma, impidiendo el paso peatonal.", category: "informal_commerce" as const, urgency: "low" as const, status: "active" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. Tarma cdra. 1 y 2, San Ramón Centro", sector: "San Ramón Centro", authorName: "Luis Enrique Asto", contactPhone: null, confirmedCount: 8, createdAt: ts(13, 9) },
      // Días 15-44
      { title: "Robo a vivienda en Jr. Bolívar", description: "Ladrones rompieron la luna de la puerta trasera. Robaron televisor, laptop y efectivo entre las 3pm y 6pm.", category: "robbery" as const, urgency: "high" as const, status: "active" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. Bolívar cdra. 3, San Ramón", sector: "San Ramón Centro", authorName: "Luz Mery Palomino", contactPhone: "968-445-231", confirmedCount: 4, createdAt: ts(15, 6) },
      { title: "Persona desaparecida — adulto mayor con demencia", description: "Mi abuelo de 78 años, padece Alzheimer leve. Usa ropa verde y sombrero. Desapareció rumbo al mercado.", category: "missing_person" as const, urgency: "critical" as const, status: "active" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. Ayacucho cdra. 2, San Ramón — rumbo al mercado", sector: "San Ramón Centro", authorName: "Norma Beatriz Paredes", contactPhone: "987-333-000", confirmedCount: 12, createdAt: ts(16, 10) },
      { title: "Asalto en grifo Carretera Central — madrugada", description: "Tres hombres encapuchados asaltaron al cajero del grifo amenazándolo con armas. Huyeron en camioneta oscura.", category: "robbery" as const, urgency: "critical" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Grifo Los Ángeles, Carretera Central PE-22B km 94.5", sector: "San Ramón Centro", authorName: "Carlos Quispe", contactPhone: "987-654-321", confirmedCount: 19, createdAt: ts(17, 3) },
      { title: "Ruidos molestos — fiesta hasta las 5am", description: "Vecino en Jr. Puno organiza fiestas todos los sábados con sistema de sonido potente. Llevamos 3 semanas sin dormir.", category: "noise" as const, urgency: "low" as const, status: "reviewing" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. Puno cdra. 2 Mz. B, San Ramón", sector: "San Ramón Centro", authorName: "Gilberto Torres Cárdenas", contactPhone: null, confirmedCount: 14, createdAt: ts(18, 21) },
      { title: "Peleas entre pandillas en Pampa del Carmen", description: "Dos grupos con palos y piedras. Tres heridos, uno trasladado de emergencia al hospital.", category: "fight" as const, urgency: "critical" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Pampa del Carmen, Calle Principal esquina Calle 3", sector: "Pampa del Carmen", authorName: "Pedro Campos López", contactPhone: "976-334-889", confirmedCount: 21, createdAt: ts(19, 23) },
      { title: "Vehículo sospechoso ronda el colegio", description: "Auto de vidrios polarizados sin placa ronda el colegio en horario de salida. Ofrecen dinero a alumnos.", category: "suspicious" as const, urgency: "critical" as const, status: "reviewing" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Colegio Santa Rosa, Av. Ramón Castilla, San Ramón", sector: "San Ramón Centro", authorName: "Gloria Ccapa Quispe", contactPhone: "956-778-334", confirmedCount: 18, createdAt: ts(20, 15) },
      { title: "Punto de drogas en parque Los Ángeles", description: "Tráfico visible en el parque de noche. Familias con niños no pueden usarlo.", category: "drug_point" as const, urgency: "high" as const, status: "reviewing" as const, isAnonymous: true, latitude: j(LAT), longitude: j(LNG), address: "Parque AA.HH. Los Ángeles, Calle 6", sector: "Los Ángeles", authorName: "Anónimo", contactPhone: null, confirmedCount: 9, createdAt: ts(21) },
      { title: "Emergencia médica — adulto mayor con derrame", description: "Señor de 72 años, probable derrame cerebral. Ambulancia tardó 28 minutos. SAMU sin cobertura adecuada.", category: "medical_emergency" as const, urgency: "critical" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. Arequipa cdra. 3, San Ramón", sector: "San Ramón Centro", authorName: "Heráclito Roca Zevallos", contactPhone: "943-667-120", confirmedCount: 6, createdAt: ts(23, 11) },
      { title: "Intento de robo a transeúnte armado con cuchillo", description: "Joven interceptado por sujeto con cuchillo que exigió su celular. Escapó corriendo. Delincuente huyó al mercado.", category: "robbery" as const, urgency: "high" as const, status: "active" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. Libertad cdra. 2, San Ramón", sector: "San Ramón Centro", authorName: "Erick Mamani Torres", contactPhone: "969-001-445", confirmedCount: 5, createdAt: ts(25, 18) },
      { title: "Incendio de pastizales — margen del río Tarma", description: "Quema fuera de control cerca del río Tarma. Se acercó a viviendas. Posible quema intencional.", category: "fire" as const, urgency: "high" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Margen izquierda del Río Tarma, frente a Jr. Salaverry", sector: "Río Tarma", authorName: "Fernando Chávez Panduro", contactPhone: "987-889-223", confirmedCount: 13, createdAt: ts(27, 14) },
      { title: "Pelea en cantina El Paraíso — botellazo", description: "Riña entre clientes. Herido con corte profundo en el brazo. La discoteca no tiene personal de seguridad.", category: "fight" as const, urgency: "high" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. Progreso cdra. 3, cerca de discoteca El Paraíso", sector: "San Ramón Centro", authorName: "Sandra Paucar Huanca", contactPhone: null, confirmedCount: 8, createdAt: ts(28, 22) },
      { title: "Robo a negocio — vitrina rota de madrugada", description: "Rompieron la vitrina de la librería Escolar. Mercadería robada. Cámaras municipales no graban de noche.", category: "robbery" as const, urgency: "high" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Av. Juan Santos Atahualpa cdra. 2, San Ramón Centro", sector: "San Ramón Centro", authorName: "Dora Quispe Ccahuana", contactPhone: "987-334-556", confirmedCount: 11, createdAt: ts(30, 4) },
      { title: "Prostitución callejera en Jr. Salaverry", description: "Mujeres ejercen la prostitución en la vía pública desde las 9pm. Escenas inapropiadas frente a menores.", category: "prostitution" as const, urgency: "medium" as const, status: "reviewing" as const, isAnonymous: true, latitude: j(LAT), longitude: j(LNG), address: "Jr. Salaverry cdra. 1 y 2, San Ramón Centro", sector: "San Ramón Centro", authorName: "Anónimo", contactPhone: null, confirmedCount: 7, createdAt: ts(32) },
      { title: "Robo de cable eléctrico — 2 cuadras sin luz", description: "Cortaron y robaron cable eléctrico de dos cuadras del Jr. Loreto. Familias 2 días sin electricidad.", category: "robbery" as const, urgency: "medium" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. Loreto cdra. 1 y 2, San Ramón", sector: "San Ramón Centro", authorName: "Wilder Gutiérrez Soto", contactPhone: "943-112-887", confirmedCount: 9, createdAt: ts(35, 18) },
      { title: "Ruidos molestos — taller mecánico sin horario", description: "Taller trabaja hasta las 11pm y desde las 6am incluyendo domingos. No tienen licencia de funcionamiento.", category: "noise" as const, urgency: "low" as const, status: "active" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. Cusco cdra. 3, San Ramón Centro", sector: "San Ramón Centro", authorName: "Isabel Meléndez Ruiz", contactPhone: null, confirmedCount: 10, createdAt: ts(38, 8) },
      { title: "Sospechosos intentaron abrir puerta de vivienda", description: "Dos sujetos intentaron forzar la puerta de mi casa a las 2am. Calle sin alumbrado público. Cuarta vez.", category: "suspicious" as const, urgency: "high" as const, status: "reviewing" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. San Martín cdra. 4, San Ramón", sector: "San Ramón Centro", authorName: "Nelly Apaza Mamani", contactPhone: "987-009-123", confirmedCount: 6, createdAt: ts(40, 2) },
      { title: "Emergencia — niño con quemaduras graves", description: "Niño de 6 años volcó olla con agua hirviendo. Quemaduras en tórax y brazos. Necesita apoyo económico.", category: "medical_emergency" as const, urgency: "critical" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Los Ángeles, Calle 8 Mz. F Lt. 12", sector: "Los Ángeles", authorName: "Flor de María Ramos", contactPhone: "943-778-901", confirmedCount: 4, createdAt: ts(42, 16) },
      { title: "Bar clandestino en El Milagro — 4 quejas ignoradas", description: "Bar sin permiso hace 5 meses. 4 quejas a la municipalidad sin atender. Peleas todos los fines de semana.", category: "bar_trouble" as const, urgency: "medium" as const, status: "reviewing" as const, isAnonymous: true, latitude: j(LAT), longitude: j(LNG), address: "Jr. El Milagro cdra. 2, esquina con Calle Los Pioneros", sector: "El Milagro", authorName: "Anónimo", contactPhone: null, confirmedCount: 16, createdAt: ts(44, 20) },
      // Días 45-89
      { title: "Robo en local comercial — Av. Juan Santos", description: "Ladrones llevaron mercadería de farmacia valorada en S/ 5,000. Usaron llave falsa copiada días antes.", category: "robbery" as const, urgency: "critical" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Av. Juan Santos Atahualpa cdra. 3, San Ramón", sector: "San Ramón Centro", authorName: "Rosario Capcha Quispe", contactPhone: "987-445-672", confirmedCount: 14, createdAt: ts(46, 3) },
      { title: "Punto de drogas en zona del aeródromo", description: "Vehículo estacionado en berma de la PE-22B vende drogas en moto. Operan entre las 8pm y 1am.", category: "drug_point" as const, urgency: "high" as const, status: "resolved" as const, isAnonymous: true, latitude: j(LAT), longitude: j(LNG), address: "Carretera PE-22B km 93.5, frente a ingreso al aeródromo", sector: "San Ramón Centro", authorName: "Anónimo", contactPhone: null, confirmedCount: 8, createdAt: ts(49) },
      { title: "Pelea callejera en Jr. Callao — heridos", description: "Enfrentamiento entre grupos rivales con objetos contundentes. Dos heridos en el centro de salud.", category: "fight" as const, urgency: "high" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. Callao cdra. 2, San Ramón Centro", sector: "San Ramón Centro", authorName: "Alfredo Huamán Rodríguez", contactPhone: "968-223-001", confirmedCount: 10, createdAt: ts(51, 22) },
      { title: "Prostíbulo en Pampa del Carmen — 3er reporte", description: "Tercer reporte del mismo local. Continúa funcionando. Posible soborno a inspectores municipales.", category: "prostitution" as const, urgency: "high" as const, status: "archived" as const, isAnonymous: true, latitude: j(LAT), longitude: j(LNG), address: "Pampa del Carmen, Calle Principal cdra. 4", sector: "Pampa del Carmen", authorName: "Anónimo", contactPhone: null, confirmedCount: 12, createdAt: ts(54) },
      { title: "Robo a mano armada — tienda de abarrotes", description: "Tres sujetos con pistola vaciaron caja registradora. Llevaron S/ 1,200 y celular del dueño. Huyeron en moto.", category: "robbery" as const, urgency: "critical" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. Progreso cdra. 1, tienda de abarrotes La Merced", sector: "San Ramón Centro", authorName: "Donato Saavedra Quispe", contactPhone: "987-667-332", confirmedCount: 16, createdAt: ts(56, 21) },
      { title: "Basura y desmonte en terreno baldío — San Luis", description: "Personas descargan desmonte de noche. El terreno se convirtió en basurero informal. Riesgo sanitario.", category: "garbage" as const, urgency: "low" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Sector San Luis, Calle Los Cedros, terreno vacío", sector: "San Luis", authorName: "Teresa Cóndor Paucar", contactPhone: null, confirmedCount: 7, createdAt: ts(58, 14) },
      { title: "Actitud sospechosa — encuestadores falsos", description: "Dos sujetos van de casa en casa fingiendo ser encuestadores. Preguntan qué equipos y vehículos hay. Fotografían interiores.", category: "suspicious" as const, urgency: "high" as const, status: "archived" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Los Jardines, Calles 5 y 6, San Ramón", sector: "Los Jardines", authorName: "Bertha Osorio Poma", contactPhone: "943-990-112", confirmedCount: 9, createdAt: ts(60) },
      { title: "Inundación y corte de agua simultáneo", description: "Tubería rota inundó Jr. Ica mientras había corte en toda la zona. EMAPA respondió 4 días después.", category: "water_cut" as const, urgency: "medium" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. Ica cdra. 1, San Ramón Centro", sector: "San Ramón Centro", authorName: "Cinthia López Sánchez", contactPhone: "987-221-009", confirmedCount: 11, createdAt: ts(62, 10) },
      { title: "Robo de cosecha en chacra — sector Miraflores", description: "Ladrones ingresaron de noche y cosecharon cacao maduro valorado en S/ 2,800. Cuarta vez que me roban.", category: "robbery" as const, urgency: "high" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Sector Miraflores, parcela 14, San Ramón", sector: "Miraflores", authorName: "Efraín Aquino Villanueva", contactPhone: "968-554-000", confirmedCount: 5, createdAt: ts(65, 7) },
      { title: "Comercio ilícito en bodega — mercadería sin procedencia", description: "Bodega vende artículos electrónicos sin factura. Se presumen robados. También vende alcohol a menores.", category: "informal_commerce" as const, urgency: "medium" as const, status: "archived" as const, isAnonymous: true, latitude: j(LAT), longitude: j(LNG), address: "Jr. San Martín cdra. 2, San Ramón Centro", sector: "San Ramón Centro", authorName: "Anónimo", contactPhone: null, confirmedCount: 6, createdAt: ts(67) },
      { title: "Ruidos nocturnos — karaoke sin permiso", description: "Karaoke clandestino opera hasta las 3am todos los días. La municipalidad retiró el permiso pero sigue abierto.", category: "noise" as const, urgency: "medium" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. Callao cdra. 3, San Ramón", sector: "San Ramón Centro", authorName: "Maximino Gómez Palomino", contactPhone: null, confirmedCount: 13, createdAt: ts(70, 23) },
      { title: "Pelea en asentamiento humano — arma blanca", description: "Pelea por deuda en AA.HH. Nueva Esperanza. Uno sacó cuchillo. PNP intervino sin detenidos.", category: "fight" as const, urgency: "critical" as const, status: "resolved" as const, isAnonymous: true, latitude: j(LAT), longitude: j(LNG), address: "AA.HH. Nueva Esperanza, Calle 3, San Ramón", sector: "Nueva Esperanza", authorName: "Anónimo", contactPhone: null, confirmedCount: 4, createdAt: ts(72, 19) },
      { title: "Asalto a turistas — sector puente Tarma", description: "Pareja de turistas asaltada en el puente por tres sujetos en moto. Cámaras, mochilas y documentos robados.", category: "robbery" as const, urgency: "critical" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Puente sobre el Río Tarma, salida hacia La Merced", sector: "Río Tarma", authorName: "Roberto Chávez García", contactPhone: "943-667-889", confirmedCount: 20, createdAt: ts(74, 17) },
      { title: "Envenenamiento de perros callejeros", description: "Alguien puso carne envenenada en el parque. Tres perros murieron. Vecinos temen por niños que juegan ahí.", category: "suspicious" as const, urgency: "high" as const, status: "archived" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Parque Los Jardines, Jr. Los Geranios, San Ramón", sector: "Los Jardines", authorName: "Milagros Chumpitaz Ayala", contactPhone: "987-772-334", confirmedCount: 9, createdAt: ts(76, 9) },
      { title: "Extorsión a comerciante del mercado", description: "Dueño de puesto recibe amenazas exigiéndole cupo semanal de S/ 200. Ya pagó tres veces por miedo.", category: "robbery" as const, urgency: "critical" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Mercado Central de San Ramón, puestos del lado norte", sector: "San Ramón Centro", authorName: "Giancarlo Trujillo Ortiz", contactPhone: "968-001-558", confirmedCount: 7, createdAt: ts(79, 11) },
      { title: "Incendio en depósito de madera", description: "Incendio destruyó depósito en sector industrial. Pérdidas de S/ 40,000. Dos compañías de bomberos atendieron.", category: "fire" as const, urgency: "critical" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Zona Industrial de San Ramón, salida a La Merced km 2", sector: "Zona Industrial", authorName: "Renato Arroyo Mendoza", contactPhone: "943-334-112", confirmedCount: 22, createdAt: ts(81, 4) },
      { title: "Accidente de tránsito — mototaxi volcado", description: "Mototaxi volcó por exceso de velocidad y bache no señalizado. Conductor y dos pasajeros heridos.", category: "medical_emergency" as const, urgency: "high" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Av. Circunvalación cdra. 6, frente a grifo", sector: "Pampa del Carmen", authorName: "Paula Espinoza Tello", contactPhone: "987-009-667", confirmedCount: 8, createdAt: ts(84, 16) },
      { title: "Robo de herramientas en obra de construcción", description: "Robaron mezcladora, taladros y andamios. Pérdidas de S/ 8,000. Tres obreros sin trabajo.", category: "robbery" as const, urgency: "medium" as const, status: "resolved" as const, isAnonymous: false, latitude: j(LAT), longitude: j(LNG), address: "Jr. Bolívar cdra. 5, obra en construcción, San Ramón", sector: "San Ramón Centro", authorName: "Nancy Medina Soto", contactPhone: "987-443-221", confirmedCount: 6, createdAt: ts(86, 8) },
      { title: "Punto de tráfico de drogas consolidado — 2 meses", description: "Durante dos meses documentamos venta en esta esquina. Opera con vigilantes que avisan cuando viene la PNP.", category: "drug_point" as const, urgency: "critical" as const, status: "archived" as const, isAnonymous: true, latitude: j(LAT), longitude: j(LNG), address: "Esquina Jr. Junín con Jr. Ayacucho, San Ramón Centro", sector: "San Ramón Centro", authorName: "Anónimo", contactPhone: null, confirmedCount: 23, createdAt: ts(88) },
      { title: "Bar problemático — vecinos hartos de 3 meses de quejas", description: "Bar sin habilitación hace 3 meses. 7 denuncias ante municipalidad y PNP. Peleas cada viernes. Exigimos cierre.", category: "bar_trouble" as const, urgency: "high" as const, status: "archived" as const, isAnonymous: true, latitude: j(LAT), longitude: j(LNG), address: "Jr. Junín cdra. 2, esquina con Jr. Callao, San Ramón Centro", sector: "San Ramón Centro", authorName: "Anónimo", contactPhone: null, confirmedCount: 28, createdAt: ts(89, 18) },
    ];

    await db.insert(usersTable).values([
      { name: "Admin Radar",         email: "admin@radarvecinal.pe",     role: "admin"     as const, sector: "San Ramón Centro", district: "San Ramón", reportsCount: 0  },
      { name: "Rosa Huamán Torres",  email: "rosa.huaman@gmail.com",     role: "moderator" as const, sector: "San Ramón Centro", district: "San Ramón", reportsCount: 8  },
      { name: "Carlos Quispe",       email: "c.quispe@outlook.com",      role: "user"      as const, sector: "Pampa del Carmen", district: "San Ramón", reportsCount: 5  },
      { name: "Ana Tuesta Valles",   email: "ana.tuesta@hotmail.com",    role: "user"      as const, sector: "San Luis",         district: "San Ramón", reportsCount: 12 },
      { name: "Jorge Suárez",        email: "jorge.suarez@gmail.com",    role: "user"      as const, sector: "Los Ángeles",      district: "San Ramón", reportsCount: 7  },
      { name: "María Flores",        email: "mflores@gmail.com",         role: "user"      as const, sector: "San Ramón Centro", district: "San Ramón", reportsCount: 4  },
      { name: "Pedro Campos",        email: "pedrocampos@hotmail.com",   role: "user"      as const, sector: "Pampa del Carmen", district: "San Ramón", reportsCount: 6  },
      { name: "Cecilia Ríos",        email: "crios@gmail.com",           role: "user"      as const, sector: "San Ramón Centro", district: "San Ramón", reportsCount: 3  },
      { name: "Luis Asto",           email: "l.asto@gmail.com",          role: "user"      as const, sector: "El Milagro",       district: "San Ramón", reportsCount: 5  },
      { name: "Delia Solís",         email: "delia.solis@gmail.com",     role: "user"      as const, sector: "Los Ángeles",      district: "San Ramón", reportsCount: 2  },
    ]).onConflictDoNothing();

    await db.insert(reportsTable).values(seedReports.map(r => ({ ...r, updatedAt: r.createdAt })));

    await db.insert(panicAlertsTable).values([
      { type: "robbery" as const, latitude: j(LAT), longitude: j(LNG), address: "Jr. Tarma cdra. 3, San Ramón Centro", authorName: "Carlos Quispe", sector: "San Ramón Centro", isActive: true, createdAt: ts(0, 1) },
      { type: "medical" as const, latitude: j(LAT), longitude: j(LNG), address: "Carretera Central PE-22B, km 94", authorName: "Ana Tuesta Valles", sector: "San Ramón Centro", isActive: false, createdAt: ts(0, 8) },
      { type: "fight" as const, latitude: j(LAT), longitude: j(LNG), address: "Jr. Grau cdra. 1, San Ramón", authorName: "Pedro Campos", sector: "San Ramón Centro", isActive: false, createdAt: ts(0, 5) },
    ]).onConflictDoNothing();

    await db.insert(missingPersonsTable).values([
      { name: "Sebastián Flores", age: 9, clothing: "Uniforme escolar azul con mochila roja, zapatillas blancas Nike", photoUrl: null, lastSeenLatitude: -11.1260, lastSeenLongitude: -75.3546, lastSeenAddress: "Colegio José Carlos Mariátegui, Av. Ramón Castilla, San Ramón", lastSeenAt: ts(0, 4), contactInfo: "Mamá Rosa: 987-654-321 | Papá Juan: 943-112-000", status: "active" as const, reportedBy: "Rosa Huamán Torres", createdAt: ts(0, 4) },
    ]).onConflictDoNothing();

    await db.insert(adSlotsTable).values([
      { businessName: "Ferretería El Constructor", tagline: "Materiales de construcción y acabados — San Ramón", imageUrl: null, targetUrl: "https://example.com", isActive: true, sector: "San Ramón Centro" },
      { businessName: "Botica San Ramón", tagline: "Medicamentos al mejor precio. Delivery en toda Chanchamayo", imageUrl: null, targetUrl: "https://example.com", isActive: true, sector: null },
      { businessName: "Hospedaje Río Tarma", tagline: "Habitaciones cómodas, wifi y desayuno — desde S/ 45", imageUrl: null, targetUrl: "https://example.com", isActive: true, sector: "San Ramón Centro" },
    ]).onConflictDoNothing();

    res.json({ seeded: true, message: `✅ ${seedReports.length} reportes de 50 vecinos insertados correctamente.` });
  } catch (err) {
    req.log.error({ err }, "Seed failed");
    res.status(500).json({ error: "Seed failed", detail: String(err) });
  }
});

export default router;
