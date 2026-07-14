import { describe, expect, it, vi } from 'vitest';
import {
  makeMatchRequestParticipant,
  makeParticipant,
  makeUserSeed,
} from '../test-support/matches-service-spec.harness.js';
import { MatchOverviewQuery } from './match-overview.query.js';

const now = new Date('2026-02-10T03:00:00.000Z');

function makeHarness() {
  const transaction = {
    matchRequest: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    activeMatch: {
      findFirst: vi.fn(),
    },
  };
  const runSerializableTransaction = vi.fn(
    async <T>(operation: (tx: typeof transaction) => Promise<T>): Promise<T> =>
      operation(transaction),
  );
  const prisma = {
    getDatabaseNow: vi.fn().mockResolvedValue(now),
    user: { findUnique: vi.fn().mockResolvedValue(makeUserSeed()) },
    runSerializableTransaction,
  };
  const seasonsService = {
    getCurrentSeasonContext: vi.fn().mockResolvedValue({
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
    }),
  };
  const seasonParticipantsService = {
    ensureCurrentSeasonParticipant: vi.fn().mockResolvedValue(makeParticipant()),
    selectCanonicalSelection: vi.fn().mockReturnValue({
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      source: 'SEASON_PARTICIPANT',
    }),
  };
  const activeMatchViewQuery = { getDetailedActiveMatchSummaryForViewer: vi.fn() };

  return {
    ...{ prisma, seasonsService, seasonParticipantsService, transaction, activeMatchViewQuery },
    query: new MatchOverviewQuery(
      prisma as never,
      seasonsService as never,
      seasonParticipantsService as never,
      activeMatchViewQuery as never,
    ),
  };
}

describe('MatchOverviewQuery', () => {
  it('current request와 active match를 하나의 serializable read snapshot에서 분리해 반환한다', async () => {
    const harness = makeHarness();
    harness.transaction.matchRequest.findMany.mockResolvedValue([
      {
        id: 'request-sent',
        seasonId: 'season-1',
        requesterParticipantId: 'participant-1',
        receiverParticipantId: 'participant-2',
        status: 'PENDING',
        note: null,
        createdAt: now,
        expiresAt: new Date('2026-02-11T03:00:00.000Z'),
        terminalAt: null,
        acceptedAt: null,
        terminalReason: null,
        requesterParticipant: makeMatchRequestParticipant('user-1'),
        receiverParticipant: makeMatchRequestParticipant('user-2'),
      },
    ]);
    harness.transaction.activeMatch.findFirst.mockResolvedValue(null);

    await expect(
      harness.query.execute({ id: 'user-1', campus: 'CHUNCHEON', gender: 'M' } as never),
    ).resolves.toMatchObject({
      serverNow: now.toISOString(),
      season: { id: 'season-1', state: 'SEASON_MATCHING', roomSelectionDate: '2026-02-11' },
      capability: { canViewMatching: true, reason: null },
      sentRequests: [
        {
          id: 'request-sent',
          actions: { canCancel: true, disabledReason: null },
        },
      ],
      receivedRequests: [],
      activeMatch: null,
    });

    expect(harness.prisma.runSerializableTransaction).toHaveBeenCalledTimes(1);
    expect(harness.transaction.matchRequest.updateMany).toHaveBeenCalledTimes(1);
  });

  it('운영 중인 현재 season이 없으면 fail-closed capability와 빈 current snapshot을 반환한다', async () => {
    const harness = makeHarness();
    harness.seasonsService.getCurrentSeasonContext.mockResolvedValue(null);

    await expect(
      harness.query.execute({ id: 'user-1', campus: 'CHUNCHEON', gender: 'M' } as never),
    ).resolves.toMatchObject({
      season: { id: null, state: 'OFF_SEASON', roomSelectionDate: null },
      capability: { canViewMatching: false, reason: 'CAMPUS_NOT_OPERATED' },
      sentRequests: [],
      receivedRequests: [],
      activeMatch: null,
    });
    expect(harness.prisma.runSerializableTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ['hidden', { hiddenByAdminAt: now }],
    ['deactivated', { deactivatedAt: now }],
    ['withdrawn', { withdrawnAt: now, participantStatus: 'WITHDRAWN' }],
    ['deleted', { user: { deletedAt: now } }],
  ])('%s counterpart의 pending request action을 fail-closed 처리한다', async (_, overrides) => {
    const harness = makeHarness();
    harness.transaction.matchRequest.findMany.mockResolvedValue([
      {
        id: 'request-unavailable-target',
        seasonId: 'season-1',
        requesterParticipantId: 'participant-1',
        receiverParticipantId: 'participant-2',
        status: 'PENDING',
        note: null,
        createdAt: now,
        expiresAt: new Date('2026-02-11T03:00:00.000Z'),
        terminalAt: null,
        acceptedAt: null,
        terminalReason: null,
        requesterParticipant: makeMatchRequestParticipant('user-1'),
        receiverParticipant: makeMatchRequestParticipant('user-2', overrides),
      },
    ]);
    harness.transaction.activeMatch.findFirst.mockResolvedValue(null);

    await expect(
      harness.query.execute({ id: 'user-1', campus: 'CHUNCHEON', gender: 'M' } as never),
    ).resolves.toMatchObject({
      sentRequests: [
        {
          id: 'request-unavailable-target',
          actions: {
            canAccept: false,
            canReject: false,
            canCancel: false,
            disabledReason: 'TARGET_UNAVAILABLE',
          },
        },
      ],
    });
  });
});
