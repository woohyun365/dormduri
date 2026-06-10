import { MatchesService } from './matches.service.js';
import { matchesErrors } from './matches.errors.js';
import { CancelUnmatchRequestCommand } from './active/commands/cancel-unmatch-request.command.js';
import { RequestUnmatchCommand } from './active/commands/request-unmatch.command.js';
import { ActiveMatchRepository } from './active/persistence/active-match.repository.js';
import { ActiveMatchViewQuery } from './active/queries/active-match-view.query.js';
import { MatchRequestNoteModerationAdapter } from './requests/adapters/match-request-note-moderation.adapter.js';
import { AcceptMatchRequestCommand } from './requests/commands/accept-match-request.command.js';
import { CancelMatchRequestCommand } from './requests/commands/cancel-match-request.command.js';
import { CreateMatchRequestCommand } from './requests/commands/create-match-request.command.js';
import { RejectMatchRequestCommand } from './requests/commands/reject-match-request.command.js';
import { ResolveTerminalMatchRequestCommand } from './requests/commands/resolve-terminal-match-request.command.js';
import { MatchRequestCreationEvaluator } from './requests/eligibility/match-request-creation.evaluator.js';
import { MatchRequestAcceptanceRepository } from './requests/persistence/match-request-acceptance.repository.js';
import { MatchRequestRepository } from './requests/persistence/match-request.repository.js';
import { ListCurrentSeasonRequestsQuery } from './requests/queries/list-current-season-requests.query.js';
import type {
  CanonicalSelectionState,
  CurrentSeasonParticipantRecord,
} from '../season-participants/application/season-participants.service.js';

type UserSeed = {
  id: string;
  emailVerifiedAt: Date | null;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
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
    profile: {
      lifestyle: COMPLETE_LIFESTYLE,
    },
    ...overrides,
  };
}

function makeMatchRequestParticipant(userId: string, overrides: Record<string, unknown> = {}) {
  const suffix = userId.split('-').at(-1) ?? userId;
  return {
    userId,
    registeredAt: new Date('2026-02-01T00:00:00.000Z'),
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED',
    participationIntent: 'REGISTERED',
    participantStatus: 'ACTIVE',
    declinedAt: null,
    withdrawnAt: null,
    hiddenByAdminAt: null,
    deactivatedAt: null,
    user: { deletedAt: null },
    profile: {
      nicknameSnapshot: `유저${suffix}`,
      intro: `유저${suffix} 소개`,
      ...COMPLETE_LIFESTYLE,
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
    profile: {
      participantId: 'participant-1',
      lifestyle: COMPLETE_LIFESTYLE,
    } as never,
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
  const txActiveMatchFindUnique = jest.fn();
  const txActiveMatchCreate = jest.fn();
  const txActiveMatchUpdate = jest.fn();
  const txActiveMatchUnmatchRequestCreate = jest.fn();
  const txActiveMatchUnmatchRequestFindMany = jest.fn();
  const txActiveMatchUnmatchRequestUpdate = jest.fn();
  const txActiveMatchUnmatchRequestUpdateMany = jest.fn();
  const txSeasonParticipantFindMany = jest.fn();
  const txSeasonParticipantUpdateMany = jest.fn();
  const txSeasonDormitoryOperationFindUnique = jest.fn();
  const txSeasonParticipantProfileHistoryCount = jest.fn();

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
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    activeMatchUnmatchRequest: {
      updateMany: jest.fn(),
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
    ensureCurrentSeasonParticipant: jest.fn(),
    findCurrentSeasonParticipant: jest.fn(),
    selectCanonicalSelection: jest.fn(),
    hasRegistrationSnapshotForParticipant: jest.fn(),
  };

  const chatMatchThreadLifecycle = {
    handleActiveMatchCreated: jest.fn(),
    handleActiveMatchUnmatched: jest.fn(),
  };

  const activeMatchRepository = new ActiveMatchRepository();
  const activeMatchViewQuery = new ActiveMatchViewQuery(prisma as never, activeMatchRepository);
  const noteModerationAdapter = new MatchRequestNoteModerationAdapter(moderationService as never);
  const matchRequestRepository = new MatchRequestRepository();
  const matchRequestAcceptanceRepository = new MatchRequestAcceptanceRepository();
  const matchRequestCreationEvaluator = new MatchRequestCreationEvaluator(
    prisma as never,
    seasonsService as never,
    seasonParticipantsService as never,
    activeMatchViewQuery,
    noteModerationAdapter,
  );
  const listCurrentSeasonRequestsQuery = new ListCurrentSeasonRequestsQuery(
    prisma as never,
    seasonsService as never,
    seasonParticipantsService as never,
  );
  const resolveTerminalMatchRequestCommand = new ResolveTerminalMatchRequestCommand(
    prisma as never,
    seasonsService as never,
    seasonParticipantsService as never,
    matchRequestRepository,
  );

  const service = new MatchesService(
    prisma as never,
    seasonsService as never,
    seasonParticipantsService as never,
    activeMatchViewQuery,
    listCurrentSeasonRequestsQuery,
    new CreateMatchRequestCommand(
      prisma as never,
      matchRequestCreationEvaluator,
      matchRequestRepository,
    ),
    new AcceptMatchRequestCommand(
      prisma as never,
      seasonsService as never,
      seasonParticipantsService as never,
      chatMatchThreadLifecycle as never,
      activeMatchViewQuery,
      matchRequestAcceptanceRepository,
    ),
    new RejectMatchRequestCommand(resolveTerminalMatchRequestCommand),
    new CancelMatchRequestCommand(resolveTerminalMatchRequestCommand),
    new RequestUnmatchCommand(
      prisma as never,
      seasonsService as never,
      seasonParticipantsService as never,
      chatMatchThreadLifecycle as never,
      activeMatchRepository,
    ),
    new CancelUnmatchRequestCommand(
      prisma as never,
      seasonsService as never,
      seasonParticipantsService as never,
      activeMatchRepository,
    ),
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
    seasonParticipantsService.hasRegistrationSnapshotForParticipant.mockResolvedValue(true);
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
    prisma.activeMatch.findMany.mockResolvedValue([]);
    prisma.activeMatch.findFirst.mockResolvedValue(null);
    prisma.activeMatch.findUnique.mockResolvedValue(null);
    prisma.activeMatchUnmatchRequest.updateMany.mockResolvedValue({ count: 0 });
    chatMatchThreadLifecycle.handleActiveMatchCreated.mockResolvedValue(undefined);
    chatMatchThreadLifecycle.handleActiveMatchUnmatched.mockResolvedValue(undefined);
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
      requesterParticipant: makeMatchRequestParticipant('user-1'),
      receiverParticipant: makeMatchRequestParticipant('user-2'),
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
      requesterParticipant: makeMatchRequestParticipant('user-1'),
      receiverParticipant: makeMatchRequestParticipant('user-2'),
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
      requesterParticipant: makeMatchRequestParticipant('user-1'),
      receiverParticipant: makeMatchRequestParticipant('user-2'),
    };
    txMatchRequestUpdate.mockImplementation(
      ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({
          ...baseRequestRecord,
          id: where.id,
          ...data,
          requesterParticipant: makeMatchRequestParticipant('user-1'),
          receiverParticipant: makeMatchRequestParticipant('user-2'),
        }),
    );
    txMatchRequestUpdateMany.mockResolvedValue({ count: 1 });
    txActiveMatchFindFirst.mockResolvedValue(null);
    txActiveMatchFindUnique.mockResolvedValue({
      id: 'active-1',
      seasonId: 'season-1',
      participantAId: 'participant-1',
      participantBId: 'participant-2',
      status: 'ACTIVE',
      startedAt: new Date('2026-02-10T03:00:00.000Z'),
      endedAt: null,
      endReason: null,
      createdFromRequestId: 'request-1',
      participantA: {
        userId: 'user-1',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      participantB: {
        userId: 'user-2',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      unmatchRequests: [],
    });
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
      unmatchRequests: [],
    });
    txActiveMatchUpdate.mockImplementation(
      ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({
          id: where.id,
          seasonId: 'season-1',
          participantAId: 'participant-1',
          participantBId: 'participant-2',
          createdFromRequestId: 'request-1',
          startedAt: new Date('2026-02-10T03:00:00.000Z'),
          participantA: {
            userId: 'user-1',
            dormitoryId: 'dasan',
            dormitorySelectionState: 'ASSIGNED',
          },
          participantB: {
            userId: 'user-2',
            dormitoryId: 'dasan',
            dormitorySelectionState: 'ASSIGNED',
          },
          unmatchRequests: [
            {
              id: 'unmatch-1',
              participantId: 'participant-1',
              status: 'FULFILLED_BY_MUTUAL_CONSENT',
              requestedAt: new Date('2026-02-10T03:00:00.000Z'),
              terminalAt: new Date('2026-02-10T03:05:00.000Z'),
            },
            {
              id: 'unmatch-2',
              participantId: 'participant-2',
              status: 'FULFILLED_BY_MUTUAL_CONSENT',
              requestedAt: new Date('2026-02-10T03:05:00.000Z'),
              terminalAt: new Date('2026-02-10T03:05:00.000Z'),
            },
          ],
          ...data,
        }),
    );
    txActiveMatchUnmatchRequestCreate.mockResolvedValue({
      id: 'unmatch-1',
      activeMatchId: 'active-1',
      participantId: 'participant-1',
      status: 'PENDING',
      requestedAt: new Date('2026-02-10T03:00:00.000Z'),
      terminalAt: null,
    });
    txActiveMatchUnmatchRequestFindMany.mockResolvedValue([]);
    txActiveMatchUnmatchRequestUpdate.mockResolvedValue({
      id: 'unmatch-1',
      activeMatchId: 'active-1',
      participantId: 'participant-1',
      status: 'CANCELLED_BY_REQUESTER',
      requestedAt: new Date('2026-02-10T03:00:00.000Z'),
      terminalAt: new Date('2026-02-10T03:05:00.000Z'),
    });
    txActiveMatchUnmatchRequestUpdateMany.mockResolvedValue({ count: 1 });
    txSeasonParticipantFindMany.mockResolvedValue([
      {
        id: 'participant-1',
        ...makeMatchRequestParticipant('user-1'),
      },
      {
        id: 'participant-2',
        ...makeMatchRequestParticipant('user-2'),
      },
    ]);
    txSeasonParticipantUpdateMany.mockResolvedValue({ count: 2 });
    txSeasonDormitoryOperationFindUnique.mockResolvedValue({
      isOperated: true,
      roomSelectionDate: new Date('2026-02-11T00:00:00.000Z'),
    });
    txSeasonParticipantProfileHistoryCount.mockResolvedValue(2);
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
          findUnique: txActiveMatchFindUnique,
          create: txActiveMatchCreate,
          update: txActiveMatchUpdate,
        },
        activeMatchUnmatchRequest: {
          create: txActiveMatchUnmatchRequestCreate,
          findMany: txActiveMatchUnmatchRequestFindMany,
          update: txActiveMatchUnmatchRequestUpdate,
          updateMany: txActiveMatchUnmatchRequestUpdateMany,
        },
        seasonParticipant: {
          findMany: txSeasonParticipantFindMany,
          updateMany: txSeasonParticipantUpdateMany,
        },
        seasonDormitoryOperation: {
          findUnique: txSeasonDormitoryOperationFindUnique,
        },
        seasonParticipantProfileHistory: {
          count: txSeasonParticipantProfileHistoryCount,
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
        },
        { targetUserId: 'user-2', note: '안녕하세요' },
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestNotAllowed().getResponse(),
    });
  });

  it('target registration snapshot이 없으면 등록/배정 상태여도 매칭 요청 action을 닫는다', async () => {
    seasonParticipantsService.hasRegistrationSnapshotForParticipant.mockResolvedValueOnce(false);

    await expect(
      service.createMatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        { targetUserId: 'user-2', note: '안녕하세요' },
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestNotAllowed().getResponse(),
    });

    expect(txMatchRequestCreate).not.toHaveBeenCalled();
  });

  it('요청 생성 transaction 내부에서 target 상태를 재점검해 race로 숨김/삭제된 target 생성을 막는다', async () => {
    txSeasonParticipantFindMany.mockResolvedValueOnce([
      {
        id: 'participant-1',
        ...makeMatchRequestParticipant('user-1'),
      },
      {
        id: 'participant-2',
        ...makeMatchRequestParticipant('user-2', {
          hiddenByAdminAt: new Date('2026-02-10T03:00:00.000Z'),
        }),
      },
    ]);

    await expect(
      service.createMatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        { targetUserId: 'user-2', note: '안녕하세요' },
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestNotAllowed().getResponse(),
    });

    expect(txSeasonParticipantFindMany).toHaveBeenCalled();
    expect(txMatchRequestCreate).not.toHaveBeenCalled();
  });

  it('target participant는 action 준비 중 ensure/upsert하지 않고 기존 SeasonParticipant만 조회한다', async () => {
    seasonParticipantsService.findCurrentSeasonParticipant.mockResolvedValueOnce(null);

    await expect(
      service.createMatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        { targetUserId: 'user-2', note: '안녕하세요' },
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestTargetNotFound().getResponse(),
    });

    expect(seasonParticipantsService.ensureCurrentSeasonParticipant).toHaveBeenCalledTimes(1);
    expect(seasonParticipantsService.ensureCurrentSeasonParticipant).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      expect.any(Date),
    );
    expect(seasonParticipantsService.findCurrentSeasonParticipant).toHaveBeenCalledWith(
      'user-2',
      'season-1',
    );
    expect(txMatchRequestCreate).not.toHaveBeenCalled();
  });

  it('same-pair live pending duplicate를 차단한다', async () => {
    txMatchRequestFindFirst.mockResolvedValueOnce({ id: 'request-existing' });

    await expect(
      service.createMatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        { targetUserId: 'user-2', note: '안녕하세요' },
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
        },
        { targetUserId: 'user-2', note: null },
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
        },
        { targetUserId: 'user-2', note: null },
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
      },
      { targetUserId: 'user-2', note: '안녕하세요' },
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
      },
      'request-1',
    );

    expect(txActiveMatchCreate).not.toHaveBeenCalled();
    expect(result.request.status).toBe('CANCELLED_BY_REQUESTER');
    expect(result.activeMatch).toBeNull();
  });

  it('한쪽만 매칭 취소 요청을 보내면 ACTIVE는 유지되고 pending unmatch request만 남는다', async () => {
    txActiveMatchUnmatchRequestFindMany.mockResolvedValueOnce([
      {
        id: 'unmatch-1',
        participantId: 'participant-1',
        status: 'PENDING',
        requestedAt: new Date('2026-02-10T03:00:00.000Z'),
        terminalAt: null,
      },
    ]);
    txActiveMatchFindUnique
      .mockResolvedValueOnce({
        id: 'active-1',
        seasonId: 'season-1',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        status: 'ACTIVE',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: null,
        endReason: null,
        createdFromRequestId: 'request-1',
        participantA: {
          userId: 'user-1',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        participantB: {
          userId: 'user-2',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        unmatchRequests: [],
      })
      .mockResolvedValueOnce({
        id: 'active-1',
        seasonId: 'season-1',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        status: 'ACTIVE',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: null,
        endReason: null,
        createdFromRequestId: 'request-1',
        participantA: {
          userId: 'user-1',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        participantB: {
          userId: 'user-2',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        unmatchRequests: [
          {
            id: 'unmatch-1',
            participantId: 'participant-1',
            status: 'PENDING',
            requestedAt: new Date('2026-02-10T03:00:00.000Z'),
            terminalAt: null,
          },
        ],
      });

    const result = await service.requestUnmatch(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'active-1',
    );

    expect(txActiveMatchUpdate).not.toHaveBeenCalled();
    expect(chatMatchThreadLifecycle.handleActiveMatchUnmatched).not.toHaveBeenCalled();
    expect(result.activeMatch.status).toBe('ACTIVE');
    expect(result.activeMatch.unmatchProgress).toMatchObject({
      state: 'WAITING_FOR_COUNTERPART',
      requestedByViewerAt: new Date('2026-02-10T03:00:00.000Z').toISOString(),
      requestedByCounterpartAt: null,
      progressCount: 1,
      requiredCount: 2,
      canRequest: false,
      canCancel: true,
    });
  });

  it('양쪽 모두 매칭 취소 요청을 보내면 즉시 UNMATCHED가 되고 participant/chat state도 함께 정리된다', async () => {
    txActiveMatchFindUnique
      .mockResolvedValueOnce({
        id: 'active-1',
        seasonId: 'season-1',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        status: 'ACTIVE',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: null,
        endReason: null,
        createdFromRequestId: 'request-1',
        participantA: {
          userId: 'user-1',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        participantB: {
          userId: 'user-2',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        unmatchRequests: [
          {
            id: 'unmatch-1',
            participantId: 'participant-1',
            status: 'PENDING',
            requestedAt: new Date('2026-02-10T03:00:00.000Z'),
            terminalAt: null,
          },
        ],
      })
      .mockResolvedValue({
        id: 'active-1',
        seasonId: 'season-1',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        status: 'UNMATCHED',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: new Date('2026-02-10T03:05:00.000Z'),
        endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
        createdFromRequestId: 'request-1',
        participantA: {
          userId: 'user-1',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        participantB: {
          userId: 'user-2',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        unmatchRequests: [
          {
            id: 'unmatch-1',
            participantId: 'participant-1',
            status: 'FULFILLED_BY_MUTUAL_CONSENT',
            requestedAt: new Date('2026-02-10T03:00:00.000Z'),
            terminalAt: new Date('2026-02-10T03:05:00.000Z'),
          },
          {
            id: 'unmatch-2',
            participantId: 'participant-2',
            status: 'FULFILLED_BY_MUTUAL_CONSENT',
            requestedAt: new Date('2026-02-10T03:05:00.000Z'),
            terminalAt: new Date('2026-02-10T03:05:00.000Z'),
          },
        ],
      });
    txActiveMatchUnmatchRequestFindMany.mockResolvedValueOnce([
      {
        id: 'unmatch-1',
        participantId: 'participant-1',
        status: 'PENDING',
        requestedAt: new Date('2026-02-10T03:00:00.000Z'),
        terminalAt: null,
      },
      {
        id: 'unmatch-2',
        participantId: 'participant-2',
        status: 'PENDING',
        requestedAt: new Date('2026-02-10T03:05:00.000Z'),
        terminalAt: null,
      },
    ]);

    const result = await service.requestUnmatch(
      {
        id: 'user-2',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'active-1',
    );

    expect(txActiveMatchUnmatchRequestUpdateMany).toHaveBeenCalledWith({
      where: {
        activeMatchId: 'active-1',
        status: 'PENDING',
      },
      data: {
        status: 'FULFILLED_BY_MUTUAL_CONSENT',
        terminalAt: new Date('2026-02-10T03:00:00.000Z'),
      },
    });
    expect(txSeasonParticipantUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['participant-1', 'participant-2'] },
      },
      data: {
        participantStatus: 'ACTIVE',
        matchedAt: null,
      },
    });
    expect(chatMatchThreadLifecycle.handleActiveMatchUnmatched).toHaveBeenCalledWith(
      expect.anything(),
      { activeMatchId: 'active-1' },
      new Date('2026-02-10T03:00:00.000Z'),
    );
    expect(result.activeMatch).toMatchObject({
      status: 'UNMATCHED',
      endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
    });
  });

  it('본인이 보낸 매칭 취소 요청은 상대가 요청하기 전까지 철회할 수 있다', async () => {
    txActiveMatchUnmatchRequestFindMany.mockResolvedValueOnce([
      {
        id: 'unmatch-1',
        participantId: 'participant-1',
        status: 'PENDING',
        requestedAt: new Date('2026-02-10T03:00:00.000Z'),
        terminalAt: null,
      },
    ]);
    txActiveMatchFindUnique
      .mockResolvedValueOnce({
        id: 'active-1',
        seasonId: 'season-1',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        status: 'ACTIVE',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: null,
        endReason: null,
        createdFromRequestId: 'request-1',
        participantA: {
          userId: 'user-1',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        participantB: {
          userId: 'user-2',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        unmatchRequests: [
          {
            id: 'unmatch-1',
            participantId: 'participant-1',
            status: 'PENDING',
            requestedAt: new Date('2026-02-10T03:00:00.000Z'),
            terminalAt: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'active-1',
        seasonId: 'season-1',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        status: 'ACTIVE',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: null,
        endReason: null,
        createdFromRequestId: 'request-1',
        participantA: {
          userId: 'user-1',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        participantB: {
          userId: 'user-2',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        unmatchRequests: [
          {
            id: 'unmatch-1',
            participantId: 'participant-1',
            status: 'CANCELLED_BY_REQUESTER',
            requestedAt: new Date('2026-02-10T03:00:00.000Z'),
            terminalAt: new Date('2026-02-10T03:00:00.000Z'),
          },
        ],
      });

    const result = await service.cancelUnmatchRequest(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'active-1',
    );

    expect(txActiveMatchUnmatchRequestUpdate).toHaveBeenCalledWith({
      where: { id: 'unmatch-1' },
      data: {
        status: 'CANCELLED_BY_REQUESTER',
        terminalAt: new Date('2026-02-10T03:00:00.000Z'),
      },
    });
    expect(result.activeMatch).toMatchObject({
      status: 'ACTIVE',
      unmatchProgress: {
        state: 'NONE',
        requestedByViewerAt: null,
        requestedByCounterpartAt: null,
        progressCount: 0,
        requiredCount: 2,
        canRequest: true,
        canCancel: false,
      },
    });
  });

  it('pending unmatch request가 없으면 cancel route는 cancel-specific error를 유지한다', async () => {
    txActiveMatchUnmatchRequestFindMany.mockResolvedValueOnce([]);

    await expect(
      service.cancelUnmatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'active-1',
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.unmatchRequestCancelNotAllowed().getResponse(),
    });

    expect(txActiveMatchUnmatchRequestUpdate).not.toHaveBeenCalled();
  });

  it('roomSelectionDate 이후 또는 SEASON_POST_MATCH에서는 매칭 취소 요청을 받을 수 없다', async () => {
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

    await expect(
      service.requestUnmatch(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'active-1',
      ),
    ).rejects.toMatchObject({
      response: matchesErrors
        .unmatchRequestNotAllowed(
          '매칭 취소는 같은 기숙사의 roomSelectionDate 전까지만 요청할 수 있습니다.',
        )
        .getResponse(),
    });
  });

  it('이미 종료된 active match에는 매칭 취소 요청을 적용하지 않는다', async () => {
    txActiveMatchFindUnique.mockResolvedValueOnce({
      id: 'active-1',
      seasonId: 'season-1',
      participantAId: 'participant-1',
      participantBId: 'participant-2',
      status: 'UNMATCHED',
      startedAt: new Date('2026-02-10T03:00:00.000Z'),
      endedAt: new Date('2026-02-10T03:05:00.000Z'),
      endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
      createdFromRequestId: 'request-1',
      participantA: {
        userId: 'user-1',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      participantB: {
        userId: 'user-2',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      unmatchRequests: [],
    });

    await expect(
      service.requestUnmatch(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'active-1',
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.unmatchRequestNotAllowed().getResponse(),
    });
  });

  it('active pair participant가 아닌 다른 auth user는 매칭 취소 요청을 보낼 수 없다', async () => {
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(makeUserSeed({ id: where.id })),
    );
    seasonParticipantsService.ensureCurrentSeasonParticipant.mockImplementation((user: UserSeed) =>
      Promise.resolve(makeParticipant({ id: `participant-${user.id}`, userId: user.id })),
    );

    await expect(
      service.requestUnmatch(
        {
          id: 'user-3',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'active-1',
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.unmatchRequestNotAllowed().getResponse(),
    });
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
      requesterParticipant: makeMatchRequestParticipant('user-1'),
      receiverParticipant: makeMatchRequestParticipant('user-2'),
    });

    await expect(
      service.acceptMatchRequest(
        {
          id: 'user-2',
          gender: 'M',
          campus: 'CHUNCHEON',
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
        },
        'request-1',
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.activeMatchAlreadyExists().getResponse(),
    });
  });

  it('UNMATCHED 직후 같은 방향 재요청에도 2일 cooldown을 적용한다', async () => {
    txMatchRequestCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    txMatchRequestFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    txActiveMatchFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      endedAt: new Date('2026-02-09T12:00:00.000Z'),
    });

    await expect(
      service.createMatchRequest(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        { targetUserId: 'user-2', note: null },
      ),
    ).rejects.toMatchObject({
      response: matchesErrors.requestDirectionCooldownActive().getResponse(),
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
    seasonParticipantsService.ensureCurrentSeasonParticipant.mockResolvedValueOnce(
      makeParticipant({
        participantStatus: 'MATCHED',
        matchedAt: new Date('2026-02-10T03:00:00.000Z'),
      }),
    );
    prisma.activeMatch.findFirst.mockResolvedValueOnce({
      id: 'active-1',
      seasonId: 'season-1',
      participantAId: 'participant-1',
      participantBId: 'participant-2',
      status: 'ACTIVE',
      startedAt: new Date('2026-02-10T03:00:00.000Z'),
      endedAt: null,
      endReason: null,
      createdFromRequestId: 'request-1',
      participantA: {
        userId: 'user-1',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      participantB: {
        userId: 'user-2',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      unmatchRequests: [],
    });

    const result = await service.getCurrentActiveMatch({
      id: 'user-1',
      gender: 'M',
      campus: 'CHUNCHEON',
    });

    expect(result.activeMatch).toMatchObject({
      id: 'active-1',
      counterpartUserId: 'user-2',
      status: 'ACTIVE',
      unmatchProgress: {
        state: 'NONE',
        progressCount: 0,
        canRequest: false,
      },
    });
  });
});
