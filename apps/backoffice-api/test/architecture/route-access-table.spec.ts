import { RequestMethod, type DynamicModule, type Type } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BACKOFFICE_PERMISSIONS } from '../../src/access-control/permissions.js';
import {
  describeRouteAccess,
  ROUTE_ACCESS_METADATA,
  type RouteAccess,
} from '../../src/access-control/route-access.js';
import { BackofficeAppModule } from '../../src/app.module.js';
import { loadBackofficeSettings } from '../../src/platform/config/backoffice-settings.js';
import { BackofficeLogger } from '../../src/platform/observability/backoffice-logger.js';
import { SystemClock } from '../../src/platform/time/clock.js';

/**
 * Every route of the backoffice API and the access rule it declares (default deny, README §4). A new
 * route fails this test until it declares a rule and is added here, so no route opens silently.
 */
const EXPECTED_ROUTE_ACCESS: Record<string, string> = {
  'GET /health/live': 'public',
  'GET /health/ready': 'public',
  'GET /internal/metrics': 'public',
  'POST /auth/login/password': 'public',
  'POST /auth/login/passkey': 'public',
  'POST /auth/login/totp': 'public',
  'POST /auth/login/recovery-code': 'public',
  'POST /auth/registration/options': 'public',
  'POST /auth/registration': 'public',
  'GET /auth/session': 'session+recovery',
  'POST /auth/logout': 'session+recovery',
  'POST /auth/passkeys/options': 'session+recovery',
  'POST /auth/passkeys': 'session+recovery',
  'POST /auth/reauthentication/options': 'session',
  'POST /auth/reauthentication': 'session',
  'POST /auth/totp/confirm': 'session',
  'POST /auth/totp': 'session+reauth',
  'POST /auth/recovery-codes': 'session+reauth',
  'GET /accounts': 'admin:account:invite',
  'POST /accounts/invitations': 'admin:account:invite',
  'POST /accounts/invitations/:invitationId/revoke': 'admin:account:invite',
  'POST /accounts/:accountId/deactivate': 'admin:account:deactivate+reauth',
  'GET /access/roles': 'session',
  'GET /access/requests': 'admin:access:request|admin:access:approve',
  'POST /access/requests': 'admin:access:request+reauth',
  'POST /access/requests/:requestId/approve': 'admin:access:approve+reauth',
  'POST /access/requests/:requestId/reject': 'admin:access:approve+reauth',
  'POST /access/requests/:requestId/cancel': 'admin:access:request',
  'GET /audit/events': 'admin:audit:read',
  'POST /audit/reviews': 'admin:audit:review',
};

interface RouteEntry {
  readonly key: string;
  readonly access: RouteAccess | undefined;
}

function isDynamicModule(value: unknown): value is DynamicModule {
  return typeof value === 'object' && value !== null && 'module' in value;
}

function collectControllers(root: Type | DynamicModule, seen = new Set<unknown>()): Type[] {
  const moduleClass = isDynamicModule(root) ? root.module : root;
  const key = isDynamicModule(root) ? root : moduleClass;
  if (seen.has(key)) {
    return [];
  }
  seen.add(key);
  const read = (name: string) =>
    [
      ...((Reflect.getMetadata(name, moduleClass) as unknown[] | undefined) ?? []),
      ...(isDynamicModule(root)
        ? ((root as unknown as Record<string, unknown[]>)[name] ?? [])
        : []),
    ] as unknown[];
  const controllers = read(MODULE_METADATA.CONTROLLERS) as Type[];
  const imports = read(MODULE_METADATA.IMPORTS) as (Type | DynamicModule)[];
  return [...controllers, ...imports.flatMap((child) => collectControllers(child, seen))];
}

function joinPath(...parts: (string | undefined)[]): string {
  const joined = parts
    .flatMap((part) => (part ?? '').split('/'))
    .filter((segment) => segment !== '')
    .join('/');
  return `/${joined}`;
}

function routesOf(controller: Type): RouteEntry[] {
  const base = Reflect.getMetadata(PATH_METADATA, controller) as string | undefined;
  const classAccess = Reflect.getMetadata(ROUTE_ACCESS_METADATA, controller) as
    RouteAccess | undefined;
  const prototype = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor' && typeof prototype[name] === 'function')
    .flatMap((name) => {
      const handler = prototype[name] as object;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (method === undefined) {
        return [];
      }
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
      const access =
        (Reflect.getMetadata(ROUTE_ACCESS_METADATA, handler) as RouteAccess | undefined) ??
        classAccess;
      return [{ key: `${RequestMethod[method]} ${joinPath(base, path)}`, access }];
    });
}

function backofficeRoutes(): RouteEntry[] {
  const settings = loadBackofficeSettings({
    NODE_ENV: 'test',
    BACKOFFICE_DATABASE_URL: 'postgresql://route-table:unused@127.0.0.1:1/unused',
    BACKOFFICE_RETENTION_DATABASE_URL:
      'postgresql://route-table-retention:unused@127.0.0.1:1/unused',
    BACKOFFICE_TOTP_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  });
  const module = BackofficeAppModule.register({
    settings,
    clock: new SystemClock(),
    logger: new BackofficeLogger('error'),
  });
  return [...new Set(collectControllers(module))].flatMap(routesOf);
}

describe('backoffice route access table', () => {
  const routes = backofficeRoutes();

  it('gives every route an access rule (a route without one is refused at runtime)', () => {
    expect(routes.filter((route) => route.access === undefined).map((route) => route.key)).toEqual(
      [],
    );
  });

  it('matches the expected table route for route', () => {
    const actual = Object.fromEntries(
      routes.map((route) => [route.key, describeRouteAccess(route.access)]),
    );
    expect(actual).toEqual(EXPECTED_ROUTE_ACCESS);
    expect(routes).toHaveLength(Object.keys(EXPECTED_ROUTE_ACCESS).length);
  });

  it('accepts only contract permissions, never a restricted one', () => {
    const permissions = routes.flatMap((route) =>
      route.access?.kind === 'permission' ? route.access.anyOf : [],
    );
    for (const permission of permissions) {
      expect(BACKOFFICE_PERMISSIONS).toContain(permission);
      expect(permission.startsWith('admin:restricted:')).toBe(false);
    }
  });

  it('asks for a passkey re-authentication on approval, role requests and deactivation', () => {
    for (const key of [
      'POST /access/requests',
      'POST /access/requests/:requestId/approve',
      'POST /access/requests/:requestId/reject',
      'POST /accounts/:accountId/deactivate',
    ]) {
      expect(EXPECTED_ROUTE_ACCESS[key], key).toMatch(/\+reauth$/u);
    }
  });
});
