import { Router, type IRouter } from "express";
import { z } from "zod";

const router: IRouter = Router();

// Known mock DNI records
const KNOWN_DNIS: Record<string, { firstName: string; lastName: string; address?: string }> = {
  "12345678": { firstName: "Juan", lastName: "Pérez García", address: "Jr. Las Flores 123" },
  "87654321": { firstName: "María", lastName: "López Huamán", address: "Av. Principal 456" },
  "11111111": { firstName: "Carlos", lastName: "Quispe Túpac", address: "Calle Los Olivos 789" },
  "22222222": { firstName: "Ana", lastName: "Condori Mamani", address: "Pasaje El Sol 321" },
  "33333333": { firstName: "Pedro", lastName: "Huamán Rojas", address: "Av. Central 654" },
  "44444444": { firstName: "Lucía", lastName: "Gutiérrez Vargas", address: "Jr. Los Pinos 987" },
};

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

  // Simular latencia de red (300-800ms)
  await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));

  const found = KNOWN_DNIS[dni];

  if (!found) {
    return res.json({
      success: true,
      data: {
        dni,
        firstName: `Nombre${dni.slice(0, 4)}`,
        lastName: `Apellido${dni.slice(4)}`,
        address: "Dirección de referencia",
      },
      source: "mock",
    });
  }

  return res.json({
    success: true,
    data: {
      dni,
      ...found,
    },
    source: "reniec",
  });
});

export default router;
