import { describe, expect, it } from 'vitest';
import httpConfig, {
  readHttpCookieDomain,
  readHttpCookieSameSite,
  readHttpCookieSecure,
  readHttpCorsAllowedOrigins,
  readHttpTrustProxy,
} from './http.config.js';

describe('httpConfig', () => {
  it('keeps local trust proxy disabled by default', () => {
    expect(readHttpTrustProxy({ NODE_ENV: 'test' })).toBe(false);
  });

  it('parses trust proxy boolean values', () => {
    expect(readHttpTrustProxy({ HTTP_TRUST_PROXY: 'true' })).toBe(true);
    expect(readHttpTrustProxy({ HTTP_TRUST_PROXY: '0' })).toBe(false);
  });

  it('parses comma-separated CORS origins', () => {
    expect(
      readHttpCorsAllowedOrigins({
        HTTP_CORS_ALLOWED_ORIGINS: ' https://app.example.com,https://admin.example.com , ',
      }),
    ).toEqual(['https://app.example.com', 'https://admin.example.com']);
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
    expect(readHttpCookieDomain({ HTTP_COOKIE_DOMAIN: ' .example.com ' })).toBe('.example.com');
  });

  it('exposes parsed values through the Nest config namespace', () => {
    const previousEnv = { ...process.env };
    process.env.HTTP_TRUST_PROXY = 'true';
    process.env.HTTP_CORS_ALLOWED_ORIGINS = 'https://app.example.com, https://admin.example.com';
    process.env.HTTP_COOKIE_DOMAIN = '.example.com';

    try {
      expect(httpConfig()).toMatchObject({
        trustProxy: true,
        corsAllowedOrigins: ['https://app.example.com', 'https://admin.example.com'],
        cookieDomain: '.example.com',
      });
    } finally {
      process.env = previousEnv;
    }
  });
});
