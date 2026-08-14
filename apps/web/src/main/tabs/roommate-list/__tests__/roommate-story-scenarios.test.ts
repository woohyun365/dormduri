import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { matchRequestActionResponseSchema } from '@repo/shared/match/contract';
import { publicProfileSchema } from '@repo/shared/profile/contract';
import {
  roommateSearchManifestResponseSchema,
  roommateSearchResponseSchema,
} from '@repo/shared/roommate-search/contract';
import { bookmarkListResponseSchema } from '@repo/shared/social-safety/bookmark';
import { createBlockResponseSchema } from '@repo/shared/social-safety/block';
import { createReportResponseSchema } from '@repo/shared/social-safety/report';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { createRoommateStorySearchResponse } from '../__stories__/roommate-story-api-fixtures';
import { RoommateListTabStorySurface } from '../__stories__/roommate-story-renderer';
import {
  createRoommateStoryManifestResponse,
  roommateStoryScenarios,
} from '../__stories__/roommate-story-scenarios';

const ROOT = process.cwd();
const ROOMMATE_ROOT = join(ROOT, 'src/main/tabs/roommate-list');

describe('RoommateTab Storybook ownership', () => {
  it('renders the production tab through a story-only API fixture boundary', () => {
    const rendererSource = readFileSync(
      join(ROOMMATE_ROOT, '__stories__/roommate-story-renderer.tsx'),
      'utf8',
    );
    const fixtureSource = readFileSync(
      join(ROOMMATE_ROOT, '__stories__/roommate-story-api-fixtures.ts'),
      'utf8',
    );

    expect(rendererSource).toContain("from '../RoommateListTab'");
    expect(rendererSource).toContain('./roommate-story-api-fixtures');
    expect(rendererSource).toContain('min-h-screen w-full');
    expect(rendererSource).not.toContain('rounded-4xl border');
    expect(fixtureSource).toContain('return originalFetch(input, init)');
  });

  it('keeps story fixture modules out of production runtime sources', () => {
    const offenders = collectRuntimeSources(ROOMMATE_ROOT).filter(({ source }) =>
      /__stories__|roommate-story-/u.test(source),
    );

    expect(offenders).toEqual([]);
  });

  it('renders a representative policy state through the production surface', async () => {
    render(
      createElement(RoommateListTabStorySurface, {
        scenario: roommateStoryScenarios.offSeasonClosed,
      }),
    );

    expect(await screen.findByText('룸메이트 찾기')).toBeInTheDocument();
    expect(screen.getByText('현재는 비시즌입니다')).toBeInTheDocument();
  });
});

describe('roommate story contract fixtures', () => {
  it('validates every API payload with its owning shared schema', () => {
    for (const [key, scenario] of Object.entries(roommateStoryScenarios)) {
      expect(scenario.key).toBe(key);
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

  it('keeps representative season capability states policy-correct', () => {
    expect(roommateStoryScenarios.offSeasonClosed).toMatchObject({
      searchEntryAllowed: false,
      seasonContext: { state: 'OFF_SEASON' },
    });
    expect(roommateStoryScenarios.seasonOpenRegistered).toMatchObject({
      seasonContext: { state: 'SEASON_OPEN' },
      searchResponse: {
        scope: 'SAME_BUILDING_ONLY',
        manifest: { purpose: 'ACTIONABLE_DETAIL_DISCOVERY' },
        items: expect.arrayContaining([
          expect.objectContaining({
            actions: expect.objectContaining({
              canRequestMatch: false,
              canStartChat: true,
              unavailableReasons: ['SEASON_NOT_ACTIONABLE'],
            }),
          }),
        ]),
      },
    });
    expect(roommateStoryScenarios.seasonMatchingRegistered).toMatchObject({
      seasonContext: { state: 'SEASON_MATCHING' },
      searchResponse: {
        scope: 'SAME_BUILDING_ONLY',
        manifest: { purpose: 'ACTIONABLE_DETAIL_DISCOVERY' },
        items: expect.arrayContaining([
          expect.objectContaining({
            actions: expect.objectContaining({
              canRequestMatch: true,
              canStartChat: true,
              unavailableReasons: [],
            }),
          }),
        ]),
      },
    });
    expect(roommateStoryScenarios.seasonMatchingNotRegistered).toMatchObject({
      viewer: { dormitoryId: null },
      searchResponse: {
        scope: 'CAMPUS_MERGED',
        manifest: { purpose: 'BROAD_PREVIEW' },
        items: expect.arrayContaining([
          expect.objectContaining({
            exposure: expect.objectContaining({ detailViewable: false, scoreVisible: false }),
            actions: expect.objectContaining({
              canBookmark: false,
              canRequestMatch: false,
              canStartChat: false,
            }),
          }),
        ]),
      },
    });
    expect(roommateStoryScenarios.seasonMatchingActiveMatched.searchResponse.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actions: expect.objectContaining({
            unavailableReasons: ['VIEWER_ALREADY_MATCHED'],
          }),
        }),
      ]),
    );
    expect(roommateStoryScenarios.postMatchRegistered).toMatchObject({
      seasonContext: { state: 'SEASON_POST_MATCH' },
      searchResponse: {
        manifest: { purpose: 'POST_MATCH_COHORT_REVIEW' },
        items: expect.arrayContaining([
          expect.objectContaining({
            exposure: expect.objectContaining({ detailViewable: false, scoreVisible: false }),
            actions: expect.objectContaining({
              canRequestMatch: false,
              canStartChat: false,
              unavailableReasons: ['SEASON_NOT_ACTIONABLE'],
            }),
          }),
        ]),
      },
    });
  });

  it('preserves privacy boundaries for full, tombstone, and blocked targets', () => {
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
  });

  it('keeps representative action races and refreshed request state observable', () => {
    expect(roommateStoryScenarios.seasonMatchingMatchRequestAlreadyPending).toMatchObject({
      autoOpen: 'match-request-submit',
      matchRequestError: { code: 'MATCH_REQUEST_ALREADY_PENDING', status: 409 },
    });
    expect(roommateStoryScenarios.seasonMatchingMatchRequestTargetDeregistered).toMatchObject({
      autoOpen: 'match-request-submit',
      matchRequestError: { code: 'MATCH_REQUEST_TARGET_NOT_FOUND', status: 404 },
    });

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

  it('does not expose backend codes or fixture tokens in visible metadata', () => {
    const visibleMetadata = Object.values(roommateStoryScenarios)
      .map((scenario) => `${scenario.title}\n${scenario.description}`)
      .join('\n');

    expect(visibleMetadata).not.toMatch(
      /detailEntryToken|story-detail-context|MATCH_REQUEST_NOT_ALLOWED|PROFILE_NOT_VISIBLE|BFF_UPSTREAM_UNAVAILABLE|retained payload/u,
    );
  });
});

function collectRuntimeSources(dir: string): Array<{ path: string; source: string }> {
  const sources: Array<{ path: string; source: string }> = [];

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (entry === '__stories__' || entry === '__tests__') continue;
      sources.push(...collectRuntimeSources(path));
      continue;
    }
    if (!/\.(ts|tsx)$/u.test(entry)) continue;
    sources.push({ path: relative(ROOT, path), source: readFileSync(path, 'utf8') });
  }

  return sources;
}
