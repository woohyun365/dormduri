import type {
  PublicProfileCompatibility,
  PublicTargetResultReadContext,
} from '@repo/shared/profile/contract';
import { Injectable } from '@nestjs/common';
import {
  buildPublicProfileCompatibility as buildPublicProfileCompatibilityFromScoreOwner,
  calcViewerMatchScore,
  canComputeMatchScore,
} from './match-score.algorithm.js';
import type {
  MatchScoreProjectionPort,
  MatchScoreProjectionVisibilityInput,
} from '../application/ports/match-score-projection.port.js';
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

export function buildPublicProfileCompatibility(input: {
  viewerLifestyle: LifestyleData | null;
  targetLifestyle: LifestyleData | null;
  scoreVisible: boolean;
}): PublicProfileCompatibility | null {
  if (!input.scoreVisible || !input.viewerLifestyle || !input.targetLifestyle) {
    return null;
  }

  if (!canComputeMatchScore(input.viewerLifestyle, input.targetLifestyle)) {
    return null;
  }

  return buildPublicProfileCompatibilityFromScoreOwner(
    input.viewerLifestyle,
    input.targetLifestyle,
  );
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

@Injectable()
export class MatchScoreProjectionService implements MatchScoreProjectionPort {
  buildDirectionalMatchScoreProjection(
    viewerLifestyle: LifestyleData | null,
    targetLifestyle: LifestyleData | null,
  ): number | null {
    return buildDirectionalMatchScoreProjection(viewerLifestyle, targetLifestyle);
  }

  shouldExposePublicMatchScore(input: MatchScoreProjectionVisibilityInput): boolean {
    return shouldExposePublicMatchScore(input);
  }

  calculateQueryTimeRoommateSearchScore(input: {
    viewerLifestyle: LifestyleData | null;
    targetLifestyle: LifestyleData | null;
    scoreVisible: boolean;
  }): number | null {
    if (!input.scoreVisible) {
      return null;
    }

    return buildDirectionalMatchScoreProjection(input.viewerLifestyle, input.targetLifestyle);
  }

  buildPublicProfileCompatibility(input: {
    viewerLifestyle: LifestyleData | null;
    targetLifestyle: LifestyleData | null;
    scoreVisible: boolean;
  }): PublicProfileCompatibility | null {
    return buildPublicProfileCompatibility(input);
  }
}
