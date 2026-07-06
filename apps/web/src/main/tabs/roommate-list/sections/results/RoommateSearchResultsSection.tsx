import { RoommateSummaryCard } from '../../components/RoommateSummaryCard';
import type { RoommateSummaryCardViewModel } from '../../model/search/roommateSearchViewModel';

interface RoommateSearchResultsSectionProps {
  readonly items: readonly RoommateSummaryCardViewModel[];
  readonly canLoadMore: boolean;
  readonly onLoadMore: () => void;
  readonly onBookmarkToggle?: (targetUserId: string, bookmarked: boolean) => void;
}

export function RoommateSearchResultsSection({
  items,
  canLoadMore,
  onLoadMore,
  onBookmarkToggle,
}: RoommateSearchResultsSectionProps) {
  return (
    <section className="space-y-3" aria-label="룸메이트 검색 결과">
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <RoommateSummaryCard item={item} onBookmarkToggle={onBookmarkToggle} />
          </li>
        ))}
      </ul>

      {canLoadMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          className="w-full rounded-2xl border-2 border-[var(--knu-border)] bg-white py-3 text-sm font-semibold text-[var(--knu-primary)] transition-all hover:border-[var(--knu-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          더 보기
        </button>
      ) : (
        <p className="py-4 text-center text-sm text-[var(--knu-text-tertiary)]">
          더 이상 표시할 요약 정보가 없어요.
        </p>
      )}
    </section>
  );
}
