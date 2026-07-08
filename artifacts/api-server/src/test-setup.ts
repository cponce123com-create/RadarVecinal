/**
 * Test setup for integration tests.
 * This file only runs when a valid DATABASE_URL is available.
 * Integration tests should use `describe.skipIf(!process.env.DATABASE_URL)`
 * to conditionally run only when a database is configured.
 */

// La app (auth.ts) exige JWT_SECRET al cargarse. Los tests de integración que
// montan la app firman tokens con este mismo valor, por lo que debe coincidir
// para que la verificación de JWT pase.
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "radar-vecinal-dev-secret-2024";

console.log(
  "[test-setup] DATABASE_URL " +
    (process.env.DATABASE_URL
      ? "is set"
      : "is NOT set — integration tests will be skipped."),
);
