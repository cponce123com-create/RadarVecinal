export * from "./generated/api";
export * from "./generated/types";

// Desambiguación de colisión entre re-exportaciones `*`:
// `SeedDataBody` existe como schema Zod (valor) en ./generated/api y como
// tipo homónimo en ./generated/types. Una re-exportación explícita tiene
// precedencia sobre los `export *` y elimina el error TS2308 sin tocar el
// código generado (sobrevive a la regeneración de orval). El schema Zod ya
// permite derivar el tipo con `z.infer<typeof SeedDataBody>`.
export { SeedDataBody } from "./generated/api";
