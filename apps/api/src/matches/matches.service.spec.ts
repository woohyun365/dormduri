import { MatchesService } from './matches.service.js';
import { matchesErrors } from './matches.errors.js';
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
    profile: null,
    ...overrides,
  };
}

describe('MatchesService', () => {
  const txQueryRaw = jest.fn();
  const txQueryRawTyped = jest.fn();
  const txMatchRequestFindFirst = jest.fn();
  const txMatchRequestCount = jest.fn();
  const txMatchRequestCreate = jest.fn();
  const txMatchRequestFindUnique = jest.fn();
  const txMatchRequestUpdate = jest.fn();
  const txMatchRequestUpdateMany = jest.fn();
  const txActiveMatchFindFirst = jest.fn();
  const txActiveMatchCreate = jest.fn();
  const txSeasonParticipantUpdateMany = jest.fn();

  const prisma = {
    getDatabaseNow: jest.fn(),
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
    },
    matchRequest: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    activeMatch: {
      findMany: jest.fn(),
    },
    runSerializableTransaction: jest.fn(),
  };
  const seasonsService = {
    getCurrentSeasonContext: jest.fn(),
  };
  const moderationService = {
    moderatePublicText: jest.fn(),
  };
  const seasonParticipantsService = {
    ensureCurrentSeasonParticipantForUser: jest.fn(),
    selectCanonicalSelection: jest.fn(),
  };

  const chatService = {
    handleActiveMatchCreated: jest.fn(),
  };

  const service = new MatchesService(
    prisma as never,
    seasonsService as never,
    moderationService as never,
    seasonParticipantsService as never,
    chatService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(new Date('2026-02-10T03:00:00.000Z'));
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
      state: 'SEASON_MATCHING',
      operatedDormitories: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
        { dormitoryId: 'saerom', isOperated: true, roomSelectionDate: '2026-02-12' },
      ],
      schedule: {
        preparationStart: '2026-02-01',
        matchingStart: '2026-02-05',
        matchingEnd: '2026-02-12',
        seasonEnd: '2026-02-28',
      },
    });
    moderationService.moderatePublicText.mockResolvedValue({ ok: true });
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
    prisma.activeMatch.findMany.mockResolvedValue([]);
    chatService.handleActiveMatchCreated.mockResolvedValue(undefined);
    prisma.matchRequest.findMany.mockResolvedValue([]);
    prisma.matchRequest.updateMany.mockResolvedValue({ count: 0 });
    txQueryRaw.mockResolvedValue([{ id: 'lock-row' }]);
    txQueryRawTyped.mockResolvedValue([{ lockAcquired: null }]);
    txMatchRequestFindFirst.mockResolvedValue(null);
    txMatchRequestCount.mockResolvedValue(0);
    txMatchRequestCreate.mockResolvedValue({
      id: 'request-1',
      seasonId: 'season-1',
      requesterParticipantId: 'participant-1',
      receiverParticipantId: 'participant-2',
      status: 'PENDING',
      note: '안녕하세요',
      createdAt: new Date('2026-02-10T03:00:00.000Z'),
      expiresAt: new Date('2026-02-11T14:59:59.000Z'),
      terminalAt: null,
      acceptedAt: null,
      terminalReason: null,
      requestChannel: 'PROFILE_DETAIL',
      requesterParticipant: { userId: 'user-1' },
      receiverParticipant: { userId: 'user-2' },
    });
    txMatchRequestFindUnique.mockResolvedValue({
      id: 'request-1',
      seasonId: 'season-1',
      requesterParticipantId: 'participant-1',
      receiverParticipantId: 'participant-2',
      status: 'PENDING',
      note: '안녕하세요',
      createdAt: new Date('2026-02-10T03:00:00.000Z'),
      expiresAt: new Date('2026-02-11T14:59:59.000Z'),
      terminalAt: null,
      acceptedAt: null,
      terminalReason: null,
      requestChannel: 'PROFILE_DETAIL',
      requesterParticipant: { userId: 'user-1' },
      receiverParticipant: { userId: 'user-2' },
    });
    const baseRequestRecord = {
      id: 'request-1',
      seasonId: 'season-1',
      requesterParticipantId: 'participant-1',
      receiverParticipantId: 'participant-2',
      status: 'PENDING',
      note: '안녕하세요',
      createdAt: new Date('2026-02-10T03:00:00.000Z'),
      expiresAt: new Date('2026-02-11T14:59:59.000Z'),
      terminalAt: null,
      acceptedAt: null,
      terminalReason: null,
      requestChannel: 'PROFILE_DETAIL',
      requesterParticipant: { userId: 'user-1' },
      receiverParticipant: { userId: 'user-2' },
    };
    txMatchRequestUpdate.mockImplementation(
      ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({
          ...baseRequestRecord,
          id: where.id,
          ...data,
          requesterParticipant: { userId: 'user-1' },
          receiverParticipant: { userId: 'user-2' },
        }),
    );
    txMatchRequestUpdateMany.mockResolvedValue({ count: 1 });
    txActiveMatchFindFirst.mockResolvedValue(null);
    txActiveMatchCreate.mockResolvedValue({
      id: 'active-1',
      seasonId: 'season-1',
      participantAId: 'participant-1',
      participantBId: 'participant-2',
      status: 'ACTIVE',
      startedAt: new Date('2026-02-10T03:00:00.000Z'),
      endedAt: null,
      endReason: null,
      createdFromRequestId: 'request-1',
      participantA: { userId: 'user-1' },
      participantB: { userId: 'user-2' },
    });
    txSeasonParticipantUpdateMany.mockResolvedValue({ count: 2 });
    prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        $queryRaw: txQueryRaw,
        $queryRawTyped: txQueryRawTyped,
        matchRequest: {
          findFirst: txMatchRequestFindFirst,
          count: txMatchRequestCount,
          create: txMatchRequestCreate,
          findUnique: txMatchRequestFindUnique,
          update: txMatchRequestUpdate,
          updateMany: txMatchRequestUpdateMany,
        },
        activeMatch: {
          findFirst: txActiveMatchFindFirst,
          create: txActiveMatchCreate,
        },
        seasonParticipant: {
          updateMany: txSeasonParticipantUpdateMany,
        },
      }),
    );
  });

  it('요청 생성은 SEASON_MATCHING + 등록 + 같은 건물 + roomSelectionDate 전 조건에서만 허용된다', async () => {
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
      state: 'SEASON_OPEN',
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

    await expect(
      service.createMatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        { targetUserId: 'user-2', note: '안녕하세요', channel: 'PROFILE_DETAIL' },
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestNotAllowed().getResponse(),
    });
  });

  it('same-pair live pending duplicate를 차단한다', async () => {
    txMatchRequestFindFirst.mockResolvedValueOnce({ id: 'request-existing' });

    await expect(
      service.createMatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        { targetUserId: 'user-2', note: '안녕하세요', channel: 'PROFILE_DETAIL' },
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestAlreadyPending().getResponse(),
    });
  });

  it('같은 방향 cooldown 2일을 적용한다', async () => {
    txMatchRequestCount.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    txMatchRequestFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ terminalAt: new Date('2026-02-09T12:00:00.000Z') });

    await expect(
      service.createMatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        { targetUserId: 'user-2', note: null, channel: 'PROFILE_DETAIL' },
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestDirectionCooldownActive().getResponse(),
    });
  });

  it('같은 방향 시즌당 5회 제한을 적용한다', async () => {
    txMatchRequestCount.mockResolvedValueOnce(0).mockResolvedValueOnce(5);

    await expect(
      service.createMatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        { targetUserId: 'user-2', note: null, channel: 'PROFILE_DETAIL' },
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestDirectionLimitReached().getResponse(),
    });
  });

  it('요청 생성 시 expiresAt은 roomSelectionDate와 5일 TTL 중 더 이른 시점을 쓴다', async () => {
    const result = await service.createMatchRequest(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      { targetUserId: 'user-2', note: '안녕하세요', channel: 'PROFILE_DETAIL' },
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [createCall] = txMatchRequestCreate.mock.calls;
    expect(createCall).toBeDefined();
    if (!createCall) {
      throw new Error('Expected create call');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(createCall[0]).toMatchObject({
      data: {
        pairKey: 'participant-1:participant-2',
        pairMinParticipantId: 'participant-1',
        pairMaxParticipantId: 'participant-2',
        status: 'PENDING',
        requestChannel: 'PROFILE_DETAIL',
      },
    });
    expect(result.request.status).toBe('PENDING');
    expect(result.activeMatch).toBeNull();
  });

  it('수락은 즉시 ACTIVE를 만들고 다른 pending을 system cancel한다', async () => {
    const result = await service.acceptMatchRequest(
      {
        id: 'user-2',
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      'request-1',
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [acceptedUpdateCall] = txMatchRequestUpdate.mock.calls;
    expect(acceptedUpdateCall).toBeDefined();
    if (!acceptedUpdateCall) {
      throw new Error('Expected accepted update call');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(acceptedUpdateCall[0]).toMatchObject({
      where: { id: 'request-1' },
      data: {
        status: 'ACCEPTED',
        terminalReason: 'ACCEPTED',
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [activeCreateCall] = txActiveMatchCreate.mock.calls;
    expect(activeCreateCall).toBeDefined();
    if (!activeCreateCall) {
      throw new Error('Expected active create call');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(activeCreateCall[0]).toMatchObject({
      data: {
        seasonId: 'season-1',
        pairKey: 'participant-1:participant-2',
        createdFromRequestId: 'request-1',
        status: 'ACTIVE',
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [participantUpdateCall] = txSeasonParticipantUpdateMany.mock.calls;
    expect(participantUpdateCall).toBeDefined();
    if (!participantUpdateCall) {
      throw new Error('Expected participant updateMany call');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(participantUpdateCall[0]).toMatchObject({
      data: { participantStatus: 'MATCHED' },
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const systemCancelCall = txMatchRequestUpdateMany.mock.calls.at(-1);
    expect(systemCancelCall).toBeDefined();
    if (!systemCancelCall) {
      throw new Error('Expected system cancel updateMany call');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(systemCancelCall[0]).toMatchObject({
      data: {
        status: 'CANCELLED_BY_SYSTEM',
        terminalReason: 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH',
      },
    });
    expect(result.request.status).toBe('ACCEPTED');
    expect(result.activeMatch?.counterpartUserId).toBe('user-1');
  });

  it('거절은 terminal only이며 ACTIVE를 만들지 않는다', async () => {
    const result = await service.rejectMatchRequest(
      {
        id: 'user-2',
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      'request-1',
    );

    expect(txActiveMatchCreate).not.toHaveBeenCalled();
    expect(result.request.status).toBe('REJECTED');
    expect(result.activeMatch).toBeNull();
  });

  it('취소는 terminal only이며 ACTIVE를 만들지 않는다', async () => {
    const result = await service.cancelMatchRequest(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      'request-1',
    );

    expect(txActiveMatchCreate).not.toHaveBeenCalled();
    expect(result.request.status).toBe('CANCELLED_BY_REQUESTER');
    expect(result.activeMatch).toBeNull();
  });

  it('만료된 요청 수락은 EXPIRED 처리하고 ACTIVE를 만들지 않는다', async () => {
    txMatchRequestFindUnique.mockResolvedValueOnce({
      id: 'request-1',
      seasonId: 'season-1',
      requesterParticipantId: 'participant-1',
      receiverParticipantId: 'participant-2',
      status: 'PENDING',
      note: null,
      createdAt: new Date('2026-02-05T03:00:00.000Z'),
      expiresAt: new Date('2026-02-10T02:59:00.000Z'),
      terminalAt: null,
      acceptedAt: null,
      terminalReason: null,
      requestChannel: null,
      requesterParticipant: { userId: 'user-1' },
      receiverParticipant: { userId: 'user-2' },
    });

    await expect(
      service.acceptMatchRequest(
        {
          id: 'user-2',
          gender: 'M',
          campus: 'CHUNCHEON',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        'request-1',
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestExpired().getResponse(),
    });
    expect(txActiveMatchCreate).not.toHaveBeenCalled();
  });

  it('single-active invariant가 있으면 수락을 막는다', async () => {
    txActiveMatchFindFirst.mockResolvedValueOnce({ id: 'active-existing' });

    await expect(
      service.acceptMatchRequest(
        {
          id: 'user-2',
          gender: 'M',
          campus: 'CHUNCHEON',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        'request-1',
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.activeMatchAlreadyExists().getResponse(),
    });
  });

  it('roomSelectionDate 이후에도 ACTIVE 결과는 seasonEndDate 전까지 조회된다', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(makeUserSeed());
    seasonsService.getCurrentSeasonContext.mockResolvedValueOnce({
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
    seasonParticipantsService.ensureCurrentSeasonParticipantForUser.mockResolvedValueOnce(
      makeParticipant({
        participantStatus: 'MATCHED',
        matchedAt: new Date('2026-02-10T03:00:00.000Z'),
      }),
    );
    prisma.activeMatch.findMany.mockResolvedValueOnce([
      {
        id: 'active-1',
        seasonId: 'season-1',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        status: 'ACTIVE',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: null,
        endReason: null,
        createdFromRequestId: 'request-1',
        participantA: { userId: 'user-1' },
        participantB: { userId: 'user-2' },
      },
    ]);

    const result = await service.getCurrentActiveMatch({
      id: 'user-1',
      gender: 'M',
      campus: 'CHUNCHEON',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
    });

    expect(result.activeMatch).toMatchObject({
      id: 'active-1',
      counterpartUserId: 'user-2',
      status: 'ACTIVE',
    });
  });
});
