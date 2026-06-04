import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const OPAQUE_TOKEN_VERSION = 'v1';
const OPAQUE_TOKEN_BYTES = 32;
const OPAQUE_TOKEN_SECRET_LENGTH = 43;
const OPAQUE_TOKEN_SECRET_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface ParsedOpaqueToken {
  sessionId: string;
  tokenHash: string;
}

export function createOpaqueToken(sessionId: string) {
  return `${OPAQUE_TOKEN_VERSION}.${sessionId}.${randomBytes(OPAQUE_TOKEN_BYTES).toString('base64url')}`;
}

export function hashOpaqueToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function parseOpaqueToken(token: string | null): ParsedOpaqueToken | null {
  if (!token) {
    return null;
  }

  const [version, sessionId, secret, ...rest] = token.split('.');
  if (
    version !== OPAQUE_TOKEN_VERSION ||
    !sessionId ||
    !secret ||
    secret.length !== OPAQUE_TOKEN_SECRET_LENGTH ||
    !OPAQUE_TOKEN_SECRET_PATTERN.test(secret) ||
    rest.length > 0
  ) {
    return null;
  }

  return {
    sessionId,
    tokenHash: hashOpaqueToken(token),
  };
}

export function safeCompareTokenHash(expectedHash: string, actualHash: string) {
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(actualHash, 'hex');

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
