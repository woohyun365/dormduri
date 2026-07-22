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
    const storySource = readStorybookStorySources();
    const fixtureSource = readFileSync(
      join(ROOMMATE_ROOT, '__stories__/roommate-story-api-fixtures.ts'),
      'utf8',
    );
    const rendererSource = readFileSync(
      join(ROOMMATE_ROOT, '__stories__/roommate-story-renderer.tsx'),
      'utf8',
    );

    expect(rendererSource).toContain('./roommate-story-api-fixtures');
    expect(storySource).toContain('./roommate-story-scenarios');
    expect(storySource).toContain('Main/RoommateTab/Season Matching/Action/MatchRequest');
    expect(storySource).toContain('Main/RoommateTab/Season Matching/Action/Bookmark');
    expect(storySource).toContain('Main/RoommateTab/Season Matching/Action/Block');
    expect(storySource).toContain('Main/RoommateTab/Season Matching/Action/Report');
    expect(storySource).toContain('Main/RoommateTab/Season Matching/Detail');
    expect(storySource).toContain('Main/RoommateTab/Season Open/Search');
    expect(storySource).not.toContain('ChatTab');
    expect(storySource).not.toContain('MatchingTab');
    expect(storySource).toContain("title: 'Main/RoommateTab/Season Matching/Action/MatchRequest'");
    expect(storySource).not.toContain("title: 'Main/RoommateTab/Season Matching/Action'");
    expect(fixtureSource).toContain('originalFetch');
    expect(fixtureSource).toContain('refCount');
    expect(fixtureSource).toContain('return originalFetch(input, init)');
  });

  it('lets every scenario use the production full-width shell without a Storybook-only outer card', () => {
    const rendererSource = readFileSync(
      join(ROOMMATE_ROOT, '__stories__/roommate-story-renderer.tsx'),
      'utf8',
    );
    const storySource = readStorybookStorySources();

    expect(rendererSource).toContain('min-h-screen w-full');
    expect(rendererSource).not.toContain('rounded-4xl border');
    expect(rendererSource).not.toContain('max-w-md');
    expect(rendererSource).toContain('candidate && !candidate.disabled');
    expect(storySource).toContain('OffSeasonClosed');
    expect(storySource).toContain('seasonOpenRegistered');
    expect(storySource).toContain('seasonOpenNotRegistered');
    expect(storySource).toContain('seasonMatchingRegistered');
    expect(storySource).toContain('seasonMatchingNotRegistered');
    expect(storySource).toContain('postMatchRegistered');
    expect(rendererSource).not.toContain("scenario.viewportHint === 'desktop'");
  });

  it('keeps story fixtures out of production RoommateTab runtime files', () => {
    const offenders = collectRuntimeSources(ROOMMATE_ROOT).filter(({ source }) => {
      return source.includes('__stories__') || source.includes('roommate-story-');
    });

    expect(offenders).toEqual([]);
  });

  it('keeps the public scenario entry small and delegates authoring to fixtures/scenario modules', () => {
    const entrySource = readFileSync(
      join(ROOMMATE_ROOT, '__stories__/roommate-story-scenarios.ts'),
      'utf8',
    );
    const authoringSource = readStorybookAuthoringSources();

    expect(entrySource.split('\n').length).toBeLessThan(500);
    expect(entrySource).toContain('./fixtures/roommateStoryTypes');
    expect(entrySource).toContain('./scenarios/roommateStoryRegistry');
    expect(authoringSource).toContain('__stories__/fixtures');
    expect(authoringSource).toContain('roommateStorySearchResponses');
    expect(authoringSource).toContain('roommateStoryRegistry');
  });
});

describe('roommateStoryScenarios policy matrix', () => {
  it('exposes search, detail, and action scenario categories', () => {
    expect(ROOMMATE_STORY_SCENARIO_KEYS).toHaveLength(51);
    expect(new Set(ROOMMATE_STORY_SCENARIO_KEYS)).toHaveLength(ROOMMATE_STORY_SCENARIO_KEYS.length);
    expect(new Set(Object.keys(roommateStoryScenarios))).toHaveLength(
      ROOMMATE_STORY_SCENARIO_KEYS.length,
    );
    expect(Object.keys(roommateStoryScenarios).sort()).toEqual(
      [...ROOMMATE_STORY_SCENARIO_KEYS].sort(),
    );

    for (const key of ROOMMATE_STORY_SCENARIO_KEYS) {
      expect(roommateStoryScenarios[key]).toBeDefined();
      expect(roommateStoryScenarios[key].key).toBe(key);
    }

    expect(ROOMMATE_STORY_CATEGORY_KEYS.search).toEqual(
      expect.arrayContaining([
        'offSeasonClosed',
        'seasonMatchingRegistered',
        'seasonMatchingRegisteredChatting',
        'seasonMatchingActiveMatched',
        'seasonMatchingUnmatched',
        'seasonMatchingDeregistered',
        'seasonMatchingNotRegistered',
        'seasonMatchingNotRegisteredEmpty',
        'seasonMatchingRegisteredEmpty',
        'seasonMatchingSearchError',
        'seasonMatchingLoadingSkeleton',
        'seasonOpenRegistered',
        'seasonOpenRegisteredChatting',
        'seasonOpenNotRegistered',
        'seasonOpenDeregistered',
        'seasonOpenRegisteredEmpty',
        'seasonOpenSearchError',
        'seasonOpenLoadingSkeleton',
        'postMatchRegistered',
        'postMatchNotRegistered',
        'postMatchDeregistered',
        'postMatchEmpty',
        'postMatchSearchError',
        'postMatchLoadingSkeleton',
      ]),
    );
    expect(ROOMMATE_STORY_CATEGORY_KEYS.detail).toEqual(
      expect.arrayContaining([
        'seasonMatchingDetailFullCompatibility',
        'seasonMatchingDetailPending',
        'seasonMatchingExceptionScoreCalculationFailed',
        'seasonMatchingExceptionDetailUnavailable',
        'seasonMatchingExceptionAccessRecheckFailed',
      ]),
    );
    expect(ROOMMATE_STORY_CATEGORY_KEYS.action).toEqual(
      expect.arrayContaining([
        'seasonMatchingMatchRequestDialog',
        'seasonMatchingMatchRequestPending',
        'seasonMatchingMatchRequestSuccess',
        'seasonMatchingPendingRequests',
        'seasonMatchingMatchRequestFailed',
        'seasonMatchingMatchRequestAlreadyPending',
        'seasonMatchingMatchRequestLimitReached',
        'seasonMatchingMatchRequestTargetMatched',
        'seasonMatchingMatchRequestTargetDeregistered',
        'seasonMatchingBookmarkStaleFailure',
        'seasonMatchingActionBlockedUser',
        'seasonMatchingBlockDialog',
        'seasonMatchingBlockPending',
        'seasonMatchingBlockFailed',
        'seasonMatchingBlockSuccessReceipt',
        'seasonMatchingReportDialog',
        'seasonMatchingReportPending',
        'seasonMatchingReportFailed',
        'seasonMatchingReportSuccessReceipt',
        'seasonMatchingReportOptionalBlockReceipt',
      ]),
    );
    expect(roommateStoryScenarios.seasonMatchingDetailPending).toMatchObject({
      autoOpen: 'detail',
      category: 'detail',
      profileResponseDelayMs: expect.any(Number),
    });
    expect(roommateStoryScenarios.seasonMatchingMatchRequestPending).toMatchObject({
      autoOpen: 'match-request-submit',
      responseDelayMs: expect.any(Number),
    });
    expect(roommateStoryScenarios.seasonMatchingMatchRequestSuccess).toMatchObject({
      autoOpen: 'match-request-submit',
    });
    expect(roommateStoryScenarios.seasonMatchingPendingRequests.searchResponse.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pendingMatchRequest: expect.objectContaining({ direction: 'SENT' }),
        }),
        expect.objectContaining({
          pendingMatchRequest: expect.objectContaining({ direction: 'RECEIVED' }),
        }),
      ]),
    );
    expect(roommateStoryScenarios.seasonMatchingMatchRequestFailed).toMatchObject({
      autoOpen: 'match-request-submit',
      matchRequestError: { code: 'BFF_UPSTREAM_UNAVAILABLE', status: 503 },
    });
    expect(roommateStoryScenarios.seasonMatchingBlockPending).toMatchObject({
      autoOpen: 'block-submit',
      responseDelayMs: expect.any(Number),
    });
    expect(roommateStoryScenarios.seasonMatchingBlockFailed).toMatchObject({
      autoOpen: 'block-submit',
      blockError: { code: 'BFF_UPSTREAM_UNAVAILABLE', status: 503 },
    });
    expect(roommateStoryScenarios.seasonMatchingReportPending).toMatchObject({
      autoOpen: 'report-submit',
      responseDelayMs: expect.any(Number),
    });
    expect(roommateStoryScenarios.seasonMatchingReportFailed).toMatchObject({
      autoOpen: 'report-submit',
      reportError: { code: 'BFF_UPSTREAM_UNAVAILABLE', status: 503 },
    });
    expect(roommateStoryScenarios.seasonMatchingReportSuccessReceipt).toMatchObject({
      autoOpen: 'report-submit',
    });
    expect(roommateStoryScenarios.seasonMatchingReportOptionalBlockReceipt).toMatchObject({
      autoOpen: 'report-optional-block-submit',
      reportResponse: expect.objectContaining({
        optionalActionResult: expect.objectContaining({ status: 'SUCCEEDED' }),
      }),
    });
  });

  it('organizes primary RoommateTab stories by HomeTab-style season state groups', () => {
    expect(ROOMMATE_STORY_SEASON_GROUP_KEYS).toEqual({
      offSeason: ['offSeasonClosed'],
      seasonOpen: [
        'seasonOpenRegistered',
        'seasonOpenRegisteredChatting',
        'seasonOpenNotRegistered',
        'seasonOpenDeregistered',
        'seasonOpenRegisteredEmpty',
        'seasonOpenSearchError',
        'seasonOpenLoadingSkeleton',
      ],
      seasonMatching: expect.arrayContaining([
        'seasonMatchingRegistered',
        'seasonMatchingRegisteredChatting',
        'seasonMatchingActiveMatched',
        'seasonMatchingUnmatched',
        'seasonMatchingDeregistered',
        'seasonMatchingNotRegistered',
        'seasonMatchingNotRegisteredEmpty',
        'seasonMatchingRegisteredEmpty',
        'seasonMatchingSearchError',
        'seasonMatchingLoadingSkeleton',
        'seasonMatchingDetailFullCompatibility',
        'seasonMatchingMatchRequestDialog',
        'seasonMatchingMatchRequestPending',
        'seasonMatchingMatchRequestSuccess',
        'seasonMatchingPendingRequests',
        'seasonMatchingMatchRequestFailed',
        'seasonMatchingMatchRequestTargetMatched',
        'seasonMatchingMatchRequestTargetDeregistered',
        'seasonMatchingBookmarkStaleFailure',
        'seasonMatchingBlockDialog',
        'seasonMatchingBlockPending',
        'seasonMatchingBlockFailed',
        'seasonMatchingBlockSuccessReceipt',
      ]),
      postMatch: [
        'postMatchRegistered',
        'postMatchNotRegistered',
        'postMatchDeregistered',
        'postMatchEmpty',
        'postMatchSearchError',
        'postMatchLoadingSkeleton',
      ],
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
        scopeAvailability: { campusMerged: true, sameBuildingOnly: true },
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
    expect(roommateStoryScenarios.seasonOpenRegisteredChatting).toMatchObject({
      seasonGroup: 'seasonOpen',
      seasonContext: { state: 'SEASON_OPEN' },
      searchResponse: {
        scope: 'SAME_BUILDING_ONLY',
        items: expect.arrayContaining([
          expect.objectContaining({
            profileSummary: expect.objectContaining({ nickname: '오픈대화중' }),
            actions: expect.objectContaining({ canStartChat: true }),
            activeChatThread: expect.objectContaining({
              status: 'OPEN',
              threadKind: 'DIRECT',
            }),
          }),
        ]),
      },
    });
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
      manifest: { purpose: 'BROAD_PREVIEW' },
    });
    expect(roommateStoryScenarios.seasonOpenDeregistered).toMatchObject({
      seasonGroup: 'seasonOpen',
      searchEntryAllowed: true,
      viewer: { dormitoryId: null },
      seasonContext: { state: 'SEASON_OPEN' },
      searchResponse: {
        scope: 'CAMPUS_MERGED',
        scopeAvailability: { campusMerged: true, sameBuildingOnly: true },
        manifest: { purpose: 'BROAD_PREVIEW' },
      },
      sameDormitoryRestrictedEmptyState: {
        title: expect.stringContaining('같은 건물 후보를 볼 수 없어요'),
        message: expect.stringContaining('캠퍼스 전체'),
      },
    });
    expect(
      roommateStoryScenarios.seasonOpenDeregistered.searchResponsesByScope?.SAME_BUILDING_ONLY,
    ).toMatchObject({
      scope: 'SAME_BUILDING_ONLY',
      scopeAvailability: { campusMerged: true, sameBuildingOnly: true },
      items: [],
      manifest: { purpose: 'BROAD_PREVIEW' },
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
        scopeAvailability: { campusMerged: true, sameBuildingOnly: true },
        manifest: { purpose: 'ACTIONABLE_DETAIL_DISCOVERY' },
      },
    });
    expect(roommateStoryScenarios.seasonMatchingRegistered.searchResponsesByScope).toMatchObject({
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
      roommateStoryScenarios.seasonMatchingRegistered.searchResponsesByScope?.SAME_BUILDING_ONLY
        ?.items,
    ).toEqual(
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
    expect(roommateStoryScenarios.seasonMatchingRegisteredChatting).toMatchObject({
      seasonGroup: 'seasonMatching',
      seasonContext: { state: 'SEASON_MATCHING' },
      searchResponse: {
        scope: 'SAME_BUILDING_ONLY',
      },
      searchResponsesByScope: {
        SAME_BUILDING_ONLY: {
          scope: 'SAME_BUILDING_ONLY',
          items: expect.arrayContaining([
            expect.objectContaining({
              profileSummary: expect.objectContaining({ nickname: '매칭대화중' }),
              actions: expect.objectContaining({ canStartChat: true }),
              activeChatThread: expect.objectContaining({
                status: 'OPEN',
                threadKind: 'DIRECT',
              }),
            }),
          ]),
        },
      },
    });
    expect(roommateStoryScenarios.seasonMatchingActiveMatched).toMatchObject({
      seasonGroup: 'seasonMatching',
      seasonContext: { state: 'SEASON_MATCHING' },
      searchResponse: {
        scope: 'SAME_BUILDING_ONLY',
        scopeAvailability: { campusMerged: true, sameBuildingOnly: true },
        manifest: { purpose: 'BROAD_PREVIEW' },
        items: expect.arrayContaining([
          expect.objectContaining({
            exposure: expect.objectContaining({ detailViewable: false, scoreVisible: false }),
            actions: expect.objectContaining({
              canBookmark: false,
              canRequestMatch: false,
              canStartChat: false,
              unavailableReasons: ['VIEWER_ALREADY_MATCHED'],
            }),
          }),
        ]),
      },
      searchResponsesByScope: {
        SAME_BUILDING_ONLY: {
          scope: 'SAME_BUILDING_ONLY',
          manifest: { purpose: 'BROAD_PREVIEW' },
          items: expect.arrayContaining([
            expect.objectContaining({
              exposure: expect.objectContaining({ detailViewable: false, scoreVisible: false }),
              actions: expect.objectContaining({
                canBookmark: false,
                canRequestMatch: false,
                canStartChat: false,
                unavailableReasons: ['VIEWER_ALREADY_MATCHED'],
              }),
            }),
          ]),
        },
      },
    });
    expect(roommateStoryScenarios.seasonMatchingUnmatched).toMatchObject({
      seasonGroup: 'seasonMatching',
      seasonContext: { state: 'SEASON_MATCHING' },
      searchResponse: {
        scope: 'SAME_BUILDING_ONLY',
        items: expect.arrayContaining([
          expect.objectContaining({
            actions: expect.objectContaining({ canRequestMatch: true }),
          }),
          expect.objectContaining({
            actions: expect.objectContaining({
              unavailableReasons: ['MATCH_REQUEST_DIRECTION_LIMIT_REACHED'],
            }),
          }),
        ]),
      },
    });
    expect(roommateStoryScenarios.seasonMatchingDeregistered).toMatchObject({
      seasonGroup: 'seasonMatching',
      searchEntryAllowed: true,
      viewer: { dormitoryId: null },
      seasonContext: { state: 'SEASON_MATCHING' },
      searchResponse: {
        scope: 'CAMPUS_MERGED',
        scopeAvailability: { campusMerged: true, sameBuildingOnly: true },
        manifest: { purpose: 'BROAD_PREVIEW' },
      },
      sameDormitoryRestrictedEmptyState: {
        title: expect.stringContaining('같은 건물 후보를 볼 수 없어요'),
        message: expect.stringContaining('생활패턴 비교'),
      },
    });
    expect(
      roommateStoryScenarios.seasonMatchingDeregistered.searchResponsesByScope?.SAME_BUILDING_ONLY,
    ).toMatchObject({
      scope: 'SAME_BUILDING_ONLY',
      scopeAvailability: { campusMerged: true, sameBuildingOnly: true },
      items: [],
      manifest: { purpose: 'BROAD_PREVIEW' },
    });
    expect(
      roommateStoryScenarios.seasonMatchingRegistered.searchResponsesByScope?.SAME_BUILDING_ONLY
        ?.availabilityNotices,
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
        scopeAvailability: { campusMerged: true, sameBuildingOnly: true },
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
    expect(
      roommateStoryScenarios.seasonMatchingNotRegistered.searchResponsesByScope?.SAME_BUILDING_ONLY,
    ).toMatchObject({
      scope: 'SAME_BUILDING_ONLY',
      items: [],
      scopeAvailability: { campusMerged: true, sameBuildingOnly: true },
      manifest: { purpose: 'BROAD_PREVIEW' },
    });
    expect(roommateStoryScenarios.seasonMatchingNotRegisteredEmpty).toMatchObject({
      seasonGroup: 'seasonMatching',
      viewer: { dormitoryId: null },
      searchResponse: {
        scope: 'CAMPUS_MERGED',
        items: [],
        scopeAvailability: { campusMerged: true, sameBuildingOnly: true },
        manifest: { purpose: 'BROAD_PREVIEW' },
      },
    });
    expect(roommateStoryScenarios.seasonMatchingRegisteredEmpty).toMatchObject({
      seasonGroup: 'seasonMatching',
      searchResponse: {
        scope: 'SAME_BUILDING_ONLY',
        items: [],
        scopeAvailability: { campusMerged: true, sameBuildingOnly: true },
        manifest: { purpose: 'ACTIONABLE_DETAIL_DISCOVERY' },
      },
      searchResponsesByScope: {
        SAME_BUILDING_ONLY: {
          scope: 'SAME_BUILDING_ONLY',
          items: [],
          manifest: { purpose: 'ACTIONABLE_DETAIL_DISCOVERY' },
        },
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
    expect(roommateStoryScenarios.seasonMatchingMatchRequestAlreadyPending).toMatchObject({
      title: expect.stringContaining('Stale Pending Request Race'),
      autoOpen: 'match-request-submit',
      matchRequestError: { code: 'MATCH_REQUEST_ALREADY_PENDING', status: 409 },
    });
    expect(roommateStoryScenarios.seasonMatchingMatchRequestLimitReached).toMatchObject({
      autoOpen: 'detail',
      searchResponse: {
        scope: 'SAME_BUILDING_ONLY',
        items: expect.arrayContaining([
          expect.objectContaining({
            profileSummary: expect.objectContaining({ nickname: '횟수초과' }),
            actions: expect.objectContaining({
              canRequestMatch: false,
              canStartChat: true,
              unavailableReasons: ['MATCH_REQUEST_DIRECTION_LIMIT_REACHED'],
            }),
          }),
        ]),
      },
    });
    expect(
      roommateStoryScenarios.seasonMatchingMatchRequestLimitReached.searchResponse.items.map(
        (item) => item.profileSummary.nickname,
      ),
    ).toEqual(['횟수초과']);
    expect(
      roommateStoryScenarios.seasonMatchingMatchRequestLimitReached.matchRequestError,
    ).toBeUndefined();
    expect(roommateStoryScenarios.seasonMatchingMatchRequestTargetMatched).toMatchObject({
      autoOpen: 'match-request-submit',
      matchRequestError: { code: 'ACTIVE_MATCH_ALREADY_EXISTS', status: 409 },
    });
    expect(
      roommateStoryScenarios.seasonMatchingMatchRequestTargetMatched.searchResponse.items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relation: { type: 'GENERAL' },
          resultRead: { resultReadable: false, context: 'NONE' },
          actions: expect.objectContaining({
            canRequestMatch: true,
            canStartChat: true,
            unavailableReasons: [],
          }),
        }),
      ]),
    );
    expect(roommateStoryScenarios.seasonMatchingMatchRequestTargetDeregistered).toMatchObject({
      autoOpen: 'match-request-submit',
      matchRequestError: { code: 'MATCH_REQUEST_TARGET_NOT_FOUND', status: 404 },
    });
    expect(roommateStoryScenarios.seasonMatchingBookmarkStaleFailure).toMatchObject({
      autoOpen: 'bookmark-toggle',
      bookmarkError: { code: 'TARGET_NOT_BOOKMARKABLE', status: 404 },
    });
    expect(roommateStoryScenarios.seasonMatchingActionBlockedUser.searchResponse.items).toEqual([
      expect.objectContaining({
        exposure: expect.objectContaining({ detailViewable: false, scoreVisible: false }),
        actions: expect.objectContaining({
          canBookmark: false,
          canRequestMatch: false,
          canStartChat: false,
          unavailableReasons: ['SAFETY_OR_VISIBILITY_RESTRICTED'],
        }),
      }),
    ]);
    expect(roommateStoryScenarios.postMatchRegistered).toMatchObject({
      seasonGroup: 'postMatch',
      seasonContext: { state: 'SEASON_POST_MATCH' },
      category: 'search',
      searchResponse: {
        scope: 'SAME_BUILDING_ONLY',
        manifest: { purpose: 'POST_MATCH_COHORT_REVIEW' },
      },
    });
    expect(roommateStoryScenarios.postMatchRegistered.searchResponsesByScope).toMatchObject({
      CAMPUS_MERGED: { scope: 'CAMPUS_MERGED', manifest: { purpose: 'BROAD_PREVIEW' } },
      SAME_BUILDING_ONLY: {
        scope: 'SAME_BUILDING_ONLY',
        manifest: { purpose: 'POST_MATCH_COHORT_REVIEW' },
      },
    });
    expect(roommateStoryScenarios.postMatchRegistered.searchResponse.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relation: { type: 'GENERAL' },
          resultRead: { resultReadable: false, context: 'NONE' },
          exposure: expect.objectContaining({
            detailViewable: false,
            canViewFull: false,
            scoreVisible: false,
          }),
          actions: expect.objectContaining({
            canBookmark: false,
            canRequestMatch: false,
            canStartChat: false,
            unavailableReasons: ['SEASON_NOT_ACTIONABLE'],
          }),
        }),
      ]),
    );
    expect(roommateStoryScenarios.postMatchNotRegistered).toMatchObject({
      seasonGroup: 'postMatch',
      viewer: expect.objectContaining({ dormitoryId: null }),
      sameDormitoryRestrictedEmptyState: expect.objectContaining({
        title: '시즌 등록 이력이 있어야 목록을 볼 수 있어요.',
      }),
    });
    expect(roommateStoryScenarios.postMatchDeregistered).toMatchObject({
      seasonGroup: 'postMatch',
      viewer: expect.objectContaining({ dormitoryId: null }),
      sameDormitoryRestrictedEmptyState: expect.objectContaining({
        title: '시즌 참여 철회 후 같은 건물 후보를 볼 수 없어요.',
      }),
    });
    expect(roommateStoryScenarios.postMatchEmpty.searchResponse.items).toEqual([]);
    expect(roommateStoryScenarios.postMatchSearchError).toMatchObject({
      searchErrorCode: 'BFF_UPSTREAM_UNAVAILABLE',
      searchErrorStatus: 503,
    });
    expect(roommateStoryScenarios.postMatchLoadingSkeleton).toMatchObject({
      searchResponseDelayMs: expect.any(Number),
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

  it('match request success story refreshes the submitted target as sent pending request', () => {
    const scenario = roommateStoryScenarios.seasonMatchingMatchRequestSuccess;
    const response = createRoommateStorySearchResponse(
      scenario,
      {
        method: 'GET',
        pathname: '/api/roommate-search',
        searchParams: new URLSearchParams('scope=SAME_BUILDING_ONLY'),
      },
      {
        targetUserId: scenario.matchRequestResponse.request.counterpartUserId,
        requestId: scenario.matchRequestResponse.request.id,
        createdAt: scenario.matchRequestResponse.request.createdAt,
        expiresAt: scenario.matchRequestResponse.request.expiresAt,
      },
    );

    expect(response.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: scenario.matchRequestResponse.request.counterpartUserId,
          pendingMatchRequest: expect.objectContaining({
            id: scenario.matchRequestResponse.request.id,
            direction: 'SENT',
          }),
        }),
      ]),
    );
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

  it('uses one viewer-condition fixture with smoking and sleep score matrix targets', () => {
    const scenario = roommateStoryScenarios.seasonMatchingDetailFullCompatibility;
    const storyScenarioSource = readStorybookAuthoringSources();

    expect(scenario.searchResponse.items).toHaveLength(9);
    expect(scenario.searchResponse.items.map((item) => item.matchScore)).toContain(100);
    expect(storyScenarioSource).toContain("from '@repo/shared/profile/compatibility-scoring'");
    expect(storyScenarioSource).toContain('buildPublicProfileCompatibility');

    const fullProfiles = scenario.searchResponse.items.map((item) => {
      const profile = scenario.profileByTargetUserId[item.id];
      expect(profile?.detailState).toBe('FULL');
      if (profile?.detailState !== 'FULL') {
        throw new Error(`expected FULL profile for ${item.id}`);
      }
      return profile;
    });

    const dimensionBuckets = new Set(
      fullProfiles.flatMap(
        (profile) => profile.compatibility?.dimensions.map((dimension) => dimension.bucket) ?? [],
      ),
    );
    expect(dimensionBuckets).toEqual(new Set(['HIGH', 'MEDIUM', 'LOW']));

    expect(
      fullProfiles.some((profile) =>
        profile.compatibility?.dimensions.every((dimension) => dimension.bucket === 'HIGH'),
      ),
    ).toBe(true);
    expect(
      fullProfiles.some((profile) =>
        profile.compatibility?.dimensions.some((dimension) => dimension.bucket === 'LOW'),
      ),
    ).toBe(true);
    expect(
      fullProfiles.some((profile) =>
        profile.compatibility?.dimensions.some((dimension) => dimension.bucket === 'MEDIUM'),
      ),
    ).toBe(true);
    expect(
      fullProfiles.find((profile) => profile.id === 'story-roommate-full-minju')?.compatibility,
    ).toMatchObject({
      dimensions: expect.arrayContaining([
        expect.objectContaining({ id: 'SMOKING', score: 100, bucket: 'HIGH' }),
      ]),
      axes: expect.arrayContaining([
        expect.objectContaining({
          id: 'SMOKING',
          score: 100,
          bucket: 'HIGH',
          comparison: expect.objectContaining({
            targetText: '비흡연',
            viewerText: '전담까지는 OK',
          }),
        }),
      ]),
    });
    expect(
      fullProfiles.find((profile) => profile.id === 'story-roommate-full-sua')?.compatibility,
    ).toMatchObject({
      axes: expect.arrayContaining([
        expect.objectContaining({
          id: 'WAKE_TIME',
          score: null,
          bucket: 'UNKNOWN',
          comparison: expect.objectContaining({
            targetText: '수업에 따라 유동적',
            viewerText: '수업에 따라 유동적',
          }),
        }),
      ]),
    });
    expect(
      fullProfiles.map(
        (profile) =>
          profile.compatibility?.axes.find((axis) => axis.id === 'SMOKING')?.score ?? null,
      ),
    ).toEqual([100, 100, 100, 100, 0, 0, 0, 0, 100]);
    expect(
      fullProfiles.map(
        (profile) =>
          profile.compatibility?.axes.find((axis) => axis.id === 'BEDTIME')?.score ?? null,
      ),
    ).toEqual([100, 33, 67, 67, 100, 100, 67, 67, 100]);
    expect(
      fullProfiles.map(
        (profile) =>
          profile.compatibility?.axes.find((axis) => axis.id === 'WAKE_TIME')?.score ?? null,
      ),
    ).toEqual([null, null, null, null, null, null, null, null, null]);
    expect(
      fullProfiles.map(
        (profile) =>
          profile.compatibility?.axes.find((axis) => axis.id === 'WAKE_TIME')?.comparison
            .targetText ?? null,
      ),
    ).toEqual([
      '10시 이후',
      '수업에 따라 유동적',
      '7~8시',
      '수업에 따라 유동적',
      '8~9시',
      '수업에 따라 유동적',
      '9~10시',
      '10시 이후',
      '수업에 따라 유동적',
    ]);
    expect(
      fullProfiles.map(
        (profile) =>
          profile.compatibility?.axes.find((axis) => axis.id === 'SLEEP_HABIT')?.score ?? null,
      ),
    ).toEqual([100, 80, 50, 20, 100, 80, 50, 20, 100]);
    expect(
      fullProfiles.map(
        (profile) =>
          profile.compatibility?.axes.find((axis) => axis.id === 'SLEEP_HABIT')?.comparison
            .targetText ?? null,
      ),
    ).toEqual(['없음', '잠꼬대', '이갈이', '코골이', '없음', '잠꼬대', '이갈이', '코골이', '없음']);
    expect(
      fullProfiles.map(
        (profile) =>
          profile.compatibility?.axes.find((axis) => axis.id === 'TEMPERATURE')?.comparison
            .targetText ?? null,
      ),
    ).toEqual([
      '보통',
      '보통',
      '보통',
      '추위 타요',
      '더위 타요',
      '보통',
      '보통',
      '더위 타요',
      '보통',
    ]);
    expect(
      fullProfiles.every(
        (profile) =>
          profile.compatibility?.axes.find((axis) => axis.id === 'SLEEP_HABIT')?.comparison
            .viewerText === '보통',
      ),
    ).toBe(true);

    for (const profile of fullProfiles) {
      expect(profile.compatibility?.dimensions).toHaveLength(8);
      expect(profile.compatibility?.axes).toHaveLength(12);
      expect(profile.compatibility?.axes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'SMOKING',
            comparison: expect.objectContaining({ viewerText: '전담까지는 OK' }),
          }),
          expect.objectContaining({
            id: 'RELATIONSHIP',
            comparison: expect.objectContaining({
              viewerText: '친하게 지내요',
            }),
          }),
        ]),
      );
      expect(
        profile.compatibility?.axes
          .filter((axis) => axis.id === 'RELATIONSHIP')
          .every((axis) => axis.score === 0 || axis.score === 100),
      ).toBe(true);
      expect(
        profile.compatibility?.axes
          .filter((axis) => axis.id === 'SMOKING')
          .every((axis) => axis.score === 0 || axis.score === 100),
      ).toBe(true);
    }
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

function readStorybookStorySources(): string {
  const storyDir = join(ROOMMATE_ROOT, '__stories__');
  return readdirSync(storyDir)
    .filter((entry) => entry.endsWith('.stories.tsx'))
    .map((entry) => readFileSync(join(storyDir, entry), 'utf8'))
    .join('\n');
}

function readStorybookAuthoringSources(): string {
  return collectStorybookAuthoringSources(join(ROOMMATE_ROOT, '__stories__'))
    .map(({ path, source }) => `${path}\n${source}`)
    .join('\n');
}

function collectStorybookAuthoringSources(dir: string): Array<{ path: string; source: string }> {
  const entries = readdirSync(dir);
  const sources: Array<{ path: string; source: string }> = [];

  for (const entry of entries) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      sources.push(...collectStorybookAuthoringSources(path));
      continue;
    }

    if (!/\.(ts|tsx)$/.test(entry)) continue;
    sources.push({ path: relative(ROOT, path), source: readFileSync(path, 'utf8') });
  }

  return sources;
}

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
