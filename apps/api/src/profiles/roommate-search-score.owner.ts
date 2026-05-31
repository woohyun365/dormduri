import { calcViewerMatchScore } from '@repo/shared/match-score';
import type { LifestyleData } from '@repo/shared/lifestyle';

export function calculateQueryTimeRoommateSearchScore(input: {
  viewerLifestyle: LifestyleData | null;
  targetLifestyle: LifestyleData | null;
  scoreVisible: boolean;
}): number | null {
  if (!input.scoreVisible || !input.viewerLifestyle || !input.targetLifestyle) {
    return null;
  }

  return calcViewerMatchScore(input.viewerLifestyle, input.targetLifestyle);
}
