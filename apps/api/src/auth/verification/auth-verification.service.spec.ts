import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigType } from '@nestjs/config';
import { AuthVerificationService } from './auth-verification.service.js';
import { AUTH_VERIFICATION_CODE_MAX_ATTEMPTS } from '@repo/shared/auth/policy';
import { hashVerificationCode } from './challenge/verification-code.crypto.js';
import authConfig, {
  DEFAULT_AUTH_PERSISTENCE_HMAC_SECRET,
  DEFAULT_AUTH_PERSISTENCE_HMAC_KEY_VERSION,
  DEFAULT_AUTH_MAIL_ENVELOPE_ENCRYPTION_KEY_BASE64,
  DEFAULT_VERIFICATION_CODE_HMAC_SECRET,
} from '../config/auth.config.js';
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
  const verificationRequests = {
    findRetryAfterSeconds: vi.fn(),
    findBackstopRetryAfterSeconds: vi.fn(),
    append: vi.fn(),
  };
  const verificationChallenges = {
    findActive: vi.fn(),
    markVerifiedAndIssueGrant: vi.fn(),
    recordFailure: vi.fn(),
    incrementFailedAttempts: vi.fn(),
    failAndConsume: vi.fn(),
  };
  const verificationGrants = {
    resolve: vi.fn(),
  };
  const mailEnvelopeWriter = {
    encrypt: vi.fn().mockReturnValue({
      payloadCiphertext: Buffer.from('ciphertext'),
      payloadIv: Buffer.from('123456789012'),
      payloadAuthTag: Buffer.from('1234567890123456'),
      keyVersion: 'test-v1',
    }),
  };
  const securityEvents = {
    recordSafely: vi
      .fn<(arg0: AuthSecurityEventInput) => Promise<void>>()
      .mockResolvedValue(undefined),
    toPersistenceData: vi.fn((input: AuthSecurityEventInput) => ({
      type: input.type,
      severity: input.severity,
      metadata: input.metadata,
    })),
  };
  const metrics = {
    record: vi.fn(),
  };

  const authSettings: ConfigType<typeof authConfig> = {
    verificationCodeHmacSecret: DEFAULT_VERIFICATION_CODE_HMAC_SECRET,
    persistenceHmacSecret: DEFAULT_AUTH_PERSISTENCE_HMAC_SECRET,
    persistenceHmacKeyVersion: DEFAULT_AUTH_PERSISTENCE_HMAC_KEY_VERSION,
    mailEnvelopeEncryptionKeyBase64: DEFAULT_AUTH_MAIL_ENVELOPE_ENCRYPTION_KEY_BASE64,
    mailEnvelopeKeyVersion: 'test-v1',
    mailDispatcherEnabled: false,
    mailDispatcherIntervalMs: 1_000,
    mailDispatcherBatchSize: 20,
    mailDispatcherClaimLeaseMs: 30_000,
    mailSendTimeoutMs: 5_000,
    codeRequestCooldownSeconds: 5,
    codeRequestBackstopWindowSeconds: 600,
    codeRequestBackstopLimit: 20,
    authThrottleLimit: 300,
    authLoginBurstLimit: 30,
    authLoginBurstWindowSeconds: 60,
    authLoginSustainedLimit: 120,
    authLoginSustainedWindowSeconds: 600,
    authChangePasswordLimit: 10,
    authChangePasswordWindowSeconds: 600,
    authPasswordHashConcurrency: 4,
    authPasswordHashQueueLimit: 32,
    authPasswordHashWaitTimeoutMs: 2_000,
    renewalPreviousTokenGraceEnabled: true,
  };

  const service = new AuthVerificationService(
    verificationRequests as never,
    verificationChallenges as never,
    verificationGrants as never,
    mailEnvelopeWriter as never,
    authSettings,
    securityEvents as never,
    metrics,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    verificationRequests.findRetryAfterSeconds.mockResolvedValue(null);
    verificationRequests.findBackstopRetryAfterSeconds.mockResolvedValue(null);
    verificationChallenges.markVerifiedAndIssueGrant.mockResolvedValue(true);
    verificationChallenges.recordFailure.mockResolvedValue({
      recorded: true,
      consumed: false,
    });
  });

  it('signup code 재발급 시 serializable helper 경로로 active signup code를 교체한다', async () => {
    await service.maybeSendSignupCode('test@kangwon.ac.kr', false, '127.0.0.1');

    const signupRequest = verificationRequests.append.mock.calls[0]?.[0] as
      | {
          subjectKey: string;
          requestIpKey: string;
          purpose: string;
          candidate: { subjectKey: string; requestIpKey: string; ttlSeconds: number };
        }
      | undefined;
    expect(signupRequest).toMatchObject({
      subjectKey,
      requestIpKey,
      purpose: 'SIGNUP',
      candidate: {
        subjectKey,
        requestIpKey,
        ttlSeconds: 600,
      },
    });
    expect(mailEnvelopeWriter.encrypt).toHaveBeenCalledWith(
      expect.objectContaining({
        mailKind: 'SIGNUP_VERIFICATION',
        email: 'test@kangwon.ac.kr',
        expiresInSeconds: 600,
      }),
    );
    expect(securityEvents.toPersistenceData).toHaveBeenCalledWith(
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
    expect(metrics.record).toHaveBeenCalledWith('SIGNUP', 'request', 'accepted');
  });

  it('새 verification code는 HMAC prefix가 포함된 hash로 저장한다', async () => {
    await service.maybeSendSignupCode('test@kangwon.ac.kr', false, '127.0.0.1');

    const [appendArg] = (verificationRequests.append.mock.calls[0] ?? []) as [
      { candidate?: { codeHash: string } }?,
    ];

    expect(appendArg?.candidate?.codeHash).toMatch(/^hmac-sha256:[0-9a-f]{64}$/);
  });

  it('reset code는 완화된 600초 TTL과 serializable 교체 경로를 사용한다', async () => {
    await service.maybeSendResetCode('test@kangwon.ac.kr', true, '127.0.0.1');

    const resetRequest = verificationRequests.append.mock.calls[0]?.[0] as
      | {
          subjectKey: string;
          requestIpKey: string;
          purpose: string;
          candidate: { ttlSeconds: number };
        }
      | undefined;
    expect(resetRequest).toMatchObject({
      subjectKey,
      requestIpKey,
      purpose: 'RESET_PASSWORD',
      candidate: { ttlSeconds: 600 },
    });
  });

  it('메일 provider lifecycle과 분리된 요청 append 뒤 공개 응답은 중립 성공을 유지한다', async () => {
    await expect(
      service.maybeSendResetCode('test@kangwon.ac.kr', true, '127.0.0.1'),
    ).resolves.toEqual({ success: true });
    expect(verificationRequests.append).toHaveBeenCalledOnce();
  });

  it('email+purpose backstop 제한이 걸리면 code 요청을 차단한다', async () => {
    verificationRequests.findBackstopRetryAfterSeconds.mockResolvedValue(120);

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
    await expect(
      service.maybeSendResetCode('missing@kangwon.ac.kr', false, '127.0.0.1'),
    ).resolves.toEqual({
      success: true,
    });

    expect(verificationRequests.append).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectKey: missingSubjectKey,
        purpose: 'RESET_PASSWORD',
        requestIpKey,
        candidate: null,
      }),
    );
  });

  it('eligible 여부와 관계없이 공개 code 요청은 같은 최소 응답 시간 범주를 유지한다', async () => {
    const eligibleStartedAt = performance.now();
    await service.maybeSendResetCode('test@kangwon.ac.kr', true, '127.0.0.1');
    const eligibleDuration = performance.now() - eligibleStartedAt;

    const ineligibleStartedAt = performance.now();
    await service.maybeSendResetCode('missing@kangwon.ac.kr', false, '127.0.0.1');
    const ineligibleDuration = performance.now() - ineligibleStartedAt;

    expect(eligibleDuration).toBeGreaterThanOrEqual(350);
    expect(ineligibleDuration).toBeGreaterThanOrEqual(350);
    expect(Math.abs(eligibleDuration - ineligibleDuration)).toBeLessThan(150);
  });

  it('올바른 verification code는 verified 처리한다', async () => {
    verificationChallenges.findActive.mockResolvedValue({
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

    const issueGrantInput = verificationChallenges.markVerifiedAndIssueGrant.mock.calls[0]?.[0] as
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
      maxAttempts: AUTH_VERIFICATION_CODE_MAX_ATTEMPTS,
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
    verificationChallenges.findActive.mockResolvedValue({
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

    expect(verificationChallenges.recordFailure).toHaveBeenCalledWith({
      id: 'code-1',
      subjectKey,
      purpose: 'SIGNUP',
      maxAttempts: AUTH_VERIFICATION_CODE_MAX_ATTEMPTS,
    });
    expect(verificationChallenges.incrementFailedAttempts).not.toHaveBeenCalled();
    expect(verificationChallenges.failAndConsume).not.toHaveBeenCalled();
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
    verificationChallenges.findActive.mockResolvedValue({
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

    expect(verificationChallenges.recordFailure).toHaveBeenCalledWith({
      id: 'code-1',
      subjectKey,
      purpose: 'RESET_PASSWORD',
      maxAttempts: AUTH_VERIFICATION_CODE_MAX_ATTEMPTS,
    });
    expect(verificationChallenges.failAndConsume).not.toHaveBeenCalled();
    expect(verificationChallenges.incrementFailedAttempts).not.toHaveBeenCalled();
  });
});
