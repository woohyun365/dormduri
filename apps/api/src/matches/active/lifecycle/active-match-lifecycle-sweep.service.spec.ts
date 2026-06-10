import { ActiveMatchRepository } from '../persistence/active-match.repository.js';
import { ActiveMatchLifecycleSweepService } from './active-match-lifecycle-sweep.service.js';

describe('ActiveMatchLifecycleSweepService', () => {
  const now = new Date('2026-02-10T03:00:00.000Z');
  const txQueryRawTyped = jest.fn();
  const txActiveMatchFindUnique = jest.fn();
  const txActiveMatchUpdate = jest.fn();
  const txActiveMatchUnmatchRequestUpdateMany = jest.fn();

  const prisma = {
    matchRequest: {
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

  const service = new ActiveMatchLifecycleSweepService(
    prisma as never,
    seasonsService as never,
    new ActiveMatchRepository(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.matchRequest.updateMany.mockResolvedValue({ count: 0 });
    prisma.activeMatch.findMany.mockResolvedValue([]);
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
      state: 'SEASON_MATCHING',
      operatedDormitories: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
      ],
      schedule: {
        preparationStart: '2026-02-01',
        matchingStart: '2026-02-05',
        matchingEnd: '2026-02-12',
        seasonEnd: '2026-02-28',
      },
    });
    txQueryRawTyped.mockResolvedValue([{ lockAcquired: null }]);
    txActiveMatchFindUnique.mockResolvedValue(null);
    txActiveMatchUpdate.mockResolvedValue({ id: 'active-1' });
    txActiveMatchUnmatchRequestUpdateMany.mockResolvedValue({ count: 0 });
    prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        $queryRawTyped: txQueryRawTyped,
        activeMatch: {
          findUnique: txActiveMatchFindUnique,
          update: txActiveMatchUpdate,
        },
        activeMatchUnmatchRequest: {
          updateMany: txActiveMatchUnmatchRequestUpdateMany,
        },
      }),
    );
  });

  it('expires pending match requests before active match lifecycle transitions', async () => {
    prisma.matchRequest.updateMany.mockResolvedValueOnce({ count: 2 });

    await expect(service.sweepMatchLifecycleTransitions(now)).resolves.toEqual({
      expiredRequests: 2,
      expiredUnmatchRequests: 0,
      seasonEndedActiveMatches: 0,
    });
    expect(prisma.matchRequest.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'PENDING',
        expiresAt: { lte: now },
      },
      data: {
        status: 'EXPIRED',
        terminalReason: 'EXPIRED',
        terminalAt: now,
      },
    });
  });

  it('ends ACTIVE matches when the current season disappears and expires pending unmatch requests', async () => {
    prisma.activeMatch.findMany.mockResolvedValueOnce([
      {
        id: 'active-1',
        seasonId: 'season-1',
        season: { campusCode: 'CHUNCHEON' },
      },
    ]);
    seasonsService.getCurrentSeasonContext.mockResolvedValueOnce(null);
    txActiveMatchFindUnique.mockResolvedValueOnce({
      id: 'active-1',
      seasonId: 'season-1',
      participantAId: 'participant-1',
      participantBId: 'participant-2',
      status: 'ACTIVE',
      startedAt: now,
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
          requestedAt: now,
          terminalAt: null,
        },
      ],
    });
    txActiveMatchUnmatchRequestUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await service.sweepMatchLifecycleTransitions(now);

    expect(txActiveMatchUnmatchRequestUpdateMany).toHaveBeenCalledWith({
      where: {
        activeMatchId: 'active-1',
        status: 'PENDING',
      },
      data: {
        status: 'EXPIRED_BY_CUTOFF',
        terminalAt: now,
      },
    });
    expect(txActiveMatchUpdate).toHaveBeenCalledWith({
      where: { id: 'active-1' },
      data: {
        status: 'SEASON_ENDED',
        endedAt: now,
        endReason: 'SEASON_ENDED',
      },
    });
    expect(result).toEqual({
      expiredRequests: 0,
      expiredUnmatchRequests: 1,
      seasonEndedActiveMatches: 1,
    });
  });

  it('expires only pending unmatch requests after the room-selection cutoff in the same season', async () => {
    prisma.activeMatch.findMany.mockResolvedValueOnce([
      {
        id: 'active-1',
        seasonId: 'season-1',
        season: { campusCode: 'CHUNCHEON' },
      },
    ]);
    seasonsService.getCurrentSeasonContext.mockResolvedValueOnce({
      season: { id: 'season-1' },
      state: 'SEASON_MATCHING',
      operatedDormitories: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-09' },
      ],
      schedule: {
        preparationStart: '2026-02-01',
        matchingStart: '2026-02-05',
        matchingEnd: '2026-02-09',
        seasonEnd: '2026-02-28',
      },
    });
    txActiveMatchFindUnique
      .mockResolvedValueOnce({
        id: 'active-1',
        seasonId: 'season-1',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        status: 'ACTIVE',
        startedAt: new Date('2026-02-08T03:00:00.000Z'),
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
            requestedAt: new Date('2026-02-08T03:00:00.000Z'),
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
        startedAt: new Date('2026-02-08T03:00:00.000Z'),
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
    txActiveMatchUnmatchRequestUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await service.sweepMatchLifecycleTransitions(now);

    expect(txActiveMatchUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({
      expiredRequests: 0,
      expiredUnmatchRequests: 1,
      seasonEndedActiveMatches: 0,
    });
  });
});
