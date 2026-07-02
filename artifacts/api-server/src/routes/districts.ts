import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { districtsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/districts — público, retorna solo distritos activos
// M-11: El frontend usa este endpoint en vez de datos hardcodeados
router.get("/districts", async (_req, res) => {
  try {
    const districts = await db.select()
      .from(districtsTable)
      .where(eq(districtsTable.isActive, true))
      .orderBy(districtsTable.name);
    return res.json({ districts });
  } catch (err) {
    _req.log.error({ err }, "Failed to get districts");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
