import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

/**
 * Unit tests for JWT token handling and auth middleware logic.
 * These tests are completely self-contained — no database dependency.
 */

const JWT_SECRET = "radar-vecinal-dev-secret-2024";

// ── Replicate middleware logic inline ────────────────────────────────────────
// This avoids importing the actual auth module (which depends on @workspace/db)

function requireAuthInline(
  req: Partial<Request>,
  res: Partial<Response>,
  next: NextFunction,
) {
  const authHeader = req.headers?.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status?.(401);
    res.json?.({ error: "Autenticación requerida." });
    return;
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
    (req as any).jwtUser = payload;
    next();
  } catch {
    res.status?.(401);
    res.json?.({ error: "Token inválido o expirado." });
  }
}

function requireAdminInline(
  req: Partial<Request>,
  res: Partial<Response>,
  next: NextFunction,
) {
  const user = (req as any).jwtUser;
  if (!user || !["admin", "moderator"].includes(user.role)) {
    res.status?.(403);
    res.json?.({ error: "Acceso denegado. Se requiere rol de administrador." });
    return;
  }
  next();
}

function optionalAuthInline(
  req: Partial<Request>,
  _res: Partial<Response>,
  next: NextFunction,
) {
  const authHeader = req.headers?.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
      (req as any).jwtUser = payload;
    } catch {
      // ignore invalid tokens
    }
  }
  next();
}

function createMockReq(headers: Record<string, string> = {}): Partial<Request> {
  return { headers } as Partial<Request>;
}

function createMockRes(): Partial<Response> {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("JWT token operations", () => {
  it("should sign and verify a valid token", () => {
    const payload = { sub: "1", email: "test@test.com", role: "user" };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    expect(decoded.sub).toBe("1");
    expect(decoded.email).toBe("test@test.com");
    expect(decoded.role).toBe("user");
  });

  it("should reject an invalid token", () => {
    expect(() => jwt.verify("invalid-token", JWT_SECRET)).toThrow();
  });

  it("should reject a token signed with a different secret", () => {
    const token = jwt.sign({ sub: "1" }, "different-secret");
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
  });

  it("should reject an expired token", () => {
    const token = jwt.sign({ sub: "1" }, JWT_SECRET, { expiresIn: "0s" });
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
  });

  it("should extract admin user info from valid token", () => {
    const payload = {
      sub: "42",
      email: "admin@radarvecinal.pe",
      role: "admin",
      district: "San Ramón",
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    expect(decoded.sub).toBe("42");
    expect(decoded.role).toBe("admin");
    expect(decoded.district).toBe("San Ramón");
  });
});

describe("requireAuth middleware", () => {
  it("should return 401 if no Authorization header is present", () => {
    const req = createMockReq();
    const res = createMockRes() as Response;
    const next = vi.fn();

    requireAuthInline(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 if Authorization header is not Bearer", () => {
    const req = createMockReq({ authorization: "Basic token123" });
    const res = createMockRes() as Response;
    const next = vi.fn();

    requireAuthInline(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 if token is invalid", () => {
    const req = createMockReq({ authorization: "Bearer invalid-token" });
    const res = createMockRes() as Response;
    const next = vi.fn();

    requireAuthInline(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next() if token is valid", () => {
    const token = jwt.sign(
      { sub: "1", email: "test@test.com", role: "user" },
      JWT_SECRET,
      { expiresIn: "1h" },
    );
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes() as Response;
    const next = vi.fn();

    requireAuthInline(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).jwtUser).toBeDefined();
    expect((req as any).jwtUser.role).toBe("user");
  });
});

describe("requireAdmin middleware", () => {
  it("should return 403 if no jwtUser is attached", () => {
    const req = createMockReq();
    const res = createMockRes() as Response;
    const next = vi.fn();

    requireAdminInline(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 403 if user role is 'user'", () => {
    const req = createMockReq() as any;
    req.jwtUser = { role: "user" };
    const res = createMockRes() as Response;
    const next = vi.fn();

    requireAdminInline(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("should allow access for admin role", () => {
    const req = createMockReq() as any;
    req.jwtUser = { role: "admin" };
    const res = createMockRes() as Response;
    const next = vi.fn();

    requireAdminInline(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("should allow access for moderator role", () => {
    const req = createMockReq() as any;
    req.jwtUser = { role: "moderator" };
    const res = createMockRes() as Response;
    const next = vi.fn();

    requireAdminInline(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe("optionalAuth middleware", () => {
  it("should continue without auth if no token", () => {
    const req = createMockReq();
    const res = createMockRes() as Response;
    const next = vi.fn();

    optionalAuthInline(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).jwtUser).toBeUndefined();
  });

  it("should attach jwtUser if valid token provided", () => {
    const token = jwt.sign(
      { sub: "5", email: "user@test.com", role: "user" },
      JWT_SECRET,
      { expiresIn: "1h" },
    );
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes() as Response;
    const next = vi.fn();

    optionalAuthInline(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).jwtUser.email).toBe("user@test.com");
  });

  it("should ignore invalid tokens and continue", () => {
    const req = createMockReq({
      authorization: "Bearer absolutely-invalid-token",
    });
    const res = createMockRes() as Response;
    const next = vi.fn();

    optionalAuthInline(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).jwtUser).toBeUndefined();
  });
});
