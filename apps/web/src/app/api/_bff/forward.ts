import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveAuthCookieNames } from '@/config/auth-cookie.config';
import { getWebEnv } from '@/config/env';
import {
  buildBffUpstreamUrl,
  buildSafeBffErrorResponse,
  filterForwardHeaderRecord,
  readBffJsonResponse,
} from './security';
import { startBffReliabilityMeasurement, type BffReliabilityOutcome } from './reliability';

const ALLOWED_BFF_METHODS = new Set(['GET', 'POST', 'PATCH', 'DELETE']);
const ALLOWED_BODY_MODES = new Set(['none', 'json']);
export const BFF_DEFAULT_TIMEOUT_MS = 8_000;

type BffMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type BodyMode = 'none' | 'json';

type SafeParseSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

export type BffRouteContext<TParams extends Record<string, string>> = {
  params: Promise<TParams>;
};

export async function resolveBffRouteParams<TParams extends Record<string, string>>(
  context: BffRouteContext<TParams>,
): Promise<TParams> {
  return context.params;
}

export function encodeBffPathSegment(input: string): string {
  return encodeURIComponent(input);
}

export function getBffAuthTokenCookie(request: NextRequest): string | undefined {
  return request.cookies.get(resolveAuthCookieNames().access)?.value;
}

export function getBffForwardHeaders(
  request: NextRequest,
  options: {
    authenticated?: boolean;
    contentType?: string;
    correlationHeaders?: Record<string, string>;
  } = {},
): Record<string, string> {
  const forwardedFor = request.headers.get('x-forwarded-for') ?? undefined;
  const userAgent = request.headers.get('user-agent') ?? undefined;
  const headers = filterForwardHeaderRecord({
    'x-forwarded-for': forwardedFor,
    'user-agent': userAgent,
    ...(options.correlationHeaders ?? {}),
    ...(options.contentType ? { 'Content-Type': options.contentType } : {}),
  });

  if (options.authenticated === true) {
    const token = getBffAuthTokenCookie(request);
    if (token) {
      return filterForwardHeaderRecord(
        {
          ...headers,
          Authorization: `Bearer ${token}`,
        },
        { allowAuthorization: true },
      );
    }
  }

  return headers;
}

function appendRequestSearch(path: string, request: NextRequest): string {
  const search = request.nextUrl.search;
  if (!search) {
    return path;
  }
  return `${path}${search}`;
}

async function readJsonBody(request: NextRequest): Promise<string | undefined> {
  const text = await request.text();
  if (text.trim().length === 0) {
    return undefined;
  }
  return text;
}

function validateForwardInput(input: {
  method: string;
  bodyMode?: string;
}): NextResponse | undefined {
  const bodyMode = input.bodyMode ?? 'none';
  if (!ALLOWED_BFF_METHODS.has(input.method)) {
    return buildSafeBffErrorResponse('BFF_METHOD_NOT_ALLOWED', 405);
  }

  if (!ALLOWED_BODY_MODES.has(bodyMode)) {
    return buildSafeBffErrorResponse('BFF_BODY_MODE_INVALID', 400);
  }

  return undefined;
}

export async function forwardBffRequest<TResponse = unknown>(input: {
  request: NextRequest;
  method: BffMethod;
  path: string;
  operation?: string;
  authenticated?: boolean;
  includeQuery?: boolean;
  bodyMode?: BodyMode;
  body?: string;
  timeoutMs?: number;
  responseSchema?: SafeParseSchema<TResponse>;
}): Promise<NextResponse> {
  const measurement = startBffReliabilityMeasurement({
    operation: input.operation,
    method: input.method,
    authenticated: input.authenticated === true,
    request: input.request,
  });
  const complete = (response: NextResponse, outcome?: BffReliabilityOutcome) => {
    measurement.complete({
      outcome:
        outcome ??
        (response.status >= 500
          ? 'upstream_error'
          : response.status >= 400
            ? 'client_error'
            : 'success'),
      status: response.status,
    });
    return response;
  };
  const invalidInputResponse = validateForwardInput(input);
  if (invalidInputResponse) {
    return complete(invalidInputResponse, 'client_error');
  }

  const body =
    input.bodyMode === 'json' ? (input.body ?? (await readJsonBody(input.request))) : undefined;
  const contentType = body
    ? (input.request.headers.get('content-type') ?? 'application/json')
    : undefined;
  const upstreamPath =
    input.includeQuery === true ? appendRequestSearch(input.path, input.request) : input.path;

  let upstreamUrl: string;
  try {
    upstreamUrl = buildBffUpstreamUrl({
      apiUpstreamUrl: getWebEnv().apiUpstreamUrl,
      path: upstreamPath,
      allowedPathPrefix: '/api',
    });
  } catch {
    return complete(buildSafeBffErrorResponse('BFF_UPSTREAM_URL_INVALID'), 'invalid_config');
  }

  const abortController = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, input.timeoutMs ?? BFF_DEFAULT_TIMEOUT_MS);
  const abortFromCaller = () => abortController.abort(input.request.signal.reason);
  if (input.request.signal.aborted) abortFromCaller();
  else input.request.signal.addEventListener('abort', abortFromCaller, { once: true });

  let response: Response;
  try {
    response = await fetch(upstreamUrl, {
      method: input.method,
      headers: getBffForwardHeaders(input.request, {
        authenticated: input.authenticated,
        contentType,
        correlationHeaders: measurement.correlationHeaders,
      }),
      ...(body ? { body } : {}),
      cache: 'no-store',
      signal: abortController.signal,
    });
  } catch (error) {
    if (timedOut) {
      return complete(buildSafeBffErrorResponse('BFF_UPSTREAM_TIMEOUT', 504), 'timeout');
    }
    if (input.request.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      return complete(buildSafeBffErrorResponse('BFF_UPSTREAM_ABORTED', 503), 'aborted');
    }
    return complete(buildSafeBffErrorResponse('BFF_UPSTREAM_UNAVAILABLE'), 'network');
  } finally {
    clearTimeout(timeoutId);
    input.request.signal.removeEventListener('abort', abortFromCaller);
  }

  if (response.status === 204 || response.status === 304) {
    return complete(new NextResponse(null, { status: response.status }));
  }

  const { response: safeResponse, json } = await readBffJsonResponse(response, {
    redactSensitiveFields: true,
  });
  const invalidResponse =
    json.code === 'BFF_UPSTREAM_NON_JSON_RESPONSE' ||
    json.code === 'BFF_UPSTREAM_MALFORMED_JSON_RESPONSE';
  if (safeResponse.ok && input.responseSchema) {
    const parsed = input.responseSchema.safeParse(json);
    if (!parsed.success) {
      return complete(buildSafeBffErrorResponse('BFF_UPSTREAM_SCHEMA_INVALID'), 'invalid_response');
    }
    return complete(NextResponse.json(parsed.data, { status: safeResponse.status }));
  }
  const nextResponse = NextResponse.json(json, { status: safeResponse.status });
  return complete(nextResponse, invalidResponse ? 'invalid_response' : undefined);
}

export async function forwardValidatedBffRequest<T>(
  input: Parameters<typeof forwardBffRequest>[0] & {
    responseSchema: SafeParseSchema<T>;
  },
): Promise<NextResponse> {
  const { responseSchema, ...forwardInput } = input;
  return forwardBffRequest({ ...forwardInput, responseSchema });
}
