import { Router, type IRouter, type Request, type Response } from "express";
import {
  RequestUploadUrlBody,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Cloudinary: genera parámetros firmados para upload directo desde el cliente.
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
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const uploadResult = await objectStorageService.getObjectEntityUploadURL();

    res.json({
      uploadURL: uploadResult.uploadURL,
      signature: uploadResult.signature,
      timestamp: uploadResult.timestamp,
      apiKey: uploadResult.apiKey,
      cloudName: uploadResult.cloudName,
      folder: "radarvecinal",
      objectPath: `/pending/${Date.now()}-${name}`,
      metadata: { name, size, contentType },
    });
  } catch (error) {
    req.log.error({ err: error }, "Error generating Cloudinary upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
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
});

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
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

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
