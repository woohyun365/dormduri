import 'server-only';

import { getWebEnv } from '@/config/env';
import {
  buildBffUpstreamUrl,
  filterForwardHeaderRecord,
  normalizeForwardedClientIp,
  readBffJsonResponse,
} from './security';
import { startBffReliabilityMeasurement, type BffReliabilityOutcome } from './reliability';

export const SERVER_READ_DEFAULT_TIMEOUT_MS = 8_000;

type ServerReadFailureKind =
  'invalid-config' | 'timeout' | 'aborted' | 'network' | 'upstream' | 'invalid-response';

export type ServerReadResult<T> =
  { ok: true; data: T } | { ok: false; kind: ServerReadFailureKind; status?: number };

type SafeParseSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

export async function readConfiguredUpstreamJson<T>(input: {
  path: string;
  allowedPathPrefix: '/api' | '/auth';
  operation: string;
  requestHeaders: Pick<Headers, 'get'>;
  authorization?: string;
  responseSchema: SafeParseSchema<T>;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<ServerReadResult<T>> {
  const userAgent = input.requestHeaders.get('user-agent') ?? undefined;
  const measurement = startBffReliabilityMeasurement({
    operation: input.operation,
    method: 'GET',
    authenticated: Boolean(input.authorization),
    userAgent,
  });
  const finish = (result: ServerReadResult<T>, outcome: BffReliabilityOutcome, status?: number) => {
    measurement.complete({ outcome, status });
    return result;
  };

  let upstreamUrl: string;
  try {
    upstreamUrl = buildBffUpstreamUrl({
      apiUpstreamUrl: getWebEnv().apiUpstreamUrl,
      path: input.path,
      allowedPathPrefix: input.allowedPathPrefix,
    });
  } catch {
    return finish({ ok: false, kind: 'invalid-config' }, 'invalid_config');
  }

  const forwardedFor = normalizeForwardedClientIp(input.requestHeaders.get('x-forwarded-for'));
  const headers = filterForwardHeaderRecord(
    {
      Accept: 'application/json',
      'user-agent': userAgent,
      ...measurement.correlationHeaders,
      ...(input.authorization ? { Authorization: input.authorization } : {}),
    },
    { allowAuthorization: true },
  );
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, input.timeoutMs ?? SERVER_READ_DEFAULT_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort(input.signal?.reason);
  if (input.signal?.aborted) abortFromCaller();
  else input.signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
    });

    if (!response.ok) {
      return finish(
        { ok: false, kind: 'upstream', status: response.status },
        response.status >= 500 ? 'upstream_error' : 'client_error',
        response.status,
      );
    }

    const safe = await readBffJsonResponse(response, { redactSensitiveFields: true });
    if (
      safe.json.code === 'BFF_UPSTREAM_NON_JSON_RESPONSE' ||
      safe.json.code === 'BFF_UPSTREAM_MALFORMED_JSON_RESPONSE'
    ) {
      return finish({ ok: false, kind: 'invalid-response', status: 502 }, 'invalid_response', 502);
    }
    const parsed = input.responseSchema.safeParse(safe.json);
    if (!parsed.success) {
      return finish({ ok: false, kind: 'invalid-response', status: 502 }, 'invalid_response', 502);
    }
    return finish({ ok: true, data: parsed.data }, 'success', response.status);
  } catch (error) {
    if (timedOut) return finish({ ok: false, kind: 'timeout' }, 'timeout', 504);
    if (input.signal?.aborted || isAbortError(error)) {
      return finish({ ok: false, kind: 'aborted' }, 'aborted', 503);
    }
    return finish({ ok: false, kind: 'network' }, 'network', 503);
  } finally {
    clearTimeout(timeoutId);
    input.signal?.removeEventListener('abort', abortFromCaller);
  }
}
