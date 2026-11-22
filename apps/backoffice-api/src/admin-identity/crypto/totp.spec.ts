import { describe, expect, it } from 'vitest';
import { encodeBase32, hotp, timeStepAt, totpAt, verifyTotp } from './totp.js';

// RFC 4226 Appendix D and RFC 6238 Appendix B use the ASCII secret "12345678901234567890".
const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii');

describe('TOTP (RFC 6238, HMAC-SHA-1)', () => {
  it('matches the RFC 4226 HOTP test values for counters 0 to 9', () => {
    const expected = [
      '755224',
      '287082',
      '359152',
      '969429',
      '338314',
      '254676',
      '287922',
      '162583',
      '399871',
      '520489',
    ];
    expect(expected.map((_, counter) => hotp(RFC_SECRET, counter))).toEqual(expected);
  });

  it.each([
    [59, '94287082'],
    [1_111_111_109, '07081804'],
    [1_111_111_111, '14050471'],
    [1_234_567_890, '89005924'],
    [2_000_000_000, '69279037'],
    [20_000_000_000, '65353130'],
  ])('matches the RFC 6238 SHA-1 test value at T=%i', (seconds, code) => {
    expect(hotp(RFC_SECRET, timeStepAt(new Date(seconds * 1_000)), 8)).toBe(code);
  });

  it('accepts the previous, current and next 30-second step and nothing further', () => {
    const at = new Date(1_700_000_000_000);
    const code = (offsetSteps: number) =>
      totpAt(RFC_SECRET, new Date(at.getTime() + offsetSteps * 30_000));
    for (const offset of [-1, 0, 1]) {
      expect(
        verifyTotp({ secret: RFC_SECRET, code: code(offset), at, lastUsedStep: null }).ok,
      ).toBe(true);
    }
    for (const offset of [-2, 2]) {
      expect(
        verifyTotp({ secret: RFC_SECRET, code: code(offset), at, lastUsedStep: null }).ok,
      ).toBe(false);
    }
  });

  it('refuses a step at or before the last used step (no replay)', () => {
    const at = new Date(1_700_000_000_000);
    const step = timeStepAt(at);
    const code = totpAt(RFC_SECRET, at);
    expect(verifyTotp({ secret: RFC_SECRET, code, at, lastUsedStep: step })).toEqual({ ok: false });
    expect(verifyTotp({ secret: RFC_SECRET, code, at, lastUsedStep: step - 1 })).toEqual({
      ok: true,
      step,
    });
  });

  it('encodes the secret in RFC 4648 base32 for authenticator apps', () => {
    expect(encodeBase32(RFC_SECRET)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });
});
