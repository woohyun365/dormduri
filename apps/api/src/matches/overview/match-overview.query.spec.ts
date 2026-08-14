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
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const runSerializableTransaction = vi.fn(
    async <T>(operation: (tx: typeof transaction) => Promise<T>): Promise<T> =>
      operation(transaction),
  );
  const prisma = {
    getDatabaseNow: vi.fn().mockResolvedValue(now),
    user: { findUnique: vi.fn().mockResolvedValue(makeUserSeed()) },
    campusMaster: { findUnique: vi.fn().mockResolvedValue({ isOperated: true }) },
    runSerializableTransaction,
  };
  const seasonsService = {
    getCurrentSeasonContext: vi.fn().mockResolvedValue({
      season: { id: 'season-1', seasonEndDate: '2026-02-28' },
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
    findRegistrationSnapshotParticipantIdSet: vi
      .fn()
      .mockResolvedValue(new Set(['participant-1', 'participant-2'])),
  };
  const activeMatchViewQuery = { getDetailedActiveMatchSummaryForViewer: vi.fn() };
  const chatThreadSearchMetadataReader = {
    getActiveThreadMetadata: vi.fn().mockResolvedValue(new Map()),
  };

  return {
    ...{
      prisma,
      seasonsService,
      seasonParticipantsService,
      transaction,
      activeMatchViewQuery,
      chatThreadSearchMetadataReader,
    },
    query: new MatchOverviewQuery(
      prisma as never,
      seasonsService as never,
      seasonParticipantsService as never,
      activeMatchViewQuery as never,
      chatThreadSearchMetadataReader,
    ),
  };
}

describe('MatchOverviewQuery', () => {
  it('current request와 active match를 하나의 serializable read snapshot에서 분리해 반환한다', async () => {
    const harness = makeHarness();
    harness.chatThreadSearchMetadataReader.getActiveThreadMetadata.mockResolvedValue(
      new Map([
        [
          'participant-2',
          {
            threadId: 'thread-1',
            targetParticipantId: 'participant-2',
            threadKind: 'DIRECT',
            status: 'OPEN',
            lastMessageAt: now,
          },
        ],
      ]),
    );
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
        systemCancellationActiveMatchId: null,
        systemCancellationActiveMatch: null,
        requesterParticipant: makeMatchRequestParticipant('user-1'),
        receiverParticipant: makeMatchRequestParticipant('user-2'),
      },
    ]);
    const result = await harness.query.execute({
      id: 'user-1',
      campus: 'CHUNCHEON',
      gender: 'M',
    } as never);
    expect(result).toMatchObject({
      serverNow: now.toISOString(),
      season: {
        id: 'season-1',
        state: 'SEASON_MATCHING',
        roomSelectionDate: '2026-02-11',
        seasonEndDate: '2026-02-28',
      },
      capability: { canViewMatching: true, reason: null },
      sentRequests: [
        {
          id: 'request-sent',
          actions: { cancel: { allowed: true, reason: null } },
          counterpartSummary: {
            actions: { canStartChat: true },
            activeChatThread: {
              id: 'thread-1',
              threadKind: 'DIRECT',
              status: 'OPEN',
              lastMessageAt: now.toISOString(),
            },
            exposure: {
              detailViewable: true,
              canViewFull: true,
              scoreVisible: true,
            },
          },
        },
      ],
      receivedRequests: [],
      activeMatch: null,
      activity: [],
    });
    expect(typeof result.sentRequests[0]?.counterpartSummary.detailEntryToken).toBe('string');
    expect(typeof result.sentRequests[0]?.counterpartSummary.matchScore).toBe('number');
    expect(harness.chatThreadSearchMetadataReader.getActiveThreadMetadata).toHaveBeenCalledWith({
      seasonId: 'season-1',
      viewerParticipantId: 'participant-1',
      targetParticipantIds: ['participant-2'],
    });

    expect(harness.prisma.runSerializableTransaction).toHaveBeenCalledTimes(1);
    expect(harness.transaction.matchRequest.updateMany).toHaveBeenCalledTimes(1);
    expect(harness.transaction.activeMatch.findMany).toHaveBeenCalledTimes(2);
  });

  it('시즌 참여 철회 viewer는 action surface를 닫고 viewer-owned current activity는 유지한다', async () => {
    const harness = makeHarness();
    harness.seasonParticipantsService.ensureCurrentSeasonParticipant.mockResolvedValue(
      makeParticipant({
        participantStatus: 'WITHDRAWN',
        withdrawnAt: now,
      }),
    );
    harness.transaction.matchRequest.findMany.mockResolvedValue([
      {
        id: 'request-withdrawn',
        seasonId: 'season-1',
        requesterParticipantId: 'participant-1',
        receiverParticipantId: 'participant-2',
        status: 'CANCELLED_BY_SYSTEM',
        note: null,
        createdAt: new Date('2026-02-08T03:00:00.000Z'),
        expiresAt: new Date('2026-02-11T03:00:00.000Z'),
        terminalAt: now,
        acceptedAt: null,
        terminalReason: 'WITHDRAWN_PARTICIPANT',
        systemCancellationActiveMatchId: null,
        systemCancellationActiveMatch: null,
        requesterParticipant: makeMatchRequestParticipant('user-1', {
          participantStatus: 'WITHDRAWN',
          withdrawnAt: now,
        }),
        receiverParticipant: makeMatchRequestParticipant('user-2'),
      },
    ]);

    await expect(
      harness.query.execute({ id: 'user-1', campus: 'CHUNCHEON', gender: 'M' } as never),
    ).resolves.toMatchObject({
      capability: { canViewMatching: false, reason: 'VIEWER_DEREGISTERED' },
      sentRequests: [],
      receivedRequests: [],
      activeMatch: null,
      activity: [
        {
          result: 'REQUEST_CANCELLED',
          requestTerminalReason: 'WITHDRAWN_PARTICIPANT',
        },
      ],
    });
    expect(harness.chatThreadSearchMetadataReader.getActiveThreadMetadata).not.toHaveBeenCalled();
    expect(
      harness.activeMatchViewQuery.getDetailedActiveMatchSummaryForViewer,
    ).not.toHaveBeenCalled();
  });

  it('운영 campus에 현재 season이 없으면 OFF_SEASON history 진입을 허용하고 current action은 비운다', async () => {
    const harness = makeHarness();
    harness.seasonsService.getCurrentSeasonContext.mockResolvedValue(null);

    await expect(
      harness.query.execute({ id: 'user-1', campus: 'CHUNCHEON', gender: 'M' } as never),
    ).resolves.toMatchObject({
      season: { id: null, state: 'OFF_SEASON', roomSelectionDate: null, seasonEndDate: null },
      capability: { canViewMatching: true, reason: null },
      sentRequests: [],
      receivedRequests: [],
      activeMatch: null,
      activity: [],
    });
    expect(harness.prisma.runSerializableTransaction).not.toHaveBeenCalled();
  });

  it('비운영 campus에는 OFF_SEASON history surface를 열지 않는다', async () => {
    const harness = makeHarness();
    harness.seasonsService.getCurrentSeasonContext.mockResolvedValue(null);
    harness.prisma.campusMaster.findUnique.mockResolvedValue({ isOperated: false });

    await expect(
      harness.query.execute({ id: 'user-1', campus: 'CHUNCHEON', gender: 'M' } as never),
    ).resolves.toMatchObject({
      season: { id: null, state: 'OFF_SEASON', roomSelectionDate: null, seasonEndDate: null },
      capability: { canViewMatching: false, reason: 'CAMPUS_NOT_OPERATED' },
    });
  });

  it('운영자 override OFF_SEASON도 history-only surface로 반환한다', async () => {
    const harness = makeHarness();
    harness.seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
      state: 'OFF_SEASON',
      operatedDormitories: [],
      schedule: {
        preparationStart: '2026-02-01',
        matchingStart: '2026-02-05',
        matchingEnd: '2026-02-11',
        seasonEnd: '2026-02-28',
      },
    });

    await expect(
      harness.query.execute({ id: 'user-1', campus: 'CHUNCHEON', gender: 'M' } as never),
    ).resolves.toMatchObject({
      season: {
        id: 'season-1',
        state: 'OFF_SEASON',
        roomSelectionDate: null,
        seasonEndDate: null,
      },
      capability: { canViewMatching: true, reason: null },
      sentRequests: [],
      receivedRequests: [],
      activeMatch: null,
      activity: [],
    });
    expect(harness.prisma.runSerializableTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ['hidden', { hiddenByAdminAt: now }],
    ['deactivated', { deactivatedAt: now }],
    ['withdrawn', { withdrawnAt: now, participantStatus: 'WITHDRAWN' }],
    ['deleted', { user: { deletedAt: now } }],
  ])(
    '%s requester의 pending request는 수락만 fail-closed하고 거절은 유지한다',
    async (_, overrides) => {
      const harness = makeHarness();
      harness.transaction.matchRequest.findMany.mockResolvedValue([
        {
          id: 'request-unavailable-target',
          seasonId: 'season-1',
          requesterParticipantId: 'participant-2',
          receiverParticipantId: 'participant-1',
          status: 'PENDING',
          note: null,
          createdAt: now,
          expiresAt: new Date('2026-02-11T03:00:00.000Z'),
          terminalAt: null,
          acceptedAt: null,
          terminalReason: null,
          systemCancellationActiveMatchId: null,
          systemCancellationActiveMatch: null,
          requesterParticipant: makeMatchRequestParticipant('user-2', overrides),
          receiverParticipant: makeMatchRequestParticipant('user-1'),
        },
      ]);
      const result = await harness.query.execute({
        id: 'user-1',
        campus: 'CHUNCHEON',
        gender: 'M',
      } as never);
      expect(result).toMatchObject({
        receivedRequests: [
          {
            id: 'request-unavailable-target',
            actions: {
              accept: { allowed: false, reason: 'TARGET_UNAVAILABLE' },
              reject: { allowed: true, reason: null },
              cancel: { allowed: false, reason: null },
            },
            counterpartSummary: {
              exposure: {
                detailViewable: true,
                canViewFull: false,
                scoreVisible: false,
              },
            },
          },
        ],
      });
      expect(typeof result.receivedRequests[0]?.counterpartSummary.detailEntryToken).toBe('string');
    },
  );

  it('participant row가 존재해도 canonical registration aggregate가 불완전하면 미등록으로 투영한다', async () => {
    const harness = makeHarness();
    harness.seasonParticipantsService.ensureCurrentSeasonParticipant.mockResolvedValue(
      makeParticipant({
        participationIntent: 'UNDECIDED',
        registeredAt: null,
        dormitorySelectionState: 'ASSIGNED',
        dormitoryId: 'dasan',
      }),
    );
    harness.transaction.matchRequest.findMany.mockResolvedValue([]);

    await expect(
      harness.query.execute({ id: 'user-1', campus: 'CHUNCHEON', gender: 'M' } as never),
    ).resolves.toMatchObject({
      season: { id: 'season-1', state: 'SEASON_MATCHING' },
      capability: { canViewMatching: false, reason: 'VIEWER_NOT_REGISTERED' },
    });
  });

  it('registration snapshot이 없으면 live row가 완전해 보여도 미등록으로 투영한다', async () => {
    const harness = makeHarness();
    harness.seasonParticipantsService.findRegistrationSnapshotParticipantIdSet.mockResolvedValue(
      new Set(['participant-2']),
    );
    harness.transaction.matchRequest.findMany.mockResolvedValue([]);

    await expect(
      harness.query.execute({ id: 'user-1', campus: 'CHUNCHEON', gender: 'M' } as never),
    ).resolves.toMatchObject({
      capability: { canViewMatching: false, reason: 'VIEWER_NOT_REGISTERED' },
    });
  });
});
