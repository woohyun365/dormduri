import { describe, expect, it } from 'vitest';
import { filterRoommateSearchDiscoveryEntries } from './roommate-search-discovery-filter.policy.js';

const entry = (id: string, targetMatched: boolean) => ({ id, targetMatched }) as never;

describe('roommate-search-discovery-filter.policy', () => {
  it('ACTIONABLE discovery에서는 active matched target을 제외하고 제외 여부를 표시한다', () => {
    const result = filterRoommateSearchDiscoveryEntries([entry('p-1', false), entry('p-2', true)], {
      excludeMatchedTargets: true,
    });

    expect(result.entries).toHaveLength(1);
    expect(result.matchedTargetsExcluded).toBe(true);
  });

  it('cohort review에서는 matched target도 결과 후보에 유지한다', () => {
    const result = filterRoommateSearchDiscoveryEntries([entry('p-1', false), entry('p-2', true)], {
      excludeMatchedTargets: false,
    });

    expect(result.entries).toHaveLength(2);
    expect(result.matchedTargetsExcluded).toBe(false);
  });
});
