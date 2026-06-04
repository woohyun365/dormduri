import { randomUUID } from 'node:crypto';
import { AuthVerificationStore } from '../../src/auth/auth-verification.store.js';
import { PrismaService } from '../../src/platform/database/prisma.service.js';
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

  it('동시에 reset code를 교체해도 active reset code는 하나만 남는다', async () => {
    const emailNormalized = 'race-reset@kangwon.ac.kr';

    const first = store.replaceActiveResetCode({
      id: randomUUID(),
      emailNormalized,
      codeHash: 'hmac-sha256:first-reset',
      ttlSeconds: 600,
      requestIp: '127.0.0.1',
    });
    const second = store.replaceActiveResetCode({
      id: randomUUID(),
      emailNormalized,
      codeHash: 'hmac-sha256:second-reset',
      ttlSeconds: 600,
      requestIp: '127.0.0.1',
    });

    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);

    const rows = await prisma.verificationCode.findMany({
      where: {
        emailNormalized,
        purpose: 'RESET_PASSWORD',
      },
      orderBy: [{ issuedAt: 'asc' }, { id: 'asc' }],
    });

    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.consumedAt === null)).toHaveLength(1);
    expect(rows.filter((row) => row.consumedAt !== null)).toHaveLength(1);
  });

  it('동시에 같은 code를 verified 처리해도 성공 transition은 하나뿐이다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    const emailNormalized = 'verify-race@kangwon.ac.kr';

    await prisma.verificationCode.create({
      data: {
        id: 'verify-race-code',
        emailNormalized,
        purpose: 'SIGNUP',
        codeHash: 'hmac-sha256:verify-race',
        issuedAt: databaseNow,
        expiresAt: new Date(databaseNow.getTime() + 10 * 60 * 1000),
      },
    });

    const [firstRecord, secondRecord] = await Promise.all([
      store.findActiveVerificationRecord(emailNormalized, 'SIGNUP', 5),
      store.findActiveVerificationRecord(emailNormalized, 'SIGNUP', 5),
    ]);

    expect(firstRecord?.id).toBe('verify-race-code');
    expect(secondRecord?.id).toBe('verify-race-code');

    const results = await Promise.all([
      store.markVerified({
        id: 'verify-race-code',
        emailNormalized,
        purpose: 'SIGNUP',
        maxAttempts: 5,
      }),
      store.markVerified({
        id: 'verify-race-code',
        emailNormalized,
        purpose: 'SIGNUP',
        maxAttempts: 5,
      }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);

    const row = await prisma.verificationCode.findUniqueOrThrow({
      where: { id: 'verify-race-code' },
    });
    expect(row.verifiedAt).toBeInstanceOf(Date);
  });

  it('동시 failed attempts가 max에 도달하면 code를 atomic consume한다', async () => {
    const databaseNow = await prisma.getDatabaseNow();

    await prisma.verificationCode.create({
      data: {
        id: 'failure-race-code',
        emailNormalized: 'failure-race@kangwon.ac.kr',
        purpose: 'RESET_PASSWORD',
        codeHash: 'hmac-sha256:failure-race',
        failedAttempts: 3,
        issuedAt: databaseNow,
        expiresAt: new Date(databaseNow.getTime() + 10 * 60 * 1000),
      },
    });

    const results = await Promise.all([
      store.recordVerificationFailure({
        id: 'failure-race-code',
        emailNormalized: 'failure-race@kangwon.ac.kr',
        purpose: 'RESET_PASSWORD',
        maxAttempts: 5,
      }),
      store.recordVerificationFailure({
        id: 'failure-race-code',
        emailNormalized: 'failure-race@kangwon.ac.kr',
        purpose: 'RESET_PASSWORD',
        maxAttempts: 5,
      }),
    ]);

    expect(results.every((result) => result.recorded)).toBe(true);
    expect(results.some((result) => result.consumed)).toBe(true);

    const row = await prisma.verificationCode.findUniqueOrThrow({
      where: { id: 'failure-race-code' },
    });
    expect(row.failedAttempts).toBe(5);
    expect(row.consumedAt).toBeInstanceOf(Date);
  });
});
