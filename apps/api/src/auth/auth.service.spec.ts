import { hash as argonHash } from '@node-rs/argon2';
import { AuthService } from './auth.service.js';

describe('AuthService orchestration', () => {
  const prisma = {
    authSession: {
      updateMany: jest.fn(),
    },
    getDatabaseNow: jest.fn(),
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userProfile: {
      findUnique: jest.fn(),
    },
    verificationCode: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const verificationService = {
    maybeSendSignupCode: jest.fn(),
    maybeSendResetCode: jest.fn(),
    verifyEmailCode: jest.fn(),
    verifyResetCode: jest.fn(),
    findLatestVerifiedSignupCode: jest.fn(),
    findLatestVerifiedResetCode: jest.fn(),
    consumeVerificationCode: jest.fn(),
  };

  const sessionService = {
    getSession: jest.fn(),
    issueAuthResult: jest.fn(),
    logout: jest.fn(),
  };

  const loginAttemptService = {
    getActiveLock: jest.fn(),
    clearFailures: jest.fn(),
    recordLoginFailure: jest.fn(),
  };

  const moderationService = {
    moderatePublicText: jest.fn(),
  };

  const signupValidationService = {
    validateDraft: jest.fn(),
  };

  const service = new AuthService(
    prisma as never,
    verificationService as never,
    sessionService as never,
    loginAttemptService as never,
    moderationService as never,
    signupValidationService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    moderationService.moderatePublicText.mockResolvedValue({ ok: true });
    signupValidationService.validateDraft.mockResolvedValue({ success: true });
    prisma.getDatabaseNow.mockResolvedValue(new Date('2026-04-23T00:00:00.000Z'));
    prisma.verificationCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockResolvedValue([]);
    prisma.userProfile.findUnique.mockResolvedValue(null);
  });

  it('이미 가입된 이메일의 signup code 요청은 중립 응답을 유지한 채 코드 발급만 생략한다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    verificationService.maybeSendSignupCode.mockResolvedValue({ success: true });

    await expect(service.sendSignupCode('test@kangwon.ac.kr', '127.0.0.1')).resolves.toEqual({
      success: true,
    });

    expect(verificationService.maybeSendSignupCode).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
      true,
      '127.0.0.1',
    );
  });

  it('signup draft validation은 전용 validation service로 위임한다', async () => {
    signupValidationService.validateDraft.mockResolvedValue({
      success: false,
      code: 'AUTH_SIGNUP_VALIDATION_FAILED',
      userActionable: true,
      error: '입력값을 다시 확인해주세요.',
      fieldErrors: { nickname: '사용할 수 없는 표현이 포함되어 있습니다.' },
    });

    await expect(
      service.validateSignupProfileDraft({
        email: 'test@kangwon.ac.kr',
        password: 'Test1234',
        nickname: '섹스',
      }),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SIGNUP_VALIDATION_FAILED',
      userActionable: true,
      error: '입력값을 다시 확인해주세요.',
      fieldErrors: { nickname: '사용할 수 없는 표현이 포함되어 있습니다.' },
    });
  });

  it('존재하지 않는 계정 login은 로그인 실패 기록 서비스로 위임한다', async () => {
    loginAttemptService.getActiveLock.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    loginAttemptService.recordLoginFailure.mockResolvedValue({
      success: false,
      error: '이메일 또는 비밀번호가 올바르지 않습니다.',
      code: 'AUTH_INVALID_CREDENTIALS',
      userActionable: true,
    });

    await expect(service.login('missing@kangwon.ac.kr', 'pw', false)).resolves.toEqual({
      success: false,
      error: '이메일 또는 비밀번호가 올바르지 않습니다.',
      code: 'AUTH_INVALID_CREDENTIALS',
      userActionable: true,
    });

    expect(loginAttemptService.recordLoginFailure).toHaveBeenCalledWith('missing@kangwon.ac.kr');
  });

  it('signup은 검증 완료된 최신 code를 소비하고 세션 발급 결과를 반환한다', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.userProfile.findUnique.mockResolvedValue(null);
    verificationService.findLatestVerifiedSignupCode.mockResolvedValue({ id: 'code-1' });
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      gender: 'M',
      campus: 'CHUNCHEON',
      profile: {
        nickname: '테스터',
      },
    });
    sessionService.issueAuthResult.mockResolvedValue({
      accessToken: 'token',
      sessionId: 'session-1',
    });

    const result = await service.signup({
      email: 'test@kangwon.ac.kr',
      password: 'pass1234',
      nickname: '테스터',
      gender: 'M',
      campus: 'CHUNCHEON',
      lifestyle: {
        bedtime: '22_24',
        wakeTime: '07_08',
        sleepHabit: 'NONE',
        sleepEnvironment: 'QUIET',
        screenUsage: 'NONE',
        noiseSensitivity: 'NORMAL',
        smokingBehavior: 'NO',
        indoorEating: 'SNACK',
        phoneBehavior: 'SOMETIMES',
        earphoneUsage: 'MOSTLY',
        cleanLevel: 'WEEKLY_3_UP',
        drinkingFrequency: 'NONE',
        relationshipStyle: 'CLOSE',
        temperatureSensitivity: 'NORMAL',
        smokingTolerance: null,
        phoneTolerance: null,
        earphoneExpectation: null,
        sleepEnvPreference: null,
        screenTolerance: null,
        indoorEatingTolerance: null,
        cleanExpectation: null,
        drinkingTolerance: 'LOW_ONLY',
      },
      intro: '안녕하세요',
    });

    const [createArg] = (prisma.user.create.mock.calls[0] ?? []) as [
      {
        data: {
          emailVerifiedAt: Date;
          profile: {
            create: {
              nickname: string;
              nicknameNormalized: string;
            };
          };
        };
      }?,
    ];
    expect(createArg?.data.emailVerifiedAt).toEqual(expect.any(Date));
    expect(createArg?.data.profile.create).toMatchObject({
      nickname: '테스터',
      nicknameNormalized: '테스터',
    });
    expect(verificationService.consumeVerificationCode).toHaveBeenCalledWith('code-1');
    expect(sessionService.issueAuthResult).toHaveBeenCalledWith(
      'user-1',
      'test@kangwon.ac.kr',
      false,
    );
    expect(result).toMatchObject({
      success: true,
      accessToken: 'token',
      user: {
        id: 'user-1',
        email: 'test@kangwon.ac.kr',
        nickname: '테스터',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
    });
  });

  it('resetPassword는 verification code consume / session revoke를 Prisma transaction으로 처리한다', async () => {
    const currentPasswordHash = await argonHash('OldPass1234', {
      algorithm: 2,
      memoryCost: 8192,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      passwordHash: currentPasswordHash,
    });
    verificationService.findLatestVerifiedResetCode.mockResolvedValue({ id: 'code-1' });
    prisma.user.update.mockReturnValue('user-update');
    prisma.verificationCode.updateMany.mockReturnValue('code-update');
    prisma.authSession.updateMany.mockReturnValue('session-update');
    prisma.$transaction.mockResolvedValue(['user-update', 'code-update', 'session-update']);

    await expect(service.resetPassword('test@kangwon.ac.kr', 'NewPass1234')).resolves.toEqual({
      success: true,
    });

    expect(prisma.$transaction).toHaveBeenCalledWith([
      'user-update',
      'code-update',
      'session-update',
    ]);
  });
});
