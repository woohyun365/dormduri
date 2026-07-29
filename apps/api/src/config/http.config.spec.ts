import { describe, expect, it } from 'vitest';
import httpConfig, {
  readHttpCookieDomain,
  readHttpCookieSameSite,
  readHttpCookieSecure,
  readHttpCorsAllowedOrigins,
  readHttpTrustProxy,
  parseHttpTrustProxyCidrs,
} from './http.config.js';

describe('httpConfig', () => {
  it('keeps local trust proxy disabled by default', () => {
    expect(readHttpTrustProxy({ NODE_ENV: 'test' })).toBe(false);
  });

  it('parses explicit trusted proxy hop or CIDR topology', () => {
    expect(readHttpTrustProxy({ HTTP_TRUST_PROXY_HOPS: '2' })).toBe(2);
    expect(
      readHttpTrustProxy({
        HTTP_TRUST_PROXY_CIDRS: '10.0.0.0/8, 192.168.0.0/16, loopback',
      }),
    ).toEqual(['10.0.0.0/8', '192.168.0.0/16', 'loopback']);
    expect(parseHttpTrustProxyCidrs('2001:db8::/32,2001:db8::/32')).toEqual(['2001:db8::/32']);
  });

  it('rejects ambiguous or invalid trusted proxy topology', () => {
    expect(() =>
      readHttpTrustProxy({
        HTTP_TRUST_PROXY_HOPS: '1',
        HTTP_TRUST_PROXY_CIDRS: '10.0.0.0/8',
      }),
    ).toThrow('Configure only one');
    expect(() => readHttpTrustProxy({ HTTP_TRUST_PROXY_HOPS: '1.5' })).toThrow('integer');
    expect(() => readHttpTrustProxy({ HTTP_TRUST_PROXY_CIDRS: 'not-a-cidr' })).toThrow(
      'valid IP/CIDR',
    );
  });

  it('parses, canonicalizes, and deduplicates comma-separated CORS origins', () => {
    expect(
      readHttpCorsAllowedOrigins({
        HTTP_CORS_ALLOWED_ORIGINS:
          ' https://app.example.com,https://admin.example.com,https://app.example.com/ , ',
      }),
    ).toEqual(['https://app.example.com', 'https://admin.example.com']);
  });

  it('rejects wildcard and non-origin CORS values', () => {
    expect(() => readHttpCorsAllowedOrigins({ HTTP_CORS_ALLOWED_ORIGINS: '*' })).toThrow(
      'wildcard origin',
    );
    expect(() =>
      readHttpCorsAllowedOrigins({ HTTP_CORS_ALLOWED_ORIGINS: 'https://app.example.com/path' }),
    ).toThrow('without path/query/hash/userinfo');
  });

  it('uses secure cookies by default only in production', () => {
    expect(readHttpCookieSecure({ NODE_ENV: 'test' })).toBe(false);
    expect(readHttpCookieSecure({ NODE_ENV: 'production' })).toBe(true);
    expect(readHttpCookieSecure({ NODE_ENV: 'production', HTTP_COOKIE_SECURE: 'false' })).toBe(
      false,
    );
  });

  it('normalizes cookie policy values', () => {
    expect(readHttpCookieSameSite({ HTTP_COOKIE_SAME_SITE: 'Strict' })).toBe('strict');
    expect(readHttpCookieSameSite({})).toBe('lax');
    expect(readHttpCookieDomain({ HTTP_COOKIE_DOMAIN: ' .Example.com ' })).toBe('.example.com');
    expect(() => readHttpCookieDomain({ HTTP_COOKIE_DOMAIN: 'https://example.com' })).toThrow(
      'domain name',
    );
  });

  it('exposes parsed values through the Nest config namespace', () => {
    const previousEnv = { ...process.env };
    process.env.HTTP_TRUST_PROXY_HOPS = '1';
    process.env.HTTP_CORS_ALLOWED_ORIGINS = 'https://app.example.com, https://admin.example.com';
    process.env.HTTP_COOKIE_DOMAIN = '.example.com';

    try {
      expect(httpConfig()).toMatchObject({
        trustProxy: 1,
        corsAllowedOrigins: ['https://app.example.com', 'https://admin.example.com'],
        cookieDomain: '.example.com',
      });
    } finally {
      process.env = previousEnv;
    }
  });
});
