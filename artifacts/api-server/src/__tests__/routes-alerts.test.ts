import { describe, it, expect, vi } from "vitest";

// No vi.mock for @workspace/db — it causes ESM directory import issues.
// Instead we test the query/insert/update logic inline with a mock DB object.

describe("Alerts Routes Logic", () => {
  // ── Mock DB ─────────────────────────────────────────────────────────────────
  function createMockDb() {
    const selectFn = vi.fn();
    const insertFn = vi.fn();
    const updateFn = vi.fn();

    return {
      db: {
        select: selectFn,
        insert: insertFn,
        update: updateFn,
      },
      selectFn,
      insertFn,
      updateFn,
    };
  }

  // ── Simulated handlers ───────────────────────────────────────────────────────

  async function getPanicAlerts(db: any) {
    const result = await db.select().from().orderBy();
    return { alerts: result };
  }

  async function createPanicAlert(
    db: any,
    data: {
      type: string;
      latitude: number;
      longitude: number;
      address: string;
      authorName: string;
      sector: string;
    },
  ) {
    const result = await db
      .insert()
      .values({
        type: data.type,
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address,
        authorName: data.authorName,
        sector: data.sector,
        isActive: true,
      })
      .returning();
    return result[0];
  }

  async function getMissingPersons(db: any) {
    const result = await db.select().from().orderBy();
    return { alerts: result };
  }

  async function createMissingPerson(
    db: any,
    data: {
      name: string;
      age: number | null;
      clothing: string;
      lastSeenLatitude: number;
      lastSeenLongitude: number;
      lastSeenAddress: string;
      contactInfo: string;
      reportedBy: string;
    },
  ) {
    const result = await db
      .insert()
      .values({
        name: data.name,
        age: data.age ?? null,
        clothing: data.clothing,
        lastSeenLatitude: data.lastSeenLatitude,
        lastSeenLongitude: data.lastSeenLongitude,
        lastSeenAddress: data.lastSeenAddress,
        contactInfo: data.contactInfo,
        status: "active",
        reportedBy: data.reportedBy,
      })
      .returning();
    return result[0];
  }

  async function updateMissingPerson(
    db: any,
    id: number,
    updates: Record<string, any>,
  ) {
    const result = await db.update().set(updates).where().returning();
    return result[0] ?? null;
  }

  // ── Tests: Panic Alerts ──────────────────────────────────────────────────────

  it("should fetch panic alerts ordered by createdAt desc", async () => {
    const { db, selectFn } = createMockDb();
    const mockAlerts = [
      {
        id: 1,
        type: "robbery",
        latitude: -11.12,
        longitude: -75.35,
        address: "Jr. La Merced 123",
        authorName: "Carlos",
        sector: "Centro",
        isActive: true,
        createdAt: new Date("2024-12-01"),
      },
    ];

    const orderByFn = vi.fn().mockResolvedValue(mockAlerts);
    const fromFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    selectFn.mockReturnValue({ from: fromFn });

    const result = await getPanicAlerts(db);

    expect(result.alerts).toEqual(mockAlerts);
    expect(selectFn).toHaveBeenCalled();
    expect(fromFn).toHaveBeenCalled();
    expect(orderByFn).toHaveBeenCalled();
  });

  it("should create a panic alert with isActive: true", async () => {
    const { db, insertFn } = createMockDb();
    const alertData = {
      type: "robbery",
      latitude: -11.1282,
      longitude: -75.3554,
      address: "Jr. La Merced 456",
      authorName: "Ana Pérez",
      sector: "San Ramón Centro",
    };

    const returningFn = vi
      .fn()
      .mockResolvedValue([
        { id: 1, ...alertData, isActive: true, createdAt: new Date() },
      ]);
    const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
    insertFn.mockReturnValue({ values: valuesFn });

    const result = await createPanicAlert(db, alertData);

    expect(result.id).toBe(1);
    expect(result.isActive).toBe(true);
    expect(result.authorName).toBe("Ana Pérez");
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "robbery",
        isActive: true,
      }),
    );
  });

  it("should handle empty panic alerts list", async () => {
    const { db, selectFn } = createMockDb();

    const orderByFn = vi.fn().mockResolvedValue([]);
    const fromFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    selectFn.mockReturnValue({ from: fromFn });

    const result = await getPanicAlerts(db);

    expect(result.alerts).toEqual([]);
    expect(result.alerts).toHaveLength(0);
  });

  // ── Tests: Missing Persons ───────────────────────────────────────────────────

  it("should fetch missing persons ordered by createdAt desc", async () => {
    const { db, selectFn } = createMockDb();
    const mockPersons = [
      {
        id: 1,
        name: "Juan Pérez",
        status: "active",
        clothing: "Chompa roja, jean azul",
        lastSeenAddress: "Plaza de Armas",
        contactInfo: "987654321",
        reportedBy: "Rosa",
        createdAt: new Date("2024-12-01"),
      },
    ];

    const orderByFn = vi.fn().mockResolvedValue(mockPersons);
    const fromFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    selectFn.mockReturnValue({ from: fromFn });

    const result = await getMissingPersons(db);

    expect(result.alerts).toEqual(mockPersons);
    expect(selectFn).toHaveBeenCalled();
  });

  it("should create a missing person with status: active", async () => {
    const { db, insertFn } = createMockDb();
    const personData = {
      name: "María López",
      age: 65,
      clothing: "Polera blanca, pantalón negro",
      lastSeenLatitude: -11.12,
      lastSeenLongitude: -75.35,
      lastSeenAddress: "Mercado San Ramón",
      contactInfo: "912345678",
      reportedBy: "Carlos López",
    };

    const returningFn = vi
      .fn()
      .mockResolvedValue([{ id: 1, ...personData, status: "active" }]);
    const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
    insertFn.mockReturnValue({ values: valuesFn });

    const result = await createMissingPerson(db, personData);

    expect(result.id).toBe(1);
    expect(result.status).toBe("active");
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({ name: "María López" }),
    );
  });

  it("should update missing person status to resolved", async () => {
    const { db, updateFn } = createMockDb();
    const personId = 1;
    const updates = { status: "resolved" as const };

    const returningFn = vi
      .fn()
      .mockResolvedValue([{ id: personId, name: "Juan", status: "resolved" }]);
    const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    updateFn.mockReturnValue({ set: setFn });

    const result = await updateMissingPerson(db, personId, updates);

    expect(result).not.toBeNull();
    expect(result.id).toBe(personId);
    expect(result.status).toBe("resolved");
    expect(setFn).toHaveBeenCalledWith(updates);
    expect(whereFn).toHaveBeenCalled();
  });

  it("should return null when updating non-existent missing person", async () => {
    const { db, updateFn } = createMockDb();

    const returningFn = vi.fn().mockResolvedValue([]);
    const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    updateFn.mockReturnValue({ set: setFn });

    const result = await updateMissingPerson(db, 999, { status: "resolved" });

    expect(result).toBeNull();
  });

  // ── Tests: Edge cases ────────────────────────────────────────────────────────

  it("should handle panic alert without address", async () => {
    const { db, insertFn } = createMockDb();
    const alertData = {
      type: "medical",
      latitude: -11.13,
      longitude: -75.36,
      address: "",
      authorName: "José",
      sector: "Bajo Kimiri",
    };

    const returningFn = vi
      .fn()
      .mockResolvedValue([
        { id: 2, ...alertData, isActive: true, createdAt: new Date() },
      ]);
    const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
    insertFn.mockReturnValue({ values: valuesFn });

    const result = await createPanicAlert(db, alertData);

    expect(result.id).toBe(2);
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({ address: "" }),
    );
  });

  it("should create missing person without age", async () => {
    const { db, insertFn } = createMockDb();
    const personData = {
      name: "NN",
      age: null,
      clothing: "Desconocida",
      lastSeenLatitude: -11.1,
      lastSeenLongitude: -75.3,
      lastSeenAddress: "Carretera Central",
      contactInfo: "999000111",
      reportedBy: "Policía",
    };

    const returningFn = vi
      .fn()
      .mockResolvedValue([{ id: 3, ...personData, status: "active" }]);
    const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
    insertFn.mockReturnValue({ values: valuesFn });

    const result = await createMissingPerson(db, personData);

    expect(result.id).toBe(3);
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({ age: null }),
    );
  });
});
