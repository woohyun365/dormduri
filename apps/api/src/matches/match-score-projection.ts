import type { ProfileExposureLevel, ProfileRelationToViewer } from '@repo/shared/profile-contract';
import { calcViewerMatchScore } from '@repo/shared/match-score';
import type { SeasonState } from '@repo/shared/season-contract';
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
  exposureLevel: ProfileExposureLevel;
  relationToViewer: ProfileRelationToViewer;
}): boolean {
  if (input.seasonState === null || input.seasonState === 'OFF_SEASON') {
    return false;
  }

  if (input.seasonState === 'SEASON_POST_MATCH') {
    return input.exposureLevel === 'FULL' && input.relationToViewer === 'MATCHED_PARTNER';
  }

  return input.exposureLevel === 'FULL';
}
