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

  return Array.from(
    new Set(
      raw
        .split(',')
        .map((origin) => normalizeHttpCorsOrigin(origin))
        .filter((origin): origin is string => origin !== null),
    ),
  );
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
  const value = env[HTTP_COOKIE_DOMAIN_ENV]?.trim();
  if (!value) {
    return null;
  }

  if (/\s/.test(value) || value.includes('://') || value.includes('/')) {
    throw new Error(`[config] ${HTTP_COOKIE_DOMAIN_ENV} must be a domain name, not a URL/path.`);
  }

  return value.toLowerCase();
}

export function normalizeHttpCorsOrigin(origin: string): string | null {
  const trimmed = origin.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed === '*') {
    throw new Error(`[config] ${HTTP_CORS_ALLOWED_ORIGINS_ENV} must not contain wildcard origin.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`[config] ${HTTP_CORS_ALLOWED_ORIGINS_ENV} must contain absolute origins.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`[config] ${HTTP_CORS_ALLOWED_ORIGINS_ENV} supports only http/https origins.`);
  }

  if (
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      `[config] ${HTTP_CORS_ALLOWED_ORIGINS_ENV} must contain origins without path/query/hash/userinfo.`,
    );
  }

  return parsed.origin;
}

export default registerAs('http', () => ({
  trustProxy: readHttpTrustProxy(process.env),
  corsAllowedOrigins: readHttpCorsAllowedOrigins(process.env),
  cookieSecure: readHttpCookieSecure(process.env),
  cookieSameSite: readHttpCookieSameSite(process.env),
  cookieDomain: readHttpCookieDomain(process.env),
}));
