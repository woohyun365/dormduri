import type { PublicTargetResultReadContext } from '@repo/shared/profile-contract';
import { calcViewerMatchScore } from '@repo/shared/match-score';
import type { SeasonState } from '@repo/shared/season/runtime';
import type { LifestyleData } from '@repo/shared/lifestyle';

export function buildDirectionalMatchScoreProjection(
  viewerLifestyle: LifestyleData | null,
  targetLifestyle: LifestyleData | null,
): number | null {
  if (!viewerLifestyle || !targetLifestyle) {
    return null;
  }

  return calcViewerMatchScore(viewerLifestyle, targetLifestyle);
}

export function shouldExposePublicMatchScore(input: {
  seasonState: SeasonState | null;
  scoreVisible: boolean;
  resultReadContext: PublicTargetResultReadContext;
}): boolean {
  if (!input.scoreVisible || input.seasonState === null || input.seasonState === 'OFF_SEASON') {
    return false;
  }

  if (input.seasonState === 'SEASON_POST_MATCH') {
    return input.resultReadContext === 'CURRENT_MATCHED_PARTNER';
  }

  return true;
}
