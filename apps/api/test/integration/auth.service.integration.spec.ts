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
});
