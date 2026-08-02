import { describe, expect, it, vi } from 'vitest';
import { SignupNicknameValidationAdmissionService } from './signup-nickname-validation-admission.service.js';

describe('SignupNicknameValidationAdmissionService', () => {
  it('grant token hash를 다시 fingerprint한 ephemeral key로 20회/1분 budget을 소비한다', async () => {
    const storage = {
      increment: vi.fn().mockResolvedValue({
        totalHits: 1,
        timeToExpire: 60,
        isBlocked: false,
        timeToBlockExpire: 0,
      }),
    };
    const service = new SignupNicknameValidationAdmissionService(storage);
    const grantTokenHash = 'a'.repeat(64);

    await expect(service.consume(grantTokenHash)).resolves.toBeNull();

    expect(storage.increment).toHaveBeenCalledWith(
      expect.not.stringContaining(grantTokenHash),
      60_000,
      20,
      60_000,
      'signup-nickname-validation',
    );
  });

  it('blocked budget은 Retry-After seconds를 반환한다', async () => {
    const storage = {
      increment: vi.fn().mockResolvedValue({
        totalHits: 21,
        timeToExpire: 58,
        isBlocked: true,
        timeToBlockExpire: 57,
      }),
    };
    const service = new SignupNicknameValidationAdmissionService(storage);

    await expect(service.consume('b'.repeat(64))).resolves.toBe(57);
  });
});
