import { describe, expect, it } from 'vitest';
import { matchOverviewResponseSchema } from '@repo/shared/match/contract';

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
});
