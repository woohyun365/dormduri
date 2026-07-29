import type { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  AUTH_RENEWAL_COOKIE_NAME,
  PRODUCTION_AUTH_COOKIE_NAME,
  PRODUCTION_AUTH_RENEWAL_COOKIE_NAME,
  resolveAuthCookieNames,
} from '@/config/auth-cookie.config';
import { normalizeWebRuntimeMode, type WebRuntimeMode } from '@/config/env';

export {
  AUTH_COOKIE_NAME,
  AUTH_RENEWAL_COOKIE_NAME,
  PRODUCTION_AUTH_COOKIE_NAME,
  PRODUCTION_AUTH_RENEWAL_COOKIE_NAME,
};
export const REMEMBER_ME_RENEWAL_TTL_SECONDS = 60 * 60 * 24 * 7;

export function getAuthCookieNames(runtimeMode?: WebRuntimeMode) {
  return resolveAuthCookieNames(runtimeMode);
}

export function getAuthTokenCookie(request: NextRequest) {
  return request.cookies.get(getAuthCookieNames().access)?.value;
}

export function getAuthRenewalTokenCookie(request: NextRequest) {
  return request.cookies.get(getAuthCookieNames().renewal)?.value;
}

export function setAuthCookie(
  response: NextResponse,
  token: string,
  runtimeMode: WebRuntimeMode = normalizeWebRuntimeMode(process.env.NODE_ENV),
) {
  const cookieNames = getAuthCookieNames(runtimeMode);
  const cookieOptions = {
    name: cookieNames.access,
    value: token,
    httpOnly: true,
    secure: runtimeMode === 'production',
    sameSite: 'lax',
    path: '/',
  } as const;

  response.cookies.set(cookieOptions);
}

export function setAuthRenewalCookie(
  response: NextResponse,
  renewalToken: string,
  rememberMe: boolean,
  runtimeMode: WebRuntimeMode = normalizeWebRuntimeMode(process.env.NODE_ENV),
) {
  const cookieNames = getAuthCookieNames(runtimeMode);
  const cookieOptions = {
    name: cookieNames.renewal,
    value: renewalToken,
    httpOnly: true,
    secure: runtimeMode === 'production',
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

export function setAuthTransportCookies(
  response: NextResponse,
  input: {
    accessToken: string;
    rememberMe: boolean;
    renewalToken?: string;
  },
  runtimeMode: WebRuntimeMode = normalizeWebRuntimeMode(process.env.NODE_ENV),
) {
  const cookieNames = getAuthCookieNames(runtimeMode);
  setAuthCookie(response, input.accessToken, runtimeMode);

  if (input.renewalToken) {
    setAuthRenewalCookie(response, input.renewalToken, input.rememberMe, runtimeMode);
    return;
  }

  response.cookies.set({
    name: cookieNames.renewal,
    value: '',
    httpOnly: true,
    secure: runtimeMode === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function clearAuthCookie(
  response: NextResponse,
  runtimeMode: WebRuntimeMode = normalizeWebRuntimeMode(process.env.NODE_ENV),
) {
  const cookieNames = getAuthCookieNames(runtimeMode);
  response.cookies.set({
    name: cookieNames.access,
    value: '',
    httpOnly: true,
    secure: runtimeMode === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set({
    name: cookieNames.renewal,
    value: '',
    httpOnly: true,
    secure: runtimeMode === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
