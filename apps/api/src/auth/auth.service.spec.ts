import { AuthService } from './auth.service.js';

describe('AuthService orchestration', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $executeRaw: jest.fn(),
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
    prisma.$executeRaw.mockResolvedValue(undefined);
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
    prisma.user.findFirst.mockResolvedValue(null);
    verificationService.findLatestVerifiedSignupCode.mockResolvedValue({ id: 'code-1' });
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
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
      dormitoryId: null,
      dormitorySelectionState: 'NOT_SELECTED',
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

    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(verificationService.consumeVerificationCode).toHaveBeenCalledWith('code-1');
    expect(sessionService.issueAuthResult).toHaveBeenCalledWith(
      'user-1',
      'test@kangwon.ac.kr',
      false,
    );
    expect(result).toMatchObject({ success: true, accessToken: 'token' });
  });
});
