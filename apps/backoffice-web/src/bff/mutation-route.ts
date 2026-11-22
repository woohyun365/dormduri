import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { BackofficeErrorCode } from '@repo/shared/backoffice';
import type { z } from 'zod';
import { callBackofficeApi } from './upstream';
import { BFF_ERROR_STATUS, type BffErrorCode } from './bff-errors';
import { checkMutationRequest } from './request-guard';
import { clearSessionCookie, SESSION_COOKIE_NAME, setSessionCookie } from './session-cookie';
import { SESSION_ACTIVITY_HEADER } from './session-activity';

/**
 * Every BFF route (`src/app/api/**`) is a POST built here (README §3). In order: the same-origin
 * guard, the path ids, the session cookie, the JSON body against the shared request schema, one
 * call to the backoffice API, the shared response schema, then the page's projection of the body
 * and the cookie. A refusal before the upstream call never reaches the backoffice API.
 */

const MAX_BODY_BYTES = 64 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const ENDED_SESSION_CODES: ReadonlySet<BackofficeErrorCode> = new Set([
  'session_required',
  'session_expired',
]);

type RouteParams = Record<string, string | string[] | undefined>;

export interface BffRouteContext {
  readonly params: Promise<RouteParams>;
}

/** What the page gets after a successful upstream call. */
export interface BffSuccess {
  /** JSON for the page; omitted means 204. */
  readonly body?: unknown;
  /** A new session token for the cookie (login, registration). */
  readonly issueSession?: string;
}

export interface BffMutationSpec<TBody, TUpstream> {
  /** Upstream path, built from the route's UUID params when it has any. */
  readonly upstream: string | ((params: Readonly<Record<string, string>>) => string);
  readonly params?: readonly string[];
  /** `public` routes send no token (login, registration); `session` routes need the cookie. */
  readonly access: 'public' | 'session';
  readonly body: z.ZodType<TBody> | null;
  readonly response: z.ZodType<TUpstream> | null;
  /** Projection for the page. The default passes the parsed body (or 204) through. */
  readonly onSuccess?: (data: TUpstream) => BffSuccess;
  /**
   * Logout: the cookie goes in every outcome. An already ended session counts as logged out (204);
   * when the API could not confirm it, the page gets the error and tells the operator.
   */
  readonly endsSession?: boolean;
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export function bffError(code: BffErrorCode, status?: number): NextResponse {
  const resolved =
    status ??
    (code in BFF_ERROR_STATUS ? BFF_ERROR_STATUS[code as keyof typeof BFF_ERROR_STATUS] : 400);
  return noStore(NextResponse.json({ error: { code } }, { status: resolved }));
}

async function readJsonBody<TBody>(
  request: NextRequest,
  schema: z.ZodType<TBody>,
): Promise<{ ok: true; value: TBody } | { ok: false; response: NextResponse }> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!/^application\/json(?:\s*;|$)/iu.test(contentType)) {
    return { ok: false, response: bffError('unsupported_media_type') };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return { ok: false, response: bffError('invalid_request', 400) };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, response: bffError('invalid_request', 400) };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, response: bffError('invalid_request', 400) };
  }
  return { ok: true, value: parsed.data };
}

async function resolveIds(
  context: BffRouteContext,
  names: readonly string[],
): Promise<Record<string, string> | null> {
  if (names.length === 0) {
    return {};
  }
  const params = await context.params;
  const ids: Record<string, string> = {};
  for (const name of names) {
    const value = params[name];
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
      return null;
    }
    ids[name] = value;
  }
  return ids;
}

export function bffMutation<TBody, TUpstream>(spec: BffMutationSpec<TBody, TUpstream>) {
  return async function POST(
    request: NextRequest,
    context: BffRouteContext,
  ): Promise<NextResponse> {
    if (!checkMutationRequest(request.headers).ok) {
      return bffError('forbidden_origin');
    }

    const ids = await resolveIds(context, spec.params ?? []);
    if (ids === null) {
      return bffError('not_found', 404);
    }

    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value || undefined;
    if (spec.access === 'session' && !token) {
      return spec.endsSession ? endedSession() : bffError('session_required', 401);
    }

    let body: TBody | undefined;
    if (spec.body) {
      const read = await readJsonBody(request, spec.body);
      if (!read.ok) {
        return read.response;
      }
      body = read.value;
    }

    const result = await callBackofficeApi({
      method: 'POST',
      path: typeof spec.upstream === 'function' ? spec.upstream(ids) : spec.upstream,
      token: spec.access === 'session' ? token : undefined,
      body,
      responseSchema: spec.response,
    });

    if (result.kind === 'unavailable' || result.kind === 'invalid') {
      const response = bffError(
        result.kind === 'unavailable' ? 'upstream_unavailable' : 'upstream_invalid',
      );
      if (spec.endsSession) {
        clearSessionCookie(response);
      }
      return response;
    }
    if (result.kind === 'error') {
      if (ENDED_SESSION_CODES.has(result.code)) {
        if (spec.endsSession) {
          return endedSession();
        }
        const response = bffError(result.code, result.status);
        clearSessionCookie(response);
        return response;
      }
      const response = bffError(result.code, result.status);
      if (spec.endsSession) {
        clearSessionCookie(response);
      } else if (token) {
        response.headers.set(SESSION_ACTIVITY_HEADER, '1');
      }
      return response;
    }

    if (spec.endsSession) {
      return endedSession();
    }
    const success = spec.onSuccess
      ? spec.onSuccess(result.data)
      : spec.response
        ? { body: result.data }
        : {};
    const response =
      success.body === undefined
        ? new NextResponse(null, { status: 204 })
        : NextResponse.json(success.body, { status: 200 });
    if (success.issueSession) {
      setSessionCookie(response, success.issueSession);
    }
    if (spec.access === 'session') {
      response.headers.set(SESSION_ACTIVITY_HEADER, '1');
    }
    return noStore(response);
  };
}

function endedSession(): NextResponse {
  const response = noStore(new NextResponse(null, { status: 204 }));
  clearSessionCookie(response);
  return response;
}
