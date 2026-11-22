import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createBackofficeApplication } from '../../src/app.factory.js';
import { issueBootstrapOwnerInvitation } from '../../src/admin-identity/bootstrap/bootstrap-owner.js';
import { AdminAuditWriter } from '../../src/audit/admin-audit-writer.js';
import { loadBackofficeSettings } from '../../src/platform/config/backoffice-settings.js';
import { BackofficeRuntimePrisma } from '../../src/platform/database/backoffice-prisma.js';
import { BackofficeLogger } from '../../src/platform/observability/backoffice-logger.js';
import { BackofficeMetrics } from '../../src/platform/observability/backoffice-metrics.js';
import { Clock } from '../../src/platform/time/clock.js';
import type { IntegrationSandbox } from './integration-database.js';
import { SoftwareAuthenticator } from './software-authenticator.js';

export class FakeClock extends Clock {
  constructor(private current: Date) {
    super();
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export const TEST_PASSWORD = 'correct horse battery staple';

export interface BackofficeTestApp {
  readonly app: INestApplication;
  readonly clock: FakeClock;
  readonly http: ReturnType<typeof request>;
  readonly prisma: BackofficeRuntimePrisma;
  readonly metrics: BackofficeMetrics;
  close(): Promise<void>;
}

export async function startBackofficeTestApp(
  sandbox: IntegrationSandbox,
  start = new Date(),
): Promise<BackofficeTestApp> {
  const settings = loadBackofficeSettings({
    NODE_ENV: 'test',
    BACKOFFICE_DATABASE_URL: sandbox.runtimeUrl,
    BACKOFFICE_RETENTION_DATABASE_URL: sandbox.retentionUrl,
    BACKOFFICE_TOTP_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    BACKOFFICE_RETENTION_JOB_ENABLED: 'false',
  });
  const clock = new FakeClock(start);
  const app = await createBackofficeApplication(settings, {
    clock,
    logger: new BackofficeLogger('error'),
  });
  await app.init();
  return {
    app,
    clock,
    http: request(app.getHttpServer() as Server),
    prisma: app.get(BackofficeRuntimePrisma),
    metrics: app.get(BackofficeMetrics),
    close: () => app.close(),
  };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export interface RegisteredOperator {
  readonly accountId: string;
  readonly email: string;
  readonly token: string;
  readonly authenticator: SoftwareAuthenticator;
  readonly totpSecret: string;
  readonly recoveryCodes: string[];
}

export async function acceptInvitation(
  test: BackofficeTestApp,
  code: string,
  email: string,
  authenticator = new SoftwareAuthenticator(),
): Promise<RegisteredOperator> {
  const options = await test.http.post('/auth/registration/options').send({ code }).expect(200);
  const body = options.body as {
    challengeId: string;
    options: Parameters<SoftwareAuthenticator['register']>[0];
  };
  const registered = await test.http
    .post('/auth/registration')
    .send({
      code,
      password: TEST_PASSWORD,
      challengeId: body.challengeId,
      credential: authenticator.register(body.options),
    })
    .expect(200);
  const result = registered.body as {
    accountId: string;
    session: { token: string };
    totp: { secret: string };
    recoveryCodes: string[];
  };
  return {
    accountId: result.accountId,
    email,
    token: result.session.token,
    authenticator,
    totpSecret: result.totp.secret,
    recoveryCodes: result.recoveryCodes,
  };
}

export async function bootstrapOwner(
  test: BackofficeTestApp,
  email = 'owner@backoffice.test',
): Promise<RegisteredOperator> {
  const invitation = await issueBootstrapOwnerInvitation(
    { prisma: test.prisma, audit: test.app.get(AdminAuditWriter), clock: test.clock },
    { email, displayName: 'Owner' },
  );
  return acceptInvitation(test, invitation.code, email);
}

export async function reauthenticate(test: BackofficeTestApp, operator: RegisteredOperator) {
  const options = await test.http
    .post('/auth/reauthentication/options')
    .set(bearer(operator.token))
    .expect(200);
  const body = options.body as {
    challengeId: string;
    options: Parameters<SoftwareAuthenticator['authenticate']>[0];
  };
  await test.http
    .post('/auth/reauthentication')
    .set(bearer(operator.token))
    .send({
      challengeId: body.challengeId,
      credential: operator.authenticator.authenticate(body.options),
    })
    .expect(200);
}

export function passwordStep(test: BackofficeTestApp, email: string, password = TEST_PASSWORD) {
  return test.http.post('/auth/login/password').send({ email, password });
}

export async function loginWithPasskey(
  test: BackofficeTestApp,
  operator: Pick<RegisteredOperator, 'email' | 'authenticator'>,
): Promise<string> {
  const step = await passwordStep(test, operator.email).expect(200);
  const body = step.body as {
    challengeId: string;
    options: Parameters<SoftwareAuthenticator['authenticate']>[0];
  };
  const login = await test.http
    .post('/auth/login/passkey')
    .send({
      challengeId: body.challengeId,
      credential: operator.authenticator.authenticate(body.options),
    })
    .expect(200);
  return (login.body as { session: { token: string } }).session.token;
}

/** Invites a second operator as the owner and returns the registered account. */
export async function inviteOperator(
  test: BackofficeTestApp,
  owner: RegisteredOperator,
  email: string,
): Promise<RegisteredOperator> {
  const invitation = await test.http
    .post('/accounts/invitations')
    .set(bearer(owner.token))
    .send({ email, displayName: 'Operator' })
    .expect(200);
  return acceptInvitation(test, (invitation.body as { code: string }).code, email);
}

export async function auditActions(sandbox: IntegrationSandbox): Promise<string[]> {
  const { rows } = await sandbox.admin.query<{ action: string }>(
    `SELECT "action" FROM ${sandbox.table('AdminAuditEvent')} ORDER BY "occurredAt", "id"`,
  );
  return rows.map((row) => row.action);
}
