import { expect, vi } from 'vitest';
import { ChatService } from '../application/chat.service.js';
import { ChatSeasonLifecycleService } from '../lifecycle/chat-season-lifecycle.service.js';
import { ConversationThreadLifecycleEventRepository } from '../lifecycle-events/conversation-thread-lifecycle-event.repository.js';
import { ConversationThreadLifecycleEventWriter } from '../lifecycle-events/conversation-thread-lifecycle-event.writer.js';
import type {
  CanonicalSelectionState,
  CurrentSeasonParticipantRecord,
} from '../../season-participants/application/season-participants.service.js';

export type UserSeed = {
  id: string;
  emailVerifiedAt: Date | null;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  deletedAt: Date | null;
  profile: {
    lifestyle: Record<string, unknown>;
  } | null;
};

export const COMPLETE_LIFESTYLE = {
  bedtime: '22_24',
  wakeTime: '07_08',
  sleepHabit: 'NONE',
  sleepEnvironment: 'QUIET',
  screenUsage: 'NONE',
  noiseSensitivity: 'NORMAL',
  smokingBehavior: 'NO',
  indoorEating: 'SNACK',
  phoneBehavior: 'SOMETIMES',
  earphoneUsage: 'MOSTLY',
  cleanLevel: 'WEEKLY_3_UP',
  drinkingFrequency: 'NONE',
  relationshipStyle: 'CLOSE',
  temperatureSensitivity: 'NORMAL',
  smokingTolerance: 'NO_ONLY',
  indoorEatingTolerance: 'NO_SMELL',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'MUST',
  cleanExpectation: 'STRICT',
  drinkingTolerance: 'LOW_ONLY',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'LOW_OK',
} as const;

export function makeUserSeed(overrides: Partial<UserSeed> = {}): UserSeed {
  return {
    id: 'user-1',
    emailVerifiedAt: new Date('2026-02-01T00:00:00.000Z'),
    gender: 'M',
    campus: 'CHUNCHEON',
    deletedAt: null,
    profile: {
      lifestyle: COMPLETE_LIFESTYLE,
    },
    ...overrides,
  };
}

export function makeParticipant(
  overrides: Partial<CurrentSeasonParticipantRecord> = {},
): CurrentSeasonParticipantRecord {
  return {
    id: 'participant-1',
    seasonId: 'season-1',
    userId: 'user-1',
    participationIntent: 'REGISTERED',
    registeredAt: new Date('2026-02-01T00:00:00.000Z'),
    declinedAt: null,
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED',
    participantStatus: 'ACTIVE',
    campusCodeSnapshot: 'CHUNCHEON',
    genderSnapshot: 'M',
    joinedAt: new Date('2026-02-01T00:00:00.000Z'),
    activatedAt: new Date('2026-02-01T00:00:00.000Z'),
    matchedAt: null,
    withdrawnAt: null,
    expiredAt: null,
    hiddenByAdminAt: null,
    hiddenReasonCode: null,
    hiddenReasonDetail: null,
    deactivatedAt: null,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    profile: { participantId: 'participant-1', lifestyle: COMPLETE_LIFESTYLE } as never,
    ...overrides,
  };
}

export function makeThread(overrides: Record<string, unknown> = {}) {
  return {
    id: 'thread-1',
    seasonId: 'season-1',
    pairKey: 'participant-1:participant-2',
    participantAId: 'participant-1',
    participantBId: 'participant-2',
    openedByParticipantId: 'participant-1',
    threadKind: 'DIRECT',
    activeMatchId: null,
    status: 'OPEN',
    closedReason: null,
    closedAt: null,
    lastMessageAt: new Date('2026-02-10T03:00:00.000Z'),
    createdAt: new Date('2026-02-10T03:00:00.000Z'),
    updatedAt: new Date('2026-02-10T03:00:00.000Z'),
    season: {
      id: 'season-1',
      campusCode: 'CHUNCHEON',
      name: '2026-1',
      preparationStartDate: new Date('2026-02-01T00:00:00.000Z'),
      matchingStartDate: new Date('2026-02-05T00:00:00.000Z'),
      seasonEndDate: new Date('2026-02-28T00:00:00.000Z'),
      overrideState: null,
      overrideReason: null,
      overrideStartedAt: null,
      overrideEndsAt: null,
      dormitoryOperations: [
        {
          dormitoryId: 'dasan',
          isOperated: true,
          roomSelectionDate: new Date('2026-02-11T00:00:00.000Z'),
        },
      ],
    },
    participantA: {
      id: 'participant-1',
      userId: 'user-1',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
    },
    participantB: {
      id: 'participant-2',
      userId: 'user-2',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
    },
    activeMatch: null,
    members: [
      { participantId: 'participant-1', memberState: 'ACTIVE', leftAt: null, lastVisibleAt: null },
      { participantId: 'participant-2', memberState: 'ACTIVE', leftAt: null, lastVisibleAt: null },
    ],
    messages: [],
    ...overrides,
  };
}

export function makeVisibleThread(params: {
  threadKind: 'DIRECT' | 'MATCHED';
  status: 'OPEN' | 'READ_ONLY';
}) {
  return makeThread({
    threadKind: params.threadKind,
    status: params.status,
    activeMatch:
      params.threadKind === 'MATCHED'
        ? {
            id: 'active-1',
            participantAId: 'participant-1',
            participantBId: 'participant-2',
            createdFromRequestId: 'request-1',
            startedAt: new Date('2026-02-10T03:00:00.000Z'),
            endedAt: null,
          }
        : null,
    activeMatchId: params.threadKind === 'MATCHED' ? 'active-1' : null,
    closedReason: params.status === 'READ_ONLY' ? 'ROOM_SELECTION_CUTOFF' : null,
  });
}

type FutureSendConversationMessageRequest = {
  targetUserId: string;
  body: string;
  clientMessageId: string;
};

export function makeSendMessageInput(
  body: string,
  clientMessageId: string,
  targetUserId = 'user-2',
): FutureSendConversationMessageRequest {
  return { targetUserId, body, clientMessageId };
}

export function makeAuthUser(
  overrides: Partial<{
    id: string;
    gender: 'M' | 'F';
    campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  }> = {},
) {
  return {
    id: 'user-1',
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
    ...overrides,
  };
}

function createChatServiceSpecHarnessImpl() {
  const prismaQueryRawTyped = vi.fn();
  const txQueryRawTyped = vi.fn();
  const txUserFindUnique = vi.fn();
  const txConversationThreadFindFirst = vi.fn();
  const txConversationThreadCreate = vi.fn();
  const txConversationThreadUpdate = vi.fn();
  const txConversationThreadUpdateMany = vi.fn();
  const txConversationThreadMemberCreateMany = vi.fn();
  const txConversationThreadMemberUpdate = vi.fn();
  const txConversationThreadMemberUpdateMany = vi.fn();
  const txConversationThreadMemberCount = vi.fn();
  const txConversationThreadMemberFindUnique = vi.fn();
  const txConversationMessageFindUnique = vi.fn();
  const txConversationMessageFindFirst = vi.fn();
  const txConversationMessageCreate = vi.fn();
  const txChatRealtimeOutboxEventCreate = vi.fn();
  const txChatRealtimeEventRecipientCreateMany = vi.fn();
  const txConversationThreadLifecycleEventCreate = vi.fn();
  const txActiveMatchFindFirst = vi.fn();
  const prismaUserBlockFindFirst = vi.fn();
  const txUserBlockFindFirst = vi.fn();
  const appendChatThreadCreatedNotification = vi.fn();

  const prisma = {
    $queryRawTyped: prismaQueryRawTyped,
    getDatabaseNow: vi.fn(),
    runSerializableTransaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
    },
    activeMatch: {
      findFirst: vi.fn(),
    },
    userBlock: {
      findFirst: prismaUserBlockFindFirst,
    },
    conversationThread: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
  const seasonsService = {
    getCurrentSeasonContext: vi.fn(),
  };
  const seasonParticipantsService = {
    ensureCurrentSeasonParticipant: vi.fn(),
    findCurrentSeasonParticipant: vi.fn(),
    selectCanonicalSelection: vi.fn(),
    pickCurrentSeasonParticipant: vi.fn(),
    hasRegistrationSnapshotForParticipant: vi.fn(),
  };

  const conversationThreadLifecycleEventWriter = new ConversationThreadLifecycleEventWriter(
    new ConversationThreadLifecycleEventRepository(),
  );

  const chatSeasonLifecycle = new ChatSeasonLifecycleService(
    prisma as never,
    seasonsService as never,
    seasonParticipantsService as never,
    conversationThreadLifecycleEventWriter,
  );

  const service = new ChatService(
    prisma as never,
    seasonsService as never,
    seasonParticipantsService as never,
    chatSeasonLifecycle,
    {
      appendChatThreadCreated: appendChatThreadCreatedNotification,
    },
    conversationThreadLifecycleEventWriter,
  );

  function expectMessageCreateClientMessageId(expectedClientMessageId: string) {
    const messageCreateCalls = txConversationMessageCreate.mock.calls as Array<
      [{ data?: { clientMessageId?: string } }]
    >;
    expect(messageCreateCalls.at(-1)?.[0].data?.clientMessageId).toBe(expectedClientMessageId);
  }

  prisma.getDatabaseNow.mockResolvedValue(new Date('2026-02-10T03:00:00.000Z'));
  seasonsService.getCurrentSeasonContext.mockResolvedValue({
    season: { id: 'season-1' },
    state: 'SEASON_MATCHING',
    operatedDormitories: [
      { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
    ],
    schedule: {
      preparationStart: '2026-02-01',
      matchingStart: '2026-02-05',
      matchingEnd: '2026-02-11',
      seasonEnd: '2026-02-28',
    },
  });
  prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
    Promise.resolve(
      where.id === 'user-2' ? makeUserSeed({ id: 'user-2' }) : makeUserSeed({ id: where.id }),
    ),
  );
  seasonParticipantsService.ensureCurrentSeasonParticipant.mockImplementation((user: UserSeed) =>
    Promise.resolve(
      user.id === 'user-2'
        ? makeParticipant({ id: 'participant-2', userId: 'user-2' })
        : makeParticipant({ id: 'participant-1', userId: user.id }),
    ),
  );
  seasonParticipantsService.findCurrentSeasonParticipant.mockImplementation((userId: string) =>
    Promise.resolve(
      userId === 'user-2'
        ? makeParticipant({ id: 'participant-2', userId: 'user-2' })
        : makeParticipant({ id: 'participant-1', userId }),
    ),
  );
  seasonParticipantsService.selectCanonicalSelection.mockImplementation(
    (
      participant: Pick<CanonicalSelectionState, 'dormitoryId' | 'dormitorySelectionState'> | null,
    ): CanonicalSelectionState => ({
      dormitoryId: participant?.dormitoryId ?? null,
      dormitorySelectionState: participant?.dormitorySelectionState ?? 'NOT_SELECTED',
      source: 'SEASON_PARTICIPANT',
    }),
  );
  seasonParticipantsService.pickCurrentSeasonParticipant.mockImplementation(
    (participants: CurrentSeasonParticipantRecord[] | null | undefined) =>
      participants?.[0] ?? null,
  );
  seasonParticipantsService.hasRegistrationSnapshotForParticipant.mockResolvedValue(true);
  prisma.activeMatch.findFirst.mockResolvedValue(null);
  prismaUserBlockFindFirst.mockResolvedValue(null);
  txUserBlockFindFirst.mockResolvedValue(null);
  prisma.conversationThread.count.mockResolvedValue(0);
  prisma.conversationThread.findFirst.mockResolvedValue(null);
  prisma.conversationThread.findMany.mockResolvedValue([]);
  prisma.conversationThread.update.mockResolvedValue(
    makeThread({ status: 'READ_ONLY', closedReason: 'ROOM_SELECTION_CUTOFF' }),
  );
  txQueryRawTyped.mockResolvedValue([{ lockAcquired: null }]);
  txUserFindUnique.mockImplementation(({ where }: { where: { id: string } }) =>
    Promise.resolve(
      where.id === 'user-2' ? makeUserSeed({ id: 'user-2' }) : makeUserSeed({ id: where.id }),
    ),
  );
  txConversationThreadFindFirst.mockImplementation(({ where }: { where?: { id?: string } }) =>
    Promise.resolve(
      where?.id ? makeVisibleThread({ threadKind: 'DIRECT', status: 'READ_ONLY' }) : null,
    ),
  );
  txConversationThreadCreate.mockResolvedValue(makeThread());
  txConversationThreadUpdate.mockResolvedValue(
    makeThread({ threadKind: 'MATCHED', activeMatchId: 'active-1' }),
  );
  txConversationThreadUpdateMany.mockResolvedValue({ count: 1 });
  txConversationThreadMemberCreateMany.mockResolvedValue({ count: 2 });
  txConversationThreadMemberUpdate.mockResolvedValue(undefined);
  txConversationThreadMemberUpdateMany.mockResolvedValue({ count: 1 });
  txConversationThreadMemberCount.mockResolvedValue(1);
  txConversationThreadMemberFindUnique.mockResolvedValue({
    memberState: 'ACTIVE',
    lastReadMessageId: 'message-current',
  });
  txConversationMessageCreate.mockResolvedValue({
    id: 'message-1',
    threadId: 'thread-1',
    body: '안녕하세요',
    bodyState: 'PLAIN',
    tombstoneReason: null,
    bodyVersion: 1,
    sentAt: new Date('2026-02-10T03:00:00.000Z'),
    senderParticipant: { userId: 'user-1' },
  });
  txConversationMessageFindUnique.mockResolvedValue(null);
  txConversationMessageFindFirst.mockResolvedValue(null);
  txChatRealtimeOutboxEventCreate.mockResolvedValue({ id: 'event-1' });
  txChatRealtimeEventRecipientCreateMany.mockResolvedValue({ count: 2 });
  txConversationThreadLifecycleEventCreate.mockResolvedValue({ id: 'thread-lifecycle-event-1' });
  appendChatThreadCreatedNotification.mockResolvedValue({
    notificationId: 'notification-1',
    created: true,
  });
  txActiveMatchFindFirst.mockResolvedValue(null);
  prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
    callback({
      $queryRawTyped: txQueryRawTyped,
      user: {
        findUnique: txUserFindUnique,
      },
      conversationThread: {
        findFirst: txConversationThreadFindFirst,
        create: txConversationThreadCreate,
        update: txConversationThreadUpdate,
        updateMany: txConversationThreadUpdateMany,
      },
      conversationThreadMember: {
        createMany: txConversationThreadMemberCreateMany,
        update: txConversationThreadMemberUpdate,
        updateMany: txConversationThreadMemberUpdateMany,
        count: txConversationThreadMemberCount,
        findUnique: txConversationThreadMemberFindUnique,
      },
      conversationMessage: {
        findUnique: txConversationMessageFindUnique,
        findFirst: txConversationMessageFindFirst,
        create: txConversationMessageCreate,
      },
      chatRealtimeOutboxEvent: {
        create: txChatRealtimeOutboxEventCreate,
      },
      chatRealtimeEventRecipient: {
        createMany: txChatRealtimeEventRecipientCreateMany,
      },
      conversationThreadLifecycleEvent: {
        create: txConversationThreadLifecycleEventCreate,
      },
      activeMatch: {
        findFirst: txActiveMatchFindFirst,
      },
      userBlock: {
        findFirst: txUserBlockFindFirst,
      },
    }),
  );

  return {
    appendChatThreadCreatedNotification,
    chatSeasonLifecycle,
    conversationThreadLifecycleEventWriter,
    expectMessageCreateClientMessageId,
    prisma,
    prismaQueryRawTyped,
    prismaUserBlockFindFirst,
    seasonParticipantsService,
    seasonsService,
    service,
    txActiveMatchFindFirst,
    txChatRealtimeEventRecipientCreateMany,
    txChatRealtimeOutboxEventCreate,
    txConversationThreadLifecycleEventCreate,
    txConversationMessageCreate,
    txConversationMessageFindFirst,
    txConversationMessageFindUnique,
    txConversationThreadCreate,
    txConversationThreadFindFirst,
    txConversationThreadMemberCount,
    txConversationThreadMemberCreateMany,
    txConversationThreadMemberFindUnique,
    txConversationThreadMemberUpdate,
    txConversationThreadMemberUpdateMany,
    txConversationThreadUpdate,
    txConversationThreadUpdateMany,
    txQueryRawTyped,
    txUserBlockFindFirst,
    txUserFindUnique,
  };
}

export type ChatServiceSpecHarness = ReturnType<typeof createChatServiceSpecHarnessImpl>;

export function createChatServiceSpecHarness(): ChatServiceSpecHarness {
  return createChatServiceSpecHarnessImpl();
}
