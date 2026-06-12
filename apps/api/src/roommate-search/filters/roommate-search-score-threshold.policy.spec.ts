import { describe, expect, it } from 'vitest';
import { applyRoommateSearchScoreThreshold } from './roommate-search-score-threshold.policy.js';

const item = (id: string, input: { scoreVisible: boolean; matchScore?: number }) => ({
  id,
  summary: {
    exposure: { scoreVisible: input.scoreVisible },
    ...(typeof input.matchScore === 'number' ? { matchScore: input.matchScore } : {}),
  },
});

describe('roommate-search-score-threshold.policy', () => {
  it('minScore가 없으면 score post-filter를 적용하지 않는다', () => {
    const items = [item('a', { scoreVisible: true, matchScore: 50 })];

    expect(applyRoommateSearchScoreThreshold(items, {})).toEqual(items);
  });

  it('minScore는 scoreVisible + matchScore 기준으로 post-filter한다', () => {
    expect(
      applyRoommateSearchScoreThreshold(
        [
          item('a', { scoreVisible: true, matchScore: 95 }),
          item('b', { scoreVisible: true, matchScore: 70 }),
          item('c', { scoreVisible: false, matchScore: 100 }),
          item('d', { scoreVisible: true }),
        ],
        { minScore: 90 },
      ).map((entry) => entry.id),
    ).toEqual(['a']);
  });
});
