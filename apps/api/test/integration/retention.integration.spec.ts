import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import {
  activateThreadRetentionJobsForArchivedThreads,
  createDeletionArchiveJobsTx,
  retryDueArchiveJobs,
} from '../../src/retention/archive-job-owner.js';
import {
  createRetainedIdentityCipher,
  createRetainedIdentityOwner,
} from '../../src/retention/retained-identity-owner.js';
import { createConversationRetainedBodyCipher } from '../../src/retention/conversation-retained-body-owner.js';
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
    expect(retainedIdentity.retentionReason).toBe('ACCOUNT_DELETION');
    expect(retainedIdentity.emailHash).toHaveLength(64);
    expect(retainedIdentity.retentionHoldUntil?.toISOString()).toBe('2026-05-17T00:00:00.000Z');
    expect(retainedIdentity.identifierKeyVersion).toBe('integration-v1');
    expect(retainedIdentity.encryptedIdentifierPayload).toMatchObject({
      schemaVersion: 1,
      algorithm: 'aes-256-gcm',
      keyVersion: 'integration-v1',
    });

    await expect(
      prisma.seasonParticipantProfileHistory.count({
        where: { participantId: 'participant-a', source: 'RETENTION_SNAPSHOT' },
      }),
    ).resolves.toBe(0);
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

    expect(retainedIdentity.retentionReason).toBe('LEGAL_HOLD');
    expect(retainedIdentity.legalHoldReason).toBe('LAW_ENFORCEMENT_REQUEST');
    expect(retainedIdentity.legalHoldAt?.toISOString()).toBe('2026-05-12T00:00:00.000Z');
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
    expect(initial.retentionReason).toBe('ACCOUNT_DELETION');
    expect(initial.retentionHoldUntil?.toISOString()).toBe('2026-05-17T00:00:00.000Z');

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
    expect(upgraded.retentionReason).toBe('REPORT_REVIEW');
    expect(upgraded.retentionHoldUntil?.toISOString()).toBe('2029-05-11T00:00:00.000Z');
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

    const logs = await prisma.retainedIdentityDataAccessLog.findMany({
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
        hadConversation: true,
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

    expect(result.createdCount).toBe(4);

    const jobs = await prisma.archiveJob.findMany({
      where: { retainedIdentityId: retainedIdentity.id },
      orderBy: { target: 'asc' },
    });
    expect(jobs.map((job) => job.target)).toEqual(
      expect.arrayContaining([
        'MATCH_HISTORY',
        'RETAINED_IDENTITY',
        'SEASON_PROFILE_HISTORY',
        'THREAD_RETENTION',
      ]),
    );

    const jobByTarget = new Map(jobs.map((job) => [job.target, job]));
    expect(jobByTarget.get('RETAINED_IDENTITY')).toMatchObject({
      archiveTier: 'HOT_DB',
      userId: 'user-a',
      retainedIdentityId: retainedIdentity.id,
      status: 'PENDING',
    });
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
    expect(jobByTarget.get('THREAD_RETENTION')?.payload).toEqual(
      expect.objectContaining({
        source: 'ACCOUNT_DELETE',
        target: 'THREAD_RETENTION',
        retentionMode: 'INDEFINITE_LOGICAL_ARCHIVE',
        identityReviewAfter: '2028-05-11T00:00:00.000Z',
        waitingFor: 'THREAD_ARCHIVED',
      }),
    );
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
      undefined,
      {
        bodyCipher: chatBodyCipher,
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

    const retainedBodies = await prisma.conversationMessageRetainedBody.findMany({
      where: { threadId: 'thread-a-b-retention' },
      orderBy: { messageId: 'asc' },
    });
    expect(retainedBodies).toHaveLength(2);
    expect(retainedBodies[0]).toMatchObject({
      archiveJobId: waitingJob.id,
      triggerRetainedIdentityId: retainedIdentity.id,
      keyVersion: 'chat-integration-v1',
    });
    expect(retainedBodies[0]?.encryptedBodyPayload).toMatchObject({
      schemaVersion: 1,
      algorithm: 'aes-256-gcm',
      keyVersion: 'chat-integration-v1',
    });
  });
});
