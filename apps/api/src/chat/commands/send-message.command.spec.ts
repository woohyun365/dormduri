import { beforeEach, describe, expect, it } from 'vitest';
import {
  ConversationThreadLifecycleActorType,
  ConversationThreadLifecycleEventReason,
  ConversationThreadLifecycleEventType,
  ConversationThreadLifecycleSourceDomain,
} from '../../generated/prisma/enums.js';
import { chatErrors } from '../errors/chat.errors.js';
import {
  createChatServiceSpecHarness,
  makeUserSeed,
  makeParticipant,
  makeThread,
  makeVisibleThread,
  makeSendMessageInput,
  type ChatServiceSpecHarness,
} from '../test-support/chat-service-spec.harness.js';

type LifecycleEventCreateCall = [
  {
    data: {
      threadId?: string;
      eventType?: string;
      reason?: string;
      actorType?: string;
      actorUserId?: string | null;
      sourceDomain?: string;
      sourceActiveMatchId?: string | null;
      sourceMatchRequestId?: string | null;
      occurredAt?: Date;
      metadata?: Record<string, unknown> | null;
    };
  },
];

describe('send message command regression', () => {
  let appendChatThreadCreatedNotification: ChatServiceSpecHarness['appendChatThreadCreatedNotification'];
  let expectMessageCreateClientMessageId: ChatServiceSpecHarness['expectMessageCreateClientMessageId'];
  let prisma: ChatServiceSpecHarness['prisma'];
  let seasonParticipantsService: ChatServiceSpecHarness['seasonParticipantsService'];
  let seasonsService: ChatServiceSpecHarness['seasonsService'];
  let service: ChatServiceSpecHarness['service'];
  let txActiveMatchFindFirst: ChatServiceSpecHarness['txActiveMatchFindFirst'];
  let txChatRealtimeEventRecipientCreateMany: ChatServiceSpecHarness['txChatRealtimeEventRecipientCreateMany'];
  let txChatRealtimeOutboxEventCreate: ChatServiceSpecHarness['txChatRealtimeOutboxEventCreate'];
  let txConversationMessageCreate: ChatServiceSpecHarness['txConversationMessageCreate'];
  let txConversationMessageFindUnique: ChatServiceSpecHarness['txConversationMessageFindUnique'];
  let txConversationThreadLifecycleEventCreate: ChatServiceSpecHarness['txConversationThreadLifecycleEventCreate'];
  let txConversationThreadCreate: ChatServiceSpecHarness['txConversationThreadCreate'];
  let txConversationThreadFindFirst: ChatServiceSpecHarness['txConversationThreadFindFirst'];
  let txConversationThreadMemberCreateMany: ChatServiceSpecHarness['txConversationThreadMemberCreateMany'];
  let txConversationThreadMemberUpdateMany: ChatServiceSpecHarness['txConversationThreadMemberUpdateMany'];
  let txConversationThreadUpdate: ChatServiceSpecHarness['txConversationThreadUpdate'];
  let txQueryRawTyped: ChatServiceSpecHarness['txQueryRawTyped'];
  let txUserFindUnique: ChatServiceSpecHarness['txUserFindUnique'];

  beforeEach(() => {
    const harness = createChatServiceSpecHarness();
    ({
      appendChatThreadCreatedNotification,
      expectMessageCreateClientMessageId,
      prisma,
      seasonParticipantsService,
      seasonsService,
      service,
      txActiveMatchFindFirst,
      txChatRealtimeEventRecipientCreateMany,
      txChatRealtimeOutboxEventCreate,
      txConversationMessageCreate,
      txConversationMessageFindUnique,
      txConversationThreadLifecycleEventCreate,
      txConversationThreadCreate,
      txConversationThreadFindFirst,
      txConversationThreadMemberCreateMany,
      txConversationThreadMemberUpdateMany,
      txConversationThreadUpdate,
      txQueryRawTyped,
      txUserFindUnique,
    } = harness);
  });

  it('message command는 thread/message mutation 전에 pair와 participant advisory lock을 먼저 잡는다', async () => {
    await service.sendMessage(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      makeSendMessageInput('락 순서 검증', 'client-message-lock-order'),
    );

    expect(prisma.runSerializableTransaction).toHaveBeenCalledTimes(1);
    expect(txQueryRawTyped).toHaveBeenCalledTimes(3);
    const lockCallOrders = txQueryRawTyped.mock.invocationCallOrder;
    const firstMutationOrder = Math.min(
      txConversationThreadCreate.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
      txConversationMessageCreate.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(Math.max(...lockCallOrders)).toBeLessThan(firstMutationOrder);
  });
  it('send transaction 내부에서 participant 상태를 재조회해 hidden race를 차단한다', async () => {
    seasonParticipantsService.findCurrentSeasonParticipant
      .mockResolvedValueOnce(makeParticipant({ id: 'participant-2', userId: 'user-2' }))
      .mockResolvedValueOnce(makeParticipant({ id: 'participant-1', userId: 'user-1' }))
      .mockResolvedValueOnce(
        makeParticipant({
          id: 'participant-2',
          userId: 'user-2',
          hiddenByAdminAt: new Date('2026-02-10T03:00:00.000Z'),
        }),
      );

    await expect(
      service.sendMessage(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        makeSendMessageInput('hidden race 차단', 'client-message-policy-hidden-race'),
      ),
    ).rejects.toMatchObject({
      response: chatErrors.messageSendNotAllowed().getResponse(),
    });

    expect(txConversationThreadCreate).not.toHaveBeenCalled();
    expect(txConversationMessageCreate).not.toHaveBeenCalled();
  });
  it('send transaction 내부에서 target user를 재조회해 삭제 race를 차단한다', async () => {
    txUserFindUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === 'user-2'
          ? { ...makeUserSeed({ id: 'user-2' }), deletedAt: new Date('2026-02-10T03:00:00.000Z') }
          : { ...makeUserSeed({ id: where.id }), deletedAt: null },
      ),
    );

    await expect(
      service.sendMessage(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        makeSendMessageInput('삭제 race 차단', 'client-message-policy-deleted-race'),
      ),
    ).rejects.toMatchObject({
      response: chatErrors.messageSendNotAllowed().getResponse(),
    });

    expect(txConversationThreadCreate).not.toHaveBeenCalled();
    expect(txConversationMessageCreate).not.toHaveBeenCalled();
  });
  it('clientMessageId 없는 message command는 DB write 전에 거절한다', async () => {
    await expect(
      service.sendMessage(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        { targetUserId: 'user-2', body: '안녕하세요' } as never,
      ),
    ).rejects.toMatchObject({
      response: { code: 'CHAT_MESSAGE_CLIENT_MESSAGE_ID_REQUIRED' },
    });

    expect(txConversationThreadCreate).not.toHaveBeenCalled();
    expect(txConversationMessageCreate).not.toHaveBeenCalled();
  });
  it('1,000자를 초과하는 message command는 DB write 전에 거절한다', async () => {
    await expect(
      service.sendMessage(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        {
          targetUserId: 'user-2',
          body: `${'가'.repeat(1000)}!`,
          clientMessageId: 'client-message-1',
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'CHAT_MESSAGE_BODY_TOO_LONG' },
    });

    expect(txConversationThreadCreate).not.toHaveBeenCalled();
    expect(txConversationMessageCreate).not.toHaveBeenCalled();
  });
  it('같은 sender participant의 같은 clientMessageId와 같은 body는 기존 message로 수렴한다', async () => {
    const existingMessage = {
      id: 'message-existing',
      threadId: 'thread-1',
      body: '안녕하세요',
      bodyState: 'PLAIN',
      tombstoneReason: null,
      bodyVersion: 1,
      sentAt: new Date('2026-02-10T03:00:00.000Z'),
      senderParticipant: { userId: 'user-1' },
      thread: makeThread(),
    };
    txConversationThreadFindFirst.mockResolvedValue(makeThread());
    txConversationThreadUpdate.mockResolvedValue(makeThread());
    txConversationMessageFindUnique.mockResolvedValue(existingMessage);

    const result = await service.sendMessage(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      {
        targetUserId: 'user-2',
        body: '안녕하세요',
        clientMessageId: 'client-message-1',
      },
    );

    const messageLookupCalls = txConversationMessageFindUnique.mock.calls as Array<
      [
        {
          where?: {
            senderParticipantId_clientMessageId?: {
              senderParticipantId?: string;
              clientMessageId?: string;
            };
          };
        },
      ]
    >;
    expect(messageLookupCalls[0]?.[0].where?.senderParticipantId_clientMessageId).toEqual({
      senderParticipantId: 'participant-1',
      clientMessageId: 'client-message-1',
    });
    expect(txConversationMessageCreate).not.toHaveBeenCalled();
    expect(txChatRealtimeOutboxEventCreate).not.toHaveBeenCalled();
    expect(txChatRealtimeEventRecipientCreateMany).not.toHaveBeenCalled();
    expect(result.message.id).toBe('message-existing');
  });
  it('idempotent retry는 현재 thread가 READ_ONLY이면 기존 message를 반환하되 send 가능 상태를 false로 투영한다', async () => {
    const readOnlyThread = makeThread({
      status: 'READ_ONLY',
      closedReason: 'ROOM_SELECTION_CUTOFF',
    });
    txConversationThreadFindFirst.mockResolvedValue(readOnlyThread);
    txConversationMessageFindUnique.mockResolvedValue({
      id: 'message-existing',
      threadId: 'thread-1',
      body: '이미 저장된 메시지',
      bodyState: 'PLAIN',
      tombstoneReason: null,
      bodyVersion: 1,
      sentAt: new Date('2026-02-10T03:00:00.000Z'),
      senderParticipant: { userId: 'user-1' },
      thread: readOnlyThread,
    });

    const result = await service.sendMessage(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      {
        targetUserId: 'user-2',
        body: '이미 저장된 메시지',
        clientMessageId: 'client-message-read-only-idempotent',
      },
    );

    expect(txConversationMessageCreate).not.toHaveBeenCalled();
    expect(result.message.id).toBe('message-existing');
    expect(result.thread.canSendMessage).toBe(false);
    expect(result.thread.sendMessageUnavailableReason).toBe('THREAD_READ_ONLY');
  });
  it('idempotent retry라도 현재 thread가 ARCHIVED면 send command를 fail-closed로 거절한다', async () => {
    const archivedThread = makeThread({
      status: 'ARCHIVED',
      closedReason: 'SEASON_ENDED',
      closedAt: new Date('2026-02-10T03:00:00.000Z'),
    });
    txConversationMessageFindUnique.mockResolvedValue({
      id: 'message-existing',
      threadId: 'thread-1',
      body: '이미 저장된 메시지',
      bodyState: 'PLAIN',
      tombstoneReason: null,
      bodyVersion: 1,
      sentAt: new Date('2026-02-10T03:00:00.000Z'),
      senderParticipant: { userId: 'user-1' },
      thread: archivedThread,
    });

    await expect(
      service.sendMessage(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        {
          targetUserId: 'user-2',
          body: '이미 저장된 메시지',
          clientMessageId: 'client-message-archived-idempotent',
        },
      ),
    ).rejects.toMatchObject({
      response: chatErrors.messageSendNotAllowed().getResponse(),
    });

    expect(txConversationMessageCreate).not.toHaveBeenCalled();
  });
  it('같은 sender participant의 같은 clientMessageId와 다른 body는 409로 거절한다', async () => {
    txConversationThreadFindFirst.mockResolvedValue(makeThread());
    txConversationThreadUpdate.mockResolvedValue(makeThread());
    txConversationMessageFindUnique.mockResolvedValue({
      id: 'message-existing',
      threadId: 'thread-1',
      body: '기존 본문',
      bodyState: 'PLAIN',
      tombstoneReason: null,
      bodyVersion: 1,
      sentAt: new Date('2026-02-10T03:00:00.000Z'),
      senderParticipant: { userId: 'user-1' },
      thread: makeThread(),
    });

    await expect(
      service.sendMessage(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        {
          targetUserId: 'user-2',
          body: '새 본문',
          clientMessageId: 'client-message-1',
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'CHAT_MESSAGE_IDEMPOTENCY_CONFLICT' },
    });

    expect(txConversationMessageCreate).not.toHaveBeenCalled();
    expect(txChatRealtimeOutboxEventCreate).not.toHaveBeenCalled();
    expect(txChatRealtimeEventRecipientCreateMany).not.toHaveBeenCalled();
  });
  it('message commit은 outbox event와 recipient rows를 같은 transaction에 남긴다', async () => {
    await service.sendMessage(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      {
        targetUserId: 'user-2',
        body: '안녕하세요',
        clientMessageId: 'client-message-1',
      },
    );

    const outboxCreateCalls = txChatRealtimeOutboxEventCreate.mock.calls as Array<
      [{ data?: { eventType?: string; threadId?: string } }]
    >;
    expect(outboxCreateCalls[0]?.[0].data).toMatchObject({
      eventType: 'chat.message.created',
      threadId: 'thread-1',
    });

    const recipientCreateCalls = txChatRealtimeEventRecipientCreateMany.mock.calls as Array<
      [{ data?: Array<{ userId?: string }> }]
    >;
    expect(recipientCreateCalls[0]?.[0].data?.map((row) => row.userId)).toEqual(
      expect.arrayContaining(['user-1', 'user-2']),
    );
  });
  it('첫 메시지 전송 시 thread를 생성한다', async () => {
    const result = await service.sendMessage(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      makeSendMessageInput('안녕하세요', 'client-message-create-thread'),
    );

    expect(txConversationThreadCreate).toHaveBeenCalled();
    expect(txConversationThreadMemberCreateMany).toHaveBeenCalled();
    expect(txConversationMessageCreate).toHaveBeenCalled();
    expectMessageCreateClientMessageId('client-message-create-thread');
    expect(appendChatThreadCreatedNotification).toHaveBeenCalledWith(expect.any(Object), {
      threadId: 'thread-1',
      actorUserId: 'user-1',
      recipientUserId: 'user-2',
      occurredAt: new Date('2026-02-10T03:00:00.000Z'),
    });
    const lifecycleEventCreateCalls = txConversationThreadLifecycleEventCreate.mock
      .calls as unknown as LifecycleEventCreateCall[];
    const [threadCreatedLifecycleEvent] = lifecycleEventCreateCalls[0] ?? [];
    expect(threadCreatedLifecycleEvent?.data).toMatchObject({
      threadId: 'thread-1',
      eventType: ConversationThreadLifecycleEventType.THREAD_CREATED,
      reason: ConversationThreadLifecycleEventReason.DIRECT_MESSAGE_STARTED,
      actorType: ConversationThreadLifecycleActorType.USER,
      actorUserId: 'user-1',
      sourceDomain: ConversationThreadLifecycleSourceDomain.CHAT,
      occurredAt: new Date('2026-02-10T03:00:00.000Z'),
      metadata: {
        nextStatus: 'OPEN',
        nextThreadKind: 'DIRECT',
      },
    });
    expect(result.createdThread).toBe(true);
  });
  it('새 thread 알림 append 실패는 send transaction을 성공으로 숨기지 않는다', async () => {
    appendChatThreadCreatedNotification.mockRejectedValueOnce(
      new Error('notification append failed'),
    );

    await expect(
      service.sendMessage(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        makeSendMessageInput('안녕하세요', 'client-message-notification-rollback'),
      ),
    ).rejects.toThrow('notification append failed');

    expect(txConversationThreadCreate).toHaveBeenCalled();
    expect(txConversationMessageCreate).toHaveBeenCalled();
    expect(appendChatThreadCreatedNotification).toHaveBeenCalledWith(expect.any(Object), {
      threadId: 'thread-1',
      actorUserId: 'user-1',
      recipientUserId: 'user-2',
      occurredAt: new Date('2026-02-10T03:00:00.000Z'),
    });
  });
  it('같은 pair의 기존 thread를 재사용한다', async () => {
    txConversationThreadFindFirst.mockResolvedValue(makeThread());
    txConversationThreadUpdate.mockResolvedValue(makeThread());

    const result = await service.sendMessage(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      makeSendMessageInput('안녕하세요', 'client-message-reuse-thread'),
    );

    expect(txConversationThreadCreate).not.toHaveBeenCalled();
    expectMessageCreateClientMessageId('client-message-reuse-thread');
    expect(appendChatThreadCreatedNotification).not.toHaveBeenCalled();
    expect(txConversationThreadLifecycleEventCreate).not.toHaveBeenCalled();
    expect(result.createdThread).toBe(false);
  });
  it('ActiveMatchStatus ACTIVE relation이 있으면 direct thread를 matched context로 승격한다', async () => {
    txConversationThreadFindFirst.mockResolvedValue(makeThread());
    txActiveMatchFindFirst.mockResolvedValue({
      id: 'active-1',
      participantAId: 'participant-1',
      participantBId: 'participant-2',
      createdFromRequestId: 'request-1',
      startedAt: new Date('2026-02-10T03:00:00.000Z'),
      endedAt: null,
    });
    txConversationThreadUpdate.mockResolvedValue(
      makeThread({ threadKind: 'MATCHED', activeMatchId: 'active-1' }),
    );

    const result = await service.sendMessage(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      makeSendMessageInput('안녕하세요', 'client-message-active-match-upgrade'),
    );

    const [threadUpdateCall] = txConversationThreadUpdate.mock.calls as Array<
      [{ data: Record<string, unknown> }]
    >;
    expect(threadUpdateCall).toBeDefined();
    if (!threadUpdateCall) {
      throw new Error('Expected thread update call');
    }
    expect(threadUpdateCall[0]).toMatchObject({
      data: {
        threadKind: 'MATCHED',
        activeMatchId: 'active-1',
      },
    });
    const outboxCreateCalls = txChatRealtimeOutboxEventCreate.mock.calls as Array<
      [{ data?: { eventType?: string; payload?: Record<string, unknown> } }]
    >;
    expect(outboxCreateCalls.map((call) => call[0].data?.eventType)).toEqual(
      expect.arrayContaining(['chat.thread.updated', 'chat.message.created']),
    );
    expect(outboxCreateCalls[0]?.[0].data?.payload).toMatchObject({
      threadId: 'thread-1',
      status: 'OPEN',
    });
    expectMessageCreateClientMessageId('client-message-active-match-upgrade');
    expect(appendChatThreadCreatedNotification).not.toHaveBeenCalled();
    const lifecycleEventCreateCalls = txConversationThreadLifecycleEventCreate.mock
      .calls as unknown as LifecycleEventCreateCall[];
    const [threadKindChangedLifecycleEvent] = lifecycleEventCreateCalls[0] ?? [];
    expect(threadKindChangedLifecycleEvent?.data).toMatchObject({
      threadId: 'thread-1',
      eventType: ConversationThreadLifecycleEventType.THREAD_KIND_CHANGED,
      reason: ConversationThreadLifecycleEventReason.MATCH_REQUEST_ACCEPTED,
      actorType: ConversationThreadLifecycleActorType.USER,
      actorUserId: 'user-1',
      sourceDomain: ConversationThreadLifecycleSourceDomain.MATCHES,
      sourceActiveMatchId: 'active-1',
      sourceMatchRequestId: 'request-1',
      occurredAt: new Date('2026-02-10T03:00:00.000Z'),
      metadata: {
        previousThreadKind: 'DIRECT',
        nextThreadKind: 'MATCHED',
      },
    });
    expect(result.thread.threadKind).toBe('MATCHED');
  });
  it('비매칭 thread는 roomSelectionDate 이후 read-only가 된다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeThread({
        messages: [
          {
            id: 'message-1',
            body: '안녕하세요',
            sentAt: new Date('2026-02-10T03:00:00.000Z'),
            senderParticipant: { userId: 'user-1' },
          },
        ],
      }),
    );
    prisma.getDatabaseNow.mockResolvedValueOnce(new Date('2026-02-12T03:00:00.000Z'));
    prisma.conversationThread.update.mockResolvedValue(
      makeThread({ status: 'READ_ONLY', closedReason: 'ROOM_SELECTION_CUTOFF', messages: [] }),
    );

    const result = await service.getThreadDetail(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'thread-1',
    );

    expect(result.thread.status).toBe('READ_ONLY');
    expect(result.thread.canSendMessage).toBe(false);
    expect(result.thread.sendMessageUnavailableReason).toBe('THREAD_READ_ONLY');
    expect(result.thread.canReport).toBe(true);
    expect(prisma.conversationThread.update).not.toHaveBeenCalled();
  });
  it('READ_ONLY thread에 메시지를 보내려 하면 거부된다', async () => {
    txConversationThreadFindFirst.mockResolvedValue(
      makeVisibleThread({ threadKind: 'DIRECT', status: 'READ_ONLY' }),
    );

    await expect(
      service.sendMessage(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        makeSendMessageInput('안녕하세요', 'client-message-read-only-denied'),
      ),
    ).rejects.toMatchObject({
      response: chatErrors.messageSendNotAllowed().getResponse(),
    });
  });
  it('matched thread는 SEASON_POST_MATCH 동안 계속 쓰기 가능하다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeThread({
        threadKind: 'MATCHED',
        activeMatchId: 'active-1',
        activeMatch: {
          id: 'active-1',
          participantAId: 'participant-1',
          participantBId: 'participant-2',
          createdFromRequestId: 'request-1',
          startedAt: new Date('2026-02-10T03:00:00.000Z'),
          endedAt: null,
        },
        messages: [],
      }),
    );
    prisma.getDatabaseNow.mockResolvedValueOnce(new Date('2026-02-20T03:00:00.000Z'));
    const result = await service.getThreadDetail(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'thread-1',
    );

    expect(result.thread.status).toBe('OPEN');
    expect(result.thread.canSendMessage).toBe(true);
  });
  it('matched thread는 seasonEndDate를 지난 직후부터 read-only로 변경된다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeThread({
        threadKind: 'MATCHED',
        activeMatchId: 'active-1',
        activeMatch: {
          id: 'active-1',
          participantAId: 'participant-1',
          participantBId: 'participant-2',
          createdFromRequestId: 'request-1',
          startedAt: new Date('2026-02-10T03:00:00.000Z'),
          endedAt: null,
        },
        messages: [],
      }),
    );
    prisma.getDatabaseNow.mockResolvedValueOnce(new Date('2026-03-02T03:00:00.000Z'));
    seasonsService.getCurrentSeasonContext.mockResolvedValue(null);
    prisma.conversationThread.update.mockResolvedValue(
      makeThread({
        threadKind: 'MATCHED',
        activeMatchId: 'active-1',
        activeMatch: {
          id: 'active-1',
          participantAId: 'participant-1',
          participantBId: 'participant-2',
          createdFromRequestId: 'request-1',
          startedAt: new Date('2026-02-10T03:00:00.000Z'),
          endedAt: null,
        },
        status: 'READ_ONLY',
        closedReason: 'SEASON_ENDED',
        messages: [],
      }),
    );

    const result = await service.getThreadDetail(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'thread-1',
    );

    expect(result.thread.status).toBe('READ_ONLY');
    expect(result.thread.canReport).toBe(true);
  });
  it('matched thread는 seasonEndDate 당일 23:59:59(KST)까지는 OPEN 상태를 유지한다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeThread({
        threadKind: 'MATCHED',
        activeMatchId: 'active-1',
        activeMatch: {
          id: 'active-1',
          participantAId: 'participant-1',
          participantBId: 'participant-2',
          createdFromRequestId: 'request-1',
          startedAt: new Date('2026-02-10T03:00:00.000Z'),
          endedAt: null,
        },
        season: {
          ...makeThread().season,
          seasonEndDate: new Date('2026-08-31T00:00:00.000Z'),
        },
        messages: [],
      }),
    );
    prisma.getDatabaseNow.mockResolvedValueOnce(new Date('2026-08-31T14:59:59.000Z'));

    const result = await service.getThreadDetail(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'thread-1',
    );

    expect(result.thread.status).toBe('OPEN');
    expect(result.thread.canSendMessage).toBe(true);
  });
  it('matched thread는 seasonEndDate 다음 날 00:00:00(KST)부터 read-only가 된다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeThread({
        threadKind: 'MATCHED',
        activeMatchId: 'active-1',
        activeMatch: {
          id: 'active-1',
          participantAId: 'participant-1',
          participantBId: 'participant-2',
          createdFromRequestId: 'request-1',
          startedAt: new Date('2026-02-10T03:00:00.000Z'),
          endedAt: null,
        },
        season: {
          ...makeThread().season,
          seasonEndDate: new Date('2026-08-31T00:00:00.000Z'),
        },
        messages: [],
      }),
    );
    prisma.getDatabaseNow.mockResolvedValueOnce(new Date('2026-08-31T15:00:00.000Z'));
    prisma.conversationThread.update.mockResolvedValue(
      makeThread({
        threadKind: 'MATCHED',
        activeMatchId: 'active-1',
        activeMatch: {
          id: 'active-1',
          participantAId: 'participant-1',
          participantBId: 'participant-2',
          createdFromRequestId: 'request-1',
          startedAt: new Date('2026-02-10T03:00:00.000Z'),
          endedAt: null,
        },
        season: {
          ...makeThread().season,
          seasonEndDate: new Date('2026-08-31T00:00:00.000Z'),
        },
        status: 'READ_ONLY',
        closedReason: 'SEASON_ENDED',
        messages: [],
      }),
    );

    const result = await service.getThreadDetail(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'thread-1',
    );

    expect(result.thread.status).toBe('READ_ONLY');
    expect(result.thread.canSendMessage).toBe(false);
    expect(result.thread.sendMessageUnavailableReason).toBe('SEASON_ENDED');
  });
  it('OPEN thread에서 한 명이 나간 뒤 상대가 메시지를 보내면 LEFT 사용자는 ACTIVE로 복귀하고 새 메시지부터 본다', async () => {
    txConversationThreadFindFirst.mockResolvedValue(
      makeThread({
        members: [
          {
            participantId: 'participant-1',
            memberState: 'LEFT',
            leftAt: new Date('2026-02-10T03:00:00.000Z'),
            lastVisibleAt: null,
          },
          {
            participantId: 'participant-2',
            memberState: 'ACTIVE',
            leftAt: null,
            lastVisibleAt: null,
          },
        ],
        messages: [
          {
            id: 'message-old',
            body: '예전 메시지',
            sentAt: new Date('2026-02-10T02:00:00.000Z'),
            senderParticipant: { userId: 'user-1' },
          },
        ],
      }),
    );
    txConversationThreadUpdate.mockResolvedValue(
      makeThread({
        lastMessageAt: new Date('2026-02-10T03:00:00.000Z'),
        members: [
          {
            participantId: 'participant-1',
            memberState: 'ACTIVE',
            leftAt: null,
            lastVisibleAt: new Date('2026-02-10T03:00:00.000Z'),
          },
          {
            participantId: 'participant-2',
            memberState: 'ACTIVE',
            leftAt: null,
            lastVisibleAt: null,
          },
        ],
        messages: [
          {
            id: 'message-new',
            body: '복귀 후 첫 메시지',
            sentAt: new Date('2026-02-10T03:00:00.000Z'),
            senderParticipant: { userId: 'user-2' },
          },
        ],
      }),
    );
    txConversationThreadMemberUpdateMany.mockResolvedValue({ count: 1 });
    txConversationMessageCreate.mockResolvedValue({
      id: 'message-new',
      body: '복귀 후 첫 메시지',
      sentAt: new Date('2026-02-10T03:00:00.000Z'),
      senderParticipant: { userId: 'user-2' },
    });

    const sendResult = await service.sendMessage(
      {
        id: 'user-2',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      makeSendMessageInput('복귀 후 첫 메시지', 'client-message-left-reactivation', 'user-1'),
    );

    const [memberReactivateCall] = txConversationThreadMemberUpdateMany.mock.calls as Array<
      [{ data: Record<string, unknown> }]
    >;
    expect(memberReactivateCall).toBeDefined();
    if (!memberReactivateCall) {
      throw new Error('Expected member reactivation updateMany call');
    }
    expect(memberReactivateCall[0]).toMatchObject({
      data: {
        memberState: 'ACTIVE',
        lastVisibleAt: new Date('2026-02-10T03:00:00.000Z'),
      },
    });
    expectMessageCreateClientMessageId('client-message-left-reactivation');
    expect(sendResult.thread.status).toBe('OPEN');

    prisma.conversationThread.findFirst.mockResolvedValue(
      makeThread({
        messages: [
          {
            id: 'message-old',
            body: '예전 메시지',
            sentAt: new Date('2026-02-10T02:00:00.000Z'),
            senderParticipant: { userId: 'user-1' },
          },
          {
            id: 'message-new',
            body: '복귀 후 첫 메시지',
            sentAt: new Date('2026-02-10T03:00:00.000Z'),
            senderParticipant: { userId: 'user-2' },
          },
        ],
        members: [
          {
            participantId: 'participant-1',
            memberState: 'ACTIVE',
            leftAt: null,
            lastVisibleAt: new Date('2026-02-10T03:00:00.000Z'),
          },
          {
            participantId: 'participant-2',
            memberState: 'ACTIVE',
            leftAt: null,
            lastVisibleAt: null,
          },
        ],
      }),
    );

    const detail = await service.getThreadDetail(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'thread-1',
    );

    expect(detail.messages).toEqual([
      {
        id: 'message-new',
        senderUserId: 'user-2',
        body: '복귀 후 첫 메시지',
        sentAt: new Date('2026-02-10T03:00:00.000Z').toISOString(),
      },
    ]);
  });
  it('양쪽 모두 나가 archive된 이전 thread는 재사용하지 않고, 이후 첫 메시지에서 새 thread를 다시 생성한다', async () => {
    txConversationThreadFindFirst.mockResolvedValue(null);

    const result = await service.sendMessage(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      makeSendMessageInput('새 시즌이 아니어도 새 thread', 'client-message-archived-recreate'),
    );

    expect(result).toMatchObject({ createdThread: true });
    expectMessageCreateClientMessageId('client-message-archived-recreate');

    const [findArchivedExcludedCall] = txConversationThreadFindFirst.mock.calls as Array<
      [{ where: { status: { in: string[] } } }]
    >;
    expect(findArchivedExcludedCall).toBeDefined();
    if (!findArchivedExcludedCall) {
      throw new Error('Expected thread lookup call');
    }
    expect(findArchivedExcludedCall[0]).toMatchObject({
      where: {
        status: { in: ['OPEN', 'READ_ONLY'] },
      },
    });
    expect(txConversationThreadCreate).toHaveBeenCalled();
  });
});
