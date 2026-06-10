import { PrismaService } from '../../src/platform/database/prisma.service.js';
import {
  activateThreadRetentionJobsForArchivedThreads,
  retryDueArchiveJobs,
} from '../../src/retention/archive-jobs/archive-job-runner.service.js';
import { claimDueDeletionArchiveJobs } from '../../src/retention/archive-jobs/archive-job.repository.js';
import { createDeletionArchiveJobsTx } from '../../src/retention/archive-jobs/create-deletion-archive-jobs.command.js';
import { createRetainedIdentityCipher } from '../../src/retention/retained-identities/retained-identity-cipher.js';
import { createRetainedIdentityOwner } from '../../src/retention/retained-identities/retained-identity.service.js';
import { claimDueRetentionReviewJobs } from '../../src/retention/review-jobs/retention-review-job-runner.service.js';
import { createConversationRetainedBodyCipher } from '../../src/chat/retention/conversation-retained-body.service.js';
import {
  createRetentionVaultCipher,
  createStaticRetentionVaultKeyring,
} from '../../src/retention/vault/retained-vault-keyring.js';
import { parseRetainedMatchHistoryPayload } from '../../src/retention/vault/retained-vault-payload-codecs.js';
import {
  discloseRetainedVaultPayload,
  retainVaultPayloadTx,
} from '../../src/retention/vault/retained-vault.service.js';
import { ensureRetentionCaseTx } from '../../src/retention/vault/retention-case.repository.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';
import {
  seedBaseSeasonFixtures,
  seedRegisteredAssignedParticipant,
} from './support/integration-fixtures.js';

describe('RetainedIdentity integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;
  const identifierCipher = createRetainedIdentityCipher({
    key: Buffer.alloc(32, 11),
    keyVersion: 'integration-v1',
  });
  const chatBodyCipher = createConversationRetainedBodyCipher({
    key: Buffer.alloc(32, 12),
    keyVersion: 'chat-integration-v1',
  });
  const retainedVaultKeyring = createStaticRetentionVaultKeyring({
    CHAT_BODY: chatBodyCipher,
    NICKNAME_AUDIT: createRetentionVaultCipher({
      key: Buffer.alloc(32, 13),
      keyVersion: 'nickname-integration-v1',
    }),
    ACADEMIC_IDENTITY_AUDIT: createRetentionVaultCipher({
      key: Buffer.alloc(32, 16),
      keyVersion: 'academic-integration-v1',
    }),
    SEASON_PROFILE_HISTORY: createRetentionVaultCipher({
      key: Buffer.alloc(32, 14),
      keyVersion: 'profile-history-integration-v1',
    }),
    MATCH_HISTORY: createRetentionVaultCipher({
      key: Buffer.alloc(32, 15),
      keyVersion: 'match-history-integration-v1',
    }),
  });

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('retention_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
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
    await seedBaseSeasonFixtures(prisma);
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
  });

  it('일반 탈퇴 retained identity는 identifier anchor만 만들고 profile history는 자동 생성하지 않는다', async () => {
    const owner = createRetainedIdentityOwner(prisma, { identifierCipher });
    const deletedAt = new Date('2026-05-12T00:00:00.000Z');
    const historyCountBeforeRetention = await prisma.seasonParticipantProfileHistory.count({
      where: { participantId: 'participant-a' },
    });

    const retainedIdentity = await owner.createRetainedIdentitySnapshot({
      userId: 'user-a',
      deletedAt,
      metadata: {
        schemaVersion: 1,
        request: {
          requestedBy: 'USER',
          note: '일반 탈퇴 테스트',
        },
      },
    });

    expect(retainedIdentity.displayLabel).toBe('탈퇴한 사용자');
    expect(retainedIdentity.originalUserId).toBe('user-a');
    expect(retainedIdentity.retentionCaseReason).toBe('ACCOUNT_DELETION');
    expect(retainedIdentity.emailHash).toHaveLength(64);
    await expect(
      prisma.retainedIdentityHold.findFirst({
        where: { retainedIdentityId: retainedIdentity.id, holdReason: 'ACCOUNT_DELETION' },
        include: { retentionCase: true },
      }),
    ).resolves.toMatchObject({
      holdUntil: new Date('2026-05-17T00:00:00.000Z'),
      retentionCase: { reason: 'ACCOUNT_DELETION' },
    });
    expect(retainedIdentity.identifierKeyVersion).toBe('integration-v1');
    expect(retainedIdentity.encryptedIdentifierPayload).toMatchObject({
      schemaVersion: 1,
      algorithm: 'aes-256-gcm',
      keyVersion: 'integration-v1',
    });

    await expect(
      prisma.seasonParticipantProfileHistory.count({
        where: { participantId: 'participant-a' },
      }),
    ).resolves.toBe(historyCountBeforeRetention);
  });

  it('ArchiveJob due claim은 bounded batch와 lease로 중복 claim을 막는다', async () => {
    const now = new Date('2029-05-12T00:00:00.000Z');
    const leaseUntil = new Date('2029-05-12T00:01:00.000Z');

    await prisma.archiveJob.createMany({
      data: [
        {
          id: 'archive-claim-1',
          target: 'NICKNAME_AUDIT',
          status: 'PENDING',
          nextRunAt: new Date('2029-05-11T00:00:00.000Z'),
        },
        {
          id: 'archive-claim-2',
          target: 'ACADEMIC_IDENTITY_AUDIT',
          status: 'PENDING',
          nextRunAt: new Date('2029-05-11T00:00:01.000Z'),
        },
      ],
    });

    const [firstClaim, secondClaim] = await Promise.all([
      claimDueDeletionArchiveJobs(prisma, now, { batchSize: 1, claimLeaseMs: 60_000 }),
      claimDueDeletionArchiveJobs(prisma, now, { batchSize: 1, claimLeaseMs: 60_000 }),
    ]);

    const claimedIds = [...firstClaim, ...secondClaim].map((job) => job.id).sort();
    expect(claimedIds).toEqual(['archive-claim-1', 'archive-claim-2']);
    expect(new Set(claimedIds).size).toBe(2);

    const claimedJobs = await prisma.archiveJob.findMany({
      where: { id: { in: claimedIds } },
      select: { id: true, status: true, nextRunAt: true, lastAttemptAt: true },
      orderBy: { id: 'asc' },
    });
    expect(claimedJobs).toEqual([
      {
        id: 'archive-claim-1',
        status: 'RETRY_SCHEDULED',
        nextRunAt: leaseUntil,
        lastAttemptAt: now,
      },
      {
        id: 'archive-claim-2',
        status: 'RETRY_SCHEDULED',
        nextRunAt: leaseUntil,
        lastAttemptAt: now,
      },
    ]);
  });

  it('RetentionReviewJob due claim은 bounded batch와 lease로 중복 claim을 막는다', async () => {
    const now = new Date('2029-05-12T00:00:00.000Z');
    const leaseUntil = new Date('2029-05-12T00:01:00.000Z');

    await prisma.retentionReviewJob.createMany({
      data: [
        {
          id: 'review-claim-1',
          target: 'ACCESS_LOG_DISPOSAL',
          sourceId: 'access-log-disposal-claim-1',
          status: 'PENDING',
          dueAt: new Date('2029-05-11T00:00:00.000Z'),
        },
        {
          id: 'review-claim-2',
          target: 'CHAT_IDENTITY_LINK',
          sourceId: 'thread-claim-2',
          status: 'PENDING',
          dueAt: new Date('2029-05-11T00:00:01.000Z'),
        },
      ],
    });

    const [firstClaim, secondClaim] = await Promise.all([
      claimDueRetentionReviewJobs(prisma, now, { batchSize: 1, claimLeaseMs: 60_000 }),
      claimDueRetentionReviewJobs(prisma, now, { batchSize: 1, claimLeaseMs: 60_000 }),
    ]);

    const claimedIds = [...firstClaim, ...secondClaim].map((job) => job.id).sort();
    expect(claimedIds).toEqual(['review-claim-1', 'review-claim-2']);
    expect(new Set(claimedIds).size).toBe(2);

    const claimedJobs = await prisma.retentionReviewJob.findMany({
      where: { id: { in: claimedIds } },
      select: { id: true, status: true, dueAt: true, lastAttemptAt: true },
      orderBy: { id: 'asc' },
    });
    expect(claimedJobs).toEqual([
      {
        id: 'review-claim-1',
        status: 'RETRY_SCHEDULED',
        dueAt: leaseUntil,
        lastAttemptAt: now,
      },
      {
        id: 'review-claim-2',
        status: 'RETRY_SCHEDULED',
        dueAt: leaseUntil,
        lastAttemptAt: now,
      },
    ]);
  });

  it('legal hold가 있으면 일반 삭제 대신 LEGAL_HOLD retained identity로 분류한다', async () => {
    const owner = createRetainedIdentityOwner(prisma, { identifierCipher });

    const retainedIdentity = await owner.createRetainedIdentitySnapshot({
      userId: 'user-a',
      deletedAt: new Date('2026-05-12T00:00:00.000Z'),
      legalHoldReason: 'LAW_ENFORCEMENT_REQUEST',
      metadata: {
        schemaVersion: 1,
        request: {
          requestedBy: 'ADMIN',
          note: '수사기관 보존',
        },
      },
    });

    expect(retainedIdentity.retentionCaseReason).toBe('LEGAL_HOLD');
    expect(retainedIdentity.legalHoldReason).toBe('LAW_ENFORCEMENT_REQUEST');
    await expect(
      prisma.retainedIdentityHold.findFirst({
        where: { retainedIdentityId: retainedIdentity.id, holdReason: 'LEGAL_HOLD' },
        include: { retentionCase: true },
      }),
    ).resolves.toMatchObject({
      holdUntil: null,
      retentionCase: { legalHoldReason: 'LAW_ENFORCEMENT_REQUEST' },
    });
  });

  it('5일 anchor 폐기 전 신고 신호가 생기면 REPORT_REVIEW 보존으로 승격한다', async () => {
    const owner = createRetainedIdentityOwner(prisma, { identifierCipher });
    const deletedAt = new Date('2026-05-12T00:00:00.000Z');

    const initial = await owner.createRetainedIdentitySnapshot({
      userId: 'user-a',
      deletedAt,
      metadata: {
        schemaVersion: 1,
        request: {
          requestedBy: 'USER',
          note: '정상 탈퇴',
        },
      },
    });
    expect(initial.retentionCaseReason).toBe('ACCOUNT_DELETION');
    await expect(
      prisma.retainedIdentityHold.findFirst({
        where: { retainedIdentityId: initial.id, holdReason: 'ACCOUNT_DELETION' },
      }),
    ).resolves.toMatchObject({ holdUntil: new Date('2026-05-17T00:00:00.000Z') });

    const upgraded = await owner.createRetainedIdentitySnapshot({
      userId: 'user-a',
      deletedAt,
      reportOpen: true,
      metadata: {
        schemaVersion: 1,
        request: {
          requestedBy: 'SYSTEM',
          note: '5일 anchor 폐기 전 신고 접수',
        },
      },
    });

    expect(upgraded.id).toBe(initial.id);
    expect(upgraded.retentionCaseReason).toBe('REPORT_REVIEW');
    await expect(
      prisma.retainedIdentityHold.findFirst({
        where: { retainedIdentityId: upgraded.id, holdReason: 'REPORT_REVIEW' },
      }),
    ).resolves.toMatchObject({ holdUntil: new Date('2029-05-11T00:00:00.000Z') });
    expect(upgraded.retentionDisposedAt).toBeNull();
  });

  it('retained identity 식별 복원은 승인 근거와 접근 로그를 요구한다', async () => {
    const owner = createRetainedIdentityOwner(prisma, { identifierCipher });
    const retainedIdentity = await owner.createRetainedIdentitySnapshot({
      userId: 'user-a',
      deletedAt: new Date('2026-05-12T00:00:00.000Z'),
      reportOpen: true,
      metadata: {
        schemaVersion: 1,
        request: {
          requestedBy: 'ADMIN',
          note: '신고 검토 테스트',
        },
      },
    });

    await expect(
      owner.discloseRetainedIdentityIdentifiers({
        retainedIdentityId: retainedIdentity.id,
        accessedBy: 'ops-1',
        accessReason: 'REPORT_REVIEW',
        approvalReference: '',
        purpose: '신고 검토',
      }),
    ).rejects.toThrow('approvalReference is required');

    const disclosure = await owner.discloseRetainedIdentityIdentifiers({
      retainedIdentityId: retainedIdentity.id,
      accessedBy: 'ops-1',
      accessReason: 'REPORT_REVIEW',
      approvalReference: 'report-123',
      purpose: '신고 검토',
      now: new Date('2026-05-13T00:00:00.000Z'),
    });

    expect(disclosure).toMatchObject({
      retainedIdentityId: retainedIdentity.id,
      originalUserId: 'user-a',
      email: 'user-a@kangwon.ac.kr',
      emailNormalized: 'user-a@kangwon.ac.kr',
      keyVersion: 'integration-v1',
    });

    const logs = await prisma.retentionAccessLog.findMany({
      where: { retainedIdentityId: retainedIdentity.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      accessedBy: 'ops-1',
      accessReason: 'REPORT_REVIEW',
      approvalReference: 'report-123',
      result: 'DISCLOSED',
    });
    expect(logs[0]?.logRetentionHoldUntil?.toISOString()).toBe('2029-05-12T00:00:00.000Z');
  });

  it('보존 기간이 만료된 retained identity는 식별 복원 anchor를 폐기하고 로그를 남긴다', async () => {
    const owner = createRetainedIdentityOwner(prisma, { identifierCipher });
    const retainedIdentity = await owner.createRetainedIdentitySnapshot({
      userId: 'user-a',
      deletedAt: new Date('2026-05-12T00:00:00.000Z'),
      metadata: {
        schemaVersion: 1,
        request: {
          requestedBy: 'USER',
          note: '만료 처리 테스트',
        },
      },
    });
    await prisma.user.update({
      where: { id: 'user-a' },
      data: {
        email: 'deleted+user-a@deleted.local',
        emailNormalized: 'deleted+user-a@deleted.local',
        passwordHash: 'deleted:user-a',
        deletedAt: new Date('2026-05-12T00:00:00.000Z'),
      },
    });

    const result = await owner.disposeExpiredRetainedIdentities(
      new Date('2026-05-18T00:00:00.000Z'),
    );

    expect(result.processedCount).toBe(1);
    const disposedIdentity = await prisma.retainedIdentity.findUniqueOrThrow({
      where: { id: retainedIdentity.id },
    });
    expect(disposedIdentity).toMatchObject({
      originalUserId: null,
      emailHash: null,
      identifierKeyVersion: null,
      retentionDisposalReason: 'RETENTION_HOLD_EXPIRED',
    });
    expect(disposedIdentity.encryptedIdentifierPayload).toBeNull();
    expect(disposedIdentity.retentionDisposedAt?.toISOString()).toBe('2026-05-18T00:00:00.000Z');

    await expect(
      owner.discloseRetainedIdentityIdentifiers({
        retainedIdentityId: retainedIdentity.id,
        accessedBy: 'ops-1',
        accessReason: 'REPORT_REVIEW',
        approvalReference: 'report-123',
        purpose: '만료 후 조회 시도',
      }),
    ).rejects.toThrow('identifiers disposed');

    await expect(
      owner.createRetainedIdentitySnapshot({
        userId: 'user-a',
        deletedAt: new Date('2026-05-12T00:00:00.000Z'),
        reportOpen: true,
        metadata: {
          schemaVersion: 1,
          request: {
            requestedBy: 'SYSTEM',
            note: 'anchor 폐기 후 늦은 신고',
          },
        },
      }),
    ).rejects.toThrow('anchor disposed');
  });

  it('보존 기간이 만료된 RRPD vault payload는 ciphertext와 digest를 함께 폐기하고 로그를 남긴다', async () => {
    const owner = createRetainedIdentityOwner(prisma, { identifierCipher });
    const deletedAt = new Date('2026-05-12T00:00:00.000Z');
    const retainedIdentity = await owner.createRetainedIdentitySnapshot({
      userId: 'user-a',
      deletedAt,
      metadata: {
        schemaVersion: 1,
        request: {
          requestedBy: 'USER',
          note: 'vault payload 만료 처리 테스트',
        },
      },
    });

    const retainedVaultObject = await prisma.runSerializableTransaction(async (tx) => {
      const retentionCase = await ensureRetentionCaseTx(tx, {
        reason: 'ACCOUNT_DELETION',
        triggerUserId: 'user-a',
        triggerRetainedIdentityId: retainedIdentity.id,
        sourceTable: 'UserDisplayIdentityNicknameChangeEvent',
        sourceId: 'nickname-disposal-test',
        retentionHoldUntil: new Date('2026-05-17T00:00:00.000Z'),
        metadata: { test: 'vault payload disposal' },
      });

      return retainVaultPayloadTx(
        tx,
        {
          target: 'NICKNAME_AUDIT_EVENT',
          sourceTable: 'UserDisplayIdentityNicknameChangeEvent',
          sourceId: 'nickname-disposal-test',
          subjectUserId: 'user-a',
          subjectRetainedIdentityId: retainedIdentity.id,
          subjectRole: 'USER',
          keyPurpose: 'NICKNAME_AUDIT',
          payloadSchemaVersion: 1,
          plaintext: {
            schemaVersion: 1,
            previousNickname: '유저A',
            nextNickname: '유저A-변경',
          },
          aad: 'knu-roommate:test:nickname-disposal-test',
          retainedAt: deletedAt,
          retentionCaseId: retentionCase.id,
          holdReason: 'ACCOUNT_DELETION',
          holdUntil: new Date('2026-05-17T00:00:00.000Z'),
        },
        { keyring: retainedVaultKeyring },
      );
    });

    const retainedBefore = await prisma.retainedVaultObject.findUniqueOrThrow({
      where: { id: retainedVaultObject.id },
    });
    expect(retainedBefore).toMatchObject({
      target: 'NICKNAME_AUDIT_EVENT',
      state: 'RETAINED',
      keyVersion: 'nickname-integration-v1',
    });
    expect(retainedBefore.encryptedPayload).not.toBeNull();
    expect(retainedBefore.payloadDigest).toHaveLength(64);

    const result = await owner.disposeExpiredRetainedIdentities(
      new Date('2026-05-18T00:00:00.000Z'),
    );

    expect(result.processedCount).toBe(2);
    const disposedVault = await prisma.retainedVaultObject.findUniqueOrThrow({
      where: { id: retainedVaultObject.id },
    });
    expect(disposedVault).toMatchObject({
      state: 'DISPOSED',
      encryptedPayload: null,
      payloadDigest: null,
      keyVersion: null,
      disposalReason: 'RETENTION_HOLD_EXPIRED',
    });
    expect(disposedVault.disposedAt?.toISOString()).toBe('2026-05-18T00:00:00.000Z');

    const accessLogs = await prisma.retentionAccessLog.findMany({
      where: { retainedVaultObjectId: retainedVaultObject.id },
    });
    expect(accessLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetType: 'VAULT_OBJECT',
          vaultTarget: 'NICKNAME_AUDIT_EVENT',
          accessedBy: 'SYSTEM',
          accessReason: 'RETENTION_EXPIRY_REVIEW',
          result: 'DISPOSED',
        }),
      ]),
    );
  });

  it('계정 삭제 archive job 생성은 target별 ArchiveJob row를 만들고, 미archive thread의 THREAD_RETENTION은 대기 상태로 남긴다.', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
    });

    const deletedAt = new Date('2026-05-12T00:00:00.000Z');
    const owner = createRetainedIdentityOwner(prisma, { identifierCipher });
    const retainedIdentity = await owner.createRetainedIdentitySnapshot({
      userId: 'user-a',
      deletedAt,
      metadata: {
        schemaVersion: 1,
        request: {
          requestedBy: 'SYSTEM',
          note: 'archive job 생성 테스트',
        },
      },
    });

    await prisma.seasonMatchHistoryEntry.create({
      data: {
        id: 'history-a-b',
        seasonId: 'season-integration',
        viewerParticipantId: 'participant-a',
        counterpartParticipantId: 'participant-b',
        pairKey: 'participant-a:participant-b',
        entryType: 'MATCH',
        entryResult: 'MATCHED_SUCCESS',
        viewerRequested: true,
        counterpartNicknameSnapshot: '유저B',
        matchedAt: new Date('2026-05-01T00:00:00.000Z'),
        finalizedAt: new Date('2026-05-02T00:00:00.000Z'),
      },
    });

    await prisma.conversationThread.create({
      data: {
        id: 'thread-a-b',
        seasonId: 'season-integration',
        pairKey: 'participant-a:participant-b',
        participantAId: 'participant-a',
        participantBId: 'participant-b',
        openedByParticipantId: 'participant-a',
        threadKind: 'DIRECT',
        status: 'OPEN',
        messages: {
          create: {
            id: 'message-a-b',
            senderParticipantId: 'participant-a',
            body: '수동 검토가 필요한 대화 본문',
            sentAt: new Date('2026-05-01T01:00:00.000Z'),
          },
        },
      },
    });

    const result = await prisma.runSerializableTransaction((tx) =>
      createDeletionArchiveJobsTx(tx, {
        retainedIdentityId: retainedIdentity.id,
        userId: 'user-a',
        deletedAt,
      }),
    );

    expect(result.createdCount).toBe(5);

    const jobs = await prisma.archiveJob.findMany({
      where: { retainedIdentityId: retainedIdentity.id },
      orderBy: { target: 'asc' },
    });
    expect(jobs.map((job) => job.target)).toEqual(
      expect.arrayContaining([
        'ACADEMIC_IDENTITY_AUDIT',
        'MATCH_HISTORY',
        'NICKNAME_AUDIT',
        'SEASON_PROFILE_HISTORY',
        'THREAD_RETENTION',
      ]),
    );

    const jobByTarget = new Map(jobs.map((job) => [job.target, job]));
    expect(jobByTarget.get('SEASON_PROFILE_HISTORY')).toMatchObject({
      userId: 'user-a',
      participantId: 'participant-a',
      seasonId: 'season-integration',
    });
    expect(jobByTarget.get('MATCH_HISTORY')).toMatchObject({
      userId: 'user-a',
      matchHistoryEntryId: 'history-a-b',
      seasonId: 'season-integration',
    });
    expect(jobByTarget.get('THREAD_RETENTION')).toMatchObject({
      userId: 'user-a',
      threadId: 'thread-a-b',
      status: 'WAITING_CONDITION',
      manualReviewRequired: false,
      lastErrorCode: null,
    });
    expect(jobByTarget.get('NICKNAME_AUDIT')).toMatchObject({
      userId: 'user-a',
      retainedIdentityId: retainedIdentity.id,
      status: 'PENDING',
    });
    expect(jobByTarget.get('ACADEMIC_IDENTITY_AUDIT')).toMatchObject({
      userId: 'user-a',
      retainedIdentityId: retainedIdentity.id,
      status: 'PENDING',
    });
    expect(jobByTarget.get('THREAD_RETENTION')?.payload).toEqual(
      expect.objectContaining({
        source: 'ACCOUNT_DELETE',
        target: 'THREAD_RETENTION',
        retentionMode: 'CHAT_THREAD_ARCHIVE',
        identityReviewAfter: '2028-05-11T00:00:00.000Z',
        waitingFor: 'THREAD_ARCHIVED',
      }),
    );
  });

  it('archive sweep은 nickname/profile/match history 원문을 RRPD vault로 옮기고 hot row를 최소화한다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
    });

    const deletedAt = new Date('2026-05-12T00:00:00.000Z');
    const archiveNow = new Date('2026-05-13T00:00:00.000Z');
    const owner = createRetainedIdentityOwner(prisma, { identifierCipher });
    const retainedIdentity = await owner.createRetainedIdentitySnapshot({
      userId: 'user-a',
      deletedAt,
      metadata: {
        schemaVersion: 1,
        request: {
          requestedBy: 'SYSTEM',
          note: 'profile/match/nickname archive 처리 테스트',
        },
      },
    });

    await prisma.userDisplayIdentityNicknameChangeEvent.create({
      data: {
        id: 'nickname-event-a',
        userId: 'user-a',
        source: 'USER_SELF',
        reason: 'USER_REQUEST',
        actorType: 'USER',
        actorId: 'user-a',
        previousNickname: '이전A',
        previousNicknameNormalized: '이전a',
        nextNickname: '유저A',
        nextNicknameNormalized: '유저a',
        changedAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    });
    await prisma.userAcademicIdentityChangeEvent.create({
      data: {
        id: 'academic-event-a',
        userId: 'user-a',
        source: 'USER_SELF',
        reason: 'ACADEMIC_CYCLE_ALLOWANCE',
        actorType: 'USER',
        actorId: 'user-a',
        previousCollegeCode: 'ARTS_ENGINEERING',
        nextCollegeCode: 'NURSING',
        previousBirthYear: 2002,
        nextBirthYear: 2002,
        changedAt: new Date('2026-05-01T00:10:00.000Z'),
      },
    });

    await prisma.seasonMatchHistoryEntry.createMany({
      data: [
        {
          id: 'history-a-viewer',
          seasonId: 'season-integration',
          viewerParticipantId: 'participant-a',
          counterpartParticipantId: 'participant-b',
          pairKey: 'participant-a:participant-b',
          entryType: 'MATCH',
          entryResult: 'MATCHED_SUCCESS',
          viewerRequested: true,
          matchScore: 87,
          viewerSmokingToleranceSnapshot: 'NO_ONLY',
          viewerBedtimeSnapshot: 'BETWEEN_22_24',
          viewerWakeTimeSnapshot: 'BETWEEN_07_08',
          viewerRelationshipStyleSnapshot: 'CLOSE',
          counterpartBedtimeSnapshot: 'BETWEEN_22_24',
          counterpartCleanLevelSnapshot: 'WEEKLY_3_UP',
          counterpartNicknameSnapshot: '유저B',
          matchedAt: new Date('2026-05-01T00:00:00.000Z'),
          finalizedAt: new Date('2026-05-02T00:00:00.000Z'),
        },
        {
          id: 'history-a-counterpart',
          seasonId: 'season-integration',
          viewerParticipantId: 'participant-b',
          counterpartParticipantId: 'participant-a',
          pairKey: 'participant-a:participant-b',
          entryType: 'MATCH',
          entryResult: 'MATCHED_SUCCESS',
          viewerRequested: false,
          matchScore: 91,
          viewerSmokingToleranceSnapshot: 'ANY',
          viewerBedtimeSnapshot: 'AFTER_02',
          viewerWakeTimeSnapshot: 'AFTER_10',
          viewerRelationshipStyleSnapshot: 'CASUAL',
          counterpartBedtimeSnapshot: 'BETWEEN_22_24',
          counterpartWakeTimeSnapshot: 'BETWEEN_07_08',
          counterpartSleepHabitSnapshot: 'NONE',
          counterpartCleanLevelSnapshot: 'WEEKLY_3_UP',
          counterpartNicknameSnapshot: '유저A',
          matchedAt: new Date('2026-05-01T00:00:00.000Z'),
          finalizedAt: new Date('2026-05-02T00:00:00.000Z'),
        },
      ],
    });

    await prisma.runSerializableTransaction((tx) =>
      createDeletionArchiveJobsTx(tx, {
        retainedIdentityId: retainedIdentity.id,
        userId: 'user-a',
        deletedAt,
      }),
    );

    const sweep = await retryDueArchiveJobs(prisma, archiveNow, undefined, {
      keyring: retainedVaultKeyring,
    });
    expect(sweep.manualReviewCount).toBe(0);
    expect(sweep.succeededCount).toBe(5);

    const nicknameEvent = await prisma.userDisplayIdentityNicknameChangeEvent.findUniqueOrThrow({
      where: { id: 'nickname-event-a' },
    });
    expect(nicknameEvent).toMatchObject({
      retainedIdentityId: retainedIdentity.id,
      previousNickname: '탈퇴한 사용자',
      nextNickname: '탈퇴한 사용자',
      actorId: null,
      redactionReason: 'ACCOUNT_DELETION',
    });
    expect(nicknameEvent.redactedAt?.toISOString()).toBe(archiveNow.toISOString());
    expect(nicknameEvent.retainedVaultObjectId).not.toBeNull();

    const academicEvent = await prisma.userAcademicIdentityChangeEvent.findUniqueOrThrow({
      where: { id: 'academic-event-a' },
    });
    expect(academicEvent).toMatchObject({
      retainedIdentityId: retainedIdentity.id,
      previousCollegeCode: 'REDACTED',
      nextCollegeCode: 'REDACTED',
      previousBirthYear: 0,
      nextBirthYear: 0,
      actorId: null,
      redactionReason: 'ACCOUNT_DELETION',
    });
    expect(academicEvent.redactedAt?.toISOString()).toBe(archiveNow.toISOString());
    expect(academicEvent.retainedVaultObjectId).not.toBeNull();

    const profileHistory = await prisma.seasonParticipantProfileHistory.findFirstOrThrow({
      where: { participantId: 'participant-a' },
    });
    expect(profileHistory).toMatchObject({
      retainedIdentityId: retainedIdentity.id,
      nicknameSnapshot: '탈퇴한 사용자',
      bedtime: null,
      drinkingTolerance: null,
      intro: '',
      redactionReason: 'ACCOUNT_DELETION',
    });
    expect(profileHistory.redactedAt?.toISOString()).toBe(archiveNow.toISOString());
    expect(profileHistory.retainedVaultObjectId).not.toBeNull();

    const viewerEntry = await prisma.seasonMatchHistoryEntry.findUniqueOrThrow({
      where: { id: 'history-a-viewer' },
    });
    expect(viewerEntry).toMatchObject({
      viewerSmokingToleranceSnapshot: null,
      viewerBedtimeSnapshot: null,
      viewerWakeTimeSnapshot: null,
      counterpartNicknameSnapshot: '유저B',
      counterpartRedactedAt: null,
      matchScore: null,
    });
    expect(viewerEntry.viewerRedactedAt?.toISOString()).toBe(archiveNow.toISOString());

    const counterpartEntry = await prisma.seasonMatchHistoryEntry.findUniqueOrThrow({
      where: { id: 'history-a-counterpart' },
    });
    expect(counterpartEntry).toMatchObject({
      counterpartBedtimeSnapshot: null,
      counterpartWakeTimeSnapshot: null,
      counterpartSleepHabitSnapshot: null,
      counterpartNicknameSnapshot: '탈퇴한 사용자',
      viewerRedactedAt: null,
      matchScore: null,
    });
    expect(counterpartEntry.counterpartRedactedAt?.toISOString()).toBe(archiveNow.toISOString());

    const vaultObjects = await prisma.retainedVaultObject.findMany({
      where: {
        subjectRetainedIdentityId: retainedIdentity.id,
        target: { in: ['NICKNAME_AUDIT_EVENT', 'SEASON_PROFILE_HISTORY', 'MATCH_HISTORY_ENTRY'] },
      },
      orderBy: [{ target: 'asc' }, { subjectRole: 'asc' }, { sourceId: 'asc' }],
      include: { holds: true },
    });
    expect(vaultObjects).toHaveLength(4);
    expect(vaultObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: 'NICKNAME_AUDIT_EVENT',
          sourceId: 'nickname-event-a',
          subjectRole: 'USER',
          keyPurpose: 'NICKNAME_AUDIT',
          keyVersion: 'nickname-integration-v1',
        }),
        expect.objectContaining({
          target: 'SEASON_PROFILE_HISTORY',
          sourceId: profileHistory.id,
          subjectRole: 'PARTICIPANT',
          keyPurpose: 'SEASON_PROFILE_HISTORY',
          keyVersion: 'profile-history-integration-v1',
        }),
        expect.objectContaining({
          target: 'MATCH_HISTORY_ENTRY',
          sourceId: 'history-a-viewer',
          subjectRole: 'VIEWER',
          keyPurpose: 'MATCH_HISTORY',
          keyVersion: 'match-history-integration-v1',
        }),
        expect.objectContaining({
          target: 'MATCH_HISTORY_ENTRY',
          sourceId: 'history-a-counterpart',
          subjectRole: 'COUNTERPART',
          keyPurpose: 'MATCH_HISTORY',
          keyVersion: 'match-history-integration-v1',
        }),
      ]),
    );
    expect(vaultObjects.every((object) => object.encryptedPayload !== null)).toBe(true);
    expect(vaultObjects.every((object) => object.payloadDigest?.length === 64)).toBe(true);
    expect(vaultObjects.every((object) => object.holds[0]?.holdReason === 'ACCOUNT_DELETION')).toBe(
      true,
    );

    const academicVaultObjects = await prisma.retainedVaultObject.findMany({
      where: {
        subjectRetainedIdentityId: retainedIdentity.id,
        target: 'ACADEMIC_IDENTITY_AUDIT_EVENT',
      },
      include: { holds: true },
    });
    expect(academicVaultObjects).toEqual([
      expect.objectContaining({
        target: 'ACADEMIC_IDENTITY_AUDIT_EVENT',
        sourceId: 'academic-event-a',
        subjectRole: 'USER',
        keyPurpose: 'ACADEMIC_IDENTITY_AUDIT',
        keyVersion: 'academic-integration-v1',
      }),
    ]);
    expect(academicVaultObjects[0]?.encryptedPayload).not.toBeNull();
    expect(academicVaultObjects[0]?.payloadDigest).toHaveLength(64);
    expect(academicVaultObjects[0]?.holds[0]?.holdReason).toBe('ACCOUNT_DELETION');

    const matchLinks = await prisma.seasonMatchHistoryEntryRetentionLink.findMany({
      where: { retainedIdentityId: retainedIdentity.id },
      orderBy: [{ subjectRole: 'asc' }],
    });
    expect(matchLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchHistoryEntryId: 'history-a-viewer',
          participantId: 'participant-a',
          subjectRole: 'VIEWER',
          redactionReason: 'ACCOUNT_DELETION',
        }),
        expect.objectContaining({
          matchHistoryEntryId: 'history-a-counterpart',
          participantId: 'participant-a',
          subjectRole: 'COUNTERPART',
          redactionReason: 'ACCOUNT_DELETION',
        }),
      ]),
    );

    const retainedIdentityB = await owner.createRetainedIdentitySnapshot({
      userId: 'user-b',
      deletedAt,
      metadata: {
        schemaVersion: 1,
        request: {
          requestedBy: 'SYSTEM',
          note: 'sequential counterpart deletion 처리 테스트',
        },
      },
    });
    await prisma.$executeRaw`
      INSERT INTO "ChatRealtimeOutboxEvent" (
        "id", "eventType", "schemaVersion", "threadId", "aggregateType", "aggregateId",
        "aggregateVersion", "payload", "roomKeys", "occurredAt", "availableAt",
        "publishAttempts", "createdAt", "updatedAt"
      )
      VALUES
        (
          ${'stale-message-created-1'}, ${'chat.message.created'}, ${1}, ${'thread-a-b-retention'},
          ${'conversation.message'}, ${'message-retention-1'}, ${1},
          ${JSON.stringify({ message: { id: 'message-retention-1', body: '원문 메시지 1' } })}::jsonb,
          ARRAY[${'user:user-a'}, ${'user:user-b'}],
          ${new Date('2026-05-01T01:00:00.000Z')}, ${new Date('2026-05-01T01:00:00.000Z')},
          ${0}, ${new Date('2026-05-01T01:00:00.000Z')}, ${new Date('2026-05-01T01:00:00.000Z')}
        ),
        (
          ${'stale-message-created-2'}, ${'chat.message.created'}, ${1}, ${'thread-a-b-retention'},
          ${'conversation.message'}, ${'message-retention-2'}, ${1},
          ${JSON.stringify({ message: { id: 'message-retention-2', body: '원문 메시지 2' } })}::jsonb,
          ARRAY[${'user:user-a'}, ${'user:user-b'}],
          ${new Date('2026-05-01T01:01:00.000Z')}, ${new Date('2026-05-01T01:01:00.000Z')},
          ${0}, ${new Date('2026-05-01T01:01:00.000Z')}, ${new Date('2026-05-01T01:01:00.000Z')}
        )
    `;

    await prisma.runSerializableTransaction((tx) =>
      createDeletionArchiveJobsTx(tx, {
        retainedIdentityId: retainedIdentityB.id,
        userId: 'user-b',
        deletedAt,
      }),
    );

    const counterpartSweep = await retryDueArchiveJobs(prisma, archiveNow, undefined, {
      keyring: retainedVaultKeyring,
    });
    expect(counterpartSweep.manualReviewCount).toBe(0);
    expect(counterpartSweep.succeededCount).toBe(5);

    const allMatchLinks = await prisma.seasonMatchHistoryEntryRetentionLink.findMany({
      orderBy: [{ matchHistoryEntryId: 'asc' }, { subjectRole: 'asc' }],
    });
    expect(allMatchLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchHistoryEntryId: 'history-a-viewer',
          retainedIdentityId: retainedIdentity.id,
          participantId: 'participant-a',
          subjectRole: 'VIEWER',
        }),
        expect.objectContaining({
          matchHistoryEntryId: 'history-a-viewer',
          retainedIdentityId: retainedIdentityB.id,
          participantId: 'participant-b',
          subjectRole: 'COUNTERPART',
        }),
        expect.objectContaining({
          matchHistoryEntryId: 'history-a-counterpart',
          retainedIdentityId: retainedIdentity.id,
          participantId: 'participant-a',
          subjectRole: 'COUNTERPART',
        }),
        expect.objectContaining({
          matchHistoryEntryId: 'history-a-counterpart',
          retainedIdentityId: retainedIdentityB.id,
          participantId: 'participant-b',
          subjectRole: 'VIEWER',
        }),
      ]),
    );
    expect(allMatchLinks).toHaveLength(4);

    const matchVaultObjects = await prisma.retainedVaultObject.findMany({
      where: { target: 'MATCH_HISTORY_ENTRY' },
      orderBy: [{ sourceId: 'asc' }, { subjectRole: 'asc' }],
    });
    expect(matchVaultObjects).toHaveLength(4);
    expect(matchVaultObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: 'history-a-viewer',
          subjectRetainedIdentityId: retainedIdentity.id,
          subjectRole: 'VIEWER',
        }),
        expect.objectContaining({
          sourceId: 'history-a-viewer',
          subjectRetainedIdentityId: retainedIdentityB.id,
          subjectRole: 'COUNTERPART',
        }),
        expect.objectContaining({
          sourceId: 'history-a-counterpart',
          subjectRetainedIdentityId: retainedIdentity.id,
          subjectRole: 'COUNTERPART',
        }),
        expect.objectContaining({
          sourceId: 'history-a-counterpart',
          subjectRetainedIdentityId: retainedIdentityB.id,
          subjectRole: 'VIEWER',
        }),
      ]),
    );

    const viewerMatchVault = matchVaultObjects.find(
      (object) =>
        object.sourceId === 'history-a-viewer' &&
        object.subjectRetainedIdentityId === retainedIdentity.id &&
        object.subjectRole === 'VIEWER',
    );
    expect(viewerMatchVault).toBeDefined();
    if (!viewerMatchVault) {
      throw new Error('viewer match vault object not found');
    }

    const disclosure = await discloseRetainedVaultPayload(
      prisma,
      {
        retainedVaultObjectId: viewerMatchVault.id,
        accessedBy: 'retention-integration-test',
        accessReason: 'SECURITY_AUDIT',
        approvalReference: 'phase-10a-match-history-closure-guard',
        purpose: 'verify match history retained payload excludes chat closure fields',
        parsePlaintext: parseRetainedMatchHistoryPayload,
        now: archiveNow,
      },
      { keyring: retainedVaultKeyring },
    );
    expect(disclosure.payload.entry).not.toHaveProperty('threadClosedReason');
    expect(disclosure.payload.entry).not.toHaveProperty('threadClosedAt');
    expect(disclosure.payload.entry).not.toHaveProperty('hadConversation');
  });

  it('archived THREAD_RETENTION job은 메시지 본문을 retained body vault로 옮기고 tombstone 처리한다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
    });

    const deletedAt = new Date('2026-05-12T00:00:00.000Z');
    const owner = createRetainedIdentityOwner(prisma, { identifierCipher });
    const retainedIdentity = await owner.createRetainedIdentitySnapshot({
      userId: 'user-a',
      deletedAt,
      metadata: {
        schemaVersion: 1,
        request: {
          requestedBy: 'SYSTEM',
          note: 'thread retention 처리 테스트',
        },
      },
    });

    await prisma.conversationThread.create({
      data: {
        id: 'thread-a-b-retention',
        seasonId: 'season-integration',
        pairKey: 'participant-a:participant-b',
        participantAId: 'participant-a',
        participantBId: 'participant-b',
        openedByParticipantId: 'participant-a',
        threadKind: 'DIRECT',
        status: 'OPEN',
        messages: {
          create: [
            {
              id: 'message-retention-1',
              senderParticipantId: 'participant-a',
              body: '원문 메시지 1',
              sentAt: new Date('2026-05-01T01:00:00.000Z'),
            },
            {
              id: 'message-retention-2',
              senderParticipantId: 'participant-b',
              body: '원문 메시지 2',
              sentAt: new Date('2026-05-01T01:01:00.000Z'),
            },
          ],
        },
      },
    });

    await prisma.runSerializableTransaction((tx) =>
      createDeletionArchiveJobsTx(tx, {
        retainedIdentityId: retainedIdentity.id,
        userId: 'user-a',
        deletedAt,
      }),
    );

    const waitingJob = await prisma.archiveJob.findFirstOrThrow({
      where: {
        retainedIdentityId: retainedIdentity.id,
        target: 'THREAD_RETENTION',
        threadId: 'thread-a-b-retention',
      },
    });
    expect(waitingJob.status).toBe('WAITING_CONDITION');

    await prisma.conversationThread.update({
      where: { id: 'thread-a-b-retention' },
      data: {
        status: 'ARCHIVED',
        closedReason: 'SEASON_ENDED',
        closedAt: new Date('2026-05-20T00:00:00.000Z'),
      },
    });

    const activation = await activateThreadRetentionJobsForArchivedThreads(
      prisma,
      new Date('2026-05-20T00:00:00.000Z'),
    );
    expect(activation.activatedCount).toBeGreaterThanOrEqual(1);

    const sweep = await retryDueArchiveJobs(
      prisma,
      new Date('2026-05-20T00:00:00.000Z'),
      {
        bodyCipher: chatBodyCipher,
      },
      {
        keyring: retainedVaultKeyring,
      },
    );
    expect(sweep.succeededCount).toBeGreaterThanOrEqual(1);

    const succeededJob = await prisma.archiveJob.findUniqueOrThrow({
      where: { id: waitingJob.id },
    });
    expect(succeededJob).toMatchObject({
      status: 'SUCCEEDED',
      manualReviewRequired: false,
      lastErrorCode: null,
    });

    const messages = await prisma.conversationMessage.findMany({
      where: { threadId: 'thread-a-b-retention' },
      orderBy: { id: 'asc' },
    });
    expect(messages).toHaveLength(2);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'message-retention-1',
          body: '보존 처리된 메시지입니다.',
          bodyState: 'TOMBSTONED',
          tombstoneReason: 'ACCOUNT_DELETION_RETENTION',
          bodyVersion: 2,
        }),
        expect.objectContaining({
          id: 'message-retention-2',
          body: '보존 처리된 메시지입니다.',
          bodyState: 'TOMBSTONED',
          tombstoneReason: 'ACCOUNT_DELETION_RETENTION',
          bodyVersion: 2,
        }),
      ]),
    );

    const tombstoneOutboxEvents = await prisma.$queryRaw<
      Array<{ id: string; eventType: string; payload: unknown }>
    >`
      SELECT "id", "eventType", "payload"
      FROM "ChatRealtimeOutboxEvent"
      WHERE "threadId" = ${'thread-a-b-retention'}
        AND "eventType" = ${'chat.message.tombstoned'}
      ORDER BY "occurredAt" ASC, "id" ASC
    `;
    expect(tombstoneOutboxEvents).toHaveLength(2);
    for (const event of tombstoneOutboxEvents) {
      const payloadText = JSON.stringify(event.payload);
      expect(payloadText).toContain('보존 처리된 메시지입니다.');
      expect(payloadText).not.toContain('원문 메시지 1');
      expect(payloadText).not.toContain('원문 메시지 2');
    }

    const tombstoneOutboxRecipients = await prisma.$queryRaw<
      Array<{ eventId: string; userId: string }>
    >`
      SELECT r."eventId", r."userId"
      FROM "ChatRealtimeEventRecipient" r
      INNER JOIN "ChatRealtimeOutboxEvent" e ON e."id" = r."eventId"
      WHERE e."threadId" = ${'thread-a-b-retention'}
        AND e."eventType" = ${'chat.message.tombstoned'}
      ORDER BY r."eventId" ASC, r."userId" ASC
    `;
    expect(tombstoneOutboxRecipients.map((row) => row.userId)).toEqual(
      expect.arrayContaining(['user-a', 'user-b']),
    );

    const [staleMessageCreatedCount] = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM "ChatRealtimeOutboxEvent"
      WHERE "threadId" = ${'thread-a-b-retention'}
        AND "eventType" = ${'chat.message.created'}
        AND "aggregateId" IN (${'message-retention-1'}, ${'message-retention-2'})
    `;
    expect(staleMessageCreatedCount?.count).toBe(0);

    const retainedBodies = await prisma.retainedVaultObject.findMany({
      where: { target: 'CHAT_MESSAGE_BODY', sourceTable: 'ConversationMessage' },
      orderBy: { sourceId: 'asc' },
      include: { holds: true },
    });
    expect(retainedBodies).toHaveLength(2);
    expect(retainedBodies[0]).toMatchObject({
      archiveJobId: waitingJob.id,
      target: 'CHAT_MESSAGE_BODY',
      sourceId: 'message-retention-1',
      subjectUserId: 'user-a',
      subjectRetainedIdentityId: retainedIdentity.id,
      subjectRole: 'MESSAGE_SENDER',
      keyPurpose: 'CHAT_BODY',
      keyVersion: 'chat-integration-v1',
    });
    expect(retainedBodies[0]?.encryptedPayload).toMatchObject({
      schemaVersion: 1,
      algorithm: 'aes-256-gcm',
      keyVersion: 'chat-integration-v1',
    });
    expect(retainedBodies[0]?.payloadDigest).toHaveLength(64);
    expect(retainedBodies[0]?.holds[0]).toMatchObject({
      holdReason: 'CHAT_THREAD_ARCHIVE',
    });
    expect(retainedBodies[1]).toMatchObject({
      archiveJobId: waitingJob.id,
      target: 'CHAT_MESSAGE_BODY',
      sourceId: 'message-retention-2',
      subjectUserId: 'user-b',
      subjectRetainedIdentityId: null,
      subjectRole: 'MESSAGE_SENDER',
      keyPurpose: 'CHAT_BODY',
      keyVersion: 'chat-integration-v1',
    });
    expect(retainedBodies[1]?.encryptedPayload).toMatchObject({
      schemaVersion: 1,
      algorithm: 'aes-256-gcm',
      keyVersion: 'chat-integration-v1',
    });
    expect(retainedBodies[1]?.payloadDigest).toHaveLength(64);
    expect(retainedBodies[1]?.holds[0]).toMatchObject({
      holdReason: 'CHAT_THREAD_ARCHIVE',
      holdUntil: null,
    });

    const disposal = await owner.disposeExpiredRetainedIdentities(
      new Date('2026-05-18T00:00:00.000Z'),
    );
    expect(disposal.processedCount).toBeGreaterThanOrEqual(1);

    const disposedIdentity = await prisma.retainedIdentity.findUniqueOrThrow({
      where: { id: retainedIdentity.id },
    });
    expect(disposedIdentity.retentionDisposedAt?.toISOString()).toBe('2026-05-18T00:00:00.000Z');

    const bodiesAfterIdentityDisposal = await prisma.retainedVaultObject.findMany({
      where: { target: 'CHAT_MESSAGE_BODY', sourceTable: 'ConversationMessage' },
      orderBy: { sourceId: 'asc' },
    });
    expect(bodiesAfterIdentityDisposal).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: 'message-retention-1',
          subjectRetainedIdentityId: retainedIdentity.id,
          state: 'RETAINED',
          keyPurpose: 'CHAT_BODY',
        }),
        expect.objectContaining({
          sourceId: 'message-retention-2',
          subjectRetainedIdentityId: null,
          state: 'RETAINED',
          keyPurpose: 'CHAT_BODY',
        }),
      ]),
    );
    expect(bodiesAfterIdentityDisposal.every((body) => body.encryptedPayload !== null)).toBe(true);
    expect(bodiesAfterIdentityDisposal.every((body) => body.payloadDigest?.length === 64)).toBe(
      true,
    );
  });
});
