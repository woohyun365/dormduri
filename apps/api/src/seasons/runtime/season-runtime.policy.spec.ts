import { getEffectiveSeasonState, hasActiveSeasonOverride } from './season-runtime.policy.js';
import type { SeasonWindowSource } from './season-runtime.types.js';

function makeWindow(overrides: Partial<SeasonWindowSource> = {}): SeasonWindowSource {
  return {
    preparationStartDate: '2026-01-01',
    matchingStartDate: '2026-01-28',
    seasonEndDate: '2026-02-28',
    dormitoryOperations: [
      { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
      { dormitoryId: 'irum', isOperated: true, roomSelectionDate: '2026-02-12' },
    ],
    ...overrides,
  };
}

describe('season runtime policy', () => {
  it.each([
    ['before preparation', '2025-12-31T14:59:59.000Z', 'OFF_SEASON'],
    ['preparation window', '2026-01-10T03:00:00.000Z', 'SEASON_OPEN'],
    ['matching window', '2026-02-10T03:00:00.000Z', 'SEASON_MATCHING'],
    [
      'after last room selection before season end',
      '2026-02-20T03:00:00.000Z',
      'SEASON_POST_MATCH',
    ],
    ['after season end', '2026-02-28T15:00:00.000Z', 'OFF_SEASON'],
  ] as const)('returns %s state from date windows', (_label, now, expectedState) => {
    expect(getEffectiveSeasonState(makeWindow(), new Date(now))).toBe(expectedState);
  });

  it('caps matching/post-match state to open when no dormitory is operated', () => {
    expect(
      getEffectiveSeasonState(
        makeWindow({
          dormitoryOperations: [
            { dormitoryId: 'dasan', isOperated: false, roomSelectionDate: '2026-02-11' },
          ],
        }),
        new Date('2026-02-10T03:00:00.000Z'),
      ),
    ).toBe('SEASON_OPEN');
  });

  it('applies only active override windows to effective state', () => {
    const season = makeWindow();

    expect(
      hasActiveSeasonOverride(
        { overrideState: 'OFF_SEASON', overrideStartedAt: '2026-02-01T00:00:00+09:00' },
        new Date('2026-02-10T03:00:00.000Z'),
      ),
    ).toBe(true);
    expect(
      getEffectiveSeasonState(
        {
          ...season,
          overrideState: 'OFF_SEASON',
          overrideStartedAt: '2026-02-01T00:00:00+09:00',
        },
        new Date('2026-02-10T03:00:00.000Z'),
      ),
    ).toBe('OFF_SEASON');
    expect(
      hasActiveSeasonOverride(
        {
          overrideState: 'OFF_SEASON',
          overrideEndsAt: '2026-01-31T23:59:59+09:00',
        },
        new Date('2026-02-10T03:00:00.000Z'),
      ),
    ).toBe(false);
  });
});
