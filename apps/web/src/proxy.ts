import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  AUTH_RENEWAL_COOKIE_NAME,
  PRODUCTION_AUTH_COOKIE_NAME,
  PRODUCTION_AUTH_RENEWAL_COOKIE_NAME,
} from '@/config/auth-cookie.config';

const AUTH_ROUTES = ['/login', '/signup', '/password-reset'] as const;
const PROTECTED_PREFIXES = ['/main', '/notifications', '/support'] as const;
const AUTH_COOKIE_NAMES = [
  AUTH_COOKIE_NAME,
  AUTH_RENEWAL_COOKIE_NAME,
  PRODUCTION_AUTH_COOKIE_NAME,
  PRODUCTION_AUTH_RENEWAL_COOKIE_NAME,
] as const;

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = AUTH_ROUTES.includes(pathname as (typeof AUTH_ROUTES)[number]);
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const hasAuthTransport = AUTH_COOKIE_NAMES.some((name) => request.cookies.has(name));

  if (isProtectedRoute && !hasAuthTransport) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Auth route redirect와 authoritative session 판정은 client session resolve가 담당한다.
  // Proxy는 dependency 장애를 logout으로 오인하지 않도록 cookie 존재 여부만 optimistic gate로 사용한다.
  if (isAuthRoute || isProtectedRoute) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/signup',
    '/password-reset',
    '/main/:path*',
    '/notifications/:path*',
    '/support/:path*',
  ],
};
