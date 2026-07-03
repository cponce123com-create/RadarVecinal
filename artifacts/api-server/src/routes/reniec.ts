import { Router, type IRouter } from "express";
import { z } from "zod";

const router: IRouter = Router();

const RENIEC_API_URL = process.env.RENIEC_API_URL || "https://api.decolecta.com/v1/reniec/dni";
const RENIEC_API_TOKEN = process.env.RENIEC_API_TOKEN;

// GET /reniec/lookup/:dni - Buscar datos de un DNI
router.get("/reniec/lookup/:dni", async (req, res) => {
  const dniSchema = z.object({
    dni: z.string().regex(/^\d{8}$/, "DNI debe tener exactamente 8 dígitos"),
  });

  const parsed = dniSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "DNI inválido. Debe tener 8 dígitos." });
  }

  const { dni } = parsed.data;

  if (!RENIEC_API_TOKEN) {
    return res.status(500).json({ error: "RENIEC_API_TOKEN no configurado. Contacta al administrador." });
  }

  try {
    const response = await fetch(`${RENIEC_API_URL}?numero=${dni}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RENIEC_API_TOKEN}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.error || "Error al consultar RENIEC",
      });
    }

    return res.json({
      success: true,
      data: {
        dni: data.document_number,
        firstName: data.first_name,
        lastName: `${data.first_last_name} ${data.second_last_name}`,
        fullName: data.full_name,
      },
      source: "reniec",
    });
  } catch (err) {
    req.log.error({ err }, "RENIEC lookup failed");
    return res.status(502).json({
      success: false,
      error: "Error de conexión con el servicio RENIEC. Intenta de nuevo.",
    });
  }
});

export default router;
