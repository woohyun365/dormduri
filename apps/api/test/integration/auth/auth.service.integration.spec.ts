import { describe, expect, it } from 'vitest';
import { hash as argonHash } from '@node-rs/argon2';
import { createHash } from 'node:crypto';
import { AuthService } from '../../../src/auth/application/auth.service.js';
import { hashVerificationGrant } from '../../../src/auth/verification/auth-verification-grant.js';
import { hashAuthPersistenceDimension } from '../../../src/auth/persistence/auth-persistence-dimension.js';
import { DEFAULT_AUTH_PERSISTENCE_HMAC_SECRET } from '../../../src/config/auth.config.js';
import { seedBaseSeasonFixtures } from '../_support/integration-fixtures.js';
import { useIntegrationTestSuite } from '../_support/integration-suite.js';

const signupLegalDocumentIds = {
  termsVersionId: 'integration-terms',
  privacyPolicyVersionIdShown: 'integration-privacy',
  personalDataConsentVersionId: 'integration-personal-data-consent',
  ageNoticeVersionId: 'integration-age-notice',
} as const;

function hashTokenForTest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

describe('AuthService integration', () => {
  const suite = useIntegrationTestSuite('auth_service_integration');

  function authService() {
    return suite.app.get(AuthService);
  }

  it('rememberMe=false login은 browser-session renewal을 저장하고 logout 후 fail-closed 처리한다', async () => {
    const email = 'opaque-login@kangwon.ac.kr';
    const emailNormalized = email.toLowerCase();
    const passwordHash = await argonHash('Pass1234', {
      algorithm: 2,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });
    const databaseNow = await suite.prisma.getDatabaseNow();

    await suite.prisma.user.create({
      data: {
        id: 'opaque-login-user',
        email,
        emailNormalized,
        passwordHash,
        gender: 'M',
        campus: 'CHUNCHEON',
        emailVerifiedAt: databaseNow,
        displayIdentity: {
          create: {
            nickname: '오페이크로그인',
            nicknameNormalized: '오페이크로그인',
          },
        },
      },
    });

    const result = await authService().login(email, 'Pass1234', false);

    expect(result.success).toBe(true);
    expect(result.accessToken).toMatch(/^v1\.[^.]+\.[A-Za-z0-9_-]{43}$/);
    expect(result.renewalToken).toMatch(/^v1\.[^.]+\.[A-Za-z0-9_-]{43}$/);
    expect(result.rememberMe).toBe(false);
    expect(result.accessToken).not.toMatch(/^eyJ/);

    const session = await suite.prisma.authSession.findFirstOrThrow({
      where: { userId: 'opaque-login-user' },
    });
    expect(session.sessionTokenHash).toBe(hashTokenForTest(result.accessToken ?? ''));
    expect(session.sessionTokenHash).not.toBe(result.accessToken);
    expect(session.refreshTokenHash).toBe(hashTokenForTest(result.renewalToken ?? ''));
    expect(session.rememberMe).toBe(false);
    expect(session.previousRefreshTokenHash).toBeNull();
    expect(session.previousRefreshTokenValidUntil).toBeNull();
    await expect(
      suite.prisma.authSession.update({
        where: { id: session.id },
        data: {
          previousRefreshTokenHash: 'invalid-unpaired-previous-hash',
        },
      }),
    ).rejects.toThrow();

    await expect(authService().getSession(result.accessToken ?? null)).resolves.toMatchObject({
      authenticated: true,
      user: { id: 'opaque-login-user', email },
    });

    const renewalResult = await authService().renewSession(result.renewalToken ?? null);
    expect(renewalResult).toMatchObject({
      success: true,
      rememberMe: false,
    });
    if (!renewalResult.success) {
      throw new Error('Expected rememberMe=false session renewal to succeed');
    }

    await expect(
      authService().logout(renewalResult.accessToken ?? null, renewalResult.renewalToken ?? null),
    ).resolves.toEqual({
      success: true,
    });
    await expect(authService().getSession(renewalResult.accessToken ?? null)).resolves.toEqual({
      authenticated: false,
      reason: 'SESSION_REVOKED',
    });
  });

  it.each([2, 5, 10])(
    '동일 renewal token의 동시 %i개 갱신은 한 요청만 성공하고 나머지는 stale로 수렴한다',
    async (concurrency) => {
      const email = `renewal-race-${concurrency}@kangwon.ac.kr`;
      const emailNormalized = email.toLowerCase();
      const passwordHash = await argonHash('Pass1234', {
        algorithm: 2,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
        outputLen: 32,
      });
      const databaseNow = await suite.prisma.getDatabaseNow();

      await suite.prisma.user.create({
        data: {
          id: `renewal-race-user-${concurrency}`,
          email,
          emailNormalized,
          passwordHash,
          gender: 'F',
          campus: 'CHUNCHEON',
          emailVerifiedAt: databaseNow,
          displayIdentity: {
            create: {
              nickname: `갱신경쟁${concurrency}`,
              nicknameNormalized: `갱신경쟁${concurrency}`,
            },
          },
        },
      });

      const loginResult = await authService().login(email, 'Pass1234', true);
      expect(loginResult.success).toBe(true);
      expect(loginResult.renewalToken).toBeDefined();

      const renewalToken = loginResult.renewalToken ?? null;
      const results = await Promise.all(
        Array.from({ length: concurrency }, () => authService().renewSession(renewalToken)),
      );

      expect(results.filter((result) => result.success)).toHaveLength(1);
      expect(
        results.filter((result) => !result.success && result.code === 'AUTH_SESSION_RENEWAL_STALE'),
      ).toHaveLength(concurrency - 1);

      const session = await suite.prisma.authSession.findFirstOrThrow({
        where: { userId: `renewal-race-user-${concurrency}` },
      });
      expect(session.revokedAt).toBeNull();
      expect(session.previousRefreshTokenHash).toBe(hashTokenForTest(renewalToken ?? ''));
      expect(session.previousRefreshTokenValidUntil).not.toBeNull();
    },
  );

  it('previous grace가 지난 renewal token 재사용은 family를 revoke하고 security event를 한 번 남긴다', async () => {
    const email = 'renewal-reuse@kangwon.ac.kr';
    const passwordHash = await argonHash('Pass1234', {
      algorithm: 2,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });
    const databaseNow = await suite.prisma.getDatabaseNow();
    await suite.prisma.user.create({
      data: {
        id: 'renewal-reuse-user',
        email,
        emailNormalized: email,
        passwordHash,
        gender: 'M',
        campus: 'CHUNCHEON',
        emailVerifiedAt: databaseNow,
        displayIdentity: {
          create: {
            nickname: '갱신재사용',
            nicknameNormalized: '갱신재사용',
          },
        },
      },
    });

    const loginResult = await authService().login(email, 'Pass1234', true);
    const previousToken = loginResult.renewalToken ?? null;
    const firstRenewal = await authService().renewSession(previousToken);
    expect(firstRenewal.success).toBe(true);
    const rotatedSession = await suite.prisma.authSession.findFirstOrThrow({
      where: { userId: 'renewal-reuse-user' },
    });
    await suite.prisma.authSession.update({
      where: { id: rotatedSession.id },
      data: {
        previousRefreshTokenValidUntil: databaseNow,
      },
    });

    await expect(authService().renewSession(previousToken)).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SESSION_RENEWAL_REUSED',
    });
    const revokedSession = await suite.prisma.authSession.findUniqueOrThrow({
      where: { id: rotatedSession.id },
    });
    expect(revokedSession.revokedAt).toBeInstanceOf(Date);
    await expect(
      suite.prisma.authSecurityEvent.count({
        where: {
          sessionId: rotatedSession.id,
          type: 'SESSION_TOKEN_REUSE_DETECTED',
        },
      }),
    ).resolves.toBe(1);
  });

  it('동시에 같은 signup verification proof를 소비해도 User/DisplayIdentity/AcademicIdentity 계정은 하나만 생성된다', async () => {
    const email = 'signup-race@kangwon.ac.kr';
    const emailNormalized = email.toLowerCase();
    const databaseNow = await suite.prisma.getDatabaseNow();
    await seedAcademicIdentityReferenceData();
    await seedSignupLegalDocuments(databaseNow);
    const verificationCodeId = 'integration-signup-proof';
    const verificationGrant = createVerificationGrant(verificationCodeId);
    await suite.prisma.verificationCode.create({
      data: {
        id: verificationCodeId,
        subjectKey: toSubjectKey(emailNormalized),
        purpose: 'SIGNUP',
        codeHash: 'hmac-sha256:integration-signup-proof',
        issuedAt: databaseNow,
        codeExpiresAt: new Date(databaseNow.getTime() + 10 * 60 * 1000),
        verifiedAt: databaseNow,
        grantTokenHash: hashVerificationGrant(verificationGrant),
        grantExpiresAt: new Date(databaseNow.getTime() + 15 * 60 * 1000),
      },
    });

    const signupInput = {
      email,
      password: 'Pass1234!!',
      nickname: '통합테스트닉네임',
      gender: 'M' as const,
      campus: 'CHUNCHEON' as const,
      collegeCode: 'CHUNCHEON_IT',
      birthYear: 2002,
      legalAcceptances: signupLegalDocumentIds,
    } as never;

    const settled = await Promise.allSettled([
      authService().signup(signupInput, verificationGrant),
      authService().signup(signupInput, verificationGrant),
    ]);

    const fulfilled = settled.filter((result) => result.status === 'fulfilled');
    const rejected = settled.filter((result) => result.status === 'rejected');

    const responses = fulfilled.map(
      (result) => (result as PromiseFulfilledResult<{ accessToken?: string; code?: string }>).value,
    );
    const successResults = responses.filter((value) => Boolean(value.accessToken));
    const failureResults = responses.filter((value) => !value.accessToken);

    expect(successResults, JSON.stringify(responses)).toHaveLength(1);
    expect(failureResults.length + rejected.length).toBe(1);
    expect(rejected).toHaveLength(0);
    if (failureResults[0]) {
      expect(failureResults[0].code).toBe('AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED');
    }

    expect(
      await suite.prisma.user.count({
        where: { emailNormalized },
      }),
    ).toBe(1);
    expect(
      await suite.prisma.userDisplayIdentity.count({
        where: { user: { emailNormalized } },
      }),
    ).toBe(1);
    await expect(expectAcademicIdentityCount(emailNormalized)).resolves.toBe(1);

    expect(
      await suite.prisma.verificationCode.count({
        where: {
          subjectKey: toSubjectKey(emailNormalized),
          purpose: 'SIGNUP',
          consumedAt: null,
        },
      }),
    ).toBe(0);
  });

  async function seedAcademicIdentityReferenceData() {
    await seedBaseSeasonFixtures(suite.prisma);
    await suite.prisma.collegeMaster.upsert({
      where: { code: 'CHUNCHEON_IT' },
      create: {
        code: 'CHUNCHEON_IT',
        campusCode: 'CHUNCHEON',
        nameKo: 'IT대',
        sortOrder: 1,
      },
      update: {
        campusCode: 'CHUNCHEON',
        nameKo: 'IT대',
        sortOrder: 1,
        isActive: true,
      },
    });
  }

  async function expectAcademicIdentityCount(emailNormalized: string) {
    const academicIdentityDelegate = (
      suite.prisma as unknown as {
        userAcademicIdentity?: {
          count(args: {
            where: {
              user: {
                emailNormalized: string;
              };
            };
          }): Promise<number>;
        };
      }
    ).userAcademicIdentity;

    expect(academicIdentityDelegate).toBeDefined();
    if (!academicIdentityDelegate) {
      return 0;
    }
    return academicIdentityDelegate.count({ where: { user: { emailNormalized } } });
  }

  async function seedSignupLegalDocuments(databaseNow: Date) {
    const effectiveAt = new Date(databaseNow.getTime() - 60_000);
    await suite.prisma.legalDocumentVersion.createMany({
      data: [
        {
          id: signupLegalDocumentIds.termsVersionId,
          kind: 'TERMS_OF_SERVICE',
          version: 'integration-terms',
          title: '통합 테스트 이용약관',
          summaryItems: [],
          sections: [],
          publishedAt: effectiveAt,
          effectiveAt,
        },
        {
          id: signupLegalDocumentIds.privacyPolicyVersionIdShown,
          kind: 'PRIVACY_POLICY',
          version: 'integration-privacy',
          title: '통합 테스트 개인정보 처리방침',
          summaryItems: [],
          sections: [],
          publishedAt: effectiveAt,
          effectiveAt,
        },
        {
          id: signupLegalDocumentIds.personalDataConsentVersionId,
          kind: 'PERSONAL_DATA_COLLECTION_USE_CONSENT',
          version: 'integration-personal-data-consent',
          title: '통합 테스트 개인정보 수집·이용 동의',
          summaryItems: [],
          sections: [],
          publishedAt: effectiveAt,
          effectiveAt,
        },
        {
          id: signupLegalDocumentIds.ageNoticeVersionId,
          kind: 'AGE_14_OR_ABOVE_NOTICE',
          version: 'integration-age-notice',
          title: '통합 테스트 연령 확인',
          summaryItems: [],
          sections: [],
          publishedAt: effectiveAt,
          effectiveAt,
        },
      ],
    });
  }

  it('동시에 같은 reset verification proof를 소비해도 비밀번호 변경은 한 번만 성공한다', async () => {
    const email = 'reset-race@kangwon.ac.kr';
    const emailNormalized = email.toLowerCase();
    const currentPasswordHash = await argonHash('OldPass1234', {
      algorithm: 2,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });
    const databaseNow = await suite.prisma.getDatabaseNow();

    await suite.prisma.user.create({
      data: {
        id: 'user-reset',
        email,
        emailNormalized,
        passwordHash: currentPasswordHash,
        gender: 'M',
        campus: 'CHUNCHEON',
        emailVerifiedAt: databaseNow,
      },
    });
    await suite.prisma.authSession.create({
      data: {
        id: 'session-reset',
        userId: 'user-reset',
        expiresAt: new Date(databaseNow.getTime() + 60 * 60 * 1000),
      },
    });
    const verificationCodeId = 'integration-reset-proof';
    const verificationGrant = createVerificationGrant(verificationCodeId);
    await suite.prisma.verificationCode.create({
      data: {
        id: verificationCodeId,
        subjectKey: toSubjectKey(emailNormalized),
        purpose: 'RESET_PASSWORD',
        codeHash: 'hmac-sha256:integration-reset-proof',
        issuedAt: databaseNow,
        codeExpiresAt: new Date(databaseNow.getTime() + 10 * 60 * 1000),
        verifiedAt: databaseNow,
        grantTokenHash: hashVerificationGrant(verificationGrant),
        grantExpiresAt: new Date(databaseNow.getTime() + 15 * 60 * 1000),
        eligibleUserId: 'user-reset',
      },
    });

    const settled = await Promise.allSettled([
      authService().resetPassword(verificationGrant, 'NewPass1234'),
      authService().resetPassword(verificationGrant, 'OtherPass1234'),
    ]);

    const fulfilled = settled.filter((result) => result.status === 'fulfilled');
    expect(fulfilled).toHaveLength(2);

    const responses = fulfilled.map(
      (result) => (result as PromiseFulfilledResult<{ success: boolean; code?: string }>).value,
    );
    const successResults = responses.filter((value) => value.success);
    const failureResults = responses.filter((value) => !value.success);

    expect(successResults, JSON.stringify(responses)).toHaveLength(1);
    expect(failureResults).toHaveLength(1);
    expect(failureResults[0]?.code).toBe('AUTH_RESET_RESTART_REQUIRED');

    const updatedUser = await suite.prisma.user.findUnique({
      where: { id: 'user-reset' },
    });
    expect(updatedUser?.passwordHash).not.toBe(currentPasswordHash);

    expect(
      await suite.prisma.verificationCode.count({
        where: {
          subjectKey: toSubjectKey(emailNormalized),
          purpose: 'RESET_PASSWORD',
          consumedAt: null,
        },
      }),
    ).toBe(0);

    expect(
      await suite.prisma.authSession.count({
        where: {
          userId: 'user-reset',
          revokedAt: null,
        },
      }),
    ).toBe(0);
  });
});

function toSubjectKey(emailNormalized: string): string {
  return hashAuthPersistenceDimension(
    'subject',
    emailNormalized,
    DEFAULT_AUTH_PERSISTENCE_HMAC_SECRET,
  );
}

function createVerificationGrant(verificationCodeId: string) {
  return `v1.${verificationCodeId}.${'g'.repeat(43)}`;
}
