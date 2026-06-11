import type { VisibleProfileViewerContext } from './targets/public-profile-target.types.js';
import { buildRoommateSearchManifest } from './roommate-search-filter-manifest.owner.js';

const baseViewerContext = {
  viewer: {
    id: 'viewer',
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    gender: 'M',
    campus: 'CHUNCHEON',
  },
  viewerParticipant: null,
  viewerSelection: {
    dormitoryId: null,
    dormitorySelectionState: 'NOT_SELECTED',
    source: 'SEASON_PARTICIPANT',
  },
  viewerLifestyle: null,
  viewerSeasonProfileComplete: false,
  viewerHasOperatedAssignedDormitory: false,
  currentSeasonId: 'season-1',
  seasonReferenceYear: 2026,
  serviceState: {
    campusOperated: true,
    seasonState: 'SEASON_MATCHING',
  },
  operatedDormitoryIds: new Set(['dasan']),
  currentDormitoryCanMatch: false,
} satisfies VisibleProfileViewerContext;

const activeCollegeOptions = [
  { code: 'IT', label: 'IT대' },
  { code: 'NURSING', label: '간호대' },
];

describe('roommate-search-filter-manifest.owner', () => {
  it('BROAD_PREVIEW manifest는 필터 field를 제공하지 않는다', () => {
    const manifest = buildRoommateSearchManifest({
      viewerContext: baseViewerContext,
      scope: 'CAMPUS_MERGED',
      purpose: 'BROAD_PREVIEW',
      appliedSort: 'NICKNAME',
      activeCollegeOptions,
    });

    expect(manifest).toMatchObject({
      scope: 'CAMPUS_MERGED',
      purpose: 'BROAD_PREVIEW',
      filters: { enabled: false, fields: {} },
      sorts: { default: 'NICKNAME', options: ['NICKNAME'] },
    });
  });

  it('ACTIONABLE_DETAIL_DISCOVERY manifest는 lifestyle/additional field와 campus active college option을 제공한다', () => {
    const manifest = buildRoommateSearchManifest({
      viewerContext: {
        ...baseViewerContext,
        viewerSelection: {
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
          source: 'SEASON_PARTICIPANT',
        },
        viewerHasOperatedAssignedDormitory: true,
      },
      scope: 'SAME_BUILDING_ONLY',
      purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
      appliedSort: 'NICKNAME',
      activeCollegeOptions,
    });

    expect(manifest.filters.enabled).toBe(true);
    expect(manifest.filters.fields).toHaveProperty('smokingBehavior');
    expect(manifest.filters.fields).toHaveProperty('college');
    expect(manifest.filters.fields).toHaveProperty('grade');
    expect(manifest.filters.fields).toHaveProperty('mbtiTraits');
    expect(manifest.filters.fields).toHaveProperty('ageBand');
    expect(manifest.filters.fields).toHaveProperty('minScore');
    const collegeField = manifest.filters.fields.college;
    expect(collegeField).toBeDefined();
    expect(collegeField).toMatchObject({
      source: 'VIEWER_CAMPUS_ACTIVE_CATALOG',
      operators: ['INCLUDE', 'EXCLUDE'],
    });
    expect(collegeField?.options).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IT', label: 'IT대' })]),
    );
    expect(manifest.manifestRevision).toContain('CHUNCHEON');
    expect(manifest.sorts).toEqual({
      default: 'MATCH_SCORE',
      options: ['NICKNAME', 'MATCH_SCORE'],
    });
  });
});
