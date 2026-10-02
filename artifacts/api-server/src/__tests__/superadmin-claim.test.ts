import { describe, it, expect } from "vitest";
import { isValidClaimSecret } from "../lib/claimSecret";

/**
 * Parte A1: verificación de la clave que protege el reclamo del rol
 * superadministrador. Es lógica pura (sin base de datos).
 */
describe("isValidClaimSecret (activación de superadmin)", () => {
  it("rechaza cuando no hay clave configurada (fail-closed)", () => {
    expect(isValidClaimSecret("algo", undefined)).toBe(false);
    expect(isValidClaimSecret("algo", "")).toBe(false);
  });

  it("rechaza una clave incorrecta", () => {
    expect(isValidClaimSecret("incorrecta", "la-correcta")).toBe(false);
  });

  it("rechaza valores que no son texto", () => {
    expect(isValidClaimSecret(undefined, "la-correcta")).toBe(false);
    expect(isValidClaimSecret(123, "la-correcta")).toBe(false);
    expect(isValidClaimSecret(null, "la-correcta")).toBe(false);
  });

  it("acepta la clave correcta", () => {
    expect(isValidClaimSecret("la-correcta", "la-correcta")).toBe(true);
  });
});
