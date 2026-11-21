import { SetMetadata } from '@nestjs/common';
import type { BackofficePermission } from '@repo/shared/backoffice';

export const ROUTE_ACCESS_METADATA = 'dormduri:backoffice:route-access';

/**
 * Every route declares one access rule; the global guard denies a route that declares none
 * (default deny, README §4). The route access table test lists every route and its rule.
 *
 * - `public`: no session (login, registration, health, metrics behind its own token).
 * - `session`: any active session; `allowRecovery` also admits a recovery-scope session.
 * - `permission`: a full session whose roles grant one of `anyOf`; `reauthentication` also needs
 *   a passkey re-authentication in the last five minutes (OA-R4).
 */
export type RouteAccess =
  | { readonly kind: 'public' }
  | {
      readonly kind: 'session';
      readonly allowRecovery: boolean;
      readonly reauthentication: boolean;
    }
  | {
      readonly kind: 'permission';
      readonly anyOf: readonly BackofficePermission[];
      readonly reauthentication: boolean;
    };

export const PublicRoute = () =>
  SetMetadata(ROUTE_ACCESS_METADATA, { kind: 'public' } satisfies RouteAccess);

export const SessionRoute = (
  options: { allowRecovery?: boolean; reauthentication?: boolean } = {},
) =>
  SetMetadata(ROUTE_ACCESS_METADATA, {
    kind: 'session',
    allowRecovery: options.allowRecovery ?? false,
    reauthentication: options.reauthentication ?? false,
  } satisfies RouteAccess);

export const RequirePermission = (
  anyOf: BackofficePermission | readonly BackofficePermission[],
  options: { reauthentication?: boolean } = {},
) =>
  SetMetadata(ROUTE_ACCESS_METADATA, {
    kind: 'permission',
    anyOf: typeof anyOf === 'string' ? [anyOf] : [...anyOf],
    reauthentication: options.reauthentication ?? false,
  } satisfies RouteAccess);

export function describeRouteAccess(access: RouteAccess | undefined): string {
  if (!access) {
    return 'none';
  }
  switch (access.kind) {
    case 'public':
      return 'public';
    case 'session':
      return `session${access.allowRecovery ? '+recovery' : ''}${access.reauthentication ? '+reauth' : ''}`;
    case 'permission':
      return `${access.anyOf.join('|')}${access.reauthentication ? '+reauth' : ''}`;
  }
}
