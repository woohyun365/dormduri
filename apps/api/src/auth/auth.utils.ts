import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { KNU_EMAIL_DOMAIN, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './auth.constants.js';

const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]+$/u;
const PASSWORD_REGEX = /(?=.*[a-zA-Z])(?=.*\d)/u;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isKnuEmail(email: string): boolean {
  return normalizeEmail(email).endsWith(KNU_EMAIL_DOMAIN);
}

export function normalizeNickname(nickname: string): string {
  return nickname.trim().toLowerCase();
}

export function validatePasswordPolicy(password: string, email: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하여야 합니다.`;
  }
  if (!PASSWORD_REGEX.test(password)) {
    return '비밀번호는 영문과 숫자를 포함해야 합니다.';
  }
  if (password.toLowerCase() === email.toLowerCase()) {
    return '비밀번호는 이메일과 같을 수 없습니다.';
  }
  return null;
}

export function validateNicknamePolicy(nickname: string): string | null {
  const trimmed = nickname.trim();
  if (!trimmed) {
    return '닉네임을 입력해주세요.';
  }
  if (trimmed.length < 2) {
    return '닉네임은 2자 이상이어야 합니다.';
  }
  if (trimmed.length > 12) {
    return '닉네임은 12자 이하여야 합니다.';
  }
  if (!NICKNAME_REGEX.test(trimmed)) {
    return '닉네임은 한글, 영문, 숫자만 사용할 수 있습니다.';
  }
  return null;
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
