import { describe, expect, it, vi } from 'vitest';
import {
  SIGNUP_SUBMISSION_LIMIT,
  SIGNUP_SUBMISSION_WINDOW_MS,
  SignupSubmissionAdmissionService,
} from './signup-submission-admission.service.js';

describe('SignupSubmissionAdmissionService', () => {
  it('grant token hash를 다시 fingerprint한 5회/10분 가입 제출 budget을 사용한다', async () => {
    const storage = {
      increment: vi.fn().mockResolvedValue({
        totalHits: 1,
        timeToExpire: 600,
        isBlocked: false,
        timeToBlockExpire: 0,
      }),
    };
    const metrics = { recordFinalAdmission: vi.fn() };
    const service = new SignupSubmissionAdmissionService(storage, metrics as never);
    const grantTokenHash = 'a'.repeat(64);

    await expect(service.consume(grantTokenHash)).resolves.toBeNull();

    expect(storage.increment).toHaveBeenCalledWith(
      expect.not.stringContaining(grantTokenHash),
      SIGNUP_SUBMISSION_WINDOW_MS,
      SIGNUP_SUBMISSION_LIMIT,
      SIGNUP_SUBMISSION_WINDOW_MS,
      'signup-submission',
    );
    expect(metrics.recordFinalAdmission).toHaveBeenCalledWith('allowed');
  });

  it('차단된 제출 budget은 Retry-After seconds를 반환한다', async () => {
    const storage = {
      increment: vi.fn().mockResolvedValue({
        totalHits: 6,
        timeToExpire: 590,
        isBlocked: true,
        timeToBlockExpire: 587,
      }),
    };
    const metrics = { recordFinalAdmission: vi.fn() };
    const service = new SignupSubmissionAdmissionService(storage, metrics as never);

    await expect(service.consume('b'.repeat(64))).resolves.toBe(587);
    expect(metrics.recordFinalAdmission).toHaveBeenCalledWith('throttled');
  });
});
