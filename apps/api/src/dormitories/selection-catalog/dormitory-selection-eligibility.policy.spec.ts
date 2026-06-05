import {
  isDormitoryGenderCompatible,
  isDormitoryRoomSelectionClosed,
} from './dormitory-selection-eligibility.policy.js';

const seasonContext = (state: 'SEASON_OPEN' | 'SEASON_MATCHING') =>
  ({
    state,
  }) as never;

describe('dormitory-selection-eligibility.policy', () => {
  it('gender policy는 동일 gender 또는 BOTH만 selectable로 본다', () => {
    expect(isDormitoryGenderCompatible('M', 'M')).toBe(true);
    expect(isDormitoryGenderCompatible('M', 'BOTH')).toBe(true);
    expect(isDormitoryGenderCompatible('M', 'F')).toBe(false);
  });

  it('room selection cutoff는 matching phase에서만 date-only 기준으로 닫는다', () => {
    const cutoff = new Date('2026-02-10T00:00:00.000Z');

    expect(
      isDormitoryRoomSelectionClosed(
        seasonContext('SEASON_MATCHING'),
        cutoff,
        new Date('2026-02-11T03:00:00.000Z'),
      ),
    ).toBe(true);
    expect(
      isDormitoryRoomSelectionClosed(
        seasonContext('SEASON_MATCHING'),
        cutoff,
        new Date('2026-02-10T03:00:00.000Z'),
      ),
    ).toBe(false);
    expect(
      isDormitoryRoomSelectionClosed(
        seasonContext('SEASON_OPEN'),
        cutoff,
        new Date('2026-02-11T03:00:00.000Z'),
      ),
    ).toBe(false);
  });
});
