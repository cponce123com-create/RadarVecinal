import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth, requireBackoffice } from "./auth";
import { MemoryCache } from "../lib/memoryCache";
import { db } from "@workspace/db";
import { auditLogTable } from "@workspace/db/schema";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const router: IRouter = Router();

const RENIEC_API_URL =
  process.env.RENIEC_API_URL || "https://api.decolecta.com/v1/reniec/dni";
const RENIEC_API_TOKEN = process.env.RENIEC_API_TOKEN;

// Cache en memoria con TTL de 30 minutos por DNI
const reniecCache = new MemoryCache<RENIECResponse>();

interface RENIECResponse {
  success: boolean;
  data: {
    dni: string;
    firstName: string;
    lastName: string;
    fullName: string;
  };
  source: string;
}

// Rate limiter dedicado: 10 consultas por hora por usuario
const reniecLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const jwtUser = (req as any).jwtUser;
    if (jwtUser?.sub) return `reniec_user_${jwtUser.sub}`;
    return `reniec_ip_${ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "")}`;
  },
  message: {
    error: "Límite de consultas RENIEC alcanzado (10/hora). Intenta más tarde.",
  },
});

// GET /reniec/lookup/:dni - Buscar datos de un DNI (solo backoffice municipal)
router.get(
  "/reniec/lookup/:dni",
  requireAuth,
  requireBackoffice,
  reniecLimiter,
  async (req, res) => {
    const dniSchema = z.object({
      dni: z.string().regex(/^\d{8}$/, "DNI debe tener exactamente 8 dígitos"),
    });

    const parsed = dniSchema.safeParse(req.params);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "DNI inválido. Debe tener 8 dígitos." });
    }

    const { dni } = parsed.data;
    const user = (req as any).jwtUser;

    // Verificar cache primero
    const cached = reniecCache.get(dni);
    if (cached) {
      // Registrar consulta en audit_log aunque sea cacheada
      await db
        .insert(auditLogTable)
        .values({
          districtId: Number(user.districtId ?? 0),
          entityType: "reniec_lookup",
          entityId: 0,
          action: "lookup_cached",
          previousValue: null,
          newValue: dni,
          changedBy: user?.email ?? "unknown",
          changedById: user ? Number(user.sub) : undefined,
        })
        .catch(() => {});
      return res.json(cached);
    }

    if (!RENIEC_API_TOKEN) {
      return res.status(500).json({
        error: "RENIEC_API_TOKEN no configurado. Contacta al administrador.",
      });
    }

    try {
      const response = await fetch(`${RENIEC_API_URL}?numero=${dni}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RENIEC_API_TOKEN}`,
        },
      });

      const data = (await response.json()) as {
        document_number: string;
        first_name: string;
        first_last_name: string;
        second_last_name: string;
        full_name: string;
        error?: string;
      };

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: data.error || "Error al consultar RENIEC",
        });
      }

      const result: RENIECResponse = {
        success: true,
        data: {
          dni: data.document_number,
          firstName: data.first_name,
          lastName: `${data.first_last_name} ${data.second_last_name}`,
          fullName: data.full_name,
        },
        source: "reniec",
      };

      // Guardar en cache por 30 minutos
      reniecCache.set(dni, result, 30 * 60 * 1000);

      // Registrar consulta en audit_log
      await db
        .insert(auditLogTable)
        .values({
          districtId: Number(user.districtId ?? 0),
          entityType: "reniec_lookup",
          entityId: 0,
          action: "lookup",
          previousValue: null,
          newValue: dni,
          changedBy: user?.email ?? "unknown",
          changedById: user ? Number(user.sub) : undefined,
        })
        .catch(() => {});

      return res.json(result);
    } catch (err) {
      req.log.error({ err }, "RENIEC lookup failed");
      return res.status(502).json({
        success: false,
        error: "Error de conexión con el servicio RENIEC. Intenta de nuevo.",
      });
    }
  },
);

export default router;
