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
  dormitoryId: string | null;
  dormitorySelectionState: 'NOT_SELECTED' | 'UNASSIGNED' | 'ASSIGNED';
};

function makeUserSeed(overrides: Partial<UserSeed> = {}): UserSeed {
  return {
    id: 'user-1',
    emailVerifiedAt: new Date('2026-02-01T00:00:00.000Z'),
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED',
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
    profile: { participantId: 'participant-1' } as never,
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

describe('ChatService', () => {
  const txQueryRawTyped = jest.fn();
  const txConversationThreadFindFirst = jest.fn();
  const txConversationThreadCreate = jest.fn();
  const txConversationThreadUpdate = jest.fn();
  const txConversationThreadUpdateMany = jest.fn();
  const txConversationThreadMemberCreateMany = jest.fn();
  const txConversationThreadMemberUpdate = jest.fn();
  const txConversationThreadMemberUpdateMany = jest.fn();
  const txConversationThreadMemberCount = jest.fn();
  const txConversationMessageCreate = jest.fn();
  const txActiveMatchFindFirst = jest.fn();

  const prisma = {
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
    ensureCurrentSeasonParticipantForUser: jest.fn(),
    selectCanonicalSelection: jest.fn(),
    pickCurrentSeasonParticipant: jest.fn(),
  };

  const service = new ChatService(
    prisma as never,
    seasonsService as never,
    seasonParticipantsService as never,
  );

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
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockImplementation(
      (user: UserSeed) =>
        Promise.resolve(
          user.id === 'user-2'
            ? makeParticipant({ id: 'participant-2', userId: 'user-2' })
            : makeParticipant({ id: 'participant-1', userId: user.id }),
        ),
    );
    seasonParticipantsService.selectCanonicalSelection.mockImplementation(
      (
        user: Pick<UserSeed, 'dormitoryId' | 'dormitorySelectionState'>,
        participant: Pick<
          CanonicalSelectionState,
          'dormitoryId' | 'dormitorySelectionState'
        > | null,
      ): CanonicalSelectionState => ({
        dormitoryId: participant?.dormitoryId ?? user.dormitoryId,
        dormitorySelectionState:
          participant?.dormitorySelectionState ?? user.dormitorySelectionState,
        source: participant ? 'SEASON_PARTICIPANT' : 'USER',
      }),
    );
    seasonParticipantsService.pickCurrentSeasonParticipant.mockImplementation(
      (participants: CurrentSeasonParticipantRecord[] | null | undefined) =>
        participants?.[0] ?? null,
    );
    prisma.activeMatch.findFirst.mockResolvedValue(null);
    prisma.conversationThread.findFirst.mockResolvedValue(null);
    prisma.conversationThread.findMany.mockResolvedValue([]);
    prisma.conversationThread.update.mockResolvedValue(
      makeThread({ status: 'READ_ONLY', closedReason: 'ROOM_SELECTION_CUTOFF' }),
    );
    txQueryRawTyped.mockResolvedValue([{ lockAcquired: null }]);
    txConversationThreadFindFirst.mockResolvedValue(null);
    txConversationThreadCreate.mockResolvedValue(makeThread());
    txConversationThreadUpdate.mockResolvedValue(
      makeThread({ threadKind: 'MATCHED', activeMatchId: 'active-1' }),
    );
    txConversationThreadUpdateMany.mockResolvedValue({ count: 1 });
    txConversationThreadMemberCreateMany.mockResolvedValue({ count: 2 });
    txConversationThreadMemberUpdate.mockResolvedValue(undefined);
    txConversationThreadMemberUpdateMany.mockResolvedValue({ count: 1 });
    txConversationThreadMemberCount.mockResolvedValue(1);
    txConversationMessageCreate.mockResolvedValue({
      id: 'message-1',
      body: '안녕하세요',
      sentAt: new Date('2026-02-10T03:00:00.000Z'),
      senderParticipant: { userId: 'user-1' },
    });
    txActiveMatchFindFirst.mockResolvedValue(null);
    prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        $queryRawTyped: txQueryRawTyped,
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
        },
        conversationMessage: {
          create: txConversationMessageCreate,
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
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
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

  it('시즌 참여자라도 UNASSIGNED면 같은 건물 사용자에 대한 채팅 UI entry와 send가 모두 닫힌다', async () => {
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockImplementation(
      (user: UserSeed) =>
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
        dormitoryId: null,
        dormitorySelectionState: 'NOT_SELECTED',
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
          dormitoryId: null,
          dormitorySelectionState: 'NOT_SELECTED',
        },
        { targetUserId: 'user-2', body: '안녕하세요' },
      ),
    ).rejects.toMatchObject({
      response: chatErrors.messageSendNotAllowed().getResponse(),
    });
  });

  it('시즌 참여자라도 ASSIGNED 사용자는 다른 건물 사용자에게 채팅 UI entry와 send가 모두 닫힌다', async () => {
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockImplementation(
      (user: UserSeed) =>
        Promise.resolve(
          user.id === 'user-2'
            ? makeParticipant({
                id: 'participant-2',
                userId: 'user-2',
                dormitoryId: 'other-dorm',
                dormitorySelectionState: 'ASSIGNED',
              })
            : makeParticipant({ id: 'participant-1', userId: user.id }),
        ),
    );

    const entry = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
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
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        { targetUserId: 'user-2', body: '다른 건물 사용자에게 보낼 수 없음' },
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
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
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

  it('live ActiveMatch가 없으면 stale MATCHED target도 채팅 후보로 유지한다', async () => {
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockImplementation(
      (user: UserSeed) =>
        Promise.resolve(
          user.id === 'user-2'
            ? makeParticipant({
                id: 'participant-2',
                userId: 'user-2',
                participantStatus: 'MATCHED',
                matchedAt: new Date('2026-02-01T00:00:00.000Z'),
              })
            : makeParticipant({ id: 'participant-1', userId: user.id }),
        ),
    );

    const entry = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
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
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
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
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockImplementation(
      (user: UserSeed) =>
        Promise.resolve(
          user.id === 'user-2'
            ? makeParticipant({
                id: 'participant-2',
                userId: 'user-2',
                dormitoryId: null,
                dormitorySelectionState: 'UNASSIGNED',
                participantStatus: 'DRAFT',
              })
            : makeParticipant({ id: 'participant-1', userId: user.id }),
        ),
    );
    seasonParticipantsService.selectCanonicalSelection.mockImplementation(
      (
        user: Pick<UserSeed, 'dormitoryId' | 'dormitorySelectionState'>,
        participant: Pick<
          CanonicalSelectionState,
          'dormitoryId' | 'dormitorySelectionState'
        > | null,
      ): CanonicalSelectionState => ({
        dormitoryId: participant?.dormitoryId ?? user.dormitoryId,
        dormitorySelectionState:
          participant?.dormitorySelectionState ?? user.dormitorySelectionState,
        source: participant ? 'SEASON_PARTICIPANT' : 'USER',
      }),
    );

    const entry = await service.getThreadEntry(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
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

  it('첫 메시지 전송 시 thread를 생성한다', async () => {
    const result = await service.sendMessage(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      { targetUserId: 'user-2', body: '안녕하세요' },
    );

    expect(txConversationThreadCreate).toHaveBeenCalled();
    expect(txConversationThreadMemberCreateMany).toHaveBeenCalled();
    expect(txConversationMessageCreate).toHaveBeenCalled();
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
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      { targetUserId: 'user-2', body: '안녕하세요' },
    );

    expect(txConversationThreadCreate).not.toHaveBeenCalled();
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
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      { targetUserId: 'user-2', body: '안녕하세요' },
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
    expect(result.thread.threadKind).toBe('MATCHED');
  });

  it('ACTIVE 생성 시 다른 non-matched thread를 read-only로 전환한다', async () => {
    await service.handleActiveMatchCreated(
      {
        $queryRawTyped: txQueryRawTyped,
        conversationThread: {
          findFirst: jest.fn(),
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
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      'thread-1',
    );

    expect(result.thread.status).toBe('READ_ONLY');
    expect(result.thread.canReport).toBe(true);
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
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        { targetUserId: 'user-2', body: '안녕하세요' },
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
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
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
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
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
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
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
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      'thread-1',
    );

    expect(result.thread.status).toBe('READ_ONLY');
    expect(result.thread.canSendMessage).toBe(false);
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
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        threadKind,
        status: 'READ_ONLY',
        canSendMessage: false,
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
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
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

      await expect(
        service.leaveThread(
          {
            id: 'user-1',
            gender: 'M',
            campus: 'CHUNCHEON',
            dormitoryId: 'dasan',
            dormitorySelectionState: 'ASSIGNED',
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
    },
  );

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
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      { targetUserId: 'user-1', body: '복귀 후 첫 메시지' },
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
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
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
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        'thread-1',
      ),
    ).rejects.toMatchObject({
      response: chatErrors.threadNotFound().getResponse(),
    });
  });

  it('양쪽 모두 나가 archive된 이전 thread는 재사용하지 않고, 이후 첫 메시지에서 새 thread를 다시 생성한다', async () => {
    txConversationThreadFindFirst.mockResolvedValue(null);

    await expect(
      service.sendMessage(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        { targetUserId: 'user-2', body: '새 시즌이 아니어도 새 thread' },
      ),
    ).resolves.toMatchObject({ createdThread: true });

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
      txConversationThreadMemberCount.mockResolvedValue(0);

      await expect(
        service.leaveThread(
          {
            id: 'user-1',
            gender: 'M',
            campus: 'CHUNCHEON',
            dormitoryId: 'dasan',
            dormitorySelectionState: 'ASSIGNED',
          },
          'thread-1',
        ),
      ).resolves.toEqual({ threadId: 'thread-1', archived: true });

      const [threadUpdateCall] = txConversationThreadUpdate.mock.calls as Array<
        [{ where: { id: string }; data: Record<string, unknown> }]
      >;
      expect(threadUpdateCall).toBeDefined();
      if (!threadUpdateCall) {
        throw new Error('Expected archive thread update call');
      }
      expect(threadUpdateCall[0]).toMatchObject({
        where: { id: 'thread-1' },
        data: { status: 'ARCHIVED' },
      });
    },
  );
});
