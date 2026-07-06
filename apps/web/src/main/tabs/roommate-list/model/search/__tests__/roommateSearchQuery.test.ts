import { describe, expect, it } from 'vitest';
import { buildRoommateSearchQueryParams } from '../roommateSearchQuery';

function values(params: URLSearchParams, key: string) {
  return params.getAll(key);
}

describe('buildRoommateSearchQueryParams', () => {
  it('BE contract의 dotted params와 repeated array params로 직렬화한다', () => {
    const params = buildRoommateSearchQueryParams(
      {
        scope: 'SAME_BUILDING_ONLY',
        sort: 'MATCH_SCORE',
        filters: {
          smokingBehavior: 'NO',
          bedtime: '24_02',
          college: { operator: 'EXCLUDE', values: ['ENGINEERING', 'HUMANITIES'] },
          grade: { operator: 'INCLUDE', values: ['1', '2'] },
          mbtiTraits: { energy: 'E', perception: 'N', decision: null },
          ageBand: { values: ['19', '25_PLUS'] },
          minScore: 80,
        },
      },
      { limit: 30, cursor: 'cursor-next' },
    );

    expect(params.get('limit')).toBe('30');
    expect(params.get('cursor')).toBe('cursor-next');
    expect(params.get('scope')).toBe('SAME_BUILDING_ONLY');
    expect(params.get('sort')).toBe('MATCH_SCORE');
    expect(params.get('smokingBehavior')).toBe('NO');
    expect(params.get('bedtime')).toBe('24_02');
    expect(params.get('college.operator')).toBe('EXCLUDE');
    expect(values(params, 'college.values[]')).toEqual(['ENGINEERING', 'HUMANITIES']);
    expect(params.get('grade.operator')).toBe('INCLUDE');
    expect(values(params, 'grade.values[]')).toEqual(['1', '2']);
    expect(params.get('mbtiTraits.energy')).toBe('E');
    expect(params.get('mbtiTraits.perception')).toBe('N');
    expect(params.has('mbtiTraits.decision')).toBe(false);
    expect(values(params, 'ageBand.values[]')).toEqual(['19', '25_PLUS']);
    expect(params.get('minScore')).toBe('80');
  });

  it('cursor는 explicit request option일 때만 포함한다', () => {
    const params = buildRoommateSearchQueryParams({
      scope: 'CAMPUS_MERGED',
      sort: 'NICKNAME',
      filters: {},
    });

    expect(params.has('cursor')).toBe(false);
    expect(params.get('scope')).toBe('CAMPUS_MERGED');
    expect(params.get('sort')).toBe('NICKNAME');
  });
});
