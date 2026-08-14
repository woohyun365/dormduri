import type { NextRequest } from 'next/server';
import { isIP } from 'node:net';
import { getWebEnv } from '@/config/env';
import {
  buildBffUpstreamUrl,
  filterForwardHeaderRecord,
  readBffJsonResponse,
} from '@/app/api/_bff/security';
import { AUTH_PASSWORD_HASH_CAPACITY_UNAVAILABLE_CODE } from '@repo/shared/auth/response';
import {
  startBffReliabilityMeasurement,
  type BffReliabilityOutcome,
} from '@/app/api/_bff/reliability';

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
  operation?: string;
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

const AUTH_OPERATION_BY_PATH: Readonly<Record<string, string>> = {
  '/auth/login': 'auth.login',
  '/auth/logout': 'auth.session.logout',
  '/auth/session': 'auth.session.read',
  '/auth/renew-session': 'auth.session.renew',
  '/auth/signup': 'auth.signup.create',
  '/auth/signup/validate-nickname': 'auth.signup.validate_nickname',
  '/auth/send-signup-code': 'auth.signup.send_code',
  '/auth/verify-email-code': 'auth.signup.verify_code',
  '/auth/send-reset-code': 'auth.password_reset.send_code',
  '/auth/verify-reset-code': 'auth.password_reset.verify_code',
  '/auth/reset-password': 'auth.password_reset.complete',
  '/auth/change-password': 'auth.change_password',
  '/auth/dev/users': 'auth.dev_users',
};

function resolveAuthOperation(path: string, explicitOperation: string | undefined): string {
  return explicitOperation ?? AUTH_OPERATION_BY_PATH[path] ?? 'auth.request';
}

async function readPasswordHashCapacityResponse(
  response: Response,
): Promise<AuthForwardResult | null> {
  if (response.status !== 503) {
    return null;
  }

  const safeResult = await readBffJsonResponse(response, { redactSensitiveFields: true });
  const retryAfterSeconds = Number(safeResult.json.retryAfterSeconds);
  if (
    safeResult.json.success !== false ||
    safeResult.json.code !== AUTH_PASSWORD_HASH_CAPACITY_UNAVAILABLE_CODE ||
    !Number.isFinite(retryAfterSeconds) ||
    retryAfterSeconds <= 0
  ) {
    return null;
  }

  return {
    response: safeResult.response,
    json: {
      success: false,
      code: AUTH_PASSWORD_HASH_CAPACITY_UNAVAILABLE_CODE,
      userActionable: false,
      retryAfterSeconds: Math.ceil(retryAfterSeconds),
    },
  };
}

export async function forwardAuthRequest(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
  init?: RequestInit,
  options: AuthForwardOptions = {},
): Promise<AuthForwardResult> {
  const normalizedInitHeaders = normalizeHeaders(init?.headers);
  const measurement = startBffReliabilityMeasurement({
    operation: resolveAuthOperation(path, options.operation),
    method,
    authenticated: typeof normalizedInitHeaders.Authorization === 'string',
    userAgent: normalizedInitHeaders['user-agent'],
  });
  const complete = (
    result: AuthForwardResult,
    explicitOutcome?: BffReliabilityOutcome,
  ): AuthForwardResult => {
    const status = result.response.status;
    const failureOutcome: Partial<Record<AuthForwardFailureKind, BffReliabilityOutcome>> = {
      timeout: 'timeout',
      aborted: 'aborted',
      network: 'network',
      upstream: 'upstream_error',
      'invalid-response': 'invalid_response',
    };
    measurement.complete({
      outcome:
        explicitOutcome ??
        (result.failureKind ? failureOutcome[result.failureKind] : undefined) ??
        (status >= 500 ? 'upstream_error' : status >= 400 ? 'client_error' : 'success'),
      status,
    });
    return result;
  };
  if (!ALLOWED_AUTH_METHODS.has(method)) {
    return complete(buildSafeAuthForwardResult('BFF_METHOD_NOT_ALLOWED', 405), 'client_error');
  }

  let upstreamUrl: string;
  try {
    upstreamUrl = buildBffUpstreamUrl({
      apiUpstreamUrl: getWebEnv().apiUpstreamUrl,
      path,
      allowedPathPrefix: '/auth',
    });
  } catch {
    return complete(buildSafeAuthForwardResult('BFF_UPSTREAM_URL_INVALID'), 'invalid_config');
  }

  const { headers: initHeaders, ...restInit } = init ?? {};
  const headers = filterForwardHeaderRecord(
    {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...normalizeHeaders(initHeaders),
      ...measurement.correlationHeaders,
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
      return complete(buildSafeAuthForwardResult('BFF_UPSTREAM_TIMEOUT', 504, 'timeout'));
    }
    if (callerSignal?.aborted || isAbortError(error)) {
      return complete(buildSafeAuthForwardResult('BFF_UPSTREAM_ABORTED', 503, 'aborted'));
    }
    return complete(buildSafeAuthForwardResult('BFF_UPSTREAM_NETWORK_ERROR', 503, 'network'));
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }

  if (response.status >= 500) {
    const capacityResponse = await readPasswordHashCapacityResponse(response);
    if (capacityResponse) {
      if (!options.responseSchema) {
        return complete(capacityResponse, 'upstream_error');
      }
      const parsed = options.responseSchema.safeParse(capacityResponse.json);
      if (parsed.success) {
        return complete(
          { response: capacityResponse.response, json: parsed.data },
          'upstream_error',
        );
      }
    }
    return complete(buildSafeAuthForwardResult('BFF_UPSTREAM_UNAVAILABLE', 503, 'upstream'));
  }

  const safeResult = await readBffJsonResponse(response);
  const safeJsonFailure = classifySafeJsonFailure(safeResult.json);
  if (safeJsonFailure) {
    return complete({ ...safeResult, failureKind: safeJsonFailure });
  }

  if (options.responseSchema) {
    const parsed = options.responseSchema.safeParse(safeResult.json);
    if (!parsed.success) {
      return complete(
        buildSafeAuthForwardResult('BFF_UPSTREAM_SCHEMA_MISMATCH', 502, 'invalid-response'),
      );
    }
    return complete({ response: safeResult.response, json: parsed.data });
  }

  return complete(safeResult);
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
