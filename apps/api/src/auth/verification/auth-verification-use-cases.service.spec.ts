import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthVerificationUseCases } from './auth-verification-use-cases.service.js';

describe('AuthVerificationUseCases', () => {
  const verificationService = {
    maybeSendSignupCode: vi.fn(),
    maybeSendResetCode: vi.fn(),
    verifyEmailCode: vi.fn(),
    verifyResetCode: vi.fn(),
  };
  const verificationEligibilityQuery = {
    signupUserExists: vi.fn(),
    passwordResetEligible: vi.fn(),
    findPasswordResetEligibleUserId: vi.fn(),
  };
  const useCases = new AuthVerificationUseCases(
    verificationService as never,
    verificationEligibilityQuery as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invalid KNU signup email은 eligibility/service 조회 없이 실패한다', async () => {
    await expect(useCases.sendSignupCode('test@example.com', '127.0.0.1')).resolves.toMatchObject({
      success: false,
      code: 'AUTH_INVALID_EMAIL_FORMAT',
    });

    expect(verificationEligibilityQuery.signupUserExists).not.toHaveBeenCalled();
    expect(verificationService.maybeSendSignupCode).not.toHaveBeenCalled();
  });

  it('signup/reset code request는 eligibility query 결과를 verification service로 넘긴다', async () => {
    verificationEligibilityQuery.signupUserExists.mockResolvedValueOnce(true);
    verificationEligibilityQuery.passwordResetEligible.mockResolvedValueOnce(false);
    verificationService.maybeSendSignupCode.mockResolvedValueOnce({ success: true });
    verificationService.maybeSendResetCode.mockResolvedValueOnce({ success: true });

    await expect(useCases.sendSignupCode('TEST@kangwon.ac.kr', '127.0.0.1')).resolves.toEqual({
      success: true,
    });
    await expect(useCases.sendResetCode('RESET@kangwon.ac.kr', '127.0.0.1')).resolves.toEqual({
      success: true,
    });

    expect(verificationService.maybeSendSignupCode).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
      true,
      '127.0.0.1',
    );
    expect(verificationService.maybeSendResetCode).toHaveBeenCalledWith(
      'reset@kangwon.ac.kr',
      false,
      '127.0.0.1',
    );
  });

  it('verifyResetCode는 reset-eligible 계정이 아니면 neutral invalid-code로 fail-closed 한다', async () => {
    verificationEligibilityQuery.findPasswordResetEligibleUserId.mockResolvedValueOnce(null);

    await expect(
      useCases.verifyResetCode('missing@kangwon.ac.kr', '123456'),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_VERIFICATION_CODE_INVALID',
    });

    expect(verificationService.verifyResetCode).not.toHaveBeenCalled();
  });

  it('verify methods는 request context가 있을 때만 context argument를 전달한다', async () => {
    verificationEligibilityQuery.findPasswordResetEligibleUserId.mockResolvedValue('user-1');
    verificationService.verifyEmailCode.mockResolvedValue({ success: true });
    verificationService.verifyResetCode.mockResolvedValue({ success: true });

    await expect(useCases.verifyEmailCode('test@kangwon.ac.kr', '123456')).resolves.toEqual({
      success: true,
    });
    await expect(
      useCases.verifyResetCode('test@kangwon.ac.kr', '123456', {
        requestIp: '127.0.0.1',
        userAgent: 'jest',
      }),
    ).resolves.toEqual({ success: true });

    expect(verificationService.verifyEmailCode).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
      '123456',
    );
    expect(verificationService.verifyResetCode).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
      '123456',
      'user-1',
      { requestIp: '127.0.0.1', userAgent: 'jest' },
    );
  });
});
