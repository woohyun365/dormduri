import { ChatService } from './chat.service.js';
import { chatErrors } from './chat.errors.js';
import type {
  CanonicalSelectionState,
  CurrentSeasonParticipantRecord,
} from '../season-participants/season-participants.service.js';

type UserSeed = {
  id: string;
  emailVerifiedAt: Date | null;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  deletedAt: Date | null;
  profile: {
    lifestyle: Record<string, unknown>;
  } | null;
};

const COMPLETE_LIFESTYLE = {
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

function makeUserSeed(overrides: Partial<UserSeed> = {}): UserSeed {
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

function makeParticipant(
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

function makeThread(overrides: Record<string, unknown> = {}) {
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

function makeVisibleThread(params: {
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

function makeSendMessageInput(
  body: string,
  clientMessageId: string,
  targetUserId = 'user-2',
): FutureSendConversationMessageRequest {
  return { targetUserId, body, clientMessageId };
}

describe('ChatService', () => {
  const prismaQueryRaw = jest.fn();
  const txQueryRawTyped = jest.fn();
  const txUserFindUnique = jest.fn();
  const txConversationThreadFindFirst = jest.fn();
  const txConversationThreadCreate = jest.fn();
  const txConversationThreadUpdate = jest.fn();
  const txConversationThreadUpdateMany = jest.fn();
  const txConversationThreadMemberCreateMany = jest.fn();
  const txConversationThreadMemberUpdate = jest.fn();
  const txConversationThreadMemberUpdateMany = jest.fn();
  const txConversationThreadMemberCount = jest.fn();
  const txConversationThreadMemberFindUnique = jest.fn();
  const txConversationMessageFindUnique = jest.fn();
  const txConversationMessageFindFirst = jest.fn();
  const txConversationMessageCreate = jest.fn();
  const txChatRealtimeOutboxEventCreate = jest.fn();
  const txChatRealtimeEventRecipientCreateMany = jest.fn();
  const txActiveMatchFindFirst = jest.fn();

  const prisma = {
    $queryRaw: prismaQueryRaw,
    getDatabaseNow: jest.fn(),
    runSerializableTransaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
    },
    activeMatch: {
      findFirst: jest.fn(),
    },
    conversationThread: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const seasonsService = {
    getCurrentSeasonContext: jest.fn(),
  };
  const seasonParticipantsService = {
    ensureCurrentSeasonParticipant: jest.fn(),
    findCurrentSeasonParticipant: jest.fn(),
    selectCanonicalSelection: jest.fn(),
    pickCurrentSeasonParticipant: jest.fn(),
    hasRegistrationSnapshotForParticipant: jest.fn(),
  };

  const service = new ChatService(
    prisma as never,
    seasonsService as never,
    seasonParticipantsService as never,
  );

  function expectMessageCreateClientMessageId(expectedClientMessageId: string) {
    const messageCreateCalls = txConversationMessageCreate.mock.calls as Array<
      [{ data?: { clientMessageId?: string } }]
    >;
    expect(messageCreateCalls.at(-1)?.[0].data?.clientMessageId).toBe(expectedClientMessageId);
  }

  beforeEach(() => {
    jest.clearAllMocks();
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
        participant: Pick<
          CanonicalSelectionState,
          'dormitoryId' | 'dormitorySelectionState'
        > | null,
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
        activeMatch: {
          findFirst: txActiveMatchFindFirst,
        },
      }),
    );
  });

  it('채팅 UI entry는 thread를 생성하지 않는다', async () => {
    const result = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'user-2',
    );

    expect(result).toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: true,
      canSendMessage: true,
    });
    expect(prisma.conversationThread.findFirst).toHaveBeenCalled();
    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
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

  it('시즌 참여자라도 UNASSIGNED면 같은 건물 사용자에 대한 채팅 UI entry와 send가 모두 닫힌다', async () => {
    seasonParticipantsService.ensureCurrentSeasonParticipant.mockImplementation((user: UserSeed) =>
      Promise.resolve(
        user.id === 'user-2'
          ? makeParticipant({ id: 'participant-2', userId: 'user-2' })
          : makeParticipant({
              id: 'participant-1',
              userId: user.id,
              dormitoryId: null,
              dormitorySelectionState: 'NOT_SELECTED',
              participantStatus: 'DRAFT',
            }),
      ),
    );
    seasonParticipantsService.selectCanonicalSelection.mockReturnValue({
      dormitoryId: null,
      dormitorySelectionState: 'UNASSIGNED',
      source: 'SEASON_PARTICIPANT',
    });

    const entry = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'user-2',
    );
    expect(entry).toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: false,
      canSendMessage: false,
    });

    await expect(
      service.sendMessage(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        makeSendMessageInput('안녕하세요', 'client-message-policy-unassigned'),
      ),
    ).rejects.toMatchObject({
      response: chatErrors.messageSendNotAllowed().getResponse(),
    });
  });

  it('시즌 참여자라도 ASSIGNED 사용자는 다른 건물 사용자에게 채팅 UI entry와 send가 모두 닫힌다', async () => {
    seasonParticipantsService.findCurrentSeasonParticipant.mockResolvedValue(
      makeParticipant({
        id: 'participant-2',
        userId: 'user-2',
        dormitoryId: 'other-dorm',
        dormitorySelectionState: 'ASSIGNED',
      }),
    );

    const entry = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'user-2',
    );

    expect(entry).toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: false,
      canSendMessage: false,
    });

    await expect(
      service.sendMessage(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        makeSendMessageInput(
          '다른 건물 사용자에게 보낼 수 없음',
          'client-message-policy-dormitory',
        ),
      ),
    ).rejects.toMatchObject({
      response: chatErrors.messageSendNotAllowed().getResponse(),
    });
  });

  it('시즌 참여 + ASSIGNED + 같은 건물 사용자면 채팅 UI entry와 send가 모두 열린다', async () => {
    const entry = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'user-2',
    );

    expect(entry).toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: true,
      canSendMessage: true,
    });

    await expect(
      service.sendMessage(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        makeSendMessageInput('안녕하세요', 'client-message-entry-open'),
      ),
    ).resolves.toMatchObject({ createdThread: true });
    expectMessageCreateClientMessageId('client-message-entry-open');
  });

  it('live ActiveMatch가 없으면 stale MATCHED target도 채팅 후보로 유지한다', async () => {
    seasonParticipantsService.findCurrentSeasonParticipant.mockResolvedValue(
      makeParticipant({
        id: 'participant-2',
        userId: 'user-2',
        participantStatus: 'MATCHED',
        matchedAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
    );

    const entry = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'user-2',
    );

    expect(entry).toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: true,
      canSendMessage: true,
    });
  });

  it('SEASON_POST_MATCH에서 live ActiveMatch 사용자는 다른 일반 target과의 새 chat entry를 열 수 없다', async () => {
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
      state: 'SEASON_POST_MATCH',
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
    prisma.activeMatch.findFirst
      .mockResolvedValueOnce({
        id: 'active-1',
        participantAId: 'participant-1',
        participantBId: 'participant-3',
        createdFromRequestId: 'request-1',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: null,
      })
      .mockResolvedValueOnce(null);

    const entry = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'user-2',
    );

    expect(entry).toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: false,
      canSendMessage: false,
    });
  });

  it('상대가 시즌 참여자라도 ASSIGNED가 아니면 같은 캠퍼스/성별이어도 채팅 UI entry와 send가 모두 닫힌다', async () => {
    seasonParticipantsService.findCurrentSeasonParticipant.mockResolvedValue(
      makeParticipant({
        id: 'participant-2',
        userId: 'user-2',
        dormitoryId: null,
        dormitorySelectionState: 'UNASSIGNED',
        participantStatus: 'DRAFT',
      }),
    );
    seasonParticipantsService.selectCanonicalSelection.mockImplementation(
      (
        participant: Pick<
          CanonicalSelectionState,
          'dormitoryId' | 'dormitorySelectionState'
        > | null,
      ): CanonicalSelectionState => ({
        dormitoryId: participant?.dormitoryId ?? null,
        dormitorySelectionState: participant?.dormitorySelectionState ?? 'NOT_SELECTED',
        source: 'SEASON_PARTICIPANT',
      }),
    );

    const entry = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'user-2',
    );

    expect(entry).toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: false,
      canSendMessage: false,
    });
  });

  it('target registration snapshot이 없으면 등록/배정 상태여도 새 채팅 entry와 send를 닫는다', async () => {
    seasonParticipantsService.hasRegistrationSnapshotForParticipant.mockResolvedValueOnce(false);

    const entry = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'user-2',
    );

    expect(entry).toEqual({
      targetUserId: 'user-2',
      thread: null,
      canEnterChatUi: false,
      canSendMessage: false,
    });

    seasonParticipantsService.hasRegistrationSnapshotForParticipant.mockResolvedValueOnce(false);

    await expect(
      service.sendMessage(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        makeSendMessageInput('registration snapshot 없는 target', 'client-message-policy-snapshot'),
      ),
    ).rejects.toMatchObject({
      response: chatErrors.messageSendNotAllowed().getResponse(),
    });

    expect(txConversationThreadCreate).not.toHaveBeenCalled();
    expect(txConversationMessageCreate).not.toHaveBeenCalled();
  });

  it('target participant는 chat entry 준비 중 ensure/upsert하지 않고 기존 SeasonParticipant만 조회한다', async () => {
    seasonParticipantsService.findCurrentSeasonParticipant.mockResolvedValueOnce(null);

    await expect(
      service.getThreadEntry(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'user-2',
      ),
    ).rejects.toMatchObject({
      response: chatErrors.threadTargetNotFound().getResponse(),
    });

    expect(seasonParticipantsService.ensureCurrentSeasonParticipant).toHaveBeenCalledTimes(1);
    expect(seasonParticipantsService.ensureCurrentSeasonParticipant).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      expect.any(Date),
    );
    expect(seasonParticipantsService.findCurrentSeasonParticipant).toHaveBeenCalledWith(
      'user-2',
      'season-1',
      undefined,
    );
    expect(prisma.conversationThread.findFirst).not.toHaveBeenCalled();
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
        } as never,
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
      } as never,
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
      } as never,
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
        } as never,
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
        } as never,
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
      } as never,
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

  it('read marker는 현재 위치가 없으면 지정한 메시지로 전진한다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeVisibleThread({ threadKind: 'DIRECT', status: 'READ_ONLY' }),
    );
    txConversationThreadMemberFindUnique.mockResolvedValue({
      memberState: 'ACTIVE',
      lastReadMessageId: null,
    });
    txConversationMessageFindFirst.mockResolvedValueOnce({
      id: 'message-new',
      sentAt: new Date('2026-02-10T02:00:00.000Z'),
    });

    const result = await service.updateReadMarker(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'thread-1',
      { lastReadMessageId: 'message-new' },
    );

    expect(txConversationThreadMemberUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          threadId_participantId: {
            threadId: 'thread-1',
            participantId: 'participant-1',
          },
        },
        data: {
          lastReadAt: new Date('2026-02-10T03:00:00.000Z'),
          lastReadMessageId: 'message-new',
        },
      }),
    );
    expect(result).toMatchObject({
      threadId: 'thread-1',
      lastReadMessageId: 'message-new',
      lastReadAt: '2026-02-10T03:00:00.000Z',
    });
    const outboxCreateCalls = txChatRealtimeOutboxEventCreate.mock.calls as Array<
      [{ data?: { eventType?: string; payload?: Record<string, unknown> } }]
    >;
    expect(outboxCreateCalls.at(-1)?.[0].data).toMatchObject({
      eventType: 'chat.read_marker.updated',
      payload: {
        threadId: 'thread-1',
        lastReadMessageId: 'message-new',
      },
    });
    const recipientCreateCalls = txChatRealtimeEventRecipientCreateMany.mock.calls as Array<
      [{ data?: Array<{ userId?: string }> }]
    >;
    expect(recipientCreateCalls.at(-1)?.[0].data).toEqual([
      expect.objectContaining({ userId: 'user-1' }),
    ]);
  });

  it('read marker는 transaction 내부 lifecycle sync 결과 ARCHIVED가 된 thread를 갱신하지 않는다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeThread({ status: 'READ_ONLY', closedReason: 'SEASON_ENDED' }),
    );
    seasonsService.getCurrentSeasonContext
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
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
      service.updateReadMarker(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'thread-1',
        { lastReadMessageId: 'message-new' },
      ),
    ).rejects.toMatchObject({
      response: chatErrors.threadNotFound().getResponse(),
    });
    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    expect(txConversationThreadMemberUpdate).not.toHaveBeenCalled();
    const outboxEventTypes = txChatRealtimeOutboxEventCreate.mock.calls.map(
      (call: [{ data?: { eventType?: string } }]) => call[0].data?.eventType,
    );
    expect(outboxEventTypes).not.toContain('chat.read_marker.updated');
  });

  it('read marker는 뒤로 이동할 수 없다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeVisibleThread({ threadKind: 'DIRECT', status: 'READ_ONLY' }),
    );
    txConversationMessageFindFirst
      .mockResolvedValueOnce({
        id: 'message-old',
        sentAt: new Date('2026-02-10T01:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'message-current',
        sentAt: new Date('2026-02-10T02:00:00.000Z'),
      });

    const candidate = service as unknown as {
      updateReadMarker?: (
        authUser: { id: string; gender: 'M'; campus: 'CHUNCHEON' },
        threadId: string,
        input: { lastReadMessageId: string },
      ) => Promise<unknown>;
    };

    expect(candidate.updateReadMarker).toEqual(expect.any(Function));

    if (!candidate.updateReadMarker) {
      throw new Error('ChatService.updateReadMarker must be implemented');
    }

    await expect(
      candidate.updateReadMarker(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'thread-1',
        { lastReadMessageId: 'message-old' },
      ),
    ).rejects.toMatchObject({
      response: { code: 'CHAT_READ_MARKER_CANNOT_MOVE_BACKWARD' },
    });
  });

  it('replayRealtimeEvents는 authenticated user recipient event만 계약 envelope로 반환한다', async () => {
    prismaQueryRaw.mockResolvedValueOnce([
      {
        eventId: 'event-1',
        cursor: 'event-1:user-1',
        eventType: 'chat.read_marker.updated',
        schemaVersion: 1,
        threadId: 'thread-1',
        payload: {
          threadId: 'thread-1',
          lastReadMessageId: 'message-1',
        },
        occurredAt: new Date('2026-02-10T03:00:00.000Z'),
        recipientCreatedAt: new Date('2026-02-10T03:00:00.000Z'),
      },
    ]);

    await expect(
      service.replayRealtimeEvents(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        { after: null, limit: 10 },
      ),
    ).resolves.toEqual({
      ok: true,
      events: [
        {
          schemaVersion: 1,
          eventId: 'event-1',
          eventType: 'chat.read_marker.updated',
          occurredAt: '2026-02-10T03:00:00.000Z',
          cursor: 'event-1:user-1',
          threadId: 'thread-1',
          payload: {
            threadId: 'thread-1',
            lastReadMessageId: 'message-1',
          },
        },
      ],
      nextCursor: 'event-1:user-1',
      hasMore: false,
    });
  });

  it('replayRealtimeEvents는 지원하지 않는 schema/event type이면 resync required로 수렴한다', async () => {
    prismaQueryRaw.mockResolvedValueOnce([
      {
        eventId: 'event-unsupported',
        cursor: 'event-unsupported:user-1',
        eventType: 'chat.unknown',
        schemaVersion: 1,
        threadId: 'thread-1',
        payload: {},
        occurredAt: new Date('2026-02-10T03:00:00.000Z'),
        recipientCreatedAt: new Date('2026-02-10T03:00:00.000Z'),
      },
    ]);

    await expect(
      service.replayRealtimeEvents(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        { after: null, limit: 10 },
      ),
    ).resolves.toEqual({
      ok: false,
      reason: 'SCHEMA_UNSUPPORTED',
      resyncRequired: true,
    });
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
    expect(result.createdThread).toBe(true);
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
    expect(result.thread.threadKind).toBe('MATCHED');
  });

  it('ACTIVE 생성 시 다른 non-matched thread를 read-only로 전환한다', async () => {
    await service.handleActiveMatchCreated(
      {
        $queryRawTyped: txQueryRawTyped,
        user: {
          findUnique: txUserFindUnique,
        },
        conversationThread: {
          findFirst: jest.fn(),
          findMany: jest
            .fn()
            .mockResolvedValueOnce([{ id: 'thread-other' }])
            .mockResolvedValueOnce([
              makeThread({
                id: 'thread-other',
                status: 'READ_ONLY',
                closedReason: 'ACTIVE_MATCH_CREATED',
                closedAt: new Date('2026-02-10T03:00:00.000Z'),
              }),
            ]),
          update: txConversationThreadUpdate,
          updateMany: txConversationThreadUpdateMany,
        },
      } as never,
      {
        seasonId: 'season-1',
        pairKey: 'participant-1:participant-2',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        activeMatchId: 'active-1',
      },
      new Date('2026-02-10T03:00:00.000Z'),
    );

    const [threadUpdateManyCall] = txConversationThreadUpdateMany.mock.calls as Array<
      [{ data: Record<string, unknown> }]
    >;
    expect(threadUpdateManyCall).toBeDefined();
    if (!threadUpdateManyCall) {
      throw new Error('Expected thread updateMany call');
    }
    expect(threadUpdateManyCall[0]).toMatchObject({
      data: {
        status: 'READ_ONLY',
        closedReason: 'ACTIVE_MATCH_CREATED',
      },
    });
  });

  it('UNMATCHED가 되면 matched thread는 direct thread로 내려가고 roomSelectionDate 전이면 OPEN을 유지한다', async () => {
    txConversationThreadFindFirst.mockResolvedValue(
      makeVisibleThread({ threadKind: 'MATCHED', status: 'OPEN' }),
    );

    await service.handleActiveMatchUnmatched(
      {
        conversationThread: {
          findFirst: txConversationThreadFindFirst,
          update: txConversationThreadUpdate,
        },
      } as never,
      { activeMatchId: 'active-1' },
      new Date('2026-02-10T03:00:00.000Z'),
    );

    const [threadUpdateCall] = txConversationThreadUpdate.mock.calls as Array<
      [{ data: Record<string, unknown> }]
    >;
    expect(threadUpdateCall).toBeDefined();
    if (!threadUpdateCall) {
      throw new Error('Expected thread downgrade update call');
    }
    expect(threadUpdateCall[0]).toMatchObject({
      data: {
        threadKind: 'DIRECT',
        activeMatchId: null,
        status: 'OPEN',
        closedReason: null,
        closedAt: null,
      },
    });
  });

  it('UNMATCHED thread downgrade는 thread updated outbox event를 남긴다', async () => {
    txConversationThreadFindFirst.mockResolvedValue(
      makeVisibleThread({ threadKind: 'MATCHED', status: 'OPEN' }),
    );
    txConversationThreadUpdate.mockResolvedValue(
      makeThread({ threadKind: 'DIRECT', activeMatchId: null, status: 'OPEN' }),
    );

    await service.handleActiveMatchUnmatched(
      {
        conversationThread: {
          findFirst: txConversationThreadFindFirst,
          update: txConversationThreadUpdate,
        },
        chatRealtimeOutboxEvent: {
          create: txChatRealtimeOutboxEventCreate,
        },
        chatRealtimeEventRecipient: {
          createMany: txChatRealtimeEventRecipientCreateMany,
        },
      } as never,
      { activeMatchId: 'active-1' },
      new Date('2026-02-10T03:00:00.000Z'),
    );

    const outboxCreateCalls = txChatRealtimeOutboxEventCreate.mock.calls as Array<
      [{ data?: { eventType?: string; payload?: Record<string, unknown> } }]
    >;
    expect(outboxCreateCalls[0]?.[0].data).toMatchObject({
      eventType: 'chat.thread.updated',
      payload: {
        threadId: 'thread-1',
        status: 'OPEN',
        closedReason: null,
      },
    });
    const recipientCreateCalls = txChatRealtimeEventRecipientCreateMany.mock.calls as Array<
      [{ data?: Array<{ userId?: string }> }]
    >;
    expect(recipientCreateCalls[0]?.[0].data?.map((row) => row.userId)).toEqual(
      expect.arrayContaining(['user-1', 'user-2']),
    );
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
  });

  it('thread detail은 lifecycle sync 결과 ARCHIVED가 된 thread를 not found로 숨긴다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeThread({
        status: 'READ_ONLY',
        closedReason: 'SEASON_ENDED',
        messages: [
          {
            id: 'message-1',
            body: '지난 시즌 메시지',
            sentAt: new Date('2026-02-10T03:00:00.000Z'),
            senderParticipant: { userId: 'user-1' },
          },
        ],
      }),
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
    prisma.conversationThread.update.mockResolvedValue(
      makeThread({
        status: 'ARCHIVED',
        closedReason: 'SEASON_ENDED',
        closedAt: new Date('2026-02-10T03:00:00.000Z'),
        messages: [],
      }),
    );

    await expect(
      service.getThreadDetail(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'thread-1',
      ),
    ).rejects.toMatchObject({
      response: chatErrors.threadNotFound().getResponse(),
    });
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

  it.each([
    {
      threadKind: 'DIRECT' as const,
      activeMatchId: null,
      activeMatch: null,
      closedReason: 'ROOM_SELECTION_CUTOFF' as const,
    },
    {
      threadKind: 'MATCHED' as const,
      activeMatchId: 'active-1',
      activeMatch: {
        id: 'active-1',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        createdFromRequestId: 'request-1',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: null,
      },
      closedReason: 'SEASON_ENDED' as const,
    },
  ])(
    '다음 시즌 seasonOpenDate 직전까지 지난 시즌 $threadKind read-only thread는 목록에 남아 있다',
    async ({ threadKind, activeMatchId, activeMatch, closedReason }) => {
      prisma.conversationThread.findMany.mockResolvedValue([
        makeThread({
          threadKind,
          activeMatchId,
          activeMatch,
          status: 'READ_ONLY',
          closedReason,
          season: {
            ...makeThread().season,
            seasonEndDate: new Date('2026-08-31T00:00:00.000Z'),
          },
        }),
      ]);
      seasonsService.getCurrentSeasonContext.mockImplementation((_campus: string, now: Date) =>
        Promise.resolve(
          now.getTime() >= new Date('2027-01-01T00:00:00+09:00').getTime()
            ? {
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
              }
            : null,
        ),
      );
      prisma.getDatabaseNow.mockResolvedValueOnce(new Date('2026-12-31T14:59:59.000Z'));

      const result = await service.listThreads({
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        threadKind,
        status: 'READ_ONLY',
        canSendMessage: false,
        sendMessageUnavailableReason:
          closedReason === 'SEASON_ENDED' ? 'SEASON_ENDED' : 'THREAD_READ_ONLY',
      });
    },
  );

  it.each([
    {
      threadKind: 'DIRECT' as const,
      activeMatchId: null,
      activeMatch: null,
      closedReason: 'ROOM_SELECTION_CUTOFF' as const,
    },
    {
      threadKind: 'MATCHED' as const,
      activeMatchId: 'active-1',
      activeMatch: {
        id: 'active-1',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        createdFromRequestId: 'request-1',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: null,
      },
      closedReason: 'SEASON_ENDED' as const,
    },
  ])(
    '다음 시즌 seasonOpenDate 00:00:00(KST)가 되면 지난 시즌 $threadKind thread는 archive되어 목록에서 사라진다',
    async ({ threadKind, activeMatchId, activeMatch, closedReason }) => {
      prisma.conversationThread.findMany.mockResolvedValue([
        makeThread({
          threadKind,
          activeMatchId,
          activeMatch,
          status: 'READ_ONLY',
          closedReason,
        }),
      ]);
      prisma.conversationThread.update.mockResolvedValue(
        makeThread({
          threadKind,
          activeMatchId,
          activeMatch,
          status: 'ARCHIVED',
          closedReason: 'SEASON_ENDED',
        }),
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
      prisma.getDatabaseNow.mockResolvedValueOnce(new Date('2026-12-31T15:00:00.000Z'));

      const result = await service.listThreads({
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      });

      expect(result.items).toEqual([]);
    },
  );

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
    const outboxEventTypes = txChatRealtimeOutboxEventCreate.mock.calls.map(
      (call: [{ data?: { eventType?: string } }]) => call[0].data?.eventType,
    );
    expect(outboxEventTypes).not.toContain('chat.member.left');
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

  it('thread participant가 아닌 다른 auth user는 thread detail 접근이 막힌다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(null);

    await expect(
      service.getThreadDetail(
        {
          id: 'user-3',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'thread-1',
      ),
    ).rejects.toMatchObject({
      response: chatErrors.threadNotFound().getResponse(),
    });
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
    },
  );
});
