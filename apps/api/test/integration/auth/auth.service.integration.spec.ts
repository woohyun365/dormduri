import { describe, expect, it } from 'vitest';
import { hash as argonHash } from '@node-rs/argon2';
import { createHash } from 'node:crypto';
import { AuthService } from '../../../src/auth/application/auth.service.js';
import { seedBaseSeasonFixtures } from '../_support/integration-fixtures.js';
import { useIntegrationTestSuite } from '../_support/integration-suite.js';

function hashTokenForTest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

describe('AuthService integration', () => {
  const suite = useIntegrationTestSuite('auth_service_integration');

  function authService() {
    return suite.app.get(AuthService);
  }

  it('login은 opaque access token hash를 AuthSession에 저장하고 logout 후 fail-closed 처리한다', async () => {
    const email = 'opaque-login@kangwon.ac.kr';
    const emailNormalized = email.toLowerCase();
    const passwordHash = await argonHash('Pass1234', {
      algorithm: 2,
      memoryCost: 8192,
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
    expect(result.accessToken).not.toMatch(/^eyJ/);

    const session = await suite.prisma.authSession.findFirstOrThrow({
      where: { userId: 'opaque-login-user' },
    });
    expect(session.sessionTokenHash).toBe(hashTokenForTest(result.accessToken ?? ''));
    expect(session.sessionTokenHash).not.toBe(result.accessToken);

    await expect(authService().getSession(result.accessToken ?? null)).resolves.toMatchObject({
      authenticated: true,
      user: { id: 'opaque-login-user', email },
    });

    await expect(authService().logout(result.accessToken ?? null)).resolves.toEqual({
      success: true,
    });
    await expect(authService().getSession(result.accessToken ?? null)).resolves.toEqual({
      authenticated: false,
    });
  });

  it('동시에 같은 signup verification proof를 소비해도 User/DisplayIdentity/AcademicIdentity 계정은 하나만 생성된다', async () => {
    const email = 'signup-race@kangwon.ac.kr';
    const emailNormalized = email.toLowerCase();
    const databaseNow = await suite.prisma.getDatabaseNow();
    await seedAcademicIdentityReferenceData();
    await suite.prisma.verificationCode.create({
      data: {
        emailNormalized,
        purpose: 'SIGNUP',
        codeHash: 'hmac-sha256:integration-signup-proof',
        issuedAt: databaseNow,
        expiresAt: new Date(databaseNow.getTime() + 10 * 60 * 1000),
        verifiedAt: databaseNow,
      },
    });

    const signupInput = {
      email,
      password: 'Pass1234',
      nickname: '통합테스트닉네임',
      gender: 'M' as const,
      campus: 'CHUNCHEON' as const,
      collegeCode: 'IT',
      birthYear: 2002,
    } as never;

    const settled = await Promise.allSettled([
      authService().signup(signupInput),
      authService().signup(signupInput),
    ]);

    const fulfilled = settled.filter((result) => result.status === 'fulfilled');
    const rejected = settled.filter((result) => result.status === 'rejected');

    const responses = fulfilled.map(
      (result) => (result as PromiseFulfilledResult<{ accessToken?: string; code?: string }>).value,
    );
    const successResults = responses.filter((value) => Boolean(value.accessToken));
    const failureResults = responses.filter((value) => !value.accessToken);

    expect(successResults).toHaveLength(1);
    expect(failureResults.length + rejected.length).toBe(1);
    if (failureResults[0]) {
      expect(
        ['AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED', 'AUTH_EMAIL_ALREADY_REGISTERED'].includes(
          failureResults[0].code ?? '',
        ),
      ).toBe(true);
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
          emailNormalized,
          purpose: 'SIGNUP',
          consumedAt: null,
        },
      }),
    ).toBe(0);
  });

  async function seedAcademicIdentityReferenceData() {
    await seedBaseSeasonFixtures(suite.prisma);
    await suite.prisma.collegeMaster.upsert({
      where: { code: 'IT' },
      create: {
        code: 'IT',
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

  it('동시에 같은 reset verification proof를 소비해도 비밀번호 변경은 한 번만 성공한다', async () => {
    const email = 'reset-race@kangwon.ac.kr';
    const emailNormalized = email.toLowerCase();
    const currentPasswordHash = await argonHash('OldPass1234', {
      algorithm: 2,
      memoryCost: 8192,
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
    await suite.prisma.verificationCode.create({
      data: {
        emailNormalized,
        purpose: 'RESET_PASSWORD',
        codeHash: 'hmac-sha256:integration-reset-proof',
        issuedAt: databaseNow,
        expiresAt: new Date(databaseNow.getTime() + 10 * 60 * 1000),
        verifiedAt: databaseNow,
      },
    });

    const settled = await Promise.allSettled([
      authService().resetPassword(email, 'NewPass1234'),
      authService().resetPassword(email, 'OtherPass1234'),
    ]);

    const fulfilled = settled.filter((result) => result.status === 'fulfilled');
    expect(fulfilled).toHaveLength(2);

    const responses = fulfilled.map(
      (result) => (result as PromiseFulfilledResult<{ success: boolean; code?: string }>).value,
    );
    const successResults = responses.filter((value) => value.success);
    const failureResults = responses.filter((value) => !value.success);

    expect(successResults).toHaveLength(1);
    expect(failureResults).toHaveLength(1);
    expect(failureResults[0]?.code).toBe('AUTH_RESET_RESTART_REQUIRED');

    const updatedUser = await suite.prisma.user.findUnique({
      where: { id: 'user-reset' },
    });
    expect(updatedUser?.passwordHash).not.toBe(currentPasswordHash);

    expect(
      await suite.prisma.verificationCode.count({
        where: {
          emailNormalized,
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
