import { describe, expect, it } from 'vitest';
import { normalizeSeasonRuntimeRow, toCurrentSeasonResponse } from './current-season.mapper.js';

describe('current season mapper', () => {
  it('normalizes Date inputs into local date response fields and operated dormitory list', () => {
    const row = normalizeSeasonRuntimeRow({
      id: 'season-1',
      campusCode: 'CHUNCHEON',
      name: '2026년 1학기',
      preparationStartDate: new Date('2026-01-01T00:00:00.000Z'),
      matchingStartDate: new Date('2026-01-28T00:00:00.000Z'),
      seasonEndDate: new Date('2026-02-28T00:00:00.000Z'),
      dormitoryOperations: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
        { dormitoryId: 'irum', isOperated: false, roomSelectionDate: '2026-02-12' },
      ],
    });

    expect(toCurrentSeasonResponse(row, new Date('2026-02-10T03:00:00.000Z'))).toMatchObject({
      campusCode: 'CHUNCHEON',
      season: {
        preparationStartDate: '2026-01-01',
        matchingStartDate: '2026-01-28',
        seasonEndDate: '2026-02-28',
      },
      operatedDormitories: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
      ],
      state: 'SEASON_MATCHING',
      daysUntilMatchingEnd: 2,
      override: {
        active: false,
        state: null,
        reason: null,
      },
    });
  });

  it('exposes override metadata only while override is active', () => {
    const row = normalizeSeasonRuntimeRow({
      id: 'season-1',
      campusCode: 'CHUNCHEON',
      name: '2026년 1학기',
      preparationStartDate: '2026-01-01',
      matchingStartDate: '2026-01-28',
      seasonEndDate: '2026-02-28',
      overrideState: 'OFF_SEASON',
      overrideReason: '운영 점검',
      overrideStartedAt: new Date('2026-02-01T00:00:00+09:00'),
      overrideEndsAt: new Date('2026-02-05T23:59:59+09:00'),
      dormitoryOperations: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
      ],
    });

    expect(toCurrentSeasonResponse(row, new Date('2026-02-02T03:00:00.000Z')).override).toEqual({
      active: true,
      state: 'OFF_SEASON',
      reason: '운영 점검',
      startedAt: '2026-01-31T15:00:00.000Z',
      endsAt: '2026-02-05T14:59:59.000Z',
    });
    expect(toCurrentSeasonResponse(row, new Date('2026-02-10T03:00:00.000Z')).override).toEqual({
      active: false,
      state: null,
      reason: null,
      startedAt: null,
      endsAt: null,
    });
  });
});
