import type {
  PublicProfileCompatibility,
  PublicTargetResultReadContext,
} from '@repo/shared/profile/contract';
import type { LifestyleData } from '@repo/shared/lifestyle';
import type { SeasonState } from '@repo/shared/season/runtime';

export const MATCH_SCORE_PROJECTION_PORT = Symbol('MATCH_SCORE_PROJECTION_PORT');

export interface MatchScoreProjectionVisibilityInput {
  seasonState: SeasonState | null;
  scoreVisible: boolean;
  resultReadContext: PublicTargetResultReadContext;
}

export interface MatchScoreProjectionPort {
  buildDirectionalMatchScoreProjection(
    viewerLifestyle: LifestyleData | null,
    targetLifestyle: LifestyleData | null,
  ): number | null;

  shouldExposePublicMatchScore(input: MatchScoreProjectionVisibilityInput): boolean;

  calculateQueryTimeRoommateSearchScore(input: {
    viewerLifestyle: LifestyleData | null;
    targetLifestyle: LifestyleData | null;
    scoreVisible: boolean;
  }): number | null;

  buildPublicProfileCompatibility(input: {
    viewerLifestyle: LifestyleData | null;
    targetLifestyle: LifestyleData | null;
    scoreVisible: boolean;
  }): PublicProfileCompatibility | null;
}
