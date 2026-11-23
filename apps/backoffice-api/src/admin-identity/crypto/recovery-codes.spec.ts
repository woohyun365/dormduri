import { describe, expect, it } from 'vitest';
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_CODE_COUNT,
} from './recovery-codes.js';

describe('recovery codes', () => {
  it('issues ten distinct codes in the XXXXX-XXXXX base32 form', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/u);
    }
  });

  it('stores a hash that does not contain the code and ignores case and spaces when matching', () => {
    const [code] = generateRecoveryCodes();
    expect(hashRecoveryCode(code!)).not.toContain(code!);
    expect(hashRecoveryCode(` ${code!.toLowerCase()} `)).toBe(hashRecoveryCode(code!));
    expect(normalizeRecoveryCode(' abcde-fghij ')).toBe('ABCDE-FGHIJ');
  });
});
