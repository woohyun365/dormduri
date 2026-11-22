import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

function page(site?: string) {
  return new NextRequest('http://localhost:4300/', {
    headers: site === undefined ? {} : { 'sec-fetch-site': site },
  });
}

describe('proxy (README §5)', () => {
  it.each(['same-site', 'cross-site'])(
    'refuses a %s page request before rendering (no session read)',
    async (site) => {
      const response = proxy(page(site));
      expect(response.status).toBe(403);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-middleware-next')).toBeNull();
    },
  );

  it.each([
    { purpose: 'prefetch', 'sec-fetch-site': 'same-site' },
    { 'sec-purpose': 'prefetch', 'sec-fetch-site': 'same-site' },
    { 'next-router-prefetch': '1', 'sec-fetch-site': 'same-site' },
  ])('runs for a prefetch page request too, so its Fetch Metadata is checked (%o)', (headers) => {
    expect(unstable_doesMiddlewareMatch({ config, url: '/', headers })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, url: '/accounts', headers })).toBe(true);
  });

  it.each(['/api/auth/logout', '/_next/static/chunks/main.js', '/favicon.ico'])(
    'does not run for %s',
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    },
  );

  it.each([['none'], ['same-origin'], [undefined]])(
    'renders a page request with Sec-Fetch-Site %s under a fresh nonce CSP',
    (site) => {
      const first = proxy(page(site));
      const second = proxy(page(site));
      expect(first.headers.get('x-middleware-next')).toBe('1');
      expect(first.headers.get('content-security-policy')).toMatch(/'nonce-[A-Za-z0-9+/=]+'/u);
      expect(first.headers.get('content-security-policy')).not.toBe(
        second.headers.get('content-security-policy'),
      );
    },
  );
});
