import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const AUTH_COOKIE_NAME = 'auth-token';
const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const JSON_CONTENT_TYPE = 'application/json';

export async function forwardAuthRequest(
  path: string,
  body: Record<string, unknown>,
  init?: RequestInit,
) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    ...init,
  });

  const json = (await response.json()) as Record<string, unknown>;
  return { response, json };
}

export function buildJsonResponse(response: Response, json: Record<string, unknown>) {
  return NextResponse.json(json, {
    status: response.status,
  });
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
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
    });
    return;
  }

  response.cookies.set(cookieOptions);
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
}
