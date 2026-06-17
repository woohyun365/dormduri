import { registerAs } from '@nestjs/config';
import { readBooleanEnv, readStringEnv } from './env.helpers.js';

export const HTTP_TRUST_PROXY_ENV = 'HTTP_TRUST_PROXY';
export const HTTP_CORS_ALLOWED_ORIGINS_ENV = 'HTTP_CORS_ALLOWED_ORIGINS';
export const HTTP_COOKIE_SECURE_ENV = 'HTTP_COOKIE_SECURE';
export const HTTP_COOKIE_SAME_SITE_ENV = 'HTTP_COOKIE_SAME_SITE';
export const HTTP_COOKIE_DOMAIN_ENV = 'HTTP_COOKIE_DOMAIN';

export const DEFAULT_HTTP_TRUST_PROXY = false;
export const DEFAULT_HTTP_COOKIE_SAME_SITE = 'lax' as const;

export type HttpCookieSameSite = 'strict' | 'lax' | 'none';

export function readHttpTrustProxy(env: NodeJS.ProcessEnv = process.env): boolean {
  return readBooleanEnv(env, HTTP_TRUST_PROXY_ENV, DEFAULT_HTTP_TRUST_PROXY);
}

export function readHttpCorsAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env[HTTP_CORS_ALLOWED_ORIGINS_ENV]?.trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function readHttpCookieSecure(env: NodeJS.ProcessEnv = process.env): boolean {
  const nodeEnv = env.NODE_ENV?.trim() || 'development';
  return readBooleanEnv(env, HTTP_COOKIE_SECURE_ENV, nodeEnv === 'production');
}

export function readHttpCookieSameSite(env: NodeJS.ProcessEnv = process.env): HttpCookieSameSite {
  const value = readStringEnv(env, HTTP_COOKIE_SAME_SITE_ENV, DEFAULT_HTTP_COOKIE_SAME_SITE)
    .trim()
    .toLowerCase();

  if (value === 'strict' || value === 'lax' || value === 'none') {
    return value;
  }

  throw new Error(`[config] ${HTTP_COOKIE_SAME_SITE_ENV} must be one of strict, lax, none.`);
}

export function readHttpCookieDomain(env: NodeJS.ProcessEnv = process.env): string | null {
  return env[HTTP_COOKIE_DOMAIN_ENV]?.trim() || null;
}

export default registerAs('http', () => ({
  trustProxy: readHttpTrustProxy(process.env),
  corsAllowedOrigins: readHttpCorsAllowedOrigins(process.env),
  cookieSecure: readHttpCookieSecure(process.env),
  cookieSameSite: readHttpCookieSameSite(process.env),
  cookieDomain: readHttpCookieDomain(process.env),
}));
