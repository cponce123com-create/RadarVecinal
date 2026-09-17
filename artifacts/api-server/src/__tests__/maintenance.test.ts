import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ESCALATION_INTERVAL_MS,
  REMINDER_INTERVAL_MS,
  REMINDER_MIN_REPORTS,
  REMINDER_WINDOW_MS,
  STALE_REPORT_MS,
  STARTUP_DELAY_MS,
  escalateStaleReports,
  expireStalePanicAlerts,
  remindAdminsOfPendingReports,
  startMaintenanceTasks,
  stopMaintenanceTasks,
  type MaintenanceTasks,
} from "../workers/maintenance";
import { panicAlertsTable, reportsTable } from "@workspace/db/schema";

// Estas pruebas NO usan vi.mock("@workspace/db") — en este repo rompe las
// importaciones ESM del workspace. En su lugar se inyecta un doble de la base
// de datos con la misma forma que usa el código (update().set().where().
// returning() y select().from().where()...).

// ── Doble de la base de datos ────────────────────────────────────────────────
function createFakeDb(rows: {
  updated?: Array<{ id: number }>;
  backlog?: Array<{ districtId: number; count: number }>;
  admins?: Array<{ id: number; email: string | null; name: string | null }>;
  district?: Array<{ name: string }>;
}) {
  const returningFn = vi.fn().mockResolvedValue(rows.updated ?? []);
  const setFn = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: returningFn }) });
  const updateFn = vi.fn().mockReturnValue({ set: setFn });

  // Cada consulta select() devuelve una cadena encadenable distinta.
  const selectFn = vi
    .fn()
    .mockImplementationOnce(() => selectChain(rows.backlog ?? []))
    .mockImplementationOnce(() => selectChain(rows.admins ?? []))
    .mockImplementationOnce(() => selectChain(rows.district ?? []));

  return { db: { update: updateFn, select: selectFn }, updateFn, setFn, returningFn, selectFn };
}

function selectChain(result: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    having: vi.fn(() => Promise.resolve(result)),
    limit: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

// El tipo real de la base de datos es enorme; el doble solo necesita la forma
// que consume el código, así que se declara con la misma firma que el cliente.
type FakeDb = ReturnType<typeof createFakeDb>["db"];
const asClient = (fake: FakeDb) => fake as unknown as Parameters<typeof escalateStaleReports>[0];

function createFakeTasks(overrides: Partial<MaintenanceTasks> = {}): MaintenanceTasks {
  return {
    escalate: vi.fn().mockResolvedValue(0),
    expirePanicAlerts: vi.fn().mockResolvedValue(0),
    remindAdmins: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

afterEach(() => {
  stopMaintenanceTasks();
  vi.useRealTimers();
});

describe("Reglas de mantenimiento", () => {
  it("escala a 'reviewing' los reportes activos de más de 48 h", async () => {
    const fake = createFakeDb({ updated: [{ id: 1 }, { id: 2 }] });

    const count = await escalateStaleReports(asClient(fake.db));

    expect(count).toBe(2);
    expect(fake.updateFn).toHaveBeenCalledWith(reportsTable);
    expect(fake.setFn).toHaveBeenCalledWith({ status: "reviewing" });
    expect(STALE_REPORT_MS).toBe(48 * 60 * 60 * 1000);
  });

  it("no reporta cambios cuando no hay reportes vencidos", async () => {
    const fake = createFakeDb({ updated: [] });

    await expect(escalateStaleReports(asClient(fake.db))).resolves.toBe(0);
  });

  it("expira las alertas de pánico vencidas (activas o en atención)", async () => {
    const fake = createFakeDb({ updated: [{ id: 9 }] });

    const count = await expireStalePanicAlerts(asClient(fake.db));

    expect(count).toBe(1);
    expect(fake.updateFn).toHaveBeenCalledWith(panicAlertsTable);
    expect(fake.setFn).toHaveBeenCalledWith({ status: "expired", isActive: false });
  });

  it("avisa a los admins de cada distrito con más de 5 reportes recientes", async () => {
    const fake = createFakeDb({
      backlog: [{ districtId: 3, count: 7 }],
      admins: [{ id: 1, email: "admin@distrito.pe", name: "Admin" }],
      district: [{ name: "San Ramón" }],
    });

    const districts = await remindAdminsOfPendingReports(asClient(fake.db));

    expect(districts).toBe(1);
    expect(fake.selectFn).toHaveBeenCalledTimes(3); // backlog, admins, distrito
    expect(REMINDER_MIN_REPORTS).toBe(5);
    expect(REMINDER_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("no avisa a nadie si ningún distrito supera el umbral", async () => {
    const fake = createFakeDb({ backlog: [] });

    await expect(remindAdminsOfPendingReports(asClient(fake.db))).resolves.toBe(0);
    expect(fake.selectFn).toHaveBeenCalledTimes(1);
  });
});

describe("Programador interno (sin Redis)", () => {
  it("primer ciclo tras el retraso de arranque, sin correos", async () => {
    vi.useFakeTimers();
    const tasks = createFakeTasks();
    startMaintenanceTasks(tasks);

    await vi.advanceTimersByTimeAsync(STARTUP_DELAY_MS - 1);
    expect(tasks.escalate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(tasks.escalate).toHaveBeenCalledTimes(1);
    expect(tasks.expirePanicAlerts).toHaveBeenCalledTimes(1);
    expect(tasks.remindAdmins).not.toHaveBeenCalled();
  });

  it("repite el escalado cada hora y los recordatorios cada 4 horas", async () => {
    vi.useFakeTimers();
    const tasks = createFakeTasks();
    startMaintenanceTasks(tasks);

    await vi.advanceTimersByTimeAsync(STARTUP_DELAY_MS);
    expect(tasks.escalate).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(ESCALATION_INTERVAL_MS);
    expect(tasks.escalate).toHaveBeenCalledTimes(2);
    expect(tasks.remindAdmins).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(REMINDER_INTERVAL_MS - ESCALATION_INTERVAL_MS);
    expect(tasks.remindAdmins).toHaveBeenCalledTimes(1);
  });

  it("no duplica temporizadores si se arranca dos veces", async () => {
    vi.useFakeTimers();
    const tasks = createFakeTasks();
    startMaintenanceTasks(tasks);
    startMaintenanceTasks(tasks);

    await vi.advanceTimersByTimeAsync(STARTUP_DELAY_MS + ESCALATION_INTERVAL_MS);
    expect(tasks.escalate).toHaveBeenCalledTimes(2); // primer ciclo + 1 hora
  });

  it("no solapa ciclos si el anterior sigue en curso", async () => {
    vi.useFakeTimers();
    let release = () => {};
    const slow = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tasks = createFakeTasks({
      escalate: vi.fn(() => slow.then(() => 0)),
    });
    startMaintenanceTasks(tasks);

    await vi.advanceTimersByTimeAsync(STARTUP_DELAY_MS);
    expect(tasks.escalate).toHaveBeenCalledTimes(1);

    // El ciclo sigue abierto: el siguiente disparo debe omitirse.
    await vi.advanceTimersByTimeAsync(ESCALATION_INTERVAL_MS);
    expect(tasks.escalate).toHaveBeenCalledTimes(1);

    release();
    await vi.advanceTimersByTimeAsync(ESCALATION_INTERVAL_MS);
    expect(tasks.escalate).toHaveBeenCalledTimes(2);
  });

  it("un error en una tarea no detiene los siguientes ciclos", async () => {
    vi.useFakeTimers();
    const tasks = createFakeTasks({
      escalate: vi.fn().mockRejectedValue(new Error("base de datos caída")),
    });
    startMaintenanceTasks(tasks);

    await vi.advanceTimersByTimeAsync(STARTUP_DELAY_MS);
    expect(tasks.escalate).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(ESCALATION_INTERVAL_MS);
    expect(tasks.escalate).toHaveBeenCalledTimes(2);
    // El ciclo fallido no debe impedir la expiración de alertas del siguiente.
    expect(tasks.expirePanicAlerts).toHaveBeenCalled();
  });

  it("stop() detiene los temporizadores", async () => {
    vi.useFakeTimers();
    const tasks = createFakeTasks();
    startMaintenanceTasks(tasks);
    await vi.advanceTimersByTimeAsync(STARTUP_DELAY_MS);
    expect(tasks.escalate).toHaveBeenCalledTimes(1);

    stopMaintenanceTasks();
    await vi.advanceTimersByTimeAsync(ESCALATION_INTERVAL_MS * 3);
    expect(tasks.escalate).toHaveBeenCalledTimes(1);
    expect(tasks.remindAdmins).not.toHaveBeenCalled();
  });
});
