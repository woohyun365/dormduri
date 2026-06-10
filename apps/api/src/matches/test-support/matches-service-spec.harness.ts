import { MatchesService } from '../matches.service.js';
import { CancelUnmatchRequestCommand } from '../active/commands/cancel-unmatch-request.command.js';
import { RequestUnmatchCommand } from '../active/commands/request-unmatch.command.js';
import { ActiveMatchLifecycleEventRepository } from '../active/lifecycle-events/active-match-lifecycle-event.repository.js';
import { ActiveMatchLifecycleEventWriter } from '../active/lifecycle-events/active-match-lifecycle-event.writer.js';
import { ActiveMatchRepository } from '../active/persistence/active-match.repository.js';
import { ActiveMatchViewQuery } from '../active/queries/active-match-view.query.js';
import { MatchRequestNoteModerationAdapter } from '../requests/adapters/match-request-note-moderation.adapter.js';
import { AcceptMatchRequestCommand } from '../requests/commands/accept-match-request.command.js';
import { CancelMatchRequestCommand } from '../requests/commands/cancel-match-request.command.js';
import { CreateMatchRequestCommand } from '../requests/commands/create-match-request.command.js';
import { RejectMatchRequestCommand } from '../requests/commands/reject-match-request.command.js';
import { ResolveTerminalMatchRequestCommand } from '../requests/commands/resolve-terminal-match-request.command.js';
import { MatchRequestCreationEvaluator } from '../requests/eligibility/match-request-creation.evaluator.js';
import { MatchRequestAcceptanceRepository } from '../requests/persistence/match-request-acceptance.repository.js';
import { MatchRequestRepository } from '../requests/persistence/match-request.repository.js';
import { ListCurrentSeasonRequestsQuery } from '../requests/queries/list-current-season-requests.query.js';
import type {
  CanonicalSelectionState,
  CurrentSeasonParticipantRecord,
} from '../../season-participants/application/season-participants.service.js';

export type UserSeed = {
  id: string;
  emailVerifiedAt: Date | null;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
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
    profile: {
      lifestyle: COMPLETE_LIFESTYLE,
    },
    ...overrides,
  };
}

export function makeMatchRequestParticipant(
  userId: string,
  overrides: Record<string, unknown> = {},
) {
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
    profile: {
      participantId: 'participant-1',
      lifestyle: COMPLETE_LIFESTYLE,
    } as never,
    ...overrides,
  };
}

export function createMatchesServiceSpecHarness() {
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
  const txActiveMatchLifecycleEventCreate = jest.fn();
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
  const activeMatchLifecycleEventWriter = new ActiveMatchLifecycleEventWriter(
    new ActiveMatchLifecycleEventRepository(),
  );
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
  const matchHistoryMaterializationService = {
    materializeEndedSeasonHistory: jest.fn(),
    materializeSeasonHistoryById: jest.fn(),
  };
  const matchHistoryQueryService = {
    listPastSeasonHistoryForUser: jest.fn(),
    getFinalCounterpartProfileForEntry: jest.fn(),
  };

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
      activeMatchLifecycleEventWriter,
    ),
    new RejectMatchRequestCommand(resolveTerminalMatchRequestCommand),
    new CancelMatchRequestCommand(resolveTerminalMatchRequestCommand),
    new RequestUnmatchCommand(
      prisma as never,
      seasonsService as never,
      seasonParticipantsService as never,
      chatMatchThreadLifecycle as never,
      activeMatchRepository,
      activeMatchLifecycleEventWriter,
    ),
    new CancelUnmatchRequestCommand(
      prisma as never,
      seasonsService as never,
      seasonParticipantsService as never,
      activeMatchRepository,
      activeMatchLifecycleEventWriter,
    ),
    matchHistoryMaterializationService as never,
    matchHistoryQueryService as never,
  );

  const reset = () => {
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
    txActiveMatchLifecycleEventCreate.mockResolvedValue({
      id: 'active-match-lifecycle-event-1',
    });
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
        activeMatchLifecycleEvent: {
          create: txActiveMatchLifecycleEventCreate,
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
  };

  return {
    reset,
    txQueryRaw,
    txQueryRawTyped,
    txMatchRequestFindFirst,
    txMatchRequestCount,
    txMatchRequestCreate,
    txMatchRequestFindUnique,
    txMatchRequestUpdate,
    txMatchRequestUpdateMany,
    txActiveMatchFindFirst,
    txActiveMatchFindUnique,
    txActiveMatchCreate,
    txActiveMatchUpdate,
    txActiveMatchUnmatchRequestCreate,
    txActiveMatchUnmatchRequestFindMany,
    txActiveMatchUnmatchRequestUpdate,
    txActiveMatchUnmatchRequestUpdateMany,
    txActiveMatchLifecycleEventCreate,
    txSeasonParticipantFindMany,
    txSeasonParticipantUpdateMany,
    txSeasonDormitoryOperationFindUnique,
    txSeasonParticipantProfileHistoryCount,
    prisma,
    seasonsService,
    moderationService,
    seasonParticipantsService,
    chatMatchThreadLifecycle,
    activeMatchRepository,
    activeMatchLifecycleEventWriter,
    activeMatchViewQuery,
    matchRequestRepository,
    matchRequestAcceptanceRepository,
    matchRequestCreationEvaluator,
    listCurrentSeasonRequestsQuery,
    resolveTerminalMatchRequestCommand,
    matchHistoryMaterializationService,
    matchHistoryQueryService,
    service,
  };
}
