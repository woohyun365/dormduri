import type { NextRequest } from 'next/server';
import { isIP } from 'node:net';
import { getWebEnv } from '@/config/env';
import {
  buildBffUpstreamUrl,
  filterForwardHeaderRecord,
  readBffJsonResponse,
} from '@/app/api/_bff/security';

const ALLOWED_AUTH_METHODS = new Set(['GET', 'POST']);
export const AUTH_BFF_DEFAULT_TIMEOUT_MS = 8_000;

export type AuthUpstreamResponseSchema = {
  safeParse(
    value: unknown,
  ): { success: true; data: Record<string, unknown> } | { success: false; error: unknown };
};

export type AuthForwardFailureKind =
  | 'timeout'
  | 'aborted'
  | 'network'
  | 'upstream'
  | 'invalid-response';

export type AuthForwardOptions = {
  timeoutMs?: number;
  responseSchema?: AuthUpstreamResponseSchema;
};

export type AuthForwardResult = {
  response: Response;
  json: Record<string, unknown>;
  failureKind?: AuthForwardFailureKind;
};

function normalizeHeaders(initHeaders?: HeadersInit): Record<string, string | undefined> {
  if (!initHeaders) {
    return {};
  }

  if (initHeaders instanceof Headers) {
    const headers: Record<string, string> = {};
    initHeaders.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  if (Array.isArray(initHeaders)) {
    return Object.fromEntries(initHeaders);
  }

  return initHeaders;
}

function buildSafeAuthForwardResult(
  code: string,
  status = 502,
  failureKind?: AuthForwardFailureKind,
): {
  response: Response;
  json: Record<string, unknown>;
  failureKind?: AuthForwardFailureKind;
} {
  return {
    response: new Response(JSON.stringify({ success: false, code }), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }),
    json: { success: false, code },
    ...(failureKind ? { failureKind } : {}),
  };
}

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function classifySafeJsonFailure(
  json: Record<string, unknown>,
): AuthForwardFailureKind | undefined {
  const code = json.code;
  if (
    code === 'BFF_UPSTREAM_MALFORMED_JSON_RESPONSE' ||
    code === 'BFF_UPSTREAM_NON_JSON_RESPONSE'
  ) {
    return 'invalid-response';
  }
  return undefined;
}

export async function forwardAuthRequest(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
  init?: RequestInit,
  options: AuthForwardOptions = {},
): Promise<AuthForwardResult> {
  if (!ALLOWED_AUTH_METHODS.has(method)) {
    return buildSafeAuthForwardResult('BFF_METHOD_NOT_ALLOWED', 405);
  }

  let upstreamUrl: string;
  try {
    upstreamUrl = buildBffUpstreamUrl({
      apiUpstreamUrl: getWebEnv().apiUpstreamUrl,
      path,
      allowedPathPrefix: '/auth',
    });
  } catch {
    return buildSafeAuthForwardResult('BFF_UPSTREAM_URL_INVALID');
  }

  const { headers: initHeaders, ...restInit } = init ?? {};
  const headers = filterForwardHeaderRecord(
    {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...normalizeHeaders(initHeaders),
    },
    { allowAuthorization: true },
  );

  const abortController = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, options.timeoutMs ?? AUTH_BFF_DEFAULT_TIMEOUT_MS);
  const callerSignal = restInit.signal;
  const abortFromCaller = () => abortController.abort(callerSignal?.reason);
  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  let response: Response;
  try {
    response = await fetch(upstreamUrl, {
      ...restInit,
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      signal: abortController.signal,
    });
  } catch (error) {
    if (timedOut) {
      return buildSafeAuthForwardResult('BFF_UPSTREAM_TIMEOUT', 504, 'timeout');
    }
    if (callerSignal?.aborted || isAbortError(error)) {
      return buildSafeAuthForwardResult('BFF_UPSTREAM_ABORTED', 503, 'aborted');
    }
    return buildSafeAuthForwardResult('BFF_UPSTREAM_NETWORK_ERROR', 503, 'network');
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }

  if (response.status >= 500) {
    return buildSafeAuthForwardResult('BFF_UPSTREAM_UNAVAILABLE', 503, 'upstream');
  }

  const safeResult = await readBffJsonResponse(response);
  const safeJsonFailure = classifySafeJsonFailure(safeResult.json);
  if (safeJsonFailure) {
    return {
      ...safeResult,
      failureKind: safeJsonFailure,
    };
  }

  if (options.responseSchema) {
    const parsed = options.responseSchema.safeParse(safeResult.json);
    if (!parsed.success) {
      return buildSafeAuthForwardResult('BFF_UPSTREAM_SCHEMA_MISMATCH', 502, 'invalid-response');
    }
    return {
      response: safeResult.response,
      json: parsed.data,
    };
  }

  return safeResult;
}

export function resolveTrustedForwardedFor(request: NextRequest): string | undefined {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) {
    return undefined;
  }

  const trustedEdgeValue = forwardedFor
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .at(-1);

  return trustedEdgeValue && isIP(trustedEdgeValue) !== 0 ? trustedEdgeValue : undefined;
}

export function getForwardHeaders(
  request: NextRequest,
  extraHeaders?: Record<string, string | undefined>,
) {
  return filterForwardHeaderRecord(
    {
      'x-forwarded-for': resolveTrustedForwardedFor(request),
      'user-agent': request.headers.get('user-agent') ?? undefined,
      ...(extraHeaders ?? {}),
    },
    { allowAuthorization: true },
  );
}
