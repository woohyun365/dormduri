import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_ROUTES = ['/login', '/signup', '/password-reset'] as const;
const PROTECTED_PREFIXES = ['/main'] as const;

async function validateSession(request: NextRequest): Promise<boolean> {
  try {
    const response = await fetch(new URL('/api/auth/session', request.url), {
      method: 'GET',
      headers: {
        cookie: request.headers.get('cookie') ?? '',
        'x-forwarded-for': request.headers.get('x-forwarded-for') ?? '',
        'user-agent': request.headers.get('user-agent') ?? '',
      },
      cache: 'no-store',
    });

    if (!response.ok) return false;

    const json = (await response.json()) as { authenticated?: boolean };
    return json.authenticated === true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = AUTH_ROUTES.includes(pathname as (typeof AUTH_ROUTES)[number]);
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthenticated = await validateSession(request);

  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/main', request.url));
  }

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/signup', '/password-reset', '/main/:path*'],
};
