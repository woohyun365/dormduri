import { describe, expect, it } from 'vitest';
import {
  canonicalMatchingDesignReviewMatrix,
  MATCHING_DESIGN_REVIEW_VIEWPORTS,
  matchingDesignReviewParameters,
} from './matching-design-review-matrix';
import { matchingSeasonStory } from './matching-season-story-fixtures';

describe('canonical matching design review matrix', () => {
  it('four-season screen 안에 request/active/history visual evidence를 같은 viewport 기준으로 고정한다', () => {
    expect(canonicalMatchingDesignReviewMatrix).toEqual(
      expect.arrayContaining([
        'off-season:policy',
        'off-season:history',
        'off-season:history-profile',
        'season-open:history',
        'season-open:deregistered-gate',
        'season-matching:history',
        'season-matching:registration-gate',
        'season-matching:received-request',
        'season-matching:sent-request',
        'season-matching:active-pair',
        'season-matching:activity',
        'season-matching:deregistered-activity',
        'season-matching:unmatch-progress',
        'season-post-match:active',
        'season-post-match:history',
        'season-post-match:policy',
        'season-post-match:deregistered-activity',
        'system:loading-error-recovery',
      ]),
    );
    expect(MATCHING_DESIGN_REVIEW_VIEWPORTS).toEqual([320, 360, 390, 430, 1280, 1440]);
    expect(canonicalMatchingDesignReviewMatrix.join(' ')).not.toMatch(/group/i);
  });

  it('story metadata는 fixed serverNow와 keyboard/overflow 확인 조건을 함께 남긴다', () => {
    expect(
      matchingDesignReviewParameters({
        scenario: 'season-matching:received-request',
        serverNow: '2026-08-01T00:00:00.000Z',
        longCopy: true,
      }),
    ).toEqual({
      matchingDesignReview: {
        scenario: 'season-matching:received-request',
        serverNow: '2026-08-01T00:00:00.000Z',
        viewports: [320, 360, 390, 430, 1280, 1440],
        longCopy: true,
        aria: 'manual-tabs, visible-focus, no-horizontal-scroll',
      },
    });
  });

  it('OFF_SEASON story도 production과 같이 지난 기록을 기본 선택한다', () => {
    const story = matchingSeasonStory(
      {
        kind: 'off-season',
        historySummary: { seasons: 1, matchedCount: 1, unmatchedCount: 0 },
      },
      'off-season:history',
    );

    expect(story.args).toMatchObject({ selectedSection: 'past' });
  });
});
