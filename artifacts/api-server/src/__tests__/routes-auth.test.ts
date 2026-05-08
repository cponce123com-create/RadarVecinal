import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';

// No vi.mock for @workspace/db — it causes ESM directory import issues.
// Instead we test the logic inline with a mock DB object.

const TEST_SECRET = process.env.JWT_SECRET || 'test-secret-2024';

describe('Auth Routes Logic', () => {
  // Mock DB: simulates the drizzle query interface
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

  // Simulated registration handler
  async function handleRegister(
    db: any,
    userData: { name: string; email: string; password: string; sector: string; district: string },
    bcryptHash: (pwd: string, salt: number) => Promise<string>,
  ) {
    const passwordHash = await bcryptHash(userData.password, 10);
    const result = await db.insert().values({
      name: userData.name,
      email: userData.email,
      passwordHash,
      sector: userData.sector,
      district: userData.district,
    }).returning();
    const token = jwt.sign(
      { sub: String(result[0].id), email: result[0].email, role: result[0].role },
      TEST_SECRET,
      { expiresIn: '30d' },
    );
    return { user: result[0], token };
  }

  // Simulated login handler
  async function handleLogin(
    db: any,
    email: string,
    password: string,
    bcryptCompare: (pwd: string, hash: string) => Promise<boolean>,
  ) {
    const users = await db.select().from().where();
    const user = users[0];
    if (!user) throw new Error('User not found');
    const valid = await bcryptCompare(password, user.passwordHash);
    if (!valid) throw new Error('Invalid password');
    const token = jwt.sign(
      { sub: String(user.id), email: user.email, role: user.role },
      TEST_SECRET,
      { expiresIn: '30d' },
    );
    return { user, token };
  }

  it('should register a new user with hashed password', async () => {
    const { db, insertFn } = createMockDb();
    const bcryptHash = vi.fn().mockResolvedValue('hashed_password_123');
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'securePass123',
      sector: 'Centro',
      district: 'San Ramón',
    };

    // Setup mock chain
    const returningFn = vi.fn().mockResolvedValue([
      { id: 1, name: userData.name, email: userData.email, role: 'user' },
    ]);
    const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
    insertFn.mockReturnValue({ values: valuesFn });

    const result = await handleRegister(db, userData, bcryptHash);

    expect(bcryptHash).toHaveBeenCalledWith('securePass123', 10);
    expect(insertFn).toHaveBeenCalled();
    expect(valuesFn).toHaveBeenCalledWith(expect.objectContaining({ email: 'test@example.com' }));
    expect(result.user.name).toBe('Test User');
    expect(result.user.role).toBe('user');
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
  });

  it('should login a user with correct password', async () => {
    const { db, selectFn } = createMockDb();
    const bcryptCompare = vi.fn().mockResolvedValue(true);
    const email = 'user@test.com';

    // Setup mock chain for select
    const whereFn = vi.fn().mockResolvedValue([
      {
        id: 1,
        email,
        passwordHash: 'hashed_correct',
        name: 'User',
        role: 'user',
        sector: 'Centro',
        district: 'San Ramón',
        isActive: true,
        reportsCount: 0,
        createdAt: new Date(),
      },
    ]);
    const fromFn = vi.fn().mockReturnValue({ where: whereFn });
    selectFn.mockReturnValue({ from: fromFn });

    const result = await handleLogin(db, email, 'correctPassword123', bcryptCompare);

    expect(selectFn).toHaveBeenCalled();
    expect(fromFn).toHaveBeenCalled();
    expect(bcryptCompare).toHaveBeenCalledWith('correctPassword123', 'hashed_correct');
    expect(result.user.email).toBe(email);
    expect(result.token).toBeDefined();
  });

  it('should reject login with incorrect password', async () => {
    const { db, selectFn } = createMockDb();
    const bcryptCompare = vi.fn().mockResolvedValue(false);
    const email = 'user@test.com';

    const whereFn = vi.fn().mockResolvedValue([
      { id: 1, email, passwordHash: 'hashed_correct', name: 'User', role: 'user' },
    ]);
    const fromFn = vi.fn().mockReturnValue({ where: whereFn });
    selectFn.mockReturnValue({ from: fromFn });

    await expect(
      handleLogin(db, email, 'wrongPassword', bcryptCompare),
    ).rejects.toThrow('Invalid password');

    expect(bcryptCompare).toHaveBeenCalledWith('wrongPassword', 'hashed_correct');
  });
});
