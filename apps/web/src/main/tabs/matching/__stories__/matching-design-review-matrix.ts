export const MATCHING_DESIGN_REVIEW_VIEWPORTS = [320, 360, 390, 430, 1280, 1440] as const;

export const canonicalMatchingDesignReviewMatrix = [
  'off-season:policy',
  'off-season:history',
  'off-season:history-profile',
  'season-open:history',
  'season-open:deregistered-gate',
  'season-matching:empty',
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
] as const;

export function matchingDesignReviewParameters(input: {
  readonly scenario: (typeof canonicalMatchingDesignReviewMatrix)[number];
  readonly serverNow: string;
  readonly longCopy?: boolean;
}) {
  return {
    matchingDesignReview: {
      scenario: input.scenario,
      serverNow: input.serverNow,
      viewports: MATCHING_DESIGN_REVIEW_VIEWPORTS,
      longCopy: input.longCopy ?? false,
      aria: 'manual-tabs, visible-focus, no-horizontal-scroll',
    },
  };
}
