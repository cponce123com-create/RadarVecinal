import { Layout } from "@/components/Layout";
import BrandingWrapper from "@/components/BrandingWrapper";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function Terms() {
  return (
    <Layout>
      <BrandingWrapper>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/configuracion" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" />
            Volver a Configuración
          </Link>

          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h1>Términos y Condiciones de Uso</h1>
            <p className="text-muted-foreground text-sm">
              Última actualización: julio 2026
            </p>
            <hr />

            <h2>1. Aceptación de los Términos</h2>
            <p>
              Al registrarse y utilizar Radar Vecinal (en adelante, "la Plataforma"), usted acepta
              los presentes términos y condiciones. Si no está de acuerdo con alguno de ellos,
              no debe utilizar la Plataforma.
            </p>

            <h2>2. Descripción del Servicio</h2>
            <p>
              Radar Vecinal es una plataforma de seguridad ciudadana que permite a los vecinos:
            </p>
            <ul>
              <li>Reportar incidencias de seguridad en su distrito</li>
              <li>Enviar alertas de pánico en situaciones de emergencia</li>
              <li>Recibir notificaciones de la Municipalidad sobre el estado de sus reportes</li>
              <li>Visualizar un mapa de incidencias en tiempo real</li>
              <li>Confirmar la resolución de problemas en su comunidad</li>
            </ul>

            <h2>3. Responsabilidades del Usuario</h2>
            <p>Como usuario de la Plataforma, usted se compromete a:</p>
            <ul>
              <li>Proporcionar información veraz y actualizada</li>
              <li><strong>No reportar incidentes falsos</strong> — esto constituye una falta grave</li>
              <li>No suplantar la identidad de otras personas</li>
              <li>No utilizar la Plataforma para fines ilegales o no autorizados</li>
              <li>Mantener la confidencialidad de sus credenciales de acceso</li>
            </ul>

            <h2>4. Consecuencias del Uso Indebido</h2>
            <p>El incumplimiento de estos términos puede resultar en:</p>
            <ul>
              <li><strong>Strike 1:</strong> Advertencia y reducción de TrustScore</li>
              <li><strong>Strike 2:</strong> Suspensión temporal de la cuenta por 7 días</li>
              <li><strong>Strike 3+:</strong> Suspensión permanente de la cuenta</li>
              <li>Denuncia ante las autoridades competentes en caso de reportes falsos que generen
                  movilización innecesaria de servicios de emergencia</li>
            </ul>

            <h2>5. Limitación de Responsabilidad</h2>
            <p>
              La Plataforma se proporciona "tal cual" y "según disponibilidad". La Municipalidad
              no garantiza que:
            </p>
            <ul>
              <li>El servicio sea ininterrumpido o libre de errores</li>
              <li>Los reportes sean atendidos en un plazo específico</li>
              <li>La información proporcionada por otros usuarios sea precisa</li>
            </ul>

            <h2>6. Modificaciones</h2>
            <p>
              Nos reservamos el derecho de modificar estos términos en cualquier momento.
              Los cambios serán notificados a través de la Plataforma y, si continúa utilizando
              el servicio después de la notificación, se considerará que acepta los cambios.
            </p>

            <h2>7. Ley Aplicable</h2>
            <p>
              Estos términos se rigen por las leyes de la República del Perú. Cualquier disputa
              será sometida a la jurisdicción de los tribunales del distrito correspondiente.
            </p>

            <h2>8. Contacto</h2>
            <p>
              Para consultas sobre estos términos, contáctenos en soporte@radarvecinal.pe
            </p>
          </div>
        </div>
      </BrandingWrapper>
    </Layout>
  );
}
