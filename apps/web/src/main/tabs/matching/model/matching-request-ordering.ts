import type { MatchingRequestCardView } from './matching-request-view';

export type MatchingReceivedRequestOrder = 'expires-soon' | 'match-score';

export function orderReceivedMatchRequests(
  requests: readonly MatchingRequestCardView[],
  order: MatchingReceivedRequestOrder,
): readonly MatchingRequestCardView[] {
  return requests
    .map((request, canonicalIndex) => ({ request, canonicalIndex }))
    .sort((left, right) => {
      const comparison =
        order === 'match-score'
          ? compareMatchScore(left.request, right.request)
          : compareExpiry(left.request, right.request);

      return comparison || left.canonicalIndex - right.canonicalIndex;
    })
    .map(({ request }) => request);
}

function compareMatchScore(left: MatchingRequestCardView, right: MatchingRequestCardView): number {
  if (left.score === null && right.score === null) return 0;
  if (left.score === null) return 1;
  if (right.score === null) return -1;
  return right.score - left.score;
}

function compareExpiry(left: MatchingRequestCardView, right: MatchingRequestCardView): number {
  return toSortableTime(left.expiresAt) - toSortableTime(right.expiresAt);
}

function toSortableTime(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}
