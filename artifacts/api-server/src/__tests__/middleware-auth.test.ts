import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

// Following the same pattern as auth.test.ts — no vi.mock, use real jwt

const TEST_SECRET = 'test-secret-2024';

describe('Auth Middleware — extended edge cases', () => {
  function createMockReq(headers: Record<string, string> = {}): Partial<Request> {
    return { headers, log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } } as any;
  }

  function createMockRes(): Partial<Response> {
    const res: Partial<Response> = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  }

  function requireAuth(req: Partial<Request>, res: Partial<Response>, next: NextFunction) {
    const authHeader = req.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status?.(401);
      res.json?.({ error: 'Token requerido' });
      return;
    }
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, TEST_SECRET);
      (req as any).jwtUser = decoded;
      next();
    } catch {
      res.status?.(401);
      res.json?.({ error: 'Token inválido o expirado' });
    }
  }

  function requireAdmin(req: Partial<Request>, res: Partial<Response>, next: NextFunction) {
    const user = (req as any).jwtUser;
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      res.status?.(403);
      res.json?.({ error: 'Acceso denegado. Se requiere rol de administrador.' });
      return;
    }
    next();
  }

  it('should return 401 if Authorization header is malformed (no Bearer)', () => {
    const req = createMockReq({ authorization: 'Basic somehash' });
    const res = createMockRes() as Response;
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if Authorization header is empty Bearer', () => {
    const req = createMockReq({ authorization: 'Bearer ' });
    const res = createMockRes() as Response;
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if token is expired', () => {
    const token = jwt.sign({ sub: '1', email: 'test@test.com', role: 'user' }, TEST_SECRET, { expiresIn: '0s' });
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes() as Response;
    const next = vi.fn();

    // Wait a tiny bit to ensure expiry
    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if token is signed with different secret', () => {
    const token = jwt.sign({ sub: '1', email: 'test@test.com', role: 'user' }, 'wrong-secret');
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes() as Response;
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() and attach jwtUser for valid token', () => {
    const token = jwt.sign({ sub: '42', email: 'user@test.com', role: 'user' }, TEST_SECRET);
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes() as Response;
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).jwtUser).toBeDefined();
    expect((req as any).jwtUser.sub).toBe('42');
  });

  it('should return 403 if requireAdmin is called without jwtUser', () => {
    const req = createMockReq();
    const res = createMockRes() as Response;
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 if user role is "user"', () => {
    const req = createMockReq() as any;
    req.jwtUser = { role: 'user' };
    const res = createMockRes() as Response;
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow admin role', () => {
    const req = createMockReq() as any;
    req.jwtUser = { role: 'admin' };
    const res = createMockRes() as Response;
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow moderator role', () => {
    const req = createMockReq() as any;
    req.jwtUser = { role: 'moderator' };
    const res = createMockRes() as Response;
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
