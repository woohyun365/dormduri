import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const GRANT_VERSION = 'v1';
const GRANT_SECRET_BYTES = 32;
const GRANT_SECRET_LENGTH = 43;
const GRANT_SECRET_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface ParsedVerificationGrant {
  verificationCodeId: string;
  tokenHash: string;
}

export function createVerificationGrant(verificationCodeId: string): string {
  return `${GRANT_VERSION}.${verificationCodeId}.${randomBytes(GRANT_SECRET_BYTES).toString('base64url')}`;
}

export function hashVerificationGrant(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function parseVerificationGrant(token: string | null): ParsedVerificationGrant | null {
  if (!token) {
    return null;
  }

  const [version, verificationCodeId, secret, ...rest] = token.split('.');
  if (
    version !== GRANT_VERSION ||
    !verificationCodeId ||
    !secret ||
    secret.length !== GRANT_SECRET_LENGTH ||
    !GRANT_SECRET_PATTERN.test(secret) ||
    rest.length > 0
  ) {
    return null;
  }

  return {
    verificationCodeId,
    tokenHash: hashVerificationGrant(token),
  };
}

export function safeCompareVerificationGrantHash(
  expectedHash: string,
  actualHash: string,
): boolean {
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(actualHash, 'hex');

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
