-- Migration 0025: Restringir el piloto a SOLO 2 distritos activos.
--
-- Contexto: la migración 0015 insertó los 43 distritos de Lima (todos con
-- is_active=true por defecto). Con tantos distritos activos y pegados entre sí
-- (Ate, El Agustino, San Luis, Santa Anita… a pocos km), el primer fix
-- impreciso del GPS (~1-3 km) caía en un distrito VECINO y luego corregía al
-- real: ese era el bug de "dos ubicaciones" en el encabezado.
--
-- El piloto opera por ahora en 2 distritos: Santa Anita (Lima) y San Ramón
-- (Chanchamayo). Al dejar activos solo esos dos, la resolución por cercanía es
-- inequívoca: cualquier punto en Lima resuelve Santa Anita y cualquiera en
-- Chanchamayo resuelve San Ramón, aun con GPS impreciso.
--
-- Para expandir a más distritos: reactivar por slug (UPDATE ... is_active=true)
-- o desde el panel de superadmin, y retirar el "candado" de abajo.

-- 1) Desactivar todos los distritos salvo los dos del piloto.
UPDATE "districts"
SET "is_active" = false
WHERE "slug" NOT IN ('santa-anita', 'san-ramon');
--> statement-breakpoint

-- 2) Asegurar que los dos del piloto queden activos.
UPDATE "districts"
SET "is_active" = true
WHERE "slug" IN ('santa-anita', 'san-ramon');
--> statement-breakpoint

-- 3) Corregir el centro de Santa Anita (el sembrado en 0015 apuntaba hacia el
--    borde con Ate) y fijar un zoom urbano.
UPDATE "districts"
SET "center_lat" = -12.0433, "center_lng" = -76.9719, "default_zoom" = 14
WHERE "slug" = 'santa-anita';
--> statement-breakpoint

-- 4) Límites (bounding box GeoJSON) para detección EXACTA por point-in-polygon,
--    así el encabezado no muestra "(aprox.)". Al haber solo 2 distritos activos
--    no hay polígonos en competencia, por lo que una caja generosa es segura.
UPDATE "districts"
SET "boundary" = '{"type":"Polygon","coordinates":[[[-76.995,-12.024],[-76.955,-12.024],[-76.955,-12.070],[-76.995,-12.070],[-76.995,-12.024]]]}'::jsonb
WHERE "slug" = 'santa-anita';
--> statement-breakpoint

UPDATE "districts"
SET "boundary" = '{"type":"Polygon","coordinates":[[[-75.395,-11.095],[-75.315,-11.095],[-75.315,-11.165],[-75.395,-11.165],[-75.395,-11.095]]]}'::jsonb
WHERE "slug" = 'san-ramon';
