import { describe, expect, it } from 'vitest';
import {
  applyRoommateSearchFilters,
  applyRoommateSearchManifestLoaded,
  applyRoommateSearchScopeChange,
  applyRoommateSearchSortChange,
  applyRoommateSearchSuccess,
  createInitialRoommateSearchSnapshot,
  recoverRoommateSearchInvalidQuery,
} from '../roommateSearchState';
import {
  createCampusMergedManifest,
  createManifest,
  createManifestResponse,
  createPostMatchManifest,
  createSearchResponse,
  createSummary,
} from './roommateSearchTestFixtures';

describe('roommateSearchState', () => {
  it('scope/sort/filter 변경은 cursor와 현재 items를 reset한다', () => {
    const success = applyRoommateSearchSuccess(
      createInitialRoommateSearchSnapshot({ scope: 'SAME_BUILDING_ONLY', sort: 'MATCH_SCORE' }),
      createSearchResponse({ nextCursor: 'cursor-next' }),
      'replace',
    );

    expect(success.nextCursor).toBe('cursor-next');
    expect(success.items).toHaveLength(1);
    expect(applyRoommateSearchScopeChange(success, 'CAMPUS_MERGED').nextCursor).toBeNull();
    expect(applyRoommateSearchSortChange(success, 'NICKNAME').items).toEqual([]);
    expect(applyRoommateSearchFilters(success, { smokingBehavior: 'NO' }).items).toEqual([]);
  });

  it('response embedded manifest를 preflight manifest보다 우선해서 query를 다시 sanitize한다', () => {
    const initial = createInitialRoommateSearchSnapshot({
      scope: 'SAME_BUILDING_ONLY',
      sort: 'MATCH_SCORE',
      filters: { minScore: 80 },
    });
    const preflight = applyRoommateSearchManifestLoaded(
      initial,
      createManifestResponse(createManifest()),
    );
    const success = applyRoommateSearchSuccess(
      preflight,
      createSearchResponse({
        manifest: createCampusMergedManifest(),
        items: [createSummary('campus-1')],
      }),
      'replace',
    );

    expect(preflight.manifest?.purpose).toBe('ACTIONABLE_DETAIL_DISCOVERY');
    expect(success.manifest?.purpose).toBe('BROAD_PREVIEW');
    expect(success.query).toEqual({ scope: 'CAMPUS_MERGED', sort: 'NICKNAME', filters: {} });
    expect(success.items.map((item) => item.id)).toEqual(['campus-1']);
  });

  it('manifest가 scope를 조정하면 cursor와 items를 reset한다', () => {
    const current = applyRoommateSearchSuccess(
      createInitialRoommateSearchSnapshot({ scope: 'SAME_BUILDING_ONLY', sort: 'MATCH_SCORE' }),
      createSearchResponse({ items: [createSummary('old')], nextCursor: 'cursor-old' }),
      'replace',
    );
    const updated = applyRoommateSearchManifestLoaded(
      current,
      createManifestResponse(createCampusMergedManifest()),
    );

    expect(updated.query.scope).toBe('CAMPUS_MERGED');
    expect(updated.query.sort).toBe('NICKNAME');
    expect(updated.nextCursor).toBeNull();
    expect(updated.items).toEqual([]);
    expect(updated.statusMessage).toContain('조정');
  });

  it('invalid query recovery는 최신 manifest로 sanitize하고 safe status copy를 남긴다', () => {
    const snapshot = createInitialRoommateSearchSnapshot({
      scope: 'SAME_BUILDING_ONLY',
      sort: 'MATCH_SCORE',
      filters: { minScore: 90, sleepHabit: 'HAS' },
    });
    const recovered = recoverRoommateSearchInvalidQuery(
      snapshot,
      createManifestResponse(createPostMatchManifest()),
    );

    expect(recovered.query).toEqual({ scope: 'SAME_BUILDING_ONLY', sort: 'NICKNAME', filters: {} });
    expect(recovered.statusMessage).toContain('최신 정책');
  });

  it('append mode는 same query에서 items를 이어붙이고 nextCursor를 갱신한다', () => {
    const first = applyRoommateSearchSuccess(
      createInitialRoommateSearchSnapshot({ scope: 'SAME_BUILDING_ONLY', sort: 'MATCH_SCORE' }),
      createSearchResponse({ items: [createSummary('one')], nextCursor: 'cursor-2' }),
      'replace',
    );
    const second = applyRoommateSearchSuccess(
      first,
      createSearchResponse({ items: [createSummary('two')], nextCursor: null }),
      'append',
    );

    expect(second.items.map((item) => item.id)).toEqual(['one', 'two']);
    expect(second.nextCursor).toBeNull();
  });
});
