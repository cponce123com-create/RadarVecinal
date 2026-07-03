import crypto from "crypto";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * License Code Generator — Radar Vecinal
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Genera códigos de licencia de 16 dígitos numéricos usando HMAC-SHA256.
 *
 * Input:  siglas, distrito, provincia, departamento
 * Output: 16 dígitos (string)
 *
 * Estructura del código:
 *   [0..7]   = 8 dígitos — Firma HMAC (bytes 0..5 del hash, módulo 10^8)
 *   [8..11]  = 4 dígitos — Timestamp (días desde 2020-01-01, módulo 10000)
 *   [12..13] = 2 dígitos — Hash del distrito (bytes 6..7, módulo 100)
 *   [14..15] = 2 dígitos — Checksum de verificación (módulo 97)
 *   Total: 16 dígitos
 *
 * Seguridad:
 *   - HMAC-SHA256 con secret del servidor (imposible de forjar sin el secret)
 *   - Checksum detecta errores de tipeo
 *   - Timestamp evita reuso indefinido
 *   - Sin correlación visible con los datos de entrada
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const EPOCH = new Date("2020-01-01T00:00:00Z").getTime();

/**
 * Obtiene el secret del servidor para firmar licencias.
 * En desarrollo usa un default, en producción debe estar en env.
 */
function getLicenseSecret(): string {
  return process.env.LICENSE_SECRET || process.env.JWT_SECRET || "radar-vecinal-license-dev-secret-key-2024";
}

/**
 * Normaliza un string: mayúsculas, sin tildes, sin espacios extra.
 */
function normalize(s: string): string {
  return s
    .toUpperCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar tildes
    .replace(/\s+/g, "");
}

/**
 * Genera un código de licencia de 16 dígitos.
 */
export function generateLicenseCode(
  siglas: string,
  distrito: string,
  provincia: string,
  departamento: string,
): string {
  const secret = getLicenseSecret();

  // 1. Normalizar inputs
  const nSiglas = normalize(siglas).slice(0, 10);
  const nDistrito = normalize(distrito);
  const nProvincia = normalize(provincia);
  const nDepartamento = normalize(departamento);

  // 2. Crear raw string
  const raw = `${nSiglas}|${nDistrito}|${nProvincia}|${nDepartamento}`;

  // 3. HMAC-SHA256
  const hmac = crypto.createHmac("sha256", secret).update(raw, "utf8").digest();
  // hmac es 32 bytes (64 hex chars)

  // 4. Firma: bytes[0..5] → entero de 48 bits → módulo 10^8 → 8 dígitos
  const sigBuf = hmac.subarray(0, 6);
  let sig = 0n;
  for (let i = 0; i < 6; i++) {
    sig = (sig << 8n) + BigInt(sigBuf[i]);
  }
  const sigPart = String(sig % 100000000n).padStart(8, "0");

  // 5. Timestamp: días desde 2020-01-01 → módulo 10000 → 4 dígitos
  const days = Math.floor((Date.now() - EPOCH) / 86400000);
  const tsPart = String(days % 10000).padStart(4, "0");

  // 6. Hash distrito: bytes[6..7] → entero 16 bits → módulo 100 → 2 dígitos
  const distHash = (hmac[6] * 256 + hmac[7]) % 100;
  const distPart = String(distHash).padStart(2, "0");

  // 7. Checksum: (sig + distHash + days) % 97 → 2 dígitos
  const checksum = (Number(sig % 97n) + distHash + (days % 97)) % 97;
  const checkPart = String(checksum).padStart(2, "0");

  // 8. Ensamblar: 8 + 4 + 2 + 2 = 16 dígitos
  return sigPart + tsPart + distPart + checkPart;
}

/**
 * Verifica que un código de licencia sea válido estructuralmente.
 * NOTA: Esto solo verifica el checksum y formato, NO que exista en DB.
 * Para activación usar lookup en DB + verifyLicenseCode.
 */
export function validateLicenseCodeFormat(code: string): boolean {
  if (!/^\d{16}$/.test(code)) return false;

  const sigPart = code.slice(0, 8);
  const tsPart = code.slice(8, 12);
  const distPart = code.slice(12, 14);
  const checkPart = code.slice(14, 16);

  const sig = BigInt(sigPart) % 97n;
  const distHash = parseInt(distPart, 10);
  const days = parseInt(tsPart, 10);
  const expectedCheck = (Number(sig) + distHash + (days % 97)) % 97;

  return parseInt(checkPart, 10) === expectedCheck;
}

/**
 * Formatea una licencia para respuesta API.
 */
export function formatLicenseResponse(license: any) {
  return {
    id: String(license.id),
    code: license.code,
    siglas: license.siglas,
    districtName: license.districtName,
    province: license.province,
    department: license.department,
    districtId: license.districtId ? String(license.districtId) : null,
    municipalUserId: license.municipalUserId ? String(license.municipalUserId) : null,
    createdBy: String(license.createdBy),
    createdAt: license.createdAt?.toISOString?.() ?? license.createdAt,
    activatedAt: license.activatedAt?.toISOString?.() ?? null,
    expiresAt: license.expiresAt?.toISOString?.() ?? null,
    isActive: license.isActive,
    maxViewers: license.maxViewers,
    // Calcular días restantes si está activa
    daysRemaining: license.expiresAt
      ? Math.max(0, Math.floor((new Date(license.expiresAt).getTime() - Date.now()) / 86400000))
      : null,
  };
}
