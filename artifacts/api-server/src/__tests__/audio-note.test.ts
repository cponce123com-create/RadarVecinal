/**
 * Nota de voz:
 *  - telegramAudioUrl fuerza .mp3 en URLs de Cloudinary (compatibilidad).
 *  - POST /storage/uploads/request-url valida el audio (tipo/tamaño) antes de
 *    tocar Cloudinary.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { telegramAudioUrl } from "../lib/telegram";

describe("telegramAudioUrl", () => {
  it("cambia la extensión de audio de Cloudinary a .mp3", () => {
    expect(
      telegramAudioUrl(
        "https://res.cloudinary.com/demo/video/upload/v1/radarvecinal/audio/x.webm",
      ),
    ).toBe(
      "https://res.cloudinary.com/demo/video/upload/v1/radarvecinal/audio/x.mp3",
    );
    expect(
      telegramAudioUrl("https://res.cloudinary.com/demo/video/upload/v1/x.m4a"),
    ).toBe("https://res.cloudinary.com/demo/video/upload/v1/x.mp3");
  });
  it("no toca URLs que no son de Cloudinary", () => {
    expect(telegramAudioUrl("https://otro.com/a.webm")).toBe(
      "https://otro.com/a.webm",
    );
  });
});

describe.skipIf(!process.env.DATABASE_URL)(
  "Validación de subida de audio",
  () => {
    let app: any;
    let request: any;
    let token: string;

    beforeAll(async () => {
      app = (await import("../app")).default;
      request = (await import("supertest")).default;
      const db = (await import("@workspace/db")).db;
      const schema = await import("@workspace/db/schema");
      const jwt = (await import("jsonwebtoken")).default;
      const [d] = await db
        .insert(schema.districtsTable)
        .values({
          slug: `aud-${Date.now()}`,
          name: "AUD",
          province: "T",
          department: "T",
        })
        .returning();
      const [u] = await db
        .insert(schema.usersTable)
        .values({
          name: `aud_${Date.now()}`,
          email: `aud_${Date.now()}@t.pe`,
          role: "user",
          sector: "T",
          district: "T",
          districtId: d.id,
          isActive: true,
        })
        .returning();
      token = jwt.sign(
        { sub: String(u.id), role: "user" },
        process.env.JWT_SECRET!,
        { expiresIn: "1h" },
      );
    });

    const req = (body: any) =>
      request(app)
        .post("/api/storage/uploads/request-url")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

    it("rechaza audio con tipo no permitido (400)", async () => {
      const res = await req({
        name: "n.exe",
        size: 1000,
        contentType: "application/octet-stream",
        kind: "audio",
      });
      expect(res.status).toBe(400);
    });

    it("rechaza audio demasiado grande (400)", async () => {
      const res = await req({
        name: "n.webm",
        size: 5 * 1024 * 1024,
        contentType: "audio/webm",
        kind: "audio",
      });
      expect(res.status).toBe(400);
    });

    it("audio válido no da 400 (503 si Cloudinary no está configurado, 200 si sí)", async () => {
      const res = await req({
        name: "n.webm",
        size: 80 * 1024,
        contentType: "audio/webm;codecs=opus",
        kind: "audio",
      });
      expect([200, 503]).toContain(res.status);
    });
  },
);
