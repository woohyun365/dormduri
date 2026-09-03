import { describe, expect, it, vi } from 'vitest';
import { RequestMethod } from '@nestjs/common';

vi.mock('../../../src/generated/prisma/sql.js', () => {
  const typedSqlFactory = vi.fn(() => ({}));
  return {
    acquireTransactionAdvisoryLock: typedSqlFactory,
    claimChatRealtimeOutboxEvents: typedSqlFactory,
    claimNotificationOutboxEvents: typedSqlFactory,
    claimRetentionArchiveJobs: typedSqlFactory,
    claimRetentionReviewJobs: typedSqlFactory,
    disposeDueRetentionAccessLogs: typedSqlFactory,
    findChatRealtimeOutboxRecipients: typedSqlFactory,
    findChatRealtimeReplayCursor: typedSqlFactory,
    findChatRealtimeReplayEvents: typedSqlFactory,
    getActiveLoginLock: typedSqlFactory,
    getActiveVerificationRecord: typedSqlFactory,
    getCurrentTimestamp: typedSqlFactory,
    getDatabaseReadiness: typedSqlFactory,
    getVerificationBackstopRetryAfterSeconds: typedSqlFactory,
    getVerificationRetryAfterSeconds: typedSqlFactory,
    lockActiveMatchRow: typedSqlFactory,
    lockMatchRequestRow: typedSqlFactory,
    markVerificationCodeVerified: typedSqlFactory,
    pruneExpiredAuthSessions: typedSqlFactory,
    pruneExpiredChatRealtimeOutboxEvents: typedSqlFactory,
    pruneExpiredVerificationCodes: typedSqlFactory,
    pruneOldAuthSecurityEvents: typedSqlFactory,
    pruneOldLoginAttempts: typedSqlFactory,
    pruneOldVerificationCodeRequestLogs: typedSqlFactory,
    recordLoginFailure: typedSqlFactory,
    recordVerificationCodeFailure: typedSqlFactory,
  };
});

import {
  AuthController,
  AUTH_ACCESS_METADATA_KEY,
  AUTH_REQUIRED_CAPABILITIES_METADATA_KEY,
  expectedRoutes,
  type AccessMode,
  type ExpectedRoute,
} from './auth-access-route-matrix.fixture.js';

const NEST_CONTROLLER_PATH_METADATA = 'path';
const NEST_ROUTE_PATH_METADATA = 'path';
const NEST_ROUTE_METHOD_METADATA = 'method';

function normalizePath(basePath: string, routePath: string | string[] | undefined) {
  const route = Array.isArray(routePath) ? routePath.join('|') : (routePath ?? '');
  return [basePath, route]
    .map((segment) => segment.replace(/^\/+|\/+$/g, ''))
    .filter((segment) => segment.length > 0)
    .join('/')
    .replace(/\/+/g, '/');
}

function getActualRoutes(controllers: Array<ExpectedRoute['controller']>) {
  return controllers.flatMap((controller) => {
    const basePath = Reflect.getMetadata(NEST_CONTROLLER_PATH_METADATA, controller) as string;
    const prototype = getControllerPrototype(controller);
    return Object.getOwnPropertyNames(prototype)
      .filter((handler) => handler !== 'constructor')
      .map((handler) => {
        const methodRef = prototype[handler];
        if (!methodRef) {
          return null;
        }
        const method = Reflect.getMetadata(NEST_ROUTE_METHOD_METADATA, methodRef) as
          RequestMethod | undefined;
        const path = Reflect.getMetadata(NEST_ROUTE_PATH_METADATA, methodRef) as
          string | string[] | undefined;

        if (method === undefined) {
          return null;
        }

        return {
          controller,
          handler,
          method,
          path: normalizePath(basePath, path),
        };
      })
      .filter((route): route is NonNullable<typeof route> => route !== null);
  });
}

function resolveAccess(
  controller: ExpectedRoute['controller'],
  handler: string,
): AccessMode | null {
  const methodRef = getRouteHandler(controller, handler);
  return (
    (Reflect.getMetadata(AUTH_ACCESS_METADATA_KEY, methodRef) as AccessMode | undefined) ??
    (Reflect.getMetadata(AUTH_ACCESS_METADATA_KEY, controller) as AccessMode | undefined) ??
    null
  );
}

function resolveCapabilities(controller: ExpectedRoute['controller'], handler: string) {
  const methodRef = getRouteHandler(controller, handler);
  return [
    ...((Reflect.getMetadata(AUTH_REQUIRED_CAPABILITIES_METADATA_KEY, controller) as
      string[] | undefined) ?? []),
    ...((Reflect.getMetadata(AUTH_REQUIRED_CAPABILITIES_METADATA_KEY, methodRef) as
      string[] | undefined) ?? []),
  ];
}

function getControllerPrototype(controller: ExpectedRoute['controller']) {
  return controller.prototype as unknown as Record<string, object | undefined>;
}

function getRouteHandler(controller: ExpectedRoute['controller'], handler: string): object {
  const methodRef = getControllerPrototype(controller)[handler];
  if (!methodRef) {
    throw new Error(`Expected route handler ${controller.name}.${handler}`);
  }
  return methodRef;
}

describe('Auth access route matrix', () => {
  it('모든 HTTP route는 public/optional/protected matrix에 고정된다', () => {
    const controllers = [...new Set(expectedRoutes.map((route) => route.controller))];
    const actualRoutes = getActualRoutes(controllers);

    expect(
      actualRoutes.map((route) => `${route.method} ${route.path}#${route.handler}`).sort(),
    ).toEqual(
      expectedRoutes.map((route) => `${route.method} ${route.path}#${route.handler}`).sort(),
    );

    for (const route of expectedRoutes) {
      expect(resolveAccess(route.controller, route.handler)).toBe(route.access);
      expect(resolveCapabilities(route.controller, route.handler)).toEqual(
        route.capabilities ?? [],
      );
    }
  });

  it('AuthController는 class-level public 없이 모든 route에 access mode를 직접 선언한다', () => {
    expect(Reflect.getOwnMetadata(AUTH_ACCESS_METADATA_KEY, AuthController)).toBeUndefined();

    const authRoutes = getActualRoutes([AuthController]);
    for (const route of authRoutes) {
      const handler = getRouteHandler(AuthController, route.handler);
      expect(Reflect.getOwnMetadata(AUTH_ACCESS_METADATA_KEY, handler)).toBeDefined();
    }
  });
});
