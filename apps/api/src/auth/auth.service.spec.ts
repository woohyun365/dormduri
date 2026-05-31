import { hash as argonHash } from '@node-rs/argon2';
import { AuthService } from './auth.service.js';

describe('AuthService orchestration', () => {
  const prisma = {
    authSession: {
      updateMany: jest.fn(),
    },
    getDatabaseNow: jest.fn(),
    runSerializableTransaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userDisplayIdentity: {
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
    prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        verificationCode: { updateMany: prisma.verificationCode.updateMany },
        authSession: { updateMany: prisma.authSession.updateMany },
        user: { ...prisma.user, create: prisma.user.create, update: prisma.user.update },
      }),
    );
    prisma.userDisplayIdentity.findUnique.mockResolvedValue(null);
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

  it('존재하지 않는 계정의 reset code 요청도 중립 성공 응답을 유지한다', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    verificationService.maybeSendResetCode.mockResolvedValue({ success: true });

    await expect(service.sendResetCode('missing@kangwon.ac.kr', '127.0.0.1')).resolves.toEqual({
      success: true,
    });

    expect(verificationService.maybeSendResetCode).toHaveBeenCalledWith(
      'missing@kangwon.ac.kr',
      false,
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
      service.validateSignupDraft({
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

    expect(signupValidationService.validateDraft).toHaveBeenCalledWith({
      email: 'test@kangwon.ac.kr',
      password: 'Test1234',
      nickname: '섹스',
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

  it('삭제 처리된 계정 login은 실패 기록으로 위임하고 세션을 발급하지 않는다', async () => {
    loginAttemptService.getActiveLock.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-deleted',
      email: 'deleted@kangwon.ac.kr',
      passwordHash: 'deleted-password-hash',
      deletedAt: new Date('2026-05-12T00:00:00.000Z'),
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: {
        nickname: '탈퇴한 사용자',
      },
    });
    loginAttemptService.recordLoginFailure.mockResolvedValue({
      success: false,
      error: '이메일 또는 비밀번호가 올바르지 않습니다.',
      code: 'AUTH_INVALID_CREDENTIALS',
      userActionable: true,
    });

    await expect(service.login('deleted@kangwon.ac.kr', 'Pass1234', false)).resolves.toEqual({
      success: false,
      error: '이메일 또는 비밀번호가 올바르지 않습니다.',
      code: 'AUTH_INVALID_CREDENTIALS',
      userActionable: true,
    });

    expect(loginAttemptService.recordLoginFailure).toHaveBeenCalledWith('deleted@kangwon.ac.kr');
    expect(loginAttemptService.clearFailures).not.toHaveBeenCalled();
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
  });

  it('활성 잠금이 있으면 login은 즉시 잠금 응답을 반환한다', async () => {
    loginAttemptService.getActiveLock.mockResolvedValue({
      success: false,
      error: '로그인 시도가 5회 실패하여 계정이 5분간 잠겼습니다.',
      code: 'AUTH_LOGIN_LOCKED',
      userActionable: false,
      locked: true,
      remainingSeconds: 120,
    });

    await expect(service.login('test@kangwon.ac.kr', 'pass1234', false)).resolves.toMatchObject({
      success: false,
      code: 'AUTH_LOGIN_LOCKED',
      locked: true,
      remainingSeconds: 120,
    });

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('정상 login은 failure를 clear하고 세션을 발급한다', async () => {
    const passwordHash = await argonHash('Pass1234', {
      algorithm: 2,
      memoryCost: 8192,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });
    loginAttemptService.getActiveLock.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      passwordHash,
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: {
        nickname: '테스터',
      },
    });
    sessionService.issueAuthResult.mockResolvedValue({
      accessToken: 'token',
      sessionId: 'session-1',
    });

    await expect(service.login('test@kangwon.ac.kr', 'Pass1234', true)).resolves.toMatchObject({
      success: true,
      accessToken: 'token',
      user: {
        id: 'user-1',
        email: 'test@kangwon.ac.kr',
        nickname: '테스터',
      },
    });

    expect(loginAttemptService.clearFailures).toHaveBeenCalledWith('test@kangwon.ac.kr');
    expect(sessionService.issueAuthResult).toHaveBeenCalledWith(
      'user-1',
      'test@kangwon.ac.kr',
      true,
    );
  });

  it('display identity가 없는 계정 login은 인증 성공으로 보지 않고 실패 횟수를 기록한다', async () => {
    const passwordHash = await argonHash('Pass1234', {
      algorithm: 2,
      memoryCost: 8192,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });
    loginAttemptService.getActiveLock.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-missing-identity',
      email: 'missing-identity@kangwon.ac.kr',
      passwordHash,
      deletedAt: null,
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: null,
    });
    loginAttemptService.recordLoginFailure.mockResolvedValue({
      success: false,
      error: '이메일 또는 비밀번호가 올바르지 않습니다.',
      code: 'AUTH_INVALID_CREDENTIALS',
      userActionable: true,
    });

    await expect(
      service.login('missing-identity@kangwon.ac.kr', 'Pass1234', false),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_INVALID_CREDENTIALS',
    });

    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
    expect(loginAttemptService.recordLoginFailure).toHaveBeenCalledWith(
      'missing-identity@kangwon.ac.kr',
    );
    expect(loginAttemptService.clearFailures).not.toHaveBeenCalled();
  });

  it('signup은 검증 완료된 최신 code를 소비하고 세션 발급 결과를 반환한다', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.userDisplayIdentity.findUnique.mockResolvedValue(null);
    verificationService.findLatestVerifiedSignupCode.mockResolvedValue({ id: 'code-1' });
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: {
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
      collegeCode: 'IT',
      birthYear: 2002,
    } as never);

    const [createArg] = (prisma.user.create.mock.calls[0] ?? []) as [
      {
        data: {
          emailVerifiedAt: Date;
          displayIdentity: {
            create: {
              nickname: string;
              nicknameNormalized: string;
            };
          };
          academicIdentity: {
            create: {
              collegeCode: string;
              birthYear: number;
            };
          };
        };
      }?,
    ];
    expect(createArg?.data.emailVerifiedAt).toEqual(expect.any(Date));
    expect(createArg?.data.displayIdentity.create).toMatchObject({
      nickname: '테스터',
      nicknameNormalized: '테스터',
    });
    expect(createArg?.data.academicIdentity.create).toMatchObject({
      collegeCode: 'IT',
      birthYear: 2002,
    });
    expect(createArg?.data).not.toHaveProperty('profile');
    expect(moderationService.moderatePublicText).not.toHaveBeenCalled();
    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    const [verificationUpdateArg] = (prisma.verificationCode.updateMany.mock.calls[0] ?? []) as [
      {
        where: { id: string; consumedAt: null };
        data: { consumedAt: Date };
      }?,
    ];
    expect(verificationUpdateArg?.where).toEqual({ id: 'code-1', consumedAt: null });
    expect(verificationUpdateArg?.data.consumedAt).toEqual(expect.any(Date));
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

  it('signup verification proof가 동시 소모되면 계정 생성 대신 verification required를 반환한다', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.userDisplayIdentity.findUnique.mockResolvedValue(null);
    verificationService.findLatestVerifiedSignupCode.mockResolvedValue({ id: 'code-1' });
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: {
        nickname: '테스터',
      },
    });
    prisma.verificationCode.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.signup({
        email: 'test@kangwon.ac.kr',
        password: 'pass1234',
        nickname: '테스터',
        gender: 'M',
        campus: 'CHUNCHEON',
        collegeCode: 'IT',
        birthYear: 2002,
      } as never),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED',
    });

    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
  });

  it('signup transaction에서 display identity가 생성되지 않으면 verification consume과 세션 발급을 중단한다', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.userDisplayIdentity.findUnique.mockResolvedValue(null);
    verificationService.findLatestVerifiedSignupCode.mockResolvedValue({ id: 'code-1' });
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: null,
    });

    await expect(
      service.signup({
        email: 'test@kangwon.ac.kr',
        password: 'pass1234',
        nickname: '테스터',
        gender: 'M',
        campus: 'CHUNCHEON',
        collegeCode: 'IT',
        birthYear: 2002,
      } as never),
    ).rejects.toThrow('[AuthSignupOwner] user display identity row is required');

    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    expect(prisma.verificationCode.updateMany).not.toHaveBeenCalled();
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
  });

  it('resetPassword는 verification code consume / session revoke를 serializable transaction으로 처리한다', async () => {
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
    prisma.user.update.mockResolvedValue(undefined);
    prisma.verificationCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.resetPassword('test@kangwon.ac.kr', 'NewPass1234')).resolves.toEqual({
      success: true,
    });

    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    const consumeCalls = prisma.verificationCode.updateMany.mock.calls as Array<
      [
        {
          where: { id: string; consumedAt: null };
          data: { consumedAt: Date };
        },
      ]
    >;
    const consumeCall = consumeCalls[0]?.[0];
    if (!consumeCall) {
      throw new Error('verificationCode.updateMany call was not captured');
    }
    expect(consumeCall.where).toEqual({ id: 'code-1', consumedAt: null });
    expect(consumeCall.data.consumedAt).toBeInstanceOf(Date);

    const updateUserCalls = prisma.user.update.mock.calls as Array<
      [
        {
          where: { id: string };
          data: { passwordHash: string };
        },
      ]
    >;
    const updateUserCall = updateUserCalls[0]?.[0];
    if (!updateUserCall) {
      throw new Error('user.update call was not captured');
    }
    expect(updateUserCall.where).toEqual({ id: 'user-1' });
    expect(typeof updateUserCall.data.passwordHash).toBe('string');

    const revokeSessionCalls = prisma.authSession.updateMany.mock.calls as Array<
      [
        {
          where: { userId: string; revokedAt: null };
          data: { revokedAt: Date };
        },
      ]
    >;
    const revokeSessionsCall = revokeSessionCalls[0]?.[0];
    if (!revokeSessionsCall) {
      throw new Error('authSession.updateMany call was not captured');
    }
    expect(revokeSessionsCall.where).toEqual({ userId: 'user-1', revokedAt: null });
    expect(revokeSessionsCall.data.revokedAt).toBeInstanceOf(Date);
  });

  it('reset verification proof가 먼저 소비되면 resetRestartRequired를 반환한다', async () => {
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
    prisma.verificationCode.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.resetPassword('test@kangwon.ac.kr', 'NewPass1234')).resolves.toMatchObject(
      {
        success: false,
        code: 'AUTH_RESET_RESTART_REQUIRED',
      },
    );

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
