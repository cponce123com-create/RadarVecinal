import { db } from "@workspace/db";
import { reportsTable, panicAlertsTable, missingPersonsTable, usersTable, adSlotsTable, districtsTable } from "@workspace/db/schema";
import { sql, eq } from "drizzle-orm";
import { logger } from "./logger";

const LAT = -11.1272, LNG = -75.3548;
const j = (v: number, r = 0.0025) => parseFloat((v + (Math.random() * 2 - 1) * r).toFixed(6));
const ts = (daysAgo: number, hrsAgo = 0) =>
  new Date(Date.now() - daysAgo * 86400000 - hrsAgo * 3600000);

export async function autoSeedIfEmpty() {
  try {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(reportsTable);
    if (Number(count) >= 5) {
      logger.info({ count }, "DB already has reports — skipping auto-seed");
      return;
    }

    // M-05: Obtener districtId de San Ramón
    let [district] = await db.select({ id: districtsTable.id })
      .from(districtsTable)
      .where(eq(districtsTable.slug, "san-ramon"))
      .limit(1);

    if (!district) {
      logger.warn("Distrito 'san-ramon' no encontrado. Auto-seed: insertando distrito por defecto...");
      [district] = await db.insert(districtsTable).values({
        slug: "san-ramon",
        name: "San Ramón",
        province: "Chanchamayo",
        department: "Junín",
        centerLat: -11.1223,
        centerLng: -75.3560,
      }).returning();
    }
    const sanRamonId = district.id;

    logger.info("DB is empty — auto-seeding 50 demo reports...");

    // ── Usuarios demo ─────────────────────────────────────────────────
    await db.insert(usersTable).values([
      {
        name: "Admin Radar Vecinal",
        email: "cponce123.com@gmail.com",
        passwordHash: "$2b$10$fjXrnkPKElRJkoS2Jcq.iuJYERLKOUHjFikzaKlPpYPgqczub1fIe",
        role: "admin" as const,
        sector: "San Ramón Centro",
        districtId: sanRamonId,
        district: "San Ramón",
        reportsCount: 0,
      },
      {
        name: "Admin San Ramón",
        email: "admin-san-ramon@radarvecinal.app",
        passwordHash: "$2b$10$Wn2fesNFZ.uIZXJaAuqD/es0aN2TF5jB0EHT4ksFpSzgI5R/xiwqW",
        role: "admin" as const,
        sector: "San Ramón Centro",
        districtId: sanRamonId,
        district: "San Ramón",
        reportsCount: 0,
      },
      {
        name: "Vecino Demo San Ramón",
        email: "vecino-san-ramon@radarvecinal.app",
        passwordHash: "$2b$10$Wn2fesNFZ.uIZXJaAuqD/eHX8WJvdv.Ap52KR3WmrudFwXjqTgbGy",
        role: "user" as const,
        sector: "San Ramón Centro",
        districtId: sanRamonId,
        district: "San Ramón",
        reportsCount: 0,
      },
    ]).onConflictDoNothing();

    // ── 50 Reportes ────────────────────────────────────────────────────────
    const reports = [
      // Últimos 15 días (12)
      { title: "Asalto a mano armada en Jr. Tarma", description: "Dos sujetos en moto asaltaron a señora frente al banco BN. Se llevaron cartera y celular Samsung.", category: "robbery" as const, urgency: "critical" as const, status: "active" as const, isAnonymous: false, districtId: sanRamonId, district: "San Ramón", province: "Chanchamayo", department: "Junín", latitude: j(LAT), longitude: j(LNG), address: "Jr. Tarma cdra. 3 frente al Banco de la Nación", sector: "San Ramón Centro", authorName: "Carlos Quispe", contactPhone: "987-654-321", confirmedCount: 8, createdAt: ts(0, 1), updatedAt: ts(0, 1) },
      { title: "Grupo sospechoso merodeando el mercado", description: "Cuatro individuos desconocidos recorren el mercado central, siguen a compradores.", category: "suspicious" as const, urgency: "high" as const, status: "reviewing" as const, isAnonymous: false, districtId: sanRamonId, district: "San Ramón", province: "Chanchamayo", department: "Junín", latitude: j(LAT), longitude: j(LNG), address: "Mercado Central de San Ramón, Jr. Junín", sector: "San Ramón Centro", authorName: "Rosa Huamán Torres", contactPhone: "943-221-100", confirmedCount: 11, createdAt: ts(0, 3), updatedAt: ts(0, 3) },
      { title: "Prostíbulo clandestino en Jr. Lima", description: "Local sin licencia opera desde las 10pm. Se han visto menores de edad ingresando.", category: "prostitution" as const, urgency: "high" as const, status: "reviewing" as const, isAnonymous: true, districtId: sanRamonId, district: "San Ramón", province: "Chanchamayo", department: "Junín", latitude: j(LAT), longitude: j(LNG), address: "Jr. Lima cdra. 4, San Ramón", sector: "San Ramón Centro", authorName: "Anónimo", contactPhone: null, confirmedCount: 6, createdAt: ts(1, 2), updatedAt: ts(1, 2) },
      { title: "Pelea a la salida de cantina en Jr. Grau", description: "Riña entre 6 personas, botellazos y sillazos. Un herido con corte en la cabeza.", category: "fight" as const, urgency: "high" as const, status: "active" as const, isAnonymous: false, districtId: sanRamonId, district: "San Ramón", province: "Chanchamayo", department: "Junín", latitude: j(LAT), longitude: j(LNG), address: "Jr. Grau cdra. 1, San Ramón", sector: "San Ramón Centro", authorName: "Pedro Campos López", contactPhone: "976-334-889", confirmedCount: 14, createdAt: ts(2, 1), updatedAt: ts(2, 1) },
      { title: "Punto de venta de drogas frente a la Iglesia", description: "Grupo de jóvenes vende sustancias en motos viernes y sábados desde las 8pm.", category: "drug_point" as const, urgency: "high" as const, status: "active" as const, isAnonymous: true, districtId: sanRamonId, district: "San Ramón", province: "Chanchamayo", department: "Junín", latitude: j(LAT), longitude: j(LNG), address: "Pampa del Carmen, frente a Iglesia Evangélica", sector: "Pampa del Carmen", authorName: "Anónimo", contactPhone: null, confirmedCount: 17, createdAt: ts(3), updatedAt: ts(3) },
      { title: "Bar sin licencia con música hasta el amanecer", description: "Cantina opera sin permiso hasta las 5am. Ebrios en la calle cada fin de semana.", category: "bar_trouble" as const, urgency: "medium" as const, status: "active" as const, isAnonymous: true, districtId: sanRamonId, district: "San Ramón", province: "Chanchamayo", department: "Junín", latitude: j(LAT), longitude: j(LNG), address: "Av. Circunvalación cdra. 4, Pampa del Carmen", sector: "Pampa del Carmen", authorName: "Anónimo", contactPhone: null, confirmedCount: 9, createdAt: ts(4, 8), updatedAt: ts(4, 8) },
      { title: "Robo de moto Honda Wave en la noche", description: "Honda Wave roja, placa 3847-K, robada frente a mi casa. Dos sujetos captados en cámara.", category: "robbery" as const, urgency: "high" as const, status: "active" as const, isAnonymous: false, districtId: sanRamonId, district: "San Ramón", province: "Chanchamayo", department: "Junín", latitude: j(LAT), longitude: j(LNG), address: "Pampa del Carmen, Calle 7 Mz. D Lt. 3", sector: "Pampa del Carmen", authorName: "Jorge Suárez Rengifo", contactPhone: "989-002-341", confirmedCount: 3, createdAt: ts(5), updatedAt: ts(5) },
      { title: "Corte de agua sin previo aviso — 3er día", description: "Llevamos tres días sin agua. EMAPA no responde. Familias con niños afectadas.", category: "water_cut" as const, urgency: "medium" as const, status: "active" as const, isAnonymous: false, districtId: sanRamonId, district: "San Ramón", province: "Chanchamayo", department: "Junín", latitude: j(LAT), longitude: j(LNG), address: "Av. Circunvalación cdra. 5, entre Jr. Cusco y Jr. Puno", sector: "Pampa del Carmen", authorName: "María Flores Espinoza", contactPhone: "987-123-456", confirmedCount: 22, createdAt: ts(6, 7), updatedAt: ts(6, 7) },
      { title: "Incendio en vivienda de material noble — San Luis", description: "Incendio por cortocircuito. Bomberos tardaron 18 min. Familia de 4 sin hogar.", category: "fire" as const, urgency: "critical" as const, status: "resolved" as const, isAnonymous: false, districtId: sanRamonId, district: "San Ramón", province: "Chanchamayo", department: "Junín", latitude: j(LAT), longitude: j(LNG), address: "Sector San Luis, Calle Los Pinos Mz. C Lt. 9", sector: "San Luis", authorName: "Ana Tuesta Valles", contactPhone: "943-558-712", confirmedCount: 25, createdAt: ts(7, 22), updatedAt: ts(7, 22) },
      { title: "Basura acumulada 4 días sin recojo", description: "El camión de limpieza no pasa desde hace 4 días. Ratas y mal olor.", category: "garbage" as const, urgency: "low" as const, status: "active" as const, isAnonymous: false, districtId: sanRamonId, district: "San Ramón", province: "Chanchamayo", department: "Junín", latitude: j(LAT), longitude: j(LNG), address: "Jr. Junín, frente al Mercado Central", sector: "San Ramón Centro", authorName: "Cecilia Ríos Mendoza", contactPhone: null, confirmedCount: 15, createdAt: ts(8, 5), updatedAt: ts(8, 5) },
      { title: "Menor seguido por adulto desconocido", description: "Escolar seguido por hombre adulto desde el colegio. Intentó que subiera a su auto.", category: "suspicious" as const, urgency: "critical" as const, status: "reviewing" as const, isAnonymous: false, districtId: sanRamonId, district: "San Ramón", province: "Chanchamayo", department: "Junín", latitude: j(LAT), longitude: j(LNG), address: "Jr. Ramón Castilla cdra. 6, San Ramón", sector: "San Ramón Centro", authorName: "Rosa Huamán Torres", contactPhone: "943-221-100", confirmedCount: 7, createdAt: ts(9, 14), updatedAt: ts(9, 14) },
      { title: "Comercio ambulatorio ilegal bloquea vía", description: "Vendedores sin permiso ocupan vereda y calzada en Jr. Tarma.", category: "informal_commerce" as const, urgency: "low" as const, status: "active" as const, isAnonymous: false, districtId: sanRamonId, district: "San Ramón", province: "Chanchamayo", department: "Junín", latitude: j(LAT), longitude: j(LNG), address: "Jr. Tarma cdra. 1 y 2, San Ramón Centro", sector: "San Ramón Centro", authorName: "Luis Enrique Asto", contactPhone: null, confirmedCount: 8, createdAt: ts(13, 9), updatedAt: ts(13, 9) },
    ];

    await db.insert(reportsTable).values(reports);

    // ── Panic Alerts ───────────────────────────────────────────────────────
    await db.insert(panicAlertsTable).values([
      { districtId: sanRamonId, type: "robbery" as const, latitude: j(LAT), longitude: j(LNG), address: "Jr. Tarma cdra. 3, San Ramón Centro", authorName: "Carlos Quispe", sector: "San Ramón Centro", isActive: true, createdAt: ts(0, 1) },
      { districtId: sanRamonId, type: "medical" as const, latitude: j(LAT), longitude: j(LNG), address: "Carretera Central PE-22B, km 94", authorName: "Ana Tuesta", sector: "San Ramón Centro", isActive: false, createdAt: ts(0, 8) },
      { districtId: sanRamonId, type: "fight" as const, latitude: j(LAT), longitude: j(LNG), address: "Jr. Grau cdra. 1, San Ramón", authorName: "Pedro Campos", sector: "San Ramón Centro", isActive: false, createdAt: ts(0, 5) },
    ]).onConflictDoNothing();

    // ── Missing Persons ─────────────────────────────────────────────────────
    await db.insert(missingPersonsTable).values([{
      districtId: sanRamonId,
      name: "Sebastián Flores",
      age: 9,
      clothing: "Uniforme escolar azul, mochila roja, zapatillas blancas Nike",
      photoUrl: null,
      lastSeenLatitude: -11.1260,
      lastSeenLongitude: -75.3546,
      lastSeenAddress: "Colegio José Carlos Mariátegui, Av. Ramón Castilla",
      lastSeenAt: ts(0, 4),
      contactInfo: "Mamá Rosa: 987-654-321 | Papá Juan: 943-112-000",
      status: "active" as const,
      reportedBy: "Rosa Huamán Torres",
      createdAt: ts(0, 4),
    }]).onConflictDoNothing();

    // ── Ad Slots ───────────────────────────────────────────────────────────
    await db.insert(adSlotsTable).values([
      { districtId: sanRamonId, businessName: "Ferretería El Constructor", tagline: "Materiales de construcción y acabados — San Ramón", imageUrl: null, targetUrl: "https://example.com", isActive: true, sector: "San Ramón Centro" },
      { districtId: sanRamonId, businessName: "Botica San Ramón", tagline: "Medicamentos al mejor precio. Delivery en toda Chanchamayo", imageUrl: null, targetUrl: "https://example.com", isActive: true, sector: null },
      { districtId: sanRamonId, businessName: "Hospedaje Río Tarma", tagline: "Habitaciones cómodas, wifi y desayuno — desde S/ 45", imageUrl: null, targetUrl: "https://example.com", isActive: true, sector: "San Ramón Centro" },
    ]).onConflictDoNothing();

    logger.info("✅ Auto-seed completo: datos insertados para San Ramón.");
  } catch (err) {
    logger.error({ err }, "Auto-seed failed — continuing without demo data");
  }
}
