import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigType } from '@nestjs/config';
import { AuthVerificationService } from './auth-verification.service.js';
import { VERIFICATION_CODE_MAX_ATTEMPTS } from '../domain/auth.constants.js';
import { hashVerificationCode } from '../domain/auth.utils.js';
import authConfig, {
  DEFAULT_AUTH_PERSISTENCE_HMAC_SECRET,
  DEFAULT_VERIFICATION_CODE_HMAC_SECRET,
} from '../../config/auth.config.js';
import type { AuthSecurityEventInput } from '../security-events/auth-security-event.types.js';
import { hashAuthPersistenceDimension } from '../persistence/auth-persistence-dimension.js';

describe('AuthVerificationService', () => {
  const subjectKey = hashAuthPersistenceDimension(
    'subject',
    'test@kangwon.ac.kr',
    DEFAULT_AUTH_PERSISTENCE_HMAC_SECRET,
  );
  const missingSubjectKey = hashAuthPersistenceDimension(
    'subject',
    'missing@kangwon.ac.kr',
    DEFAULT_AUTH_PERSISTENCE_HMAC_SECRET,
  );
  const requestIpKey = hashAuthPersistenceDimension(
    'request-ip',
    '127.0.0.1',
    DEFAULT_AUTH_PERSISTENCE_HMAC_SECRET,
  );
  const verificationStore = {
    findRetryAfterSeconds: vi.fn(),
    findBackstopRetryAfterSeconds: vi.fn(),
    createRequestLog: vi.fn(),
    replaceActiveSignupCode: vi.fn(),
    replaceActiveResetCode: vi.fn(),
    findActiveVerificationRecord: vi.fn(),
    markVerifiedAndIssueGrant: vi.fn(),
    resolveVerificationGrant: vi.fn(),
    recordVerificationFailure: vi.fn(),
    incrementFailedAttempts: vi.fn(),
    failAndConsume: vi.fn(),
  };

  const emailSender = {
    sendVerificationCode: vi.fn(),
    sendPasswordResetCode: vi.fn(),
  };
  const securityEvents = {
    recordSafely: vi
      .fn<(arg0: AuthSecurityEventInput) => Promise<void>>()
      .mockResolvedValue(undefined),
  };

  const authSettings: ConfigType<typeof authConfig> = {
    verificationCodeHmacSecret: DEFAULT_VERIFICATION_CODE_HMAC_SECRET,
    persistenceHmacSecret: DEFAULT_AUTH_PERSISTENCE_HMAC_SECRET,
    codeRequestCooldownSeconds: 5,
    codeRequestBackstopWindowSeconds: 600,
    codeRequestBackstopLimit: 20,
    authThrottleLimit: 300,
    authLoginBurstLimit: 30,
    authLoginBurstWindowSeconds: 60,
    authLoginSustainedLimit: 120,
    authLoginSustainedWindowSeconds: 600,
    renewalPreviousTokenGraceEnabled: true,
  };

  const service = new AuthVerificationService(
    verificationStore as never,
    emailSender,
    authSettings,
    securityEvents as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    verificationStore.findRetryAfterSeconds.mockResolvedValue(null);
    verificationStore.findBackstopRetryAfterSeconds.mockResolvedValue(null);
    verificationStore.markVerifiedAndIssueGrant.mockResolvedValue(true);
    verificationStore.recordVerificationFailure.mockResolvedValue({
      recorded: true,
      consumed: false,
    });
  });

  it('signup code 재발급 시 serializable helper 경로로 active signup code를 교체한다', async () => {
    emailSender.sendVerificationCode.mockResolvedValue(undefined);

    await service.maybeSendSignupCode('test@kangwon.ac.kr', false, '127.0.0.1');

    expect(verificationStore.replaceActiveSignupCode).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectKey,
        requestIpKey,
      }),
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
      expect.objectContaining({
        subjectKey,
        requestIpKey,
      }),
    );
    expect(emailSender.sendPasswordResetCode).toHaveBeenCalledWith(
      expect.objectContaining({ expiresInSeconds: 600 }),
    );
  });

  it.fails(
    '메일 provider 실패는 기존 활성 reset code를 교체하거나 공개 응답을 바꾸지 않는다',
    async () => {
      emailSender.sendPasswordResetCode.mockRejectedValue(new Error('provider unavailable'));

      const result = await service
        .maybeSendResetCode('test@kangwon.ac.kr', true, '127.0.0.1')
        .catch((error: unknown) => error);

      expect(result).toEqual({ success: true });
      expect(verificationStore.replaceActiveResetCode).not.toHaveBeenCalled();
    },
  );

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
    expect(emailSender.sendPasswordResetCode).not.toHaveBeenCalled();
    expect(verificationStore.createRequestLog).toHaveBeenCalledWith(
      missingSubjectKey,
      'RESET_PASSWORD',
      requestIpKey,
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

    const result = await service.verifyEmailCode('test@kangwon.ac.kr', '123456');

    expect(result).toMatchObject({
      success: true,
      grantExpiresInSeconds: 900,
    });
    expect(result.signupGrant).toMatch(/^v1\.code-1\.[A-Za-z0-9_-]{43}$/);

    const issueGrantInput = verificationStore.markVerifiedAndIssueGrant.mock.calls[0]?.[0] as
      | {
          id: string;
          subjectKey: string;
          purpose: string;
          maxAttempts: number;
          grantTokenHash: string;
          grantTtlSeconds: number;
          eligibleUserId: string | null;
        }
      | undefined;
    expect(issueGrantInput).toMatchObject({
      id: 'code-1',
      subjectKey,
      purpose: 'SIGNUP',
      maxAttempts: VERIFICATION_CODE_MAX_ATTEMPTS,
      grantTtlSeconds: 900,
      eligibleUserId: null,
    });
    expect(issueGrantInput?.grantTokenHash).toMatch(/^[0-9a-f]{64}$/);
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
      subjectKey,
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

    await expect(
      service.verifyResetCode('test@kangwon.ac.kr', '654321', 'user-1'),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_VERIFICATION_CODE_INVALID',
    });

    expect(verificationStore.recordVerificationFailure).toHaveBeenCalledWith({
      id: 'code-1',
      subjectKey,
      purpose: 'RESET_PASSWORD',
      maxAttempts: VERIFICATION_CODE_MAX_ATTEMPTS,
    });
    expect(verificationStore.failAndConsume).not.toHaveBeenCalled();
    expect(verificationStore.incrementFailedAttempts).not.toHaveBeenCalled();
  });
});
