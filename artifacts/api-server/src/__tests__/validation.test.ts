import { describe, it, expect } from "vitest";
import { z } from "zod";

// Replicate the validation schemas from @workspace/api-zod for testing
const createReportSchema = z.object({
  title: z
    .string()
    .min(5, "El título debe tener al menos 5 caracteres")
    .max(160),
  description: z
    .string()
    .min(10, "La descripción debe tener al menos 10 caracteres")
    .max(2000),
  category: z.enum([
    "robbery",
    "fight",
    "suspicious",
    "water_cut",
    "garbage",
    "noise",
    "fire",
    "medical_emergency",
    "missing_person",
    "prostitution",
    "drug_point",
    "bar_trouble",
    "informal_commerce",
    "other",
  ]),
  urgency: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().max(200).optional(),
  sector: z.string().max(100),
  district: z.string().max(100),
  isAnonymous: z.boolean().default(false),
  authorName: z.string().max(100).default("Anónimo"),
  contactPhone: z
    .string()
    .regex(/^\d{6,15}$/, "Teléfono inválido")
    .optional()
    .nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

const patchUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  sector: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  dni: z
    .string()
    .regex(/^\d{8}$/, "DNI debe tener 8 dígitos")
    .optional()
    .nullable(),
});

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

describe("Report Validation Schema", () => {
  it("should accept a valid report body", () => {
    const result = createReportSchema.safeParse({
      title: "Robo en la esquina de mi casa",
      description: "Vi a dos sujetos sospechosos forcejeando con una señora",
      category: "robbery",
      urgency: "high",
      latitude: -11.1282,
      longitude: -75.3554,
      sector: "San Ramón Centro",
      district: "San Ramón",
    });
    expect(result.success).toBe(true);
  });

  it("should reject a report with short title", () => {
    const result = createReportSchema.safeParse({
      title: "Robo",
      description: "Descripción suficientemente larga para pasar la validación",
      category: "robbery",
      latitude: -11.1282,
      longitude: -75.3554,
      sector: "San Ramón Centro",
      district: "San Ramón",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("title");
    }
  });

  it("should reject a report with invalid category", () => {
    const result = createReportSchema.safeParse({
      title: "Robo en la esquina",
      description: "Descripción suficientemente larga para pasar la validación",
      category: "invalid_category",
      latitude: -11.1282,
      longitude: -75.3554,
      sector: "San Ramón Centro",
      district: "San Ramón",
    });
    expect(result.success).toBe(false);
  });

  it("should accept minimal fields with defaults", () => {
    const result = createReportSchema.safeParse({
      title: "Incidente en la calle principal",
      description: "Descripción de al menos diez caracteres para pasar",
      category: "other",
      latitude: -11.1282,
      longitude: -75.3554,
      sector: "Centro",
      district: "San Ramón",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.urgency).toBe("medium");
      expect(result.data.isAnonymous).toBe(false);
    }
  });
});

describe("User Patch Validation Schema", () => {
  it("should accept valid DNI", () => {
    const result = patchUserSchema.safeParse({ dni: "12345678" });
    expect(result.success).toBe(true);
  });

  it("should reject invalid DNI (too short)", () => {
    const result = patchUserSchema.safeParse({ dni: "1234" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid DNI (non-numeric)", () => {
    const result = patchUserSchema.safeParse({ dni: "abcdefgh" });
    expect(result.success).toBe(false);
  });

  it("should accept partial update", () => {
    const result = patchUserSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("should accept empty object (nothing to update)", () => {
    const result = patchUserSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("Login Validation Schema", () => {
  it("should accept valid credentials", () => {
    const result = loginSchema.safeParse({
      email: "user@test.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject short password", () => {
    const result = loginSchema.safeParse({
      email: "user@test.com",
      password: "12345",
    });
    expect(result.success).toBe(false);
  });
});
