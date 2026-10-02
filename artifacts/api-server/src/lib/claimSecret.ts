/**
 * Comparación en tiempo constante del secreto de activación del
 * superadministrador (Parte A1). Se aísla en un módulo propio para poder
 * probarlo sin base de datos.
 */
import crypto from "crypto";

/**
 * Devuelve `true` solo si `provided` coincide exactamente con `expected`.
 * Si `expected` no está configurado devuelve `false` (fail-closed: el endpoint
 * queda cerrado hasta que se configure la clave en el servidor).
 */
export function isValidClaimSecret(
  provided: unknown,
  expected: string | undefined,
): boolean {
  if (!expected || typeof provided !== "string" || provided.length === 0) {
    return false;
  }
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
