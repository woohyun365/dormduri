import { randomUUID } from 'node:crypto';
import { AuthVerificationStore } from '../../src/auth/auth-verification.store.js';
import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';

describe('AuthVerificationStore integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let store: AuthVerificationStore;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('auth_verification_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    store = app.get(AuthVerificationStore);
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

  it('동시에 signup code를 교체해도 active signup code는 하나만 남는다', async () => {
    const emailNormalized = 'race-signup@kangwon.ac.kr';

    const first = store.replaceActiveSignupCode({
      id: randomUUID(),
      emailNormalized,
      codeHash: 'hmac-sha256:first',
      ttlSeconds: 600,
      requestIp: '127.0.0.1',
    });
    const second = store.replaceActiveSignupCode({
      id: randomUUID(),
      emailNormalized,
      codeHash: 'hmac-sha256:second',
      ttlSeconds: 600,
      requestIp: '127.0.0.1',
    });

    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);

    const rows = await prisma.verificationCode.findMany({
      where: {
        emailNormalized,
        purpose: 'SIGNUP',
      },
      orderBy: [{ issuedAt: 'asc' }, { id: 'asc' }],
    });

    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.consumedAt === null)).toHaveLength(1);
    expect(rows.filter((row) => row.consumedAt !== null)).toHaveLength(1);
  });
});
