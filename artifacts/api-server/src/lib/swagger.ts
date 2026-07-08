/**
 * swagger.ts — Documentación OpenAPI interactiva (Swagger UI)
 * Inspirado en Civix (Swagger en /api-docs)
 */
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Router } from "express";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Radar Vecinal API",
      version: "1.0.0",
      description: `
      API de Radar Vecinal — Plataforma ciudadana de reportes de incidencias y seguridad vecinal.

      ## Autenticaci&oacute;n
      La API usa JWT tokens v&iacute;a header Authorization: Bearer <token>.
      Roles: user, moderator, admin, super_admin.

      ## Multi-tenant
      Todos los datos est&aacute;n aislados por districtId. Los usuarios autenticados
      solo ven/modifican datos de su propio distrito (excepto super_admin).
      `.trim(),
    },
    servers: [{ url: "/api", description: "API principal" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./artifacts/api-server/src/routes/*.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

const router = Router();
router.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss:
      ".swagger-ui .topbar { display: none } .swagger-ui { background: #0f1219 }",
    customSiteTitle: "Radar Vecinal — API Docs",
  }),
);

// Endpoint para descargar spec JSON
router.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));

export default router;
