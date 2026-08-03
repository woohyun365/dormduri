import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AUTH_VERIFICATION_GRANT_HEADER } from '@repo/shared/auth/contract';
import { hashPassword } from '../../../src/auth/credentials/password-hashing/password-hash.js';
import { AuthMailEnvelopeReader } from '../../../src/auth/mail/auth-mail-envelope-reader.service.js';
import { AuthMailDispatcherService } from '../../../src/auth/mail/auth-mail-dispatcher.service.js';
import type { PrismaService } from '../../../src/platform/database/prisma.service.js';
import { createIntegrationApp } from '../../integration/_support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from '../../integration/_support/integration-db.js';

const EMAIL = 'password-reset-e2e@kangwon.ac.kr';
const OLD_PASSWORD = 'BeforeReset1234';
const NEW_PASSWORD = 'AfterReset5678';

describe('Password reset recovery HTTP E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let envelopeReader: AuthMailEnvelopeReader;
  let cleanupDb: (() => Promise<void>) | null = null;
  let originalMailDispatcherEnabled: string | undefined;

  beforeAll(async () => {
    originalMailDispatcherEnabled = process.env.AUTH_MAIL_DISPATCHER_ENABLED;
    process.env.AUTH_MAIL_DISPATCHER_ENABLED = 'false';
    const sandbox = await createIntegrationDatabaseSandbox('password_reset_recovery_e2e');
    cleanupDb = sandbox.cleanup;
    const context = await createIntegrationApp();
    app = context.app;
    prisma = context.prisma;
    envelopeReader = app.get(AuthMailEnvelopeReader);
    await truncateIntegrationSchema(prisma);

    const now = await prisma.getDatabaseNow();
    await prisma.user.create({
      data: {
        id: 'password-reset-e2e-user',
        email: EMAIL,
        emailNormalized: EMAIL,
        passwordHash: await hashPassword(OLD_PASSWORD),
        gender: 'F',
        campus: 'CHUNCHEON',
        emailVerifiedAt: now,
        displayIdentity: {
          create: {
            nickname: '복구흐름검증',
            nicknameNormalized: '복구흐름검증',
          },
        },
      },
    });
  });

  afterAll(async () => {
    await app?.close();
    await cleanupDb?.();
    if (originalMailDispatcherEnabled === undefined) {
      delete process.env.AUTH_MAIL_DISPATCHER_ENABLED;
    } else {
      process.env.AUTH_MAIL_DISPATCHER_ENABLED = originalMailDispatcherEnabled;
    }
  });

  it('request부터 새 비밀번호 login까지 grant single-use와 전체 session revoke를 유지한다', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const firstLogin = await request(server)
      .post('/auth/login')
      .send({ email: EMAIL, password: OLD_PASSWORD, rememberMe: true })
      .expect(200);
    const firstLoginBody = toRecord(firstLogin.body as unknown);
    expect(firstLoginBody).toMatchObject({ success: true });
    const oldAccessToken = String(firstLoginBody.accessToken);

    await request(server)
      .post('/auth/send-reset-code')
      .set('x-forwarded-for', '203.0.113.70')
      .send({ email: EMAIL })
      .expect(201, { success: true });

    const resetMail = await prisma.authMailOutboxEvent.findFirstOrThrow({
      where: { mailKind: 'PASSWORD_RESET_VERIFICATION' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const resetEnvelope = envelopeReader.decrypt({
      payloadCiphertext: requireBytes(resetMail.payloadCiphertext, 'payloadCiphertext'),
      payloadIv: requireBytes(resetMail.payloadIv, 'payloadIv'),
      payloadAuthTag: requireBytes(resetMail.payloadAuthTag, 'payloadAuthTag'),
      keyVersion: resetMail.keyVersion,
    });
    expect(resetEnvelope.mailKind).toBe('PASSWORD_RESET_VERIFICATION');
    if (resetEnvelope.mailKind !== 'PASSWORD_RESET_VERIFICATION') {
      throw new Error('Expected password reset verification envelope');
    }
    await expect(app.get(AuthMailDispatcherService).dispatchOnce()).resolves.toMatchObject({
      acceptedCount: 1,
      failedCount: 0,
    });

    const verified = await request(server)
      .post('/auth/verify-reset-code')
      .set('x-forwarded-for', '203.0.113.70')
      .send({ email: EMAIL, code: resetEnvelope.code })
      .expect(201);
    const verifiedBody = toRecord(verified.body as unknown);
    expect(verifiedBody.success, JSON.stringify(verifiedBody)).toBe(true);
    expect(verifiedBody).toMatchObject({
      success: true,
      grantExpiresInSeconds: 900,
    });
    const resetGrant = String(verifiedBody.resetGrant);
    expect(resetGrant).toMatch(/^v1\.[^.]+\.[A-Za-z0-9_-]{43}$/u);

    await request(server)
      .post('/auth/reset-password')
      .set(AUTH_VERIFICATION_GRANT_HEADER, resetGrant)
      .send({ newPassword: NEW_PASSWORD })
      .expect(201, { success: true });

    const replay = await request(server)
      .post('/auth/reset-password')
      .set(AUTH_VERIFICATION_GRANT_HEADER, resetGrant)
      .send({ newPassword: 'AnotherPassword9012' })
      .expect(201);
    expect(toRecord(replay.body as unknown)).toMatchObject({
      success: false,
      code: 'AUTH_RESET_RESTART_REQUIRED',
    });

    const oldSession = await request(server)
      .get('/auth/session')
      .set('Authorization', `Bearer ${oldAccessToken}`)
      .expect(200);
    expect(toRecord(oldSession.body as unknown)).toMatchObject({ authenticated: false });

    const oldPasswordLogin = await request(server)
      .post('/auth/login')
      .send({ email: EMAIL, password: OLD_PASSWORD, rememberMe: false })
      .expect(200);
    expect(toRecord(oldPasswordLogin.body as unknown)).toMatchObject({ success: false });

    const newPasswordLogin = await request(server)
      .post('/auth/login')
      .send({ email: EMAIL, password: NEW_PASSWORD, rememberMe: false })
      .expect(200);
    expect(toRecord(newPasswordLogin.body as unknown)).toMatchObject({ success: true });

    await expect(
      prisma.authSecurityEvent.count({
        where: {
          targetUserId: 'password-reset-e2e-user',
          type: { in: ['PASSWORD_RESET_SUCCEEDED', 'SESSION_REVOKE_ALL'] },
        },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.authMailOutboxEvent.count({
        where: {
          targetUserId: 'password-reset-e2e-user',
          mailKind: 'PASSWORD_CHANGED',
        },
      }),
    ).resolves.toBe(1);
  });
});

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected object response body');
  }
  return value as Record<string, unknown>;
}

function requireBytes(value: Uint8Array | null, field: string): Uint8Array {
  if (!value) {
    throw new Error(`Expected encrypted mail ${field}`);
  }
  return value;
}
