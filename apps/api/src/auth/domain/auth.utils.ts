import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import {
  KNU_EMAIL_DOMAIN,
  normalizeEmail as normalizeEmailShared,
  parseNewPasswordStructure,
} from '@repo/shared/auth/policy';
import { normalizeDisplayIdentityNickname } from '@repo/shared/user/identity/display';

export function normalizeEmail(email: string): string {
  return normalizeEmailShared(email);
}

export function isKnuEmail(email: string): boolean {
  return normalizeEmail(email).endsWith(KNU_EMAIL_DOMAIN);
}

export function normalizeNickname(nickname: string): string {
  return normalizeDisplayIdentityNickname(nickname);
}

export function validatePasswordPolicy(password: string, email: string): string | null {
  const result = parseNewPasswordStructure(password, email);
  return result.ok ? null : result.message;
}

export function generateVerificationCode(): string {
  return String(randomInt(100000, 1000000));
}

const VERIFICATION_CODE_HMAC_PREFIX = 'hmac-sha256:';

function verificationCodeHashPayload(
  emailNormalized: string,
  purpose: string,
  code: string,
): string {
  return `${emailNormalized}:${purpose}:${code}`;
}

export function hashVerificationCode(
  emailNormalized: string,
  purpose: string,
  code: string,
  hmacSecret: string,
): string {
  const digest = createHmac('sha256', hmacSecret)
    .update(verificationCodeHashPayload(emailNormalized, purpose, code))
    .digest('hex');

  return `${VERIFICATION_CODE_HMAC_PREFIX}${digest}`;
}

export function safeTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function delayMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureMinDuration(startedAt: number, minimumMs: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < minimumMs) {
    await delayMs(minimumMs - elapsed);
  }
}
