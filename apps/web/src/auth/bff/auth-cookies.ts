import type { NextRequest, NextResponse } from 'next/server';

export const AUTH_COOKIE_NAME = 'auth-token';
export const AUTH_RENEWAL_COOKIE_NAME = 'auth-renewal-token';
export const REMEMBER_ME_RENEWAL_TTL_SECONDS = 60 * 60 * 24 * 7;

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
