import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { reportsTable, panicAlertsTable, missingPersonsTable, usersTable, adSlotsTable } from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

const router: IRouter = Router();

function formatReport(r: typeof reportsTable.$inferSelect) {
  return {
    id: String(r.id),
    title: r.title,
    description: r.description,
    category: r.category,
    urgency: r.urgency,
    status: r.status,
    isAnonymous: r.isAnonymous,
    latitude: r.latitude,
    longitude: r.longitude,
    address: r.address,
    sector: r.sector,
    imageUrl: r.imageUrl ?? null,
    authorName: r.authorName,
    contactPhone: r.contactPhone ?? null,
    confirmedCount: r.confirmedCount,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/reports", async (req, res) => {
  try {
    const conditions = [];
    if (req.query.category) conditions.push(eq(reportsTable.category, req.query.category as string));
    if (req.query.status) conditions.push(eq(reportsTable.status, req.query.status as string));
    if (req.query.urgency) conditions.push(eq(reportsTable.urgency, req.query.urgency as string));
    if (req.query.sector) conditions.push(eq(reportsTable.sector, req.query.sector as string));

    const limit = parseInt(req.query.limit as string) || 200;
    const offset = parseInt(req.query.offset as string) || 0;

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const reports = await db.select().from(reportsTable).where(where).orderBy(desc(reportsTable.createdAt)).limit(limit).offset(offset);
    const total = await db.select({ count: sql<number>`count(*)` }).from(reportsTable).where(where);

    res.json({ reports: reports.map(formatReport), total: Number(total[0]?.count ?? 0) });
  } catch (err) {
    req.log.error({ err }, "Failed to get reports");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/reports", async (req, res) => {
  try {
    const data = req.body;
    const [report] = await db.insert(reportsTable).values({
      title: data.title,
      description: data.description,
      category: data.category,
      urgency: data.urgency,
      isAnonymous: data.isAnonymous ?? false,
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address ?? "",
      sector: data.sector,
      imageUrl: data.imageUrl ?? null,
      authorName: data.authorName,
      contactPhone: data.contactPhone ?? null,
      confirmedCount: 0,
    }).returning();
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

// ── Auto-seed demo data (runs if DB has fewer than 10 reports) ────────────
router.post("/seed", async (req, res) => {
  try {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(reportsTable);
    if (Number(count) >= 10) {
      return res.json({ seeded: false, message: `Ya hay ${count} reportes. No se necesita seed.` });
    }

    const now = new Date();
    const ts = (daysAgo: number, hrsAgo = 0) =>
      new Date(now.getTime() - daysAgo * 86400000 - hrsAgo * 3600000);
    const j = (v: number, r = 0.0018) => parseFloat((v + (Math.random() - 0.5) * r).toFixed(6));

    const seedReports = [
      { title: "Asalto a mano armada en Jr. Tarma", description: "Dos sujetos en moto asaltaron a una señora frente al banco. Cartera y celular sustraídos.", category: "robbery" as const, urgency: "critical" as const, status: "active" as const, isAnonymous: false, latitude: j(-11.1272), longitude: j(-75.3548), address: "Jr. Tarma cdra. 3, San Ramón Centro", sector: "San Ramón Centro", authorName: "Carlos Quispe", contactPhone: "987-654-321", confirmedCount: 8, createdAt: ts(0, 1) },
      { title: "Prostíbulo clandestino en Jr. Lima", description: "Local funcionando sin licencia con menores de edad. Actividad nocturna constante desde hace 3 meses.", category: "prostitution" as const, urgency: "high" as const, status: "reviewing" as const, isAnonymous: true, latitude: j(-11.1285), longitude: j(-75.3545), address: "Jr. Lima cdra. 4, San Ramón", sector: "San Ramón Centro", authorName: "Anónimo", contactPhone: null, confirmedCount: 6, createdAt: ts(0, 3) },
      { title: "Punto de venta de drogas en Pampa del Carmen", description: "Grupo de jóvenes distribuye sustancias frente a la iglesia los fines de semana.", category: "drug_point" as const, urgency: "high" as const, status: "active" as const, isAnonymous: true, latitude: j(-11.1318), longitude: j(-75.3568), address: "Pampa del Carmen, frente a Iglesia", sector: "Pampa del Carmen", authorName: "Anónimo", contactPhone: null, confirmedCount: 14, createdAt: ts(1) },
      { title: "Bar sin licencia en Av. Circunvalación", description: "Expendio de alcohol hasta las 4am con peleas frecuentes. Vecinos no pueden descansar.", category: "bar_trouble" as const, urgency: "medium" as const, status: "active" as const, isAnonymous: true, latitude: j(-11.1310), longitude: j(-75.3572), address: "Av. Circunvalación cdra. 4", sector: "Pampa del Carmen", authorName: "Anónimo", contactPhone: null, confirmedCount: 11, createdAt: ts(2) },
      { title: "Actitud sospechosa en Plaza de Armas", description: "Grupo de 4 personas desconocidas merodeando a transeúntes con mochilas grandes.", category: "suspicious" as const, urgency: "medium" as const, status: "reviewing" as const, isAnonymous: true, latitude: j(-11.1280), longitude: j(-75.3553), address: "Plaza de Armas, San Ramón", sector: "San Ramón Centro", authorName: "Rosa Huamán", contactPhone: "956-112-233", confirmedCount: 4, createdAt: ts(2, 5) },
      { title: "Pelea callejera en Jr. Progreso", description: "Enfrentamiento entre dos grupos frente a tienda de abarrotes. Vidrios rotos.", category: "fight" as const, urgency: "high" as const, status: "resolved" as const, isAnonymous: false, latitude: j(-11.1265), longitude: j(-75.3558), address: "Jr. Progreso cdra. 2, San Ramón", sector: "San Ramón Centro", authorName: "Ana Tuesta", contactPhone: "943-221-100", confirmedCount: 12, createdAt: ts(3) },
      { title: "Asalto en grifo de la Carretera Central", description: "Cajero amenazado con arma blanca de madrugada. Llevaron S/. 2,000 de caja.", category: "robbery" as const, urgency: "critical" as const, status: "active" as const, isAnonymous: false, latitude: j(-11.1263), longitude: j(-75.3541), address: "Grifo Chanchamayo, Carretera Central PE-22B", sector: "San Ramón Centro", authorName: "Jorge Suárez", contactPhone: "976-334-889", confirmedCount: 20, createdAt: ts(7) },
      { title: "Corte de agua en Av. Circunvalación", description: "Sin agua por más de 8 horas. EMAPA no da información a los vecinos.", category: "water_cut" as const, urgency: "medium" as const, status: "active" as const, isAnonymous: false, latitude: j(-11.1310), longitude: j(-75.3575), address: "Av. Circunvalación cdra. 4, Pampa del Carmen", sector: "Pampa del Carmen", authorName: "Jorge Suárez", contactPhone: null, confirmedCount: 15, createdAt: ts(4) },
      { title: "Incendio en vivienda de San Luis", description: "Segundo piso en llamas. Bomberos llegaron en 18 minutos. Sin víctimas.", category: "fire" as const, urgency: "critical" as const, status: "resolved" as const, isAnonymous: false, latitude: j(-11.1255), longitude: j(-75.3580), address: "Sector San Luis, Calle Los Pinos, San Ramón", sector: "San Luis", authorName: "Ana Tuesta", contactPhone: null, confirmedCount: 18, createdAt: ts(8) },
      { title: "Robo de moto en Pampa del Carmen", description: "Honda Wave llevada mientras estaba estacionada con llave puesta frente a bodega.", category: "robbery" as const, urgency: "high" as const, status: "active" as const, isAnonymous: false, latitude: j(-11.1320), longitude: j(-75.3565), address: "Pampa del Carmen, Calle 7, San Ramón", sector: "Pampa del Carmen", authorName: "Rosa Huamán", contactPhone: "912-445-670", confirmedCount: 3, createdAt: ts(10) },
      { title: "Robo a vivienda en Jr. Junín", description: "Entraron por el techo mientras la familia dormía. Se llevaron TV, laptop y efectivo.", category: "robbery" as const, urgency: "high" as const, status: "active" as const, isAnonymous: false, latitude: j(-11.1275), longitude: j(-75.3560), address: "Jr. Junín cdra. 5, San Ramón", sector: "San Ramón Centro", authorName: "Carlos Quispe", contactPhone: "989-002-341", confirmedCount: 3, createdAt: ts(14) },
      { title: "Basura acumulada en Mercado Central", description: "Sin recojo de residuos 3 días seguidos. Malos olores, moscas y aparición de ratas.", category: "garbage" as const, urgency: "low" as const, status: "active" as const, isAnonymous: false, latitude: j(-11.1291), longitude: j(-75.3549), address: "Jr. Junín, Mercado Central, San Ramón", sector: "San Ramón Centro", authorName: "Ana Tuesta", contactPhone: null, confirmedCount: 7, createdAt: ts(5) },
      { title: "Emergencia médica en Carretera Central", description: "Adulto mayor desmayado en la berma. Ambulancia tardó 25 minutos en llegar.", category: "medical_emergency" as const, urgency: "critical" as const, status: "resolved" as const, isAnonymous: false, latitude: j(-11.1285), longitude: j(-75.3535), address: "Carretera Central PE-22B, San Ramón", sector: "San Ramón Centro", authorName: "Jorge Suárez", contactPhone: null, confirmedCount: 3, createdAt: ts(6) },
      // Historical for heatmap (robbery/fight focus)
      { title: "Asalto en Jr. Callao", description: "Dos menores robaron celulares a estudiantes a la salida del colegio.", category: "robbery" as const, urgency: "high" as const, status: "resolved" as const, isAnonymous: false, latitude: j(-11.1282), longitude: j(-75.3542), address: "Jr. Callao cdra. 3", sector: "San Ramón Centro", authorName: "Rosa Huamán", contactPhone: null, confirmedCount: 7, createdAt: ts(20) },
      { title: "Pelea entre vecinos en Los Ángeles", description: "Disputa por linderos derivó en violencia física con arma contundente.", category: "fight" as const, urgency: "medium" as const, status: "resolved" as const, isAnonymous: false, latitude: j(-11.1300), longitude: j(-75.3555), address: "AA.HH. Los Ángeles, Calle 8", sector: "Los Ángeles", authorName: "Carlos Quispe", contactPhone: null, confirmedCount: 4, createdAt: ts(35) },
      { title: "Robo de negocio en Av. Juan Santos", description: "Ladrones rompieron vitrina y sustrajeron mercadería por S/. 8,000.", category: "robbery" as const, urgency: "critical" as const, status: "resolved" as const, isAnonymous: false, latitude: j(-11.1295), longitude: j(-75.3540), address: "Av. Juan Santos Atahualpa cdra. 2", sector: "San Ramón Centro", authorName: "Ana Tuesta", contactPhone: null, confirmedCount: 15, createdAt: ts(55) },
      { title: "Asalto en Jr. Salaverry", description: "Dos sujetos en bicicleta arrebataron cartera a señora en hora punta.", category: "robbery" as const, urgency: "high" as const, status: "resolved" as const, isAnonymous: false, latitude: j(-11.1268), longitude: j(-75.3575), address: "Jr. Salaverry cdra. 1", sector: "San Ramón Centro", authorName: "Carlos Quispe", contactPhone: null, confirmedCount: 8, createdAt: ts(100) },
      { title: "Pelea en discoteca El Paraíso", description: "Riña con botellas rotas y sillas. Tres heridos leves atendidos en el HC.", category: "fight" as const, urgency: "high" as const, status: "resolved" as const, isAnonymous: false, latitude: j(-11.1275), longitude: j(-75.3556), address: "Jr. Progreso, cerca de discoteca El Paraíso", sector: "San Ramón Centro", authorName: "Ana Tuesta", contactPhone: null, confirmedCount: 9, createdAt: ts(120) },
      { title: "Robo de motocar en El Milagro", description: "Vehículo de transporte menor robado en plena vía pública a mediodía.", category: "robbery" as const, urgency: "medium" as const, status: "resolved" as const, isAnonymous: false, latitude: j(-11.1308), longitude: j(-75.3528), address: "Jr. El Milagro cdra. 2", sector: "El Milagro", authorName: "Rosa Huamán", contactPhone: null, confirmedCount: 4, createdAt: ts(155) },
    ];

    await db.insert(reportsTable).values(seedReports.map(r => ({
      ...r,
      updatedAt: r.createdAt,
    })));

    await db.insert(panicAlertsTable).values([
      { type: "robbery" as const, latitude: j(-11.1272), longitude: j(-75.3548), address: "Jr. Tarma cdra. 3, San Ramón Centro", authorName: "Vecino Anónimo", sector: "San Ramón Centro", isActive: true, createdAt: ts(0, 1) },
      { type: "medical" as const, latitude: j(-11.1285), longitude: j(-75.3535), address: "Carretera Central PE-22B", authorName: "Ana Tuesta", sector: "San Ramón Centro", isActive: false, createdAt: ts(0, 8) },
    ]).onConflictDoNothing();

    await db.insert(missingPersonsTable).values([
      { name: "Sebastián Quispe", age: 9, clothing: "Uniforme escolar azul con mochila roja, zapatillas blancas", photoUrl: null, lastSeenLatitude: -11.1260, lastSeenLongitude: -75.3546, lastSeenAddress: "Colegio Chanchamayo, Av. Ramón Castilla, San Ramón", lastSeenAt: ts(0, 4), contactInfo: "Mamá: 987-654-321", status: "active" as const, reportedBy: "Rosa Huamán", createdAt: ts(0, 4) }
    ]).onConflictDoNothing();

    await db.insert(adSlotsTable).values([
      { businessName: "Ferretería El Constructor", tagline: "Materiales de construcción y acabados — San Ramón", imageUrl: null, targetUrl: "https://example.com", isActive: true, sector: "San Ramón Centro" },
      { businessName: "Botica San Ramón", tagline: "Medicamentos al mejor precio. Delivery Chanchamayo", imageUrl: null, targetUrl: "https://example.com", isActive: true, sector: null },
    ]).onConflictDoNothing();

    res.json({ seeded: true, message: `✅ ${seedReports.length} reportes de demo insertados correctamente.` });
  } catch (err) {
    req.log.error({ err }, "Seed failed");
    res.status(500).json({ error: "Seed failed", detail: String(err) });
  }
});

export default router;
