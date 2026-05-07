import { hash as argonHash } from '@node-rs/argon2';
import { AuthService } from '../../src/auth/auth.service.js';
import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';
import { DEFAULT_LIFESTYLE } from './support/integration-fixtures.js';

describe('AuthService integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let service: AuthService;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('auth_service_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    service = app.get(AuthService);
  });

  afterAll(async () => {
    if (closeApp) {
      await closeApp();
    }
    if (cleanupDb) {
      await cleanupDb();
    }
  });

  beforeEach(async () => {
    await truncateIntegrationSchema(prisma);
  });

  it('동시에 같은 signup verification proof를 소비해도 계정은 하나만 생성된다', async () => {
    const email = 'signup-race@kangwon.ac.kr';
    const emailNormalized = email.toLowerCase();
    const databaseNow = await prisma.getDatabaseNow();
    await prisma.verificationCode.create({
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
      lifestyle: DEFAULT_LIFESTYLE,
      intro: 'integration intro',
    };

    const settled = await Promise.allSettled([
      service.signup(signupInput),
      service.signup(signupInput),
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
      await prisma.user.count({
        where: { emailNormalized },
      }),
    ).toBe(1);

    expect(
      await prisma.verificationCode.count({
        where: {
          emailNormalized,
          purpose: 'SIGNUP',
          consumedAt: null,
        },
      }),
    ).toBe(0);
  });

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
    const databaseNow = await prisma.getDatabaseNow();

    await prisma.user.create({
      data: {
        id: 'user-reset',
        email,
        emailNormalized,
        passwordHash: currentPasswordHash,
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitorySelectionState: 'NOT_SELECTED',
        emailVerifiedAt: databaseNow,
      },
    });
    await prisma.authSession.create({
      data: {
        id: 'session-reset',
        userId: 'user-reset',
        expiresAt: new Date(databaseNow.getTime() + 60 * 60 * 1000),
      },
    });
    await prisma.verificationCode.create({
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
      service.resetPassword(email, 'NewPass1234'),
      service.resetPassword(email, 'OtherPass1234'),
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

    const updatedUser = await prisma.user.findUnique({
      where: { id: 'user-reset' },
    });
    expect(updatedUser?.passwordHash).not.toBe(currentPasswordHash);

    expect(
      await prisma.verificationCode.count({
        where: {
          emailNormalized,
          purpose: 'RESET_PASSWORD',
          consumedAt: null,
        },
      }),
    ).toBe(0);

    expect(
      await prisma.authSession.count({
        where: {
          userId: 'user-reset',
          revokedAt: null,
        },
      }),
    ).toBe(0);
  });
});
