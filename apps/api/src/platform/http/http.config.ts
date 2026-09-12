import { registerAs } from '@nestjs/config';
import { isIP } from 'node:net';
import { readNumberEnv } from '../../config/environment/env.helpers.js';

export const HTTP_TRUST_PROXY_HOPS_ENV = 'HTTP_TRUST_PROXY_HOPS';
export const HTTP_TRUST_PROXY_CIDRS_ENV = 'HTTP_TRUST_PROXY_CIDRS';
export const HTTP_CORS_ALLOWED_ORIGINS_ENV = 'HTTP_CORS_ALLOWED_ORIGINS';

export const DEFAULT_HTTP_TRUST_PROXY_HOPS = 0;

export type HttpTrustProxy = false | number | string[];

const EXPRESS_TRUST_PROXY_PRESETS = new Set(['linklocal', 'loopback', 'uniquelocal']);

export function readHttpTrustProxy(env: NodeJS.ProcessEnv = process.env): HttpTrustProxy {
  const hops = readNumberEnv(env, HTTP_TRUST_PROXY_HOPS_ENV, DEFAULT_HTTP_TRUST_PROXY_HOPS, {
    min: 0,
  });
  if (!Number.isInteger(hops)) {
    throw new Error(`[config] ${HTTP_TRUST_PROXY_HOPS_ENV} must be an integer.`);
  }

  const cidrs = parseHttpTrustProxyCidrs(env[HTTP_TRUST_PROXY_CIDRS_ENV]);
  if (hops > 0 && cidrs.length > 0) {
    throw new Error(
      `[config] Configure only one of ${HTTP_TRUST_PROXY_HOPS_ENV} or ${HTTP_TRUST_PROXY_CIDRS_ENV}.`,
    );
  }

  if (cidrs.length > 0) {
    return cidrs;
  }
  return hops > 0 ? hops : false;
}

export function parseHttpTrustProxyCidrs(raw: string | undefined): string[] {
  const values = (raw ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const uniqueValues = Array.from(new Set(values));

  for (const value of uniqueValues) {
    if (EXPRESS_TRUST_PROXY_PRESETS.has(value)) {
      continue;
    }

    const [address, prefix, extra] = value.split('/');
    const addressFamily = address ? isIP(address) : 0;
    const maximumPrefix = addressFamily === 4 ? 32 : addressFamily === 6 ? 128 : 0;
    const parsedPrefix = prefix === undefined ? maximumPrefix : Number(prefix);
    if (
      extra !== undefined ||
      maximumPrefix === 0 ||
      !Number.isInteger(parsedPrefix) ||
      parsedPrefix < 0 ||
      parsedPrefix > maximumPrefix
    ) {
      throw new Error(
        `[config] ${HTTP_TRUST_PROXY_CIDRS_ENV} must contain valid IP/CIDR or Express subnet presets.`,
      );
    }
  }

  return uniqueValues;
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
}));
