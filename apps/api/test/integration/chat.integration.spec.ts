import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { AuthSessionService } from '../../src/auth/sessions/auth-session.service.js';
import { ChatService } from '../../src/chat/application/chat.service.js';
import { ChatRealtimeRateLimiterService } from '../../src/chat/realtime/chat-realtime-rate-limiter.service.js';
import { PrismaService } from '../../src/platform/database/prisma.service.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';
import {
  authContext,
  seedBaseSeasonFixtures,
  seedActiveMatchFixture,
  seedRegisteredAssignedParticipant,
} from './support/integration-fixtures.js';

type FutureSendConversationMessageRequest = {
  targetUserId: string;
  body: string;
  clientMessageId: string;
};

function makeSendMessageInput(
  body: string,
  clientMessageId: string,
  targetUserId = 'user-b',
): FutureSendConversationMessageRequest {
  return { targetUserId, body, clientMessageId };
}

type Constructor = new (...args: unknown[]) => Record<string, unknown>;

type ChatRealtimeOutboxModule = {
  ChatRealtimeOutboxService?: Constructor;
  ChatRealtimeOutboxRepository?: Constructor;
  ChatRealtimeReplayService?: Constructor;
};

async function loadChatRealtimeExport(
  modulePath: string,
  exportName: keyof ChatRealtimeOutboxModule,
): Promise<Constructor> {
  const moduleRecord = (await import(modulePath)) as ChatRealtimeOutboxModule;
  expect(moduleRecord[exportName]).toEqual(expect.any(Function));

  const exported = moduleRecord[exportName];
  if (!exported) {
    throw new Error(`${String(exportName)} export is required`);
  }

  return exported;
}

function loadChatRealtimeOutboxService(): Promise<Constructor> {
  return loadChatRealtimeExport(
    '../../src/chat/outbox/chat-realtime-outbox.service.js',
    'ChatRealtimeOutboxService',
  );
}

function loadChatRealtimeOutboxRepository(): Promise<Constructor> {
  return loadChatRealtimeExport(
    '../../src/chat/outbox/chat-realtime-outbox.repository.js',
    'ChatRealtimeOutboxRepository',
  );
}

function loadChatRealtimeReplayService(): Promise<Constructor> {
  return loadChatRealtimeExport(
    '../../src/chat/outbox/chat-realtime-replay.service.js',
    'ChatRealtimeReplayService',
  );
}

function getMethod<T extends (...args: unknown[]) => unknown>(
  owner: Record<string, unknown>,
  methodName: string,
): T {
  const method = owner[methodName];
  expect(method).toEqual(expect.any(Function));
  return method as T;
}

describe('ChatService integration', () => {
  let prisma: PrismaService;
  let service: ChatService;
  let authSessionService: AuthSessionService;
  let rateLimiter: ChatRealtimeRateLimiterService;
  let httpServer: Parameters<typeof request>[0];
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('chat_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    prisma = prismaService;
    service = app.get(ChatService);
    authSessionService = app.get(AuthSessionService);
    rateLimiter = app.get(ChatRealtimeRateLimiterService);
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
    rateLimiter.resetForTest();
    await truncateIntegrationSchema(prisma);
    await seedBaseSeasonFixtures(prisma);
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
    });
  });

  async function issueAccessToken(userId = 'user-a', email = 'user-a@kangwon.ac.kr') {
    const issued = await authSessionService.issueAuthResult(userId, email, false);
    return issued.accessToken;
  }

  it('conversation stats API는 match history가 아니라 chat thread row 기준 unique 대화 사용자 수를 반환한다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-c',
      participantId: 'participant-c',
      email: 'user-c@kangwon.ac.kr',
      nickname: '유저C',
    });

    const databaseNow = await prisma.getDatabaseNow();
    const currentYear = databaseNow.getUTCFullYear();
    await prisma.season.create({
      data: {
        id: 'season-past-conversation-stats',
        campusCode: 'CHUNCHEON',
        academicYear: currentYear - 1,
        semester: 2,
        name: `${currentYear - 1}-2`,
        preparationStartDate: new Date(`${currentYear - 1}-01-01T00:00:00.000Z`),
        matchingStartDate: new Date(`${currentYear - 1}-01-15T00:00:00.000Z`),
        seasonEndDate: new Date(`${currentYear - 1}-02-28T00:00:00.000Z`),
      },
    });
    await prisma.seasonParticipant.createMany({
      data: [
        {
          id: 'participant-a-past-conversation-stats',
          seasonId: 'season-past-conversation-stats',
          userId: 'user-a',
          participationIntent: 'REGISTERED',
          registeredAt: databaseNow,
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
          participantStatus: 'ACTIVE',
          campusCodeSnapshot: 'CHUNCHEON',
          genderSnapshot: 'M',
          joinedAt: databaseNow,
          activatedAt: databaseNow,
        },
        {
          id: 'participant-c-past-conversation-stats',
          seasonId: 'season-past-conversation-stats',
          userId: 'user-c',
          participationIntent: 'REGISTERED',
          registeredAt: databaseNow,
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
          participantStatus: 'ACTIVE',
          campusCodeSnapshot: 'CHUNCHEON',
          genderSnapshot: 'M',
          joinedAt: databaseNow,
          activatedAt: databaseNow,
        },
      ],
    });
    await prisma.conversationThread.createMany({
      data: [
        {
          id: 'stats-current-thread-open',
          seasonId: 'season-integration',
          pairKey: 'participant-a:participant-b',
          participantAId: 'participant-a',
          participantBId: 'participant-b',
          openedByParticipantId: 'participant-a',
          threadKind: 'DIRECT',
          status: 'OPEN',
        },
        {
          id: 'stats-current-thread-archived-same-counterpart',
          seasonId: 'season-integration',
          pairKey: 'participant-a:participant-b',
          participantAId: 'participant-a',
          participantBId: 'participant-b',
          openedByParticipantId: 'participant-b',
          threadKind: 'DIRECT',
          status: 'ARCHIVED',
          closedReason: 'PARTICIPANT_WITHDRAWN',
          closedAt: databaseNow,
        },
        {
          id: 'stats-past-thread',
          seasonId: 'season-past-conversation-stats',
          pairKey: 'participant-a-past-conversation-stats:participant-c-past-conversation-stats',
          participantAId: 'participant-a-past-conversation-stats',
          participantBId: 'participant-c-past-conversation-stats',
          openedByParticipantId: 'participant-a-past-conversation-stats',
          threadKind: 'DIRECT',
          status: 'ARCHIVED',
          closedReason: 'SEASON_ENDED',
          closedAt: databaseNow,
        },
      ],
    });
    await prisma.seasonMatchHistoryEntry.create({
      data: {
        id: 'stats-history-entry-without-chat-dependency',
        seasonId: 'season-past-conversation-stats',
        viewerParticipantId: 'participant-a-past-conversation-stats',
        counterpartParticipantId: 'participant-c-past-conversation-stats',
        pairKey: 'participant-a-past-conversation-stats:participant-c-past-conversation-stats',
        entryType: 'MATCH',
        entryResult: 'MATCHED_SUCCESS',
        viewerRequested: true,
        matchScore: 80,
        counterpartNicknameSnapshot: '유저C',
        finalizedAt: databaseNow,
      },
    });

    const accessToken = await issueAccessToken();
    const response = await request(httpServer)
      .get('/api/chat/conversation-stats')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      current: {
        seasonId: 'season-integration',
        seasonName: `${currentYear}-1`,
        conversationUserCount: 1,
      },
      past: [
        {
          seasonId: 'season-past-conversation-stats',
          seasonName: `${currentYear - 1}-2`,
          conversationUserCount: 1,
        },
      ],
    });
  });

  it('HTTP message limiter 초과 시 429로 거절하고 DB message/outbox를 추가하지 않는다', async () => {
    const accessToken = await issueAccessToken();

    for (let index = 0; index < 5; index += 1) {
      const response = await request(httpServer)
        .post('/api/chat/messages')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(
          makeSendMessageInput(`rate limit 허용 메시지 ${index}`, `http-rate-message-${index}`),
        );

      expect(response.status).toBeLessThan(300);
    }

    const beforeMessageCount = await prisma.conversationMessage.count();
    const beforeOutboxCount = await prisma.chatRealtimeOutboxEvent.count();
    const rejected = await request(httpServer)
      .post('/api/chat/messages')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(makeSendMessageInput('rate limit 거절 메시지', 'http-rate-message-rejected'));

    expect(rejected.status).toBe(429);
    expect(rejected.body).toMatchObject({
      code: 'CHAT_REALTIME_RATE_LIMITED',
      scope: 'chat:message:burst',
    });
    expect(await prisma.conversationMessage.count()).toBe(beforeMessageCount);
    expect(await prisma.chatRealtimeOutboxEvent.count()).toBe(beforeOutboxCount);
  });

  it('HTTP realtime ticket limiter 초과 시 429로 거절하고 token/ticket 값을 error payload에 노출하지 않는다', async () => {
    const accessToken = await issueAccessToken();

    const issuedTickets: string[] = [];
    for (let index = 0; index < 10; index += 1) {
      const response = await request(httpServer)
        .post('/api/chat/realtime/tickets')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBeLessThan(300);
      const responseBody = response.body as { ticket?: unknown };
      expect(responseBody.ticket).toEqual(expect.any(String));
      if (typeof responseBody.ticket !== 'string') {
        throw new Error('Expected realtime ticket string');
      }
      issuedTickets.push(responseBody.ticket);
    }

    const rejected = await request(httpServer)
      .post('/api/chat/realtime/tickets')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(rejected.status).toBe(429);
    expect(rejected.body).toMatchObject({
      code: 'CHAT_REALTIME_RATE_LIMITED',
      scope: 'chat:ticket:user',
    });
    const serializedBody = JSON.stringify(rejected.body);
    expect(serializedBody).not.toContain(accessToken);
    for (const issuedTicket of issuedTickets) {
      expect(serializedBody).not.toContain(issuedTicket);
    }
  });

  it('동시에 같은 pair로 첫 메시지를 보내도 thread는 하나만 생성되고 두 메시지가 남는다', async () => {
    const first = service.sendMessage(
      authContext('user-a'),
      makeSendMessageInput('첫 번째 메시지', 'client-message-concurrent-1'),
    );
    const second = service.sendMessage(
      authContext('user-a'),
      makeSendMessageInput('두 번째 메시지', 'client-message-concurrent-2'),
    );

    const results = await Promise.all([first, second]);

    expect(results[0]?.thread.id).toBe(results[1]?.thread.id);

    const threads = await prisma.conversationThread.findMany({
      where: {
        seasonId: 'season-integration',
        pairKey: 'participant-a:participant-b',
      },
    });
    expect(threads).toHaveLength(1);

    const messages = await prisma.conversationMessage.findMany({
      where: {
        threadId: threads[0]?.id,
      },
      orderBy: [{ sentAt: 'asc' }, { createdAt: 'asc' }],
    });

    expect(messages).toHaveLength(2);
    expect(messages.map((message) => message.body)).toEqual(
      expect.arrayContaining(['첫 번째 메시지', '두 번째 메시지']),
    );

    const persistedClientMessageIds = await prisma.$queryRaw<
      Array<{ clientMessageId: string | null }>
    >`
      SELECT "clientMessageId"
      FROM "ConversationMessage"
      WHERE "threadId" = ${threads[0]?.id}
      ORDER BY "sentAt" ASC, "createdAt" ASC
    `;
    expect(persistedClientMessageIds.map((row) => row.clientMessageId)).toEqual(
      expect.arrayContaining(['client-message-concurrent-1', 'client-message-concurrent-2']),
    );

    const lifecycleEvents = await prisma.conversationThreadLifecycleEvent.findMany({
      where: { threadId: threads[0]?.id },
    });
    expect(lifecycleEvents).toHaveLength(1);
    expect(lifecycleEvents[0]).toMatchObject({
      threadId: threads[0]?.id,
      eventType: 'THREAD_CREATED',
      reason: 'DIRECT_MESSAGE_STARTED',
      actorType: 'USER',
      actorUserId: 'user-a',
      sourceDomain: 'CHAT',
    });
  });

  it('양쪽이 동시에 서로에게 첫 메시지를 보내도 thread는 하나만 생성되고 두 메시지가 남는다', async () => {
    const first = service.sendMessage(
      authContext('user-a'),
      makeSendMessageInput('A가 B에게 보낸 첫 메시지', 'client-message-cross-a-to-b', 'user-b'),
    );
    const second = service.sendMessage(
      authContext('user-b'),
      makeSendMessageInput('B가 A에게 보낸 첫 메시지', 'client-message-cross-b-to-a', 'user-a'),
    );

    const results = await Promise.all([first, second]);

    expect(results[0]?.thread.id).toBe(results[1]?.thread.id);

    const threads = await prisma.conversationThread.findMany({
      where: {
        seasonId: 'season-integration',
        pairKey: 'participant-a:participant-b',
      },
    });
    expect(threads).toHaveLength(1);

    const messages = await prisma.conversationMessage.findMany({
      where: {
        threadId: threads[0]?.id,
      },
      orderBy: [{ sentAt: 'asc' }, { createdAt: 'asc' }],
    });

    expect(messages.map((message) => message.body)).toEqual(
      expect.arrayContaining(['A가 B에게 보낸 첫 메시지', 'B가 A에게 보낸 첫 메시지']),
    );
    expect(messages.map((message) => message.clientMessageId)).toEqual(
      expect.arrayContaining(['client-message-cross-a-to-b', 'client-message-cross-b-to-a']),
    );
  });

  it('UI entry 이후 첫 메시지 직전에 target이 다른 사용자와 matched 되면 새 thread를 만들지 않고 거절한다', async () => {
    const entry = await service.getThreadEntry(authContext('user-a'), 'user-b');
    expect(entry.canEnterChatUi).toBe(true);
    expect(entry.canSendMessage).toBe(true);

    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-c',
      participantId: 'participant-c',
      email: 'user-c@kangwon.ac.kr',
      nickname: '유저C',
    });
    await seedActiveMatchFixture(prisma, {
      activeMatchId: 'active-b-c-before-first-message',
      participantAId: 'participant-b',
      participantBId: 'participant-c',
    });

    await expect(
      service.sendMessage(
        authContext('user-a'),
        makeSendMessageInput(
          'UI entry 이후 target matched race',
          'client-message-target-matched-before-first-send',
          'user-b',
        ),
      ),
    ).rejects.toMatchObject({
      response: { code: 'CHAT_MESSAGE_SEND_NOT_ALLOWED' },
    });

    const thread = await prisma.conversationThread.findFirst({
      where: {
        seasonId: 'season-integration',
        pairKey: 'participant-a:participant-b',
      },
    });
    expect(thread).toBeNull();
  });

  it('같은 sender의 같은 clientMessageId와 같은 body는 기존 메시지로 수렴한다', async () => {
    const first = await service.sendMessage(
      authContext('user-a'),
      makeSendMessageInput('중복 전송 메시지', 'client-message-duplicate-same'),
    );
    const second = await service.sendMessage(
      authContext('user-a'),
      makeSendMessageInput('중복 전송 메시지', 'client-message-duplicate-same'),
    );

    expect(second.message.id).toBe(first.message.id);

    const messages = await prisma.conversationMessage.findMany({
      where: { threadId: first.thread.id },
    });
    expect(messages).toHaveLength(1);
  });

  it('동시에 같은 sender의 같은 clientMessageId와 같은 body가 들어와도 하나의 메시지로 수렴한다', async () => {
    const first = service.sendMessage(
      authContext('user-a'),
      makeSendMessageInput('동시 중복 메시지', 'client-message-duplicate-race'),
    );
    const second = service.sendMessage(
      authContext('user-a'),
      makeSendMessageInput('동시 중복 메시지', 'client-message-duplicate-race'),
    );

    const results = await Promise.all([first, second]);

    expect(results[0]?.message.id).toBe(results[1]?.message.id);

    const messages = await prisma.conversationMessage.findMany({
      where: { threadId: results[0]?.thread.id },
    });
    expect(messages).toHaveLength(1);
  });

  it('같은 sender의 같은 clientMessageId와 다른 body는 conflict로 거절한다', async () => {
    await service.sendMessage(
      authContext('user-a'),
      makeSendMessageInput('처음 보낸 본문', 'client-message-duplicate-conflict'),
    );

    await expect(
      service.sendMessage(
        authContext('user-a'),
        makeSendMessageInput('다른 본문', 'client-message-duplicate-conflict'),
      ),
    ).rejects.toMatchObject({
      response: { code: 'CHAT_MESSAGE_IDEMPOTENCY_CONFLICT' },
    });
  });

  it('동시에 같은 sender의 같은 clientMessageId와 다른 body가 들어오면 하나만 commit되고 나머지는 conflict로 수렴한다', async () => {
    const settled = await Promise.allSettled([
      service.sendMessage(
        authContext('user-a'),
        makeSendMessageInput('동시 중복 원본', 'client-message-duplicate-conflict-race'),
      ),
      service.sendMessage(
        authContext('user-a'),
        makeSendMessageInput('동시 중복 다른 본문', 'client-message-duplicate-conflict-race'),
      ),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = settled.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({
      reason: { response: { code: 'CHAT_MESSAGE_IDEMPOTENCY_CONFLICT' } },
    });

    const messages = await prisma.conversationMessage.findMany({
      where: { senderParticipantId: 'participant-a' },
    });
    expect(messages).toHaveLength(1);
  });

  it('read marker는 READ_ONLY thread에서도 갱신 가능하지만 뒤로 이동할 수 없다', async () => {
    const serviceWithReadMarker = service as unknown as {
      updateReadMarker?: (
        authUser: ReturnType<typeof authContext>,
        threadId: string,
        input: { lastReadMessageId: string },
      ) => Promise<unknown>;
    };
    expect(typeof serviceWithReadMarker.updateReadMarker).toBe('function');

    if (!serviceWithReadMarker.updateReadMarker) {
      throw new Error('ChatService.updateReadMarker must be implemented');
    }

    await prisma.conversationThread.create({
      data: {
        id: 'read-marker-thread',
        seasonId: 'season-integration',
        pairKey: 'participant-a:participant-b',
        participantAId: 'participant-a',
        participantBId: 'participant-b',
        openedByParticipantId: 'participant-a',
        threadKind: 'DIRECT',
        status: 'READ_ONLY',
        closedReason: 'ROOM_SELECTION_CUTOFF',
        closedAt: new Date('2026-02-12T00:00:00.000Z'),
        members: {
          create: [{ participantId: 'participant-a' }, { participantId: 'participant-b' }],
        },
        messages: {
          create: [
            {
              id: 'read-marker-message-1',
              senderParticipantId: 'participant-a',
              body: '이전 메시지',
              sentAt: new Date('2026-02-10T01:00:00.000Z'),
            },
            {
              id: 'read-marker-message-2',
              senderParticipantId: 'participant-b',
              body: '나중 메시지',
              sentAt: new Date('2026-02-10T02:00:00.000Z'),
            },
          ],
        },
      },
    });

    await serviceWithReadMarker.updateReadMarker(authContext('user-a'), 'read-marker-thread', {
      lastReadMessageId: 'read-marker-message-2',
    });
    await expect(
      serviceWithReadMarker.updateReadMarker(authContext('user-a'), 'read-marker-thread', {
        lastReadMessageId: 'read-marker-message-1',
      }),
    ).rejects.toMatchObject({
      response: { code: 'CHAT_READ_MARKER_CANNOT_MOVE_BACKWARD' },
    });
  });

  it('동시에 오래된 read marker와 최신 read marker가 들어와도 최종 marker는 뒤로 이동하지 않는다', async () => {
    const serviceWithReadMarker = service as unknown as {
      updateReadMarker?: (
        authUser: ReturnType<typeof authContext>,
        threadId: string,
        input: { lastReadMessageId: string },
      ) => Promise<unknown>;
    };
    expect(typeof serviceWithReadMarker.updateReadMarker).toBe('function');

    if (!serviceWithReadMarker.updateReadMarker) {
      throw new Error('ChatService.updateReadMarker must be implemented');
    }

    await prisma.conversationThread.create({
      data: {
        id: 'read-marker-race-thread',
        seasonId: 'season-integration',
        pairKey: 'participant-a:participant-b',
        participantAId: 'participant-a',
        participantBId: 'participant-b',
        openedByParticipantId: 'participant-a',
        threadKind: 'DIRECT',
        status: 'READ_ONLY',
        closedReason: 'ROOM_SELECTION_CUTOFF',
        closedAt: new Date('2026-02-12T00:00:00.000Z'),
        members: {
          create: [{ participantId: 'participant-a' }, { participantId: 'participant-b' }],
        },
        messages: {
          create: [
            {
              id: 'read-marker-race-message-1',
              senderParticipantId: 'participant-b',
              body: '첫 메시지',
              sentAt: new Date('2026-02-10T01:00:00.000Z'),
            },
            {
              id: 'read-marker-race-message-2',
              senderParticipantId: 'participant-b',
              body: '두 번째 메시지',
              sentAt: new Date('2026-02-10T02:00:00.000Z'),
            },
            {
              id: 'read-marker-race-message-3',
              senderParticipantId: 'participant-b',
              body: '최신 메시지',
              sentAt: new Date('2026-02-10T03:00:00.000Z'),
            },
          ],
        },
      },
    });

    const settled = await Promise.allSettled([
      serviceWithReadMarker.updateReadMarker(authContext('user-a'), 'read-marker-race-thread', {
        lastReadMessageId: 'read-marker-race-message-2',
      }),
      serviceWithReadMarker.updateReadMarker(authContext('user-a'), 'read-marker-race-thread', {
        lastReadMessageId: 'read-marker-race-message-3',
      }),
    ]);

    expect(settled.some((result) => result.status === 'fulfilled')).toBe(true);

    const [marker] = await prisma.$queryRaw<Array<{ lastReadMessageId: string | null }>>`
      SELECT "lastReadMessageId"
      FROM "ConversationThreadMember"
      WHERE "threadId" = ${'read-marker-race-thread'}
        AND "participantId" = ${'participant-a'}
    `;
    expect(marker?.lastReadMessageId).toBe('read-marker-race-message-3');
  });

  it('outbox append가 포함된 business transaction이 rollback되면 event와 recipient rows도 남지 않는다', async () => {
    const OutboxService = await loadChatRealtimeOutboxService();
    const outboxService = new OutboxService({});
    const appendMessageCreated = getMethod<(...args: unknown[]) => Promise<unknown>>(
      outboxService,
      'appendMessageCreated',
    );

    await expect(
      prisma.$transaction(async (tx) => {
        await appendMessageCreated.call(outboxService, tx, {
          threadId: 'thread-rollback',
          actorUserId: 'user-a',
          message: {
            id: 'message-rollback',
            body: '롤백되어야 하는 메시지',
            senderUserId: 'user-a',
            sentAt: new Date('2026-02-10T03:00:00.000Z'),
          },
          recipientUserIds: ['user-a', 'user-b'],
        });
        throw new Error('force rollback after outbox append');
      }),
    ).rejects.toThrow('force rollback after outbox append');

    const [eventCount] = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM "ChatRealtimeOutboxEvent"
      WHERE "aggregateId" = ${'message-rollback'}
    `;
    expect(eventCount?.count).toBe(0);

    const [recipientCount] = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM "ChatRealtimeEventRecipient"
      WHERE "eventId" IN (
        SELECT "id"
        FROM "ChatRealtimeOutboxEvent"
        WHERE "aggregateId" = ${'message-rollback'}
      )
    `;
    expect(recipientCount?.count).toBe(0);
  });

  it('outbox repository concurrent claim은 같은 event를 두 worker에게 중복 반환하지 않는다', async () => {
    const Repository = await loadChatRealtimeOutboxRepository();
    const repository = new Repository();
    const claimPublishableBatch = getMethod<(...args: unknown[]) => Promise<unknown>>(
      repository,
      'claimPublishableBatch',
    );
    const now = new Date('2026-02-10T03:00:00.000Z');

    await prisma.$executeRaw`
      INSERT INTO "ChatRealtimeOutboxEvent" (
        "id", "eventType", "schemaVersion", "threadId", "aggregateType", "aggregateId",
        "aggregateVersion", "payload", "roomKeys", "occurredAt", "availableAt",
        "publishAttempts", "createdAt", "updatedAt"
      )
      VALUES
        (
          ${'claim-event-1'}, ${'chat.message.created'}, ${1}, ${'thread-claim'},
          ${'conversation.message'}, ${'claim-message-1'}, ${1},
          ${JSON.stringify({ messageId: 'claim-message-1' })}::jsonb,
          ARRAY[${'user:user-a'}], ${now}, ${now}, ${0}, ${now}, ${now}
        ),
        (
          ${'claim-event-2'}, ${'chat.message.created'}, ${1}, ${'thread-claim'},
          ${'conversation.message'}, ${'claim-message-2'}, ${1},
          ${JSON.stringify({ messageId: 'claim-message-2' })}::jsonb,
          ARRAY[${'user:user-a'}], ${now}, ${now}, ${0}, ${now}, ${now}
        )
    `;

    const [firstClaim, secondClaim] = await Promise.all([
      claimPublishableBatch.call(repository, prisma, { limit: 1, now, claimLeaseMs: 30_000 }),
      claimPublishableBatch.call(repository, prisma, { limit: 1, now, claimLeaseMs: 30_000 }),
    ]);
    const claimedIds = [
      ...(firstClaim as Array<{ id: string }>),
      ...(secondClaim as Array<{ id: string }>),
    ].map((row) => row.id);

    expect(claimedIds).toHaveLength(2);
    expect(new Set(claimedIds).size).toBe(2);
    expect(claimedIds).toEqual(expect.arrayContaining(['claim-event-1', 'claim-event-2']));
  });

  it('outbox prune은 7일 replay window 밖 event와 recipient를 삭제한다', async () => {
    const Repository = await loadChatRealtimeOutboxRepository();
    const repository = new Repository();
    const pruneExpired = getMethod<(...args: unknown[]) => Promise<unknown>>(
      repository,
      'pruneExpired',
    );
    const now = new Date('2026-02-10T03:00:00.000Z');
    const expiredAt = new Date('2026-02-01T02:59:59.000Z');
    const freshAt = new Date('2026-02-04T03:00:00.000Z');

    await prisma.$executeRaw`
      INSERT INTO "ChatRealtimeOutboxEvent" (
        "id", "eventType", "schemaVersion", "threadId", "aggregateType", "aggregateId",
        "aggregateVersion", "payload", "roomKeys", "occurredAt", "availableAt",
        "publishAttempts", "createdAt", "updatedAt"
      )
      VALUES
        (
          ${'prune-event-expired'}, ${'chat.message.created'}, ${1}, ${'thread-prune'},
          ${'conversation.message'}, ${'prune-message-expired'}, ${1},
          ${JSON.stringify({ messageId: 'prune-message-expired' })}::jsonb,
          ARRAY[${'user:user-a'}], ${expiredAt}, ${expiredAt}, ${0}, ${expiredAt}, ${expiredAt}
        ),
        (
          ${'prune-event-fresh'}, ${'chat.message.created'}, ${1}, ${'thread-prune'},
          ${'conversation.message'}, ${'prune-message-fresh'}, ${1},
          ${JSON.stringify({ messageId: 'prune-message-fresh' })}::jsonb,
          ARRAY[${'user:user-a'}], ${freshAt}, ${freshAt}, ${0}, ${freshAt}, ${freshAt}
        )
    `;
    await prisma.$executeRaw`
      INSERT INTO "ChatRealtimeEventRecipient" (
        "eventId", "userId", "threadId", "cursor", "createdAt"
      )
      VALUES
        (${'prune-event-expired'}, ${'user-a'}, ${'thread-prune'}, ${'cursor-prune-expired'}, ${expiredAt}),
        (${'prune-event-fresh'}, ${'user-a'}, ${'thread-prune'}, ${'cursor-prune-fresh'}, ${freshAt})
    `;

    await expect(pruneExpired.call(repository, prisma, { now, replayWindowDays: 7 })).resolves.toBe(
      1,
    );

    const [remainingEvents] = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM "ChatRealtimeOutboxEvent"
      WHERE "id" IN (${'prune-event-expired'}, ${'prune-event-fresh'})
    `;
    expect(remainingEvents?.count).toBe(1);

    const [expiredRecipients] = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM "ChatRealtimeEventRecipient"
      WHERE "eventId" = ${'prune-event-expired'}
    `;
    expect(expiredRecipients?.count).toBe(0);
  });

  it('replay service는 user별 recipient cursor만 순서대로 반환하고 만료 cursor는 resync로 수렴한다', async () => {
    const ReplayService = await loadChatRealtimeReplayService();
    const replayService = new ReplayService({ replayWindowDays: 7 });
    const getReplayEvents = getMethod<(...args: unknown[]) => Promise<unknown>>(
      replayService,
      'getReplayEvents',
    );
    const now = new Date('2026-02-10T03:00:00.000Z');
    const expiredAt = new Date('2026-02-01T03:00:00.000Z');

    await prisma.$executeRaw`
      INSERT INTO "ChatRealtimeOutboxEvent" (
        "id", "eventType", "schemaVersion", "threadId", "aggregateType", "aggregateId",
        "aggregateVersion", "payload", "roomKeys", "occurredAt", "availableAt",
        "publishAttempts", "createdAt", "updatedAt"
      )
      VALUES
        (
          ${'replay-event-1'}, ${'chat.message.created'}, ${1}, ${'thread-replay'},
          ${'conversation.message'}, ${'replay-message-1'}, ${1},
          ${JSON.stringify({ messageId: 'replay-message-1' })}::jsonb,
          ARRAY[${'user:user-a'}], ${now}, ${now}, ${0}, ${now}, ${now}
        ),
        (
          ${'replay-event-2'}, ${'chat.message.created'}, ${1}, ${'thread-replay'},
          ${'conversation.message'}, ${'replay-message-2'}, ${1},
          ${JSON.stringify({ messageId: 'replay-message-2' })}::jsonb,
          ARRAY[${'user:user-a'}], ${now}, ${now}, ${0}, ${now}, ${now}
        ),
        (
          ${'replay-event-user-b'}, ${'chat.message.created'}, ${1}, ${'thread-replay'},
          ${'conversation.message'}, ${'replay-message-user-b'}, ${1},
          ${JSON.stringify({ messageId: 'replay-message-user-b' })}::jsonb,
          ARRAY[${'user:user-b'}], ${now}, ${now}, ${0}, ${now}, ${now}
        ),
        (
          ${'replay-event-expired'}, ${'chat.message.created'}, ${1}, ${'thread-replay'},
          ${'conversation.message'}, ${'replay-message-expired'}, ${1},
          ${JSON.stringify({ messageId: 'replay-message-expired' })}::jsonb,
          ARRAY[${'user:user-a'}], ${expiredAt}, ${expiredAt}, ${0}, ${expiredAt}, ${expiredAt}
        )
    `;
    await prisma.$executeRaw`
      INSERT INTO "ChatRealtimeEventRecipient" (
        "eventId", "userId", "threadId", "cursor", "createdAt"
      )
      VALUES
        (${'replay-event-1'}, ${'user-a'}, ${'thread-replay'}, ${'cursor-1'}, ${now}),
        (${'replay-event-2'}, ${'user-a'}, ${'thread-replay'}, ${'cursor-2'}, ${now}),
        (${'replay-event-user-b'}, ${'user-b'}, ${'thread-replay'}, ${'cursor-user-b'}, ${now}),
        (${'replay-event-expired'}, ${'user-a'}, ${'thread-replay'}, ${'cursor-expired'}, ${expiredAt})
    `;

    const replayResult = await getReplayEvents.call(replayService, prisma, {
      userId: 'user-a',
      after: 'cursor-1',
      limit: 10,
      now,
    });

    expect(replayResult).toMatchObject({
      status: 'ok',
      events: [expect.objectContaining({ eventId: 'replay-event-2', cursor: 'cursor-2' })],
      hasMore: false,
      nextCursor: 'cursor-2',
    });
    expect(JSON.stringify(replayResult)).not.toContain('replay-event-user-b');

    await expect(
      getReplayEvents.call(replayService, prisma, {
        userId: 'user-a',
        after: 'cursor-expired',
        limit: 10,
        now,
      }),
    ).resolves.toMatchObject({ status: 'resync_required', reason: 'CURSOR_EXPIRED' });
  });

  it('direct thread에서 양쪽 leave race가 걸려도 최종 상태는 ARCHIVED다', async () => {
    await prisma.conversationThread.create({
      data: {
        id: 'direct-chat-race-thread',
        seasonId: 'season-integration',
        pairKey: 'participant-a:participant-b',
        participantAId: 'participant-a',
        participantBId: 'participant-b',
        openedByParticipantId: 'participant-a',
        threadKind: 'DIRECT',
        status: 'OPEN',
      },
    });
    await prisma.conversationThreadMember.createMany({
      data: [
        { threadId: 'direct-chat-race-thread', participantId: 'participant-a' },
        { threadId: 'direct-chat-race-thread', participantId: 'participant-b' },
      ],
    });

    const settled = await Promise.allSettled([
      service.leaveThread(authContext('user-a'), 'direct-chat-race-thread'),
      service.leaveThread(authContext('user-b'), 'direct-chat-race-thread'),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(2);

    const thread = await prisma.conversationThread.findUnique({
      where: { id: 'direct-chat-race-thread' },
    });
    expect(thread?.threadKind).toBe('DIRECT');
    expect(thread?.status).toBe('ARCHIVED');

    const members = await prisma.conversationThreadMember.findMany({
      where: { threadId: 'direct-chat-race-thread' },
    });
    expect(members.every((member) => member.memberState === 'LEFT')).toBe(true);
  });
});
