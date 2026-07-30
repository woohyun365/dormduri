import type { NextRequest, NextResponse } from 'next/server';
import { AUTH_VERIFICATION_GRANT_TTL_SECONDS } from '@repo/shared/auth/policy';
import { normalizeWebRuntimeMode, type WebRuntimeMode } from '@/config/env';

export type AuthVerificationGrantPurpose = 'signup' | 'password-reset';

const COOKIE_NAMES = {
  signup: {
    production: '__Host-signup-verification-grant',
    development: 'signup-verification-grant',
  },
  'password-reset': {
    production: '__Host-password-reset-grant',
    development: 'password-reset-grant',
  },
} as const;

export function getVerificationGrantCookieName(
  purpose: AuthVerificationGrantPurpose,
  runtimeMode: WebRuntimeMode = normalizeWebRuntimeMode(process.env.NODE_ENV),
): string {
  return runtimeMode === 'production'
    ? COOKIE_NAMES[purpose].production
    : COOKIE_NAMES[purpose].development;
}

export function getVerificationGrantCookie(
  request: NextRequest,
  purpose: AuthVerificationGrantPurpose,
): string | null {
  return request.cookies.get(getVerificationGrantCookieName(purpose))?.value ?? null;
}

export function setVerificationGrantCookie(
  response: NextResponse,
  purpose: AuthVerificationGrantPurpose,
  grant: string,
  expiresInSeconds = AUTH_VERIFICATION_GRANT_TTL_SECONDS,
  runtimeMode: WebRuntimeMode = normalizeWebRuntimeMode(process.env.NODE_ENV),
): void {
  response.cookies.set({
    name: getVerificationGrantCookieName(purpose, runtimeMode),
    value: grant,
    httpOnly: true,
    secure: runtimeMode === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: expiresInSeconds,
  });
}

export function clearVerificationGrantCookie(
  response: NextResponse,
  purpose: AuthVerificationGrantPurpose,
  runtimeMode: WebRuntimeMode = normalizeWebRuntimeMode(process.env.NODE_ENV),
): void {
  response.cookies.set({
    name: getVerificationGrantCookieName(purpose, runtimeMode),
    value: '',
    httpOnly: true,
    secure: runtimeMode === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}
