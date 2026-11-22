import type { NextResponse } from 'next/server';

/**
 * The session token lives only in this cookie (README §3). The page never reads it
 * (HttpOnly); it has no Domain and no expiry, so the browser drops it when it closes, and the API's
 * idle and absolute limits end it sooner. `__Host-` is not used: browsers differ on whether
 * http://localhost is a secure page for that prefix.
 */
export const SESSION_COOKIE_NAME = 'dormduri_bo_session';

const SESSION_COOKIE_ATTRIBUTES = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
} as const;

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_ATTRIBUTES);
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', { ...SESSION_COOKIE_ATTRIBUTES, maxAge: 0 });
}
