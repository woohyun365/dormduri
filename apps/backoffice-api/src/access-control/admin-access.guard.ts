import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminSessionService } from '../admin-identity/session/admin-session.service.js';
import { isRecentlyReauthenticated } from '../admin-identity/session/session-policy.js';
import { BackofficeApiError } from '../platform/http/api-error.js';
import {
  readBearerToken,
  resolveRequestId,
  type AdminRequestSession,
  type BackofficeRequest,
} from '../platform/http/request-context.js';
import { Clock } from '../platform/time/clock.js';
import { ROUTE_ACCESS_METADATA, type RouteAccess } from './route-access.js';

/** Pure decision for one route and one resolved session (unit-tested without HTTP). */
export function assertRouteAccess(
  access: RouteAccess,
  session: AdminRequestSession,
  now: Date,
): void {
  if (session.scope === 'RECOVERY' && !(access.kind === 'session' && access.allowRecovery)) {
    throw new BackofficeApiError('recovery_scope');
  }
  if (access.kind === 'permission') {
    if (!access.anyOf.some((permission) => session.permissions.has(permission))) {
      throw new BackofficeApiError('permission_denied');
    }
  }
  if (
    access.kind !== 'public' &&
    access.reauthentication &&
    !isRecentlyReauthenticated(session.reauthenticatedAt, now)
  ) {
    throw new BackofficeApiError('reauthentication_required');
  }
}

/**
 * Global guard (default deny, README §4): a route without a declared access rule is refused, a public
 * route passes, and every other route needs a resolved session that satisfies its rule. The UI may
 * hide buttons from the permission list, but this guard decides.
 */
@Injectable()
export class AdminAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AdminSessionService) private readonly sessions: AdminSessionService,
    @Inject(Clock) private readonly clock: Clock,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const access = this.reflector.getAllAndOverride<RouteAccess | undefined>(
      ROUTE_ACCESS_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!access) {
      throw new BackofficeApiError('permission_denied', 'route declares no access rule');
    }
    if (access.kind === 'public') {
      return true;
    }
    const request = context.switchToHttp().getRequest<BackofficeRequest>();
    const token = readBearerToken(request);
    if (!token) {
      throw new BackofficeApiError('session_required');
    }
    const session = await this.sessions.resolve(token, resolveRequestId(request));
    assertRouteAccess(access, session, this.clock.now());
    request.adminSession = session;
    return true;
  }
}
