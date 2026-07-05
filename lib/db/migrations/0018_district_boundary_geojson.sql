/**
 * import-geojson.ts — Importa límites de distritos desde un archivo GeoJSON.
 *
 * Uso:
 *   pnpm run import-geojson -- --file=lima-districts.geojson
 *
 * El archivo GeoJSON debe ser un FeatureCollection donde cada feature tenga:
 *   - properties.name: El nombre del distrito (debe coincidir con el campo `name`
 *     en la tabla `districts` de la base de datos).
 *   - geometry.type: "Polygon" o "MultiPolygon"
 *   - geometry.coordinates: El anillo de coordenadas GeoJSON.
 *
 * Fuentes recomendadas de polígonos de distritos del Perú:
 *   - INEI: https://www.inei.gob.pe/ — límites distritales oficiales
 *   - IDEP: https://idep.inei.gob.pe/ — geoportal de infraestructura de datos
 *   - peru-geojson (GitHub): https://github.com/edwinpgm/peru-geojson
 *     Contiene GeoJSON de todos los departamentos, provincias y distritos del Perú.
 *   - OCHA Perú: https://data.humdata.org/group/per — datos humanitarios
 *
 * El script actualiza la columna `boundary` en la tabla `districts` para cada
 * distrito cuyo nombre coincida exactamente (case-insensitive) con properties.name.
 * Los distritos sin coincidencia se saltan con un warning.
 */

import { db } from "@workspace/db";
import { districtsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { readFileSync } from "fs";

interface GeoJSONFeature {
  type: "Feature";
  properties: Record<string, any>;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: any;
  } | null;
}

interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

async function main() {
  const fileArg = process.argv.find(a => a.startsWith("--file="));
  if (!fileArg) {
    console.error("❌ Uso: pnpm run import-geojson -- --file=distritos.geojson");
    process.exit(1);
  }

  const filePath = fileArg.replace("--file=", "");
  console.log(`📂 Leyendo ${filePath}...`);

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (err) {
    console.error(`❌ No se pudo leer el archivo: ${filePath}`);
    console.error(err);
    process.exit(1);
  }

  let collection: GeoJSONFeatureCollection;
  try {
    collection = JSON.parse(raw);
  } catch {
    console.error("❌ El archivo no es JSON válido.");
    process.exit(1);
  }

  if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
    console.error("❌ El archivo debe ser un GeoJSON FeatureCollection.");
    process.exit(1);
  }

  console.log(`✅ Se encontraron ${collection.features.length} features.`);
  console.log("🔍 Buscando distritos en la base de datos...
");

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const feature of collection.features) {
    const name = feature.properties?.name?.trim();
    if (!name) {
      skipped++;
      continue;
    }

    if (!feature.geometry || !feature.geometry.type || !feature.geometry.coordinates) {
      console.warn(`  ⚠️  "${name}" no tiene geometría válida. Saltando.`);
      skipped++;
      continue;
    }

    if (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon") {
      console.warn(`  ⚠️  "${name}" tiene geometría tipo "${feature.geometry.type}" (no soportado). Saltando.`);
      skipped++;
      continue;
    }

    try {
      // Buscar por nombre exacto (case-insensitive)
      const [district] = await db
        .select({ id: districtsTable.id, name: districtsTable.name })
        .from(districtsTable)
        .where(sql`LOWER(${districtsTable.name}) = LOWER(${name})`)
        .limit(1);

      if (!district) {
        console.warn(`  ⚠️  Distrito "${name}" no encontrado en la DB. Saltando.`);
        skipped++;
        continue;
      }

      await db
        .update(districtsTable)
        .set({
          boundary: JSON.stringify({
            type: feature.geometry.type,
            coordinates: feature.geometry.coordinates,
          }) as any,
        })
        .where(eq(districtsTable.id, district.id));

      console.log(`  ✅ "${district.name}" ← boundary actualizado.`);
      updated++;
    } catch (err) {
      console.error(`  ❌ Error actualizando "${name}":`, err);
      errors++;
    }
  }

  console.log("
── Resumen ──");
  console.log(`  ✅ Actualizados: ${updated}`);
  console.log(`  ⏭  Saltados:     ${skipped}`);
  console.log(`  ❌ Errores:      ${errors}`);
  console.log("✅ Importación completada.");

  process.exit(errors > 0 ? 1 : 0);
}

main();
