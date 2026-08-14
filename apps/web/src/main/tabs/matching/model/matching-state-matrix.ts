import type { SeasonState } from '@repo/shared/season/runtime';

export const MATCHING_SEASON_STATES = [
  'OFF_SEASON',
  'SEASON_OPEN',
  'SEASON_MATCHING',
  'SEASON_POST_MATCH',
] as const satisfies readonly SeasonState[];

export type MatchingActionAvailability = 'CLOSED' | 'SERVER_CAPABILITY';

export interface MatchingSeasonStateRule {
  readonly state: SeasonState;
  readonly view: 'off-season' | 'season-open' | 'season-matching' | 'season-post-match';
  /**
   * FE는 action을 재판정하지 않는다. `SERVER_CAPABILITY`도 허용이 아니라
   * 후속 overview action capability를 읽어야 한다는 뜻이다.
   */
  readonly matchingActions: MatchingActionAvailability;
  readonly scoreSource: 'SERVER_VISIBILITY';
  readonly activeResultVisible: boolean;
}

export const MATCHING_SEASON_STATE_MATRIX = {
  OFF_SEASON: {
    state: 'OFF_SEASON',
    view: 'off-season',
    matchingActions: 'CLOSED',
    scoreSource: 'SERVER_VISIBILITY',
    activeResultVisible: false,
  },
  SEASON_OPEN: {
    state: 'SEASON_OPEN',
    view: 'season-open',
    matchingActions: 'CLOSED',
    scoreSource: 'SERVER_VISIBILITY',
    activeResultVisible: false,
  },
  SEASON_MATCHING: {
    state: 'SEASON_MATCHING',
    view: 'season-matching',
    matchingActions: 'SERVER_CAPABILITY',
    scoreSource: 'SERVER_VISIBILITY',
    activeResultVisible: true,
  },
  SEASON_POST_MATCH: {
    state: 'SEASON_POST_MATCH',
    view: 'season-post-match',
    matchingActions: 'CLOSED',
    scoreSource: 'SERVER_VISIBILITY',
    activeResultVisible: true,
  },
} as const satisfies Record<SeasonState, MatchingSeasonStateRule>;

export type ServerScoreDisplay =
  | { readonly kind: 'visible'; readonly value: number }
  | { readonly kind: 'hidden' }
  | { readonly kind: 'unavailable' };

/**
 * Runtime contract가 준비되기 전에도 score의 ownership을 고정한다.
 * scoreVisible=false이면 어떤 local lifestyle 값도 score로 복원하지 않는다.
 */
export function resolveServerScoreDisplay(input: {
  readonly scoreVisible: boolean;
  readonly matchScore: number | undefined;
}): ServerScoreDisplay {
  if (!input.scoreVisible) return { kind: 'hidden' };
  if (typeof input.matchScore === 'number') return { kind: 'visible', value: input.matchScore };
  return { kind: 'unavailable' };
}

export function getMatchingSeasonStateRule(state: SeasonState): MatchingSeasonStateRule {
  const rule = MATCHING_SEASON_STATE_MATRIX[state];
  if (!rule) {
    throw new Error(`Unsupported matching season state: ${String(state)}`);
  }
  return rule;
}
