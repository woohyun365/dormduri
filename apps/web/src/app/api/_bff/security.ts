import { NextResponse } from 'next/server';
import { isIP, SocketAddress } from 'node:net';

const SENSITIVE_BODY_KEY_PARTS = [
  'accesstoken',
  'renewaltoken',
  'authorization',
  'cookie',
  'resetgrant',
  'secret',
  'signupgrant',
];
const FORBIDDEN_FORWARD_HEADER_NAMES = new Set([
  'cookie',
  'host',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
  'forwarded',
  'x-api-key',
  'content-length',
]);

export type BffSafeJsonReadResult = {
  response: Response;
  json: Record<string, unknown>;
};

// The public edge supplies one IP. Chains and alternate forwarding headers carry no identity.
export function normalizeForwardedClientIp(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const address = value.trim();
  if (address.includes('%')) return undefined;
  const family = isIP(address);
  if (family === 0) return undefined;
  if (family === 4) return address;

  const canonical = new SocketAddress({ address, family: 'ipv6' }).address;
  return canonical.startsWith('::ffff:') ? canonical.slice('::ffff:'.length) : canonical;
}

export function buildBffUpstreamUrl(input: {
  apiUpstreamUrl: string;
  path: string;
  allowedPathPrefix: '/api' | '/auth';
}): string {
  if (!input.path.startsWith('/') || input.path.startsWith('//')) {
    throw new Error('BFF upstream path must be a same-origin absolute path.');
  }

  const parsedPath = new URL(input.path, 'https://web.local');
  const prefix = input.allowedPathPrefix;
  const isAllowedPath =
    parsedPath.pathname === prefix || parsedPath.pathname.startsWith(`${prefix}/`);
  if (!isAllowedPath) {
    throw new Error(`BFF upstream path must stay under ${prefix}.`);
  }

  const baseUrl = new URL(input.apiUpstreamUrl);
  const basePath = baseUrl.pathname === '/' ? '' : baseUrl.pathname.replace(/\/+$/, '');
  const upstreamUrl = new URL(
    `${basePath}${parsedPath.pathname}${parsedPath.search}`,
    baseUrl.origin,
  );

  if (upstreamUrl.origin !== baseUrl.origin) {
    throw new Error('BFF upstream URL origin changed during path composition.');
  }

  return upstreamUrl.toString();
}

export function filterForwardHeaderRecord(
  headers: Record<string, string | undefined>,
  options: { allowAuthorization?: boolean } = {},
): Record<string, string> {
  const filtered: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (!value) continue;

    const lowerKey = key.toLowerCase();
    if (lowerKey === 'authorization' && options.allowAuthorization === true) {
      filtered.Authorization = value;
      continue;
    }

    if (FORBIDDEN_FORWARD_HEADER_NAMES.has(lowerKey) || lowerKey === 'authorization') {
      continue;
    }

    filtered[key] = value;
  }

  return filtered;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSensitiveBodyKey(key: string): boolean {
  const normalized = key.replace(/[^a-zA-Z]/g, '').toLowerCase();
  return SENSITIVE_BODY_KEY_PARTS.some((part) => normalized.includes(part));
}

export function redactSensitiveBffJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveBffJson(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (isSensitiveBodyKey(key)) {
      continue;
    }
    redacted[key] = redactSensitiveBffJson(child);
  }

  return redacted;
}

function safeErrorRecord(code: string): Record<string, unknown> {
  return {
    success: false,
    code,
  };
}

export function buildSafeBffErrorResponse(code: string, status = 502): NextResponse {
  return NextResponse.json(safeErrorRecord(code), { status });
}

function buildSafeSyntheticResponse(code: string, status = 502): BffSafeJsonReadResult {
  return {
    response: new Response(JSON.stringify(safeErrorRecord(code)), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
    json: safeErrorRecord(code),
  };
}

export async function readBffJsonResponse(
  response: Response,
  options: { redactSensitiveFields?: boolean } = {},
): Promise<BffSafeJsonReadResult> {
  if (response.status === 204 || response.status === 304) {
    return { response, json: {} };
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return buildSafeSyntheticResponse('BFF_UPSTREAM_NON_JSON_RESPONSE');
  }

  const text = await response.text();
  if (text.trim().length === 0) {
    return { response, json: {} };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return buildSafeSyntheticResponse('BFF_UPSTREAM_MALFORMED_JSON_RESPONSE');
  }

  const safeParsed =
    options.redactSensitiveFields === true ? redactSensitiveBffJson(parsed) : parsed;
  return { response, json: isRecord(safeParsed) ? safeParsed : { data: safeParsed } };
}
