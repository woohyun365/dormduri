import type {
  RoommateSearchSort,
  RoommateSearchSummary,
} from '@repo/shared/roommate-search/contract';

export interface RoommateSearchSortBoundary {
  nicknameSortKey: string;
  participantId: string;
}

export interface RoommateSearchSortableItem {
  summary: Pick<RoommateSearchSummary, 'matchScore'> & {
    exposure: Pick<RoommateSearchSummary['exposure'], 'scoreVisible'>;
  };
  cursorBoundary: RoommateSearchSortBoundary;
}

export function sortRoommateSearchItems<T extends RoommateSearchSortableItem>(
  items: T[],
  sort: RoommateSearchSort,
): T[] {
  if (sort === 'MATCH_SCORE') {
    return sortByMatchScore(items);
  }

  return sortByNickname(items);
}

export function sortByNickname<T extends RoommateSearchSortableItem>(items: T[]): T[] {
  return [...items].sort((left, right) => compareNicknameBoundary(left, right));
}

export function sortByMatchScore<T extends RoommateSearchSortableItem>(items: T[]): T[] {
  return items.filter(isScoreSortableItem).sort((left, right) => {
    const scoreDifference = right.summary.matchScore - left.summary.matchScore;
    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    return compareNicknameBoundary(left, right);
  });
}

function isScoreSortableItem<T extends RoommateSearchSortableItem>(
  item: T,
): item is T & { summary: RoommateSearchSummary & { matchScore: number } } {
  return item.summary.exposure.scoreVisible && typeof item.summary.matchScore === 'number';
}

function compareNicknameBoundary(
  left: RoommateSearchSortableItem,
  right: RoommateSearchSortableItem,
) {
  const leftKey = left.cursorBoundary.nicknameSortKey;
  const rightKey = right.cursorBoundary.nicknameSortKey;
  if (leftKey !== rightKey) {
    return leftKey.localeCompare(rightKey, 'ko');
  }

  return left.cursorBoundary.participantId.localeCompare(right.cursorBoundary.participantId);
}
