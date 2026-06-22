import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getWebEnv } from '@/config/env';
import {
  buildBffUpstreamUrl,
  filterForwardHeaderRecord,
  readBffJsonResponse,
  redactSensitiveBffJson,
} from '../_bff/security';

// Next.js auth BFF upstream base URL.
// 각 route가 `/auth/*` path fragment를 붙여 전달하므로 base에는 `/api`를 포함하지 않는다.
const AUTH_COOKIE_NAME = 'auth-token';
const AUTH_RENEWAL_COOKIE_NAME = 'auth-renewal-token';
const REMEMBER_ME_RENEWAL_TTL_SECONDS = 60 * 60 * 24 * 7;
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

export function buildJsonResponse(response: Response, json: Record<string, unknown>) {
  const retryAfter = response.headers.get('Retry-After');

  return NextResponse.json(redactSensitiveBffJson(json), {
    status: response.status,
    ...(retryAfter ? { headers: { 'Retry-After': retryAfter } } : {}),
  });
}

export function getAuthTokenCookie(request: NextRequest) {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value;
}

export function getAuthRenewalTokenCookie(request: NextRequest) {
  return request.cookies.get(AUTH_RENEWAL_COOKIE_NAME)?.value;
}

export function setAuthCookie(response: NextResponse, token: string, rememberMe: boolean = false) {
  const cookieOptions = {
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  } as const;

  if (rememberMe) {
    response.cookies.set({
      ...cookieOptions,
      maxAge: REMEMBER_ME_RENEWAL_TTL_SECONDS,
    });
    return;
  }

  response.cookies.set(cookieOptions);
}

export function setAuthRenewalCookie(response: NextResponse, renewalToken: string) {
  response.cookies.set({
    name: AUTH_RENEWAL_COOKIE_NAME,
    value: renewalToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REMEMBER_ME_RENEWAL_TTL_SECONDS,
  });
}

export function setAuthTransportCookies(
  response: NextResponse,
  input: {
    accessToken: string;
    rememberMe: boolean;
    renewalToken?: string;
  },
) {
  setAuthCookie(response, input.accessToken, input.rememberMe);

  if (input.rememberMe && input.renewalToken) {
    setAuthRenewalCookie(response, input.renewalToken);
    return;
  }

  response.cookies.set({
    name: AUTH_RENEWAL_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set({
    name: AUTH_RENEWAL_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
