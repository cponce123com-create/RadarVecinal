/**
 * Tareas de mantenimiento que corren dentro del propio servidor.
 *
 * Antes vivían en dos workers de BullMQ que necesitaban una base de datos Redis
 * externa (Upstash). Esa base dejó de existir y el servidor solo alcanzaba a
 * registrar `getaddrinfo ENOTFOUND` en bucle, sin poder ejecutar ninguna tarea.
 * Ahora las dos tareas usan temporizadores internos: sin servicio externo, sin
 * costo y sin credenciales que puedan vencer.
 *
 * Dos detalles de comportamiento deliberados:
 *
 *  - Los temporizadores solo avanzan mientras el proceso está despierto. En el
 *    plan gratuito de Render el servicio se duerme por inactividad, por eso el
 *    ciclo de escalado se ejecuta TAMBIÉN al arrancar: cada despertar deja al
 *    día los reportes vencidos y las alertas caducadas. Los recordatorios por
 *    correo, en cambio, NO se envían al arrancar, para no repetirlos cada vez
 *    que el servicio se despierta.
 *
 *  - Las alertas de pánico se expiran por `expiresAt` (2 horas), que es la vida
 *    útil declarada en la base y la misma regla que ya aplicaba el listado de
 *    alertas. El worker antiguo las apagaba a la hora, en desacuerdo con ella.
 */

import { db } from "@workspace/db";
import {
  panicAlertsTable,
  reportsTable,
  usersTable,
  districtsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, sql, gte, lt } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendStatusChangeEmail } from "../lib/email";

/** Reportes activos sin atender después de este tiempo pasan a "reviewing". */
export const STALE_REPORT_MS = 48 * 60 * 60 * 1000;

/** Ventana de reportes recientes que se cuenta para el recordatorio. */
export const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Reportes pendientes por distrito a partir de los cuales se avisa al admin. */
export const REMINDER_MIN_REPORTS = 5;

/** Cada cuánto corre cada tarea (antes: dos crons, horario y cada 4 horas). */
export const ESCALATION_INTERVAL_MS = 60 * 60 * 1000; // 1 hora
export const REMINDER_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 horas

/** Espera antes del primer ciclo, para no competir con el arranque del server. */
export const STARTUP_DELAY_MS = 15 * 1000;

/**
 * Subconjunto de la base de datos que necesitan estas tareas. Se declara aparte
 * para poder inyectar un doble en las pruebas sin tocar la base real.
 */
type MaintenanceClient = Pick<typeof db, "select" | "update">;

/**
 * Reportes activos de más de 48 h pasan a "reviewing" (revisión municipal).
 * @returns cuántos reportes se actualizaron.
 */
export async function escalateStaleReports(
  client: MaintenanceClient = db,
): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_REPORT_MS);

  const updated = await client
    .update(reportsTable)
    .set({ status: "reviewing" })
    .where(
      and(
        eq(reportsTable.status, "active"),
        lt(reportsTable.createdAt, cutoff),
      ),
    )
    .returning({ id: reportsTable.id });

  return updated.length;
}

/**
 * Desactiva las alertas de pánico vencidas (activas o en atención cuya
 * `expiresAt` ya pasó). Es la misma regla que aplica el listado de alertas, así
 * que ambas rutas quedan de acuerdo.
 * @returns cuántas alertas se expiraron.
 */
export async function expireStalePanicAlerts(
  client: MaintenanceClient = db,
): Promise<number> {
  const expired = await client
    .update(panicAlertsTable)
    .set({ status: "expired", isActive: false })
    .where(
      and(
        inArray(panicAlertsTable.status, ["active", "attending"]),
        lt(panicAlertsTable.expiresAt, new Date()),
      ),
    )
    .returning({ id: panicAlertsTable.id });

  return expired.length;
}

/**
 * Avisa por correo a los administradores de cada distrito con más de 5 reportes
 * activos en las últimas 24 h (máximo 5 destinatarios por distrito).
 * @returns cuántos distritos tenían pendientes.
 */
export async function remindAdminsOfPendingReports(
  client: MaintenanceClient = db,
): Promise<number> {
  const cutoff = new Date(Date.now() - REMINDER_WINDOW_MS);

  const districtsWithBacklog = await client
    .select({
      districtId: reportsTable.districtId,
      count: sql<number>`count(*)`,
    })
    .from(reportsTable)
    .where(
      and(
        eq(reportsTable.status, "active"),
        gte(reportsTable.createdAt, cutoff),
      ),
    )
    .groupBy(reportsTable.districtId)
    .having(sql`count(*) > ${REMINDER_MIN_REPORTS}`);

  for (const row of districtsWithBacklog) {
    const admins = await client
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
      })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.districtId, row.districtId),
          sql`${usersTable.role} IN ('admin', 'moderator', 'super_admin')`,
        ),
      )
      .limit(5);

    const [district] = await client
      .select({ name: districtsTable.name })
      .from(districtsTable)
      .where(eq(districtsTable.id, row.districtId))
      .limit(1);

    for (const admin of admins) {
      if (!admin.email) continue;
      // Un correo caído no debe cortar el ciclo: se registra y se sigue.
      sendStatusChangeEmail({
        to: admin.email,
        reportTitle: `Alerta: ${row.count} reportes pendientes en ${district?.name ?? "tu distrito"}`,
        reportId: 0,
        newStatus: "active",
        districtName: district?.name ?? "",
      }).catch((err) =>
        logger.error({ err }, "Maintenance: correo de recordatorio falló"),
      );
    }
  }

  return districtsWithBacklog.length;
}

/** Las tres tareas del ciclo, inyectables para poder probarlas aisladas. */
export interface MaintenanceTasks {
  escalate: () => Promise<number>;
  expirePanicAlerts: () => Promise<number>;
  remindAdmins: () => Promise<number>;
}

export const defaultMaintenanceTasks: MaintenanceTasks = {
  escalate: escalateStaleReports,
  expirePanicAlerts: expireStalePanicAlerts,
  remindAdmins: remindAdminsOfPendingReports,
};

let timers: NodeJS.Timeout[] = [];
let cycleRunning = false;

/**
 * Ejecuta un paso del ciclo capturando su propio error: si el escalado falla,
 * la expiración de alertas y los recordatorios igual se intentan. Ninguna tarea
 * debe tumbar el servidor ni bloquear a las demás.
 */
async function runStep(
  label: string,
  task: () => Promise<number>,
  onResult: (count: number) => void,
): Promise<void> {
  try {
    onResult(await task());
  } catch (err) {
    logger.error(
      { err, tarea: label },
      "Maintenance: la tarea falló — se continúa con las demás",
    );
  }
}

/** Ejecuta un ciclo completo, sin solapar ciclos ni dejar caer el proceso. */
async function runCycle(
  tasks: MaintenanceTasks,
  { includeReminders }: { includeReminders: boolean },
): Promise<void> {
  if (cycleRunning) {
    logger.warn("Maintenance: ciclo anterior aún en curso — se omite este");
    return;
  }
  cycleRunning = true;
  try {
    await runStep("escalado de reportes", tasks.escalate, (count) => {
      if (count > 0) {
        logger.info(
          { count },
          "Maintenance: reportes escalados a reviewing por SLA",
        );
      }
    });

    await runStep("expiración de alertas", tasks.expirePanicAlerts, (count) => {
      if (count > 0) {
        logger.info(
          { count },
          "Maintenance: alertas de pánico vencidas desactivadas",
        );
      }
    });

    if (includeReminders) {
      await runStep(
        "recordatorios a administradores",
        tasks.remindAdmins,
        (districts) => {
          if (districts > 0) {
            logger.info(
              { districts },
              "Maintenance: recordatorios enviados a administradores",
            );
          }
        },
      );
    }
  } finally {
    cycleRunning = false;
  }
}

/**
 * Arranca las tareas periódicas. Idempotente: llamarla dos veces no duplica
 * temporizadores. Los timers no retienen el proceso (`unref`), así que un
 * apagado limpio no se queda esperando a que disparen.
 */
export function startMaintenanceTasks(
  tasks: MaintenanceTasks = defaultMaintenanceTasks,
): void {
  if (timers.length > 0) return;

  // Primer ciclo: solo escalado y expiración (nunca correos).
  timers.push(
    setTimeout(() => {
      void runCycle(tasks, { includeReminders: false });
    }, STARTUP_DELAY_MS).unref(),
  );

  timers.push(
    setInterval(() => {
      void runCycle(tasks, { includeReminders: false });
    }, ESCALATION_INTERVAL_MS).unref(),
  );

  timers.push(
    setInterval(() => {
      void runCycle(tasks, { includeReminders: true });
    }, REMINDER_INTERVAL_MS).unref(),
  );

  logger.info(
    {
      escaladoCada: "1 h",
      recordatoriosCada: "4 h",
      primerCicloEn: `${STARTUP_DELAY_MS / 1000} s`,
    },
    "Maintenance: tareas programadas iniciadas (sin Redis)",
  );
}

/** Detiene las tareas periódicas (apagado limpio). */
export function stopMaintenanceTasks(): void {
  for (const timer of timers) {
    clearTimeout(timer);
    clearInterval(timer);
  }
  timers = [];
  cycleRunning = false;
}
