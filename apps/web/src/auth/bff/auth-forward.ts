import type { NextRequest } from 'next/server';
import { getWebEnv } from '@/config/env';
import {
  buildBffUpstreamUrl,
  filterForwardHeaderRecord,
  readBffJsonResponse,
} from '@/app/api/_bff/security';

const ALLOWED_AUTH_METHODS = new Set(['GET', 'POST']);

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
): { response: Response; json: Record<string, unknown> } {
  return {
    response: new Response(JSON.stringify({ success: false, code }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
    json: { success: false, code },
  };
}

export async function forwardAuthRequest(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
  init?: RequestInit,
) {
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

  const response = await fetch(upstreamUrl, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
    ...restInit,
  });

  return readBffJsonResponse(response);
}

export function getForwardHeaders(
  request: NextRequest,
  extraHeaders?: Record<string, string | undefined>,
) {
  return filterForwardHeaderRecord(
    {
      'x-forwarded-for': request.headers.get('x-forwarded-for') ?? undefined,
      'user-agent': request.headers.get('user-agent') ?? undefined,
      ...(extraHeaders ?? {}),
    },
    { allowAuthorization: true },
  );
}
