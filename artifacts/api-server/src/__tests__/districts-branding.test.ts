/**
 * Cobranding por distrito.
 *
 * Regresión que protege: las columnas `brand_name`, `logo_url` y
 * `primary_color` las creó la migración 0008, pero en algún momento dejaron de
 * estar declaradas en el esquema Drizzle. `GET /api/districts` hace
 * `db.select()` sin lista de columnas, así que Drizzle dejó de devolverlas y
 * `useBranding` caía siempre a los valores por defecto: la función seguía en el
 * código, el hook seguía ejecutándose y no había ningún error, pero el theming
 * del distrito nunca se aplicaba.
 *
 * Este test fija el contrato de la respuesta. Si alguien vuelve a quitar las
 * columnas del esquema, falla aquí en vez de degradar en silencio.
 *
 * Requiere DATABASE_URL — se salta si no hay DB (igual que el resto de la
 * suite de integración).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe.skipIf(!process.env.DATABASE_URL)("Cobranding por distrito", () => {
  let app: any;
  let request: any;
  let db: any;
  let districtsTable: any;
  let eq: any;
  let districtId: number;
  const slug = `brand-${Date.now()}`;

  beforeAll(async () => {
    app = (await import("../app")).default;
    request = (await import("supertest")).default;
    db = (await import("@workspace/db")).db;
    districtsTable = (await import("@workspace/db/schema")).districtsTable;
    eq = (await import("drizzle-orm")).eq;

    const [district] = await db
      .insert(districtsTable)
      .values({
        slug,
        name: "Distrito Cobrand",
        province: "T",
        department: "T",
        brandName: "Radar Vecinal San Ramón",
        logoUrl: "https://example.test/logo.png",
        primaryColor: "#22c55e",
      })
      .returning();

    districtId = district.id;
  });

  afterAll(async () => {
    if (districtId) {
      await db.delete(districtsTable).where(eq(districtsTable.id, districtId));
    }
  });

  it("GET /api/districts devuelve brandName, logoUrl y primaryColor", async () => {
    const res = await request(app).get("/api/districts");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.districts)).toBe(true);

    const district = res.body.districts.find((d: any) => d.id === districtId);
    expect(district).toBeTruthy();
    expect(district.brandName).toBe("Radar Vecinal San Ramón");
    expect(district.logoUrl).toBe("https://example.test/logo.png");
    expect(district.primaryColor).toBe("#22c55e");
  });
});
