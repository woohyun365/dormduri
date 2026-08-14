import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DisplayIdentityNicknamePolicyError } from '../../users/identity/display/display-identity-nickname-policy.service.js';
import { SignupNicknameValidationQuery } from './signup-nickname-validation.query.js';

describe('SignupNicknameValidationQuery', () => {
  const verificationService = { resolveVerificationGrant: vi.fn() };
  const nicknamePolicy = { validate: vi.fn() };
  const admission = { consume: vi.fn() };
  const metrics = { recordNicknameValidation: vi.fn() };
  const query = new SignupNicknameValidationQuery(
    verificationService as never,
    nicknamePolicy as never,
    admission as never,
    metrics as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    verificationService.resolveVerificationGrant.mockResolvedValue({
      id: 'code-1',
      purpose: 'SIGNUP',
      tokenHash: 'a'.repeat(64),
    });
    admission.consume.mockResolvedValue(null);
    nicknamePolicy.validate.mockResolvedValue({ value: '테스터', normalized: '테스터' });
  });

  it('active SIGNUP grant와 available nickname이면 canonical nickname을 반환한다', async () => {
    await expect(query.execute('  테스터  ', 'signup-grant')).resolves.toEqual({
      success: true,
      nickname: '테스터',
    });

    expect(verificationService.resolveVerificationGrant).toHaveBeenCalledWith(
      'signup-grant',
      'SIGNUP',
    );
    expect(admission.consume).toHaveBeenCalledWith('a'.repeat(64));
    expect(metrics.recordNicknameValidation).toHaveBeenCalledWith('available');
  });

  it('missing, expired, wrong-purpose grant는 nickname policy 전에 verification required로 닫는다', async () => {
    verificationService.resolveVerificationGrant.mockResolvedValue(null);

    await expect(query.execute('테스터', null)).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED',
    });
    expect(admission.consume).not.toHaveBeenCalled();
    expect(nicknamePolicy.validate).not.toHaveBeenCalled();
  });

  it('grant budget이 닫히면 moderation/availability 전에 retry 정보를 반환한다', async () => {
    admission.consume.mockResolvedValue(42);

    await expect(query.execute('테스터', 'signup-grant')).resolves.toEqual({
      success: false,
      code: 'AUTH_SIGNUP_NICKNAME_VALIDATION_THROTTLED',
      error: '닉네임 확인 요청이 잠시 제한됐어요.',
      userActionable: false,
      retryAfterSeconds: 42,
    });
    expect(nicknamePolicy.validate).not.toHaveBeenCalled();
  });

  it.each([
    ['INVALID_FORMAT', 'AUTH_SIGNUP_NICKNAME_INVALID', 'invalid', '닉네임을 확인해주세요.'],
    [
      'MODERATION_REJECTED',
      'AUTH_SIGNUP_NICKNAME_NOT_ALLOWED',
      'moderation_rejected',
      '닉네임을 확인해주세요.',
    ],
    ['ALREADY_TAKEN', 'AUTH_NICKNAME_ALREADY_TAKEN', 'taken', '이미 사용 중인 닉네임입니다.'],
  ] as const)(
    '%s rejection을 stable %s response로 매핑한다',
    async (reason, code, metric, fieldError) => {
      nicknamePolicy.validate.mockRejectedValue(
        new DisplayIdentityNicknamePolicyError(reason, '닉네임을 확인해주세요.'),
      );

      await expect(query.execute('테스터', 'signup-grant')).resolves.toMatchObject({
        success: false,
        code,
        fieldErrors: { nickname: fieldError },
      });
      expect(metrics.recordNicknameValidation).toHaveBeenCalledWith(metric);
    },
  );
});
