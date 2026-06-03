import type { ConfigType } from '@nestjs/config';
import { AuthVerificationService } from './auth-verification.service.js';
import { VERIFICATION_CODE_MAX_ATTEMPTS } from './auth.constants.js';
import { hashVerificationCode } from './auth.utils.js';
import authConfig, { DEFAULT_VERIFICATION_CODE_HMAC_SECRET } from '../config/auth.config.js';
import type { AuthSecurityEventInput } from './auth-security-event.types.js';

describe('AuthVerificationService', () => {
  const verificationStore = {
    findRetryAfterSeconds: jest.fn(),
    findBackstopRetryAfterSeconds: jest.fn(),
    createRequestLog: jest.fn(),
    findLatestVerifiedSignupCode: jest.fn(),
    findLatestVerifiedResetCode: jest.fn(),
    consumeVerificationCode: jest.fn(),
    invalidateActiveSignupCodes: jest.fn(),
    replaceActiveSignupCode: jest.fn(),
    replaceActiveResetCode: jest.fn(),
    insertVerificationCode: jest.fn(),
    findActiveVerificationRecord: jest.fn(),
    markVerified: jest.fn(),
    recordVerificationFailure: jest.fn(),
    incrementFailedAttempts: jest.fn(),
    failAndConsume: jest.fn(),
  };

  const emailSender = {
    sendVerificationCode: jest.fn(),
    sendPasswordResetCode: jest.fn(),
  };
  const securityEvents = {
    recordSafely: jest.fn<Promise<void>, [AuthSecurityEventInput]>().mockResolvedValue(undefined),
  };

  const authSettings: ConfigType<typeof authConfig> = {
    verificationCodeHmacSecret: DEFAULT_VERIFICATION_CODE_HMAC_SECRET,
    codeRequestCooldownSeconds: 5,
    codeRequestBackstopWindowSeconds: 600,
    codeRequestBackstopLimit: 20,
    authThrottleLimit: 300,
  };

  const service = new AuthVerificationService(
    verificationStore as never,
    emailSender as never,
    authSettings,
    securityEvents as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    verificationStore.findRetryAfterSeconds.mockResolvedValue(null);
    verificationStore.findBackstopRetryAfterSeconds.mockResolvedValue(null);
    verificationStore.markVerified.mockResolvedValue(true);
    verificationStore.recordVerificationFailure.mockResolvedValue({
      recorded: true,
      consumed: false,
    });
  });

  it('signup 완료용 verified code 조회는 store로 위임한다', async () => {
    verificationStore.findLatestVerifiedSignupCode.mockResolvedValue(null);

    await service.findLatestVerifiedSignupCode('test@kangwon.ac.kr');

    expect(verificationStore.findLatestVerifiedSignupCode).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
      expect.any(Number),
    );
  });

  it('signup code 재발급 시 serializable helper 경로로 active signup code를 교체한다', async () => {
    emailSender.sendVerificationCode.mockResolvedValue(undefined);

    await service.maybeSendSignupCode('test@kangwon.ac.kr', false, '127.0.0.1');

    expect(verificationStore.replaceActiveSignupCode).toHaveBeenCalledWith(
      expect.objectContaining({ emailNormalized: 'test@kangwon.ac.kr' }),
    );
    expect(emailSender.sendVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({ expiresInSeconds: 600 }),
    );
    expect(securityEvents.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'VERIFICATION_CODE_REQUESTED',
        emailNormalized: 'test@kangwon.ac.kr',
        requestIp: '127.0.0.1',
        metadata: {
          purpose: 'SIGNUP',
          metricName: 'auth.signup.code.request',
        },
      }),
    );
  });

  it('새 verification code는 HMAC prefix가 포함된 hash로 저장한다', async () => {
    emailSender.sendVerificationCode.mockResolvedValue(undefined);

    await service.maybeSendSignupCode('test@kangwon.ac.kr', false, '127.0.0.1');

    const [replaceArg] = (verificationStore.replaceActiveSignupCode.mock.calls[0] ?? []) as [
      { codeHash: string }?,
    ];

    expect(replaceArg?.codeHash).toMatch(/^hmac-sha256:[0-9a-f]{64}$/);
  });

  it('reset code는 완화된 600초 TTL과 serializable 교체 경로를 사용한다', async () => {
    emailSender.sendPasswordResetCode.mockResolvedValue(undefined);

    await service.maybeSendResetCode('test@kangwon.ac.kr', true, '127.0.0.1');

    expect(verificationStore.replaceActiveResetCode).toHaveBeenCalledWith(
      expect.objectContaining({ emailNormalized: 'test@kangwon.ac.kr' }),
    );
    expect(verificationStore.insertVerificationCode).not.toHaveBeenCalled();
    expect(emailSender.sendPasswordResetCode).toHaveBeenCalledWith(
      expect.objectContaining({ expiresInSeconds: 600 }),
    );
  });

  it('reset verified code 조회는 store로 위임한다', async () => {
    verificationStore.findLatestVerifiedResetCode.mockResolvedValue(null);

    await service.findLatestVerifiedResetCode('test@kangwon.ac.kr');

    expect(verificationStore.findLatestVerifiedResetCode).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
    );
  });

  it('email+purpose backstop 제한이 걸리면 code 요청을 차단한다', async () => {
    verificationStore.findBackstopRetryAfterSeconds.mockResolvedValue(120);

    expect.assertions(1);

    try {
      await service.maybeSendSignupCode('test@kangwon.ac.kr', false, '127.0.0.1');
    } catch (error) {
      expect(error).toMatchObject({
        response: {
          code: 'AUTH_CODE_REQUEST_THROTTLED',
          retryAfterSeconds: 120,
        },
      });
    }
  });

  it('reset code 요청은 user가 없으면 이메일 발송 없이 중립 성공을 유지한다', async () => {
    emailSender.sendPasswordResetCode.mockResolvedValue(undefined);

    await expect(
      service.maybeSendResetCode('missing@kangwon.ac.kr', false, '127.0.0.1'),
    ).resolves.toEqual({
      success: true,
    });

    expect(verificationStore.replaceActiveResetCode).not.toHaveBeenCalled();
    expect(verificationStore.insertVerificationCode).not.toHaveBeenCalled();
    expect(emailSender.sendPasswordResetCode).not.toHaveBeenCalled();
    expect(verificationStore.createRequestLog).toHaveBeenCalledWith(
      'missing@kangwon.ac.kr',
      'RESET_PASSWORD',
      '127.0.0.1',
    );
  });

  it('올바른 verification code는 verified 처리한다', async () => {
    verificationStore.findActiveVerificationRecord.mockResolvedValue({
      id: 'code-1',
      codeHash: hashVerificationCode(
        'test@kangwon.ac.kr',
        'SIGNUP',
        '123456',
        DEFAULT_VERIFICATION_CODE_HMAC_SECRET,
      ),
      failedAttempts: 0,
    });

    await expect(service.verifyEmailCode('test@kangwon.ac.kr', '123456')).resolves.toEqual({
      success: true,
    });

    expect(verificationStore.markVerified).toHaveBeenCalledWith({
      id: 'code-1',
      emailNormalized: 'test@kangwon.ac.kr',
      purpose: 'SIGNUP',
      maxAttempts: VERIFICATION_CODE_MAX_ATTEMPTS,
    });
    expect(securityEvents.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'VERIFICATION_CODE_VERIFY_SUCCESS',
        emailNormalized: 'test@kangwon.ac.kr',
        metadata: { purpose: 'SIGNUP' },
      }),
    );
  });

  it('잘못된 verification code는 failedAttempts를 증가시킨다', async () => {
    verificationStore.findActiveVerificationRecord.mockResolvedValue({
      id: 'code-1',
      codeHash: hashVerificationCode(
        'test@kangwon.ac.kr',
        'SIGNUP',
        '123456',
        DEFAULT_VERIFICATION_CODE_HMAC_SECRET,
      ),
      failedAttempts: 0,
    });

    await expect(service.verifyEmailCode('test@kangwon.ac.kr', '654321')).resolves.toMatchObject({
      success: false,
      code: 'AUTH_VERIFICATION_CODE_INVALID',
    });

    expect(verificationStore.recordVerificationFailure).toHaveBeenCalledWith({
      id: 'code-1',
      emailNormalized: 'test@kangwon.ac.kr',
      purpose: 'SIGNUP',
      maxAttempts: VERIFICATION_CODE_MAX_ATTEMPTS,
    });
    expect(verificationStore.incrementFailedAttempts).not.toHaveBeenCalled();
    expect(verificationStore.failAndConsume).not.toHaveBeenCalled();
    expect(securityEvents.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'VERIFICATION_CODE_VERIFY_FAILURE',
        severity: 'WARNING',
        emailNormalized: 'test@kangwon.ac.kr',
        metadata: { purpose: 'SIGNUP', reason: 'invalid_code' },
      }),
    );
  });

  it('잘못된 verification code가 최대 시도에 도달하면 즉시 consume한다', async () => {
    verificationStore.findActiveVerificationRecord.mockResolvedValue({
      id: 'code-1',
      codeHash: hashVerificationCode(
        'test@kangwon.ac.kr',
        'RESET_PASSWORD',
        '123456',
        DEFAULT_VERIFICATION_CODE_HMAC_SECRET,
      ),
      failedAttempts: 4,
    });

    await expect(service.verifyResetCode('test@kangwon.ac.kr', '654321')).resolves.toMatchObject({
      success: false,
      code: 'AUTH_VERIFICATION_CODE_INVALID',
    });

    expect(verificationStore.recordVerificationFailure).toHaveBeenCalledWith({
      id: 'code-1',
      emailNormalized: 'test@kangwon.ac.kr',
      purpose: 'RESET_PASSWORD',
      maxAttempts: VERIFICATION_CODE_MAX_ATTEMPTS,
    });
    expect(verificationStore.failAndConsume).not.toHaveBeenCalled();
    expect(verificationStore.incrementFailedAttempts).not.toHaveBeenCalled();
  });
});
