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
  makeThread,
  makeVisibleThread,
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
      occurredAt?: Date;
      metadata?: Record<string, unknown> | null;
    };
  },
];

describe('leave thread command regression', () => {
  let prisma: ChatServiceSpecHarness['prisma'];
  let seasonsService: ChatServiceSpecHarness['seasonsService'];
  let service: ChatServiceSpecHarness['service'];
  let txChatRealtimeOutboxEventCreate: ChatServiceSpecHarness['txChatRealtimeOutboxEventCreate'];
  let txConversationThreadLifecycleEventCreate: ChatServiceSpecHarness['txConversationThreadLifecycleEventCreate'];
  let txConversationThreadFindFirst: ChatServiceSpecHarness['txConversationThreadFindFirst'];
  let txConversationThreadMemberCount: ChatServiceSpecHarness['txConversationThreadMemberCount'];
  let txConversationThreadMemberUpdate: ChatServiceSpecHarness['txConversationThreadMemberUpdate'];
  let txConversationThreadUpdate: ChatServiceSpecHarness['txConversationThreadUpdate'];

  beforeEach(() => {
    const harness = createChatServiceSpecHarness();
    ({
      prisma,
      seasonsService,
      service,
      txChatRealtimeOutboxEventCreate,
      txConversationThreadLifecycleEventCreate,
      txConversationThreadFindFirst,
      txConversationThreadMemberCount,
      txConversationThreadMemberUpdate,
      txConversationThreadUpdate,
    } = harness);
  });

  it.each([
    { threadKind: 'DIRECT' as const, status: 'OPEN' as const },
    { threadKind: 'DIRECT' as const, status: 'READ_ONLY' as const },
    { threadKind: 'MATCHED' as const, status: 'OPEN' as const },
    { threadKind: 'MATCHED' as const, status: 'READ_ONLY' as const },
  ])(
    'archive가 아닌 visible thread(kind=$threadKind, status=$status)에서 한 명만 나가면 본인 UI에서만 숨겨지고 thread는 유지된다',
    async ({ threadKind, status }) => {
      prisma.conversationThread.findFirst.mockResolvedValue(
        makeVisibleThread({ threadKind, status }),
      );
      txConversationThreadFindFirst.mockResolvedValue(makeVisibleThread({ threadKind, status }));

      await expect(
        service.leaveThread(
          {
            id: 'user-1',
            gender: 'M',
            campus: 'CHUNCHEON',
          },
          'thread-1',
        ),
      ).resolves.toEqual({ threadId: 'thread-1', archived: false });

      expect(txConversationThreadMemberUpdate).toHaveBeenCalledWith({
        where: {
          threadId_participantId: {
            threadId: 'thread-1',
            participantId: 'participant-1',
          },
        },
        data: {
          memberState: 'LEFT',
          leftAt: new Date('2026-02-10T03:00:00.000Z'),
        },
      });
      const outboxCreateCalls = txChatRealtimeOutboxEventCreate.mock.calls as Array<
        [{ data?: { eventType?: string; payload?: Record<string, unknown> } }]
      >;
      expect(outboxCreateCalls.at(-1)?.[0].data).toMatchObject({
        eventType: 'chat.member.left',
        payload: {
          threadId: 'thread-1',
          participantId: 'participant-1',
          userId: 'user-1',
        },
      });
      expect(txConversationThreadLifecycleEventCreate).not.toHaveBeenCalled();
    },
  );
  it('leaveThread는 transaction 내부에서 member가 이미 LEFT가 된 race를 다시 확인해 거절한다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeVisibleThread({ threadKind: 'DIRECT', status: 'OPEN' }),
    );
    txConversationThreadFindFirst.mockResolvedValue(null);

    await expect(
      service.leaveThread(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'thread-1',
      ),
    ).rejects.toMatchObject({
      response: chatErrors.threadLeaveNotAllowed().getResponse(),
    });

    expect(txConversationThreadMemberUpdate).not.toHaveBeenCalled();
    expect(txChatRealtimeOutboxEventCreate).not.toHaveBeenCalled();
  });
  it('leaveThread는 transaction 내부 lifecycle sync 결과 ARCHIVED면 member leave를 남기지 않는다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeThread({ status: 'READ_ONLY', closedReason: 'SEASON_ENDED' }),
    );
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-2' },
      state: 'SEASON_OPEN',
      operatedDormitories: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2027-01-11' },
      ],
      schedule: {
        preparationStart: '2027-01-01',
        matchingStart: '2027-01-05',
        matchingEnd: '2027-01-11',
        seasonEnd: '2027-01-28',
      },
    });
    txConversationThreadFindFirst.mockResolvedValue(
      makeThread({ status: 'READ_ONLY', closedReason: 'SEASON_ENDED' }),
    );
    txConversationThreadUpdate.mockResolvedValue(
      makeThread({
        status: 'ARCHIVED',
        closedReason: 'SEASON_ENDED',
        closedAt: new Date('2026-02-10T03:00:00.000Z'),
      }),
    );

    await expect(
      service.leaveThread(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'thread-1',
      ),
    ).rejects.toMatchObject({
      response: chatErrors.threadLeaveNotAllowed().getResponse(),
    });

    expect(txConversationThreadMemberUpdate).not.toHaveBeenCalled();
    const outboxCreateCalls = txChatRealtimeOutboxEventCreate.mock.calls as Array<
      [{ data?: { eventType?: string } }]
    >;
    const outboxEventTypes = outboxCreateCalls.map((call) => call[0].data?.eventType);
    expect(outboxEventTypes).not.toContain('chat.member.left');
  });
  it.each([
    { threadKind: 'DIRECT' as const, status: 'OPEN' as const },
    { threadKind: 'DIRECT' as const, status: 'READ_ONLY' as const },
    { threadKind: 'MATCHED' as const, status: 'OPEN' as const },
    { threadKind: 'MATCHED' as const, status: 'READ_ONLY' as const },
  ])(
    'archive가 아닌 visible thread(kind=$threadKind, status=$status)에서 양쪽 모두 나가면 archive 된다',
    async ({ threadKind, status }) => {
      prisma.conversationThread.findFirst.mockResolvedValue(
        makeVisibleThread({ threadKind, status }),
      );
      txConversationThreadFindFirst.mockResolvedValue(makeVisibleThread({ threadKind, status }));
      txConversationThreadMemberCount.mockResolvedValue(0);

      await expect(
        service.leaveThread(
          {
            id: 'user-1',
            gender: 'M',
            campus: 'CHUNCHEON',
          },
          'thread-1',
        ),
      ).resolves.toEqual({ threadId: 'thread-1', archived: true });

      const threadUpdateCall = (
        txConversationThreadUpdate.mock.calls as Array<
          [{ where: { id: string }; data: Record<string, unknown> }]
        >
      ).find((call) => call[0].data.status === 'ARCHIVED');
      expect(threadUpdateCall).toBeDefined();
      if (!threadUpdateCall) {
        throw new Error('Expected archive thread update call');
      }
      expect(threadUpdateCall[0]).toMatchObject({
        where: { id: 'thread-1' },
        data: { status: 'ARCHIVED' },
      });
      const outboxCreateCalls = txChatRealtimeOutboxEventCreate.mock.calls as Array<
        [{ data?: { eventType?: string } }]
      >;
      expect(outboxCreateCalls.map((call) => call[0].data?.eventType)).toEqual(
        expect.arrayContaining(['chat.member.left', 'chat.thread.archived']),
      );
      const lifecycleEventCreateCalls = txConversationThreadLifecycleEventCreate.mock
        .calls as unknown as LifecycleEventCreateCall[];
      const [threadArchivedLifecycleEvent] = lifecycleEventCreateCalls[0] ?? [];
      expect(threadArchivedLifecycleEvent?.data).toMatchObject({
        threadId: 'thread-1',
        eventType: ConversationThreadLifecycleEventType.THREAD_ARCHIVED,
        reason: ConversationThreadLifecycleEventReason.BOTH_MEMBERS_LEFT,
        actorType: ConversationThreadLifecycleActorType.USER,
        actorUserId: 'user-1',
        sourceDomain: ConversationThreadLifecycleSourceDomain.CHAT,
        occurredAt: new Date('2026-02-10T03:00:00.000Z'),
        metadata: {
          previousThreadKind: threadKind,
          nextStatus: 'ARCHIVED',
        },
      });
    },
  );
});
