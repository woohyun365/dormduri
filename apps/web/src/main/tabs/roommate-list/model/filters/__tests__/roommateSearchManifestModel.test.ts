import { describe, expect, it } from 'vitest';
import {
  buildRoommateSearchActiveFilterChips,
  canUseRoommateSearchFilterField,
  mapRoommateSearchManifest,
  sanitizeRoommateSearchQueryForManifest,
} from '../roommateSearchManifestModel';
import {
  createCampusMergedManifest,
  createManifest,
  createPostMatchManifest,
} from '../../search/__tests__/roommateSearchTestFixtures';

describe('roommateSearchManifestModel', () => {
  it('CAMPUS_MERGED broad preview manifest는 filters/minScore를 제거하고 NICKNAME 정렬로 조정한다', () => {
    const manifest = mapRoommateSearchManifest(createCampusMergedManifest());
    const result = sanitizeRoommateSearchQueryForManifest(
      {
        scope: 'SAME_BUILDING_ONLY',
        sort: 'MATCH_SCORE',
        filters: {
          smokingBehavior: 'NO',
          college: { operator: 'EXCLUDE', values: ['ENGINEERING'] },
          minScore: 80,
        },
      },
      manifest,
    );

    expect(manifest.canOpenFilterSheet).toBe(false);
    expect(result.query).toEqual({ scope: 'CAMPUS_MERGED', sort: 'NICKNAME', filters: {} });
    expect(result.removedFilterKeys).toEqual(['smokingBehavior', 'college', 'minScore']);
    expect(result.cursorShouldReset).toBe(true);
  });

  it('SAME_BUILDING_ONLY actionable manifest는 enabled fields와 sort options를 유지한다', () => {
    const manifest = mapRoommateSearchManifest(createManifest());
    const result = sanitizeRoommateSearchQueryForManifest(
      {
        scope: 'SAME_BUILDING_ONLY',
        sort: 'MATCH_SCORE',
        filters: {
          smokingBehavior: 'NO',
          college: { operator: 'EXCLUDE', values: ['ENGINEERING'] },
          grade: { operator: 'INCLUDE', values: ['1'] },
          mbtiTraits: { energy: 'E', perception: 'N' },
          ageBand: { values: ['19', '25_PLUS'] },
          minScore: 80,
        },
      },
      manifest,
    );

    expect(manifest.canOpenFilterSheet).toBe(true);
    expect(canUseRoommateSearchFilterField(manifest, 'college')).toBe(true);
    expect(result.query.filters).toMatchObject({
      smokingBehavior: 'NO',
      college: { operator: 'EXCLUDE', values: ['ENGINEERING'] },
      minScore: 80,
    });
    expect(result.query.filters.ageBand?.values).toEqual(['19', '25_PLUS']);
    expect(result.removedFilterKeys).toEqual([]);
  });

  it('POST_MATCH_COHORT_REVIEW manifest는 detail filters와 score sort를 제거한다', () => {
    const manifest = mapRoommateSearchManifest(createPostMatchManifest());
    const result = sanitizeRoommateSearchQueryForManifest(
      {
        scope: 'SAME_BUILDING_ONLY',
        sort: 'MATCH_SCORE',
        filters: { minScore: 90, sleepHabit: 'HAS' },
      },
      manifest,
    );

    expect(result.query).toEqual({ scope: 'SAME_BUILDING_ONLY', sort: 'NICKNAME', filters: {} });
    expect(result.removedFilterKeys).toEqual(['sleepHabit', 'minScore']);
    expect(result.sortChanged).toBe(true);
  });

  it('missing/disabled option은 제거하고 active chip은 safe label 후보를 만든다', () => {
    const manifest = mapRoommateSearchManifest(createManifest());
    const result = sanitizeRoommateSearchQueryForManifest(
      {
        scope: 'SAME_BUILDING_ONLY',
        sort: 'MATCH_SCORE',
        filters: {
          college: { operator: 'EXCLUDE', values: ['ENGINEERING', 'UNKNOWN'] },
          grade: { operator: 'EXCLUDE', values: ['1'] },
        },
      },
      manifest,
    );
    const chips = buildRoommateSearchActiveFilterChips(result.query, manifest);

    expect(result.query.filters.college?.values).toEqual(['ENGINEERING']);
    expect(result.query.filters.grade).toBeUndefined();
    expect(result.removedFilterKeys).toEqual(['college', 'grade']);
    expect(chips).toContainEqual({ key: 'college', label: '단과대', valueLabel: '공과대학' });
  });
});
