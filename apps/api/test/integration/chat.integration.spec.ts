import { ChatService } from '../../src/chat/chat.service.js';
import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';
import {
  authContext,
  seedBaseSeasonFixtures,
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
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let service: ChatService;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('chat_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    service = app.get(ChatService);
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
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
    });
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
