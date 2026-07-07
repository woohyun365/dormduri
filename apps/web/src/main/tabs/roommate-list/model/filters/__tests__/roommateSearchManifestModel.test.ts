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
          grade: { operator: 'INCLUDE', values: ['4+', '1'] },
          mbtiTraits: { energy: 'E', lifestyle: 'J' },
          ageBand: { values: ['25_PLUS', '20'] },
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
    expect(result.query.filters.ageBand?.values).toEqual(['25_PLUS', '20']);
    expect(result.removedFilterKeys).toEqual([]);

    const chips = buildRoommateSearchActiveFilterChips(result.query, manifest);
    expect(chips).toContainEqual({
      key: 'grade',
      label: '학년',
      valueLabel: '1학년, 4학년 이상',
    });
    expect(chips).toContainEqual({
      key: 'ageBand',
      label: '나이대',
      valueLabel: '20세 (2007년생), 25세 이상 (2002년생 이하)',
    });
    expect(chips).toContainEqual({
      key: 'mbtiTraits',
      label: 'MBTI 성향',
      valueLabel: 'E·x·x·J',
    });
  });

  it('sleepHabit filter는 사용자 선택 가능한 잠버릇 없음만 유지하고 HAS는 제거한다', () => {
    const manifest = mapRoommateSearchManifest(createManifest());
    const result = sanitizeRoommateSearchQueryForManifest(
      {
        scope: 'SAME_BUILDING_ONLY',
        sort: 'MATCH_SCORE',
        filters: { sleepHabit: 'HAS' },
      },
      manifest,
    );

    expect(result.query.filters).toEqual({});
    expect(result.removedFilterKeys).toEqual(['sleepHabit']);
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
    expect(chips).toContainEqual({ key: 'college', label: '단과대', valueLabel: '공과대학 제외' });
  });
});
