import { AuthVerificationService } from './auth-verification.service.js';

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
    insertVerificationCode: jest.fn(),
    findActiveVerificationRecord: jest.fn(),
    markVerified: jest.fn(),
    incrementFailedAttempts: jest.fn(),
    failAndConsume: jest.fn(),
  };

  const emailSender = {
    sendVerificationCode: jest.fn(),
    sendPasswordResetCode: jest.fn(),
  };

  const service = new AuthVerificationService(verificationStore as never, emailSender as never);

  beforeEach(() => {
    jest.clearAllMocks();
    verificationStore.findRetryAfterSeconds.mockResolvedValue(null);
    verificationStore.findBackstopRetryAfterSeconds.mockResolvedValue(null);
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
  });

  it('새 verification code는 HMAC prefix가 포함된 hash로 저장한다', async () => {
    emailSender.sendVerificationCode.mockResolvedValue(undefined);

    await service.maybeSendSignupCode('test@kangwon.ac.kr', false, '127.0.0.1');

    const [replaceArg] = (verificationStore.replaceActiveSignupCode.mock.calls[0] ?? []) as [
      { codeHash: string }?,
    ];

    expect(replaceArg?.codeHash).toMatch(/^hmac-sha256:[0-9a-f]{64}$/);
  });

  it('reset code는 완화된 600초 TTL을 사용한다', async () => {
    emailSender.sendPasswordResetCode.mockResolvedValue(undefined);

    await service.maybeSendResetCode('test@kangwon.ac.kr', true, '127.0.0.1');

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
});
