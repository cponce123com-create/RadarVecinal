import { db } from "@workspace/db";
import {
  reportsTable,
  panicAlertsTable,
  missingPersonsTable,
  usersTable,
  adSlotsTable,
} from "@workspace/db/schema";

async function seed() {
  console.log("🌱 Starting seed...");

  await db.delete(adSlotsTable);
  await db.delete(missingPersonsTable);
  await db.delete(panicAlertsTable);
  await db.delete(reportsTable);
  await db.delete(usersTable);

  await db.insert(usersTable).values([
    { name: "Admin Radar", email: "admin@radarvecinal.pe", role: "admin", sector: "San Miguel Centro", district: "San Miguel", reportsCount: 0 },
    { name: "María García", email: "maria@example.com", role: "user", sector: "Pueblo Libre", district: "San Miguel", reportsCount: 5 },
    { name: "Carlos Quispe", email: "carlos@example.com", role: "user", sector: "Magdalena", district: "San Miguel", reportsCount: 3 },
    { name: "Ana Torres", email: "ana@example.com", role: "moderator", sector: "Breña", district: "San Miguel", reportsCount: 12 },
    { name: "Luis Mendoza", email: "luis@example.com", role: "user", sector: "Jesús María", district: "San Miguel", reportsCount: 7 },
  ]);

  const now = new Date();
  const reports = [];
  for (let i = 0; i < 25; i++) {
    const daysAgo = Math.floor(Math.random() * 7);
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
    reports.push(d);
  }

  await db.insert(reportsTable).values([
    {
      title: "Robo a mano armada en bodega",
      description: "Dos sujetos con casco robaron la caja de la bodega en esquina de Av. La Marina con Jr. Sucre. Escaparon en moto.",
      category: "robbery",
      urgency: "critical",
      status: "active",
      isAnonymous: false,
      latitude: -12.0777,
      longitude: -77.0921,
      address: "Av. La Marina 1245, San Miguel",
      sector: "San Miguel Centro",
      authorName: "Carlos Quispe",
      confirmedCount: 8,
      createdAt: reports[0],
      updatedAt: reports[0],
    },
    {
      title: "Actividad sospechosa en parque",
      description: "Grupo de personas desconocidas merodeando el parque por las noches, algunos vecinos reportan intimidación.",
      category: "suspicious",
      urgency: "medium",
      status: "reviewing",
      isAnonymous: true,
      latitude: -12.0812,
      longitude: -77.0889,
      address: "Parque de San Miguel, Av. Universitaria",
      sector: "San Miguel Centro",
      authorName: "Vecino Anónimo",
      confirmedCount: 4,
      createdAt: reports[1],
      updatedAt: reports[1],
    },
    {
      title: "Pelea entre pandillas",
      description: "Enfrentamiento entre dos grupos de jóvenes en la calle, se escucharon gritos y se rompieron vidrios.",
      category: "fight",
      urgency: "high",
      status: "resolved",
      isAnonymous: false,
      latitude: -12.0756,
      longitude: -77.0865,
      address: "Jr. Bolognesi 456, Pueblo Libre",
      sector: "Pueblo Libre",
      authorName: "María García",
      confirmedCount: 12,
      createdAt: reports[2],
      updatedAt: new Date(reports[2].getTime() + 3600000),
    },
    {
      title: "Corte de agua sin aviso",
      description: "Llevan 6 horas sin agua en toda la cuadra, Sedapal no da información.",
      category: "water_cut",
      urgency: "medium",
      status: "active",
      isAnonymous: false,
      latitude: -12.0834,
      longitude: -77.0812,
      address: "Calle Las Gardenias 123, Magdalena",
      sector: "Magdalena",
      authorName: "Luis Mendoza",
      confirmedCount: 15,
      createdAt: reports[3],
      updatedAt: reports[3],
    },
    {
      title: "Basura acumulada hace 3 días",
      description: "La municipalidad no ha pasado el camión de basura. Hay bolsas rotas y malos olores en la vereda.",
      category: "garbage",
      urgency: "low",
      status: "active",
      isAnonymous: false,
      latitude: -12.0791,
      longitude: -77.0934,
      address: "Av. Brasil 567, Breña",
      sector: "Breña",
      authorName: "Ana Torres",
      confirmedCount: 7,
      createdAt: reports[4],
      updatedAt: reports[4],
    },
    {
      title: "Emergencia médica en vía pública",
      description: "Adulto mayor se desplomó en la calle. Ambulancia fue llamada pero tardó 20 minutos.",
      category: "medical_emergency",
      urgency: "critical",
      status: "resolved",
      isAnonymous: false,
      latitude: -12.0823,
      longitude: -77.0856,
      address: "Av. Salaverry 890, Jesús María",
      sector: "Jesús María",
      authorName: "Luis Mendoza",
      confirmedCount: 3,
      createdAt: reports[5],
      updatedAt: new Date(reports[5].getTime() + 1800000),
    },
    {
      title: "Ruidos molestos de fiesta",
      description: "Fiesta con música a todo volumen desde las 11pm. No respetan el horario de descanso.",
      category: "noise",
      urgency: "low",
      status: "archived",
      isAnonymous: true,
      latitude: -12.0768,
      longitude: -77.0879,
      address: "Jr. Arequipa 234, Pueblo Libre",
      sector: "Pueblo Libre",
      authorName: "Vecino Anónimo",
      confirmedCount: 6,
      createdAt: reports[6],
      updatedAt: reports[6],
    },
    {
      title: "Asalto en grifo",
      description: "Delincuentes asaltaron el grifo Repsol de madrugada. Trabajadores heridos leves.",
      category: "robbery",
      urgency: "critical",
      status: "active",
      isAnonymous: false,
      latitude: -12.0745,
      longitude: -77.0902,
      address: "Av. La Marina 567, San Miguel",
      sector: "San Miguel Centro",
      authorName: "Carlos Quispe",
      confirmedCount: 20,
      createdAt: reports[7],
      updatedAt: reports[7],
    },
    {
      title: "Comercio ambulatorio bloquea vereda",
      description: "Vendedores informales bloqueando completamente la vereda frente al mercado. Peatones deben caminar por la pista.",
      category: "informal_commerce",
      urgency: "low",
      status: "reviewing",
      isAnonymous: false,
      latitude: -12.0801,
      longitude: -77.0867,
      address: "Mercado San Miguel, Av. La Marina",
      sector: "San Miguel Centro",
      authorName: "María García",
      confirmedCount: 9,
      createdAt: reports[8],
      updatedAt: reports[8],
    },
    {
      title: "Incendio en vivienda",
      description: "Se inició un incendio en el segundo piso de una vivienda. Bomberos acudieron en 15 minutos.",
      category: "fire",
      urgency: "critical",
      status: "resolved",
      isAnonymous: false,
      latitude: -12.0789,
      longitude: -77.0923,
      address: "Jr. Huánuco 123, Breña",
      sector: "Breña",
      authorName: "Ana Torres",
      confirmedCount: 18,
      createdAt: reports[9],
      updatedAt: new Date(reports[9].getTime() + 7200000),
    },
    {
      title: "Menor acosado en calle",
      description: "Escolar fue seguido por adulto desconocido desde el colegio hasta su casa. La madre reportó el hecho.",
      category: "suspicious",
      urgency: "high",
      status: "reviewing",
      isAnonymous: false,
      latitude: -12.0812,
      longitude: -77.0845,
      address: "Jr. Callao 456, Magdalena",
      sector: "Magdalena",
      authorName: "María García",
      confirmedCount: 2,
      createdAt: reports[10],
      updatedAt: reports[10],
    },
    {
      title: "Robo de vehículo",
      description: "Se llevaron un auto estacionado frente al domicilio. Las llaves estaban puestas.",
      category: "robbery",
      urgency: "high",
      status: "active",
      isAnonymous: false,
      latitude: -12.0756,
      longitude: -77.0934,
      address: "Calle Coronel Inclán 789, Miraflores",
      sector: "Jesús María",
      authorName: "Luis Mendoza",
      confirmedCount: 1,
      createdAt: reports[11],
      updatedAt: reports[11],
    },
  ]);

  await db.insert(panicAlertsTable).values([
    {
      type: "robbery",
      latitude: -12.0777,
      longitude: -77.0921,
      address: "Av. La Marina 1200, San Miguel",
      authorName: "Usuario Anónimo",
      sector: "San Miguel Centro",
      isActive: true,
      createdAt: new Date(now.getTime() - 30 * 60000),
    },
    {
      type: "medical",
      latitude: -12.0823,
      longitude: -77.0856,
      address: "Av. Salaverry 800, Jesús María",
      authorName: "Ana Torres",
      sector: "Jesús María",
      isActive: false,
      createdAt: new Date(now.getTime() - 2 * 3600000),
    },
    {
      type: "fight",
      latitude: -12.0756,
      longitude: -77.0865,
      address: "Jr. Bolognesi 400, Pueblo Libre",
      authorName: "Carlos Quispe",
      sector: "Pueblo Libre",
      isActive: false,
      createdAt: new Date(now.getTime() - 5 * 3600000),
    },
  ]);

  await db.insert(missingPersonsTable).values([
    {
      name: "Sebastián",
      age: 9,
      clothing: "Uniforme escolar azul con mochila roja, zapatillas blancas",
      photoUrl: null,
      lastSeenLatitude: -12.0801,
      lastSeenLongitude: -77.0867,
      lastSeenAddress: "Colegio San Miguel, Av. La Marina",
      lastSeenAt: new Date(now.getTime() - 4 * 3600000),
      contactInfo: "Mamá: 987-654-321",
      status: "active",
      reportedBy: "María García",
      createdAt: new Date(now.getTime() - 4 * 3600000),
    },
  ]);

  await db.insert(adSlotsTable).values([
    {
      businessName: "Ferretería El Maestro",
      tagline: "Todo para tu hogar y negocio — San Miguel",
      imageUrl: null,
      targetUrl: "https://example.com",
      isActive: true,
      sector: "San Miguel Centro",
    },
    {
      businessName: "Botica Familiar San Miguel",
      tagline: "Medicamentos al mejor precio. Delivery 24h",
      imageUrl: null,
      targetUrl: "https://example.com",
      isActive: true,
      sector: null,
    },
  ]);

  console.log("✅ Seed completed!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
