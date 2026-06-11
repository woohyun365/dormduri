import type {
  RoommateSearchQuery,
  RoommateSearchSummary,
} from '@repo/shared/roommate-search-contract';

export interface RoommateSearchScoreThresholdItem {
  summary: Pick<RoommateSearchSummary, 'matchScore'> & {
    exposure: Pick<RoommateSearchSummary['exposure'], 'scoreVisible'>;
  };
}

export function applyRoommateSearchScoreThreshold<T extends RoommateSearchScoreThresholdItem>(
  items: T[],
  query: Pick<RoommateSearchQuery, 'minScore'>,
): T[] {
  if (query.minScore === undefined) {
    return items;
  }

  const minScore = query.minScore;
  return items.filter(
    (item) =>
      item.summary.exposure.scoreVisible &&
      typeof item.summary.matchScore === 'number' &&
      item.summary.matchScore >= minScore,
  );
}
