import { hash as argonHash } from '@node-rs/argon2';
import { AuthService } from './auth.service.js';

describe('AuthService orchestration', () => {
  const prisma = {
    authSession: {
      findFirst: jest.fn(),
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
    $queryRawTyped: jest.fn(),
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
    renewSession: jest.fn(),
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
    prisma.$queryRawTyped.mockResolvedValue([{ id: 'code-1' }]);
    prisma.$transaction.mockResolvedValue([]);
    prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        $queryRawTyped: prisma.$queryRawTyped,
        verificationCode: { updateMany: prisma.verificationCode.updateMany },
        authSession: {
          findFirst: prisma.authSession.findFirst,
          updateMany: prisma.authSession.updateMany,
        },
        user: { ...prisma.user, create: prisma.user.create, update: prisma.user.update },
      }),
    );
    prisma.authSession.findFirst.mockResolvedValue({
      id: 'session-1',
      rememberMe: false,
    });
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

  it('삭제/미인증 계정의 reset code 요청도 중립 성공을 유지하고 코드 발급 eligibility를 false로 전달한다', async () => {
    verificationService.maybeSendResetCode.mockResolvedValue({ success: true });

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-deleted',
      deletedAt: new Date('2026-05-12T00:00:00.000Z'),
      emailVerifiedAt: new Date('2026-04-23T00:00:00.000Z'),
    });
    await expect(service.sendResetCode('deleted@kangwon.ac.kr', '127.0.0.1')).resolves.toEqual({
      success: true,
    });
    expect(verificationService.maybeSendResetCode).toHaveBeenLastCalledWith(
      'deleted@kangwon.ac.kr',
      false,
      '127.0.0.1',
    );

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-unverified',
      deletedAt: null,
      emailVerifiedAt: null,
    });
    await expect(service.sendResetCode('unverified@kangwon.ac.kr', '127.0.0.1')).resolves.toEqual({
      success: true,
    });
    expect(verificationService.maybeSendResetCode).toHaveBeenLastCalledWith(
      'unverified@kangwon.ac.kr',
      false,
      '127.0.0.1',
    );
  });

  it('active+verified 계정의 reset code 요청만 code 발급 eligibility를 true로 전달한다', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-verified',
      deletedAt: null,
      emailVerifiedAt: new Date('2026-04-23T00:00:00.000Z'),
    });
    verificationService.maybeSendResetCode.mockResolvedValue({ success: true });

    await expect(service.sendResetCode('verified@kangwon.ac.kr', '127.0.0.1')).resolves.toEqual({
      success: true,
    });

    expect(verificationService.maybeSendResetCode).toHaveBeenCalledWith(
      'verified@kangwon.ac.kr',
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

  it('verifyResetCode는 없는/삭제/미인증 계정 상태를 노출하지 않고 동일한 invalid-code 응답을 반환한다', async () => {
    for (const user of [
      null,
      {
        id: 'user-deleted',
        deletedAt: new Date('2026-05-12T00:00:00.000Z'),
        emailVerifiedAt: new Date('2026-04-23T00:00:00.000Z'),
      },
      {
        id: 'user-unverified',
        deletedAt: null,
        emailVerifiedAt: null,
      },
    ]) {
      jest.clearAllMocks();
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.verifyResetCode('test@kangwon.ac.kr', '123456')).resolves.toMatchObject({
        success: false,
        code: 'AUTH_VERIFICATION_CODE_INVALID',
      });

      expect(verificationService.verifyResetCode).not.toHaveBeenCalled();
    }
  });

  it('verifyResetCode는 active+verified 계정일 때만 verification service로 위임한다', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-verified',
      deletedAt: null,
      emailVerifiedAt: new Date('2026-04-23T00:00:00.000Z'),
    });
    verificationService.verifyResetCode.mockResolvedValue({ success: true });

    await expect(service.verifyResetCode('verified@kangwon.ac.kr', '123456')).resolves.toEqual({
      success: true,
    });

    expect(verificationService.verifyResetCode).toHaveBeenCalledWith(
      'verified@kangwon.ac.kr',
      '123456',
    );
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
    expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(2);
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
    prisma.$queryRawTyped.mockResolvedValueOnce([{ lockAcquired: null }]).mockResolvedValueOnce([]);

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
      deletedAt: null,
      emailVerifiedAt: new Date('2026-04-23T00:00:00.000Z'),
    });
    verificationService.findLatestVerifiedResetCode.mockResolvedValue({ id: 'code-1' });
    prisma.user.update.mockResolvedValue(undefined);
    prisma.verificationCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.resetPassword('test@kangwon.ac.kr', 'NewPass1234')).resolves.toEqual({
      success: true,
    });

    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(2);

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
      deletedAt: null,
      emailVerifiedAt: new Date('2026-04-23T00:00:00.000Z'),
    });
    verificationService.findLatestVerifiedResetCode.mockResolvedValue({ id: 'code-1' });
    prisma.$queryRawTyped.mockResolvedValueOnce([{ lockAcquired: null }]).mockResolvedValueOnce([]);

    await expect(service.resetPassword('test@kangwon.ac.kr', 'NewPass1234')).resolves.toMatchObject(
      {
        success: false,
        code: 'AUTH_RESET_RESTART_REQUIRED',
      },
    );

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('resetPassword는 삭제/미인증 계정도 reset restart required로 중립 처리하고 세션을 건드리지 않는다', async () => {
    for (const user of [
      {
        id: 'user-deleted',
        email: 'deleted@kangwon.ac.kr',
        passwordHash: 'hash',
        deletedAt: new Date('2026-05-12T00:00:00.000Z'),
        emailVerifiedAt: new Date('2026-04-23T00:00:00.000Z'),
      },
      {
        id: 'user-unverified',
        email: 'unverified@kangwon.ac.kr',
        passwordHash: 'hash',
        deletedAt: null,
        emailVerifiedAt: null,
      },
    ]) {
      jest.clearAllMocks();
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.resetPassword(user.email, 'NewPass1234')).resolves.toMatchObject({
        success: false,
        code: 'AUTH_RESET_RESTART_REQUIRED',
      });

      expect(verificationService.findLatestVerifiedResetCode).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    }
  });

  it('changePassword는 현재 비밀번호 확인 후 기존 모든 세션을 revoke하고 새 현재 세션 access token을 반환한다', async () => {
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
      deletedAt: null,
    });
    prisma.authSession.findFirst.mockResolvedValue({
      id: 'session-1',
      rememberMe: true,
    });
    prisma.user.update.mockResolvedValue(undefined);
    prisma.authSession.updateMany.mockResolvedValue({ count: 2 });
    sessionService.issueAuthResult.mockResolvedValue({
      accessToken: 'rotated-access-token',
      sessionId: 'session-new',
    });

    await expect(
      service.changePassword(
        { id: 'user-1', sessionId: 'session-1', gender: 'M', campus: 'CHUNCHEON' },
        'OldPass1234',
        'NewPass1234',
      ),
    ).resolves.toEqual({
      success: true,
      accessToken: 'rotated-access-token',
      rememberMe: true,
    });

    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    const [findCurrentSessionCall] = prisma.authSession.findFirst.mock.calls as Array<
      [
        {
          where: {
            id: string;
            userId: string;
            revokedAt: null;
            expiresAt: { gt: Date };
          };
          select: { rememberMe: true };
        },
      ]
    >;
    expect(findCurrentSessionCall?.[0].where).toMatchObject({
      id: 'session-1',
      userId: 'user-1',
      revokedAt: null,
    });
    expect(findCurrentSessionCall?.[0].select).toEqual({ rememberMe: true });

    const [revokeSessionsCall] = prisma.authSession.updateMany.mock.calls as Array<
      [
        {
          where: { userId: string; revokedAt: null };
          data: { revokedAt: Date };
        },
      ]
    >;
    expect(revokeSessionsCall?.[0].where).toEqual({ userId: 'user-1', revokedAt: null });
    expect(revokeSessionsCall?.[0].data.revokedAt).toBeInstanceOf(Date);
    expect(sessionService.issueAuthResult).toHaveBeenCalledWith(
      'user-1',
      'test@kangwon.ac.kr',
      true,
    );
  });

  it('changePassword는 auth context에 session id가 없으면 재인증을 요구하고 user/session을 조회하지 않는다', async () => {
    await expect(
      service.changePassword(
        { id: 'user-1', gender: 'M', campus: 'CHUNCHEON' },
        'OldPass1234',
        'NewPass1234',
      ),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_REAUTHENTICATION_REQUIRED',
    });

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.authSession.findFirst).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
  });

  it('changePassword는 현재 authenticated session이 이미 없으면 재인증을 요구하고 password update를 rollback한다', async () => {
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
      deletedAt: null,
    });
    prisma.authSession.findFirst.mockResolvedValue(null);

    await expect(
      service.changePassword(
        { id: 'user-1', sessionId: 'session-revoked', gender: 'M', campus: 'CHUNCHEON' },
        'OldPass1234',
        'NewPass1234',
      ),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_REAUTHENTICATION_REQUIRED',
    });

    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
  });

  it('changePassword는 현재 비밀번호가 틀리면 password update/session revoke/token 재발급을 하지 않는다', async () => {
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
      deletedAt: null,
    });

    await expect(
      service.changePassword(
        { id: 'user-1', sessionId: 'session-1', gender: 'M', campus: 'CHUNCHEON' },
        'WrongPass1234',
        'NewPass1234',
      ),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_CURRENT_PASSWORD_INVALID',
      fieldErrors: { currentPassword: '현재 비밀번호가 올바르지 않습니다.' },
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
  });

  it('changePassword는 새 비밀번호가 현재 비밀번호와 같으면 거부한다', async () => {
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
      deletedAt: null,
    });

    await expect(
      service.changePassword(
        { id: 'user-1', sessionId: 'session-1', gender: 'M', campus: 'CHUNCHEON' },
        'OldPass1234',
        'OldPass1234',
      ),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_PASSWORD_UNCHANGED',
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('renewSession은 session service renewal primitive로 위임한다', async () => {
    sessionService.renewSession.mockResolvedValue({
      success: true,
      accessToken: 'renewed-access-token',
      renewalToken: 'next-renewal-token',
      rememberMe: true,
    });

    await expect(service.renewSession('v1.session-1.renewal-token')).resolves.toEqual({
      success: true,
      accessToken: 'renewed-access-token',
      renewalToken: 'next-renewal-token',
      rememberMe: true,
    });

    expect(sessionService.renewSession).toHaveBeenCalledWith('v1.session-1.renewal-token');
  });

  it('logout은 access token과 renewal token을 session service에 함께 전달한다', async () => {
    sessionService.logout.mockResolvedValue({ success: true });

    await expect(service.logout('access-token', 'v1.session-1.renewal-token')).resolves.toEqual({
      success: true,
    });

    expect(sessionService.logout).toHaveBeenCalledWith(
      'access-token',
      'v1.session-1.renewal-token',
    );
  });
});
