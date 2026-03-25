import { db } from "@workspace/db";
import {
  reportsTable,
  panicAlertsTable,
  missingPersonsTable,
  usersTable,
  adSlotsTable,
} from "@workspace/db/schema";

// San Ramón, Chanchamayo, Junín — center: -11.1282, -75.3554
async function seed() {
  console.log("🌱 Seeding San Ramón, Chanchamayo...");

  await db.delete(adSlotsTable);
  await db.delete(missingPersonsTable);
  await db.delete(panicAlertsTable);
  await db.delete(reportsTable);
  await db.delete(usersTable);

  await db.insert(usersTable).values([
    { name: "Admin Radar",  email: "admin@radarvecinal.pe", role: "admin",     sector: "San Ramón Centro", district: "San Ramón", reportsCount: 0 },
    { name: "Rosa Huamán",  email: "rosa@example.com",      role: "user",      sector: "San Ramón Centro", district: "San Ramón", reportsCount: 5 },
    { name: "Carlos Quispe",email: "carlos@example.com",    role: "user",      sector: "Pampa del Carmen", district: "San Ramón", reportsCount: 3 },
    { name: "Ana Tuesta",   email: "ana@example.com",       role: "moderator", sector: "San Luis",         district: "San Ramón", reportsCount: 12 },
    { name: "Jorge Suárez", email: "jorge@example.com",     role: "user",      sector: "Los Ángeles",      district: "San Ramón", reportsCount: 7 },
  ]);

  const now = new Date();
  const ts  = (daysAgo: number, hoursAgo = 0, minsAgo = 0) =>
    new Date(now.getTime() - daysAgo * 86400000 - hoursAgo * 3600000 - minsAgo * 60000);

  // Small random jitter so clustered points spread visibly
  const j = (v: number, range = 0.002) => v + (Math.random() - 0.5) * range;

  await db.insert(reportsTable).values([
    // ── Last 15 days (map view) ───────────────────────────────────────────────
    {
      title: "Asalto a mano armada en Jr. Tarma",
      description: "Dos sujetos en moto asaltaron a una señora frente al banco. Se llevaron cartera y celular.",
      category: "robbery", urgency: "critical", status: "active", isAnonymous: false,
      latitude: j(-11.1272), longitude: j(-75.3548),
      address: "Jr. Tarma cdra. 3, San Ramón Centro", sector: "San Ramón Centro",
      authorName: "Carlos Quispe", confirmedCount: 8,
      createdAt: ts(0, 0, 25), updatedAt: ts(0, 0, 25),
    },
    {
      title: "Actitud sospechosa en Plaza de Armas",
      description: "Grupo de 4 personas desconocidas merodeando a transeúntes, con mochilas grandes.",
      category: "suspicious", urgency: "medium", status: "reviewing", isAnonymous: true,
      latitude: j(-11.1280), longitude: j(-75.3553),
      address: "Plaza de Armas, San Ramón", sector: "San Ramón Centro",
      authorName: "Vecino Anónimo", confirmedCount: 4,
      createdAt: ts(0, 1, 10), updatedAt: ts(0, 1, 10),
    },
    {
      title: "Pelea callejera en Jr. Progreso",
      description: "Enfrentamiento entre dos grupos frente a tienda. Vidrios rotos.",
      category: "fight", urgency: "high", status: "resolved", isAnonymous: false,
      latitude: j(-11.1265), longitude: j(-75.3558),
      address: "Jr. Progreso cdra. 2, San Ramón", sector: "San Ramón Centro",
      authorName: "Rosa Huamán", confirmedCount: 12,
      createdAt: ts(0, 3), updatedAt: ts(0, 2),
    },
    {
      title: "Corte de agua en Av. Circunvalación",
      description: "Sin agua 8 horas. EMAPA no da información.",
      category: "water_cut", urgency: "medium", status: "active", isAnonymous: false,
      latitude: j(-11.1310), longitude: j(-75.3572),
      address: "Av. Circunvalación cdra. 4, Pampa del Carmen", sector: "Pampa del Carmen",
      authorName: "Jorge Suárez", confirmedCount: 15,
      createdAt: ts(1, 2), updatedAt: ts(1, 2),
    },
    {
      title: "Basura acumulada en Mercado Central",
      description: "Sin recojo 3 días. Malos olores y ratas.",
      category: "garbage", urgency: "low", status: "active", isAnonymous: false,
      latitude: j(-11.1291), longitude: j(-75.3549),
      address: "Jr. Junín, Mercado Central, San Ramón", sector: "San Ramón Centro",
      authorName: "Ana Tuesta", confirmedCount: 7,
      createdAt: ts(2, 6), updatedAt: ts(2, 6),
    },
    {
      title: "Emergencia médica en Carretera Central",
      description: "Adulto mayor desmayado. Ambulancia tardó 25 minutos.",
      category: "medical_emergency", urgency: "critical", status: "resolved", isAnonymous: false,
      latitude: j(-11.1285), longitude: j(-75.3535),
      address: "Carretera Central PE-22B, San Ramón", sector: "San Ramón Centro",
      authorName: "Jorge Suárez", confirmedCount: 3,
      createdAt: ts(2, 8), updatedAt: ts(2, 7),
    },
    {
      title: "Asalto en grifo de la Carretera Central",
      description: "Cajero amenazado con arma blanca de madrugada.",
      category: "robbery", urgency: "critical", status: "active", isAnonymous: false,
      latitude: j(-11.1263), longitude: j(-75.3541),
      address: "Grifo Chanchamayo, Carretera Central PE-22B", sector: "San Ramón Centro",
      authorName: "Carlos Quispe", confirmedCount: 20,
      createdAt: ts(3, 2), updatedAt: ts(3, 2),
    },
    {
      title: "Ruidos molestos en Los Ángeles",
      description: "Fiesta con música a todo volumen desde las 11pm.",
      category: "noise", urgency: "low", status: "archived", isAnonymous: true,
      latitude: j(-11.1298), longitude: j(-75.3562),
      address: "AA.HH. Los Ángeles, Calle 4, San Ramón", sector: "Los Ángeles",
      authorName: "Vecino Anónimo", confirmedCount: 6,
      createdAt: ts(4), updatedAt: ts(4),
    },
    {
      title: "Comercio ilícito en Jr. Lima",
      description: "Venta de productos sin procedencia conocida frente al mercado.",
      category: "informal_commerce", urgency: "low", status: "reviewing", isAnonymous: true,
      latitude: j(-11.1288), longitude: j(-75.3545),
      address: "Jr. Lima cdra. 2, San Ramón", sector: "San Ramón Centro",
      authorName: "Vecino Anónimo", confirmedCount: 9,
      createdAt: ts(5), updatedAt: ts(5),
    },
    {
      title: "Incendio en vivienda de San Luis",
      description: "Segundo piso en llamas. Bomberos llegaron en 18 minutos.",
      category: "fire", urgency: "critical", status: "resolved", isAnonymous: false,
      latitude: j(-11.1255), longitude: j(-75.3580),
      address: "Sector San Luis, Calle Los Pinos, San Ramón", sector: "San Luis",
      authorName: "Ana Tuesta", confirmedCount: 18,
      createdAt: ts(6), updatedAt: ts(5),
    },
    {
      title: "Menor acosado cerca del colegio",
      description: "Escolar seguido por adulto desconocido desde el colegio hasta su casa.",
      category: "suspicious", urgency: "high", status: "reviewing", isAnonymous: false,
      latitude: j(-11.1260), longitude: j(-75.3546),
      address: "Av. Ramón Castilla, cerca del colegio, San Ramón", sector: "San Ramón Centro",
      authorName: "Rosa Huamán", confirmedCount: 2,
      createdAt: ts(7), updatedAt: ts(7),
    },
    {
      title: "Robo de moto en Pampa del Carmen",
      description: "Honda Wave llevada estando estacionada con llave puesta.",
      category: "robbery", urgency: "high", status: "active", isAnonymous: false,
      latitude: j(-11.1318), longitude: j(-75.3568),
      address: "Pampa del Carmen, Calle 7, San Ramón", sector: "Pampa del Carmen",
      authorName: "Jorge Suárez", confirmedCount: 1,
      createdAt: ts(8), updatedAt: ts(8),
    },
    {
      title: "Persona sospechosa en El Milagro",
      description: "Hombre desconocido mirando casas y anotando en libreta.",
      category: "suspicious", urgency: "medium", status: "reviewing", isAnonymous: false,
      latitude: j(-11.1305), longitude: j(-75.3530),
      address: "Jr. El Milagro cdra. 1, San Ramón", sector: "El Milagro",
      authorName: "Rosa Huamán", confirmedCount: 5,
      createdAt: ts(10), updatedAt: ts(10),
    },
    {
      title: "Robo a vivienda en Jr. Junín",
      description: "Entraron por techo mientras familia dormía. Se llevaron equipo electrónico.",
      category: "robbery", urgency: "high", status: "active", isAnonymous: false,
      latitude: j(-11.1275), longitude: j(-75.3560),
      address: "Jr. Junín cdra. 5, San Ramón", sector: "San Ramón Centro",
      authorName: "Ana Tuesta", confirmedCount: 3,
      createdAt: ts(12), updatedAt: ts(12),
    },
    {
      title: "Accidente de tránsito en PE-22B",
      description: "Choque entre mototaxi y camión. Dos heridos leves.",
      category: "medical_emergency", urgency: "high", status: "resolved", isAnonymous: false,
      latitude: j(-11.1270), longitude: j(-75.3520),
      address: "Carretera PE-22B km 95, San Ramón", sector: "San Ramón Centro",
      authorName: "Carlos Quispe", confirmedCount: 10,
      createdAt: ts(14), updatedAt: ts(13),
    },

    // ── Older data for heatmap (15d–6 months) ────────────────────────────────
    {
      title: "Asalto en Jr. Callao",
      description: "Dos menores robaron celulares a estudiantes a la salida del colegio.",
      category: "robbery", urgency: "high", status: "resolved", isAnonymous: false,
      latitude: j(-11.1282), longitude: j(-75.3542),
      address: "Jr. Callao cdra. 3, San Ramón", sector: "San Ramón Centro",
      authorName: "Rosa Huamán", confirmedCount: 7,
      createdAt: ts(30), updatedAt: ts(30),
    },
    {
      title: "Pelea entre vecinos en Los Ángeles",
      description: "Disputa por linderos derivó en violencia física.",
      category: "fight", urgency: "medium", status: "resolved", isAnonymous: true,
      latitude: j(-11.1302), longitude: j(-75.3555),
      address: "AA.HH. Los Ángeles, Calle 8", sector: "Los Ángeles",
      authorName: "Vecino Anónimo", confirmedCount: 4,
      createdAt: ts(45), updatedAt: ts(45),
    },
    {
      title: "Incendio de pastizales en rivera del río",
      description: "Incendio controlado por bomberos. Sin víctimas.",
      category: "fire", urgency: "medium", status: "resolved", isAnonymous: false,
      latitude: j(-11.1240), longitude: j(-75.3570),
      address: "Margen del Río Tarma, San Ramón", sector: "Río Tarma",
      authorName: "Carlos Quispe", confirmedCount: 11,
      createdAt: ts(60), updatedAt: ts(59),
    },
    {
      title: "Robo de negocio en Av. Juan Santos",
      description: "Ladrones rompieron vitrina y sustrajeron mercadería.",
      category: "robbery", urgency: "critical", status: "resolved", isAnonymous: false,
      latitude: j(-11.1295), longitude: j(-75.3540),
      address: "Av. Juan Santos Atahualpa cdra. 2", sector: "San Ramón Centro",
      authorName: "Ana Tuesta", confirmedCount: 15,
      createdAt: ts(90), updatedAt: ts(90),
    },
    {
      title: "Actitud sospechosa en Pampa del Carmen",
      description: "Vehículo desconocido circulando lentamente de noche.",
      category: "suspicious", urgency: "medium", status: "archived", isAnonymous: true,
      latitude: j(-11.1322), longitude: j(-75.3565),
      address: "Pampa del Carmen, Calle Principal", sector: "Pampa del Carmen",
      authorName: "Vecino Anónimo", confirmedCount: 3,
      createdAt: ts(120), updatedAt: ts(120),
    },
    {
      title: "Emergencia médica en mercado",
      description: "Señora sufrió crisis hipertensiva. Atendida por serenazgo.",
      category: "medical_emergency", urgency: "high", status: "resolved", isAnonymous: false,
      latitude: j(-11.1290), longitude: j(-75.3550),
      address: "Mercado Central, San Ramón", sector: "San Ramón Centro",
      authorName: "Jorge Suárez", confirmedCount: 5,
      createdAt: ts(150), updatedAt: ts(149),
    },
    {
      title: "Robo de cable eléctrico",
      description: "Desconocidos cortaron cable eléctrico dejando sin luz 2 cuadras.",
      category: "robbery", urgency: "medium", status: "resolved", isAnonymous: false,
      latitude: j(-11.1268), longitude: j(-75.3575),
      address: "Jr. Salaverry cdra. 1, San Ramón", sector: "San Ramón Centro",
      authorName: "Carlos Quispe", confirmedCount: 8,
      createdAt: ts(165), updatedAt: ts(165),
    },
    {
      title: "Pelea en discoteca El Paraíso",
      description: "Riña con botellas rotas. Tres heridos leves.",
      category: "fight", urgency: "high", status: "resolved", isAnonymous: false,
      latitude: j(-11.1275), longitude: j(-75.3555),
      address: "Jr. Progreso, cerca de discoteca El Paraíso", sector: "San Ramón Centro",
      authorName: "Ana Tuesta", confirmedCount: 9,
      createdAt: ts(175), updatedAt: ts(175),
    },
  ]);

  await db.insert(panicAlertsTable).values([
    {
      type: "robbery",
      latitude: j(-11.1272), longitude: j(-75.3548),
      address: "Jr. Tarma cdra. 3, San Ramón Centro",
      authorName: "Usuario Anónimo", sector: "San Ramón Centro",
      isActive: true,
      createdAt: ts(0, 0, 30),
    },
    {
      type: "medical",
      latitude: j(-11.1285), longitude: j(-75.3535),
      address: "Carretera Central PE-22B, San Ramón",
      authorName: "Ana Tuesta", sector: "San Ramón Centro",
      isActive: false,
      createdAt: ts(0, 8),
    },
    {
      type: "fight",
      latitude: j(-11.1265), longitude: j(-75.3558),
      address: "Jr. Progreso cdra. 2, San Ramón",
      authorName: "Carlos Quispe", sector: "San Ramón Centro",
      isActive: false,
      createdAt: ts(0, 5),
    },
  ]);

  await db.insert(missingPersonsTable).values([
    {
      name: "Sebastián",
      age: 9,
      clothing: "Uniforme escolar azul con mochila roja, zapatillas blancas",
      photoUrl: null,
      lastSeenLatitude:  -11.1260,
      lastSeenLongitude: -75.3546,
      lastSeenAddress: "Colegio Chanchamayo, Av. Ramón Castilla, San Ramón",
      lastSeenAt: ts(0, 4),
      contactInfo: "Mamá: 987-654-321",
      status: "active",
      reportedBy: "Rosa Huamán",
      createdAt: ts(0, 4),
    },
  ]);

  await db.insert(adSlotsTable).values([
    {
      businessName: "Ferretería El Constructor",
      tagline: "Materiales de construcción y acabados — San Ramón",
      imageUrl: null,
      targetUrl: "https://example.com",
      isActive: true,
      sector: "San Ramón Centro",
    },
    {
      businessName: "Botica San Ramón",
      tagline: "Medicamentos al mejor precio. Delivery Chanchamayo",
      imageUrl: null,
      targetUrl: "https://example.com",
      isActive: true,
      sector: null,
    },
  ]);

  console.log("✅ Seed complete: 22 reports (15 recent + 7 historical) seeded for San Ramón, Chanchamayo.");
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
