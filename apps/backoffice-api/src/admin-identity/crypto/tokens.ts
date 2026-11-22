import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes as base64url (43 characters): session tokens and one-time codes (README §3, OA-R10). */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Only this hash is stored; the token itself goes to the caller once. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
