import { Router, type IRouter, type Request, type Response } from "express";
import { RequestUploadUrlBody } from "@workspace/api-zod";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../lib/objectStorage";
import { requireAuth } from "./auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Formatos de imagen permitidos
const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_FORMATS = ["jpg", "png", "webp"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function getFormatFromContentType(contentType: string): string | null {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return map[contentType] ?? null;
}

/**
 * POST /storage/uploads/request-url
 *
 * Cloudinary: genera parámetros firmados para upload directo desde el cliente.
 * Solo usuarios autenticados. Solo imágenes (jpg/png/webp) de hasta 10MB.
 * El cliente recibe:
 *   - uploadURL    → POST aquí con multipart/form-data
 *   - signature    → firma SHA-1 para autenticar el upload
 *   - timestamp    → timestamp UNIX
 *   - apiKey       → API Key de Cloudinary
 *   - cloudName    → Cloud name
 *   - objectPath   → path normalizado para guardar en DB
 *
 * El cliente debe enviar multipart/form-data a uploadURL con:
 *   file: <el archivo>
 *   api_key: apiKey
 *   timestamp: timestamp
 *   signature: signature
 *   folder: "radarvecinal"
 */
router.post(
  "/storage/uploads/request-url",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    const { name, size, contentType } = parsed.data;

    // Validar tipo de contenido
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      res.status(400).json({
        error: `Tipo de archivo no permitido: "${contentType}". Solo se aceptan imágenes: ${ALLOWED_CONTENT_TYPES.join(", ")}`,
      });
      return;
    }

    // Validar tamaño
    if (size > MAX_FILE_SIZE_BYTES) {
      res.status(400).json({
        error: `Archivo demasiado grande (${(size / 1024 / 1024).toFixed(1)}MB). Máximo permitido: 10MB.`,
      });
      return;
    }

    try {
      const uploadResult =
        await objectStorageService.getObjectEntityUploadURL();

      res.json({
        uploadURL: uploadResult.uploadURL,
        signature: uploadResult.signature,
        timestamp: uploadResult.timestamp,
        apiKey: uploadResult.apiKey,
        cloudName: uploadResult.cloudName,
        folder: uploadResult.folder,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      // Falta configuración de Cloudinary → 503 claro para informar al usuario.
      const message =
        error instanceof Error && /CLOUDINARY/i.test(error.message)
          ? "La carga de fotos no está disponible: falta configurar el almacenamiento (Cloudinary)."
          : "No se pudo iniciar la subida de la imagen.";
      req.log.error({ err: error }, "Error generating Cloudinary upload URL");
      res.status(503).json({ error: message });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get(
  "/storage/public-objects/*filePath",
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join("/") : raw;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      // Redirigir al CDN de Cloudinary
      const cloudinaryCN = process.env.CLOUDINARY_CLOUD_NAME || "";
      const publicUrl = `https://res.cloudinary.com/${cloudinaryCN}/image/upload/${filePath}`;
      res.redirect(301, publicUrl);
    } catch (error) {
      req.log.error({ err: error }, "Error serving public object");
      res.status(500).json({ error: "Failed to serve public object" });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile =
      await objectStorageService.getObjectEntityFile(objectPath);

    // Redirigir al CDN de Cloudinary (302 para no cachear la redirección)
    const cloudinaryCN = process.env.CLOUDINARY_CLOUD_NAME || "";
    const publicUrl = `https://res.cloudinary.com/${cloudinaryCN}/image/upload/${objectFile.path}`;
    res.redirect(302, publicUrl);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
