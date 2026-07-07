import { Layout } from "@/components/Layout";
import BrandingWrapper from "@/components/BrandingWrapper";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const CONSENT_VERSION = "2026-07-v1";

export default function Privacy() {
  return (
    <Layout>
      <BrandingWrapper>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/configuracion" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" />
            Volver a Configuración
          </Link>

          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h1>Política de Privacidad</h1>
            <p className="text-muted-foreground text-sm">
              Versión: {CONSENT_VERSION} — Vigente desde julio 2026
            </p>
            <hr />

            <h2>1. Identidad del Responsable del Tratamiento</h2>
            <p>
              Radar Vecinal (en adelante, "la Plataforma") es una aplicación de seguridad ciudadana
              operada por la Municipalidad del distrito correspondiente. En cumplimiento de la
              <strong> Ley N° 29733 — Ley de Protección de Datos Personales</strong> y su Reglamento
              (Decreto Supremo N° 003-2013-JUS), ponemos a disposición la presente política de privacidad.
            </p>

            <h2>2. Datos Personales que Recopilamos</h2>
            <p>Para la creación de una cuenta y el uso de la Plataforma, recopilamos los siguientes datos:</p>
            <ul>
              <li><strong>Datos de identificación:</strong> nombres, apellidos, DNI, correo electrónico, número de teléfono</li>
              <li><strong>Datos de ubicación:</strong> dirección, sector, distrito, coordenadas GPS de reportes</li>
              <li><strong>Datos de uso:</strong> historial de reportes, alertas de pánico, confirmaciones</li>
              <li><strong>Datos técnicos:</strong> dirección IP, tipo de navegador, identificador de dispositivo (FCM token)</li>
            </ul>

            <h2>3. Finalidades del Tratamiento</h2>
            <p>Sus datos personales serán tratados exclusivamente para las siguientes finalidades:</p>
            <ol>
              <li>Verificar su identidad como vecino del distrito</li>
              <li>Gestionar sus reportes de incidencias y alertas de emergencia</li>
              <li>Compartir su identidad ÚNICAMENTE con la Municipalidad de su distrito para la atención de incidentes</li>
              <li>Enviar notificaciones push sobre el estado de sus reportes</li>
              <li>Mejorar la seguridad ciudadana mediante análisis estadísticos anonimizados</li>
            </ol>
            <p><strong>Sus datos no serán difundidos a otros vecinos ni a terceros.</strong></p>

            <h2>4. Base Legal</h2>
            <p>
              El tratamiento de sus datos personales se fundamenta en su <strong>consentimiento libre, previo,
              expreso e informado</strong>, manifestado al marcar la casilla de aceptación durante el registro,
              conforme al artículo 5° de la Ley N° 29733.
            </p>

            <h2>5. Conservación de los Datos</h2>
            <p>
              Sus datos personales se conservarán mientras su cuenta esté activa. Una vez que solicite la
              eliminación de su cuenta o después de 2 años de inactividad, sus datos serán anonimizados
              y conservados únicamente con fines estadísticos.
            </p>

            <h2>6. Derechos ARCO (Acceso, Rectificación, Cancelación y Oposición)</h2>
            <p>
              Usted puede ejercer sus derechos ARCO en cualquier momento, de forma gratuita, mediante:
            </p>
            <ul>
              <li><strong>Desde la aplicación:</strong> Perfil → Configuración → Privacidad</li>
              <li><strong>Por correo electrónico:</strong> soporte@radarvecinal.pe</li>
            </ul>
            <p>
              Su solicitud será atendida en un plazo máximo de 20 días hábiles, conforme al reglamento
              de la Ley N° 29733.
            </p>

            <h2>7. Medidas de Seguridad</h2>
            <p>
              Implementamos medidas técnicas y organizativas adecuadas para proteger sus datos personales:
            </p>
            <ul>
              <li>Cifrado de contraseñas (bcrypt, 10 rondas)</li>
              <li>Tokens JWT con expiración (15 minutos)</li>
              <li>Conexiones cifradas (HTTPS/TLS)</li>
              <li>Aislamiento multi-tenant por distrito</li>
              <li>Registro de auditoría de accesos a datos sensibles</li>
            </ul>

            <h2>8. Transferencia de Datos</h2>
            <p>
              No realizamos transferencias internacionales de datos personales. Los datos se almacenan
              en servidores ubicados en Estados Unidos (Neon PostgreSQL, Cloudinary) con proveedores
              que cumplen con estándares internacionales de seguridad.
            </p>

            <h2>9. Contacto</h2>
            <p>
              Para cualquier consulta relacionada con el tratamiento de sus datos personales, puede
              contactarnos a través de:
            </p>
            <ul>
              <li>Email: soporte@radarvecinal.pe</li>
              <li>Desde la aplicación: Perfil → Soporte</li>
            </ul>
          </div>
        </div>
      </BrandingWrapper>
    </Layout>
  );
}
