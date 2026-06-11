import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { webEnv } from '@/config/env';

// Next.js auth BFF upstream base URL.
// 각 route가 `/auth/*` path fragment를 붙여 전달하므로 base에는 `/api`를 포함하지 않는다.
const API_URL = webEnv.apiUpstreamUrl;
const AUTH_COOKIE_NAME = 'auth-token';
const AUTH_RENEWAL_COOKIE_NAME = 'auth-renewal-token';
const REMEMBER_ME_RENEWAL_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function forwardAuthRequest(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
  init?: RequestInit,
) {
  const { headers: initHeaders, ...restInit } = init ?? {};
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(initHeaders ?? {}),
  };

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
    ...restInit,
  });

  const json = response.headers.get('content-type')?.includes('application/json')
    ? ((await response.json()) as Record<string, unknown>)
    : {};
  return { response, json };
}

export function getForwardHeaders(
  request: NextRequest,
  extraHeaders?: Record<string, string | undefined>,
) {
  const headers: Record<string, string> = {};
  const forwardedFor = request.headers.get('x-forwarded-for');
  const userAgent = request.headers.get('user-agent');

  if (forwardedFor) {
    headers['x-forwarded-for'] = forwardedFor;
  }
  if (userAgent) {
    headers['user-agent'] = userAgent;
  }

  for (const [key, value] of Object.entries(extraHeaders ?? {})) {
    if (value) headers[key] = value;
  }

  return headers;
}

export function buildJsonResponse(response: Response, json: Record<string, unknown>) {
  return NextResponse.json(json, {
    status: response.status,
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
