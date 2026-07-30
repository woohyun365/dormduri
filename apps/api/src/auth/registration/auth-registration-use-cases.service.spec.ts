import { LegalDocumentKind } from '@repo/shared/legal';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthRegistrationUseCases } from './auth-registration-use-cases.service.js';

describe('AuthRegistrationUseCases', () => {
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
    verificationCode: {
      updateMany: vi.fn(),
    },
    legalDocumentVersion: {
      findFirst: vi.fn(),
    },
    legalAcceptanceRecord: {
      createMany: vi.fn(),
    },
    $queryRawTyped: vi.fn(),
  };
  const verificationService = {
    resolveVerificationGrant: vi.fn(),
    matchesVerificationGrantSubject: vi.fn(),
  };
  const sessionService = {
    issueAuthResult: vi.fn(),
  };
  const signupValidationService = {
    validateDraft: vi.fn(),
  };
  const useCases = new AuthRegistrationUseCases(
    prisma as never,
    verificationService as never,
    sessionService as never,
    signupValidationService as never,
  );
  const input = {
    email: 'test@kangwon.ac.kr',
    password: 'pass1234',
    nickname: '테스터',
    gender: 'M',
    campus: 'CHUNCHEON',
    collegeCode: 'CHUNCHEON_IT',
    birthYear: 2002,
    legalAcceptances: {
      termsVersionId: 'terms-of-service-2026-06-22',
      personalDataConsentVersionId: 'personal-data-collection-use-consent-2026-06-22',
      ageNoticeVersionId: 'age-14-or-above-notice-2026-06-22',
      privacyPolicyVersionIdShown: 'privacy-policy-2026-06-22',
    },
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(databaseNow);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.userDisplayIdentity.findUnique.mockResolvedValue(null);
    prisma.collegeMaster.findFirst.mockResolvedValue({ code: 'CHUNCHEON_IT' });
    prisma.$queryRawTyped.mockResolvedValue([{ id: 'code-1' }]);
    prisma.verificationCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.legalDocumentVersion.findFirst.mockImplementation(
      ({ where }: { where: { kind: LegalDocumentKind } }) => {
        const activeVersionIds: Record<LegalDocumentKind, string> = {
          [LegalDocumentKind.TERMS_OF_SERVICE]: input.legalAcceptances.termsVersionId,
          [LegalDocumentKind.PRIVACY_POLICY]: input.legalAcceptances.privacyPolicyVersionIdShown,
          [LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT]:
            input.legalAcceptances.personalDataConsentVersionId,
          [LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE]: input.legalAcceptances.ageNoticeVersionId,
        };

        return Promise.resolve({ id: activeVersionIds[where.kind] });
      },
    );
    prisma.legalAcceptanceRecord.createMany.mockResolvedValue({ count: 4 });
    prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        $queryRawTyped: prisma.$queryRawTyped,
        collegeMaster: { findFirst: prisma.collegeMaster.findFirst },
        user: { create: prisma.user.create },
        verificationCode: { updateMany: prisma.verificationCode.updateMany },
        legalDocumentVersion: { findFirst: prisma.legalDocumentVersion.findFirst },
        legalAcceptanceRecord: { createMany: prisma.legalAcceptanceRecord.createMany },
      }),
    );
    verificationService.resolveVerificationGrant.mockResolvedValue({
      id: 'code-1',
      subjectKey: 'v1:signup-subject',
      purpose: 'SIGNUP',
      eligibleUserId: null,
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date('2026-04-23T00:15:00.000Z'),
    });
    verificationService.matchesVerificationGrantSubject.mockReturnValue(true);
  });

  it('validateSignupDraft는 signup validation service로 그대로 위임한다', async () => {
    signupValidationService.validateDraft.mockResolvedValue({ success: true });

    await expect(
      useCases.validateSignupDraft({
        email: 'test@kangwon.ac.kr',
        password: 'Pass1234',
        nickname: '테스터',
      }),
    ).resolves.toEqual({ success: true });

    expect(signupValidationService.validateDraft).toHaveBeenCalledWith({
      email: 'test@kangwon.ac.kr',
      password: 'Pass1234',
      nickname: '테스터',
    });
  });

  it('signup은 slice-local command dependencies를 조립해 session issue 결과를 반환한다', async () => {
    signupValidationService.validateDraft.mockResolvedValue({ success: true });
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: { nickname: '테스터' },
    });
    sessionService.issueAuthResult.mockResolvedValue({
      accessToken: 'access-token',
      renewalToken: 'renewal-token',
      sessionId: 'session-1',
    });

    await expect(useCases.signup(input as never)).resolves.toMatchObject({
      success: true,
      accessToken: 'access-token',
      renewalToken: 'renewal-token',
      rememberMe: false,
      user: { id: 'user-1', nickname: '테스터' },
    });

    expect(signupValidationService.validateDraft).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
      nickname: input.nickname,
    });
    expect(sessionService.issueAuthResult).toHaveBeenCalledWith(
      'user-1',
      'test@kangwon.ac.kr',
      false,
    );
  });
});
