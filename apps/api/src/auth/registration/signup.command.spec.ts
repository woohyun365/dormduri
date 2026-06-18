import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signup } from './signup.command.js';

describe('signup command', () => {
  const databaseNow = new Date('2026-04-23T00:00:00.000Z');
  const prisma = {
    getDatabaseNow: vi.fn(),
    runSerializableTransaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    userDisplayIdentity: {
      findUnique: vi.fn(),
    },
    verificationCode: {
      updateMany: vi.fn(),
    },
    $queryRawTyped: vi.fn(),
  };
  const verificationService = {
    findLatestVerifiedSignupCode: vi.fn(),
  };
  const sessionService = {
    issueAuthResult: vi.fn(),
  };
  const signupValidationService = {
    validateDraft: vi.fn(),
  };
  const deps = { prisma, verificationService, sessionService, signupValidationService };
  const input = {
    email: 'test@kangwon.ac.kr',
    password: 'pass1234',
    nickname: '테스터',
    gender: 'M',
    campus: 'CHUNCHEON',
    collegeCode: 'IT',
    birthYear: 2002,
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(databaseNow);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.userDisplayIdentity.findUnique.mockResolvedValue(null);
    prisma.$queryRawTyped.mockResolvedValue([{ id: 'code-1' }]);
    prisma.verificationCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        $queryRawTyped: prisma.$queryRawTyped,
        user: { create: prisma.user.create },
        verificationCode: { updateMany: prisma.verificationCode.updateMany },
      }),
    );
    verificationService.findLatestVerifiedSignupCode.mockResolvedValue({ id: 'code-1' });
    signupValidationService.validateDraft.mockResolvedValue({ success: true });
  });

  it('signup validation service로 moderation/입력 검증을 위임하고 실패 시 DB mutation을 시작하지 않는다', async () => {
    signupValidationService.validateDraft.mockResolvedValue({
      success: false,
      code: 'AUTH_SIGNUP_VALIDATION_FAILED',
      userActionable: true,
      error: '입력값을 다시 확인해주세요.',
      fieldErrors: { nickname: '사용할 수 없는 표현이 포함되어 있습니다.' },
    });

    await expect(signup(deps as never, input)).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SIGNUP_VALIDATION_FAILED',
      fieldErrors: { nickname: '사용할 수 없는 표현이 포함되어 있습니다.' },
    });

    expect(signupValidationService.validateDraft).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
      nickname: input.nickname,
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
  });

  it('검증 완료된 최신 signup code를 소비하고 세션 발급 결과를 반환한다', async () => {
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: {
        nickname: '테스터',
      },
      academicIdentity: {
        collegeCode: 'IT',
        birthYear: 2002,
      },
    });
    sessionService.issueAuthResult.mockResolvedValue({
      accessToken: 'token',
      sessionId: 'session-1',
    });

    const result = await signup(deps as never, input);

    expect(signupValidationService.validateDraft).toHaveBeenCalledWith({
      email: 'test@kangwon.ac.kr',
      password: 'pass1234',
      nickname: '테스터',
    });
    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(2);
    const createUserCalls = prisma.user.create.mock.calls as unknown as Array<
      [
        {
          data: {
            emailVerifiedAt: Date;
            displayIdentity: { create: { nickname: string; nicknameNormalized: string } };
            academicIdentity: { create: { collegeCode: string; birthYear: number } };
          };
        },
      ]
    >;
    const createUserCall = createUserCalls[0]?.[0];
    expect(createUserCall?.data.emailVerifiedAt).toBe(databaseNow);
    expect(createUserCall?.data.displayIdentity.create).toEqual({
      nickname: '테스터',
      nicknameNormalized: '테스터',
    });
    expect(createUserCall?.data.academicIdentity.create).toEqual({
      collegeCode: 'IT',
      birthYear: 2002,
    });
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

    await expect(signup(deps as never, input)).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED',
    });

    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
  });

  it('signup transaction에서 display identity가 생성되지 않으면 verification consume과 세션 발급을 중단한다', async () => {
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: null,
    });

    await expect(signup(deps as never, input)).rejects.toThrow(
      '[AuthSignupOwner] user display identity row is required',
    );

    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    expect(prisma.verificationCode.updateMany).not.toHaveBeenCalled();
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
  });
});
