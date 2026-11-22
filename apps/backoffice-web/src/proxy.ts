import { NextResponse, type NextRequest } from 'next/server';
import { buildContentSecurityPolicy, createNonce } from '@/security/content-security-policy';

/** Fetch Metadata values of the page requests an operator makes: typed or bookmarked, or in-app. */
const PAGE_REQUEST_SITES: ReadonlySet<string> = new Set(['none', 'same-origin']);

/**
 * Request entry of every page (README §5): it refuses a page request another site or another
 * localhost port caused, then sets a per-request nonce CSP (checked against the Next.js 16.4 guide
 * `content-security-policy.md`). A same-site request (an image or link on `localhost:3000`) carries
 * the `SameSite=Strict` cookie, and rendering the page would read the session and move its activity.
 * A request without Fetch Metadata passes: only browsers send it, and the BFF guards every change.
 * Pages render per request, so Next.js reads the nonce from the request header. BFF routes (`/api`)
 * answer JSON with `no-store` and need no CSP.
 */
export function proxy(request: NextRequest) {
  const site = request.headers.get('sec-fetch-site');
  if (site !== null && !PAGE_REQUEST_SITES.has(site)) {
    return new NextResponse('Forbidden', {
      status: 403,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
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
