/**
 * Test setup for integration tests.
 * This file only runs when a valid DATABASE_URL is available.
 * Integration tests should use `describe.skipIf(!process.env.DATABASE_URL)`
 * to conditionally run only when a database is configured.
 */

console.log(
  "[test-setup] DATABASE_URL " +
    (process.env.DATABASE_URL
      ? "is set"
      : "is NOT set — integration tests will be skipped."),
);
