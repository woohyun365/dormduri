import { NextResponse, type NextRequest } from 'next/server';
import { buildContentSecurityPolicy, createNonce } from '@/security/content-security-policy';

/**
 * Request entry of every page: a per-request nonce CSP (README §5, checked against the Next.js
 * 16.4 guide `content-security-policy.md`). Pages render per request, so Next.js reads the nonce
 * from the request header. BFF routes (`/api`) answer JSON with `no-store` and need no CSP.
 */
export function proxy(request: NextRequest) {
  const policy = buildContentSecurityPolicy(createNonce(), {
    development: process.env.NODE_ENV === 'development',
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
