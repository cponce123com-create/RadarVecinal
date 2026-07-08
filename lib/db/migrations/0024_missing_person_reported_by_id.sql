-- Migración 0024: identidad del reportante de personas extraviadas.
-- Añade `reported_by_id` (user id) para poder identificar al autor de forma
-- fiable en los permisos de edición (antes solo existía `reported_by`, que
-- guarda el NOMBRE del reportante y no permitía el chequeo de autoría).
-- Nullable: las filas existentes quedan sin autor asociado.

ALTER TABLE missing_persons ADD COLUMN IF NOT EXISTS reported_by_id integer REFERENCES users(id);
