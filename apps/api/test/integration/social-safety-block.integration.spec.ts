import {
  blockListResponseSchema,
  createBlockResponseSchema,
  deleteBlockResponseSchema,
} from '@repo/shared/social-safety/block';
import { roommateSearchResponseSchema } from '@repo/shared/roommate-search-contract';
import request from 'supertest';
import { AuthSessionService } from '../../src/auth/sessions/auth-session.service.js';
import { PrismaService } from '../../src/platform/database/prisma.service.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';
import {
  seedActiveMatchFixture,
  seedBaseSeasonFixtures,
  seedRegisteredAssignedParticipant,
} from './support/integration-fixtures.js';

describe('Social-safety block integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let authSessionService: AuthSessionService;
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
    expect(createBlockResponseSchema.parse(createResponse.body)).toMatchObject({ created: true });

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
