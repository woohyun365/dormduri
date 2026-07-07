import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  roommateSearchManifestResponseSchema,
  roommateSearchResponseSchema,
} from '@repo/shared/roommate-search/contract';
import { matchRequestActionResponseSchema } from '@repo/shared/match/contract';
import { publicProfileSchema } from '@repo/shared/profile/contract';
import { bookmarkListResponseSchema } from '@repo/shared/social-safety/bookmark';
import { createBlockResponseSchema } from '@repo/shared/social-safety/block';
import { createReportResponseSchema } from '@repo/shared/social-safety/report';
import { describe, expect, it } from 'vitest';
import { createRoommateStorySearchResponse } from '../__stories__/roommate-story-api-fixtures';
import {
  ROOMMATE_STORY_CATEGORY_KEYS,
  ROOMMATE_STORY_SCENARIO_KEYS,
  ROOMMATE_STORY_SEASON_GROUP_KEYS,
  createRoommateStoryAgeBandOptions,
  createRoommateStoryManifestResponse,
  resolveRoommateStorySeasonReferenceYear,
  roommateStoryScenarios,
} from '../__stories__/roommate-story-scenarios';
import type { SeasonContextValue } from '@/main/contexts/SeasonContext';

const ROOT = process.cwd();
const ROOMMATE_ROOT = join(ROOT, 'src/main/tabs/roommate-list');

describe('RoommateTab Storybook architecture boundary', () => {
  it('registers RoommateTab stories in Storybook config and storybook typecheck', () => {
    const mainConfig = readFileSync(join(ROOT, '.storybook/main.ts'), 'utf8');
    const storybookTsconfig = readFileSync(join(ROOT, 'tsconfig.storybook.json'), 'utf8');

    expect(mainConfig).toContain('roommate-list/**/*.stories.@(ts|tsx|mdx)');
    expect(storybookTsconfig).toContain('src/main/tabs/roommate-list/**/*.stories.tsx');
    expect(storybookTsconfig).toContain('src/main/tabs/roommate-list/__stories__/**/*.ts');
    expect(storybookTsconfig).toContain('src/main/tabs/roommate-list/__stories__/**/*.tsx');
  });

  it('uses a story-only API fixture layer and does not add ChatTab or MatchingTab owners', () => {
    const storySource = readFileSync(
      join(ROOMMATE_ROOT, '__stories__/RoommateListTab.stories.tsx'),
      'utf8',
    );
    const fixtureSource = readFileSync(
      join(ROOMMATE_ROOT, '__stories__/roommate-story-api-fixtures.ts'),
      'utf8',
    );

    expect(storySource).toContain('./roommate-story-api-fixtures');
    expect(storySource).toContain('./roommate-story-scenarios');
    expect(storySource).toContain("title: 'Main/RoommateTab'");
    expect(storySource).not.toContain('ChatTab');
    expect(storySource).not.toContain('MatchingTab');
    expect(fixtureSource).toContain('originalFetch');
    expect(fixtureSource).toContain('refCount');
    expect(fixtureSource).toContain('return originalFetch(input, init)');
  });

  it('lets every scenario respond to the actual Storybook viewport instead of clamping non-desktop stories to mobile width', () => {
    const storySource = readFileSync(
      join(ROOMMATE_ROOT, '__stories__/RoommateListTab.stories.tsx'),
      'utf8',
    );

    expect(storySource).toContain('max-w-md');
    expect(storySource).toContain('lg:max-w-7xl');
    expect(storySource).toContain('candidate && !candidate.disabled');
    expect(storySource).toContain('OffSeasonClosed');
    expect(storySource).toContain('SeasonOpenRegistered');
    expect(storySource).toContain('SeasonOpenNotRegistered');
    expect(storySource).toContain('SeasonMatchingRegistered');
    expect(storySource).toContain('SeasonMatchingNotRegistered');
    expect(storySource).toContain('PostMatchCohortReview');
    expect(storySource).not.toContain("scenario.viewportHint === 'desktop'");
  });

  it('keeps story fixtures out of production RoommateTab runtime files', () => {
    const offenders = collectRuntimeSources(ROOMMATE_ROOT).filter(({ source }) => {
      return source.includes('__stories__') || source.includes('roommate-story-');
    });

    expect(offenders).toEqual([]);
  });
});

describe('roommateStoryScenarios policy matrix', () => {
  it('exposes search, detail, action, and responsive scenario categories', () => {
    expect(ROOMMATE_STORY_SCENARIO_KEYS).toHaveLength(25);

    for (const key of ROOMMATE_STORY_SCENARIO_KEYS) {
      expect(roommateStoryScenarios[key]).toBeDefined();
      expect(roommateStoryScenarios[key].key).toBe(key);
    }

    expect(ROOMMATE_STORY_CATEGORY_KEYS.search).toEqual(
      expect.arrayContaining([
        'offSeasonClosed',
        'seasonMatchingRegistered',
        'seasonMatchingNotRegistered',
        'seasonMatchingNotRegisteredEmpty',
        'seasonMatchingRegisteredEmpty',
        'seasonMatchingSearchError',
        'seasonMatchingLoadingSkeleton',
        'seasonOpenRegistered',
        'seasonOpenNotRegistered',
        'seasonOpenRegisteredEmpty',
        'seasonOpenSearchError',
        'seasonOpenLoadingSkeleton',
        'postMatchCohortReview',
      ]),
    );
    expect(ROOMMATE_STORY_CATEGORY_KEYS.detail).toEqual(
      expect.arrayContaining([
        'seasonMatchingDetailFullCompatibility',
        'seasonMatchingExceptionScoreCalculationFailed',
        'seasonMatchingExceptionDetailUnavailable',
        'seasonMatchingExceptionAccessRecheckFailed',
      ]),
    );
    expect(ROOMMATE_STORY_CATEGORY_KEYS.action).toEqual(
      expect.arrayContaining([
        'seasonMatchingMatchRequestDialog',
        'seasonMatchingMatchRequestStaleError',
        'seasonMatchingReportOptionalBlockReceipt',
      ]),
    );
    expect(ROOMMATE_STORY_CATEGORY_KEYS.responsive).toEqual(
      expect.arrayContaining(['seasonMatchingMobileBookmarkIconState']),
    );
    expect(roommateStoryScenarios.seasonMatchingActionPendingDisabled).toMatchObject({
      autoOpen: 'match-request-stale-submit',
      responseDelayMs: expect.any(Number),
    });
  });

  it('organizes primary RoommateTab stories by HomeTab-style season state groups', () => {
    expect(ROOMMATE_STORY_SEASON_GROUP_KEYS).toEqual({
      offSeason: ['offSeasonClosed'],
      seasonOpen: [
        'seasonOpenRegistered',
        'seasonOpenNotRegistered',
        'seasonOpenRegisteredEmpty',
        'seasonOpenSearchError',
        'seasonOpenLoadingSkeleton',
      ],
      seasonMatching: expect.arrayContaining([
        'seasonMatchingRegistered',
        'seasonMatchingNotRegistered',
        'seasonMatchingNotRegisteredEmpty',
        'seasonMatchingRegisteredEmpty',
        'seasonMatchingSearchError',
        'seasonMatchingLoadingSkeleton',
        'seasonMatchingDetailFullCompatibility',
        'seasonMatchingMatchRequestDialog',
      ]),
      postMatch: ['postMatchCohortReview'],
    });

    for (const [seasonGroup, keys] of Object.entries(ROOMMATE_STORY_SEASON_GROUP_KEYS)) {
      for (const key of keys) {
        expect(roommateStoryScenarios[key].seasonGroup).toBe(seasonGroup);
      }
    }

    expect(roommateStoryScenarios.offSeasonClosed).toMatchObject({
      seasonGroup: 'offSeason',
      searchEntryAllowed: false,
      viewer: { dormitoryId: null },
      seasonContext: { state: 'OFF_SEASON' },
    });
    expect(roommateStoryScenarios.seasonOpenRegistered).toMatchObject({
      seasonGroup: 'seasonOpen',
      seasonContext: { state: 'SEASON_OPEN' },
      viewer: { dormitoryId: expect.any(String) },
      searchResponse: {
        scope: 'SAME_BUILDING_ONLY',
        scopeAvailability: { sameBuildingOnly: true },
        manifest: { purpose: 'ACTIONABLE_DETAIL_DISCOVERY' },
      },
    });
    expect(roommateStoryScenarios.seasonOpenRegistered.searchResponsesByScope).toMatchObject({
      CAMPUS_MERGED: {
        scope: 'CAMPUS_MERGED',
        manifest: { purpose: 'BROAD_PREVIEW' },
      },
      SAME_BUILDING_ONLY: {
        scope: 'SAME_BUILDING_ONLY',
        scopeAvailability: { campusMerged: true, sameBuildingOnly: true },
        manifest: { purpose: 'ACTIONABLE_DETAIL_DISCOVERY' },
      },
    });
    expect(
      roommateStoryScenarios.seasonOpenRegistered.searchResponsesByScope?.CAMPUS_MERGED?.items.map(
        (item) => item.profileSummary.nickname,
      ),
    ).toEqual(expect.arrayContaining(['테스트춘천여', '오픈시즌홈', '예지홈01']));
    expect(
      roommateStoryScenarios.seasonOpenRegistered.searchResponsesByScope?.CAMPUS_MERGED?.items.map(
        (item) => item.profileSummary.nickname,
      ),
    ).not.toEqual(expect.arrayContaining([expect.stringMatching(/^캠퍼스 미리보기/u)]));
    expect(
      roommateStoryScenarios.seasonOpenRegistered.searchResponsesByScope?.SAME_BUILDING_ONLY?.items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profileSummary: expect.objectContaining({ nickname: '가온' }),
          actions: expect.objectContaining({
            canBookmark: true,
            canRequestMatch: false,
            canStartChat: true,
            unavailableReasons: ['SEASON_NOT_ACTIONABLE'],
          }),
        }),
      ]),
    );
    const registeredSameDormScores =
      roommateStoryScenarios.seasonOpenRegistered.searchResponsesByScope?.SAME_BUILDING_ONLY?.items.map(
        (item) => item.matchScore,
      ) ?? [];
    expect(registeredSameDormScores).toEqual(expect.arrayContaining([96, 85, 84, 70, 50, 35]));
    const registeredSameDormFacts =
      roommateStoryScenarios.seasonOpenRegistered.searchResponsesByScope?.SAME_BUILDING_ONLY?.items.map(
        (item) => item.profileSummary,
      ) ?? [];
    expect(registeredSameDormFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ smokingBehavior: 'YES', sleepHabit: 'TALKING' }),
        expect.objectContaining({ smokingBehavior: 'E_CIG', sleepHabit: 'SNORING' }),
        expect.objectContaining({ sleepHabit: 'SNORING', relationshipStyle: 'CASUAL' }),
        expect.objectContaining({ relationshipStyle: 'CLOSE' }),
      ]),
    );
    expect(roommateStoryScenarios.seasonOpenNotRegistered).toMatchObject({
      seasonGroup: 'seasonOpen',
      seasonContext: { state: 'SEASON_OPEN' },
      viewer: { dormitoryId: null },
      searchResponse: {
        scope: 'CAMPUS_MERGED',
        scopeAvailability: { sameBuildingOnly: true },
        manifest: { purpose: 'BROAD_PREVIEW' },
      },
    });
    expect(
      createRoommateStoryManifestResponse(
        roommateStoryScenarios.seasonOpenNotRegistered,
        'SAME_BUILDING_ONLY',
      ).scopeAvailability.sameBuildingOnly,
    ).toBe(true);
    expect(
      roommateStoryScenarios.seasonOpenNotRegistered.searchResponsesByScope?.SAME_BUILDING_ONLY,
    ).toMatchObject({
      scope: 'SAME_BUILDING_ONLY',
      items: [],
      manifest: { purpose: 'ACTIONABLE_DETAIL_DISCOVERY' },
    });
    expect(roommateStoryScenarios.seasonOpenRegisteredEmpty).toMatchObject({
      seasonGroup: 'seasonOpen',
      seasonContext: { state: 'SEASON_OPEN' },
      searchResponse: {
        scope: 'SAME_BUILDING_ONLY',
        items: [],
        manifest: { purpose: 'ACTIONABLE_DETAIL_DISCOVERY' },
      },
    });
    expect(
      roommateStoryScenarios.seasonOpenRegisteredEmpty.searchResponsesByScope?.CAMPUS_MERGED?.items,
    ).toHaveLength(0);
    expect(
      roommateStoryScenarios.seasonOpenRegisteredEmpty.searchResponsesByScope?.SAME_BUILDING_ONLY
        ?.items,
    ).toHaveLength(0);
    expect(roommateStoryScenarios.seasonOpenSearchError).toMatchObject({
      seasonGroup: 'seasonOpen',
      seasonContext: { state: 'SEASON_OPEN' },
      viewer: { dormitoryId: expect.any(String) },
      searchResponse: { scope: 'SAME_BUILDING_ONLY' },
      searchErrorCode: 'BFF_UPSTREAM_UNAVAILABLE',
      searchErrorStatus: 503,
    });
    expect(roommateStoryScenarios.seasonOpenLoadingSkeleton).toMatchObject({
      seasonGroup: 'seasonOpen',
      seasonContext: { state: 'SEASON_OPEN' },
      viewer: { dormitoryId: expect.any(String) },
      searchResponse: { scope: 'SAME_BUILDING_ONLY', appliedSort: 'MATCH_SCORE' },
      searchResponseDelayMs: expect.any(Number),
    });
    for (const key of ROOMMATE_STORY_SEASON_GROUP_KEYS.seasonOpen) {
      const responses = [
        roommateStoryScenarios[key].searchResponse,
        ...Object.values(roommateStoryScenarios[key].searchResponsesByScope ?? {}),
      ];
      expect(responses.flatMap((response) => response.availabilityNotices)).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'DISCOVERY_ACTIONABLE_ONLY' })]),
      );
    }
    expect(roommateStoryScenarios.seasonMatchingRegistered).toMatchObject({
      seasonGroup: 'seasonMatching',
      seasonContext: { state: 'SEASON_MATCHING' },
      viewer: { dormitoryId: expect.any(String) },
      searchResponse: {
        scope: 'SAME_BUILDING_ONLY',
        scopeAvailability: { campusMerged: false, sameBuildingOnly: true },
        manifest: { purpose: 'ACTIONABLE_DETAIL_DISCOVERY' },
      },
    });
    expect(roommateStoryScenarios.seasonMatchingRegistered.searchResponse.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profileSummary: expect.objectContaining({ nickname: '가온' }),
          actions: expect.objectContaining({
            canBookmark: true,
            canRequestMatch: true,
            canStartChat: true,
            unavailableReasons: [],
          }),
        }),
      ]),
    );
    expect(
      roommateStoryScenarios.seasonMatchingRegistered.searchResponse.availabilityNotices,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'DISCOVERY_ACTIONABLE_ONLY' })]),
    );
    expect(
      roommateStoryScenarios.seasonMatchingExceptionScoreCalculationFailed.searchResponse.items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exposure: expect.objectContaining({ detailViewable: true, scoreVisible: false }),
          actions: expect.objectContaining({
            canRequestMatch: true,
            canStartChat: true,
          }),
        }),
      ]),
    );
    expect(
      roommateStoryScenarios.seasonMatchingExceptionScoreCalculationFailed.searchResponse.items[0],
    ).not.toHaveProperty('matchScore');
    expect(
      roommateStoryScenarios.seasonMatchingExceptionDetailUnavailable.searchResponse.items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exposure: expect.objectContaining({ detailViewable: true, scoreVisible: true }),
          matchScore: 91,
          actions: expect.objectContaining({
            canRequestMatch: true,
            canStartChat: true,
          }),
        }),
      ]),
    );
    expect(
      roommateStoryScenarios.seasonMatchingExceptionAccessRecheckFailed.searchResponse.items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exposure: expect.objectContaining({ detailViewable: true, scoreVisible: true }),
          matchScore: 86,
          actions: expect.objectContaining({
            canRequestMatch: true,
            canStartChat: true,
          }),
        }),
      ]),
    );
    expect(roommateStoryScenarios.seasonMatchingNotRegistered).toMatchObject({
      seasonGroup: 'seasonMatching',
      seasonContext: { state: 'SEASON_MATCHING' },
      viewer: { dormitoryId: null },
      searchResponse: {
        scope: 'CAMPUS_MERGED',
        scopeAvailability: { campusMerged: true, sameBuildingOnly: false },
        manifest: { purpose: 'BROAD_PREVIEW' },
      },
    });
    expect(roommateStoryScenarios.seasonMatchingNotRegistered.searchResponse.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exposure: expect.objectContaining({ detailViewable: false, scoreVisible: false }),
          actions: expect.objectContaining({
            canBookmark: false,
            canRequestMatch: false,
            canStartChat: false,
          }),
        }),
      ]),
    );
    expect(
      roommateStoryScenarios.seasonMatchingNotRegistered.searchResponse.availabilityNotices,
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SCOPE_RESTRICTED_BY_VIEWER_STATE' }),
      ]),
    );
    expect(roommateStoryScenarios.seasonMatchingNotRegisteredEmpty).toMatchObject({
      seasonGroup: 'seasonMatching',
      viewer: { dormitoryId: null },
      searchResponse: {
        scope: 'CAMPUS_MERGED',
        items: [],
        scopeAvailability: { campusMerged: true, sameBuildingOnly: false },
        manifest: { purpose: 'BROAD_PREVIEW' },
      },
    });
    expect(roommateStoryScenarios.seasonMatchingRegisteredEmpty).toMatchObject({
      seasonGroup: 'seasonMatching',
      searchResponse: {
        scope: 'SAME_BUILDING_ONLY',
        items: [],
        scopeAvailability: { campusMerged: false, sameBuildingOnly: true },
        manifest: { purpose: 'ACTIONABLE_DETAIL_DISCOVERY' },
      },
    });
    expect(roommateStoryScenarios.seasonMatchingSearchError).toMatchObject({
      seasonGroup: 'seasonMatching',
      searchResponse: { scope: 'SAME_BUILDING_ONLY' },
      searchErrorCode: 'BFF_UPSTREAM_UNAVAILABLE',
      searchErrorStatus: 503,
    });
    expect(roommateStoryScenarios.seasonMatchingLoadingSkeleton).toMatchObject({
      seasonGroup: 'seasonMatching',
      searchResponse: { scope: 'SAME_BUILDING_ONLY', appliedSort: 'MATCH_SCORE' },
      searchResponseDelayMs: expect.any(Number),
    });
    expect(roommateStoryScenarios.postMatchCohortReview).toMatchObject({
      seasonGroup: 'postMatch',
      seasonContext: { state: 'SEASON_POST_MATCH' },
      searchResponse: { manifest: { purpose: 'POST_MATCH_COHORT_REVIEW' } },
    });
  });

  it('derives Storybook age labels from the active story season instead of a hardcoded year', () => {
    const futureSeason = {
      season: { name: '2027년 1학기', roomSelectionDate: '2027-01-11' },
      state: 'SEASON_OPEN',
      isOpen: true,
      isMatching: false,
      daysUntilEnd: 31,
    } satisfies SeasonContextValue;

    expect(resolveRoommateStorySeasonReferenceYear(futureSeason)).toBe(2027);
    expect(createRoommateStoryAgeBandOptions(futureSeason)).toEqual(
      expect.arrayContaining([
        { code: '20', label: '20세 (2008년생)' },
        { code: '25_PLUS', label: '25세 이상 (2003년생 이하)' },
      ]),
    );

    const currentStoryManifest = createRoommateStoryManifestResponse(
      roommateStoryScenarios.seasonOpenRegistered,
      'SAME_BUILDING_ONLY',
    ).manifest;

    expect(currentStoryManifest.filters.fields.ageBand?.options).toEqual(
      expect.arrayContaining([
        { code: '20', label: '20세 (2007년생)' },
        { code: '25_PLUS', label: '25세 이상 (2002년생 이하)' },
      ]),
    );
  });

  it('sorts Season Open Registered story fixtures by requested nickname or score', () => {
    const scenario = roommateStoryScenarios.seasonOpenRegistered;
    const nicknameSorted = createRoommateStorySearchResponse(scenario, {
      method: 'GET',
      pathname: '/api/roommate-search',
      searchParams: new URLSearchParams('scope=SAME_BUILDING_ONLY&sort=NICKNAME'),
    });
    const scoreSorted = createRoommateStorySearchResponse(scenario, {
      method: 'GET',
      pathname: '/api/roommate-search',
      searchParams: new URLSearchParams('scope=SAME_BUILDING_ONLY&sort=MATCH_SCORE'),
    });

    expect(nicknameSorted.appliedSort).toBe('NICKNAME');
    expect(nicknameSorted.items.map((item) => item.profileSummary.nickname)).toEqual([
      '가온',
      '나래',
      '다솜',
      '라희',
      '민재',
      '서윤',
      '아린',
      '유진',
      '지우',
      '하람',
      '해솔',
      '희원',
    ]);
    expect(scoreSorted.appliedSort).toBe('MATCH_SCORE');
    expect(scoreSorted.items.map((item) => item.matchScore)).toEqual(
      expect.arrayContaining([85, 70, 50]),
    );
    expect(scoreSorted.items.map((item) => item.matchScore)).toEqual([
      96, 91, 88, 85, 84, 77, 70, 58, 54, 50, 43, 35,
    ]);
  });

  it('validates story fixture payloads with owner/shared schemas', () => {
    for (const scenario of Object.values(roommateStoryScenarios)) {
      expect(() => roommateSearchResponseSchema.parse(scenario.searchResponse)).not.toThrow();
      for (const response of Object.values(scenario.searchResponsesByScope ?? {})) {
        expect(() => roommateSearchResponseSchema.parse(response)).not.toThrow();
      }
      expect(() =>
        roommateSearchManifestResponseSchema.parse(createRoommateStoryManifestResponse(scenario)),
      ).not.toThrow();
      expect(() => bookmarkListResponseSchema.parse(scenario.bookmarkResponse)).not.toThrow();
      expect(() =>
        matchRequestActionResponseSchema.parse(scenario.matchRequestResponse),
      ).not.toThrow();
      expect(() => createBlockResponseSchema.parse(scenario.blockResponse)).not.toThrow();
      expect(() => createReportResponseSchema.parse(scenario.reportResponse)).not.toThrow();

      for (const profile of Object.values(scenario.profileByTargetUserId)) {
        expect(() => publicProfileSchema.parse(profile)).not.toThrow();
      }
    }
  });

  it('keeps policy-critical privacy boundaries visible in the data shape', () => {
    const fullDetail =
      roommateStoryScenarios.seasonMatchingDetailFullCompatibility.profileByTargetUserId[
        'story-roommate-jiwoo'
      ];
    const tombstone =
      roommateStoryScenarios.seasonMatchingExceptionDetailUnavailable.profileByTargetUserId[
        'story-roommate-tombstone'
      ];

    expect(fullDetail?.detailState).toBe('FULL');
    if (fullDetail?.detailState !== 'FULL') throw new Error('expected FULL story profile');
    expect(fullDetail.compatibility?.hiddenAxisNotices).toEqual([
      { code: 'DRINKING_EXCLUDED_BY_POLICY' },
    ]);
    expect(JSON.stringify(fullDetail.lifestyle)).not.toContain('drinkingFrequency');

    expect(tombstone?.detailState).toBe('TOMBSTONE');
    if (tombstone?.detailState !== 'TOMBSTONE') throw new Error('expected TOMBSTONE story profile');
    expect('compatibility' in tombstone).toBe(false);
    expect('matchScore' in tombstone).toBe(false);
  });

  it('does not expose raw backend codes or entry context values in visible story metadata', () => {
    const visibleMetadata = Object.values(roommateStoryScenarios)
      .map((scenario) => `${scenario.title}\n${scenario.description}`)
      .join('\n');

    expect(visibleMetadata).not.toContain('detailEntryToken');
    expect(visibleMetadata).not.toContain('story-detail-context');
    expect(visibleMetadata).not.toContain('MATCH_REQUEST_NOT_ALLOWED');
    expect(visibleMetadata).not.toContain('PROFILE_NOT_VISIBLE');
    expect(visibleMetadata).not.toContain('BFF_UPSTREAM_UNAVAILABLE');
    expect(visibleMetadata).not.toContain('retained payload');
  });
});

function collectRuntimeSources(dir: string): Array<{ path: string; source: string }> {
  const entries = readdirSync(dir);
  const sources: Array<{ path: string; source: string }> = [];

  for (const entry of entries) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (entry === '__stories__' || entry === '__tests__') continue;
      sources.push(...collectRuntimeSources(path));
      continue;
    }

    if (!/\.(ts|tsx)$/.test(entry)) continue;
    sources.push({ path: relative(ROOT, path), source: readFileSync(path, 'utf8') });
  }

  return sources;
}
