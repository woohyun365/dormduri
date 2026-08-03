import { describe, expect, it } from 'vitest';
import { hashVerificationCode, safeTimeEquals } from './verification-code.crypto.js';

describe('verification code crypto', () => {
  const emailNormalized = 'test@kangwon.ac.kr';
  const purpose = 'SIGNUP';
  const code = '123456';
  const hmacSecret = 'test-verification-code-hmac-secret';

  it('HMAC hash는 prefix를 포함한 버전드 문자열을 반환한다', () => {
    const hash = hashVerificationCode(emailNormalized, purpose, code, hmacSecret);

    expect(hash).toMatch(/^hmac-sha256:[0-9a-f]{64}$/);
  });

  it('safeTimeEquals는 길이가 다르면 false를 반환한다', () => {
    expect(safeTimeEquals('abc', 'abcd')).toBe(false);
  });

  it('safeTimeEquals는 동일한 HMAC hash면 true를 반환한다', () => {
    const left = hashVerificationCode(emailNormalized, purpose, code, hmacSecret);
    const right = hashVerificationCode(emailNormalized, purpose, code, hmacSecret);

    expect(safeTimeEquals(left, right)).toBe(true);
  });
});
