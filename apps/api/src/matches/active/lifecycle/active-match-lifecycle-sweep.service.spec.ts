import { ActiveMatchLifecycleEventRepository } from '../lifecycle-events/active-match-lifecycle-event.repository.js';
import { ActiveMatchLifecycleEventWriter } from '../lifecycle-events/active-match-lifecycle-event.writer.js';
import { ActiveMatchRepository } from '../persistence/active-match.repository.js';
import { ActiveMatchLifecycleSweepService } from './active-match-lifecycle-sweep.service.js';

const now = new Date('2026-02-10T03:00:00.000Z');

function activeMatchRecord(overrides: Record<string, unknown> = {}) {
  return {
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
    unmatchRequests: [],
    ...overrides,
  };
}

function pendingUnmatchRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'unmatch-1',
    participantId: 'participant-1',
    status: 'PENDING',
    requestedAt: new Date('2026-02-08T03:00:00.000Z'),
    terminalAt: null,
    ...overrides,
  };
}

function expiredUnmatchRequest(overrides: Record<string, unknown> = {}) {
  return {
    ...pendingUnmatchRequest(),
    status: 'EXPIRED_BY_CUTOFF',
    terminalAt: now,
    ...overrides,
  };
}

describe('ActiveMatchLifecycleSweepService', () => {
  const txQueryRawTyped = jest.fn();
  const txActiveMatchFindUnique = jest.fn();
  const txActiveMatchUpdate = jest.fn();
  const txActiveMatchUnmatchRequestUpdateManyAndReturn = jest.fn();
  const txActiveMatchLifecycleEventCreate = jest.fn();

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
    new ActiveMatchLifecycleEventWriter(new ActiveMatchLifecycleEventRepository()),
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
    txActiveMatchUnmatchRequestUpdateManyAndReturn.mockResolvedValue([]);
    txActiveMatchLifecycleEventCreate.mockResolvedValue({ id: 'event-1' });
    prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        $queryRawTyped: txQueryRawTyped,
        activeMatch: {
          findUnique: txActiveMatchFindUnique,
          update: txActiveMatchUpdate,
        },
        activeMatchUnmatchRequest: {
          updateManyAndReturn: txActiveMatchUnmatchRequestUpdateManyAndReturn,
        },
        activeMatchLifecycleEvent: {
          create: txActiveMatchLifecycleEventCreate,
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
    expect(txActiveMatchLifecycleEventCreate).not.toHaveBeenCalled();
  });

  it('ends ACTIVE matches when the current season disappears and appends expiry/season-ended events', async () => {
    prisma.activeMatch.findMany.mockResolvedValueOnce([
      {
        id: 'active-1',
        seasonId: 'season-1',
        season: { campusCode: 'CHUNCHEON' },
      },
    ]);
    seasonsService.getCurrentSeasonContext.mockResolvedValueOnce(null);
    txActiveMatchFindUnique.mockResolvedValueOnce(
      activeMatchRecord({
        unmatchRequests: [pendingUnmatchRequest()],
      }),
    );
    txActiveMatchUnmatchRequestUpdateManyAndReturn.mockResolvedValueOnce([expiredUnmatchRequest()]);

    const result = await service.sweepMatchLifecycleTransitions(now);

    expect(txActiveMatchUnmatchRequestUpdateManyAndReturn).toHaveBeenCalledWith({
      where: {
        activeMatchId: 'active-1',
        status: 'PENDING',
      },
      data: {
        status: 'EXPIRED_BY_CUTOFF',
        terminalAt: now,
      },
      select: {
        id: true,
        participantId: true,
        status: true,
        requestedAt: true,
        terminalAt: true,
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
    expect(txActiveMatchLifecycleEventCreate).toHaveBeenCalledTimes(2);
    const lifecycleEventCreateCalls = txActiveMatchLifecycleEventCreate.mock.calls as Array<
      [unknown]
    >;
    const expiredEventCreateInput = lifecycleEventCreateCalls[0]?.[0];
    const seasonEndedEventCreateInput = lifecycleEventCreateCalls[1]?.[0];
    expect(expiredEventCreateInput).toMatchObject({
      data: {
        activeMatchId: 'active-1',
        eventType: 'UNMATCH_REQUEST_EXPIRED',
        reason: 'ROOM_SELECTION_CUTOFF',
        actorType: 'SYSTEM',
        sourceUnmatchRequestId: 'unmatch-1',
        metadata: {
          transitionOwner: 'match.season-end.expire-unmatch-request',
          previousStatus: 'ACTIVE',
          nextStatus: 'ACTIVE',
          unmatchRequestStatus: 'EXPIRED_BY_CUTOFF',
          expiredUnmatchRequestCount: 1,
          seasonState: 'NO_CURRENT_SEASON',
        },
      },
    });
    expect(seasonEndedEventCreateInput).toMatchObject({
      data: {
        activeMatchId: 'active-1',
        eventType: 'SEASON_ENDED',
        reason: 'SEASON_ENDED_SWEEP',
        actorType: 'SYSTEM',
        metadata: {
          transitionOwner: 'match.season-end',
          previousStatus: 'ACTIVE',
          nextStatus: 'SEASON_ENDED',
          previousEndReason: null,
          nextEndReason: 'SEASON_ENDED',
          expiredUnmatchRequestCount: 1,
          seasonState: 'NO_CURRENT_SEASON',
        },
      },
    });
    expect(txActiveMatchLifecycleEventCreate.mock.invocationCallOrder[0]).toBeLessThan(
      txActiveMatchLifecycleEventCreate.mock.invocationCallOrder[1] ?? Number.POSITIVE_INFINITY,
    );
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
    txActiveMatchFindUnique.mockResolvedValueOnce(
      activeMatchRecord({
        startedAt: new Date('2026-02-08T03:00:00.000Z'),
        unmatchRequests: [pendingUnmatchRequest()],
      }),
    );
    txActiveMatchUnmatchRequestUpdateManyAndReturn.mockResolvedValueOnce([expiredUnmatchRequest()]);

    const result = await service.sweepMatchLifecycleTransitions(now);

    expect(txActiveMatchUpdate).not.toHaveBeenCalled();
    expect(txActiveMatchLifecycleEventCreate).toHaveBeenCalledTimes(1);
    expect(txActiveMatchLifecycleEventCreate).toHaveBeenCalledWith({
      data: {
        activeMatchId: 'active-1',
        eventType: 'UNMATCH_REQUEST_EXPIRED',
        reason: 'ROOM_SELECTION_CUTOFF',
        actorType: 'SYSTEM',
        actorUserId: undefined,
        sourceMatchRequestId: undefined,
        sourceUnmatchRequestId: 'unmatch-1',
        occurredAt: now,
        metadata: {
          transitionOwner: 'match.unmatch.expire',
          previousStatus: 'ACTIVE',
          nextStatus: 'ACTIVE',
          unmatchRequestStatus: 'EXPIRED_BY_CUTOFF',
          expiredUnmatchRequestCount: 1,
          roomSelectionDate: '2026-02-09',
        },
      },
    });
    expect(result).toEqual({
      expiredRequests: 0,
      expiredUnmatchRequests: 1,
      seasonEndedActiveMatches: 0,
    });
  });

  it('keeps event log empty when the room-selection cutoff is still open', async () => {
    prisma.activeMatch.findMany.mockResolvedValueOnce([
      {
        id: 'active-1',
        seasonId: 'season-1',
        season: { campusCode: 'CHUNCHEON' },
      },
    ]);
    txActiveMatchFindUnique.mockResolvedValueOnce(
      activeMatchRecord({
        unmatchRequests: [pendingUnmatchRequest()],
      }),
    );

    const result = await service.sweepMatchLifecycleTransitions(now);

    expect(txActiveMatchUnmatchRequestUpdateManyAndReturn).not.toHaveBeenCalled();
    expect(txActiveMatchLifecycleEventCreate).not.toHaveBeenCalled();
    expect(result).toEqual({
      expiredRequests: 0,
      expiredUnmatchRequests: 0,
      seasonEndedActiveMatches: 0,
    });
  });

  it('keeps event log empty when there is no pending unmatch request', async () => {
    prisma.activeMatch.findMany.mockResolvedValueOnce([
      {
        id: 'active-1',
        seasonId: 'season-1',
        season: { campusCode: 'CHUNCHEON' },
      },
    ]);
    txActiveMatchFindUnique.mockResolvedValueOnce(activeMatchRecord());

    const result = await service.sweepMatchLifecycleTransitions(now);

    expect(txActiveMatchUnmatchRequestUpdateManyAndReturn).not.toHaveBeenCalled();
    expect(txActiveMatchLifecycleEventCreate).not.toHaveBeenCalled();
    expect(result).toEqual({
      expiredRequests: 0,
      expiredUnmatchRequests: 0,
      seasonEndedActiveMatches: 0,
    });
  });

  it('keeps event log empty when a locked active match is already terminal', async () => {
    prisma.activeMatch.findMany.mockResolvedValueOnce([
      {
        id: 'active-1',
        seasonId: 'season-1',
        season: { campusCode: 'CHUNCHEON' },
      },
    ]);
    txActiveMatchFindUnique.mockResolvedValueOnce(
      activeMatchRecord({
        status: 'UNMATCHED',
        endedAt: now,
        endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
      }),
    );

    const result = await service.sweepMatchLifecycleTransitions(now);

    expect(txActiveMatchUnmatchRequestUpdateManyAndReturn).not.toHaveBeenCalled();
    expect(txActiveMatchUpdate).not.toHaveBeenCalled();
    expect(txActiveMatchLifecycleEventCreate).not.toHaveBeenCalled();
    expect(result).toEqual({
      expiredRequests: 0,
      expiredUnmatchRequests: 0,
      seasonEndedActiveMatches: 0,
    });
  });

  it('does not append stale expiry events when no pending rows are actually updated', async () => {
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
    txActiveMatchFindUnique.mockResolvedValueOnce(
      activeMatchRecord({
        unmatchRequests: [pendingUnmatchRequest()],
      }),
    );
    txActiveMatchUnmatchRequestUpdateManyAndReturn.mockResolvedValueOnce([]);

    const result = await service.sweepMatchLifecycleTransitions(now);

    expect(txActiveMatchLifecycleEventCreate).not.toHaveBeenCalled();
    expect(result).toEqual({
      expiredRequests: 0,
      expiredUnmatchRequests: 0,
      seasonEndedActiveMatches: 0,
    });
  });
});
