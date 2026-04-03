import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import {
  KNU_EMAIL_DOMAIN,
  normalizeEmail as normalizeEmailShared,
  normalizeNickname as normalizeNicknameShared,
  validatePasswordStructure,
  validateNicknameStructure,
} from '@repo/shared/auth-policy';

export function normalizeEmail(email: string): string {
  return normalizeEmailShared(email);
}

export function isKnuEmail(email: string): boolean {
  return normalizeEmail(email).endsWith(KNU_EMAIL_DOMAIN);
}

export function normalizeNickname(nickname: string): string {
  return normalizeNicknameShared(nickname);
}

export function validatePasswordPolicy(password: string, email: string): string | null {
  return validatePasswordStructure(password, email) || null;
}

export function validateNicknameFormat(nickname: string): string | null {
  return validateNicknameStructure(nickname) || null;
}

export function generateVerificationCode(): string {
  return String(randomInt(100000, 1000000));
}

export function hashVerificationCode(
  emailNormalized: string,
  purpose: string,
  code: string,
): string {
  return createHash('sha256').update(`${emailNormalized}:${purpose}:${code}`).digest('hex');
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
