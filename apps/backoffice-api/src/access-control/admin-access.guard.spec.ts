import { Controller, Get, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import type { AdminSessionService } from '../admin-identity/session/admin-session.service.js';
import type { AdminRequestSession } from '../platform/http/request-context.js';
import { SystemClock } from '../platform/time/clock.js';
import { AdminAccessGuard, assertRouteAccess } from './admin-access.guard.js';
import { permissionsForRoles } from './permissions.js';
import { PublicRoute, RequirePermission, SessionRoute, type RouteAccess } from './route-access.js';

const NOW = new Date('2026-11-21T00:00:00.000Z');

function session(overrides: Partial<AdminRequestSession> = {}): AdminRequestSession {
  return {
    sessionId: 'session',
    accountId: 'account',
    scope: 'FULL',
    roles: ['OWNER'],
    permissions: permissionsForRoles(['OWNER']),
    reauthenticatedAt: null,
    absoluteExpiresAt: new Date(NOW.getTime() + 3_600_000),
    lastActivityAt: NOW,
    ...overrides,
  };
}

const approve: RouteAccess = {
  kind: 'permission',
  anyOf: ['admin:access:approve'],
  reauthentication: true,
};

describe('route access decision', () => {
  it('refuses a recovery-scope session on every route that does not admit recovery', () => {
    const recovery = session({ scope: 'RECOVERY', permissions: new Set() });
    expect(() => assertRouteAccess(approve, recovery, NOW)).toThrow('recovery_scope');
    expect(() =>
      assertRouteAccess(
        { kind: 'session', allowRecovery: false, reauthentication: false },
        recovery,
        NOW,
      ),
    ).toThrow('recovery_scope');
    expect(() =>
      assertRouteAccess(
        { kind: 'session', allowRecovery: true, reauthentication: false },
        recovery,
        NOW,
      ),
    ).not.toThrow();
  });

  it('refuses a permission the session roles do not grant', () => {
    expect(() =>
      assertRouteAccess(
        approve,
        session({ roles: ['AUDITOR'], permissions: permissionsForRoles(['AUDITOR']) }),
        NOW,
      ),
    ).toThrow('permission_denied');
  });

  it('needs a passkey re-authentication within five minutes where the route asks for it', () => {
    expect(() => assertRouteAccess(approve, session(), NOW)).toThrow('reauthentication_required');
    expect(() =>
      assertRouteAccess(
        approve,
        session({ reauthenticatedAt: new Date(NOW.getTime() - 4 * 60_000) }),
        NOW,
      ),
    ).not.toThrow();
    expect(() =>
      assertRouteAccess(
        approve,
        session({ reauthenticatedAt: new Date(NOW.getTime() - 5 * 60_000) }),
        NOW,
      ),
    ).toThrow('reauthentication_required');
  });
});

@Controller('fixture')
class FixtureController {
  @Get('undeclared')
  undeclared() {
    return 'open';
  }

  @Get('public')
  @PublicRoute()
  open() {
    return 'open';
  }

  @Get('audit')
  @RequirePermission('admin:audit:read')
  audit() {
    return 'audit';
  }

  @Get('session')
  @SessionRoute()
  current() {
    return 'session';
  }
}

function contextFor(handler: keyof FixtureController, headers: Record<string, string> = {}) {
  const request: { headers: Record<string, string>; adminSession?: AdminRequestSession } = {
    headers,
  };
  const context = {
    getHandler: () =>
      Object.getOwnPropertyDescriptor(FixtureController.prototype, handler)?.value as object,
    getClass: () => FixtureController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('AdminAccessGuard (default deny)', () => {
  const token = 'a'.repeat(43);
  const resolve = vi.fn<AdminSessionService['resolve']>();
  const guard = new AdminAccessGuard(
    new Reflector(),
    { resolve } as unknown as AdminSessionService,
    new SystemClock(),
  );

  it('refuses a route that declares no access rule, even with a valid session', async () => {
    resolve.mockResolvedValue(session());
    const { context } = contextFor('undeclared', { authorization: `Bearer ${token}` });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'permission_denied' });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('lets a public route through without a session', async () => {
    await expect(guard.canActivate(contextFor('open').context)).resolves.toBe(true);
  });

  it('needs a bearer session token on every other route', async () => {
    await expect(guard.canActivate(contextFor('current').context)).rejects.toThrow(
      'session_required',
    );
    await expect(
      guard.canActivate(contextFor('current', { authorization: 'Bearer short' }).context),
    ).rejects.toThrow('session_required');
  });

  it('attaches the resolved session and checks the permission', async () => {
    resolve.mockResolvedValue(
      session({ roles: ['AUDITOR'], permissions: permissionsForRoles(['AUDITOR']) }),
    );
    const allowed = contextFor('audit', { authorization: `Bearer ${token}` });
    await expect(guard.canActivate(allowed.context)).resolves.toBe(true);
    expect(allowed.request.adminSession?.roles).toEqual(['AUDITOR']);

    resolve.mockResolvedValue(session({ roles: [], permissions: new Set() }));
    await expect(
      guard.canActivate(contextFor('audit', { authorization: `Bearer ${token}` }).context),
    ).rejects.toThrow('permission_denied');
  });
});
