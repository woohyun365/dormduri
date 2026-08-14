import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  blockListResponseSchema,
  createBlockResponseSchema,
  deleteBlockResponseSchema,
} from '@repo/shared/social-safety/block';
import { roommateSearchResponseSchema } from '@repo/shared/roommate-search/contract';
import request from 'supertest';
import { AuthSessionService } from '../../../src/auth/sessions/auth-session.service.js';
import {
  CHAT_BLOCK_SIDE_EFFECT_PORT,
  type ChatBlockSideEffectPort,
} from '../../../src/chat/application/ports/chat-block-side-effect.port.js';
import { PrismaService } from '../../../src/platform/database/prisma.service.js';
import { createIntegrationApp } from '../_support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from '../_support/integration-db.js';
import { seedActiveMatchFixture } from '../_support/fixtures/matches.fixture.js';
import { seedBaseSeasonFixtures } from '../_support/fixtures/reference-data.fixture.js';
import { seedRegisteredAssignedParticipant } from '../_support/fixtures/participants.fixture.js';

describe('Social-safety block integration', () => {
  let prisma: PrismaService;
  let authSessionService: AuthSessionService;
  let chatBlockSideEffectPort: ChatBlockSideEffectPort;
  let httpServer: Parameters<typeof request>[0];
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('ss_block');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    authSessionService = app.get(AuthSessionService);
    chatBlockSideEffectPort = app.get<ChatBlockSideEffectPort>(CHAT_BLOCK_SIDE_EFFECT_PORT);
    httpServer = app.getHttpServer() as Parameters<typeof request>[0];
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
      userId: 'viewer-user',
      participantId: 'viewer-participant',
      email: 'viewer@kangwon.ac.kr',
      nickname: '뷰어',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'target-user',
      participantId: 'target-participant',
      email: 'target@kangwon.ac.kr',
      nickname: '타겟',
    });
  });

  async function issueAccessToken(userId: string, email: string) {
    const issued = await authSessionService.issueAuthResult(userId, email, false);
    return issued.accessToken;
  }

  async function authHeader(userId = 'viewer-user', email = 'viewer@kangwon.ac.kr') {
    return `Bearer ${await issueAccessToken(userId, email)}`;
  }

  function pairKey() {
    return ['viewer-participant', 'target-participant'].sort().join(':');
  }

  async function seedActiveBookmark(input: { viewerUserId: string; targetUserId: string }) {
    await prisma.userBookmark.create({
      data: {
        viewerUserId: input.viewerUserId,
        seasonId: 'season-integration',
        targetUserId: input.targetUserId,
        targetParticipantId:
          input.targetUserId === 'target-user' ? 'target-participant' : 'viewer-participant',
        bookmarkedAt: await prisma.getDatabaseNow(),
      },
    });
  }

  async function seedPendingMatchRequest() {
    await prisma.matchRequest.create({
      data: {
        id: 'pending-request-block',
        seasonId: 'season-integration',
        pairKey: pairKey(),
        pairMinParticipantId: ['viewer-participant', 'target-participant'].sort()[0]!,
        pairMaxParticipantId: ['viewer-participant', 'target-participant'].sort()[1]!,
        requesterParticipantId: 'viewer-participant',
        receiverParticipantId: 'target-participant',
        status: 'PENDING',
        createdAt: new Date('2026-06-08T00:00:00.000Z'),
        expiresAt: new Date('2026-07-08T00:00:00.000Z'),
      },
    });
  }

  async function seedDirectThread() {
    await prisma.conversationThread.create({
      data: {
        id: 'direct-thread-block',
        seasonId: 'season-integration',
        pairKey: pairKey(),
        participantAId: ['viewer-participant', 'target-participant'].sort()[0]!,
        participantBId: ['viewer-participant', 'target-participant'].sort()[1]!,
        openedByParticipantId: 'viewer-participant',
        threadKind: 'DIRECT',
        status: 'OPEN',
      },
    });
    await prisma.conversationThreadMember.createMany({
      data: [
        { threadId: 'direct-thread-block', participantId: 'viewer-participant' },
        { threadId: 'direct-thread-block', participantId: 'target-participant' },
      ],
    });
  }

  it('visible target block은 event를 기록하고 replay는 idempotent하다', async () => {
    const authorization = await authHeader();

    const [first, second] = await Promise.all([
      request(httpServer)
        .post('/api/blocks/target-user')
        .set('Authorization', authorization)
        .send({ note: '개인 메모' })
        .expect(201),
      request(httpServer)
        .post('/api/blocks/target-user')
        .set('Authorization', authorization)
        .send({ note: '개인 메모' })
        .expect(201),
    ]);

    const firstBody = createBlockResponseSchema.parse(first.body);
    const secondBody = createBlockResponseSchema.parse(second.body);
    expect([firstBody.created, secondBody.created].sort()).toEqual([false, true]);

    await expect(
      prisma.userBlock.count({
        where: { blockerUserId: 'viewer-user', blockedUserId: 'target-user', unblockedAt: null },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.userBlockEvent.count({
        where: { actorUserId: 'viewer-user', targetUserId: 'target-user', eventType: 'BLOCKED' },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.userNotification.count({ where: { recipientUserId: 'target-user' } }),
    ).resolves.toBe(0);
  });

  it('양방향 concurrent block은 각 방향 active row 1개와 event 1개로 수렴한다', async () => {
    const viewerAuthorization = await authHeader();
    const targetAuthorization = await authHeader('target-user', 'target@kangwon.ac.kr');

    const [viewerBlocksTarget, targetBlocksViewer] = await Promise.all([
      request(httpServer)
        .post('/api/blocks/target-user')
        .set('Authorization', viewerAuthorization)
        .send({})
        .expect(201),
      request(httpServer)
        .post('/api/blocks/viewer-user')
        .set('Authorization', targetAuthorization)
        .send({})
        .expect(201),
    ]);

    expect(createBlockResponseSchema.parse(viewerBlocksTarget.body)).toMatchObject({
      created: true,
    });
    expect(createBlockResponseSchema.parse(targetBlocksViewer.body)).toMatchObject({
      created: true,
    });
    await expect(
      prisma.userBlock.count({
        where: {
          unblockedAt: null,
          OR: [
            { blockerUserId: 'viewer-user', blockedUserId: 'target-user' },
            { blockerUserId: 'target-user', blockedUserId: 'viewer-user' },
          ],
        },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.userBlockEvent.count({
        where: {
          eventType: 'BLOCKED',
          OR: [
            { actorUserId: 'viewer-user', targetUserId: 'target-user' },
            { actorUserId: 'target-user', targetUserId: 'viewer-user' },
          ],
        },
      }),
    ).resolves.toBe(2);
  });

  it('active match target block은 report/support CTA와 함께 fail-closed 된다', async () => {
    await seedActiveMatchFixture(prisma, {
      activeMatchId: 'active-match-block',
      participantAId: 'viewer-participant',
      participantBId: 'target-participant',
    });

    const response = await request(httpServer)
      .post('/api/blocks/target-user')
      .set('Authorization', await authHeader())
      .send({})
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'ACTIVE_MATCH_BLOCK_NOT_ALLOWED',
      actionHints: ['REPORT', 'SUPPORT'],
    });
  });

  it('block create는 bookmark/pending match/direct thread/search를 port 기반으로 닫고 unblock은 복원하지 않는다', async () => {
    await seedActiveBookmark({ viewerUserId: 'viewer-user', targetUserId: 'target-user' });
    await seedActiveBookmark({ viewerUserId: 'target-user', targetUserId: 'viewer-user' });
    await seedPendingMatchRequest();
    await seedDirectThread();

    const createResponse = await request(httpServer)
      .post('/api/blocks/target-user')
      .set('Authorization', await authHeader())
      .send({})
      .expect(201);
    const createBody = createBlockResponseSchema.parse(createResponse.body);
    expect(createBody).toMatchObject({ created: true });

    await expect(
      prisma.userBookmark.count({
        where: {
          deletedAt: null,
          expiredAt: null,
          OR: [
            { viewerUserId: 'viewer-user', targetUserId: 'target-user' },
            { viewerUserId: 'target-user', targetUserId: 'viewer-user' },
          ],
        },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.matchRequest.findUniqueOrThrow({ where: { id: 'pending-request-block' } }),
    ).resolves.toMatchObject({
      status: 'CANCELLED_BY_SYSTEM',
      terminalReason: 'MATCH_PRECONDITION_FAILED',
    });
    await expect(
      prisma.conversationThread.findUniqueOrThrow({ where: { id: 'direct-thread-block' } }),
    ).resolves.toMatchObject({
      status: 'READ_ONLY',
      closedReason: 'USER_BLOCKED',
    });
    await expect(
      prisma.chatRealtimeOutboxEvent.count({
        where: {
          threadId: 'direct-thread-block',
          eventType: 'chat.thread.updated',
        },
      }),
    ).resolves.toBe(1);

    const lifecycleEvents = await prisma.conversationThreadLifecycleEvent.findMany({
      where: { threadId: 'direct-thread-block' },
    });
    expect(lifecycleEvents).toHaveLength(1);
    expect(lifecycleEvents[0]).toMatchObject({
      threadId: 'direct-thread-block',
      eventType: 'THREAD_READ_ONLY',
      reason: 'USER_BLOCKED',
      sourceDomain: 'SOCIAL_SAFETY',
      sourceBlockId: createBody.block.id,
    });
    expect(lifecycleEvents[0]?.metadata).toEqual(
      expect.objectContaining({
        previousStatus: 'OPEN',
        nextStatus: 'READ_ONLY',
        previousThreadKind: 'DIRECT',
        nextThreadKind: 'DIRECT',
        previousClosedReason: null,
        nextClosedReason: 'USER_BLOCKED',
      }),
    );
    const serializedLifecycleMetadata = JSON.stringify(lifecycleEvents[0]?.metadata ?? {});
    for (const forbiddenKey of ['blockNote', 'reportDetail', 'messageBody', 'supportBody']) {
      expect(serializedLifecycleMetadata).not.toContain(forbiddenKey);
    }

    const searchResponse = await request(httpServer)
      .get('/api/roommate-search')
      .query({ scope: 'SAME_BUILDING_ONLY', limit: 20 })
      .set('Authorization', await authHeader())
      .expect(200);
    const searchBody = roommateSearchResponseSchema.parse(searchResponse.body);
    expect(searchBody.items.map((item) => item.id)).not.toContain('target-user');

    const blockedSendResponse = await request(httpServer)
      .post('/api/chat/messages')
      .set('Authorization', await authHeader())
      .send({
        targetUserId: 'target-user',
        body: 'active block 중 send 차단',
        clientMessageId: 'blocked-send-attempt',
      })
      .expect(409);
    expect(blockedSendResponse.body).toMatchObject({ code: 'CHAT_MESSAGE_SEND_NOT_ALLOWED' });
    await expect(
      prisma.conversationMessage.count({ where: { threadId: 'direct-thread-block' } }),
    ).resolves.toBe(0);

    const deleteResponse = await request(httpServer)
      .delete('/api/blocks/target-user')
      .set('Authorization', await authHeader())
      .send({})
      .expect(200);
    expect(deleteBlockResponseSchema.parse(deleteResponse.body)).toMatchObject({ deleted: true });

    await expect(
      prisma.userBookmark.count({
        where: {
          deletedAt: null,
          expiredAt: null,
          OR: [
            { viewerUserId: 'viewer-user', targetUserId: 'target-user' },
            { viewerUserId: 'target-user', targetUserId: 'viewer-user' },
          ],
        },
      }),
    ).resolves.toBe(0);

    const resumedSendResponse = await request(httpServer)
      .post('/api/chat/messages')
      .set('Authorization', await authHeader())
      .send({
        targetUserId: 'target-user',
        body: 'unblock 후 명시적 send 재개',
        clientMessageId: 'unblocked-resume-send',
      })
      .expect(201);
    expect(resumedSendResponse.body).toMatchObject({
      createdThread: false,
      thread: { id: 'direct-thread-block', status: 'OPEN', closedReason: null },
    });
    await expect(
      prisma.conversationThread.findUniqueOrThrow({ where: { id: 'direct-thread-block' } }),
    ).resolves.toMatchObject({
      status: 'OPEN',
      closedReason: null,
      closedAt: null,
    });
  });

  it('block chat side-effect가 rollback되면 thread/outbox/lifecycle ghost row를 남기지 않는다', async () => {
    await seedDirectThread();
    const occurredAt = await prisma.getDatabaseNow();

    await expect(
      prisma.runSerializableTransaction(async (tx) => {
        await chatBlockSideEffectPort.closeDirectThreadsForBlock(tx, {
          seasonId: 'season-integration',
          blockerUserId: 'viewer-user',
          blockedUserId: 'target-user',
          sourceBlockId: 'rollback-block-id',
          occurredAt,
        });
        throw new Error('force rollback after block chat side-effect');
      }),
    ).rejects.toThrow('force rollback after block chat side-effect');

    await expect(
      prisma.conversationThread.findUniqueOrThrow({ where: { id: 'direct-thread-block' } }),
    ).resolves.toMatchObject({
      status: 'OPEN',
      closedReason: null,
      closedAt: null,
    });
    await expect(
      prisma.chatRealtimeOutboxEvent.count({
        where: {
          threadId: 'direct-thread-block',
          eventType: 'chat.thread.updated',
        },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.conversationThreadLifecycleEvent.count({
        where: {
          OR: [{ threadId: 'direct-thread-block' }, { sourceBlockId: 'rollback-block-id' }],
        },
      }),
    ).resolves.toBe(0);
  });

  it('unblock 이후 target이 먼저 send해도 기존 USER_BLOCKED direct thread를 lazy reopen한다', async () => {
    await seedDirectThread();

    await request(httpServer)
      .post('/api/blocks/target-user')
      .set('Authorization', await authHeader())
      .send({})
      .expect(201);
    await request(httpServer)
      .delete('/api/blocks/target-user')
      .set('Authorization', await authHeader())
      .send({})
      .expect(200);

    const targetSendResponse = await request(httpServer)
      .post('/api/chat/messages')
      .set('Authorization', await authHeader('target-user', 'target@kangwon.ac.kr'))
      .send({
        targetUserId: 'viewer-user',
        body: 'target이 먼저 재개',
        clientMessageId: 'target-first-resume-send',
      })
      .expect(201);

    expect(targetSendResponse.body).toMatchObject({
      createdThread: false,
      thread: { id: 'direct-thread-block', status: 'OPEN', closedReason: null },
    });
    await expect(
      prisma.conversationThread.count({
        where: {
          seasonId: 'season-integration',
          pairKey: pairKey(),
          status: { in: ['OPEN', 'READ_ONLY'] },
        },
      }),
    ).resolves.toBe(1);
  });

  it('reverse active block이 남아 있으면 unblock 이후 explicit send도 thread를 reopen하지 않는다', async () => {
    await seedDirectThread();

    await request(httpServer)
      .post('/api/blocks/target-user')
      .set('Authorization', await authHeader())
      .send({})
      .expect(201);
    await request(httpServer)
      .post('/api/blocks/viewer-user')
      .set('Authorization', await authHeader('target-user', 'target@kangwon.ac.kr'))
      .send({})
      .expect(201);
    await request(httpServer)
      .delete('/api/blocks/target-user')
      .set('Authorization', await authHeader())
      .send({})
      .expect(200);

    const viewerSendResponse = await request(httpServer)
      .post('/api/chat/messages')
      .set('Authorization', await authHeader())
      .send({
        targetUserId: 'target-user',
        body: 'reverse active block 중 send 차단',
        clientMessageId: 'reverse-block-send-attempt',
      })
      .expect(409);
    expect(viewerSendResponse.body).toMatchObject({ code: 'CHAT_MESSAGE_SEND_NOT_ALLOWED' });

    await expect(
      prisma.conversationThread.findUniqueOrThrow({ where: { id: 'direct-thread-block' } }),
    ).resolves.toMatchObject({
      status: 'READ_ONLY',
      closedReason: 'USER_BLOCKED',
    });
    await expect(
      prisma.conversationMessage.count({ where: { threadId: 'direct-thread-block' } }),
    ).resolves.toBe(0);
  });

  it('block list는 visible target과 no-longer-visible target을 allowlist로 구분한다', async () => {
    await request(httpServer)
      .post('/api/blocks/target-user')
      .set('Authorization', await authHeader())
      .send({ note: '메모' })
      .expect(201);

    const visibleResponse = await request(httpServer)
      .get('/api/blocks')
      .set('Authorization', await authHeader())
      .expect(200);
    const visibleBody = blockListResponseSchema.parse(visibleResponse.body);
    expect(visibleBody.items).toHaveLength(1);
    expect(visibleBody.items[0]).toMatchObject({
      blockedUserId: 'target-user',
      note: '메모',
      visibility: 'VISIBLE',
      displayName: '타겟',
    });

    await prisma.seasonParticipant.update({
      where: { id: 'target-participant' },
      data: { hiddenByAdminAt: await prisma.getDatabaseNow() },
    });

    const hiddenResponse = await request(httpServer)
      .get('/api/blocks')
      .set('Authorization', await authHeader())
      .expect(200);
    const hiddenBody = blockListResponseSchema.parse(hiddenResponse.body);
    expect(hiddenBody.items[0]).toMatchObject({
      blockedUserId: 'target-user',
      note: '메모',
      visibility: 'NO_LONGER_VISIBLE',
      displayName: null,
    });
  });
});
