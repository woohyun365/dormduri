import { randomUUID } from 'node:crypto';
import type { AdminRole, AdminSessionScope } from '@repo/database/enums';
import type { BackofficePermission } from '@repo/shared/backoffice';

/** Session the global access guard resolved for this request. */
export interface AdminRequestSession {
  readonly sessionId: string;
  readonly accountId: string;
  readonly scope: AdminSessionScope;
  readonly roles: readonly AdminRole[];
  readonly permissions: ReadonlySet<BackofficePermission>;
  readonly reauthenticatedAt: Date | null;
  readonly absoluteExpiresAt: Date;
  readonly lastActivityAt: Date;
}

export type RequestHeaders = Readonly<Record<string, string | string[] | undefined>>;

/** The parts of the Node request the backoffice reads. */
export interface BackofficeRequest {
  readonly headers: RequestHeaders;
  backofficeRequestId?: string;
  adminSession?: AdminRequestSession;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
}

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/u;

/** The BFF sends `X-Request-Id`; a missing or malformed value gets a new id. */
export function resolveRequestId(request: BackofficeRequest): string {
  if (request.backofficeRequestId) {
    return request.backofficeRequestId;
  }
  const value = headerValue(request.headers, 'x-request-id');
  const requestId = value && REQUEST_ID.test(value) ? value : randomUUID();
  request.backofficeRequestId = requestId;
  return requestId;
}

export function headerValue(headers: RequestHeaders, name: string): string | undefined {
  const header = headers[name];
  return Array.isArray(header) ? header[0] : header;
}

/** Session token the BFF forwards from its `dormduri_bo_session` cookie (README §1). */
export function readBearerToken(request: Pick<BackofficeRequest, 'headers'>): string | null {
  const value = headerValue(request.headers, 'authorization');
  if (!value) {
    return null;
  }
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/u.exec(value.trim());
  return match?.[1] ?? null;
}
