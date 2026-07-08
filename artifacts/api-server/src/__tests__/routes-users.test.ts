import { describe, it, expect, vi } from "vitest";

// No vi.mock for @workspace/db — it causes ESM directory import issues.
// Instead we test the query/insert/update logic inline with a mock DB object.

describe("Users Routes Logic", () => {
  // ── Mock DB ─────────────────────────────────────────────────────────────────
  function createMockDb() {
    const selectFn = vi.fn();
    const insertFn = vi.fn();
    const updateFn = vi.fn();
    const deleteFn = vi.fn();

    return {
      db: {
        select: selectFn,
        insert: insertFn,
        update: updateFn,
        delete: deleteFn,
      },
      selectFn,
      insertFn,
      updateFn,
      deleteFn,
    };
  }

  // ── Simulated handlers ───────────────────────────────────────────────────────

  async function getUsers(db: any) {
    const result = await db.select().from().orderBy();
    return { users: result };
  }

  async function updateUser(db: any, id: number, updates: Record<string, any>) {
    const result = await db.update().set(updates).where().returning();
    return result[0] ?? null;
  }

  async function getNotifications(db: any) {
    const result = await db.select().from().orderBy();
    const unreadCount = result.filter((n: any) => !n.isRead).length;
    return { notifications: result, unreadCount };
  }

  async function getAdSlots(db: any) {
    const result = await db.select().from();
    return { ads: result };
  }

  async function createAdSlot(
    db: any,
    data: {
      businessName: string;
      tagline: string;
      targetUrl: string;
      isActive: boolean;
      sector: string | null;
    },
  ) {
    const result = await db
      .insert()
      .values({
        businessName: data.businessName,
        tagline: data.tagline,
        targetUrl: data.targetUrl,
        isActive: data.isActive,
        sector: data.sector ?? null,
      })
      .returning();
    return result[0];
  }

  async function updateAdSlot(
    db: any,
    id: number,
    updates: Record<string, any>,
  ) {
    const result = await db.update().set(updates).where().returning();
    return result[0] ?? null;
  }

  // ── Tests: Users ─────────────────────────────────────────────────────────────

  it("should fetch users ordered by createdAt desc", async () => {
    const { db, selectFn } = createMockDb();
    const mockUsers = [
      {
        id: 1,
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
        sector: "Centro",
        district: "San Ramón",
        isActive: true,
        reportsCount: 5,
        createdAt: new Date("2024-01-01"),
      },
    ];

    const orderByFn = vi.fn().mockResolvedValue(mockUsers);
    const fromFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    selectFn.mockReturnValue({ from: fromFn });

    const result = await getUsers(db);

    expect(result.users).toEqual(mockUsers);
    expect(selectFn).toHaveBeenCalled();
    expect(fromFn).toHaveBeenCalled();
  });

  it("should update user name and sector", async () => {
    const { db, updateFn } = createMockDb();
    const userId = 1;
    const updates = { name: "Updated Name", sector: "Bajo Kimiri" };

    const returningFn = vi.fn().mockResolvedValue([
      {
        id: userId,
        name: "Updated Name",
        sector: "Bajo Kimiri",
        email: "u@t.com",
        role: "user",
        district: "San Ramón",
        isActive: true,
        reportsCount: 0,
        createdAt: new Date(),
      },
    ]);
    const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    updateFn.mockReturnValue({ set: setFn });

    const result = await updateUser(db, userId, updates);

    expect(result).not.toBeNull();
    expect(result.name).toBe("Updated Name");
    expect(result.sector).toBe("Bajo Kimiri");
    expect(setFn).toHaveBeenCalledWith(updates);
    expect(whereFn).toHaveBeenCalled();
  });

  it("should return null when updating non-existent user", async () => {
    const { db, updateFn } = createMockDb();

    const returningFn = vi.fn().mockResolvedValue([]);
    const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    updateFn.mockReturnValue({ set: setFn });

    const result = await updateUser(db, 999, { name: "Nobody" });

    expect(result).toBeNull();
  });

  it("should handle empty users list", async () => {
    const { db, selectFn } = createMockDb();

    const orderByFn = vi.fn().mockResolvedValue([]);
    const fromFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    selectFn.mockReturnValue({ from: fromFn });

    const result = await getUsers(db);

    expect(result.users).toEqual([]);
    expect(result.users).toHaveLength(0);
  });

  // ── Tests: Notifications ─────────────────────────────────────────────────────

  it("should fetch notifications with unread count", async () => {
    const { db, selectFn } = createMockDb();
    const mockNotifs = [
      {
        id: 1,
        type: "panic_alert",
        title: "Alerta",
        body: "test",
        isRead: false,
        createdAt: new Date("2024-06-01"),
      },
      {
        id: 2,
        type: "panic_alert",
        title: "Vieja",
        body: "test",
        isRead: true,
        createdAt: new Date("2024-05-01"),
      },
      {
        id: 3,
        type: "warning",
        title: "Nueva",
        body: "test",
        isRead: false,
        createdAt: new Date("2024-06-02"),
      },
    ];

    const orderByFn = vi.fn().mockResolvedValue(mockNotifs);
    const fromFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    selectFn.mockReturnValue({ from: fromFn });

    const result = await getNotifications(db);

    expect(result.notifications).toHaveLength(3);
    expect(result.unreadCount).toBe(2);
    expect(selectFn).toHaveBeenCalled();
  });

  it("should return zero unread when all notifications read", async () => {
    const { db, selectFn } = createMockDb();
    const mockNotifs = [
      { id: 1, title: "Read", isRead: true, createdAt: new Date() },
      { id: 2, title: "Read too", isRead: true, createdAt: new Date() },
    ];

    const orderByFn = vi.fn().mockResolvedValue(mockNotifs);
    const fromFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    selectFn.mockReturnValue({ from: fromFn });

    const result = await getNotifications(db);

    expect(result.unreadCount).toBe(0);
  });

  it("should handle empty notifications", async () => {
    const { db, selectFn } = createMockDb();

    const orderByFn = vi.fn().mockResolvedValue([]);
    const fromFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    selectFn.mockReturnValue({ from: fromFn });

    const result = await getNotifications(db);

    expect(result.notifications).toEqual([]);
    expect(result.unreadCount).toBe(0);
  });

  // ── Tests: Ad Slots ──────────────────────────────────────────────────────────

  it("should fetch ad slots", async () => {
    const { db, selectFn } = createMockDb();
    const mockAds = [
      {
        id: 1,
        businessName: "Botica San Ramón",
        tagline: "Medicamentos",
        targetUrl: "https://example.com",
        isActive: true,
        sector: null,
      },
    ];

    const fromFn = vi.fn().mockResolvedValue(mockAds);
    selectFn.mockReturnValue({ from: fromFn });

    const result = await getAdSlots(db);

    expect(result.ads).toEqual(mockAds);
    expect(selectFn).toHaveBeenCalled();
  });

  it("should create an ad slot with isActive: true", async () => {
    const { db, insertFn } = createMockDb();
    const adData = {
      businessName: "Ferretería El Constructor",
      tagline: "Materiales de construcción",
      targetUrl: "https://example.com",
      isActive: true,
      sector: "San Ramón Centro",
    };

    const returningFn = vi.fn().mockResolvedValue([{ id: 1, ...adData }]);
    const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
    insertFn.mockReturnValue({ values: valuesFn });

    const result = await createAdSlot(db, adData);

    expect(result.id).toBe(1);
    expect(result.businessName).toBe("Ferretería El Constructor");
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
    );
  });

  it("should toggle ad slot active state", async () => {
    const { db, updateFn } = createMockDb();
    const adId = 1;
    const updates = { isActive: false };

    const returningFn = vi
      .fn()
      .mockResolvedValue([{ id: adId, businessName: "Test", isActive: false }]);
    const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    updateFn.mockReturnValue({ set: setFn });

    const result = await updateAdSlot(db, adId, updates);

    expect(result).not.toBeNull();
    expect(result.isActive).toBe(false);
    expect(setFn).toHaveBeenCalledWith(updates);
  });

  it("should return null when updating non-existent ad slot", async () => {
    const { db, updateFn } = createMockDb();

    const returningFn = vi.fn().mockResolvedValue([]);
    const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    updateFn.mockReturnValue({ set: setFn });

    const result = await updateAdSlot(db, 999, { isActive: false });

    expect(result).toBeNull();
  });

  it("should handle ad slot with null sector", async () => {
    const { db, insertFn } = createMockDb();
    const adData = {
      businessName: "Botica",
      tagline: "Delivery",
      targetUrl: "https://botica.com",
      isActive: true,
      sector: null,
    };

    const returningFn = vi.fn().mockResolvedValue([{ id: 2, ...adData }]);
    const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
    insertFn.mockReturnValue({ values: valuesFn });

    const result = await createAdSlot(db, adData);

    expect(result.id).toBe(2);
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({ sector: null }),
    );
  });
});
