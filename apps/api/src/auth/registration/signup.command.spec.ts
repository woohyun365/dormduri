import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LegalDocumentKind } from '@repo/shared/legal';
import { parseDisplayIdentityNickname } from '@repo/shared/user/identity/display';
import { DisplayIdentityNicknamePolicyError } from '../../users/identity/display/display-identity-nickname-policy.service.js';
import { signup } from './signup.command.js';

const passwordHashMocks = vi.hoisted(() => ({
  hashPassword: vi.fn(),
}));

vi.mock('../credentials/password-hash.js', () => passwordHashMocks);

const activeLegalDocumentIds: Record<LegalDocumentKind, string> = {
  [LegalDocumentKind.TERMS_OF_SERVICE]: 'terms-of-service-2026-06-22',
  [LegalDocumentKind.PRIVACY_POLICY]: 'privacy-policy-2026-06-22',
  [LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT]:
    'personal-data-collection-use-consent-2026-06-22',
  [LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE]: 'age-14-or-above-notice-2026-06-22',
};

function findFirstKind(args: unknown): LegalDocumentKind {
  if (typeof args !== 'object' || args === null || !('where' in args)) {
    throw new Error('legal document findFirst where.kind is required');
  }

  const where = (args as { where?: { kind?: unknown } }).where;
  if (typeof where?.kind !== 'string') {
    throw new Error('legal document findFirst where.kind is required');
  }

  return where.kind as LegalDocumentKind;
}

describe('signup command', () => {
  const databaseNow = new Date('2026-04-23T00:00:00.000Z');
  const prisma = {
    getDatabaseNow: vi.fn(),
    runSerializableTransaction: vi.fn(),
    user: {
      create: vi.fn(),
    },
    collegeMaster: {
      findFirst: vi.fn(),
    },
    legalDocumentVersion: {
      findFirst: vi.fn(),
    },
    legalAcceptanceRecord: {
      createMany: vi.fn(),
    },
    verificationCode: {
      updateMany: vi.fn(),
    },
    $queryRawTyped: vi.fn(),
  };
  const verificationService = {
    resolveVerificationGrant: vi.fn(),
    matchesVerificationGrantSubject: vi.fn(),
  };
  const sessionService = {
    prepareSessionIssue: vi.fn(),
    appendPreparedSession: vi.fn(),
  };
  const submissionAdmission = { consume: vi.fn() };
  const passwordPolicy = { evaluateNewPassword: vi.fn() };
  const securityEvents = { recordInTransaction: vi.fn() };
  const nicknamePolicy = {
    validate: vi.fn(),
  };
  const deps = {
    prisma,
    verificationService,
    sessionService,
    passwordPolicy,
    nicknamePolicy,
    submissionAdmission,
    securityEvents,
  };
  const resolvedGrant = {
    id: 'code-1',
    subjectKey: 'v1:signup-subject',
    purpose: 'SIGNUP',
    eligibleUserId: null,
    tokenHash: 'a'.repeat(64),
    expiresAt: new Date('2026-04-23T00:15:00.000Z'),
  } as const;
  const verificationGrant = `v1.code-1.${'g'.repeat(43)}`;
  const input = {
    email: 'test@kangwon.ac.kr',
    password: 'pass123456',
    nickname: '테스터',
    gender: 'M',
    campus: 'CHUNCHEON',
    collegeCode: 'CHUNCHEON_IT',
    birthYear: 2002,
    legalAcceptances: {
      termsVersionId: activeLegalDocumentIds.TERMS_OF_SERVICE,
      personalDataConsentVersionId: activeLegalDocumentIds.PERSONAL_DATA_COLLECTION_USE_CONSENT,
      ageNoticeVersionId: activeLegalDocumentIds.AGE_14_OR_ABOVE_NOTICE,
      privacyPolicyVersionIdShown: activeLegalDocumentIds.PRIVACY_POLICY,
    },
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(databaseNow);
    prisma.collegeMaster.findFirst.mockResolvedValue({ code: 'CHUNCHEON_IT' });
    prisma.legalDocumentVersion.findFirst.mockImplementation((args: unknown) =>
      Promise.resolve({ id: activeLegalDocumentIds[findFirstKind(args)] }),
    );
    prisma.legalAcceptanceRecord.createMany.mockResolvedValue({ count: 4 });
    prisma.$queryRawTyped.mockResolvedValue([{ id: 'code-1' }]);
    prisma.verificationCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        $queryRawTyped: prisma.$queryRawTyped,
        collegeMaster: { findFirst: prisma.collegeMaster.findFirst },
        user: { create: prisma.user.create },
        legalDocumentVersion: { findFirst: prisma.legalDocumentVersion.findFirst },
        legalAcceptanceRecord: { createMany: prisma.legalAcceptanceRecord.createMany },
        verificationCode: { updateMany: prisma.verificationCode.updateMany },
      }),
    );
    verificationService.resolveVerificationGrant.mockResolvedValue(resolvedGrant);
    verificationService.matchesVerificationGrantSubject.mockReturnValue(true);
    nicknamePolicy.validate.mockImplementation((nickname: string) => {
      const parsed = parseDisplayIdentityNickname(nickname);
      if (!parsed.ok) {
        throw new DisplayIdentityNicknamePolicyError('INVALID_FORMAT', parsed.message);
      }
      return Promise.resolve(parsed);
    });
    passwordHashMocks.hashPassword.mockResolvedValue('hashed-password');
    passwordPolicy.evaluateNewPassword.mockReturnValue({ ok: true });
    submissionAdmission.consume.mockResolvedValue(null);
    sessionService.prepareSessionIssue.mockImplementation((userId: string) =>
      Promise.resolve({
        result: {
          accessToken: 'token',
          renewalToken: 'renewal-token',
          sessionId: 'session-1',
        },
        persistence: {
          sessionId: 'session-1',
          userId,
          rememberMe: false,
        },
      }),
    );
    sessionService.appendPreparedSession.mockResolvedValue(undefined);
    securityEvents.recordInTransaction.mockResolvedValue(undefined);
  });

  it('signup grant의 email subject가 입력 email과 다르면 가입 검증 전에 거부한다', async () => {
    verificationService.matchesVerificationGrantSubject.mockReturnValue(false);

    await expect(signup(deps as never, input, verificationGrant)).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED',
    });

    expect(nicknamePolicy.validate).not.toHaveBeenCalled();
    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
  });

  it('campus와 college code 조합이 catalog와 다르면 가입 검증 전에 거부한다', async () => {
    await expect(
      signup(
        deps as never,
        {
          ...input,
          campus: 'SAMCHEOK',
        },
        verificationGrant,
      ),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SIGNUP_COLLEGE_UNAVAILABLE',
      fieldErrors: {
        collegeCode: '선택한 캠퍼스의 단과대를 다시 선택해주세요.',
      },
    });

    expect(nicknamePolicy.validate).not.toHaveBeenCalled();
    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
  });

  it('비밀번호 정책 위반은 hash와 signup transaction 전에 거부한다', async () => {
    await expect(
      signup(
        deps as never,
        {
          ...input,
          password: 'short',
        },
        verificationGrant,
      ),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_PASSWORD_POLICY_VIOLATION',
    });

    expect(passwordHashMocks.hashPassword).not.toHaveBeenCalled();
    expect(nicknamePolicy.validate).not.toHaveBeenCalled();
    expect(sessionService.prepareSessionIssue).not.toHaveBeenCalled();
    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
  });

  it('취약 비밀번호는 nickname policy와 hash 전에 generic하게 거부한다', async () => {
    const password = 'Password1!';
    passwordPolicy.evaluateNewPassword.mockReturnValue({
      ok: false,
      code: 'COMMON_VALUE',
    });

    const result = await signup(
      deps as never,
      {
        ...input,
        password,
      },
      verificationGrant,
    );

    expect(result).toMatchObject({
      success: false,
      code: 'AUTH_PASSWORD_POLICY_VIOLATION',
      fieldErrors: {
        password: '다른 비밀번호를 입력해 주세요.',
      },
    });
    expect(JSON.stringify(result)).not.toContain(password);
    expect(passwordPolicy.evaluateNewPassword).toHaveBeenCalledWith(password, {
      email: 'test@kangwon.ac.kr',
      nickname: '테스터',
    });
    expect(nicknamePolicy.validate).not.toHaveBeenCalled();
    expect(passwordHashMocks.hashPassword).not.toHaveBeenCalled();
    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
  });

  it('transaction 시점에 active college가 아니면 계정을 생성하지 않는다', async () => {
    prisma.collegeMaster.findFirst.mockResolvedValue(null);

    await expect(signup(deps as never, input, verificationGrant)).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SIGNUP_COLLEGE_UNAVAILABLE',
    });

    expect(prisma.collegeMaster.findFirst).toHaveBeenCalledWith({
      where: {
        code: 'CHUNCHEON_IT',
        campusCode: 'CHUNCHEON',
        isActive: true,
      },
      select: { code: true },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.verificationCode.updateMany).toHaveBeenCalledTimes(1);
    expect(sessionService.appendPreparedSession).not.toHaveBeenCalled();
  });

  it('display identity policy로 nickname을 검증하고 실패 시 DB mutation을 시작하지 않는다', async () => {
    nicknamePolicy.validate.mockRejectedValue(
      new DisplayIdentityNicknamePolicyError(
        'MODERATION_REJECTED',
        '닉네임에 사용할 수 없는 단어가 포함되어 있어요.',
      ),
    );

    await expect(signup(deps as never, input, verificationGrant)).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SIGNUP_VALIDATION_FAILED',
      fieldErrors: { nickname: '닉네임에 사용할 수 없는 단어가 포함되어 있어요.' },
    });

    expect(nicknamePolicy.validate).toHaveBeenCalledWith(input.nickname);
    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
    expect(prisma.legalDocumentVersion.findFirst).not.toHaveBeenCalled();
    expect(prisma.legalAcceptanceRecord.createMany).not.toHaveBeenCalled();
    expect(sessionService.prepareSessionIssue).not.toHaveBeenCalled();
  });

  it('검증 완료된 최신 signup code를 소비하고 legal acceptance 4건과 세션 발급 결과를 반환한다', async () => {
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: {
        nickname: '테스터',
      },
      academicIdentity: {
        collegeCode: 'CHUNCHEON_IT',
        birthYear: 2002,
      },
    });
    const result = await signup(deps as never, input, verificationGrant);

    expect(nicknamePolicy.validate).toHaveBeenCalledWith('테스터');
    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    expect(prisma.legalDocumentVersion.findFirst).toHaveBeenCalledTimes(4);
    expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(1);
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
      collegeCode: 'CHUNCHEON_IT',
      birthYear: 2002,
    });
    const legalAcceptanceCalls = prisma.legalAcceptanceRecord.createMany.mock
      .calls as unknown as Array<
      [
        {
          data: Array<{
            userId: string;
            documentVersionId: string;
            kind: LegalDocumentKind;
            action: 'AGREE' | 'SHOW';
            acceptedAt: Date;
            source: 'SIGNUP';
          }>;
        },
      ]
    >;
    expect(legalAcceptanceCalls[0]?.[0].data).toEqual([
      {
        userId: 'user-1',
        documentVersionId: activeLegalDocumentIds.TERMS_OF_SERVICE,
        kind: LegalDocumentKind.TERMS_OF_SERVICE,
        action: 'AGREE',
        acceptedAt: databaseNow,
        source: 'SIGNUP',
      },
      {
        userId: 'user-1',
        documentVersionId: activeLegalDocumentIds.PERSONAL_DATA_COLLECTION_USE_CONSENT,
        kind: LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT,
        action: 'AGREE',
        acceptedAt: databaseNow,
        source: 'SIGNUP',
      },
      {
        userId: 'user-1',
        documentVersionId: activeLegalDocumentIds.AGE_14_OR_ABOVE_NOTICE,
        kind: LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE,
        action: 'AGREE',
        acceptedAt: databaseNow,
        source: 'SIGNUP',
      },
      {
        userId: 'user-1',
        documentVersionId: activeLegalDocumentIds.PRIVACY_POLICY,
        kind: LegalDocumentKind.PRIVACY_POLICY,
        action: 'SHOW',
        acceptedAt: databaseNow,
        source: 'SIGNUP',
      },
    ]);
    expect(sessionService.prepareSessionIssue).toHaveBeenCalledWith(
      expect.any(String),
      'test@kangwon.ac.kr',
      false,
    );
    expect(sessionService.appendPreparedSession).toHaveBeenCalledTimes(1);
    expect(securityEvents.recordInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'ACCOUNT_SIGNUP_SUCCEEDED',
        actorUserId: 'user-1',
        targetUserId: 'user-1',
        sessionId: 'session-1',
        emailNormalized: 'test@kangwon.ac.kr',
      }),
    );
    expect(result).toMatchObject({
      success: true,
      accessToken: 'token',
      renewalToken: 'renewal-token',
      rememberMe: false,
      user: {
        id: 'user-1',
        email: 'test@kangwon.ac.kr',
        nickname: '테스터',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
    });
  });

  it('signup 최초 session은 account와 같은 serializable transaction에서 생성한다', async () => {
    let transactionOpen = false;
    prisma.runSerializableTransaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        transactionOpen = true;
        try {
          return await callback({
            $queryRawTyped: prisma.$queryRawTyped,
            collegeMaster: { findFirst: prisma.collegeMaster.findFirst },
            user: { create: prisma.user.create },
            legalDocumentVersion: { findFirst: prisma.legalDocumentVersion.findFirst },
            legalAcceptanceRecord: { createMany: prisma.legalAcceptanceRecord.createMany },
            verificationCode: { updateMany: prisma.verificationCode.updateMany },
          });
        } finally {
          transactionOpen = false;
        }
      },
    );
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: { nickname: '테스터' },
      academicIdentity: { collegeCode: 'CHUNCHEON_IT', birthYear: 2002 },
    });
    sessionService.appendPreparedSession.mockImplementation(() => {
      expect(transactionOpen).toBe(true);
      return Promise.resolve();
    });

    await expect(signup(deps as never, input, verificationGrant)).resolves.toMatchObject({
      success: true,
      accessToken: 'token',
    });
  });

  it('signup transaction은 account insert보다 grant purpose lock과 consume을 먼저 수행한다', async () => {
    const mutationOrder: string[] = [];
    prisma.$queryRawTyped.mockImplementation(() => {
      mutationOrder.push('grant-lock');
      return Promise.resolve([{ id: 'code-1' }]);
    });
    prisma.verificationCode.updateMany.mockImplementation(() => {
      mutationOrder.push('grant-consume');
      return Promise.resolve({ count: 1 });
    });
    prisma.user.create.mockImplementation(() => {
      mutationOrder.push('account-insert');
      return Promise.resolve({
        id: 'user-1',
        email: 'test@kangwon.ac.kr',
        gender: 'M',
        campus: 'CHUNCHEON',
        displayIdentity: { nickname: '테스터' },
        academicIdentity: { collegeCode: 'CHUNCHEON_IT', birthYear: 2002 },
      });
    });
    await signup(deps as never, input, verificationGrant);

    expect(mutationOrder).toEqual(['grant-lock', 'grant-consume', 'account-insert']);
  });

  it('같은 active signup grant의 반복 제출은 Argon hash 전에 제한한다', async () => {
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: { nickname: '테스터' },
      academicIdentity: { collegeCode: 'CHUNCHEON_IT', birthYear: 2002 },
    });
    submissionAdmission.consume.mockImplementation(() =>
      Promise.resolve(submissionAdmission.consume.mock.calls.length > 5 ? 600 : null),
    );

    const results = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      results.push(await signup(deps as never, input, verificationGrant));
    }

    expect(passwordHashMocks.hashPassword).toHaveBeenCalledTimes(5);
    expect(results.at(-1)).toMatchObject({
      success: false,
      code: 'AUTH_SIGNUP_SUBMISSION_THROTTLED',
    });
  });

  it('회원가입 write에는 shared parser의 NFKC display value와 lowercase key를 사용한다', async () => {
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: {
        nickname: 'NiceGuy',
      },
      academicIdentity: {
        collegeCode: 'CHUNCHEON_IT',
        birthYear: 2002,
      },
    });
    await signup(
      deps as never,
      {
        ...input,
        nickname: '  ＮiceＧuy  ',
      },
      verificationGrant,
    );

    const createUserCall = prisma.user.create.mock.calls[0]?.[0] as
      | {
          data: {
            displayIdentity: { create: { nickname: string; nicknameNormalized: string } };
          };
        }
      | undefined;
    expect(createUserCall?.data.displayIdentity.create).toEqual({
      nickname: 'NiceGuy',
      nicknameNormalized: 'niceguy',
    });
  });

  it('active legal document version이 바뀌면 계정 생성 전에 stale failure를 반환한다', async () => {
    await expect(
      signup(
        deps as never,
        {
          ...input,
          legalAcceptances: {
            ...input.legalAcceptances,
            termsVersionId: 'old-terms-document-id',
          },
        },
        verificationGrant,
      ),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_LEGAL_ACCEPTANCE_STALE',
      fieldErrors: {
        legalAcceptances:
          '약관 또는 개인정보 동의 내용이 변경되었습니다. 화면을 새로고침한 뒤 다시 확인해주세요.',
      },
    });

    expect(prisma.legalDocumentVersion.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.verificationCode.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.legalAcceptanceRecord.createMany).not.toHaveBeenCalled();
    expect(sessionService.appendPreparedSession).not.toHaveBeenCalled();
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
    prisma.verificationCode.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(signup(deps as never, input, verificationGrant)).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED',
    });

    expect(prisma.legalAcceptanceRecord.createMany).not.toHaveBeenCalled();
    expect(sessionService.appendPreparedSession).not.toHaveBeenCalled();
  });

  it('signup transaction에서 display identity가 생성되지 않으면 verification consume과 acceptance 저장, 세션 발급을 중단한다', async () => {
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: null,
    });

    await expect(signup(deps as never, input, verificationGrant)).rejects.toThrow(
      '[AuthSignupOwner] user display identity row is required',
    );

    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    expect(prisma.verificationCode.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.legalAcceptanceRecord.createMany).not.toHaveBeenCalled();
    expect(sessionService.appendPreparedSession).not.toHaveBeenCalled();
  });

  it('legal acceptance 저장 실패 시 세션을 발급하지 않는다', async () => {
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: {
        nickname: '테스터',
      },
    });
    prisma.legalAcceptanceRecord.createMany.mockRejectedValue(
      new Error('legal acceptance persistence failed'),
    );

    await expect(signup(deps as never, input, verificationGrant)).rejects.toThrow(
      'legal acceptance persistence failed',
    );

    expect(prisma.legalAcceptanceRecord.createMany).toHaveBeenCalledTimes(1);
    expect(sessionService.appendPreparedSession).not.toHaveBeenCalled();
  });

  it('transaction 내부 session append 실패는 가입 전체를 실패시킨다', async () => {
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: { nickname: '테스터' },
      academicIdentity: { collegeCode: 'CHUNCHEON_IT', birthYear: 2002 },
    });
    sessionService.appendPreparedSession.mockRejectedValue(new Error('session store unavailable'));

    await expect(signup(deps as never, input, verificationGrant)).rejects.toThrow(
      'session store unavailable',
    );

    expect(prisma.runSerializableTransaction).toHaveBeenCalledTimes(1);
    expect(sessionService.appendPreparedSession).toHaveBeenCalledTimes(1);
    expect(securityEvents.recordInTransaction).not.toHaveBeenCalled();
  });

  it('필수 signup audit append 실패는 가입 transaction을 실패시킨다', async () => {
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: { nickname: '테스터' },
      academicIdentity: { collegeCode: 'CHUNCHEON_IT', birthYear: 2002 },
    });
    securityEvents.recordInTransaction.mockRejectedValue(
      new Error('signup audit persistence failed'),
    );

    await expect(
      signup(deps as never, input, verificationGrant, {
        requestIp: '203.0.113.10',
        userAgent: 'vitest',
      }),
    ).rejects.toThrow('signup audit persistence failed');

    expect(sessionService.appendPreparedSession).toHaveBeenCalledTimes(1);
    expect(securityEvents.recordInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'ACCOUNT_SIGNUP_SUCCEEDED',
        requestIp: '203.0.113.10',
        userAgent: 'vitest',
      }),
    );
  });
});
