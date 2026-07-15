import { describe, expect, it } from 'vitest';
import {
  activeMatchActionResponseSchema,
  matchOverviewResponseSchema,
} from '@repo/shared/match/contract';

const validOverview = {
  serverNow: '2026-02-10T03:00:00.000Z',
  season: {
    id: 'season-1',
    state: 'SEASON_MATCHING',
    roomSelectionDate: '2026-02-11',
  },
  capability: {
    canViewMatching: true,
    reason: null,
  },
  sentRequests: [],
  receivedRequests: [],
  activeMatch: null,
};

const activeMatch = {
  id: 'active-1',
  seasonId: 'season-1',
  counterpartUserId: 'user-2',
  counterpartParticipantId: 'participant-2',
  counterpartNickname: '감자친구',
  status: 'ACTIVE',
  startedAt: '2026-02-10T03:00:00.000Z',
  endedAt: null,
  endReason: null,
  createdFromRequestId: 'request-1',
  unmatchProgress: {
    state: 'NONE',
    requestedByViewerAt: null,
    requestedByCounterpartAt: null,
    progressCount: 0,
    requiredCount: 2,
    canRequest: true,
    canCancel: false,
    disabledReason: null,
    availableUntil: '2026-02-12T14:59:59.999Z',
  },
} as const;

describe('match overview shared contract', () => {
  it('public current snapshot의 최소 shape를 parse한다', () => {
    expect(matchOverviewResponseSchema.parse(validOverview)).toEqual(validOverview);
  });

  it('unknown capability reason과 raw extra field를 fail-closed 처리한다', () => {
    expect(
      matchOverviewResponseSchema.safeParse({
        ...validOverview,
        capability: { canViewMatching: false, reason: 'INTERNAL_MODERATION_CASE' },
      }).success,
    ).toBe(false);
    expect(matchOverviewResponseSchema.safeParse({ ...validOverview, audit: {} }).success).toBe(
      false,
    );
  });

  it('current overview active relation은 ACTIVE와 null end fields만 허용한다', () => {
    expect(matchOverviewResponseSchema.safeParse({ ...validOverview, activeMatch }).success).toBe(
      true,
    );
    expect(
      matchOverviewResponseSchema.safeParse({
        ...validOverview,
        activeMatch: {
          ...activeMatch,
          status: 'UNMATCHED',
          endedAt: '2026-02-10T04:00:00.000Z',
          endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
        },
      }).success,
    ).toBe(false);
  });

  it('terminal unmatch action response는 COMPLETED 2/2를 계속 허용한다', () => {
    expect(
      activeMatchActionResponseSchema.safeParse({
        activeMatch: {
          ...activeMatch,
          status: 'UNMATCHED',
          endedAt: '2026-02-10T04:00:00.000Z',
          endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
          unmatchProgress: {
            ...activeMatch.unmatchProgress,
            state: 'COMPLETED',
            progressCount: 2,
            canRequest: false,
            disabledReason: 'ACTIVE_MATCH_NOT_ACTIONABLE',
          },
        },
      }).success,
    ).toBe(true);
  });

  it('unmatch disabled reason은 public enum만 허용한다', () => {
    expect(
      matchOverviewResponseSchema.safeParse({
        ...validOverview,
        activeMatch: {
          ...activeMatch,
          unmatchProgress: {
            ...activeMatch.unmatchProgress,
            canRequest: false,
            disabledReason: 'INTERNAL_POLICY_REASON',
          },
        },
      }).success,
    ).toBe(false);
  });
});
