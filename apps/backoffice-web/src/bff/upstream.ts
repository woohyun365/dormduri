import 'server-only';
import { randomUUID } from 'node:crypto';
import { backofficeErrorResponseSchema, type BackofficeErrorCode } from '@repo/shared/backoffice';
import type { z } from 'zod';

/**
 * The one client of the backoffice API (README §1). BFF routes and server component reads both call
 * it; the browser never does. Every call is `no-store`, carries the session token as a bearer and a
 * fresh request id, and gives up after a fixed time.
 */

const UPSTREAM_TIMEOUT_MS = 10_000;
const DEVELOPMENT_API_URL = 'http://127.0.0.1:4310';

export type UpstreamResult<T> =
  | { readonly kind: 'ok'; readonly data: T }
  | { readonly kind: 'error'; readonly status: number; readonly code: BackofficeErrorCode }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'invalid' };

export interface UpstreamRequest<T> {
  readonly method: 'GET' | 'POST';
  /** A fixed path of the backoffice API (callers validate any id they put in it). */
  readonly path: string;
  readonly token?: string;
  readonly body?: unknown;
  readonly query?: URLSearchParams;
  /** Schema of a 200 body, or `null` for a 204 route. */
  readonly responseSchema: z.ZodType<T> | null;
}

/**
 * `BACKOFFICE_API_URL` is the internal address of the backoffice API (an internal docker network in
 * production, README §4). Outside production it falls back to the local default port.
 */
export function backofficeApiBaseUrl(env: NodeJS.ProcessEnv = process.env): URL {
  const raw =
    env.BACKOFFICE_API_URL ?? (env.NODE_ENV === 'production' ? undefined : DEVELOPMENT_API_URL);
  if (!raw) {
    throw new Error('BACKOFFICE_API_URL is required in production');
  }
  const url = new URL(raw);
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    (url.pathname !== '/' && url.pathname !== '')
  ) {
    throw new Error(
      'BACKOFFICE_API_URL must be an http(s) origin without path, query or credentials',
    );
  }
  return url;
}

function logUpstreamFailure(
  kind: 'unavailable' | 'invalid',
  method: string,
  path: string,
  requestId: string,
) {
  // Path ids and bodies stay out of the log; the request id joins this line to the API's log.
  process.stderr.write(
    `${JSON.stringify({
      level: 'warn',
      event: 'backoffice_bff_upstream_failed',
      kind,
      method,
      route: path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gu, ':id'),
      requestId,
    })}\n`,
  );
}

export async function callBackofficeApi<T>(
  request: UpstreamRequest<T>,
): Promise<UpstreamResult<T>> {
  const requestId = randomUUID();
  const url = new URL(request.path, backofficeApiBaseUrl());
  if (request.query) {
    url.search = request.query.toString();
  }
  const headers: Record<string, string> = { accept: 'application/json', 'x-request-id': requestId };
  if (request.token) {
    headers.authorization = `Bearer ${request.token}`;
  }
  if (request.body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: request.method,
      headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    logUpstreamFailure('unavailable', request.method, request.path, requestId);
    return { kind: 'unavailable' };
  }

  if (response.status === 204 && request.responseSchema === null) {
    return { kind: 'ok', data: undefined as T };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    logUpstreamFailure('invalid', request.method, request.path, requestId);
    return { kind: 'invalid' };
  }

  if (response.ok) {
    const parsed = request.responseSchema?.safeParse(body);
    if (!parsed?.success || response.status !== 200) {
      logUpstreamFailure('invalid', request.method, request.path, requestId);
      return { kind: 'invalid' };
    }
    return { kind: 'ok', data: parsed.data };
  }

  const error = backofficeErrorResponseSchema.safeParse(body);
  if (!error.success) {
    logUpstreamFailure('invalid', request.method, request.path, requestId);
    return { kind: 'invalid' };
  }
  return { kind: 'error', status: response.status, code: error.data.error.code };
}
