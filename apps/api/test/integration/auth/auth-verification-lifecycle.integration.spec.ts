import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuthVerificationRequestRepository } from '../../../src/auth/verification/request/auth-verification-request.repository.js';
import { AuthVerificationChallengeRepository } from '../../../src/auth/verification/challenge/auth-verification-challenge.repository.js';
import { AuthVerificationGrantRepository } from '../../../src/auth/verification/grant/auth-verification-grant.repository.js';
import {
  createVerificationGrant,
  hashVerificationGrant,
} from '../../../src/auth/verification/grant/auth-verification-grant.js';
import { hashAuthPersistenceDimension } from '../../../src/auth/persistence/auth-persistence-dimension.js';
import { DEFAULT_AUTH_PERSISTENCE_HMAC_SECRET } from '../../../src/config/auth.config.js';
import { AuthMailOutboxRepository } from '../../../src/auth/mail/auth-mail-outbox.repository.js';
import { PrismaService } from '../../../src/platform/database/prisma.service.js';
import { createIntegrationApp } from '../_support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from '../_support/integration-db.js';

describe('Auth verification lifecycle repositories integration', () => {
  let prisma: PrismaService;
  let verificationRequests: AuthVerificationRequestRepository;
  let verificationChallenges: AuthVerificationChallengeRepository;
  let verificationGrants: AuthVerificationGrantRepository;
  let mailOutbox: AuthMailOutboxRepository;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('auth_verification_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    verificationRequests = app.get(AuthVerificationRequestRepository);
    verificationChallenges = app.get(AuthVerificationChallengeRepository);
    verificationGrants = app.get(AuthVerificationGrantRepository);
    mailOutbox = app.get(AuthMailOutboxRepository);
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

  it('동시에 같은 code를 verified 처리해도 성공 transition은 하나뿐이다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    const subjectKey = toSubjectKey('verify-race@kangwon.ac.kr');

    await prisma.verificationCode.create({
      data: {
        id: 'verify-race-code',
        subjectKey,
        purpose: 'SIGNUP',
        codeHash: 'hmac-sha256:verify-race',
        issuedAt: databaseNow,
        codeExpiresAt: new Date(databaseNow.getTime() + 10 * 60 * 1000),
      },
    });

    const [firstRecord, secondRecord] = await Promise.all([
      verificationChallenges.findActive(subjectKey, 'SIGNUP', 5),
      verificationChallenges.findActive(subjectKey, 'SIGNUP', 5),
    ]);

    expect(firstRecord?.id).toBe('verify-race-code');
    expect(secondRecord?.id).toBe('verify-race-code');

    const firstGrant = createVerificationGrant('verify-race-code');
    const secondGrant = createVerificationGrant('verify-race-code');
    const results = await Promise.all([
      verificationChallenges.markVerifiedAndIssueGrant({
        id: 'verify-race-code',
        subjectKey,
        purpose: 'SIGNUP',
        maxAttempts: 5,
        grantTokenHash: hashVerificationGrant(firstGrant),
        grantTtlSeconds: 900,
        eligibleUserId: null,
      }),
      verificationChallenges.markVerifiedAndIssueGrant({
        id: 'verify-race-code',
        subjectKey,
        purpose: 'SIGNUP',
        maxAttempts: 5,
        grantTokenHash: hashVerificationGrant(secondGrant),
        grantTtlSeconds: 900,
        eligibleUserId: null,
      }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);

    const row = await prisma.verificationCode.findUniqueOrThrow({
      where: { id: 'verify-race-code' },
    });
    expect(row.verifiedAt).toBeInstanceOf(Date);
    expect([hashVerificationGrant(firstGrant), hashVerificationGrant(secondGrant)]).toContain(
      row.grantTokenHash,
    );
  });

  it('reset grant는 code 만료가 아니라 verified 시점부터 15분 동안 유효하다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    const subjectKey = toSubjectKey('reset-proof-ttl@kangwon.ac.kr');
    const grant = createVerificationGrant('reset-proof-ttl-code');

    await prisma.verificationCode.create({
      data: {
        id: 'reset-proof-ttl-code',
        subjectKey,
        purpose: 'RESET_PASSWORD',
        codeHash: 'hmac-sha256:reset-proof-ttl',
        issuedAt: new Date(databaseNow.getTime() - 12 * 60 * 1000),
        codeExpiresAt: new Date(databaseNow.getTime() - 2 * 60 * 1000),
        verifiedAt: new Date(databaseNow.getTime() - 5 * 60 * 1000),
        grantTokenHash: hashVerificationGrant(grant),
        grantExpiresAt: new Date(databaseNow.getTime() + 10 * 60 * 1000),
        eligibleUserId: 'user-1',
      },
    });

    await expect(verificationGrants.resolve(grant, 'RESET_PASSWORD')).resolves.toMatchObject({
      id: 'reset-proof-ttl-code',
      subjectKey,
      eligibleUserId: 'user-1',
    });
  });

  it('동시 failed attempts가 max에 도달하면 code를 atomic consume한다', async () => {
    const databaseNow = await prisma.getDatabaseNow();

    await prisma.verificationCode.create({
      data: {
        id: 'failure-race-code',
        subjectKey: toSubjectKey('failure-race@kangwon.ac.kr'),
        purpose: 'RESET_PASSWORD',
        codeHash: 'hmac-sha256:failure-race',
        failedAttempts: 3,
        issuedAt: databaseNow,
        codeExpiresAt: new Date(databaseNow.getTime() + 10 * 60 * 1000),
      },
    });

    const results = await Promise.all([
      verificationChallenges.recordFailure({
        id: 'failure-race-code',
        subjectKey: toSubjectKey('failure-race@kangwon.ac.kr'),
        purpose: 'RESET_PASSWORD',
        maxAttempts: 5,
      }),
      verificationChallenges.recordFailure({
        id: 'failure-race-code',
        subjectKey: toSubjectKey('failure-race@kangwon.ac.kr'),
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

  it('새 mail이 실패하면 이전 delivered code는 active 상태를 유지한다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    const subjectKey = toSubjectKey('old-code-preserved@kangwon.ac.kr');
    await prisma.verificationCode.create({
      data: {
        id: 'old-accepted-code',
        subjectKey,
        purpose: 'RESET_PASSWORD',
        codeHash: 'hmac-sha256:old',
        deliveryStatus: 'ACCEPTED',
        issuedAt: databaseNow,
        activatedAt: databaseNow,
        codeExpiresAt: new Date(databaseNow.getTime() + 10 * 60 * 1_000),
      },
    });

    await verificationRequests.append({
      subjectKey,
      purpose: 'RESET_PASSWORD',
      requestIpKey: toRequestIpKey('127.0.0.1'),
      cooldownSeconds: 5,
      backstopWindowSeconds: 600,
      backstopLimit: 20,
      securityEvent: null,
      candidate: {
        id: 'new-pending-code',
        subjectKey,
        codeHash: 'hmac-sha256:new',
        ttlSeconds: 600,
        requestIpKey: toRequestIpKey('127.0.0.1'),
        emailEnvelope: {
          payloadCiphertext: Buffer.from('ciphertext'),
          payloadIv: Buffer.from('123456789012'),
          payloadAuthTag: Buffer.from('1234567890123456'),
          keyVersion: 'test-v1',
        },
      },
    });
    const claimNow = new Date((await prisma.getDatabaseNow()).getTime() + 1_000);
    const [claimed] = await mailOutbox.claimBatch(prisma, {
      limit: 10,
      now: claimNow,
      claimLeaseMs: 30_000,
      lockedBy: 'failure-worker',
    });
    expect(claimed?.verificationCodeId).toBe('new-pending-code');

    await mailOutbox.markDeliveryFailure(prisma, {
      eventId: claimed!.id,
      now: new Date(claimNow.getTime() + 1),
      status: 'FAILED',
      providerErrorCategory: 'MESSAGE_REJECTED',
    });

    const [oldCode, newCode] = await Promise.all([
      prisma.verificationCode.findUniqueOrThrow({ where: { id: 'old-accepted-code' } }),
      prisma.verificationCode.findUniqueOrThrow({ where: { id: 'new-pending-code' } }),
    ]);
    expect(oldCode).toMatchObject({ deliveryStatus: 'ACCEPTED', consumedAt: null });
    expect(newCode.deliveryStatus).toBe('FAILED');
    expect(newCode.consumedAt).toBeInstanceOf(Date);
  });

  it('code 요청 transaction은 log, security event, pending code와 encrypted outbox를 함께 append한다', async () => {
    const subjectKey = toSubjectKey('transactional-request@kangwon.ac.kr');
    const requestIpKey = toRequestIpKey('127.0.0.1');
    const candidateInput = (id: string) => ({
      id,
      subjectKey,
      codeHash: `hmac-sha256:${id}`,
      ttlSeconds: 600,
      requestIpKey,
      emailEnvelope: {
        payloadCiphertext: Buffer.from(`encrypted-${id}`),
        payloadIv: Buffer.from('123456789012'),
        payloadAuthTag: Buffer.from('1234567890123456'),
        keyVersion: 'test-v1',
      },
    });

    await verificationRequests.append({
      subjectKey,
      purpose: 'SIGNUP',
      requestIpKey,
      cooldownSeconds: 1,
      backstopWindowSeconds: 600,
      backstopLimit: 20,
      candidate: candidateInput('pending-first'),
      securityEvent: {
        type: 'VERIFICATION_CODE_REQUESTED',
        severity: 'INFO',
        emailHash: subjectKey,
        requestIpHash: requestIpKey,
        metadata: { purpose: 'SIGNUP' },
      },
    });

    const [requestLogs, securityEvents, firstCode, firstOutbox] = await Promise.all([
      prisma.verificationCodeRequestLog.findMany({ where: { subjectKey } }),
      prisma.authSecurityEvent.findMany({ where: { emailHash: subjectKey } }),
      prisma.verificationCode.findUniqueOrThrow({ where: { id: 'pending-first' } }),
      prisma.authMailOutboxEvent.findFirstOrThrow({
        where: { verificationCodeId: 'pending-first' },
      }),
    ]);
    expect(requestLogs).toHaveLength(1);
    expect(securityEvents).toHaveLength(1);
    expect(firstCode).toMatchObject({ deliveryStatus: 'PENDING', activatedAt: null });
    expect(firstOutbox).toMatchObject({
      status: 'PENDING',
      keyVersion: 'test-v1',
    });
    expect(firstOutbox.payloadCiphertext).not.toBeNull();
    expect(JSON.stringify({ requestLogs, securityEvents, firstCode, firstOutbox })).not.toContain(
      'transactional-request@kangwon.ac.kr',
    );

    await prisma.verificationCodeRequestLog.updateMany({
      where: { subjectKey },
      data: { createdAt: new Date(Date.now() - 2_000) },
    });
    await verificationRequests.append({
      subjectKey,
      purpose: 'SIGNUP',
      requestIpKey,
      cooldownSeconds: 1,
      backstopWindowSeconds: 600,
      backstopLimit: 20,
      candidate: candidateInput('pending-second'),
      securityEvent: null,
    });

    const [supersededCode, supersededOutbox, newestCode] = await Promise.all([
      prisma.verificationCode.findUniqueOrThrow({ where: { id: 'pending-first' } }),
      prisma.authMailOutboxEvent.findFirstOrThrow({
        where: { verificationCodeId: 'pending-first' },
      }),
      prisma.verificationCode.findUniqueOrThrow({ where: { id: 'pending-second' } }),
    ]);
    expect(supersededCode.deliveryStatus).toBe('SUPERSEDED');
    expect(supersededOutbox).toMatchObject({
      status: 'SUPERSEDED',
      payloadCiphertext: null,
      payloadIv: null,
      payloadAuthTag: null,
    });
    expect(newestCode.deliveryStatus).toBe('PENDING');
  });

  it('provider acceptance transaction만 이전 code를 supersede하고 candidate를 활성화한다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    const subjectKey = toSubjectKey('accepted-code-transition@kangwon.ac.kr');
    await prisma.verificationCode.create({
      data: {
        id: 'previous-accepted-code',
        subjectKey,
        purpose: 'SIGNUP',
        codeHash: 'hmac-sha256:previous',
        issuedAt: databaseNow,
        codeExpiresAt: new Date(databaseNow.getTime() + 600_000),
      },
    });
    await verificationRequests.append({
      subjectKey,
      purpose: 'SIGNUP',
      requestIpKey: toRequestIpKey('127.0.0.1'),
      cooldownSeconds: 5,
      backstopWindowSeconds: 600,
      backstopLimit: 20,
      securityEvent: null,
      candidate: {
        id: 'accepted-candidate',
        subjectKey,
        codeHash: 'hmac-sha256:candidate',
        ttlSeconds: 600,
        requestIpKey: toRequestIpKey('127.0.0.1'),
        emailEnvelope: {
          payloadCiphertext: Buffer.from('ciphertext'),
          payloadIv: Buffer.from('123456789012'),
          payloadAuthTag: Buffer.from('1234567890123456'),
          keyVersion: 'test-v1',
        },
      },
    });
    const claimNow = new Date((await prisma.getDatabaseNow()).getTime() + 1_000);
    const [claimed] = await mailOutbox.claimBatch(prisma, {
      limit: 1,
      now: claimNow,
      claimLeaseMs: 30_000,
    });
    await expect(
      mailOutbox.markAccepted(prisma, {
        eventId: claimed!.id,
        now: new Date(claimNow.getTime() + 1),
        providerMessageId: 'ses-message-1',
      }),
    ).resolves.toBe(true);

    const [previous, candidate, outbox] = await Promise.all([
      prisma.verificationCode.findUniqueOrThrow({ where: { id: 'previous-accepted-code' } }),
      prisma.verificationCode.findUniqueOrThrow({ where: { id: 'accepted-candidate' } }),
      prisma.authMailOutboxEvent.findUniqueOrThrow({ where: { id: claimed!.id } }),
    ]);
    expect(previous.deliveryStatus).toBe('SUPERSEDED');
    expect(previous.consumedAt).toBeInstanceOf(Date);
    expect(candidate).toMatchObject({
      deliveryStatus: 'ACCEPTED',
      consumedAt: null,
      providerCorrelationId: 'ses-message-1',
    });
    expect(candidate.activatedAt).toBeInstanceOf(Date);
    expect(outbox).toMatchObject({
      status: 'ACCEPTED',
      payloadCiphertext: null,
      providerMessageId: 'ses-message-1',
    });
  });

  it('concurrent worker와 lease restart에서도 event claim은 한 worker에만 귀속된다', async () => {
    const databaseNow = await prisma.getDatabaseNow();
    await prisma.authMailOutboxEvent.create({
      data: {
        id: 'lease-event',
        mailKind: 'PASSWORD_CHANGED',
        targetUserId: 'user-1',
        payloadCiphertext: Buffer.from('ciphertext'),
        payloadIv: Buffer.from('123456789012'),
        payloadAuthTag: Buffer.from('1234567890123456'),
        keyVersion: 'test-v1',
        expiresAt: new Date(databaseNow.getTime() + 600_000),
      },
    });
    const claimNow = new Date((await prisma.getDatabaseNow()).getTime() + 1_000);

    const [first, second] = await Promise.all([
      mailOutbox.claimBatch(prisma, {
        limit: 1,
        now: claimNow,
        claimLeaseMs: 30_000,
        lockedBy: 'worker-a',
      }),
      mailOutbox.claimBatch(prisma, {
        limit: 1,
        now: claimNow,
        claimLeaseMs: 30_000,
        lockedBy: 'worker-b',
      }),
    ]);
    expect(first.length + second.length).toBe(1);

    await expect(
      mailOutbox.claimBatch(prisma, {
        limit: 1,
        now: new Date(claimNow.getTime() + 10_000),
        claimLeaseMs: 30_000,
        lockedBy: 'worker-c',
      }),
    ).resolves.toHaveLength(0);
    await expect(
      mailOutbox.claimBatch(prisma, {
        limit: 1,
        now: new Date(claimNow.getTime() + 31_000),
        claimLeaseMs: 30_000,
        lockedBy: 'worker-restarted',
      }),
    ).resolves.toHaveLength(1);
  });
});

function toSubjectKey(emailNormalized: string): string {
  return hashAuthPersistenceDimension(
    'subject',
    emailNormalized,
    DEFAULT_AUTH_PERSISTENCE_HMAC_SECRET,
  );
}

function toRequestIpKey(requestIp: string): string {
  return hashAuthPersistenceDimension(
    'request-ip',
    requestIp,
    DEFAULT_AUTH_PERSISTENCE_HMAC_SECRET,
  );
}
