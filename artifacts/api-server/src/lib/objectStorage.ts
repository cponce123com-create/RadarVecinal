/**
 * objectStorage.ts — Cloudinary storage service.
 *
 * Migrado de Google Cloud Storage a Cloudinary (más simple, free tier).
 *
 * Variables de entorno requeridas:
 *   CLOUDINARY_CLOUD_NAME  — ej: "dgp7qxhfj"
 *   CLOUDINARY_API_KEY     — ej: "482916734512873"
 *   CLOUDINARY_API_SECRET  — ej: "abc123..."
 *
 * Flujo de upload:
 *   1. POST /storage/uploads/request-url → devuelve URL firmada de Cloudinary
 *   2. El cliente sube el archivo (multipart/form-data) a esa URL
 *   3. Cloudinary responde con secure_url → se guarda en DB como objectPath
 */

import crypto from "crypto";

function getConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Faltan variables de entorno: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET",
    );
  }

  return { cloudName, apiKey, apiSecret };
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

/**
 * Genera una firma SHA-1 para uploads firmados a Cloudinary.
 * Ordena los parámetros alfabéticamente, los concatena como key=value,
 * y agrega el api_secret al final.
 */
function generateSignature(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const sortedKeys = Object.keys(params).sort();
  const sortedStr = sortedKeys.map((key) => `${key}=${params[key]}`).join("&");
  return crypto
    .createHash("sha1")
    .update(sortedStr + apiSecret)
    .digest("hex");
}

export class ObjectStorageService {
  /**
   * Genera los parámetros para un upload firmado a Cloudinary.
   * Devuelve la URL de upload + los campos que el cliente debe enviar.
   */
  async getObjectEntityUploadURL(
    resourceType: "image" | "video" = "image",
  ): Promise<{
    uploadURL: string;
    signature: string;
    timestamp: number;
    apiKey: string;
    cloudName: string;
    folder: string;
  }> {
    const { cloudName, apiKey, apiSecret } = getConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    // El audio va a una subcarpeta propia; Cloudinary trata el audio como
    // resource_type "video" (mismo endpoint /video/upload).
    const folder =
      resourceType === "video" ? "radarvecinal/audio" : "radarvecinal";

    // Cloudinary firma SOLO los parámetros que el cliente enviará, excluyendo
    // file, api_key, cloud_name y resource_type (este va en la URL, no se
    // firma). Firmamos el mínimo canónico (folder + timestamp) para que la
    // firma valide de forma fiable; el tipo y tamaño ya se validan en el
    // servidor antes de emitir la firma.
    const signature = generateSignature({ folder, timestamp }, apiSecret);

    return {
      uploadURL: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder,
    };
  }

  /**
   * Normaliza la respuesta de Cloudinary a un objectPath que se guarda en DB.
   * El path es "/objects/{public_id}.{format}" para poder servirlo después.
   */
  normalizeObjectEntityPath(uploadResult: {
    secure_url: string;
    public_id: string;
    format: string;
  }): string {
    return `/objects/${uploadResult.public_id}.${uploadResult.format}`;
  }

  /**
   * Busca un objeto público — en Cloudinary todos los objetos son accesibles
   * por su URL de delivery. Este método existe por compatibilidad con el flujo
   * actual de storage.ts.
   */
  async searchPublicObject(filePath: string): Promise<{ path: string } | null> {
    const { cloudName } = getConfig();
    // filePath viene como "public_id.format"
    return { path: filePath };
  }

  /**
   * Devuelve una respuesta HTTP que redirige a la URL de Cloudinary.
   * En vez de proxy el archivo (gasta ancho de banda del servidor),
   * redirigimos directamente al CDN de Cloudinary.
   */
  async downloadObject(file: { path: string }): Promise<{
    status: number;
    headers: Map<string, string>;
    body: null;
  }> {
    const { cloudName } = getConfig();
    const publicUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${file.path}`;

    const headers = new Map<string, string>();
    headers.set("Location", publicUrl);

    return {
      status: 302, // Redirect
      headers,
      body: null,
    };
  }

  /**
   * Obtiene el archivo por su objectPath. En Cloudinary no necesitamos
   * un objeto File como en GCS, solo validamos que el path sea válido.
   */
  async getObjectEntityFile(objectPath: string): Promise<{ path: string }> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const entityId = objectPath.slice("/objects/".length);
    if (!entityId) {
      throw new ObjectNotFoundError();
    }

    return { path: entityId };
  }

  /**
   * Los métodos de ACL se mantienen como stub.
   * Cloudinary maneja acceso por su propia configuración de delivery type.
   */
  async canAccessObjectEntity(): Promise<boolean> {
    return true;
  }
}
