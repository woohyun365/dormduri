import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** RFC 6238 TOTP (README §3): HMAC-SHA-1, 30-second step, 6 digits, ±1 step. */
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW_STEPS = 1;
export const TOTP_SECRET_BYTES = 20;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(): Buffer {
  return randomBytes(TOTP_SECRET_BYTES);
}

export function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function timeStepAt(at: Date): number {
  return Math.floor(at.getTime() / 1_000 / TOTP_STEP_SECONDS);
}

/** RFC 4226 HOTP value for one counter (dynamic truncation, decimal code). */
export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(message).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export function totpAt(secret: Buffer, at: Date): string {
  return hotp(secret, timeStepAt(at));
}

/**
 * Accepts a code from the current step or one step either side. A step at or before
 * `lastUsedStep` is refused, so one code (or an older one) cannot be replayed.
 */
export function verifyTotp(input: {
  secret: Buffer;
  code: string;
  at: Date;
  lastUsedStep: number | null;
}): { ok: true; step: number } | { ok: false } {
  const current = timeStepAt(input.at);
  const expected = Buffer.from(input.code, 'utf8');
  for (let delta = -TOTP_WINDOW_STEPS; delta <= TOTP_WINDOW_STEPS; delta += 1) {
    const step = current + delta;
    const candidate = Buffer.from(hotp(input.secret, step), 'utf8');
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
      if (input.lastUsedStep !== null && step <= input.lastUsedStep) {
        return { ok: false };
      }
      return { ok: true, step };
    }
  }
  return { ok: false };
}

export function totpProvisioningUri(secret: Buffer, accountLabel: string): string {
  const issuer = 'dormduri backoffice';
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret: encodeBase32(secret),
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
