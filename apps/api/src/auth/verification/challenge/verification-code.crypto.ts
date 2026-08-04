import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

const VERIFICATION_CODE_HMAC_PREFIX = 'hmac-sha256:';

export function generateVerificationCode(): string {
  return String(randomInt(100000, 1000000));
}

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
