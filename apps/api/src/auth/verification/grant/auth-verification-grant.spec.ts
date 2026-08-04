import { describe, expect, it } from 'vitest';
import {
  createVerificationGrant,
  hashVerificationGrant,
  parseVerificationGrant,
  safeCompareVerificationGrantHash,
} from './auth-verification-grant.js';

describe('verification grant domain helper', () => {
  it('32-byte secret이 포함된 opaque grant를 만들고 hash만 persistence에 넘긴다', () => {
    const grant = createVerificationGrant('verification-code-1');

    expect(grant).toMatch(/^v1\.verification-code-1\.[A-Za-z0-9_-]{43}$/);
    expect(parseVerificationGrant(grant)).toEqual({
      verificationCodeId: 'verification-code-1',
      tokenHash: hashVerificationGrant(grant),
    });
  });

  it('malformed/legacy/JWT-like grant는 authority로 해석하지 않는다', () => {
    expect(parseVerificationGrant(null)).toBeNull();
    expect(parseVerificationGrant('jwt.payload.signature')).toBeNull();
    expect(parseVerificationGrant('v1.code.short')).toBeNull();
    expect(parseVerificationGrant(`v1.code.${'a'.repeat(43)}.extra`)).toBeNull();
  });

  it('grant hash는 constant-time 비교를 사용하며 forged hash를 허용하지 않는다', () => {
    const grant = createVerificationGrant('verification-code-1');
    const hash = hashVerificationGrant(grant);

    expect(safeCompareVerificationGrantHash(hash, hash)).toBe(true);
    expect(safeCompareVerificationGrantHash(hash, hash.slice(2))).toBe(false);
    expect(
      safeCompareVerificationGrantHash(
        hash,
        hashVerificationGrant(createVerificationGrant('verification-code-1')),
      ),
    ).toBe(false);
  });
});
