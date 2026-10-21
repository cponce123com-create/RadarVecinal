/**
 * district.ts — Territorio de un distrito (nombre, provincia, departamento).
 *
 * `users` y `reports` guardan `district`, `province` y `department` como
 * columnas derivadas (el frontend legacy las lee, y el PDF del reporte las
 * imprime). La fuente de verdad es la tabla `districts`: si no se rellenan
 * desde ahí, quedan con los valores por defecto del esquema
 * ("San Ramón" / "Chanchamayo" / "Junín") y cualquier usuario o reporte de
 * otra provincia queda con el territorio corrupto.
 *
 * `districtId` es la autoridad; el nombre y la demarcación se derivan de él.
 */
import { db } from "@workspace/db";
import { districtsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export interface DistrictTerritory {
  id: number;
  name: string;
  province: string;
  department: string;
}

/**
 * Devuelve el territorio del distrito, o `null` si el id no existe en el
 * catálogo. Devolver `null` (y no un valor inventado) permite a quien llama
 * decidir: rechazar la operación o avisar de una configuración rota.
 */
export async function getDistrictTerritory(
  districtId: number,
): Promise<DistrictTerritory | null> {
  const [row] = await db
    .select({
      id: districtsTable.id,
      name: districtsTable.name,
      province: districtsTable.province,
      department: districtsTable.department,
    })
    .from(districtsTable)
    .where(eq(districtsTable.id, districtId))
    .limit(1);
  return row ?? null;
}
