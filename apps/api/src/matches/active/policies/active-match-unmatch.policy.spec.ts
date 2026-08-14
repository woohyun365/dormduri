import { describe, expect, it } from 'vitest';
import {
  assertCurrentSeasonActiveMatch,
  assertUnmatchActorAllowed,
  assertUnmatchWindowOpen,
  countPendingUnmatchRequests,
  findViewerPendingUnmatchRequest,
  isUnmatchWindowOpen,
} from './active-match-unmatch.policy.js';
import type { CurrentSeasonContext } from '../../../seasons/ports/season-context.port.js';
import type { ActiveMatchCommandRecord } from '../persistence/active-match.select.js';

function makeSeasonContext(overrides: Partial<CurrentSeasonContext> = {}): CurrentSeasonContext {
  return {
    campusCode: 'CHUNCHEON',
    season: {
      id: 'season-1',
      name: '2026-1',
      preparationStartDate: '2026-02-01',
      matchingStartDate: '2026-02-05',
      seasonEndDate: '2026-02-28',
    },
    operatedDormitories: [
      {
        dormitoryId: 'dasan',
        isOperated: true,
        roomSelectionDate: '2026-02-12',
      },
    ],
    state: 'SEASON_MATCHING',
    isActive: true,
    isOpen: false,
    isMatching: true,
    isPostMatch: false,
    daysUntilMatchingEnd: 2,
    daysUntilSeasonEnd: 18,
    schedule: {
      preparationStart: '2026-02-01',
      matchingStart: '2026-02-05',
      matchingEnd: '2026-02-12',
      seasonEnd: '2026-02-28',
    },
    override: {
      active: false,
      state: null,
      reason: null,
      startedAt: null,
      endsAt: null,
    },
    ...overrides,
  };
}

function makeActiveMatch(
  overrides: Partial<ActiveMatchCommandRecord> = {},
): ActiveMatchCommandRecord {
  return {
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
      user: { deletedAt: null },
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      profile: null,
    },
    participantB: {
      userId: 'user-2',
      user: { deletedAt: null },
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      profile: null,
    },
    unmatchRequests: [],
    ...overrides,
  };
}

describe('active match unmatch policy', () => {
  const policyError = () => new Error('policy denied');

  it('현재 active pair actor만 unmatch action을 수행할 수 있다', () => {
    const activeMatch = makeActiveMatch();

    expect(() =>
      assertUnmatchActorAllowed(activeMatch, 'participant-1', policyError),
    ).not.toThrow();
    expect(() => assertUnmatchActorAllowed(activeMatch, 'participant-3', policyError)).toThrow(
      'policy denied',
    );
    expect(() =>
      assertUnmatchActorAllowed(
        makeActiveMatch({ status: 'UNMATCHED', endedAt: new Date('2026-02-10T03:00:00.000Z') }),
        'participant-1',
        policyError,
      ),
    ).toThrow('policy denied');
  });

  it('current season과 roomSelectionDate window를 fail-closed로 판단한다', () => {
    const activeMatch = makeActiveMatch();
    const seasonContext = makeSeasonContext();

    expect(() =>
      assertCurrentSeasonActiveMatch(activeMatch, seasonContext.season.id, policyError),
    ).not.toThrow();
    expect(() => assertCurrentSeasonActiveMatch(activeMatch, 'other-season', policyError)).toThrow(
      'policy denied',
    );
    expect(() =>
      assertUnmatchWindowOpen(
        activeMatch,
        seasonContext,
        new Date('2026-02-12T14:59:59.000Z'),
        policyError,
      ),
    ).not.toThrow();
    expect(
      isUnmatchWindowOpen(activeMatch, seasonContext, new Date('2026-02-13T00:00:00.000Z')),
    ).toBe(false);
    expect(() =>
      assertUnmatchWindowOpen(
        activeMatch,
        makeSeasonContext({ state: 'SEASON_POST_MATCH' }),
        new Date('2026-02-10T03:00:00.000Z'),
        policyError,
      ),
    ).toThrow('policy denied');
  });

  it('viewer pending request와 mutual completion count를 계산한다', () => {
    const activeMatch = makeActiveMatch({
      unmatchRequests: [
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
          status: 'CANCELLED_BY_REQUESTER',
          requestedAt: new Date('2026-02-10T03:01:00.000Z'),
          terminalAt: new Date('2026-02-10T03:02:00.000Z'),
        },
      ],
    });

    expect(findViewerPendingUnmatchRequest(activeMatch, 'participant-1')?.id).toBe('unmatch-1');
    expect(findViewerPendingUnmatchRequest(activeMatch, 'participant-2')).toBeUndefined();
    expect(countPendingUnmatchRequests(activeMatch)).toBe(1);
  });
});
