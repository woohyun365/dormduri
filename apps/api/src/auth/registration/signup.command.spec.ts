import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LegalDocumentKind } from '@repo/shared/legal';
import { signup } from './signup.command.js';

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
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    userDisplayIdentity: {
      findUnique: vi.fn(),
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
  };
  const sessionService = {
    issueAuthResult: vi.fn(),
  };
  const signupValidationService = {
    validateDraft: vi.fn(),
  };
  const deps = { prisma, verificationService, sessionService, signupValidationService };
  const resolvedGrant = {
    id: 'code-1',
    emailNormalized: 'test@kangwon.ac.kr',
    purpose: 'SIGNUP',
    eligibleUserId: null,
    tokenHash: 'a'.repeat(64),
    expiresAt: new Date('2026-04-23T00:15:00.000Z'),
  } as const;
  const verificationGrant = `v1.code-1.${'g'.repeat(43)}`;
  const input = {
    email: 'test@kangwon.ac.kr',
    password: 'pass1234',
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
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.userDisplayIdentity.findUnique.mockResolvedValue(null);
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
    signupValidationService.validateDraft.mockResolvedValue({ success: true });
  });

  it('signup grant의 email subject가 입력 email과 다르면 가입 검증 전에 거부한다', async () => {
    verificationService.resolveVerificationGrant.mockResolvedValue({
      ...resolvedGrant,
      emailNormalized: 'other@kangwon.ac.kr',
    });

    await expect(signup(deps as never, input, verificationGrant)).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED',
    });

    expect(signupValidationService.validateDraft).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
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

    expect(signupValidationService.validateDraft).not.toHaveBeenCalled();
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
    expect(prisma.verificationCode.updateMany).not.toHaveBeenCalled();
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
  });

  it('signup validation service로 moderation/입력 검증을 위임하고 실패 시 DB mutation을 시작하지 않는다', async () => {
    signupValidationService.validateDraft.mockResolvedValue({
      success: false,
      code: 'AUTH_SIGNUP_VALIDATION_FAILED',
      userActionable: true,
      error: '입력값을 다시 확인해주세요.',
      fieldErrors: { nickname: '사용할 수 없는 닉네임이에요. 다른 닉네임을 입력해 주세요.' },
    });

    await expect(signup(deps as never, input, verificationGrant)).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SIGNUP_VALIDATION_FAILED',
      fieldErrors: { nickname: '사용할 수 없는 닉네임이에요. 다른 닉네임을 입력해 주세요.' },
    });

    expect(signupValidationService.validateDraft).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
      nickname: input.nickname,
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
    expect(prisma.legalDocumentVersion.findFirst).not.toHaveBeenCalled();
    expect(prisma.legalAcceptanceRecord.createMany).not.toHaveBeenCalled();
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
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
    sessionService.issueAuthResult.mockResolvedValue({
      accessToken: 'token',
      renewalToken: 'renewal-token',
      sessionId: 'session-1',
    });

    const result = await signup(deps as never, input, verificationGrant);

    expect(signupValidationService.validateDraft).toHaveBeenCalledWith({
      email: 'test@kangwon.ac.kr',
      password: 'pass1234',
      nickname: '테스터',
    });
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
    expect(sessionService.issueAuthResult).toHaveBeenCalledWith(
      'user-1',
      'test@kangwon.ac.kr',
      false,
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
    sessionService.issueAuthResult.mockResolvedValue({
      accessToken: 'token',
      renewalToken: 'renewal-token',
      sessionId: 'session-1',
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
    expect(prisma.verificationCode.updateMany).not.toHaveBeenCalled();
    expect(prisma.legalAcceptanceRecord.createMany).not.toHaveBeenCalled();
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
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
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
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
    expect(prisma.verificationCode.updateMany).not.toHaveBeenCalled();
    expect(prisma.legalAcceptanceRecord.createMany).not.toHaveBeenCalled();
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
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
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
  });
});
